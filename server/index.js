import "./loadEnv.js";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";
import { seedIfNeeded } from "./seed.js";
import { adminRequired, authRequired, signToken } from "./middleware/auth.js";
import { mapProduct } from "./mapProduct.js";
import { CheckoutValidationError, createCheckoutHandler, estimateDelivery, prepareDeliveryQuote } from "./checkout.js";
import { createTbankClient, processTbankNotification } from "./tbank.js";
import { createCdekClient } from "./cdek.js";
import { createDadataClient, DadataError } from "./dadata.js";
import { createTelegramBot } from "./telegramBot.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const uploadDir = process.env.UPLOAD_DIR || (process.env.NODE_ENV === "production" ? "/app/data/uploads" : path.join(__dirname, "uploads"));
fs.mkdirSync(uploadDir, { recursive: true });
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 4000);
const ADMIN_ACCESS_KEY = (process.env.ADMIN_ACCESS_KEY || "").trim() || "change-me";
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_WINDOW_MS = 15 * 60 * 1000;
const adminLoginAttempts = new Map();
const BCRYPT_DUMMY = "$2a$12$YyuILP8godldZ3CATSqf7.ZsfJwijqh98kxF.8qSNDQQXjNbl.zHu";
const tbankClient = createTbankClient();
const cdekClient = createCdekClient();
const dadataClient = createDadataClient();
const telegramBot = createTelegramBot({ database: db });
const addressSuggestLimits = new Map();

try {
  seedIfNeeded();
} catch (err) {
  console.error("[Regola] Ошибка инициализации БД:", err.message);
  process.exit(1);
}
migrateLegacyAdminAccount();

if (ADMIN_ACCESS_KEY === "change-me" && process.env.NODE_ENV === "production") {
  console.warn("[Regola] Задайте ADMIN_ACCESS_KEY в .env для production.");
}

app.use(cors());
app.use(express.json({ limit: "35mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use("/uploads", express.static(uploadDir, { maxAge: "365d", immutable: true }));

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.get("/api/commerce/config", (_, res) => {
  res.json({
    tbankEnabled: tbankClient.isConfigured,
    tbankMode: tbankClient.config.mode,
    tbankLive: tbankClient.config.live,
    cdekApiEnabled: cdekClient.isConfigured,
    cdekMode: cdekClient.config.mode,
    cdekOrderCreationEnabled: cdekClient.canCreateOrders,
    addressSuggestionsEnabled: dadataClient.isConfigured,
  });
});

app.post("/api/address/suggest", async (req, res) => {
  if (!dadataClient.isConfigured) return res.status(503).json({ message: "Подсказки адресов ещё не настроены" });
  if (!allowAddressSuggestion(req)) return res.status(429).json({ message: "Слишком много запросов. Подождите минуту." });
  try {
    const suggestions = await dadataClient.suggest({
      kind: req.body?.kind,
      query: req.body?.query,
      cityFiasId: req.body?.cityFiasId,
    });
    return res.json(suggestions);
  } catch (error) {
    const status = error instanceof DadataError && ["INVALID_KIND", "CITY_REQUIRED"].includes(error.code) ? 400 : 502;
    return res.status(status).json({ message: error.message || "Не удалось получить подсказки" });
  }
});

app.get("/api/categories", (_, res) => {
  const rows = db.prepare("SELECT id, name FROM categories ORDER BY id ASC").all();
  res.json(rows);
});

app.get("/api/products", (req, res) => {
  const { search = "", categoryId = "", sort = "new" } = req.query;
  let sql = "SELECT * FROM products WHERE is_active = 1";
  const params = [];

  if (search) {
    sql += " AND LOWER(name) LIKE ?";
    params.push(`%${String(search).slice(0, 200).toLowerCase()}%`);
  }
  if (categoryId) {
    sql += " AND category_id = ?";
    params.push(Number(categoryId));
  }

  const sortMap = {
    new: "created_at DESC",
    popular: "views DESC",
    price_asc: "price ASC",
    price_desc: "price DESC",
  };
  sql += ` ORDER BY ${sortMap[sort] || sortMap.new}`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(mapProduct));
});

app.get("/api/products/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").get(Number(req.params.id));
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(mapProduct(row));
});

