import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Layout from "./components/Layout";
import { useStore } from "./context/StoreContext";

const ADMIN_ENTRY_PRIMARY = import.meta.env.VITE_ADMIN_PATH || "/_secure-admin-7f29A228lswP";
const ADMIN_ENTRY_LEGACY = "/_secure-admin-7f29a";
const ADMIN_ENTRY_ROUTES = [
  ...new Set([ADMIN_ENTRY_PRIMARY, ADMIN_ENTRY_LEGACY].filter((p) => typeof p === "string" && p.startsWith("/"))),
];

function formatRub(value) {
  return Number(value || 0).toLocaleString("ru-RU");
}

function productImages(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  return images.length ? images : [product.image].filter(Boolean);
}

function PriceBlock({ product, large = false }) {
  return (
    <div className={"price-block" + (large ? " price-block--large" : "")}>
      <p className="price-block__value"><b>{formatRub(product.price)} ₽</b></p>
    </div>
  );
}

function MarketplaceLinks({ product, compact = false }) {
  const links = [
    ["Наш товар на ВБ", "WB", product.wbUrl ?? product.wb_url],
    ["Наш товар на Ozon", "OZON", product.ozonUrl ?? product.ozon_url],
    ["Наш товар на Яндекс Маркет", "Я.Маркет", product.ymUrl ?? product.ym_url],
  ].filter(([, , url]) => url);

  if (!links.length) return null;
  return (
    <div className={"market-offers" + (compact ? " market-offers--compact" : "")}>
      {links.map(([label, badge, url]) => (
        <a key={label} href={url} target="_blank" rel="noreferrer">
          <span>{label}</span>
          <b>{badge}</b>
        </a>
      ))}
    </div>
  );
}

function DescriptionText({ text }) {
  const blocks = String(text || "").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (!blocks.length) return null;
  return (
    <div className="description-text">
      {blocks.map((block, index) => {
        const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
        const isList = lines.length > 1 && lines.every((line) => /^[-•*]/.test(line));
        if (isList) {
          return <ul key={index}>{lines.map((line) => <li key={line}>{line.replace(/^[-•*]\s*/, "")}</li>)}</ul>;
        }
        return <p key={index}>{block}</p>;
      })}
    </div>
  );
}

