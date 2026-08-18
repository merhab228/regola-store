import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  const handles = products.filter((p) => (p.category_id ?? p.categoryId) === 1);
  const catalogHandles = [...handles].sort((a, b) => String(a.name).localeCompare(String(b.name), "ru", { sensitivity: "base" }));

  return (
    <section id="catalog" className="catalog-section catalog-section--first motion-in" aria-labelledby="catalog-heading">
      <PageTitle id="catalog-heading">Каталог</PageTitle>
      {catalogHandles.length === 0 ? <p className="catalog-empty">Каталог скоро будет заполнен.</p> : <ProductGrid products={catalogHandles} />}
    </section>
  );
}

function PageTitle({ id, children, eyebrow }) {
  return (
    <div className="page-title">
      {eyebrow && <p>{eyebrow}</p>}
      <h1 id={id}>{children}</h1>
      <span aria-hidden="true" />
    </div>
  );
}

function PaymentDeliveryPage() {
  return (
    <section className="content-page motion-in" aria-labelledby="payment-heading">
      <PageTitle id="payment-heading" eyebrow="Покупка напрямую у Regola">Оплата и доставка</PageTitle>
      <div className="payment-hero">
        <div className="payment-hero__content">
          <p className="lead">Оплатить и получить — быстро и безопасно. На этой странице собрано всё про способы оплаты, доставку через СДЭК и альтернативные каналы покупки через маркетплейсы.</p>
        </div>
      </div>

      <div className="service-grid">
        <article className="service-card service-card--payment">
          <div className="service-card__icon" aria-hidden="true">₽</div>
          <div><p className="service-card__number">01</p><h2>Безопасная онлайн-оплата</h2></div>
          <p>Оплатите заказ банковской картой на защищённой платёжной форме Т‑Банка. Данные карты не передаются сайту Regola.</p>
        </article>
        <article className="service-card service-card--delivery">
          <div className="service-card__icon" aria-hidden="true">→</div>
          <div><p className="service-card__number">02</p><h2>Доставка СДЭК</h2></div>
          <p>Выберите пункт выдачи или курьерскую доставку до двери. Стоимость и срок рассчитываются при оформлении заказа.</p>
        </article>
      </div>
      <section className="process-section" aria-labelledby="process-heading">
        <h2 id="process-heading">Как проходит заказ</h2>
        <ol className="process-steps">
          <li><b>Добавьте товар</b><span>Выберите модель, цвет и количество.</span></li>
          <li><b>Укажите доставку</b><span>Выберите город, способ доставки и удобный ПВЗ.</span></li>
          <li><b>Оплатите онлайн</b><span>После создания заказа откроется защищённая форма Т‑Банка.</span></li>
          <li><b>Получите заказ</b><span>Мы передадим отправление в СДЭК и сообщим трек‑номер.</span></li>
        </ol>
      </section>
      <section className="marketplace-section" aria-labelledby="marketplace-heading">
        <div>
          <p className="section-kicker">Альтернативный способ покупки</p>
          <h2 id="marketplace-heading">Заказ через маркетплейсы</h2>
          <p>В каждой карточке товара есть прямые ссылки на Wildberries, Ozon и Яндекс Маркет. Выберите удобную площадку и оформите заказ в её приложении.</p>
        </div>
        <div className="marketplace-quick-links">
          <a href="https://www.wildberries.ru/seller/782141" target="_blank" rel="noreferrer">Wildberries <span>↗</span></a>
          <a href="https://www.ozon.ru/seller/torretta/" target="_blank" rel="noreferrer">Ozon <span>↗</span></a>
          <a href="https://market.yandex.ru/business--regola/203997184" target="_blank" rel="noreferrer">Яндекс Маркет <span>↗</span></a>
        </div>
      </section>
      <WholesaleCallout />
    </section>
  );
}