app.post("/api/contact", async (req, res) => {
  try {
    const message = saveSiteMessage("question", req.body);
    await notifyTelegram("Новый вопрос с сайта", message);
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message || "Request failed" });
  }
});

app.post("/api/cdek/estimate", async (req, res) => {
  try {
    const quote = prepareDeliveryQuote(db, req.body);
    const estimate = cdekClient.isConfigured && quote.deliveryMethod.startsWith("СДЭК")
      ? await cdekClient.estimate({
        city: quote.city,
        cityCode: quote.cityCode,
        deliveryMethod: quote.deliveryMethod,
        totalQty: quote.cart.totalQty,
      })
      : estimateDelivery({
        city: quote.city,
        totalQty: quote.cart.totalQty,
        goodsTotal: quote.cart.goodsTotal,
        deliveryMethod: quote.deliveryMethod,
      });
    res.json(estimate);
  } catch (error) {
    if (error instanceof CheckoutValidationError) return res.status(400).json({ message: error.message });
    console.error("[Regola] Delivery estimate failed");
    return res.status(500).json({ message: "Не удалось рассчитать доставку" });
  }
});

app.get("/api/cdek/delivery-points", async (req, res) => {
  try {
    if (!cdekClient.isConfigured) return res.json([]);
    const points = await cdekClient.deliveryPoints({ city: req.query.city, cityCode: req.query.cityCode });
    res.json(points);
  } catch (error) {
    res.status(502).json({ message: error.message || "Не удалось загрузить ПВЗ СДЭК" });
  }
});

app.post("/api/checkout", createCheckoutHandler({
  database: db,
  saveOrderMessage: (payload) => saveSiteMessage("order", payload),
  notifyTelegram,
  serializeOrder: withItems,
  resolveDelivery: async ({ customer, cart }) => (
    cdekClient.isConfigured && customer.deliveryMethod.startsWith("СДЭК")
      ? cdekClient.estimate({
        city: customer.city,
        cityCode: customer.cdekCityCode,
        deliveryMethod: customer.deliveryMethod,
        totalQty: cart.totalQty,
      })
      : estimateDelivery({
        city: customer.city,
        totalQty: cart.totalQty,
        goodsTotal: cart.goodsTotal,
        deliveryMethod: customer.deliveryMethod,
      })
  ),
  initializePayment: ({ order, items }) => tbankClient.initPayment({ order, items }),
  validateLocation: dadataClient.isConfigured
    ? (customer) => {
      if (!customer.cityFiasId) throw new CheckoutValidationError("Выберите город из списка подсказок");
      if (customer.deliveryMethod !== "СДЭК до ПВЗ" && !customer.addressFiasId) {
        throw new CheckoutValidationError("Выберите полный адрес с домом из списка подсказок");
      }
    }
    : undefined,
}));

app.post("/api/payments/tbank/notification", (req, res) => {
  const result = processTbankNotification({ database: db, client: tbankClient, payload: req.body });
  return res.status(result.statusCode).type("text/plain").send(result.body);
});

