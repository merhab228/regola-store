import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CheckoutValidationError,
  MAX_ORDER_ITEMS,
  MAX_QTY_PER_PRODUCT,
  createCheckoutHandler,
  createCheckoutRecord,
  estimateCheckoutDelivery,
} from "./checkout.js";

function createDatabase() {
  const database = new Database(":memory:");
  database.exec(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      city TEXT,
      address TEXT NOT NULL,
      comment TEXT,
      delivery TEXT NOT NULL,
      delivery_method TEXT,
      delivery_price INTEGER NOT NULL DEFAULT 0,
      goods_total INTEGER NOT NULL DEFAULT 0,
      payment TEXT NOT NULL,
      payment_method TEXT,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_provider TEXT,
      payment_id TEXT,
      payment_url TEXT,
      payment_amount_kopecks INTEGER,
      cdek_status TEXT,
      cdek_uuid TEXT,
      cdek_number TEXT,
      cdek_tariff_code INTEGER,
      cdek_city_code INTEGER,
      cdek_delivery_point TEXT,
      total INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      price INTEGER NOT NULL
    );
  `);
  return database;
}

function insertProduct(database, { id = 1, name = "Ручка Regola", price = 1000, isActive = 1 } = {}) {
  database.prepare("INSERT INTO products (id, name, price, is_active) VALUES (?, ?, ?, ?)")
    .run(id, name, price, isActive);
}

function checkoutBody(overrides = {}) {
  return {
    name: "Иван Петров",
    phone: "+7 999 123-45-67",
    email: "ivan@example.ru",
    city: "Санкт-Петербург",
    address: "Проспект Героев, 26",
    deliveryMethod: "СДЭК до ПВЗ",
    paymentMethod: "online",
    comment: "Позвонить перед доставкой",
    items: [{ productId: 1, qty: 2 }],
    ...overrides,
  };
}

function savedOrder(database) {
  const order = database.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 1").get();
  const items = order
    ? database.prepare("SELECT product_id AS productId, name, qty, price FROM order_items WHERE order_id = ? ORDER BY id").all(order.id)
    : [];
  return { order, items };
}

test("client-controlled prices, totals and delivery price are ignored", () => {
  const database = createDatabase();
  insertProduct(database, { price: 1000 });

  createCheckoutRecord(database, checkoutBody({
    total: 1,
    goodsTotal: 1,
    deliveryPrice: 0,
    items: [{ productId: 1, qty: 2, price: 0, name: "Поддельный товар" }],
  }));

  const { order, items } = savedOrder(database);
  assert.equal(items[0].name, "Ручка Regola");
  assert.equal(items[0].price, 1000);
  assert.equal(items[0].qty, 2);
  assert.equal(order.total, 2310);
  assert.equal(order.total, items[0].price * items[0].qty + 310);
  database.close();
});

test("delivery estimate uses database prices instead of client goods total", () => {
  const database = createDatabase();
  insertProduct(database, { price: 16000 });
  const estimate = estimateCheckoutDelivery(database, {
    city: "Санкт-Петербург",
    goodsTotal: 1,
    deliveryPrice: 999999,
    items: [{ productId: 1, qty: 1, price: 1 }],
  });
  assert.equal(estimate.deliveryPrice, 0);
  database.close();
});

test("invalid quantities are rejected before an order is written", async (t) => {
  const invalidQuantities = [0, -1, 1.5, "1", Number.NaN, Number.POSITIVE_INFINITY, MAX_QTY_PER_PRODUCT + 1];
  for (const qty of invalidQuantities) {
    await t.test(String(qty), () => {
      const database = createDatabase();
      insertProduct(database);
      assert.throws(
        () => createCheckoutRecord(database, checkoutBody({ items: [{ productId: 1, qty }] })),
        CheckoutValidationError,
      );
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 0);
      database.close();
    });
  }
});

test("checkout customer fields enforce server-side types and length limits", async (t) => {
  const invalidBodies = [
    { label: "short name", value: { name: "Я" } },
    { label: "long name", value: { name: "Я".repeat(101) } },
    { label: "invalid phone", value: { phone: "call-me-now" } },
    { label: "long phone", value: { phone: "+" + "7".repeat(32) } },
    { label: "invalid address type", value: { address: { street: "Героев" } } },
    { label: "long address", value: { address: "А".repeat(301) } },
    { label: "invalid comment type", value: { comment: ["test"] } },
    { label: "long comment", value: { comment: "А".repeat(2001) } },
    { label: "fake name", value: { name: "123456" } },
    { label: "short russian phone", value: { phone: "83838383" } },
    { label: "fake city", value: { city: "ппп" } },
    { label: "courier address without house", value: { deliveryMethod: "СДЭК курьером", address: "Тверская улица" } },
  ];
  for (const scenario of invalidBodies) {
    await t.test(scenario.label, () => {
      const database = createDatabase();
      insertProduct(database);
      assert.throws(
        () => createCheckoutRecord(database, checkoutBody(scenario.value)),
        CheckoutValidationError,
      );
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 0);
      database.close();
    });
  }
});

test("checkout accepts only online payment and CDEK delivery", () => {
  const database = createDatabase();
  insertProduct(database);
  for (const body of [
    checkoutBody({ paymentMethod: "invoice" }),
    checkoutBody({ paymentMethod: "cod" }),
    checkoutBody({ deliveryMethod: "Почта России" }),
  ]) {
    assert.throws(() => createCheckoutRecord(database, body), CheckoutValidationError);
  }
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 0);
  database.close();
});

test("unknown, inactive and incorrectly priced products cannot create an order", async (t) => {
  const cases = [
    { label: "unknown", setup() {}, productId: 999 },
    { label: "inactive", setup(db) { insertProduct(db, { isActive: 0 }); }, productId: 1 },
    { label: "zero price", setup(db) { insertProduct(db, { price: 0 }); }, productId: 1 },
    { label: "fractional price", setup(db) { insertProduct(db, { price: 10.5 }); }, productId: 1 },
  ];
  for (const scenario of cases) {
    await t.test(scenario.label, () => {
      const database = createDatabase();
      scenario.setup(database);
      assert.throws(
        () => createCheckoutRecord(database, checkoutBody({ items: [{ productId: scenario.productId, qty: 1 }] })),
        CheckoutValidationError,
      );
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 0);
      database.close();
    });
  }
});

test("more than the item limit is rejected as a whole", () => {
  const database = createDatabase();
  insertProduct(database);
  const items = Array.from({ length: MAX_ORDER_ITEMS + 1 }, () => ({ productId: 1, qty: 1 }));
  assert.throws(() => createCheckoutRecord(database, checkoutBody({ items })), CheckoutValidationError);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 0);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM order_items").get().count, 0);
  database.close();
});

test("duplicate product ids are merged and validated", () => {
  const database = createDatabase();
  insertProduct(database);
  createCheckoutRecord(database, checkoutBody({
    items: [{ productId: 1, qty: 2 }, { productId: 1, qty: 3 }],
  }));
  const { order, items } = savedOrder(database);
  assert.deepEqual(items, [{ productId: 1, name: "Ручка Regola", qty: 5, price: 1000 }]);
  assert.equal(order.total, 5490);

  assert.throws(
    () => createCheckoutRecord(database, checkoutBody({
      items: [{ productId: 1, qty: 50 }, { productId: 1, qty: 50 }],
    })),
    CheckoutValidationError,
  );
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 1);
  database.close();
});

test("an order item insertion failure rolls back the complete transaction", () => {
  const database = createDatabase();
  insertProduct(database, { id: 1 });
  insertProduct(database, { id: 2, name: "Вторая ручка", price: 1200 });
  database.exec(`
    CREATE TRIGGER fail_second_item
    BEFORE INSERT ON order_items
    WHEN NEW.product_id = 2
    BEGIN
      SELECT RAISE(ABORT, 'simulated insert failure');
    END;
  `);

  assert.throws(() => createCheckoutRecord(database, checkoutBody({
    items: [{ productId: 1, qty: 1 }, { productId: 2, qty: 1 }],
  })));
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 0);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM order_items").get().count, 0);
  database.close();
});

test("a Telegram failure after commit still returns the created order", async () => {
  const database = createDatabase();
  insertProduct(database);
  const warnings = [];
  const handler = createCheckoutHandler({
    database,
    saveOrderMessage: (payload) => ({ name: payload.name, payload }),
    notifyTelegram: async () => { throw new Error("telegram unavailable"); },
    serializeOrder: (order) => ({ ...order, items: savedOrder(database).items }),
    logger: { error() {}, warn(message) { warnings.push(message); } },
  });
  const response = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await handler({ body: checkoutBody() }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.total, 2310);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /order 1/);
  assert.doesNotMatch(warnings[0], /Иван|999|Героев/);
  database.close();
});

test("a T-Bank initialization failure is returned to the checkout UI", async () => {
  const database = createDatabase();
  insertProduct(database);
  const warnings = [];
  const handler = createCheckoutHandler({
    database,
    saveOrderMessage: (payload) => ({ name: payload.name, payload }),
    notifyTelegram: async () => {},
    initializePayment: async () => {
      const error = new Error("Неверные данные тестового терминала");
      error.code = "INIT_FAILED";
      throw error;
    },
    serializeOrder: (order) => ({
      id: order.id,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      paymentUrl: order.payment_url || "",
    }),
    logger: { error() {}, warn(message) { warnings.push(message); } },
  });
  const response = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await handler({ body: checkoutBody({ paymentMethod: "online" }) }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.paymentStatus, "payment_error");
  assert.equal(response.body.paymentUrl, "");
  assert.equal(response.body.paymentError, "Неверные данные тестового терминала");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /INIT_FAILED/);
  assert.doesNotMatch(warnings[0], /Неверные данные тестового терминала/);
  database.close();
});

test("legitimate checkout snapshots current database prices and exact total", () => {
  const database = createDatabase();
  insertProduct(database, { id: 1, price: 830 });
  insertProduct(database, { id: 2, name: "Ручка с защёлкой", price: 882 });
  createCheckoutRecord(database, checkoutBody({
    city: "Москва",
    items: [{ productId: 1, qty: 2 }, { productId: 2, qty: 1 }],
  }));
  const { order, items } = savedOrder(database);
  const goodsTotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const serverDelivery = 320 + (3 - 1) * 60;
  assert.equal(goodsTotal, 2542);
  assert.equal(order.total, goodsTotal + serverDelivery);
  database.close();
});

test("admin text rendering uses React escaping and has no raw HTML sink", () => {
  const attack = '<img src=x onerror="alert(1)">';
  const markup = renderToStaticMarkup(React.createElement("p", null, attack));
  assert.doesNotMatch(markup, /<img/);
  assert.match(markup, /&lt;img/);

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const appSource = fs.readFileSync(path.join(currentDir, "..", "src", "App.jsx"), "utf8");
  assert.doesNotMatch(appSource, /dangerouslySetInnerHTML|\.innerHTML\s*=/);
  assert.match(appSource, /\{m\.message\}/);
  assert.match(appSource, /\{o\.name\}/);
});
