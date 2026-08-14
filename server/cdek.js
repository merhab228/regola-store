const CDEK_TEST_URL = "https://api.edu.cdek.ru/v2";
const CDEK_PRODUCTION_URL = "https://api.cdek.ru/v2";

export class CdekError extends Error {
  constructor(message, code = "CDEK_ERROR") {
    super(message);
    this.name = "CdekError";
    this.code = code;
  }
}

export function createCdekClient(env = process.env, { fetchImpl = globalThis.fetch } = {}) {
  const config = readConfig(env);
  let cachedToken = null;
  let tokenExpiresAt = 0;

  async function token() {
    requireEstimateConfig(config);
    if (typeof fetchImpl !== "function") throw new CdekError("Fetch API недоступен", "NETWORK_UNAVAILABLE");
    if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;
    const form = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetchImpl(`${config.apiUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token) throw new CdekError("СДЭК не выдал токен API", "AUTH_FAILED");
      cachedToken = String(data.access_token);
      tokenExpiresAt = Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000;
      return cachedToken;
    } catch (error) {
      if (error instanceof CdekError) throw error;
      throw new CdekError("Не удалось связаться со СДЭК", "NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  }

  async function request(path, { method = "GET", body } = {}) {
    const accessToken = await token();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetchImpl(`${config.apiUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new CdekError(`СДЭК ответил кодом ${response.status}`, "HTTP_ERROR");
      return data;
    } catch (error) {
      if (error instanceof CdekError) throw error;
      throw new CdekError("Не удалось связаться со СДЭК", "NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  }

  async function resolveCity(city, cityCode) {
    if (positiveInteger(cityCode)) return Number(cityCode);
    const query = new URLSearchParams({ city: String(city || "").trim(), country_codes: "RU", size: "20" });
    const cities = await request(`/location/cities?${query.toString()}`);
    if (!Array.isArray(cities) || !cities.length) throw new CdekError("СДЭК не нашёл город доставки", "CITY_NOT_FOUND");
    const normalized = String(city || "").trim().toLowerCase();
    const exact = cities.find((item) => String(item.city || "").trim().toLowerCase() === normalized);
    const code = Number((exact || cities[0]).code);
    if (!positiveInteger(code)) throw new CdekError("СДЭК вернул некорректный код города", "CITY_INVALID");
    return code;
  }

  async function estimate({ city, cityCode, deliveryMethod, totalQty }) {
    requireEstimateConfig(config);
    const toCityCode = await resolveCity(city, cityCode);
    const tariffCode = tariffFor(config, deliveryMethod);
    const payload = {
      type: 1,
      currency: 1,
      tariff_code: tariffCode,
      from_location: { code: config.fromCityCode },
      to_location: { code: toCityCode },
      packages: [packageFor(config, totalQty)],
    };
    const result = await request("/calculator/tariff", { method: "POST", body: payload });
    const deliveryPrice = Math.ceil(Number(result.total_sum));
    if (!Number.isSafeInteger(deliveryPrice) || deliveryPrice < 0) {
      throw new CdekError("СДЭК вернул некорректную стоимость", "PRICE_INVALID");
    }
    return {
      provider: "CDEK",
      mode: config.mode,
      city,
      cityCode: toCityCode,
      deliveryPrice,
      minDays: Math.max(1, Number(result.period_min) || 1),
      maxDays: Math.max(1, Number(result.period_max) || Number(result.period_min) || 1),
      tariffCode,
      tariff: String(result.tariff_name || "СДЭК"),
      notice: "Стоимость рассчитана сервером через API СДЭК и будет подтверждена при создании отправления.",
    };
  }

  async function deliveryPoints({ city, cityCode }) {
    requireEstimateConfig(config);
    const resolvedCityCode = await resolveCity(city, cityCode);
    const query = new URLSearchParams({ city_code: String(resolvedCityCode), type: "PVZ", is_handout: "true", size: "500" });
    const points = await request(`/deliverypoints?${query.toString()}`);
    return (Array.isArray(points) ? points : []).map((point) => ({
      code: String(point.code || ""),
      name: String(point.name || point.code || "ПВЗ СДЭК"),
      address: String(point.location?.address_full || point.location?.address || ""),
      workTime: String(point.work_time || ""),
    })).filter((point) => point.code);
  }

  async function createOrder({ order, items }) {
    requireOrderConfig(config);
    const tariffCode = positiveInteger(order.cdekTariffCode)
      ? Number(order.cdekTariffCode)
      : tariffFor(config, order.deliveryMethod);
    const isPvz = order.deliveryMethod === "СДЭК до ПВЗ";
    if (isPvz && !order.cdekDeliveryPoint) throw new CdekError("Для заказа не выбран ПВЗ СДЭК", "PVZ_REQUIRED");
    if (!isPvz && !order.address) throw new CdekError("Для курьерской доставки нужен адрес", "ADDRESS_REQUIRED");
    const cod = order.paymentMethod === "cod";
    const payload = {
      type: 1,
      number: `REGOLA-${order.id}`,
      tariff_code: tariffCode,
      shipment_point: config.shipmentPoint,
      recipient: {
        name: order.name,
        email: order.email || undefined,
        phones: [{ number: normalizePhone(order.phone) }],
      },
      from_location: { code: config.fromCityCode },
      to_location: { code: order.cdekCityCode || undefined, city: order.city, address: isPvz ? undefined : order.address },
      delivery_point: isPvz ? order.cdekDeliveryPoint : undefined,
      delivery_recipient_cost: { value: cod ? order.deliveryPrice : 0 },
      packages: [{
        ...packageFor(config, items.reduce((sum, item) => sum + item.qty, 0)),
        number: `REGOLA-${order.id}-1`,
        items: items.map((item) => ({
          name: String(item.name).slice(0, 255),
          ware_key: String(item.productId),
          payment: { value: cod ? item.price : 0 },
          cost: item.price,
          amount: item.qty,
          weight: config.unitWeight,
        })),
      }],
      sender: {
        name: config.senderName,
        phones: [{ number: normalizePhone(config.senderPhone) }],
      },
    };
    const response = await request("/orders", { method: "POST", body: stripUndefined(payload) });
    const errors = (response.requests || []).flatMap((entry) => entry.errors || []);
    if (!response.entity?.uuid || errors.length) {
      throw new CdekError(String(errors[0]?.message || "СДЭК не принял заказ").slice(0, 300), "ORDER_REJECTED");
    }
    return {
      uuid: String(response.entity.uuid),
      cdekNumber: response.entity.cdek_number ? String(response.entity.cdek_number) : "",
      status: "created",
      tariffCode,
    };
  }

  async function orderStatus(uuid) {
    requireEstimateConfig(config);
    const value = String(uuid || "").trim();
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(value)) throw new CdekError("Некорректный UUID СДЭК", "UUID_INVALID");
    const response = await request(`/orders/${encodeURIComponent(value)}`);
    if (!response.entity?.uuid) throw new CdekError("СДЭК не вернул данные отправления", "ORDER_NOT_FOUND");
    const statuses = Array.isArray(response.entity.statuses) ? response.entity.statuses : [];
    const latest = statuses[statuses.length - 1] || {};
    return {
      uuid: String(response.entity.uuid),
      cdekNumber: String(response.entity.cdek_number || ""),
      status: String(latest.code || "created").toLowerCase(),
      statusName: String(latest.name || ""),
    };
  }

  return {
    config: { provider: "cdek", mode: config.mode, enabled: config.canEstimate, orderCreationEnabled: config.canCreateOrders },
    isConfigured: config.canEstimate,
    canCreateOrders: config.canCreateOrders,
    estimate,
    deliveryPoints,
    createOrder,
    orderStatus,
  };
}

function readConfig(env) {
  const mode = String(env.CDEK_MODE || "test").trim().toLowerCase() === "production" ? "production" : "test";
  const apiUrl = String(env.CDEK_API_URL || (mode === "production" ? CDEK_PRODUCTION_URL : CDEK_TEST_URL)).replace(/\/$/, "");
  const config = {
    mode,
    apiUrl,
    clientId: String(env.CDEK_CLIENT_ID || "").trim(),
    clientSecret: String(env.CDEK_CLIENT_SECRET || "").trim(),
    fromCityCode: Number(env.CDEK_FROM_CITY_CODE || env.CDEK_SENDER_CITY_CODE),
    tariffPvz: Number(env.CDEK_TARIFF_PVZ),
    tariffCourier: Number(env.CDEK_TARIFF_COURIER),
    unitWeight: Number(env.CDEK_PACKAGE_WEIGHT_G),
    packageLength: Number(env.CDEK_PACKAGE_LENGTH_CM),
    packageWidth: Number(env.CDEK_PACKAGE_WIDTH_CM),
    packageHeight: Number(env.CDEK_PACKAGE_HEIGHT_CM),
    shipmentPoint: String(env.CDEK_SHIPMENT_POINT || "").trim(),
    senderName: String(env.CDEK_SENDER_NAME || "").trim(),
    senderPhone: String(env.CDEK_SENDER_PHONE || "").trim(),
  };
  config.canEstimate = Boolean(
    config.clientId && config.clientSecret && positiveInteger(config.fromCityCode)
    && positiveInteger(config.tariffPvz) && positiveInteger(config.tariffCourier)
    && positiveInteger(config.unitWeight) && positiveInteger(config.packageLength)
    && positiveInteger(config.packageWidth) && positiveInteger(config.packageHeight)
  );
  config.canCreateOrders = Boolean(config.canEstimate && config.shipmentPoint && config.senderName && config.senderPhone);
  return config;
}

function requireEstimateConfig(config) {
  if (!config.canEstimate) throw new CdekError("API СДЭК ещё не настроен", "NOT_CONFIGURED");
}

function requireOrderConfig(config) {
  if (!config.canCreateOrders) throw new CdekError("Создание отправлений СДЭК ещё не настроено", "ORDER_NOT_CONFIGURED");
}

function tariffFor(config, method) {
  if (method === "СДЭК до ПВЗ") return config.tariffPvz;
  if (method === "СДЭК курьером") return config.tariffCourier;
  throw new CdekError("Для выбранной доставки нет тарифа СДЭК", "TARIFF_NOT_AVAILABLE");
}

function packageFor(config, totalQty) {
  const qty = Math.max(1, Number(totalQty) || 1);
  return {
    weight: config.unitWeight * qty,
    length: config.packageLength,
    width: config.packageWidth,
    height: config.packageHeight,
  };
}

function positiveInteger(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined && item !== "")
    .map(([key, item]) => [key, stripUndefined(item)]));
}
