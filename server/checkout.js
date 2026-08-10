export const MAX_ORDER_ITEMS = 50;
export const MAX_QTY_PER_PRODUCT = 99;

const CUSTOMER_LIMITS = Object.freeze({
  name: 100,
  phone: 32,
  email: 254,
  city: 120,
  address: 300,
  comment: 2000,
});

const DELIVERY_METHODS = new Set(["СДЭК до ПВЗ", "СДЭК курьером", "Почта России"]);
const PAYMENT_METHODS = new Set(["invoice", "online", "cod"]);

export class CheckoutValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CheckoutValidationError";
    this.statusCode = 400;
  }
}

export function normalizeCheckoutItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutValidationError("Корзина пустая");
  }
  if (items.length > MAX_ORDER_ITEMS) {
    throw new CheckoutValidationError(`В заказе может быть не более ${MAX_ORDER_ITEMS} позиций`);
  }

  const quantities = new Map();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new CheckoutValidationError("Некорректная позиция заказа");
    }
    const productId = item.productId;
    const qty = item.qty;
    if (typeof productId !== "number" || !Number.isSafeInteger(productId) || productId <= 0) {
      throw new CheckoutValidationError("Некорректный идентификатор товара");
    }
    if (typeof qty !== "number" || !Number.isSafeInteger(qty) || qty <= 0 || qty > MAX_QTY_PER_PRODUCT) {
      throw new CheckoutValidationError(`Количество товара должно быть целым числом от 1 до ${MAX_QTY_PER_PRODUCT}`);
    }

    const combinedQty = (quantities.get(productId) || 0) + qty;
    if (!Number.isSafeInteger(combinedQty) || combinedQty > MAX_QTY_PER_PRODUCT) {
      throw new CheckoutValidationError(`Общее количество одного товара не может превышать ${MAX_QTY_PER_PRODUCT}`);
    }
    quantities.set(productId, combinedQty);
  }

  return [...quantities].map(([productId, qty]) => ({ productId, qty }));
}

export function validateCheckoutCustomer(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CheckoutValidationError("Некорректные данные заказа");
  }

  const name = requiredText(body.name, "Имя", 2, CUSTOMER_LIMITS.name);
  const phone = requiredText(body.phone, "Телефон", 7, CUSTOMER_LIMITS.phone);
  const phoneDigits = phone.replace(/\D/g, "");
  if (!/^[+0-9()\-\.\s]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    throw new CheckoutValidationError("Укажите корректный телефон");
  }

  const email = optionalText(body.email, "Email", CUSTOMER_LIMITS.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CheckoutValidationError("Укажите корректный email");
  }

  const city = requiredText(body.city, "Город", 2, CUSTOMER_LIMITS.city);
  const address = optionalText(body.address, "Адрес", CUSTOMER_LIMITS.address);
  const comment = optionalText(body.comment, "Комментарий", CUSTOMER_LIMITS.comment);
  const deliveryMethod = requiredText(body.deliveryMethod, "Способ доставки", 2, 80);
  const paymentMethod = requiredText(body.paymentMethod, "Способ оплаты", 2, 40);

  if (!DELIVERY_METHODS.has(deliveryMethod)) {
    throw new CheckoutValidationError("Некорректный способ доставки");
  }
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    throw new CheckoutValidationError("Некорректный способ оплаты");
  }

  return { name, phone, email, city, address, comment, deliveryMethod, paymentMethod };
}

export function loadAuthoritativeCart(database, requestedItems) {
  const placeholders = requestedItems.map(() => "?").join(", ");
  const productIds = requestedItems.map((item) => item.productId);
  const products = database.prepare(`
    SELECT id, name, price, is_active
    FROM products
    WHERE id IN (${placeholders})
  `).all(...productIds);
  const productsById = new Map(products.map((product) => [product.id, product]));

  const items = requestedItems.map(({ productId, qty }) => {
    const product = productsById.get(productId);
    if (!product || product.is_active !== 1) {
      throw new CheckoutValidationError(`Товар ${productId} недоступен`);
    }
    if (typeof product.name !== "string" || !product.name.trim()) {
      throw new CheckoutValidationError(`Товар ${productId} недоступен`);
    }
    if (typeof product.price !== "number" || !Number.isSafeInteger(product.price) || product.price <= 0) {
      throw new CheckoutValidationError(`У товара ${productId} некорректная цена`);
    }
    const lineTotal = product.price * qty;
    if (!Number.isSafeInteger(lineTotal)) {
      throw new CheckoutValidationError("Стоимость заказа превышает допустимый предел");
    }
    return { productId, name: product.name, price: product.price, qty, lineTotal };
  });

  const goodsTotal = items.reduce((sum, item) => safeMoneyAdd(sum, item.lineTotal), 0);
  const totalQty = items.reduce((sum, item) => {
    const next = sum + item.qty;
    if (!Number.isSafeInteger(next)) throw new CheckoutValidationError("Количество товаров превышает допустимый предел");
    return next;
  }, 0);

  return { items, goodsTotal, totalQty };
}

