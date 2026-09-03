import { requestTelegramBotApi } from "./telegramApi.js";

const POLL_TIMEOUT_SECONDS = 25;
const RETRY_DELAY_MS = 5_000;

/**
 * Small Telegram Bot API client with no additional runtime dependency.
 * It is deliberately restricted to explicitly configured administrator chats.
 */
export function createTelegramBot({
  database,
  token = process.env.TELEGRAM_BOT_TOKEN,
  adminChatIds = configuredAdminChats(),
  apiBaseUrl = process.env.TELEGRAM_BOT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const allowedChats = new Set(adminChatIds.map(String));
  const enabled = Boolean(database && token && allowedChats.size && typeof fetchImpl === "function");
  let offset = 0;
  let stopped = false;
  let timer = null;

  async function request(method, body) {
    return requestTelegramBotApi({ token, method, body, baseUrl: apiBaseUrl, fetchImpl });
  }

  async function send(chatId, text, options = {}) {
    if (!allowedChats.has(String(chatId))) return false;
    await request("sendMessage", { chat_id: chatId, text: String(text).slice(0, 4000), ...options });
    return true;
  }

  async function edit(chatId, messageId, text, options = {}) {
    await request("editMessageText", { chat_id: chatId, message_id: messageId, text: String(text).slice(0, 4000), ...options });
  }

  async function handleUpdate(update) {
    const message = update.message;
    const callback = update.callback_query;
    const chatId = message?.chat?.id ?? callback?.message?.chat?.id;
    if (!chatId || !allowedChats.has(String(chatId))) return;

    if (callback) {
      await request("answerCallbackQuery", { callback_query_id: callback.id });
      const screen = getCallbackScreen(callback.data);
      if (!screen) return send(chatId, "Команда устарела. Откройте список ещё раз.");
      if (screen.update) screen.update();
      const options = { reply_markup: screen.keyboard };
      try {
        await edit(chatId, callback.message.message_id, screen.text, options);
      } catch (error) {
        // Telegram rejects an edit when text did not change. It is not an application error.
        if (!String(error.message).includes("message is not modified")) throw error;
      }
      return;
    }

    const command = String(message?.text || "").trim().split(/\s+/)[0].toLowerCase().replace(/@[^\s]+$/, "");
    if (!command) return;
    if (["/start", "/help", "/menu"].includes(command)) return send(chatId, helpText(), { reply_markup: menuKeyboard() });
    if (command === "/orders") return send(chatId, ordersScreen().text, { reply_markup: ordersScreen().keyboard });
    if (["/requests", "/leads", "/messages"].includes(command)) return send(chatId, messagesScreen().text, { reply_markup: messagesScreen().keyboard });
    if (["/products", "/cards"].includes(command)) return send(chatId, productsScreen().text, { reply_markup: productsScreen().keyboard });
    return send(chatId, "Не понял команду. Используйте /menu.");
  }

  function getCallbackScreen(data) {
    const value = String(data || "");
    if (value === "orders") return ordersScreen();
    if (value === "messages") return messagesScreen();
    if (value === "products") return productsScreen();
    if (value === "menu") return { text: helpText(), keyboard: menuKeyboard() };

    const order = /^order:(\d+)$/.exec(value);
    if (order) return orderScreen(Number(order[1]));
    const orderStatus = /^order-status:(\d+):(processing|done|cancelled)$/.exec(value);
    if (orderStatus) return updateOrderStatus(Number(orderStatus[1]), orderStatus[2]);

    const message = /^message:(\d+)$/.exec(value);
    if (message) return messageScreen(Number(message[1]));
    const messageStatus = /^message-status:(\d+):(in_work|done|spam)$/.exec(value);
    if (messageStatus) return updateMessageStatus(Number(messageStatus[1]), messageStatus[2]);

    const product = /^product:(\d+)$/.exec(value);
    if (product) return productScreen(Number(product[1]));
    const productVisibility = /^product-visibility:(\d+):(0|1)$/.exec(value);
    if (productVisibility) return updateProductVisibility(Number(productVisibility[1]), Number(productVisibility[2]));
    return null;
  }

  function ordersScreen() {
    const rows = database.prepare("SELECT id, name, total, status, payment_status, created_at FROM orders ORDER BY created_at DESC LIMIT 12").all();
    const text = rows.length
      ? `Заказы (последние ${rows.length})\n\n${rows.map((row) => `#${row.id} · ${row.name} · ${row.total} ₽\n${orderStatusLabel(row.status)} · оплата: ${row.payment_status || "pending"}`).join("\n\n")}`
      : "Заказов пока нет.";
    return { text, keyboard: [...rows.map((row) => [{ text: `Заказ #${row.id}`, callback_data: `order:${row.id}` }]), [{ text: "← Меню", callback_data: "menu" }]] };
  }

  function orderScreen(id) {
    const order = database.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!order) return { text: "Заказ не найден.", keyboard: [[{ text: "← Заказы", callback_data: "orders" }]] };
    const items = database.prepare("SELECT name, qty, price FROM order_items WHERE order_id = ?").all(id);
    const text = [
      `Заказ #${order.id}`,
      `Статус: ${orderStatusLabel(order.status)}`,
      `Оплата: ${order.payment_status || "pending"}${order.payment_method ? ` (${order.payment_method})` : ""}`,
      `Покупатель: ${order.name}`,
      `Телефон: ${order.phone}`,
      order.email ? `Email: ${order.email}` : "",
      order.city ? `Город: ${order.city}` : "",
      `Адрес: ${order.address}`,
      order.delivery_method ? `Доставка: ${order.delivery_method}` : `Доставка: ${order.delivery}`,
      order.cdek_number ? `СДЭК: ${order.cdek_number} (${order.cdek_status || "без статуса"})` : "",
      order.comment ? `Комментарий: ${order.comment}` : "",
      "Товары:",
      ...items.map((item) => `• ${item.name} × ${item.qty} — ${item.price} ₽`),
      `Итого: ${order.total} ₽`,
    ].filter(Boolean).join("\n");
    return { text, keyboard: [[
      { text: "В работу", callback_data: `order-status:${id}:processing` },
      { text: "Выполнен", callback_data: `order-status:${id}:done` },
    ], [{ text: "Отменить", callback_data: `order-status:${id}:cancelled` }], [{ text: "← Заказы", callback_data: "orders" }]] };
  }

  function updateOrderStatus(id, status) {
    const statuses = { processing: "обрабатывается", done: "выполнен", cancelled: "отменён" };
    database.prepare("UPDATE orders SET status = ? WHERE id = ?").run(statuses[status], id);
    return orderScreen(id);
  }

  function messagesScreen() {
    const rows = database.prepare("SELECT id, type, status, name, message, created_at FROM site_messages ORDER BY created_at DESC LIMIT 12").all();
    const text = rows.length
      ? `Заявки и вопросы (последние ${rows.length})\n\n${rows.map((row) => `#${row.id} · ${row.type === "order" ? "Заказ" : "Вопрос"} · ${messageStatusLabel(row.status)}\n${row.name}: ${compact(row.message, 90)}`).join("\n\n")}`
      : "Заявок и вопросов пока нет.";
    return { text, keyboard: [...rows.map((row) => [{ text: `Заявка #${row.id}`, callback_data: `message:${row.id}` }]), [{ text: "← Меню", callback_data: "menu" }]] };
  }

  function messageScreen(id) {
    const row = database.prepare("SELECT * FROM site_messages WHERE id = ?").get(id);
    if (!row) return { text: "Заявка не найдена.", keyboard: [[{ text: "← Заявки", callback_data: "messages" }]] };
    return { text: [`Заявка #${row.id}`, `Тип: ${row.type === "order" ? "заказ" : "вопрос"}`, `Статус: ${messageStatusLabel(row.status)}`, `Имя: ${row.name}`, row.phone ? `Телефон: ${row.phone}` : "", row.email ? `Email: ${row.email}` : "", `Сообщение: ${row.message}`, row.admin_note ? `Заметка: ${row.admin_note}` : ""].filter(Boolean).join("\n"), keyboard: [[{ text: "В работу", callback_data: `message-status:${id}:in_work` }, { text: "Готово", callback_data: `message-status:${id}:done` }], [{ text: "Спам", callback_data: `message-status:${id}:spam` }], [{ text: "← Заявки", callback_data: "messages" }]] };
  }

  function updateMessageStatus(id, status) {
    database.prepare("UPDATE site_messages SET status = ? WHERE id = ?").run(status, id);
    return messageScreen(id);
  }

  function productsScreen() {
    const rows = database.prepare("SELECT id, name, price, is_active FROM products ORDER BY created_at DESC LIMIT 12").all();
    const text = rows.length ? `Карточки товаров (последние ${rows.length})\n\n${rows.map((row) => `#${row.id} · ${row.name}\n${row.price} ₽ · ${row.is_active ? "активна" : "скрыта"}`).join("\n\n")}` : "Товаров пока нет.";
    return { text, keyboard: [...rows.map((row) => [{ text: `Карточка #${row.id}`, callback_data: `product:${row.id}` }]), [{ text: "← Меню", callback_data: "menu" }]] };
  }

  function productScreen(id) {
    const row = database.prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!row) return { text: "Карточка не найдена.", keyboard: [[{ text: "← Товары", callback_data: "products" }]] };
    return { text: [`Карточка #${row.id}`, row.name, `Цена: ${row.price} ₽`, `Статус: ${row.is_active ? "активна на сайте" : "скрыта"}`, row.description ? `Описание: ${compact(row.description, 1200)}` : "", row.wb_url ? `Wildberries: ${row.wb_url}` : "", row.ozon_url ? `Ozon: ${row.ozon_url}` : "", row.ym_url ? `Яндекс Маркет: ${row.ym_url}` : ""].filter(Boolean).join("\n"), keyboard: [[{ text: row.is_active ? "Скрыть с сайта" : "Опубликовать на сайте", callback_data: `product-visibility:${id}:${row.is_active ? 0 : 1}` }], [{ text: "← Товары", callback_data: "products" }]] };
  }

  function updateProductVisibility(id, isActive) {
    database.prepare("UPDATE products SET is_active = ? WHERE id = ?").run(isActive, id);
    return productScreen(id);
  }

  async function poll() {
    if (!enabled || stopped) return;
    try {
      const updates = await request("getUpdates", { offset, timeout: POLL_TIMEOUT_SECONDS, allowed_updates: ["message", "callback_query"] });
      for (const update of updates) {
        offset = Math.max(offset, Number(update.update_id) + 1);
        try { await handleUpdate(update); } catch (error) { logger.warn("[Regola] Telegram bot update failed:", error.message); }
      }
      timer = setTimeout(poll, 0);
    } catch (error) {
      logger.warn("[Regola] Telegram bot polling failed:", error.message);
      timer = setTimeout(poll, RETRY_DELAY_MS);
    }
  }

  return {
    enabled,
    start() { if (enabled && !stopped) poll(); },
    stop() { stopped = true; if (timer) clearTimeout(timer); },
    send,
    handleUpdate,
  };
}

export function configuredAdminChats(env = process.env) {
  return [...new Set(`${env.TELEGRAM_CHAT_ID || ""},${env.TELEGRAM_ADMIN_CHAT_IDS || ""}`.split(",").map((id) => id.trim()).filter((id) => /^-?\d{5,20}$/.test(id)))];
}

function helpText() {
  return "Панель Regola\n\n/orders — заказы\n/requests — заявки и вопросы\n/products — карточки товаров\n\nНажимайте кнопки, чтобы открыть запись и сменить её статус.";
}

function menuKeyboard() {
  return { inline_keyboard: [[{ text: "Заказы", callback_data: "orders" }, { text: "Заявки", callback_data: "messages" }], [{ text: "Карточки товаров", callback_data: "products" }]] };
}

function orderStatusLabel(status) { return ({ "обрабатывается": "в работе", "выполнен": "выполнен", "отменён": "отменён", "отменен": "отменён" })[status] || status || "новый"; }
function messageStatusLabel(status) { return ({ new: "новая", in_work: "в работе", done: "готово", spam: "спам" })[status] || "новая"; }
function compact(value, max) { const text = String(value || "").replace(/\s+/g, " ").trim(); return text.length > max ? `${text.slice(0, max - 1)}…` : text; }