app.get("/api/me", authRequired, (req, res) => {
  const user = db.prepare("SELECT id, name, email, phone, address, is_admin FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json(mapUser(user));
});

app.post("/api/admin/login", (req, res) => {
  const loginRaw = typeof req.body.login === "string" ? req.body.login.trim() : "";
  const pwd = typeof req.body.password === "string" ? req.body.password : "";
  const accessKey = typeof req.body.accessKey === "string" ? req.body.accessKey.trim() : "";

  const ip = adminClientIp(req);
  const attempt = adminLoginAttempts.get(ip) || { count: 0, firstAt: Date.now() };
  if (Date.now() - attempt.firstAt > ADMIN_WINDOW_MS) {
    attempt.count = 0;
    attempt.firstAt = Date.now();
  }
  if (attempt.count >= ADMIN_MAX_ATTEMPTS) {
    return res.status(429).json({ message: "Too many attempts. Try again later." });
  }

  const fail = () => {
    adminBumpAttempt(ip, attempt);
    return res.status(401).json({ message: "Invalid admin credentials" });
  };

  if (!constantTimeSecretEqual(accessKey, ADMIN_ACCESS_KEY)) {
    bcrypt.compareSync(pwd.slice(0, 72), BCRYPT_DUMMY);
    return fail();
  }
  if (pwd.length > 256 || !/^[a-zA-Z0-9_-]{3,128}$/.test(loginRaw)) {
    bcrypt.compareSync(pwd.slice(0, 72), BCRYPT_DUMMY);
    return fail();
  }

  let user = db.prepare("SELECT * FROM users WHERE admin_login = ? AND is_admin = 1").get(loginRaw);
  const envLogin = process.env.ADMIN_LOGIN?.trim();
  const envPassword = process.env.ADMIN_PASSWORD?.trim();
  if (envLogin && envPassword && loginRaw === envLogin && pwd === envPassword) {
    user = ensureEnvAdminUser(envLogin, envPassword);
  }
  const hash = user?.password_hash ?? BCRYPT_DUMMY;
  const ok = bcrypt.compareSync(pwd, hash);
  if (!user || !ok) return fail();

  adminLoginAttempts.delete(ip);
  const token = signToken(user);
  res.json({ token, user: mapUser(user) });
});

app.get("/api/admin/orders", authRequired, adminRequired, (_, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  res.json(rows.map(withItems));
});

app.patch("/api/admin/orders/:id/status", authRequired, adminRequired, (req, res) => {
  const { status } = req.body;
  const allowed = ["обрабатывается", "выполнен", "отменён", "отменен"];
  if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, Number(req.params.id));
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(req.params.id));
  res.json(withItems(row));
});

app.post("/api/admin/orders/:id/cdek", authRequired, adminRequired, async (req, res) => {
  const orderId = Number(req.params.id);
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!row) return res.status(404).json({ message: "Заказ не найден" });
  if (row.cdek_uuid) return res.json(withItems(row));
  if (!String(row.delivery_method || "").startsWith("СДЭК")) {
    return res.status(400).json({ message: "Для заказа не выбрана доставка СДЭК" });
  }
  if (row.payment_method === "online" && row.payment_status !== "paid") {
    return res.status(409).json({ message: "Сначала дождитесь подтверждения оплаты T-Банка" });
  }
  try {
    const order = withItems(row);
    const shipment = await cdekClient.createOrder({ order, items: order.items });
    db.prepare(`
      UPDATE orders SET cdek_status = ?, cdek_uuid = ?, cdek_number = ?, cdek_tariff_code = ? WHERE id = ?
    `).run(shipment.status, shipment.uuid, shipment.cdekNumber, shipment.tariffCode, orderId);
    return res.json(withItems(db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId)));
  } catch (error) {
    console.warn(`[Regola] CDEK order creation failed for order ${orderId}`);
    return res.status(502).json({ message: error.message || "СДЭК не принял отправление" });
  }
});

app.post("/api/admin/orders/:id/cdek/refresh", authRequired, adminRequired, async (req, res) => {
  const orderId = Number(req.params.id);
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!row) return res.status(404).json({ message: "Заказ не найден" });
  if (!row.cdek_uuid) return res.status(400).json({ message: "Отправление СДЭК ещё не создано" });
  try {
    const shipment = await cdekClient.orderStatus(row.cdek_uuid);
    const codCollected = row.payment_method === "cod" && shipment.status === "delivered";
    db.prepare(`
      UPDATE orders
      SET cdek_status = ?, cdek_number = COALESCE(NULLIF(?, ''), cdek_number),
          payment_status = CASE WHEN ? THEN 'cod_collected' ELSE payment_status END
      WHERE id = ?
    `).run(shipment.status, shipment.cdekNumber, codCollected ? 1 : 0, orderId);
    return res.json(withItems(db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId)));
  } catch (error) {
    console.warn(`[Regola] CDEK status refresh failed for order ${orderId}`);
    return res.status(502).json({ message: error.message || "Не удалось обновить статус СДЭК" });
  }
});

