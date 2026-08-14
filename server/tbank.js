import crypto from "crypto";

const TBANK_TEST_URL = "https://rest-api-test.tinkoff.ru/v2";
const TBANK_PRODUCTION_URL = "https://securepay.tinkoff.ru/v2";
const MAX_TBANK_AMOUNT_KOPECKS = 9_999_999_999;
const ALLOWED_TAXATION = new Set(["osn", "usn_income", "usn_income_outcome", "esn", "patent"]);
const ALLOWED_TAX = new Set(["none", "vat0", "vat5", "vat7", "vat10", "vat22", "vat105", "vat107", "vat110", "vat122"]);

export class TbankError extends Error {
  constructor(message, code = "TBANK_ERROR") {
    super(message);
    this.name = "TbankError";
    this.code = code;
  }
}

export function createTbankClient(env = process.env, { fetchImpl = globalThis.fetch } = {}) {
  const config = readConfig(env);

  return {
    config: publicConfig(config),
    isConfigured: config.isConfigured,
    sign(payload) {
      requireConfigured(config);
      return createTbankToken(payload, config.password);
    },
    verifyNotification(payload) {
      if (!config.isConfigured || !payload || typeof payload !== "object" || Array.isArray(payload)) return false;
      if (String(payload.TerminalKey || "") !== config.terminalKey || typeof payload.Token !== "string") return false;
      const expected = createTbankToken(payload, config.password);
      return timingSafeEqual(expected, payload.Token);
    },
    async initPayment({ order, items }) {
      requireConfigured(config);
      if (typeof fetchImpl !== "function") throw new TbankError("Fetch API недоступен", "NETWORK_UNAVAILABLE");
      const request = buildInitRequest(config, order, items);
      request.Token = createTbankToken(request, config.password);
      const response = await postJson(`${config.apiUrl}/Init`, request, fetchImpl);
      if (!response?.Success || !response.PaymentURL || !response.PaymentId) {
        throw new TbankError(safeProviderMessage(response), String(response?.ErrorCode || "INIT_FAILED"));
      }
      return {
        provider: "tbank",
        paymentId: String(response.PaymentId),
        paymentUrl: String(response.PaymentURL),
        amountKopecks: request.Amount,
        status: String(response.Status || "NEW"),
      };
    },
  };
}

export function createTbankToken(payload, password) {
  const values = Object.entries(payload || {})
    .filter(([key, value]) => key !== "Token" && value !== null && value !== undefined && isPrimitive(value))
    .concat([["Password", password]])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => String(value))
    .join("");
  return crypto.createHash("sha256").update(values, "utf8").digest("hex");
}

export function paymentStatusFromTbank(status) {
  const value = String(status || "").toUpperCase();
  if (value === "CONFIRMED") return "paid";
  if (value === "AUTHORIZED") return "authorized";
  if (value === "REJECTED") return "failed";
  if (value === "CANCELED") return "cancelled";
  if (value === "DEADLINE_EXPIRED") return "expired";
  if (value === "REFUNDED") return "refunded";
  if (value === "PARTIAL_REFUNDED") return "partially_refunded";
  return "pending";
}

export function parseTbankOrderId(value) {
  const match = /^regola-(\d+)$/.exec(String(value || ""));
  if (!match) return null;
  const orderId = Number(match[1]);
  return Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
}

export function processTbankNotification({ database, client, payload }) {
  if (!client.verifyNotification(payload)) return { statusCode: 403, body: "INVALID TOKEN" };
  const orderId = parseTbankOrderId(payload.OrderId);
  if (!orderId) return { statusCode: 400, body: "INVALID ORDER" };

  const order = database.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order || order.payment_method !== "online") return { statusCode: 404, body: "ORDER NOT FOUND" };

  const amount = Number(payload.Amount);
  const paymentId = String(payload.PaymentId || "");
  if (!Number.isSafeInteger(amount) || amount !== order.total * 100) {
    return { statusCode: 409, body: "AMOUNT MISMATCH" };
  }
  if (order.payment_id && paymentId && String(order.payment_id) !== paymentId) {
    return { statusCode: 409, body: "PAYMENT MISMATCH" };
  }

  database.prepare(`
    UPDATE orders
    SET payment_status = ?, payment_provider = 'tbank',
        payment_id = COALESCE(payment_id, ?), payment_amount_kopecks = ?
    WHERE id = ?
  `).run(paymentStatusFromTbank(payload.Status), paymentId || null, amount, orderId);
  return { statusCode: 200, body: "OK" };
}

