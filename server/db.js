import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configuredDbPath = process.env.DB_PATH;
const dbPath =
  configuredDbPath && !(process.env.NODE_ENV !== "production" && configuredDbPath.startsWith("/app/"))
    ? configuredDbPath
    : path.join(__dirname, "regola.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  ozon_url TEXT,
  wb_url TEXT,
  ym_url TEXT,
  video_url TEXT,
  images_json TEXT,
  specifications TEXT,
  package_contents TEXT,
  colors_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
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
  cancel_token_hash TEXT,
  cancelled_at TEXT,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  price INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS site_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  message TEXT NOT NULL,
  admin_note TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL
);
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((c) => c.name === "admin_login")) {
  db.exec("ALTER TABLE users ADD COLUMN admin_login TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_admin_login ON users(admin_login) WHERE admin_login IS NOT NULL");
}

const productColumns = db.prepare("PRAGMA table_info(products)").all();
const productColNames = new Set(productColumns.map((c) => c.name));
for (const [column, type] of [
  ["ym_url", "TEXT"],
  ["video_url", "TEXT"],
  ["images_json", "TEXT"],
  ["specifications", "TEXT"],
  ["package_contents", "TEXT"],
  ["colors_json", "TEXT"],
  ["is_active", "INTEGER NOT NULL DEFAULT 1"],
]) {
  if (!productColNames.has(column)) db.exec(`ALTER TABLE products ADD COLUMN ${column} ${type}`);
}

const messageColumns = db.prepare("PRAGMA table_info(site_messages)").all();
const messageColNames = new Set(messageColumns.map((c) => c.name));
for (const [column, type] of [
  ["status", "TEXT NOT NULL DEFAULT 'new'"],
  ["admin_note", "TEXT"],
]) {
  if (!messageColNames.has(column)) db.exec(`ALTER TABLE site_messages ADD COLUMN ${column} ${type}`);
}

const orderColumns = db.prepare("PRAGMA table_info(orders)").all();
const orderColNames = new Set(orderColumns.map((c) => c.name));
for (const [column, type] of [
  ["email", "TEXT"],
  ["city", "TEXT"],
  ["comment", "TEXT"],
  ["delivery_method", "TEXT"],
  ["delivery_price", "INTEGER NOT NULL DEFAULT 0"],
  ["goods_total", "INTEGER NOT NULL DEFAULT 0"],
  ["payment_method", "TEXT"],
  ["payment_status", "TEXT NOT NULL DEFAULT 'pending'"],
  ["payment_provider", "TEXT"],
  ["payment_id", "TEXT"],
  ["payment_url", "TEXT"],
  ["payment_amount_kopecks", "INTEGER"],
  ["cdek_status", "TEXT"],
  ["cdek_uuid", "TEXT"],
  ["cdek_number", "TEXT"],
  ["cdek_tariff_code", "INTEGER"],
  ["cdek_city_code", "INTEGER"],
  ["cdek_delivery_point", "TEXT"],
  ["cancel_token_hash", "TEXT"],
  ["cancelled_at", "TEXT"],
]) {
  if (!orderColNames.has(column)) db.exec(`ALTER TABLE orders ADD COLUMN ${column} ${type}`);
}

export default db;
