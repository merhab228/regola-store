import "./loadEnv.js";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import db from "./db.js";
import { seedIfNeeded } from "./seed.js";
import { adminRequired, authRequired, signToken } from "./middleware/auth.js";
import { mapProduct } from "./mapProduct.js";
import { startWbPriceScheduler, syncAllWbProducts, syncProductById, validateWbUrl } from "./priceSync.js";

const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

const PORT = Number(process.env.PORT || 4000);
const ADMIN_ACCESS_KEY = (process.env.ADMIN_ACCESS_KEY || "").trim() || "change-me";
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_WINDOW_MS = 15 * 60 * 1000;
const adminLoginAttempts = new Map();

/** Сравнение секретов фиксированной длины (SHA-256), без утечки длины строки */
function constantTimeSecretEqual(a, b) {
  const ah = crypto.createHash("sha256").update(String(a), "utf8").digest();
  const bh = crypto.createHash("sha256").update(String(b), "utf8").digest();
  return crypto.timingSafeEqual(ah, bh);
}

/** Валидный bcrypt-хеш для фиктивного сравнения при неверном пользователе */
const BCRYPT_DUMMY =
  "$2a$12$YyuILP8godldZ3CATSqf7.ZsfJwijqh98kxF.8qSNDQQXjNbl.zHu";

try {
  seedIfNeeded();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error("[Regola] Ошибка инициализации БД:", err.message);
  process.exit(1);
}
migrateLegacyAdminAccount();

if (ADMIN_ACCESS_KEY === "change-me" && process.env.NODE_ENV === "production") {
  // eslint-disable-next-line no-console
  console.warn("[Regola] Задайте ADMIN_ACCESS_KEY в .env для production.");
}

app.use(cors());
app.use(express.json({ limit: "128kb" }));

let lastWbBulkSyncAt = 0;
function maybeScheduleWbSync() {
  const gap = Number(process.env.WB_SYNC_ON_READ_MS || 3 * 60 * 1000);
  if (Date.now() - lastWbBulkSyncAt < gap) return;
  lastWbBulkSyncAt = Date.now();
  syncAllWbProducts().catch(() => {});
}

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.get("/api/categories", (_, res) => {
  const rows = db.prepare("SELECT id, name FROM categories ORDER BY id ASC").all();
  res.json(rows);
});

app.get("/api/products", (req, res) => {
  maybeScheduleWbSync();
  const { search = "", categoryId = "", sort = "new" } = req.query;
  let sql = "SELECT * FROM products WHERE 1=1";
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
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(req.params.id));
  if (!row) return res.status(404).json({ message: "Not found" });
  if (row.wb_url?.trim()) {
    syncProductById(row.id).catch(() => {});
  }
  const fresh = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(req.params.id));
  return res.json(mapProduct(fresh));
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, phone, address, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Missing fields" });
  if (String(email).toLowerCase().endsWith("@regola.invalid")) {
    return res.status(400).json({ message: "Invalid email" });
  }
  if (String(password).length < 6 || String(password).length > 128) {
    return res.status(400).json({ message: "Invalid password length" });
  }

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) return res.status(400).json({ message: "Email already exists" });

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      "INSERT INTO users (name, email, phone, address, password_hash, is_admin, admin_login) VALUES (?, ?, ?, ?, ?, 0, NULL)"
    )
    .run(name, email, phone || "", address || "", hash);

  const user = db
    .prepare("SELECT id, name, email, phone, address, is_admin FROM users WHERE id = ?")
    .get(result.lastInsertRowid);
  const token = signToken(user);
  return res.status(201).json({ token, user: mapUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });
  const token = signToken(user);
  return res.json({ token, user: mapUser(user) });
});

