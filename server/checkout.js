import crypto from "crypto";

export const MAX_ORDER_ITEMS = 50;
export const MAX_QTY_PER_PRODUCT = 99;

const CUSTOMER_LIMITS = Object.freeze({
  name: 100,
  phone: 32,
  email: 254,
  city: 120,
  address: 300,
  comment: 2000,
  deliveryPointCode: 30,
  fiasId: 36,
});

const DELIVERY_METHODS = new Set(["СДЭК до ПВЗ"]);
const PAYMENT_METHODS = new Set(["online"]);

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
  const nameLetters = name.match(/\p{L}/gu) || [];
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u.test(name) || nameLetters.length < 2) {
    throw new CheckoutValidationError("Укажите настоящее имя буквами");
  }
  const phone = requiredText(body.phone, "Телефон", 7, CUSTOMER_LIMITS.phone);
  const phoneDigits = phone.replace(/\D/g, "");
  if (!/^[+0-9()\-\.\s]+$/.test(phone) || phoneDigits.length !== 11 || !/^[78]/.test(phoneDigits)) {
    throw new CheckoutValidationError("Укажите российский телефон из 11 цифр");
  }
  const normalizedPhone = `+7${phoneDigits.slice(1)}`;

  const email = optionalText(body.email, "Email", CUSTOMER_LIMITS.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CheckoutValidationError("Укажите корректный email");
  }

  const city = requiredText(body.city, "Город", 2, CUSTOMER_LIMITS.city);
  const cityLetters = city.match(/\p{L}/gu) || [];
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s().-]*$/u.test(city) || cityLetters.length < 3 || new Set(cityLetters.map((letter) => letter.toLowerCase())).size < 2) {
    throw new CheckoutValidationError("Укажите корректный город");
  }
  const address = optionalText(body.address, "Адрес", CUSTOMER_LIMITS.address);
  const comment = optionalText(body.comment, "Комментарий", CUSTOMER_LIMITS.comment);
  const deliveryPointCode = optionalText(body.deliveryPointCode, "Код ПВЗ", CUSTOMER_LIMITS.deliveryPointCode);
  const cdekCityCode = optionalPositiveInteger(body.cdekCityCode, "Код города СДЭК");
  const cityFiasId = optionalFiasId(body.cityFiasId, "ФИАС города");
  const addressFiasId = optionalFiasId(body.addressFiasId, "ФИАС адреса");
  const deliveryMethod = requiredText(body.deliveryMethod, "Способ доставки", 2, 80);
  const paymentMethod = requiredText(body.paymentMethod, "Способ оплаты", 2, 40);

  if (!DELIVERY_METHODS.has(deliveryMethod)) {
    throw new CheckoutValidationError("Некорректный способ доставки");
  }
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    throw new CheckoutValidationError("Некорректный способ оплаты");
  }
  if (address && !/[\p{L}]/u.test(address)) {
    throw new CheckoutValidationError("Укажите корректный адрес");
  }

  return { name, phone: normalizedPhone, email, city, address, comment, deliveryMethod, paymentMethod, deliveryPointCode, cdekCityCode, cityFiasId, addressFiasId };
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

export function estimateDelivery({ city, totalQty, goodsTotal, deliveryMethod = "СДЭК до ПВЗ" }) {
  const normalizedCity = city.toLowerCase();
  const isSpb = /санкт|петербург|спб|sankt|spb/.test(normalizedCity);
  const isMoscow = /москв|moscow/.test(normalizedCity);
  const base = isSpb ? 250 : isMoscow ? 320 : 420;
  const deliveryPrice = goodsTotal >= 15000 ? 0 : safeMoneyAdd(base, Math.max(0, totalQty - 1) * 60);
  return {
    provider: deliveryMethod.startsWith("СДЭК") ? "CDEK" : "manual",
    mode: "manual_estimate",
    city,
    deliveryPrice,
    minDays: isSpb ? 1 : isMoscow ? 2 : 3,
    maxDays: isSpb ? 2 : isMoscow ? 4 : 7,
    tariff: `${deliveryMethod}, предварительный расчёт`,
    notice: "Точная стоимость доставки подтверждается менеджером после оформления заказа.",
  };
}

