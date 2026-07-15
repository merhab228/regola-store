import crypto from "crypto";
import bcrypt from "bcryptjs";
import db from "./db.js";

function generateAdminCredentials() {
  const login = `rg_adm_${crypto.randomBytes(10).toString("hex")}`;
  const password = crypto.randomBytes(22).toString("base64url");
  return { login, password };
}

export function seedIfNeeded() {
  const usersCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  if (usersCount > 0) return;

  let adminLogin = process.env.ADMIN_LOGIN?.trim();
  let adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminLogin || !adminPassword) {
    const gen = generateAdminCredentials();
    adminLogin = gen.login;
    adminPassword = gen.password;
    console.warn(`[Regola] Первый запуск. Логин: ${adminLogin} Пароль: ${adminPassword}`);
  }

  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(adminLogin)) {
    throw new Error("ADMIN_LOGIN must be 3-128 chars: letters, digits, _ and -");
  }
  if (adminPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  }

  const adminHash = bcrypt.hashSync(adminPassword, 12);
  const adminEmail = `admin-${adminLogin}@regola.invalid`;
  db.prepare(
    `INSERT INTO users (name, email, phone, address, password_hash, is_admin, admin_login)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run("Admin Regola", adminEmail, "+79829412000", "Санкт-Петербург, проспект Героев, 26", adminHash, 1, adminLogin);

  db.prepare("INSERT INTO categories (name) VALUES (?)").run("Дверные ручки");

  const insertProduct = db.prepare(`
    INSERT INTO products
      (name, price, category_id, description, image, stock, views, created_at, ozon_url, wb_url, ym_url, wb_price, ozon_price, ym_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  insertProduct.run(
    "Regola Classic Chrome",
    1850,
    1,
    "Классическая дверная ручка в хроме для межкомнатных дверей.",
    "https://images.unsplash.com/photo-1616047006789-b7af2f5f4ca4?auto=format&fit=crop&w=600&q=80",
    18,
    45,
    now,
    "https://www.ozon.ru/seller/torretta/",
    "https://www.wildberries.ru/seller/782141",
    "https://market.yandex.ru/business--regola/203997184",
    1850,
    1890,
    1920
  );
  insertProduct.run(
    "Regola Matte Black",
    2190,
    1,
    "Матовая чёрная ручка в современном минималистичном дизайне.",
    "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=600&q=80",
    12,
    62,
    now,
    "https://www.ozon.ru/seller/torretta/",
    "https://www.wildberries.ru/seller/782141",
    "https://market.yandex.ru/business--regola/203997184",
    2190,
    2250,
    2290
  );
}