function AboutPage() {
  return (
    <section className="content-page motion-in" aria-labelledby="about-heading">
      <PageTitle id="about-heading" eyebrow="Эстетика в каждой детали">Цель компании</PageTitle>
      <div className="about-story">
        <div className="about-story__lead">
          <p>Regola создана для тех, кто ценит сочетание эстетики и функциональности в каждой детали интерьера.</p>
        </div>
        <div className="about-story__body">
          <p>Мы специализируемся на дверных ручках для межкомнатных дверей. Производство расположено в Китае на площадках с современным высокотехнологичным оборудованием.</p>
          <p>Это позволяет внедрять инженерные решения, обеспечивать высокую точность изготовления и контролировать качество на каждом этапе производства.</p>
          <p>Мы тщательно подбираем материалы, тестируем образцы и проверяем каждую модель перед отправкой. Наша цель — предложить фурнитуру, которая сохраняет внешний вид и исправно служит долгие годы.</p>
        </div>
      </div>
      <div className="values-grid">
        <article><span>01</span><h2>Продуманный дизайн</h2><p>Лаконичные формы и актуальные покрытия для современных интерьеров.</p></article>
        <article><span>02</span><h2>Контроль качества</h2><p>Многоступенчатая проверка материалов, механизмов и комплектации.</p></article>
        <article><span>03</span><h2>Прямая связь</h2><p>Консультация до покупки и поддержка после получения заказа.</p></article>
      </div>
    </section>
  );
}

function GuaranteesPage() {
  return (
    <section className="content-page motion-in" aria-labelledby="guarantees-heading">
      <PageTitle id="guarantees-heading" eyebrow="Уверенность в выборе">Гарантии</PageTitle>
      <div className="guarantee-hero">
        <div className="guarantee-seal" aria-hidden="true"><b>1</b><span>год гарантии</span></div>
        <div>
          <h2>Гарантия качества Regola</h2>
          <p>На продукцию Regola действует гарантия сроком один год. Перед продажей мы проверяем внешний вид, механизм и комплектацию каждой модели.</p>
          <p>Если возникнет вопрос по заказу, установке или эксплуатации, напишите нам — мы разберём обращение и предложим решение.</p>
        </div>
      </div>
      <div className="guarantee-steps">
        <article><b>01</b><h3>Сохраните заказ</h3><p>Номер заказа или подтверждение покупки поможет быстрее найти информацию.</p></article>
        <article><b>02</b><h3>Опишите ситуацию</h3><p>Приложите фотографии или видео и укажите, когда обнаружили проблему.</p></article>
        <article><b>03</b><h3>Получите решение</h3><p>Мы проверим обращение и согласуем замену, комплектующую или иной вариант.</p></article>
      </div>
    </section>
  );
}

function ContactsPage() {
  return (
    <section className="content-page motion-in" aria-labelledby="contacts-heading">
      <PageTitle id="contacts-heading" eyebrow="Мы на связи">Контакты</PageTitle>
      <div className="contact-page-grid">
        <div className="contact-panel">
          <h2>Интернет-магазин дверных ручек</h2>
          <p>г. Санкт-Петербург, проспект Героев, д. 26</p>
          <p>Напишите нам в удобном мессенджере — ответим по товару, доставке, гарантии или оптовому заказу.</p>
          <div className="contact-icon-links">
            <a href="https://t.me/" target="_blank" rel="noreferrer" aria-label="Telegram">TG</a>
            <a href="https://max.ru/" target="_blank" rel="noreferrer" aria-label="MAX">MAX</a>
            <a href="https://wa.me/79829412000" target="_blank" rel="noreferrer" aria-label="WhatsApp">WA</a>
          </div>
        </div>
        <QuestionSection />
      </div>
      <WholesaleCallout />
    </section>
  );
}

function WholesaleCallout() {
  return (
    <section id="wholesale" className="wholesale-callout">
      <div><p className="section-kicker">Для бизнеса</p><h2>Оптовые заказы и покупка для юридических лиц</h2><p>Напишите нам список товаров и реквизиты организации. Менеджер уточнит условия и выставит счёт для безналичной оплаты.</p></div>
      <Link className="btn btn--light" to="/contacts">Обсудить оптовый заказ</Link>
    </section>
  );
}