function readConfig(env) {
  const mode = String(env.TBANK_MODE || "test").trim().toLowerCase() === "production" ? "production" : "test";
  const publicBaseUrl = String(env.PUBLIC_BASE_URL || "https://regola.shop").replace(/\/$/, "");
  const terminalKey = String(env.TBANK_TERMINAL_KEY || "").trim();
  const demoTerminal = /DEMO$/i.test(terminalKey);
  const defaultApiUrl = mode === "production" || demoTerminal ? TBANK_PRODUCTION_URL : TBANK_TEST_URL;
  const apiUrl = String(env.TBANK_API_URL || defaultApiUrl).replace(/\/$/, "");
  const password = String(env.TBANK_PASSWORD || "").trim();
  const taxation = String(env.TBANK_TAXATION || "").trim();
  const itemTax = String(env.TBANK_ITEM_TAX || "").trim();
  const deliveryTax = String(env.TBANK_DELIVERY_TAX || itemTax).trim();
  const isConfigured = Boolean(
    terminalKey && password && publicBaseUrl.startsWith("https://")
    && ALLOWED_TAXATION.has(taxation) && ALLOWED_TAX.has(itemTax) && ALLOWED_TAX.has(deliveryTax)
  );
  return { mode, apiUrl, publicBaseUrl, terminalKey, password, taxation, itemTax, deliveryTax, isConfigured };
}

function publicConfig(config) {
  return { provider: "tbank", mode: config.mode, enabled: config.isConfigured };
}

function requireConfigured(config) {
  if (!config.isConfigured) {
    throw new TbankError("Эквайринг T-Банка ещё не настроен", "NOT_CONFIGURED");
  }
}

function buildInitRequest(config, order, items) {
  const amountKopecks = rublesToKopecks(order.total);
  const receiptItems = items.map((item) => {
    const price = rublesToKopecks(item.price);
    const amount = price * item.qty;
    if (!Number.isSafeInteger(amount) || amount > MAX_TBANK_AMOUNT_KOPECKS) {
      throw new TbankError("Сумма позиции превышает лимит T-Банка", "AMOUNT_LIMIT");
    }
    return {
      Name: String(item.name || "Товар").trim().slice(0, 128),
      Price: price,
      Quantity: item.qty,
      Amount: amount,
      Tax: config.itemTax,
      PaymentMethod: "full_payment",
      PaymentObject: "commodity",
    };
  });

  if (order.deliveryPrice > 0) {
    receiptItems.push({
      Name: "Доставка",
      Price: rublesToKopecks(order.deliveryPrice),
      Quantity: 1,
      Amount: rublesToKopecks(order.deliveryPrice),
      Tax: config.deliveryTax,
      PaymentMethod: "full_payment",
      PaymentObject: "service",
    });
  }
  const receiptTotal = receiptItems.reduce((sum, item) => sum + item.Amount, 0);
  if (receiptTotal !== amountKopecks) throw new TbankError("Сумма чека не совпадает с суммой заказа", "RECEIPT_MISMATCH");

  const orderKey = `regola-${order.id}`;
  const request = {
    TerminalKey: config.terminalKey,
    Amount: amountKopecks,
    OrderId: orderKey,
    Description: `Заказ Regola №${order.id}`,
    PayType: "O",
    Language: "ru",
    NotificationURL: `${config.publicBaseUrl}/api/payments/tbank/notification`,
    SuccessURL: `${config.publicBaseUrl}/cart?payment=success&order=${order.id}`,
    FailURL: `${config.publicBaseUrl}/cart?payment=fail&order=${order.id}`,
    DATA: { order_id: String(order.id) },
    Receipt: {
      Phone: normalizePhone(order.phone),
      Taxation: config.taxation,
      Items: receiptItems,
    },
  };
  if (order.email) request.Receipt.Email = order.email;
  return request;
}

function rublesToKopecks(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TbankError("Некорректная сумма заказа", "INVALID_AMOUNT");
  const kopecks = value * 100;
  if (!Number.isSafeInteger(kopecks) || kopecks > MAX_TBANK_AMOUNT_KOPECKS) {
    throw new TbankError("Сумма заказа превышает лимит T-Банка", "AMOUNT_LIMIT");
  }
  return kopecks;
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function isPrimitive(value) {
  return ["string", "number", "boolean"].includes(typeof value);
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function postJson(url, body, fetchImpl) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new TbankError(`T-Банк ответил кодом ${response.status}`, "HTTP_ERROR");
      return data;
    } catch (error) {
      if (error instanceof TbankError) throw error;
      if (attempt === 2) throw new TbankError("Не удалось связаться с T-Банком", "NETWORK_ERROR");
      await new Promise((resolve) => setTimeout(resolve, 250));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new TbankError("Не удалось связаться с T-Банком", "NETWORK_ERROR");
}

function safeProviderMessage(response) {
  const message = String(response?.Message || response?.Details || "Не удалось создать платёж").trim();
  return message.slice(0, 300);
}