function HomePage() {
  const { products } = useStore();
  const location = useLocation();
  const handles = products.filter((p) => (p.category_id ?? p.categoryId) === 1);
  const catalogHandles = [...handles].sort((a, b) => String(a.name).localeCompare(String(b.name), "ru", { sensitivity: "base" }));

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    return () => clearTimeout(t);
  }, [location.hash, location.pathname]);

  return (
    <>
      <section id="catalog" className="catalog-section catalog-section--first motion-in" aria-labelledby="catalog-heading">
        <div className="catalog-title">
          <span />
          <h1 id="catalog-heading">Каталог</h1>
          <span />
        </div>
        <p className="catalog-lead catalog-lead--center">Выберите товар.</p>
        {catalogHandles.length === 0 ? <p className="catalog-empty">Каталог скоро будет заполнен.</p> : <ProductGrid products={catalogHandles} />}
      </section>

      <section id="payment" className="info-section motion-in motion-in--delay-1" aria-labelledby="payment-heading">
        <h2 id="payment-heading">Оплата и доставка</h2>
        <div className="info-grid">
          <div className="info-card">
            <h3>Оплата</h3>
            <p>Доступны счёт на оплату, защищённая онлайн-оплата через T-Банк и оплата при получении отправления СДЭК.</p>
          </div>
          <div className="info-card">
            <h3>Доставка</h3>
            <p>Отправляем через СДЭК до ПВЗ или курьером, а также Почтой России. Стоимость рассчитывается сервером при оформлении заказа.</p>
          </div>
        </div>
      </section>

      <section id="about" className="info-section motion-in motion-in--delay-2" aria-labelledby="about-heading">
        <h2 id="about-heading">Цель компании</h2>
        <p>REGOLA — торговая марка дверных ручек, которая уверенно развивается на рынке уже 3 года. Сегодня продукцию REGOLA можно встретить на крупнейших маркетплейсах, но мы стремимся к более тесному взаимодействию с клиентами: на нашем сайте вы можете оформить заказ напрямую, без посредников.</p>
        <p>Такой подход нередко оказывается выгоднее для покупателя, а для нас — возможность выстраивать прозрачные и доверительные отношения с каждым клиентом. Мы по-прежнему сохраняем присутствие на маркетплейсах, но в перспективе планируем сфокусироваться на прямых продажах.</p>
        <p>Для юридических лиц предусмотрена возможность оптовых закупок с оплатой по расчётному счёту. На всю продукцию REGOLA действует гарантия качества сроком 1 год, а при возникновении любых вопросов или сложностей мы всегда на связи — вместе найдём оптимальное решение.</p>
      </section>

      <section id="order" className="info-section motion-in motion-in--delay-3" aria-labelledby="order-heading">
        <h2 id="order-heading">Заказ через маркетплейсы</h2>
        <div className="info-grid info-grid--triple">
          <div className="info-card"><h3>1. Откройте товар</h3><p>Нажмите на фото или название товара в каталоге, чтобы перейти в подробную карточку.</p></div>
          <div className="info-card"><h3>2. Выберите площадку</h3><p>Внизу карточки товара размещены ссылки на Wildberries, Ozon и Яндекс Маркет, если товар там опубликован.</p></div>
          <div className="info-card"><h3>3. Оформите заказ</h3><p>Можно заказать через маркетплейс или добавить товар в корзину сайта и отправить заявку напрямую нам.</p></div>
        </div>
      </section>

      <section id="guarantees" className="info-section guarantee-section motion-in motion-in--delay-4" aria-labelledby="guarantees-heading">
        <div>
          <h2 id="guarantees-heading">Гарантии</h2>
          <p>На всю продукцию REGOLA действует гарантия качества сроком 1 год. Мы внимательно проверяем фурнитуру перед продажей, а если у вас появится вопрос по заказу, комплектации или эксплуатации — свяжитесь с нами, и мы поможем найти решение.</p>
        </div>
        <div className="guarantee-visual" aria-hidden="true">1 год<br /><span>гарантии</span></div>
      </section>

      <QuestionSection />

      <section className="seo-section" aria-label="Ключевые фразы">
        <p>дверные ручки REGOLA, купить дверные ручки, ручки для межкомнатных дверей, дверная фурнитура, ручки Санкт-Петербург, фурнитура для дверей, качественные дверные ручки, Regola</p>
      </section>
    </>
  );
}

function ProductGrid({ products }) {
  return (
    <div className="grid">
      {products.map((p) => (
        <article key={p.id} className="card">
          <Link className="card__image-link" to={"/product/" + p.id}><img src={productImages(p)[0]} alt={p.name} /></Link>
          <h3><Link to={"/product/" + p.id}>{p.name}</Link></h3>
          <PriceBlock product={p} />
          <Link className="btn-outline" to={"/product/" + p.id}>Подробнее</Link>
        </article>
      ))}
    </div>
  );
}

function QuantityPicker({ value, onChange }) {
  return (
    <div className="qty-picker" aria-label="Количество">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))}>−</button>
      <input type="number" min="1" max="99" value={value} onChange={(e) => onChange(Math.min(99, Math.max(1, Number(e.target.value) || 1)))} />
      <button type="button" onClick={() => onChange(Math.min(99, value + 1))}>+</button>
    </div>
  );
}

function ProductPage() {
  const { id } = useParams();
  const { products, addToCart } = useStore();
  const product = products.find((p) => p.id === Number(id));
  const images = useMemo(() => productImages(product || {}), [product]);
  const [activeImage, setActiveImage] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setActiveImage(images[0] || "");
  }, [images]);

  if (!product) return <p>Товар не найден.</p>;
  return (
    <section className="product">
      <div className="product-gallery">
        <img className="product-gallery__main" src={activeImage || images[0]} alt={product.name} />
        {images.length > 1 && (
          <div className="product-gallery__thumbs">
            {images.map((src, index) => (
              <button key={src + index} type="button" className={src === activeImage ? "is-active" : ""} onClick={() => setActiveImage(src)}>
                <img src={src} alt={`${product.name} фото ${index + 1}`} />
              </button>
            ))}
          </div>
        )}
        {product.videoUrl && (
          <div className="product-video">
            {/\.(mp4|webm|ogg)(\?.*)?$/i.test(product.videoUrl)
              ? <video src={product.videoUrl} controls />
              : <iframe src={product.videoUrl} title={`Видео ${product.name}`} loading="lazy" allowFullScreen />}
          </div>
        )}
      </div>
      <div className="product-info">
        <h1>{product.name}</h1>
        <DescriptionText text={product.description} />
        <PriceBlock product={product} large />
        <div className="product-buy">
          <QuantityPicker value={qty} onChange={setQty} />
          <button className="btn" type="button" onClick={() => { addToCart(product, qty); setAdded(true); }}>В корзину</button>
        </div>
        {added && <p className="success-text">Товар добавлен в корзину.</p>}
        <MarketplaceLinks product={product} />
      </div>
    </section>
  );
}

