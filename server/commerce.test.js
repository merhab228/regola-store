import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  createTbankClient,
  createTbankToken,
  paymentStatusFromTbank,
  processTbankNotification,
} from "./tbank.js";
import { createCdekClient } from "./cdek.js";

const tbankEnv = {
  TBANK_MODE: "test",
  TBANK_TERMINAL_KEY: "DemoTerminal",
  TBANK_PASSWORD: "DemoPassword",
  PUBLIC_BASE_URL: "https://regola.shop",
  TBANK_TAXATION: "usn_income",
  TBANK_ITEM_TAX: "none",
  TBANK_DELIVERY_TAX: "none",
};

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("T-Bank token signs only root scalar fields and verifies notifications", () => {
  const payload = {
    TerminalKey: "DemoTerminal",
    Amount: 230000,
    OrderId: "regola-7",
    Success: true,
    Receipt: { Taxation: "usn_income" },
  };
  const token = createTbankToken(payload, "DemoPassword");
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(createTbankToken({ ...payload, Receipt: { Taxation: "osn" } }, "DemoPassword"), token);
  assert.notEqual(createTbankToken({ ...payload, Amount: 1 }, "DemoPassword"), token);

  const client = createTbankClient(tbankEnv);
  assert.equal(client.verifyNotification({ ...payload, Token: token }), true);
  assert.equal(client.verifyNotification({ ...payload, Amount: 1, Token: token }), false);
});

test("T-Bank Init receives authoritative kopecks, receipt and signed request", async () => {
  let captured;
  const client = createTbankClient(tbankEnv, {
    fetchImpl: async (url, options) => {
      captured = { url, body: JSON.parse(options.body) };
      return jsonResponse({ Success: true, PaymentId: "pay-77", PaymentURL: "https://securepay.tbank.ru/demo", Status: "NEW" });
    },
  });
  const result = await client.initPayment({
    order: { id: 7, total: 2300, deliveryPrice: 300, phone: "+7 999 111-22-33", email: "buyer@example.ru", cancelToken: "a".repeat(64) },
    items: [{ productId: 1, name: "Ручка Regola", price: 1000, qty: 2 }],
  });

  assert.equal(captured.url, "https://rest-api-test.tinkoff.ru/v2/Init");
  assert.equal(captured.body.Amount, 230000);
  assert.match(captured.body.SuccessURL, /\/order\/7\?payment=success&token=a{64}$/);
  assert.equal(captured.body.Receipt.Items.reduce((sum, item) => sum + item.Amount, 0), 230000);
  assert.equal(captured.body.Token, createTbankToken(captured.body, tbankEnv.TBANK_PASSWORD));
  assert.equal(result.paymentId, "pay-77");
  assert.equal(result.amountKopecks, 230000);
});

test("a DEMO terminal automatically uses the securepay endpoint", async () => {
  let capturedUrl = "";
  const client = createTbankClient({ ...tbankEnv, TBANK_TERMINAL_KEY: "1786346307558DEMO" }, {
    fetchImpl: async (url) => {
      capturedUrl = url;
      return jsonResponse({ Success: true, PaymentId: "pay-demo", PaymentURL: "https://securepay.tbank.ru/demo", Status: "NEW" });
    },
  });
  await client.initPayment({
    order: { id: 8, total: 1000, deliveryPrice: 0, phone: "+79991112233", email: "buyer@example.ru", cancelToken: "b".repeat(64) },
    items: [{ productId: 1, name: "Ручка Regola", price: 1000, qty: 1 }],
  });
  assert.equal(capturedUrl, "https://securepay.tinkoff.ru/v2/Init");
});

test("T-Bank cancellation signs and sends a full refund request", async () => {
  let captured;
  const client = createTbankClient(tbankEnv, {
    fetchImpl: async (url, options) => {
      captured = { url, body: JSON.parse(options.body) };
      return jsonResponse({ Success: true, PaymentId: "pay-77", Status: "REFUNDED" });
    },
  });
  const result = await client.cancelPayment({ paymentId: "pay-77" });
  assert.equal(captured.url, "https://rest-api-test.tinkoff.ru/v2/Cancel");
  assert.equal(captured.body.Token, createTbankToken(captured.body, tbankEnv.TBANK_PASSWORD));
  assert.equal(result.paymentStatus, "refunded");
});