app.get("/api/me", authRequired, (req, res) => {
  const user = db
    .prepare("SELECT id, name, email, phone, address, is_admin FROM users WHERE id = ?")
    .get(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json(mapUser(user));
});

app.patch("/api/me", authRequired, (req, res) => {
  const { name, phone, address } = req.body;
  db.prepare("UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?").run(
    name || "",
    phone || "",
    address || "",
    req.user.id
  );
  const user = db
    .prepare("SELECT id, name, email, phone, address, is_admin FROM users WHERE id = ?")
    .get(req.user.id);
  res.json(mapUser(user));
});

app.get("/api/orders/my", authRequired, (req, res) => {
  const rows = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json(rows.map(withItems));
});

app.post("/api/orders", authRequired, (req, res) => {
  const { name, phone, address, delivery, payment, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "Empty cart" });

  const productsStmt = db.prepare("SELECT id, name, price FROM products WHERE id = ?");
  let total = 0;
  const normalizedItems = [];
  for (const item of items) {
    const product = productsStmt.get(Number(item.productId));
    if (!product) return res.status(400).json({ message: "Invalid product in cart" });
    const qty = Math.max(1, Number(item.qty || 1));
    total += product.price * qty;
    normalizedItems.push({ productId: product.id, name: product.name, price: product.price, qty });
  }

  const createdAt = new Date().toISOString();
  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, status, name, phone, address, delivery, payment, total, created_at)
    VALUES (?, 'обрабатывается', ?, ?, ?, ?, ?, ?, ?)
  `);
  const orderResult = insertOrder.run(req.user.id, name, phone, address, delivery, payment, total, createdAt);
  const orderId = Number(orderResult.lastInsertRowid);

  const insertItem = db.prepare(
    "INSERT INTO order_items (order_id, product_id, name, qty, price) VALUES (?, ?, ?, ?, ?)"
  );
  const transaction = db.transaction((rows) => {
    rows.forEach((row) => insertItem.run(orderId, row.productId, row.name, row.qty, row.price));
  });
  transaction(normalizedItems);

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  res.status(201).json(withItems(order));
});

function adminClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    return xf.split(",")[0].trim().slice(0, 64) || "unknown";
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

function adminBumpAttempt(ip, attempt) {
  attempt.count += 1;
  adminLoginAttempts.set(ip, attempt);
}

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

  if (pwd.length > 256) {
    bcrypt.compareSync(pwd.slice(0, 72), BCRYPT_DUMMY);
    return fail();
  }

  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(loginRaw)) {
    bcrypt.compareSync(pwd.slice(0, 72), BCRYPT_DUMMY);
    return fail();
  }

  const user = db.prepare("SELECT * FROM users WHERE admin_login = ? AND is_admin = 1").get(loginRaw);
  const hash = user?.password_hash ?? BCRYPT_DUMMY;
  const ok = bcrypt.compareSync(pwd, hash);
  if (!user || !ok) {
    return fail();
  }

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
  const allowed = ["обрабатывается", "выполнен", "отменен"];
  if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, Number(req.params.id));
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(req.params.id));
  res.json(withItems(row));
});

app.post("/api/admin/products", authRequired, adminRequired, async (req, res) => {
  const { name, price, categoryId, description, image, stock, ozonUrl, wbUrl } = req.body;
  const wb = validateWbUrl(wbUrl || "");
  if (!wb.ok) return res.status(400).json({ message: wb.message });
  if (!wb.url && (!Number(price) || Number(price) <= 0)) {
    return res.status(400).json({ message: "Укажите цену или ссылку Wildberries для автоматической цены" });
  }

  const result = db
    .prepare(`
    INSERT INTO products (name, price, category_id, description, image, stock, views, created_at, ozon_url, wb_url, wb_nm_id)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `)
    .run(
      name,
      price,
      categoryId,
      description,
      image,
      stock,
      new Date().toISOString(),
      ozonUrl || "",
      wb.url,
      wb.nmId
    );
  const id = Number(result.lastInsertRowid);
  if (wb.url) await syncProductById(id, { force: true });
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  res.status(201).json(mapProduct(row));
});

app.put("/api/admin/products/:id", authRequired, adminRequired, async (req, res) => {
  const { name, price, categoryId, description, image, stock, ozonUrl, wbUrl } = req.body;
  const wb = validateWbUrl(wbUrl || "");
  if (!wb.ok) return res.status(400).json({ message: wb.message });

  const id = Number(req.params.id);
  const existing = db.prepare("SELECT wb_url FROM products WHERE id = ?").get(id);
  const wbChanged = (existing?.wb_url || "").trim() !== wb.url;

  db.prepare(`
    UPDATE products
    SET name = ?, price = ?, category_id = ?, description = ?, image = ?, stock = ?,
        ozon_url = ?, wb_url = ?, wb_nm_id = ?,
        wb_sync_error = CASE WHEN ? THEN NULL ELSE wb_sync_error END
    WHERE id = ?
  `).run(
    name,
    price,
    categoryId,
    description,
    image,
    stock,
    ozonUrl || "",
    wb.url,
    wb.nmId,
    wbChanged ? 1 : 0,
    id
  );

  if (wb.url) await syncProductById(id, { force: wbChanged });
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  res.json(mapProduct(row));
});

app.post("/api/admin/products/:id/sync-wb", authRequired, adminRequired, async (req, res) => {
  const result = await syncProductById(Number(req.params.id), { force: true });
  if (!result.ok) {
    return res.status(400).json({ message: result.error || "Не удалось синхронизировать цену" });
  }
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(req.params.id));
  return res.json(mapProduct(row));
});

app.delete("/api/admin/products/:id", authRequired, adminRequired, (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(Number(req.params.id));
  res.status(204).send();
});

app.listen(PORT, () => {
  startWbPriceScheduler();
  // eslint-disable-next-line no-console
  console.log(`Regola API running on http://localhost:${PORT}`);
});

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
  const items = db
    .prepare("SELECT product_id as productId, name, qty, price FROM order_items WHERE order_id = ?")
    .all(order.id);
  return {
    id: order.id,
    userId: order.user_id,
    status: order.status,
    name: order.name,
    phone: order.phone,
    address: order.address,
    delivery: order.delivery,
    payment: order.payment,
    total: order.total,
    createdAt: order.created_at,
    items,
  };
}