app.get("/api/admin/messages", authRequired, adminRequired, (_, res) => {
  const rows = db.prepare("SELECT * FROM site_messages ORDER BY created_at DESC").all();
  res.json(rows.map(mapSiteMessage));
});

app.patch("/api/admin/messages/:id", authRequired, adminRequired, (req, res) => {
  const status = String(req.body.status || "").trim();
  const adminNote = String(req.body.adminNote ?? req.body.admin_note ?? "").trim();
  const allowed = ["new", "in_work", "done", "spam"];
  if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });
  db.prepare("UPDATE site_messages SET status = ?, admin_note = ? WHERE id = ?").run(status, adminNote, Number(req.params.id));
  const row = db.prepare("SELECT * FROM site_messages WHERE id = ?").get(Number(req.params.id));
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(mapSiteMessage(row));
});

app.post(
  "/api/admin/uploads",
  authRequired,
  adminRequired,
  express.raw({ type: ["image/*", "video/*"], limit: "30mb" }),
  (req, res) => {
    const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/ogg": "ogg",
      "video/quicktime": "mov",
    };
    const extension = extensions[contentType];
    if (!extension || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: "Поддерживаются JPG, PNG, WebP, GIF, MP4, WebM, OGG и MOV" });
    }
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${extension}`;
    fs.writeFileSync(path.join(uploadDir, filename), req.body, { flag: "wx" });
    return res.status(201).json({ url: `/uploads/${filename}`, size: req.body.length, contentType });
  }
);

app.post("/api/admin/products", authRequired, adminRequired, (req, res) => {
  const product = normalizeProductPayload(req.body);
  if (!product.price) return res.status(400).json({ message: "Укажите цену товара" });
  if (!product.image) return res.status(400).json({ message: "Добавьте хотя бы одно фото товара" });

  const result = db.prepare(`
    INSERT INTO products (
      name, price, category_id, description, specifications, package_contents, colors_json,
      image, images_json, stock, views, created_at, ozon_url, wb_url, ym_url, video_url
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)
  `).run(
    product.name,
    product.price,
    product.categoryId,
    product.description,
    product.specifications,
    product.packageContents,
    product.colorsJson,
    product.image,
    product.imagesJson,
    new Date().toISOString(),
    product.ozonUrl,
    product.wbUrl,
    product.ymUrl,
    product.videoUrl
  );
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(result.lastInsertRowid));
  res.status(201).json(mapProduct(row));
});

app.put("/api/admin/products/:id", authRequired, adminRequired, (req, res) => {
  const product = normalizeProductPayload(req.body);
  if (!product.price) return res.status(400).json({ message: "Укажите цену товара" });
  if (!product.image) return res.status(400).json({ message: "Добавьте хотя бы одно фото товара" });

  db.prepare(`
    UPDATE products
    SET name = ?, price = ?, category_id = ?, description = ?, specifications = ?, package_contents = ?, colors_json = ?,
        image = ?, images_json = ?, stock = 0,
        ozon_url = ?, wb_url = ?, ym_url = ?, video_url = ?
    WHERE id = ?
  `).run(
    product.name,
    product.price,
    product.categoryId,
    product.description,
    product.specifications,
    product.packageContents,
    product.colorsJson,
    product.image,
    product.imagesJson,
    product.ozonUrl,
    product.wbUrl,
    product.ymUrl,
    product.videoUrl,
    Number(req.params.id)
  );
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(req.params.id));
  res.json(mapProduct(row));
});

app.delete("/api/admin/products/:id", authRequired, adminRequired, (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(Number(req.params.id));
  res.status(204).send();
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    return res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Regola API running on http://localhost:${PORT}`);
  if (telegramBot.enabled) {
    telegramBot.start();
    console.log("[Regola] Telegram bot control panel enabled.");
  }
});

