const DADATA_SUGGEST_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address";

export class DadataError extends Error {
  constructor(message, code = "DADATA_ERROR") {
    super(message);
    this.name = "DadataError";
    this.code = code;
  }
}

export function createDadataClient(env = process.env, { fetchImpl = globalThis.fetch } = {}) {
  const token = String(env.DADATA_TOKEN || "").trim();
  const apiUrl = String(env.DADATA_SUGGEST_URL || DADATA_SUGGEST_URL).trim();
  const isConfigured = Boolean(token);

  async function suggest({ kind, query, cityFiasId }) {
    if (!isConfigured) throw new DadataError("Подсказки адресов ещё не настроены", "NOT_CONFIGURED");
    const value = String(query || "").trim().slice(0, 200);
    if (value.length < 2) return [];
    if (!fetchImpl) throw new DadataError("Fetch API недоступен", "NETWORK_UNAVAILABLE");

    const isCity = kind === "city";
    if (!isCity && kind !== "address") throw new DadataError("Неизвестный тип подсказки", "INVALID_KIND");
    const cityId = String(cityFiasId || "").trim();
    if (!isCity && !isFiasId(cityId)) throw new DadataError("Сначала выберите город", "CITY_REQUIRED");

    const body = isCity
      ? {
        query: value,
        count: 10,
        locations: [{ country_iso_code: "RU" }],
        from_bound: { value: "city" },
        to_bound: { value: "settlement" },
      }
      : {
        query: value,
        count: 10,
        locations: [{ fias_id: cityId }],
        restrict_value: true,
        from_bound: { value: "street" },
        to_bound: { value: "house" },
      };

    const response = await postJson(apiUrl, body, token, fetchImpl);
    const suggestions = Array.isArray(response.suggestions) ? response.suggestions : [];
    return suggestions.map((suggestion) => mapSuggestion(suggestion, isCity)).filter(Boolean);
  }

  return { isConfigured, suggest };
}

function mapSuggestion(suggestion, isCity) {
  const data = suggestion?.data || {};
  if (isCity) {
    const fiasId = String(data.city_fias_id || data.settlement_fias_id || data.fias_id || "");
    const value = String(data.city_with_type || data.settlement_with_type || suggestion?.value || "").trim();
    if (!value || !isFiasId(fiasId)) return null;
    return {
      value,
      label: String(suggestion?.value || value).trim(),
      fiasId,
      postalCode: String(data.postal_code || ""),
    };
  }

  const fiasId = String(data.fias_id || "");
  const value = String(suggestion?.value || "").trim();
  if (!value || !isFiasId(fiasId)) return null;
  return {
    value,
    label: value,
    fiasId,
    postalCode: String(data.postal_code || ""),
    hasHouse: Boolean(data.house),
  };
}

async function postJson(url, body, token, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = response.status === 403
        ? "DaData отклонила токен или исчерпан лимит подсказок"
        : `DaData ответила кодом ${response.status}`;
      throw new DadataError(message, "HTTP_ERROR");
    }
    return data;
  } catch (error) {
    if (error instanceof DadataError) throw error;
    throw new DadataError("Сервис адресов временно недоступен", "NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}

function isFiasId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}