function ProductGrid({ products }) {
  return (
    <div className="grid">
      {products.map((p) => (
        <article key={p.id} className="card">
          <Link className="card__image-link" to={"/product/" + p.id}><img src={productImages(p)[0]} alt={p.name} /></Link>
          <h3 className="card__title"><Link to={"/product/" + p.id}>{p.name}</Link></h3>
          <PriceBlock product={p} />
          <MarketplaceLinks product={p} compact={true} />
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

function DetailList({ text }) {
  const items = String(text || "").split(/\r?\n/).map((item) => item.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  if (!items.length) return null;
  return <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function ProductPage() {
  const { id } = useParams();
  const { products, addToCart } = useStore();
  const product = products.find((p) => p.id === Number(id));
  const images = useMemo(() => productImages(product || {}), [product]);
  const [activeImage, setActiveImage] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    setActiveImage(images[0] || "");
    setZoomOpen(false);
    setAdded(false);
  }, [images]);

  useEffect(() => {
    if (!zoomOpen) return undefined;
    const close = (event) => { if (event.key === "Escape") setZoomOpen(false); };
    document.addEventListener("keydown", close);
    document.body.classList.add("modal-open");
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("modal-open"); };
  }, [zoomOpen]);

  if (!product) return <p>Товар не найден.</p>;
  const colors = Array.isArray(product.colors) ? product.colors : [];
  const related = products
    .filter((item) => item.id !== product.id && (item.categoryId ?? item.category_id) === (product.categoryId ?? product.category_id))
    .slice(0, 4);
  return (
    <>
      <nav className="breadcrumbs" aria-label="Хлебные крошки"><Link to="/">Каталог</Link><span>/</span><span>{product.name}</span></nav>
      <section className="product">
        <div className="product-gallery">
          <button className="product-gallery__zoom" type="button" onClick={() => setZoomOpen(true)} aria-label="Увеличить изображение">
            <img className="product-gallery__main" src={activeImage || images[0]} alt={product.name} />
            <span aria-hidden="true">Увеличить ↗</span>
          </button>
          {images.length > 1 && (
            <div className="product-gallery__thumbs" aria-label="Фотографии товара">
              {images.map((src, index) => (
                <button key={src + index} type="button" className={src === activeImage ? "is-active" : ""} onClick={() => setActiveImage(src)} aria-label={`Показать фото ${index + 1}`}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
          {product.videoUrl && (
            <div className="product-video">
              {/\.(mp4|webm|ogg|ogv|mov)(\?.*)?$/i.test(product.videoUrl) || String(product.videoUrl).startsWith("data:video/")
                ? <video src={product.videoUrl} controls preload="metadata" />
                : <iframe src={product.videoUrl} title={`Видео ${product.name}`} loading="lazy" allowFullScreen />}
            </div>
          )}
        </div>
        <div className="product-info">
          <p className="product-info__eyebrow">Дверная фурнитура Regola</p>
          <h1>{product.name}</h1>
          <PriceBlock product={product} large />
          {colors.length > 0 && (
            <div className="product-colors"><b>Доступные цвета</b><div>{colors.map((color) => <span key={color}>{color}</span>)}</div></div>
          )}
          <div className="product-buy">
            <QuantityPicker value={qty} onChange={setQty} />
            <button className="btn btn--buy" type="button" onClick={() => { addToCart(product, qty); setAdded(true); }}>Добавить в корзину</button>
          </div>
          {added && (
            <div className="cart-success" role="status"><span>Товар добавлен в корзину</span><Link to="/cart">Перейти к оформлению</Link></div>
          )}
          <div className="product-assurance">
            <span><b>Онлайн-оплата</b>Защищённая форма Т‑Банка</span>
            <span><b>Доставка</b>СДЭК до ПВЗ или курьером</span>
            <span><b>Гарантия</b>1 год на продукцию Regola</span>
          </div>
          <MarketplaceLinks product={product} compact={true} />
        </div>
      </section>

      <section className="product-details" aria-label="Информация о товаре">
        <article className="product-detail product-detail--wide"><h2>Описание</h2><DescriptionText text={product.description} /></article>
        {product.specifications && <article className="product-detail"><h2>Характеристики</h2><DetailList text={product.specifications} /></article>}
        {product.packageContents && <article className="product-detail"><h2>Комплектация</h2><DetailList text={product.packageContents} /></article>}
        <article className="product-detail"><h2>Доставка и гарантия</h2><p>Доставка выполняется службой СДЭК до пункта выдачи или курьером. Срок и стоимость рассчитываются при оформлении. Гарантия на товар — 1 год.</p></article>
      </section>

      {related.length > 0 && (
        <section className="related-products" aria-labelledby="related-heading">
          <PageTitle id="related-heading">Похожие товары</PageTitle>
          <ProductGrid products={related} />
        </section>
      )}

      {zoomOpen && (
        <div className="image-modal" role="dialog" aria-modal="true" aria-label="Увеличенное изображение" onClick={() => setZoomOpen(false)}>
          <button type="button" onClick={() => setZoomOpen(false)} aria-label="Закрыть">×</button>
          <img src={activeImage || images[0]} alt={product.name} onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </>
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
    paymentMethod: "online",
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
    if (paymentResult !== "success") return;
    clearCart();
    sessionStorage.removeItem("regola_pending_order");
  }, [paymentResult]);

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
        paymentMethod: "online",
        items: cartItems.map((item) => ({ productId: item.id, qty: item.qty })),
      });
      if (order.paymentUrl) {
        setStatus("Переходим на защищённую платёжную форму T-Банка...");
        sessionStorage.setItem("regola_pending_order", String(order.id));
        window.location.assign(order.paymentUrl);
        return;
      }
      if (order.paymentMethod === "online") {
        setStatus(`Заказ №${order.id} создан, но платёжная форма T-Банка не открылась. ${order.paymentError || "Мы свяжемся с вами для завершения оплаты."}`);
        return;
      }
      setStatus(`Заказ №${order.id} создан, но платёжная форма не открылась. Попробуйте ещё раз или напишите нам.`);
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
            <p>После проверки данных откроется защищённая платёжная форма Т‑Банка. Для оптовой покупки или счёта на юридическое лицо <Link to="/contacts">напишите нам</Link>.</p>
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
            <div className={commerce.tbankEnabled ? "payment-choice is-ready" : "payment-choice"}>
              <span aria-hidden="true">✓</span>
              <div><b>Онлайн-оплата через Т‑Банк</b><small>{commerce.tbankLive ? "Боевой терминал · защищённое соединение" : commerce.tbankEnabled ? "Тестовый терминал · реальные списания отключены" : "Временно недоступна"}</small></div>
            </div>
            <button type="button" onClick={estimateDelivery}>Рассчитать доставку СДЭК</button>
            {deliveryEstimate && (
              <p className="delivery-estimate">
                {deliveryEstimate.tariff}: {formatRub(deliveryEstimate.deliveryPrice)} ₽, {deliveryEstimate.minDays}–{deliveryEstimate.maxDays} дн.
                <br />{deliveryEstimate.notice}
              </p>
            )}
            <textarea placeholder="Комментарий к заказу" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            <button className="btn btn--checkout" type="submit" disabled={isSubmitting || !commerce.tbankEnabled}>{isSubmitting ? "Создаём платёж…" : `Перейти к оплате · ${formatRub(orderTotal)} ₽`}</button>
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
    specifications: p.specifications || "",
    packageContents: p.packageContents ?? p.package_contents ?? "",
    colorsText: Array.isArray(p.colors) ? p.colors.join("\n") : "",
    images: productImages(p),
    imageUrl: "",
    videoUrl: p.videoUrl ?? p.video_url ?? "",
    ozonUrl: p.ozonUrl ?? p.ozon_url ?? "",
    wbUrl: p.wbUrl ?? p.wb_url ?? "",
    ymUrl: p.ymUrl ?? p.ym_url ?? "",
  };
}

const EMPTY_ADMIN_FORM = { id: null, name: "", price: "", categoryId: 1, description: "", specifications: "", packageContents: "", colorsText: "", images: [], imageUrl: "", videoUrl: "", ozonUrl: "", wbUrl: "", ymUrl: "" };

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

function AdminPage() {
  const { user, isAdminSessionValid, products, categories, upsertProduct, uploadMedia, deleteProduct, orders, messages, updateOrderStatus, updateMessage, createCdekShipment, refreshCdekShipment, commerce } = useStore();
  const [form, setForm] = useState(EMPTY_ADMIN_FORM);
  const [adminQuery, setAdminQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
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

  const addImages = (items) => setForm((prev) => ({ ...prev, images: [...new Set([...prev.images, ...items])].slice(0, 12) }));
  const uploadImages = async (files) => {
    const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    if (imageFiles.some((file) => file.size > 12 * 1024 * 1024)) return alert("Каждое фото должно быть не больше 12 МБ");
    setIsUploadingImages(true);
    try {
      const urls = await Promise.all(imageFiles.slice(0, 12).map((file) => uploadMedia(file)));
      addImages(urls);
      setStatusText(`Загружено фото: ${urls.length}. Сохраните товар, чтобы применить изменения.`);
    } catch (error) {
      alert(error.message || "Не удалось загрузить изображения");
    } finally {
      setIsUploadingImages(false);
    }
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
  const uploadVideo = async (files) => {
    const file = Array.from(files || []).find((item) => item.type.startsWith("video/"));
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) return alert("Видео должно быть не больше 30 МБ");
    setIsUploadingVideo(true);
    try {
      const url = await uploadMedia(file);
      setForm((prev) => ({ ...prev, videoUrl: url }));
      setStatusText("Видео загружено. Сохраните товар, чтобы применить изменения.");
    } catch (error) {
      alert(error.message);
    } finally {
      setIsUploadingVideo(false);
    }
  };
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
        colors: form.colorsText.split(/\r?\n|,|;/).map((item) => item.trim()).filter(Boolean),
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

      <div className="admin-commerce-status" aria-label="Состояние интеграций">
        <span className={commerce.tbankLive ? "is-ok" : "is-warning"}>Т‑Банк: {commerce.tbankLive ? "боевой режим" : commerce.tbankEnabled ? "тестовый режим" : "не настроен"}</span>
        <span className={commerce.cdekApiEnabled ? "is-ok" : "is-warning"}>СДЭК API: {commerce.cdekApiEnabled ? "подключён" : "не настроен"}</span>
        <span className={commerce.cdekOrderCreationEnabled ? "is-ok" : "is-warning"}>Отправления: {commerce.cdekOrderCreationEnabled ? "можно создавать" : "нужен ПВЗ отправителя"}</span>
        <span className={commerce.addressSuggestionsEnabled ? "is-ok" : "is-warning"}>Адреса: {commerce.addressSuggestionsEnabled ? "подключены" : "не настроены"}</span>
      </div>

      {statusText && <p className="admin-status">{statusText}</p>}

      <h2>{form.id ? "Редактирование товара" : "Новый товар"}</h2>
      <form className="form admin-form" onSubmit={submit}>
        <input required placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required type="number" min="1" step="1" placeholder="Цена, ₽" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <textarea required rows="9" placeholder={"Описание. Можно писать абзацы и списки:\n\nПервый абзац\n\n- пункт\n- пункт"} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="admin-product-fields">
          <label><b>Характеристики</b><textarea rows="6" placeholder={"Каждая характеристика с новой строки:\nМатериал — алюминиевый сплав\nТип механизма — защёлка"} value={form.specifications} onChange={(e) => setForm({ ...form, specifications: e.target.value })} /></label>
          <label><b>Комплектация</b><textarea rows="6" placeholder={"Каждый элемент с новой строки:\nРучка — 2 шт.\nКрепёжный комплект\nИнструкция"} value={form.packageContents} onChange={(e) => setForm({ ...form, packageContents: e.target.value })} /></label>
        </div>
        <label className="admin-fieldset"><b>Доступные цвета</b><textarea rows="4" placeholder={"Один цвет с новой строки:\nЧёрный матовый\nХром\nБелый"} value={form.colorsText} onChange={(e) => setForm({ ...form, colorsText: e.target.value })} /></label>

        <div className="admin-fieldset">
          <b>Фото товара</b>
          <p className="form-hint">Можно добавить несколько фото с устройства или по URL. Первое фото будет главным.</p>
          <div className="admin-inline">
            <input placeholder="URL изображения" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            <button type="button" onClick={addImageUrl}>Добавить URL</button>
          </div>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => uploadImages(e.target.files)} disabled={isUploadingImages} />
          {isUploadingImages && <p className="form-hint">Загружаем фотографии…</p>}
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
          <p className="form-hint">Загрузите MP4, WebM, OGG или MOV до 30 МБ либо вставьте ссылку.</p>
          <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" onChange={(e) => uploadVideo(e.target.files)} disabled={isUploadingVideo} />
          {isUploadingVideo && <p className="form-hint">Загружаем видео…</p>}
          <input type="text" inputMode="url" placeholder="Или ссылка на видео" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
          {form.videoUrl && <button type="button" onClick={() => setForm({ ...form, videoUrl: "" })}>Удалить видео</button>}
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
        <Route path="/payment" element={<PaymentDeliveryPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/guarantees" element={<GuaranteesPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        {ADMIN_ENTRY_ROUTES.map((path) => <Route key={path} path={path} element={<AdminLoginPage />} />)}
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Layout>
  );
}