function normalizeProductPayload(body) {
  const images = normalizeImages(body.images, body.image);
  return {
    name: String(body.name || "").trim(),
    price: normalizePrice(body.price),
    categoryId: Number(body.categoryId) || 1,
    description: String(body.description || "").trim(),
    specifications: String(body.specifications || "").trim().slice(0, 5000),
    packageContents: String(body.packageContents ?? body.package_contents ?? "").trim().slice(0, 5000),
    colorsJson: JSON.stringify(normalizeStringList(body.colors, 20)),
    image: images[0] || "",
    imagesJson: JSON.stringify(images),
    wbUrl: normalizeUrl(body.wbUrl),
    ozonUrl: normalizeUrl(body.ozonUrl),
    ymUrl: normalizeUrl(body.ymUrl),
    videoUrl: normalizeUrl(body.videoUrl),
  };
}

function normalizeStringList(value, limit) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[\n,;]+/);
  return [...new Set(source.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, limit);
}

function normalizeImages(images, image) {
  const list = [];
  if (Array.isArray(images)) list.push(...images);
  if (typeof image === "string") list.push(image);
  return [...new Set(list.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 12);
}

function normalizePrice(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function normalizeUrl(value) {
  return typeof value === "string" ? value.trim() : "";
}

function constantTimeSecretEqual(a, b) {
  const ah = crypto.createHash("sha256").update(String(a), "utf8").digest();
  const bh = crypto.createHash("sha256").update(String(b), "utf8").digest();
  return crypto.timingSafeEqual(ah, bh);
}

function adminClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) return xf.split(",")[0].trim().slice(0, 64) || "unknown";
  return req.ip || req.socket.remoteAddress || "unknown";
}