function migrateLegacyAdminAccount() {
  const admin = db
    .prepare("SELECT id, admin_login FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1")
    .get();
  if (!admin || admin.admin_login) return;

  const login = process.env.ADMIN_LOGIN?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!login || !password) {
    // eslint-disable-next-line no-console
    console.warn(
      "[Regola] У администратора не задан отдельный логин (admin_login). Укажите ADMIN_LOGIN и ADMIN_PASSWORD в .env и перезапустите сервер."
    );
    return;
  }
  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(login)) {
    // eslint-disable-next-line no-console
    console.warn("[Regola] ADMIN_LOGIN: только буквы, цифры, _ и -, длина 3–128.");
    return;
  }
  if (password.length < 12) {
    // eslint-disable-next-line no-console
    console.warn("[Regola] ADMIN_PASSWORD должен быть не короче 12 символов.");
    return;
  }
  const taken = db.prepare("SELECT id FROM users WHERE admin_login = ? AND id != ?").get(login, admin.id);
  if (taken) {
    // eslint-disable-next-line no-console
    console.warn("[Regola] ADMIN_LOGIN уже занят другим пользователем.");
    return;
  }
  const hash = bcrypt.hashSync(password, 12);
  const email = `admin-${login}@regola.invalid`;
  db.prepare("UPDATE users SET admin_login = ?, password_hash = ?, email = ? WHERE id = ? AND is_admin = 1").run(
    login,
    hash,
    email,
    admin.id
  );
  // eslint-disable-next-line no-console
  console.warn("[Regola] Администратор переведён на вход по логину и паролю из .env.");
}