test("T-Bank notification rejects price/payment mismatches and is idempotent", () => {
  const database = new Database(":memory:");
  database.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      total INTEGER NOT NULL,
      payment_method TEXT,
      payment_status TEXT,
      payment_provider TEXT,
      payment_id TEXT,
      payment_amount_kopecks INTEGER
    );
    INSERT INTO orders VALUES (7, 2300, 'online', 'awaiting_payment', 'tbank', 'pay-77', 230000);
  `);
  const client = createTbankClient(tbankEnv);
  const notification = {
    TerminalKey: "DemoTerminal",
    OrderId: "regola-7",
    PaymentId: "pay-77",
    Amount: 230000,
    Status: "CONFIRMED",
    Success: true,
  };
  notification.Token = createTbankToken(notification, tbankEnv.TBANK_PASSWORD);

  assert.deepEqual(processTbankNotification({ database, client, payload: notification }), {
    statusCode: 200,
    body: "OK",
    orderId: 7,
    paymentStatus: "paid",
    paymentJustConfirmed: true,
  });
  assert.deepEqual(processTbankNotification({ database, client, payload: notification }), {
    statusCode: 200,
    body: "OK",
    orderId: 7,
    paymentStatus: "paid",
    paymentJustConfirmed: false,
  });
  assert.equal(database.prepare("SELECT payment_status FROM orders WHERE id = 7").get().payment_status, "paid");

  const wrongAmount = { ...notification, Amount: 1 };
  wrongAmount.Token = createTbankToken(wrongAmount, tbankEnv.TBANK_PASSWORD);
  assert.equal(processTbankNotification({ database, client, payload: wrongAmount }).statusCode, 409);
  const wrongPayment = { ...notification, PaymentId: "another" };
  wrongPayment.Token = createTbankToken(wrongPayment, tbankEnv.TBANK_PASSWORD);
  assert.equal(processTbankNotification({ database, client, payload: wrongPayment }).statusCode, 409);
  database.close();
});

test("T-Bank statuses map to internal order states", () => {
  assert.equal(paymentStatusFromTbank("CONFIRMED"), "paid");
  assert.equal(paymentStatusFromTbank("REJECTED"), "failed");
  assert.equal(paymentStatusFromTbank("REFUNDED"), "refunded");
  assert.equal(paymentStatusFromTbank("REVERSED"), "refunded");
  assert.equal(paymentStatusFromTbank("NEW"), "pending");
});

test("CDEK test API calculates tariff, lists PVZ and creates COD shipment", async () => {
  const calls = [];
  const env = {
    CDEK_MODE: "test",
    CDEK_CLIENT_ID: "client",
    CDEK_CLIENT_SECRET: "secret",
    CDEK_FROM_CITY_CODE: "137",
    CDEK_TARIFF_PVZ: "136",
    CDEK_PACKAGE_WEIGHT_G: "500",
    CDEK_PACKAGE_LENGTH_CM: "17",
    CDEK_PACKAGE_WIDTH_CM: "14",
    CDEK_PACKAGE_HEIGHT_CM: "7",
    CDEK_SHIPMENT_POINT: "SPB206",
    CDEK_SENDER_NAME: "Regola",
    CDEK_SENDER_PHONE: "+79829412000",
  };
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/oauth/token")) return jsonResponse({ access_token: "token", expires_in: 3600 });
    if (url.includes("/location/cities")) return jsonResponse([{ code: 44, city: "Москва" }]);
    if (url.endsWith("/calculator/tariff")) return jsonResponse({ total_sum: 487.2, period_min: 2, period_max: 4, tariff_name: "Склад–склад" });
    if (url.includes("/deliverypoints")) return jsonResponse([{ code: "MSK1", name: "ПВЗ", location: { address_full: "Москва, Тверская, 1" } }]);
    if (url.endsWith("/orders/11111111-1111-1111-1111-111111111111")) return jsonResponse({ entity: { uuid: "11111111-1111-1111-1111-111111111111", cdek_number: "123456", statuses: [{ code: "CREATED" }, { code: "DELIVERED", name: "Вручен" }] } });
    if (url.endsWith("/orders")) return jsonResponse({ entity: { uuid: "11111111-1111-1111-1111-111111111111", cdek_number: "123456" }, requests: [{ state: "ACCEPTED", errors: [] }] });
    return jsonResponse({}, 404);
  };
  const client = createCdekClient(env, { fetchImpl });

  const estimate = await client.estimate({ city: "Москва", deliveryMethod: "СДЭК до ПВЗ", totalQty: 2 });
  assert.equal(estimate.deliveryPrice, 488);
  assert.equal(estimate.cityCode, 44);
  assert.equal(estimate.tariffCode, 136);
  const points = await client.deliveryPoints({ cityCode: 44 });
  assert.equal(points[0].code, "MSK1");

  const shipment = await client.createOrder({
    order: {
      id: 7,
      name: "Иван",
      phone: "+79991112233",
      email: "buyer@example.ru",
      city: "Москва",
      deliveryMethod: "СДЭК до ПВЗ",
      deliveryPrice: 488,
      paymentMethod: "cod",
      cdekTariffCode: 136,
      cdekCityCode: 44,
      cdekDeliveryPoint: "MSK1",
    },
    items: [{ productId: 1, name: "Ручка", price: 1000, qty: 2 }],
  });
  assert.equal(shipment.uuid, "11111111-1111-1111-1111-111111111111");
  const orderCall = calls.find((call) => call.url.endsWith("/orders"));
  const orderBody = JSON.parse(orderCall.options.body);
  assert.equal(orderBody.delivery_point, "MSK1");
  assert.deepEqual(
    { length: orderBody.packages[0].length, width: orderBody.packages[0].width, height: orderBody.packages[0].height },
    { length: 17, width: 14, height: 7 },
  );
  assert.equal(orderBody.packages[0].weight, 1000);
  assert.equal(orderBody.packages[0].items[0].payment.value, 1000);
  assert.equal(orderBody.delivery_recipient_cost.value, 488);
  assert.equal(calls.filter((call) => call.url.endsWith("/oauth/token")).length, 1);
  const status = await client.orderStatus("11111111-1111-1111-1111-111111111111");
  assert.equal(status.status, "delivered");
  assert.equal(status.cdekNumber, "123456");
});