export function estimateCheckoutDelivery(database, body) {
  const quote = prepareDeliveryQuote(database, body);
  return estimateDelivery({
    city: quote.city,
    totalQty: quote.cart.totalQty,
    goodsTotal: quote.cart.goodsTotal,
    deliveryMethod: quote.deliveryMethod,
  });
}

export function prepareDeliveryQuote(database, body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CheckoutValidationError("Некорректные данные доставки");
  }
  const city = requiredText(body.city, "Город", 2, CUSTOMER_LIMITS.city);
  const deliveryMethod = typeof body.deliveryMethod === "string" && body.deliveryMethod.trim()
    ? body.deliveryMethod.trim()
    : "СДЭК до ПВЗ";
  if (!DELIVERY_METHODS.has(deliveryMethod)) throw new CheckoutValidationError("Некорректный способ доставки");
  const cityCode = optionalPositiveInteger(body.cdekCityCode, "Код города СДЭК");
  const requestedItems = normalizeCheckoutItems(body.items);
  const cart = loadAuthoritativeCart(database, requestedItems);
  return { city, cityCode, deliveryMethod, cart };
}

export function createCheckoutRecord(database, body, { saveOrderMessage, deliveryEstimate, now = () => new Date().toISOString() } = {}) {
  const customer = validateCheckoutCustomer(body);
  const requestedItems = normalizeCheckoutItems(body.items);

  const persist = database.transaction(() => {
    const cart = loadAuthoritativeCart(database, requestedItems);
    const estimate = deliveryEstimate
      ? normalizeDeliveryEstimate(deliveryEstimate)
      : estimateDelivery({
        city: customer.city,
        totalQty: cart.totalQty,
        goodsTotal: cart.goodsTotal,
        deliveryMethod: customer.deliveryMethod,
      });
    if (
      customer.deliveryMethod === "СДЭК до ПВЗ"
      && estimate.mode !== "manual_estimate"
      && !customer.deliveryPointCode
    ) {
      throw new CheckoutValidationError("Выберите пункт выдачи СДЭК");
    }
    const total = safeMoneyAdd(cart.goodsTotal, estimate.deliveryPrice);
    const createdAt = now();
    const delivery = buildDeliveryLabel(customer, estimate.deliveryPrice);
    const payment = buildPaymentLabel(customer.paymentMethod);
    const paymentMeta = initialPaymentMeta(customer.paymentMethod);
    const cancelToken = crypto.randomBytes(32).toString("hex");
    const cancelTokenHash = crypto.createHash("sha256").update(cancelToken, "utf8").digest("hex");
    const result = database.prepare(`
      INSERT INTO orders (
        user_id, status, name, phone, email, city, address, comment,
        delivery, delivery_method, delivery_price, goods_total,
        payment, payment_method, payment_status, payment_provider,
        cdek_tariff_code, cdek_city_code, cdek_delivery_point,
        cancel_token_hash, total, created_at
      )
      VALUES (0, 'обрабатывается', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customer.name, customer.phone, customer.email, customer.city, customer.address, customer.comment,
      delivery, customer.deliveryMethod, estimate.deliveryPrice, cart.goodsTotal,
      payment, customer.paymentMethod, paymentMeta.status, paymentMeta.provider,
      estimate.tariffCode || null, estimate.cityCode || customer.cdekCityCode || null, customer.deliveryPointCode,
      cancelTokenHash, total, createdAt
    );
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
      deliveryMethod: customer.deliveryMethod,
      payment,
      paymentMethod: customer.paymentMethod,
      goodsTotal: cart.goodsTotal,
      total,
      orderId,
    };
    const message = saveOrderMessage ? saveOrderMessage(messagePayload) : { ...messagePayload, payload: messagePayload };
    return {
      orderId,
      cancelToken,
      message,
      total,
      goodsTotal: cart.goodsTotal,
      deliveryPrice: estimate.deliveryPrice,
      paymentMethod: customer.paymentMethod,
      items: messagePayload.items,
      order: {
        id: orderId,
        ...customer,
        total,
        goodsTotal: cart.goodsTotal,
        deliveryPrice: estimate.deliveryPrice,
        paymentStatus: paymentMeta.status,
        cancelToken,
      },
    };
  });

  return persist();
}

export function createCheckoutHandler({
  database,
  saveOrderMessage,
  notifyTelegram,
  serializeOrder,
  resolveDelivery,
  initializePayment,
  validateLocation,
  logger = console,
}) {
  return async function checkoutHandler(req, res) {
    let checkout;
    let paymentError = "";
    try {
      let deliveryEstimate;
      if (resolveDelivery) {
        const customer = validateCheckoutCustomer(req.body);
        if (validateLocation) await validateLocation(customer);
        const requestedItems = normalizeCheckoutItems(req.body?.items);
        const cart = loadAuthoritativeCart(database, requestedItems);
        deliveryEstimate = await resolveDelivery({ customer, cart });
      }
      checkout = createCheckoutRecord(database, req.body, { saveOrderMessage, deliveryEstimate });
    } catch (error) {
      if (error instanceof CheckoutValidationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("[Regola] Checkout preparation or transaction failed");
      return res.status(502).json({ message: "Не удалось рассчитать доставку или сохранить заказ" });
    }

    if (checkout.paymentMethod === "online") {
      if (!initializePayment) {
        database.prepare("UPDATE orders SET payment_status = 'setup_required' WHERE id = ?").run(checkout.orderId);
      } else {
        try {
          const payment = await initializePayment({ order: checkout.order, items: checkout.items });
          database.prepare(`
            UPDATE orders
            SET payment_status = CASE WHEN payment_status IN ('paid', 'authorized') THEN payment_status ELSE 'awaiting_payment' END,
                payment_provider = ?, payment_id = COALESCE(payment_id, ?), payment_url = ?, payment_amount_kopecks = ?
            WHERE id = ?
          `).run(payment.provider, payment.paymentId, payment.paymentUrl, payment.amountKopecks, checkout.orderId);
        } catch (error) {
          const status = error?.code === "NOT_CONFIGURED" ? "setup_required" : "payment_error";
          database.prepare("UPDATE orders SET payment_status = ? WHERE id = ?").run(status, checkout.orderId);
          paymentError = error?.message || "T-Банк не создал платёж";
          logger.warn(`[Regola] Payment initialization failed for order ${checkout.orderId}: ${error?.code || "UNKNOWN"}`);
        }
      }
    }

    try {
      await notifyTelegram(`Новый заказ #${checkout.orderId}`, checkout.message);
    } catch {
      logger.warn(`[Regola] Telegram notification failed for order ${checkout.orderId}`);
    }

    const row = database.prepare("SELECT * FROM orders WHERE id = ?").get(checkout.orderId);
    const responseOrder = serializeOrder(row);
    responseOrder.cancelToken = checkout.cancelToken;
    responseOrder.cancelUrl = `/order/${checkout.orderId}?token=${encodeURIComponent(checkout.cancelToken)}`;
    if (paymentError) responseOrder.paymentError = paymentError;
    return res.status(201).json(responseOrder);
  };
}

export function buildDeliveryLabel(customer, deliveryPrice) {
  return `${customer.deliveryMethod}, ${customer.city}${deliveryPrice ? `, доставка ${deliveryPrice} ₽` : ", доставка бесплатно"}`;
}

export function buildPaymentLabel(method) {
  if (method === "online") return "Онлайн-оплата через Т-Банк";
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

function optionalPositiveInteger(value, label) {
  if (value === undefined || value === null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new CheckoutValidationError(`${label}: неверное значение`);
  return number;
}

function optionalFiasId(value, label) {
  if (value === undefined || value === null || value === "") return "";
  const text = optionalText(value, label, CUSTOMER_LIMITS.fiasId);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
    throw new CheckoutValidationError(`${label}: неверное значение`);
  }
  return text;
}

function normalizeDeliveryEstimate(estimate) {
  const deliveryPrice = Number(estimate?.deliveryPrice);
  if (!Number.isSafeInteger(deliveryPrice) || deliveryPrice < 0) {
    throw new CheckoutValidationError("Сервис доставки вернул некорректную стоимость");
  }
  return {
    ...estimate,
    deliveryPrice,
    tariffCode: optionalPositiveInteger(estimate.tariffCode, "Тариф СДЭК"),
    cityCode: optionalPositiveInteger(estimate.cityCode, "Код города СДЭК"),
  };
}

function initialPaymentMeta(method) {
  if (method === "online") return { provider: "tbank", status: "pending" };
  throw new CheckoutValidationError("Некорректный способ оплаты");
}

function safeMoneyAdd(a, b) {
  const total = a + b;
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new CheckoutValidationError("Стоимость заказа превышает допустимый предел");
  }
  return total;
}