export function estimateDelivery({ city, totalQty, goodsTotal }) {
  const normalizedCity = city.toLowerCase();
  const isSpb = /санкт|петербург|спб|sankt|spb/.test(normalizedCity);
  const isMoscow = /москв|moscow/.test(normalizedCity);
  const base = isSpb ? 250 : isMoscow ? 320 : 420;
  const deliveryPrice = goodsTotal >= 15000 ? 0 : safeMoneyAdd(base, Math.max(0, totalQty - 1) * 60);
  return {
    provider: "CDEK",
    mode: process.env.CDEK_CLIENT_ID && process.env.CDEK_CLIENT_SECRET ? "api_ready" : "manual_estimate",
    city,
    deliveryPrice,
    minDays: isSpb ? 1 : isMoscow ? 2 : 3,
    maxDays: isSpb ? 2 : isMoscow ? 4 : 7,
    tariff: "СДЭК, предварительный расчёт",
    notice: "Точная стоимость доставки подтверждается менеджером после оформления заказа.",
  };
}

export function estimateCheckoutDelivery(database, body) {
  const city = requiredText(body?.city, "Город", 2, CUSTOMER_LIMITS.city);
  const requestedItems = normalizeCheckoutItems(body?.items);
  const cart = loadAuthoritativeCart(database, requestedItems);
  return estimateDelivery({ city, totalQty: cart.totalQty, goodsTotal: cart.goodsTotal });
}

export function createCheckoutRecord(database, body, { saveOrderMessage, now = () => new Date().toISOString() } = {}) {
  const customer = validateCheckoutCustomer(body);
  const requestedItems = normalizeCheckoutItems(body.items);

  const persist = database.transaction(() => {
    const cart = loadAuthoritativeCart(database, requestedItems);
    const estimate = estimateDelivery({ city: customer.city, totalQty: cart.totalQty, goodsTotal: cart.goodsTotal });
    const total = safeMoneyAdd(cart.goodsTotal, estimate.deliveryPrice);
    const createdAt = now();
    const delivery = buildDeliveryLabel(customer, estimate.deliveryPrice);
    const payment = buildPaymentLabel(customer.paymentMethod);
    const result = database.prepare(`
      INSERT INTO orders (user_id, status, name, phone, address, delivery, payment, total, created_at)
      VALUES (0, 'обрабатывается', ?, ?, ?, ?, ?, ?, ?)
    `).run(customer.name, customer.phone, customer.address, delivery, payment, total, createdAt);
    const orderId = Number(result.lastInsertRowid);
    const insertItem = database.prepare(`
      INSERT INTO order_items (order_id, product_id, name, qty, price)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of cart.items) {
      insertItem.run(orderId, item.productId, item.name, item.qty, item.price);
    }

    const messagePayload = {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      message: customer.comment || `Заказ #${orderId} на сумму ${total} ₽`,
      items: cart.items.map(({ productId, name, price, qty }) => ({ productId, name, price, qty })),
      delivery,
      deliveryPrice: estimate.deliveryPrice,
      payment,
      goodsTotal: cart.goodsTotal,
      total,
      orderId,
    };
    const message = saveOrderMessage ? saveOrderMessage(messagePayload) : { ...messagePayload, payload: messagePayload };
    return { orderId, message, total, goodsTotal: cart.goodsTotal, deliveryPrice: estimate.deliveryPrice };
  });

  return persist();
}

export function createCheckoutHandler({ database, saveOrderMessage, notifyTelegram, serializeOrder, logger = console }) {
  return async function checkoutHandler(req, res) {
    let checkout;
    try {
      checkout = createCheckoutRecord(database, req.body, { saveOrderMessage });
    } catch (error) {
      if (error instanceof CheckoutValidationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("[Regola] Checkout transaction failed");
      return res.status(500).json({ message: "Не удалось сохранить заказ" });
    }

    try {
      await notifyTelegram(`Новый заказ #${checkout.orderId}`, checkout.message);
    } catch {
      logger.warn(`[Regola] Telegram notification failed for order ${checkout.orderId}`);
    }

    const row = database.prepare("SELECT * FROM orders WHERE id = ?").get(checkout.orderId);
    return res.status(201).json(serializeOrder(row));
  };
}

export function buildDeliveryLabel(customer, deliveryPrice) {
  return `${customer.deliveryMethod}, ${customer.city}${deliveryPrice ? `, доставка ${deliveryPrice} ₽` : ", доставка бесплатно"}`;
}

export function buildPaymentLabel(method) {
  if (method === "online") return "Онлайн-оплата после подключения эквайринга";
  if (method === "invoice") return "Счёт на оплату";
  if (method === "cod") return "Оплата при получении / по согласованию";
  throw new CheckoutValidationError("Некорректный способ оплаты");
}

function requiredText(value, label, minLength, maxLength) {
  if (typeof value !== "string") throw new CheckoutValidationError(`${label}: неверный тип данных`);
  const text = value.trim();
  if (text.length < minLength || text.length > maxLength) {
    throw new CheckoutValidationError(`${label}: допустимая длина от ${minLength} до ${maxLength} символов`);
  }
  return text;
}

function optionalText(value, label, maxLength) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new CheckoutValidationError(`${label}: неверный тип данных`);
  const text = value.trim();
  if (text.length > maxLength) {
    throw new CheckoutValidationError(`${label}: максимальная длина ${maxLength} символов`);
  }
  return text;
}

function safeMoneyAdd(a, b) {
  const total = a + b;
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new CheckoutValidationError("Стоимость заказа превышает допустимый предел");
  }
  return total;
}