function allowAddressSuggestion(req) {
  const ip = adminClientIp(req);
  const now = Date.now();
  const current = addressSuggestLimits.get(ip);
  if (!current || now - current.startedAt >= 60_000) {
    addressSuggestLimits.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  if (addressSuggestLimits.size > 5_000) {
    for (const [key, value] of addressSuggestLimits) {
      if (now - value.startedAt >= 60_000) addressSuggestLimits.delete(key);
    }
  }
  return current.count <= 90;
}

function adminBumpAttempt(ip, attempt) {
  attempt.count += 1;
  adminLoginAttempts.set(ip, attempt);
}

function saveSiteMessage(type, body = {}) {
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  const message = String(body.message || "").trim();
  if (!name) throw new Error("Укажите имя");
  if (!message && type !== "order") throw new Error("Напишите сообщение");
  const payloadJson = JSON.stringify(body);
  const createdAt = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO site_messages (type, status, name, phone, email, message, payload_json, created_at)
    VALUES (?, 'new', ?, ?, ?, ?, ?, ?)
  `).run(type, name, phone, email, message || "Заявка с сайта", payloadJson, createdAt);
  return { id: Number(result.lastInsertRowid), type, status: "new", name, phone, email, message: message || "Заявка с сайта", payload: body, createdAt };
}

async function notifyTelegram(title, data) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId || typeof fetch !== "function") return;
  const lines = [
    title,
    `Имя: ${data.name}`,
    data.phone ? `Телефон: ${data.phone}` : "",
    data.email ? `Email: ${data.email}` : "",
    data.message ? `Сообщение: ${data.message}` : "",
  ].filter(Boolean);
  if (Array.isArray(data.payload?.items)) {
    lines.push("Товары:");
    for (const item of data.payload.items.slice(0, 20)) {
      lines.push(`- ${item.name} × ${item.qty} — ${item.price} ₽`);
    }
    lines.push(`Итого: ${data.payload.total || 0} ₽`);
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: lines.join("\n") }),
    });
  } catch (error) {
    console.warn("[Regola] Telegram notification failed:", error.message);
  }
}

function mapUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    isAdmin: !!user.is_admin,
  };
}

function withItems(order) {
  const items = db.prepare("SELECT product_id as productId, name, qty, price FROM order_items WHERE order_id = ?").all(order.id);
  return {
    id: order.id,
    userId: order.user_id,
    status: order.status,
    name: order.name,
    phone: order.phone,
    email: order.email || "",
    city: order.city || "",
    address: order.address,
    comment: order.comment || "",
    delivery: order.delivery,
    deliveryMethod: order.delivery_method || "",
    deliveryPrice: order.delivery_price || 0,
    goodsTotal: order.goods_total || 0,
    payment: order.payment,
    paymentMethod: order.payment_method || "",
    paymentStatus: order.payment_status || "pending",
    paymentProvider: order.payment_provider || "",
    paymentId: order.payment_id || "",
    paymentUrl: order.payment_url || "",
    paymentAmountKopecks: order.payment_amount_kopecks || 0,
    cdekStatus: order.cdek_status || "",
    cdekUuid: order.cdek_uuid || "",
    cdekNumber: order.cdek_number || "",
    cdekTariffCode: order.cdek_tariff_code || null,
    cdekCityCode: order.cdek_city_code || null,
    cdekDeliveryPoint: order.cdek_delivery_point || "",
    total: order.total,
    createdAt: order.created_at,
    items,
  };
}

function mapSiteMessage(row) {
  let payload = {};
  try {
    payload = row.payload_json ? JSON.parse(row.payload_json) : {};
  } catch {
    payload = {};
  }
  return {
    id: row.id,
    type: row.type,
    status: row.status || "new",
    name: row.name,
    phone: row.phone || "",
    email: row.email || "",
    message: row.message,
    adminNote: row.admin_note || "",
    admin_note: row.admin_note || "",
    payload,
    createdAt: row.created_at,
    created_at: row.created_at,
  };
}

function ensureEnvAdminUser(login, password) {
  const existingAdmin = db.prepare("SELECT * FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1").get();
  const hash = bcrypt.hashSync(password, 12);
  const email = `admin-${login}@regola.invalid`;
  if (existingAdmin) {
    db.prepare(`
      UPDATE users
      SET admin_login = ?, password_hash = ?, email = ?, name = COALESCE(NULLIF(name, ''), 'Admin Regola')
      WHERE id = ?
    `).run(login, hash, email, existingAdmin.id);
    return db.prepare("SELECT * FROM users WHERE id = ?").get(existingAdmin.id);
  }
  const result = db.prepare(`
    INSERT INTO users (name, email, phone, address, password_hash, is_admin, admin_login)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run("Admin Regola", email, "+79829412000", "Санкт-Петербург, проспект Героев, 26, к. 1", hash, login);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(Number(result.lastInsertRowid));
}

function migrateLegacyAdminAccount() {
  const admin = db.prepare("SELECT id, admin_login FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1").get();
  if (!admin) return;

  const login = process.env.ADMIN_LOGIN?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!login || !password) {
    console.warn("[Regola] Укажите ADMIN_LOGIN и ADMIN_PASSWORD в .env и перезапустите сервер.");
    return;
  }
  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(login)) {
    console.warn("[Regola] ADMIN_LOGIN: только буквы, цифры, _ и -, длина 3-128.");
    return;
  }
  if (password.length < 12) {
    console.warn("[Regola] ADMIN_PASSWORD должен быть не короче 12 символов.");
    return;
  }
  const taken = db.prepare("SELECT id FROM users WHERE admin_login = ? AND id != ?").get(login, admin.id);
  if (taken) {
    console.warn("[Regola] ADMIN_LOGIN уже занят другим пользователем.");
    return;
  }
  const hash = bcrypt.hashSync(password, 12);
  const email = `admin-${login}@regola.invalid`;
  db.prepare("UPDATE users SET admin_login = ?, password_hash = ?, email = ? WHERE id = ? AND is_admin = 1").run(login, hash, email, admin.id);
  console.warn("[Regola] Администратор обновлён из .env.");
}