function QuestionSection() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [status, setStatus] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setStatus("");
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Ошибка отправки");
      });
      setForm({ name: "", phone: "", email: "", message: "" });
      setStatus("Вопрос отправлен. Мы скоро свяжемся с вами.");
    } catch (error) {
      setStatus(error.message);
    }
  };
  return (
    <section id="question" className="info-section question-section" aria-labelledby="question-heading">
      <div>
        <h2 id="question-heading">Задать вопрос</h2>
        <p>Напишите, что хотите уточнить. Сообщение попадёт в заявки сайта, а при подключении Telegram-бота — сразу в Telegram.</p>
      </div>
      <form className="question-form" onSubmit={submit}>
        <input required placeholder="Ваше имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <textarea required placeholder="Ваш вопрос" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <button className="btn" type="submit">Отправить</button>
        {status && <p className="form-hint">{status}</p>}
      </form>
    </section>
  );
}

function CartPage() {
  const { cartItems, updateCartQty, removeFromCart, cartTotal, clearCart, sendCheckout, estimateCdekDelivery, suggestAddress, commerce } = useStore();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    deliveryMethod: "СДЭК до ПВЗ",
    paymentMethod: "invoice",
    cdekCityCode: null,
    deliveryPointCode: "",
    cityFiasId: "",
    addressFiasId: "",
    comment: "",
  });
  const [deliveryEstimate, setDeliveryEstimate] = useState(null);
  const [deliveryPoints, setDeliveryPoints] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [suggestionError, setSuggestionError] = useState("");
  const paymentResult = searchParams.get("payment");
  const [status, setStatus] = useState(
    paymentResult === "success"
      ? "Платёж принят. Финальный статус появится в админ-панели после уведомления T-Банка."
      : paymentResult === "fail" ? "Оплата не завершена. Свяжитесь с нами или оформите заказ повторно." : ""
  );
  const orderTotal = cartTotal + Number(deliveryEstimate?.deliveryPrice || 0);

  useEffect(() => {
    setCitySuggestions([]);
    if (!commerce.addressSuggestionsEnabled || form.cityFiasId || form.city.trim().length < 2) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const suggestions = await suggestAddress({ kind: "city", query: form.city });
        if (active) {
          setCitySuggestions(suggestions);
          setSuggestionError(suggestions.length ? "" : "Город не найден. Уточните название.");
        }
      } catch (error) {
        if (active) setSuggestionError(error.message);
      }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [commerce.addressSuggestionsEnabled, form.city, form.cityFiasId, suggestAddress]);

  useEffect(() => {
    setAddressSuggestions([]);
    if (!commerce.addressSuggestionsEnabled || !form.cityFiasId || form.addressFiasId || form.address.trim().length < 2) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const suggestions = await suggestAddress({ kind: "address", query: form.address, cityFiasId: form.cityFiasId });
        if (active) {
          setAddressSuggestions(suggestions);
          setSuggestionError(suggestions.length ? "" : "Адрес не найден. Укажите улицу и дом.");
        }
      } catch (error) {
        if (active) setSuggestionError(error.message);
      }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [commerce.addressSuggestionsEnabled, form.address, form.addressFiasId, form.cityFiasId, suggestAddress]);

  const estimateDelivery = async () => {
    setStatus("");
    try {
      const items = cartItems.map((item) => ({ productId: item.id, qty: item.qty }));
      const estimate = await estimateCdekDelivery({ city: form.city, deliveryMethod: form.deliveryMethod, items });
      setDeliveryEstimate(estimate);
      setForm((current) => ({ ...current, cdekCityCode: estimate.cityCode || null, deliveryPointCode: "" }));
      if (form.deliveryMethod === "СДЭК до ПВЗ" && estimate.cityCode && commerce.cdekApiEnabled) {
        const response = await fetch(`/api/cdek/delivery-points?cityCode=${encodeURIComponent(estimate.cityCode)}`);
        const points = await response.json();
        if (!response.ok) throw new Error(points.message || "Не удалось загрузить ПВЗ СДЭК");
        setDeliveryPoints(Array.isArray(points) ? points : []);
      } else {
        setDeliveryPoints([]);
      }
    } catch (error) {
      setStatus(error.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!cartItems.length || isSubmitting) return;
    setStatus("Отправляем заказ…");
    if (form.paymentMethod === "online" && !commerce.tbankEnabled) {
      setStatus("Онлайн-оплата ещё не подключена. Выберите счёт или оплату при получении.");
      return;
    }
    if (commerce.addressSuggestionsEnabled && !form.cityFiasId) {
      setStatus("Выберите город из выпадающего списка подсказок.");
      return;
    }
    if (commerce.addressSuggestionsEnabled && form.deliveryMethod !== "СДЭК до ПВЗ" && !form.addressFiasId) {
      setStatus("Выберите полный адрес с номером дома из выпадающего списка.");
      return;
    }
    if (commerce.cdekApiEnabled && form.deliveryMethod === "СДЭК до ПВЗ" && !form.deliveryPointCode) {
      setStatus("Рассчитайте доставку и выберите пункт выдачи СДЭК.");
      return;
    }
    setIsSubmitting(true);
    try {
      const order = await sendCheckout({
        ...form,
        items: cartItems.map((item) => ({ productId: item.id, qty: item.qty })),
      });
      clearCart();
      setForm({ name: "", phone: "", email: "", city: "", address: "", deliveryMethod: "СДЭК до ПВЗ", paymentMethod: "invoice", cdekCityCode: null, deliveryPointCode: "", cityFiasId: "", addressFiasId: "", comment: "" });
      setDeliveryEstimate(null);
      setDeliveryPoints([]);
      if (order.paymentUrl) {
        setStatus("Переходим на защищённую платёжную форму T-Банка...");
        window.location.assign(order.paymentUrl);
        return;
      }
      if (order.paymentMethod === "online") {
        setStatus(`Заказ №${order.id} создан, но платёжная форма T-Банка не открылась. ${order.paymentError || "Мы свяжемся с вами для завершения оплаты."}`);
        return;
      }
      if (order.paymentMethod === "cod") {
        setStatus("Заказ принят. Оплата будет произведена при получении отправления СДЭК.");
      } else {
        setStatus("Заказ отправлен. Мы подтвердим доставку и направим данные для оплаты.");
      }
    } catch (error) {
      setStatus(error.message || "Не удалось отправить заказ. Попробуйте ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showValidationError = (e) => {
    e.preventDefault();
    const fieldName = e.target.placeholder || "обязательное поле";
    setStatus(`Проверьте поле «${fieldName}»: ${e.target.validationMessage}`);
    e.target.focus();
  };

  return (
    <section className="cart-page">
      <h1>Корзина</h1>
      {!cartItems.length ? (
        <p>{status || "Корзина пустая."}</p>
      ) : (
        <>
          <div className="cart-list">
            {cartItems.map((item) => (
              <div key={item.id} className="cart-row">
                <img src={productImages(item)[0]} alt="" />
                <div>
                  <b>{item.name}</b>
                  <p>{formatRub(item.price)} ₽ за шт.</p>
                </div>
                <QuantityPicker value={item.qty} onChange={(qty) => updateCartQty(item.id, qty)} />
                <b>{formatRub(item.price * item.qty)} ₽</b>
                <button type="button" onClick={() => removeFromCart(item.id)}>Удалить</button>
              </div>
            ))}
          </div>
          <div className="cart-total">
            Товары: <b>{formatRub(cartTotal)} ₽</b>
            {deliveryEstimate && <span>Доставка: <b>{formatRub(deliveryEstimate.deliveryPrice)} ₽</b></span>}
            <span>Итого: <b>{formatRub(orderTotal)} ₽</b></span>
          </div>
          <form className="form checkout-form" onSubmit={submit} onInvalid={showValidationError}>
            <h2>Оформление заказа</h2>
            <p>Стоимость заказа рассчитывается сервером. Онлайн-оплата проходит на защищённой форме T-Банка, доставка — через СДЭК.</p>
            <input required autoComplete="name" placeholder="Ваше имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input required type="tel" inputMode="tel" autoComplete="tel" placeholder="Телефон: +7 999 123-45-67" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input type="email" autoComplete="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <div className="checkout-grid">
              <div className="suggest-field">
                <input required autoComplete="off" placeholder="Начните вводить город" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value, cityFiasId: "", address: "", addressFiasId: "", cdekCityCode: null, deliveryPointCode: "" })} />
                {citySuggestions.length > 0 && (
                  <div className="suggest-menu" role="listbox">
                    {citySuggestions.map((item) => (
                      <button key={item.fiasId} type="button" onClick={() => { setForm({ ...form, city: item.value, cityFiasId: item.fiasId, address: "", addressFiasId: "", cdekCityCode: null, deliveryPointCode: "" }); setCitySuggestions([]); setSuggestionError(""); }}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select value={form.deliveryMethod} onChange={(e) => { setForm({ ...form, deliveryMethod: e.target.value, address: "", addressFiasId: "", cdekCityCode: null, deliveryPointCode: "" }); setDeliveryEstimate(null); setDeliveryPoints([]); }}>
                <option>СДЭК до ПВЗ</option>
                <option>СДЭК курьером</option>
                <option>Почта России</option>
              </select>
            </div>
            {form.deliveryMethod === "СДЭК до ПВЗ" && deliveryPoints.length > 0 && (
              <select required value={form.deliveryPointCode} onChange={(e) => setForm({ ...form, deliveryPointCode: e.target.value })}>
                <option value="">Выберите пункт выдачи СДЭК</option>
                {deliveryPoints.map((point) => <option key={point.code} value={point.code}>{point.address || point.name}</option>)}
              </select>
            )}
            {form.deliveryMethod !== "СДЭК до ПВЗ" && (
              <div className="suggest-field">
                <input required autoComplete="street-address" placeholder="Начните вводить улицу и дом" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value, addressFiasId: "" })} />
                {addressSuggestions.length > 0 && (
                  <div className="suggest-menu" role="listbox">
                    {addressSuggestions.map((item) => (
                      <button key={`${item.fiasId}-${item.value}`} type="button" disabled={!item.hasHouse} onClick={() => { setForm({ ...form, address: item.value, addressFiasId: item.fiasId }); setAddressSuggestions([]); setSuggestionError(""); }}>
                        {item.label}{item.hasHouse ? "" : " — укажите дом"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {commerce.addressSuggestionsEnabled && suggestionError && <p className="form-hint suggestion-error">{suggestionError}</p>}
            <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              <option value="invoice">Счёт на оплату</option>
              <option value="online" disabled={!commerce.tbankEnabled}>Онлайн-оплата через T-Банк{commerce.tbankEnabled ? "" : " — подключается"}</option>
              <option value="cod">Оплата при получении через СДЭК{commerce.cdekApiEnabled ? "" : " — после подтверждения"}</option>
            </select>
            <button type="button" onClick={estimateDelivery}>Рассчитать СДЭК</button>
            {deliveryEstimate && (
              <p className="delivery-estimate">
                {deliveryEstimate.tariff}: {formatRub(deliveryEstimate.deliveryPrice)} ₽, {deliveryEstimate.minDays}–{deliveryEstimate.maxDays} дн.
                <br />{deliveryEstimate.notice}
              </p>
            )}
            <textarea placeholder="Комментарий к заказу" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            <button className="btn" type="submit" disabled={isSubmitting}>{isSubmitting ? "Отправляем…" : "Отправить заказ"}</button>
            {status && <p className="form-hint checkout-status" role="status" aria-live="polite">{status}</p>}
          </form>
        </>
      )}
    </section>
  );
}

function AdminLoginPage() {
  const { grantAdminAccess } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: "", password: "", accessKey: "" });
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await grantAdminAccess(form);
      if (!res.ok) return setError(res.message);
      navigate("/admin");
    } catch (error) {
      setError(error.message);
    }
  };
  return (
    <form className="form" onSubmit={submit}>
      <h1>Вход в админ-панель</h1>
      <input required type="text" autoComplete="username" placeholder="Логин администратора" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
      <input required type="password" placeholder="Пароль" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <input required type="password" placeholder="Секретный ключ" value={form.accessKey} onChange={(e) => setForm({ ...form, accessKey: e.target.value })} />
      {error && <p className="error-text">{error}</p>}
      <button className="btn" type="submit">Открыть админку</button>
    </form>
  );
}

function productToAdminForm(p) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    categoryId: p.categoryId ?? p.category_id ?? 1,
    description: p.description,
    images: productImages(p),
    imageUrl: "",
    videoUrl: p.videoUrl ?? p.video_url ?? "",
    ozonUrl: p.ozonUrl ?? p.ozon_url ?? "",
    wbUrl: p.wbUrl ?? p.wb_url ?? "",
    ymUrl: p.ymUrl ?? p.ym_url ?? "",
  };
}

const EMPTY_ADMIN_FORM = { id: null, name: "", price: "", categoryId: 1, description: "", images: [], imageUrl: "", videoUrl: "", ozonUrl: "", wbUrl: "", ymUrl: "" };

const MESSAGE_STATUS_LABELS = {
  new: "новое",
  in_work: "в работе",
  done: "закрыто",
  spam: "спам",
};

const PAYMENT_STATUS_LABELS = {
  pending: "ожидает инициализации",
  awaiting_payment: "ожидает оплаты",
  authorized: "авторизован",
  paid: "оплачен",
  failed: "ошибка оплаты",
  payment_error: "не удалось открыть оплату",
  setup_required: "эквайринг не настроен",
  cancelled: "отменён",
  expired: "истёк",
  refunded: "возвращён",
  partially_refunded: "частичный возврат",
  awaiting_cod: "оплата при получении в СДЭК",
  cod_collected: "покупатель оплатил при получении",
  awaiting_invoice: "ожидает счёта",
};

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ru-RU");
}

function messageTypeLabel(type) {
  if (type === "order") return "заказ";
  if (type === "question") return "вопрос";
  return "обращение";
}

function fileToOptimizedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function AdminPage() {
  const { user, isAdminSessionValid, products, categories, upsertProduct, deleteProduct, orders, messages, updateOrderStatus, updateMessage, createCdekShipment, refreshCdekShipment, commerce } = useStore();
  const [form, setForm] = useState(EMPTY_ADMIN_FORM);
  const [adminQuery, setAdminQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState("");
  if (!user?.isAdmin || !isAdminSessionValid) return <Navigate to={ADMIN_ENTRY_PRIMARY} replace />;

  const filteredProducts = products.filter((p) => {
    const q = adminQuery.trim().toLowerCase();
    if (!q) return true;
    return [p.name, p.description].some((value) => String(value || "").toLowerCase().includes(q));
  });

  const resetForm = () => {
    setForm(EMPTY_ADMIN_FORM);
    setStatusText("");
  };

  const addImages = (items) => setForm((prev) => ({ ...prev, images: [...new Set([...prev.images, ...items])].slice(0, 20) }));
  const uploadImages = (files) => {
    const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    Promise.all(imageFiles.map(fileToOptimizedDataUrl)).then(addImages).catch(() => alert("Не удалось загрузить изображения"));
  };
  const addImageUrl = () => {
    const url = form.imageUrl.trim();
    if (!url) return;
    addImages([url]);
    setForm((prev) => ({ ...prev, imageUrl: "" }));
  };
  const removeImage = (src) => setForm((prev) => ({ ...prev, images: prev.images.filter((item) => item !== src) }));
  const moveImage = (index, direction) => {
    setForm((prev) => {
      const next = [...prev.images];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, images: next };
    });
  };
  const makeMainImage = (src) => setForm((prev) => ({ ...prev, images: [src, ...prev.images.filter((item) => item !== src)] }));
  const editProduct = (product) => {
    setForm(productToAdminForm(product));
    setStatusText("Режим редактирования: внесите изменения и нажмите «Сохранить».");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const removeProduct = async (product) => {
    if (!window.confirm(`Удалить товар «${product.name}»?`)) return;
    try {
      await deleteProduct(product.id);
      setStatusText("Товар удалён.");
    } catch (error) {
      alert(error.message);
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!form.images.length) return alert("Добавьте хотя бы одно фото товара");
    setIsSaving(true);
    setStatusText("");
    try {
      await upsertProduct({
        ...form,
        price: Number(form.price) || 0,
        categoryId: Number(form.categoryId),
        image: form.images[0] || "",
      });
      setStatusText(form.id ? "Товар сохранён." : "Товар добавлен.");
      setForm(EMPTY_ADMIN_FORM);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-hero">
        <div>
          <h1>Админ-панель</h1>
          <p>Управление товарами, фото, видео, ценами, ссылками на маркетплейсы и заявками.</p>
        </div>
        <div className="admin-stats">
          <span><b>{products.length}</b> товаров</span>
          <span><b>{products.filter((p) => productImages(p).length > 1).length}</b> с галереей</span>
          <span><b>{orders.length}</b> заказов</span>
          <span><b>{messages.filter((m) => m.status === "new").length}</b> новых обращений</span>
        </div>
      </div>

      <div className="admin-toolbar">
        <input type="search" placeholder="Быстрый поиск по товарам" value={adminQuery} onChange={(e) => setAdminQuery(e.target.value)} />
        <button type="button" onClick={resetForm}>Новый товар</button>
        <a className="btn-outline" href="/" target="_blank" rel="noreferrer">Открыть сайт</a>
      </div>

      {statusText && <p className="admin-status">{statusText}</p>}

      <h2>{form.id ? "Редактирование товара" : "Новый товар"}</h2>
      <form className="form admin-form" onSubmit={submit}>
        <input required placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required type="number" min="1" step="1" placeholder="Цена, ₽" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <textarea required rows="9" placeholder={"Описание. Можно писать абзацы и списки:\n\nПервый абзац\n\n- пункт\n- пункт"} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

        <div className="admin-fieldset">
          <b>Фото товара</b>
          <p className="form-hint">Можно добавить несколько фото с устройства или по URL. Первое фото будет главным.</p>
          <div className="admin-inline">
            <input placeholder="URL изображения" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            <button type="button" onClick={addImageUrl}>Добавить URL</button>
          </div>
          <input type="file" accept="image/*" multiple onChange={(e) => uploadImages(e.target.files)} />
          {form.images.length > 0 && (
            <div className="admin-image-grid">
              {form.images.map((src, index) => (
                <div key={src} className="admin-image-tile">
                  <img src={src} alt={`Фото ${index + 1}`} />
                  <div className="admin-image-tile__actions">
                    <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0}>←</button>
                    <button type="button" onClick={() => makeMainImage(src)} disabled={index === 0}>Главное</button>
                    <button type="button" onClick={() => moveImage(index, 1)} disabled={index === form.images.length - 1}>→</button>
                    <button type="button" onClick={() => removeImage(src)}>Удалить</button>
                  </div>
                  {index === 0 && <span>Главное</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="admin-fieldset">
          <b>Видео</b>
          <input type="url" placeholder="Ссылка на видео: mp4/webm или iframe-ссылка" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
        </div>

        <div className="admin-fieldset">
          <b>Ссылки на маркетплейсы</b>
          <input type="url" placeholder="Ссылка Wildberries" value={form.wbUrl} onChange={(e) => setForm({ ...form, wbUrl: e.target.value })} />
          <input type="url" placeholder="Ссылка Ozon" value={form.ozonUrl} onChange={(e) => setForm({ ...form, ozonUrl: e.target.value })} />
          <input type="url" placeholder="Ссылка Яндекс Маркета" value={form.ymUrl} onChange={(e) => setForm({ ...form, ymUrl: e.target.value })} />
        </div>

        <div className="admin-actions">
          <button className="btn" type="submit" disabled={isSaving}>{isSaving ? "Сохраняю..." : (form.id ? "Сохранить" : "Добавить товар")}</button>
          {form.id && <button type="button" onClick={resetForm}>Отменить редактирование</button>}
        </div>
      </form>

      <h2>Каталог ({filteredProducts.length})</h2>
      <div className="admin-list">
        {filteredProducts.map((p) => (
          <div key={p.id} className="admin-product-row">
            <img src={productImages(p)[0]} alt="" />
            <span className="admin-product-row__name">{p.name}</span>
            <span>{formatRub(p.price)} ₽</span>
            <span>{productImages(p).length} фото</span>
            <MarketplaceLinks product={p} compact />
            <button type="button" onClick={() => editProduct(p)}>Редактировать</button>
            <button type="button" onClick={() => removeProduct(p)}>Удалить</button>
          </div>
        ))}
      </div>

      <h2>Заказы ({orders.length})</h2>
      <div className="admin-process-list">
        {orders.length === 0 ? <p className="admin-empty">Заказов пока нет.</p> : orders.map((o) => (
          <article key={o.id} className="admin-process-card">
            <div className="admin-process-card__head">
              <div>
                <b>Заказ #{o.id}</b>
                <span>{formatDateTime(o.createdAt)}</span>
              </div>
              <select value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value).catch((err) => alert(err.message))}>
                <option>обрабатывается</option>
                <option>выполнен</option>
                <option>отменён</option>
              </select>
            </div>
            <div className="admin-process-grid">
              <p><b>Клиент:</b> {o.name}</p>
              <p><b>Телефон:</b> <a href={"tel:" + o.phone}>{o.phone}</a></p>
              <p><b>Адрес:</b> {o.address || "не указан"}</p>
              <p><b>Доставка:</b> {o.delivery}</p>
              <p><b>Оплата:</b> {o.payment}</p>
              <p><b>Статус оплаты:</b> {PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus}</p>
              {o.paymentId && <p><b>ID T-Банка:</b> {o.paymentId}</p>}
              {o.cdekNumber && <p><b>Номер СДЭК:</b> {o.cdekNumber}</p>}
              {o.cdekUuid && <p><b>UUID СДЭК:</b> {o.cdekUuid}</p>}
              {o.cdekStatus && <p><b>Статус СДЭК:</b> {o.cdekStatus}</p>}
              <p><b>Итого:</b> {formatRub(o.total)} ₽</p>
            </div>
            {o.items?.length > 0 && (
              <ul className="admin-items">
                {o.items.map((item) => (
                  <li key={item.productId + item.name}>{item.name} × {item.qty} — {formatRub(item.price * item.qty)} ₽</li>
                ))}
              </ul>
            )}
            {String(o.deliveryMethod || "").startsWith("СДЭК") && !o.cdekUuid && (
              <button
                type="button"
                disabled={!commerce.cdekOrderCreationEnabled || (o.paymentMethod === "online" && o.paymentStatus !== "paid")}
                onClick={() => createCdekShipment(o.id).catch((error) => alert(error.message))}
              >
                Создать отправление СДЭК
              </button>
            )}
            {o.cdekUuid && (
              <button
                type="button"
                disabled={!commerce.cdekApiEnabled}
                onClick={() => refreshCdekShipment(o.id).catch((error) => alert(error.message))}
              >
                Обновить статус СДЭК
              </button>
            )}
          </article>
        ))}
      </div>

      <h2>Обратная связь ({messages.length})</h2>
      <div className="admin-process-list">
        {messages.length === 0 ? <p className="admin-empty">Сообщений пока нет.</p> : messages.map((m) => (
          <article key={m.id} className="admin-process-card">
            <div className="admin-process-card__head">
              <div>
                <b>{messageTypeLabel(m.type)} #{m.id}</b>
                <span>{formatDateTime(m.createdAt)}</span>
              </div>
              <select value={m.status} onChange={(e) => updateMessage(m.id, { status: e.target.value, adminNote: m.adminNote }).catch((err) => alert(err.message))}>
                {Object.entries(MESSAGE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="admin-process-grid">
              <p><b>Имя:</b> {m.name}</p>
              <p><b>Телефон:</b> {m.phone ? <a href={"tel:" + m.phone}>{m.phone}</a> : "не указан"}</p>
              <p><b>Email:</b> {m.email ? <a href={"mailto:" + m.email}>{m.email}</a> : "не указан"}</p>
              <p><b>Статус:</b> {MESSAGE_STATUS_LABELS[m.status] || m.status}</p>
            </div>
            <p className="admin-message-text">{m.message}</p>
            {m.payload?.items?.length > 0 && (
              <ul className="admin-items">
                {m.payload.items.map((item) => (
                  <li key={item.id + item.name}>{item.name} × {item.qty} — {formatRub(item.price * item.qty)} ₽</li>
                ))}
              </ul>
            )}
            <textarea
              className="admin-note"
              placeholder="Заметка администратора"
              defaultValue={m.adminNote || ""}
              onBlur={(e) => updateMessage(m.id, { status: m.status, adminNote: e.target.value }).catch((err) => alert(err.message))}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        {ADMIN_ENTRY_ROUTES.map((path) => <Route key={path} path={path} element={<AdminLoginPage />} />)}
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Layout>
  );
}
