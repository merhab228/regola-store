import "./loadEnv.js";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";
import { seedIfNeeded } from "./seed.js";
import { adminRequired, authRequired, signToken } from "./middleware/auth.js";
import { mapProduct } from "./mapProduct.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 4000);
const ADMIN_ACCESS_KEY = (process.env.ADMIN_ACCESS_KEY || "").trim() || "change-me";
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_WINDOW_MS = 15 * 60 * 1000;
const adminLoginAttempts = new Map();
const BCRYPT_DUMMY = "$2a$12$YyuILP8godldZ3CATSqf7.ZsfJwijqh98kxF.8qSNDQQXjNbl.zHu";

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
app.use(express.json({ limit: "128kb" }));

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.get("/api/categories", (_, res) => {
  const rows = db.prepare("SELECT id, name FROM categories ORDER BY id ASC").all();
  res.json(rows);
});

app.get("/api/products", (req, res) => {
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
  res.json(mapProduct(row));
});

app.get("/api/me", authRequired, (req, res) => {
  const user = db
    .prepare("SELECT id, name, email, phone, address, is_admin FROM users WHERE id = ?")
    .get(req.user.id);
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

  const user = db.prepare("SELECT * FROM users WHERE admin_login = ? AND is_admin = 1").get(loginRaw);
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
  const allowed = ["обрабатывается", "выполнен", "отменен"];
  if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, Number(req.params.id));
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(req.params.id));
  res.json(withItems(row));
});

app.post("/api/admin/products", authRequired, adminRequired, (req, res) => {
  const product = normalizeProductPayload(req.body);
  if (!product.price) return res.status(400).json({ message: "Укажите цену товара" });

  const result = db
    .prepare(`
      INSERT INTO products (name, price, category_id, description, image, stock, views, created_at, ozon_url, wb_url, ym_url, wb_price, ozon_price, ym_price)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      product.name,
      product.price,
      product.categoryId,
      product.description,
      product.image,
      product.stock,
      new Date().toISOString(),
      product.ozonUrl,
      product.wbUrl,
      product.ymUrl,
      product.wbPrice,
      product.ozonPrice,
      product.ymPrice
    );
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(result.lastInsertRowid));
  res.status(201).json(mapProduct(row));
});

app.put("/api/admin/products/:id", authRequired, adminRequired, (req, res) => {
  const product = normalizeProductPayload(req.body);
  if (!product.price) return res.status(400).json({ message: "Укажите цену товара" });

  db.prepare(`
    UPDATE products
    SET name = ?, price = ?, category_id = ?, description = ?, image = ?, stock = ?,
        ozon_url = ?, wb_url = ?, ym_url = ?,
        wb_price = ?, ozon_price = ?, ym_price = ?
    WHERE id = ?
  `).run(
    product.name,
    product.price,
    product.categoryId,
    product.description,
    product.image,
    product.stock,
    product.ozonUrl,
    product.wbUrl,
    product.ymUrl,
    product.wbPrice,
    product.ozonPrice,
    product.ymPrice,
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
});

function normalizeProductPayload(body) {
  const wbPrice = normalizePrice(body.wbPrice);
  const ozonPrice = normalizePrice(body.ozonPrice);
  const ymPrice = normalizePrice(body.ymPrice);
  const mainPrice = normalizePrice(body.price);
  return {
    name: String(body.name || "").trim(),
    price: mainPrice || wbPrice || ozonPrice || ymPrice,
    categoryId: Number(body.categoryId) || 1,
    description: String(body.description || "").trim(),
    image: String(body.image || "").trim(),
    stock: Math.max(0, Number(body.stock) || 0),
    wbUrl: normalizeUrl(body.wbUrl),
    ozonUrl: normalizeUrl(body.ozonUrl),
    ymUrl: normalizeUrl(body.ymUrl),
    wbPrice,
    ozonPrice,
    ymPrice,
  };
}

function normalizePrice(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
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

function adminBumpAttempt(ip, attempt) {
  attempt.count += 1;
  adminLoginAttempts.set(ip, attempt);
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
  db.prepare("UPDATE users SET admin_login = ?, password_hash = ?, email = ? WHERE id = ? AND is_admin = 1").run(
    login,
    hash,
    email,
    admin.id
  );
  console.warn("[Regola] Администратор обновлён из .env.");
}
