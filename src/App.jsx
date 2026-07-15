import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
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

function marketplaceRows(product) {
  return [
    { source: "Wildberries", price: product.wbPrice ?? product.wb_price, url: product.wbUrl ?? product.wb_url },
    { source: "Ozon", price: product.ozonPrice ?? product.ozon_price, url: product.ozonUrl ?? product.ozon_url },
    { source: "Яндекс Маркет", price: product.ymPrice ?? product.ym_price, url: product.ymUrl ?? product.ym_url },
  ];
}

function PriceBlock({ product, large = false }) {
  const rows = marketplaceRows(product);
  const hasMarketPrices = rows.some((item) => Number(item.price) > 0);

  return (
    <div className={"price-block" + (large ? " price-block--large" : "")}>
      {hasMarketPrices ? (
        <div className="market-price-list">
          {rows.map((item) => {
            const disabled = !Number(item.price);
            const content = (
              <>
                <span>{item.source}</span>
                <b>{disabled ? "—" : `${formatRub(item.price)} ₽`}</b>
              </>
            );
            return item.url ? (
              <a
                key={item.source}
                className={"market-price" + (disabled ? " market-price--empty" : "")}
                href={item.url}
                target="_blank"
                rel="noreferrer"
              >
                {content}
              </a>
            ) : (
              <div key={item.source} className={"market-price" + (disabled ? " market-price--empty" : "")}>
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="price-block__value">
          <b>{formatRub(product.price)} ₽</b>
        </p>
      )}
    </div>
  );
}

function HomePage() {
  const { products } = useStore();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const handles = products.filter((p) => (p.category_id ?? p.categoryId) === 1);
  const catalogHandles = [...handles].sort((a, b) => String(a.name).localeCompare(String(b.name), "ru", { sensitivity: "base" }));
  const normalizedQuery = query.trim().toLowerCase();
  const visibleHandles = normalizedQuery
    ? catalogHandles.filter((p) => [p.name, p.description].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery)))
    : catalogHandles;

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    return () => clearTimeout(t);
  }, [location.hash, location.pathname]);

  return (
    <>
      <section id="catalog" className="catalog-section catalog-section--first motion-in" aria-labelledby="catalog-heading">
        <div className="catalog-head">
          <label className="catalog-search">
            <span>Поиск по товарам</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название или описание" />
          </label>
          <div>
            <h1 id="catalog-heading">Каталог</h1>
            <p className="catalog-lead">Выберите модель и перейдите в карточку товара.</p>
          </div>
        </div>
        {visibleHandles.length === 0 ? <p className="catalog-empty">По вашему запросу ничего не найдено.</p> : <ProductGrid products={visibleHandles} />}
      </section>

      <section id="home" className="hero motion-in motion-in--delay-1">
        <h2>Главная</h2>
        <p>Добро пожаловать в Regola — бренд стильных и надёжных дверных ручек!</p>
        <p>Предлагаем элегантную фурнитуру для межкомнатных дверей.</p>
        <p>Выбирайте качество и дизайн, который подчеркнёт индивидуальность вашего интерьера!</p>
        <ul className="feature-list">
          <li>Неповторимый стиль</li>
          <li>Постоянное обновление ассортимента</li>
          <li>Высокое качество</li>
          <li>Приятные цены</li>
        </ul>
      </section>

      <section id="order" className="info-section motion-in motion-in--delay-2" aria-labelledby="order-heading">
        <h2 id="order-heading">Как оформить заказ</h2>
        <div className="info-grid info-grid--triple">
          <div className="info-card">
            <h3>1. Выберите ручку</h3>
            <p>Откройте карточку товара в каталоге и сравните цены на маркетплейсах.</p>
          </div>
          <div className="info-card">
            <h3>2. Перейдите на площадку</h3>
            <p>Нажмите Wildberries, Ozon или Яндекс Маркет в карточке товара.</p>
          </div>
          <div className="info-card">
            <h3>3. Оформите покупку</h3>
            <p>Завершите заказ на выбранном маркетплейсе или свяжитесь с нами по телефону.</p>
          </div>
        </div>
      </section>

      <section id="about" className="info-section motion-in motion-in--delay-3" aria-labelledby="about-heading">
        <h2 id="about-heading">О компании Regola: качество, проверенное технологиями</h2>
        <p>Бренд Regola создан для тех, кто ценит сочетание эстетики и функциональности в каждой детали интерьера. Мы специализируемся на производстве дверных ручек для межкомнатных дверей.</p>
        <p>Наше производство расположено в Китае — на площадках с высокотехнологичным оборудованием. Это позволяет нам:</p>
        <ul className="feature-list">
          <li>внедрять передовые инженерные решения;</li>
          <li>обеспечивать высокую точность изготовления деталей;</li>
          <li>контролировать качество на каждом этапе производства.</li>
        </ul>
        <p>Мы тщательно подбираем материалы, тестируем образцы и следим за соответствием продукции международным стандартам. Каждая дверная ручка Regola проходит многоступенчатую проверку перед отправкой.</p>
        <p><b>Доверьтесь опыту Regola — выберите фурнитуру, которая прослужит долгие годы!</b></p>
      </section>

      <section id="guarantees" className="info-section motion-in motion-in--delay-4" aria-labelledby="guarantees-heading">
        <h2 id="guarantees-heading">Гарантии</h2>
        <div className="info-grid info-grid--triple">
          <div className="info-card"><h3>Качество</h3><p>Работаем с проверенными материалами и контролируем каждую позицию в каталоге.</p></div>
          <div className="info-card"><h3>Срок службы</h3><p>При правильном монтаже ручки сохраняют внешний вид и надёжную механику на долгие годы.</p></div>
          <div className="info-card"><h3>Поддержка</h3><p>Если возник вопрос по заказу или комплектации — напишите нам или позвоните.</p></div>
        </div>
      </section>
    </>
  );
}

function ProductGrid({ products }) {
  return (
    <div className="grid">
      {products.map((p) => (
        <article key={p.id} className="card">
          <img src={p.image} alt={p.name} />
          <h3>{p.name}</h3>
          <PriceBlock product={p} />
          <a className="btn-outline" href={"/product/" + p.id}>Подробнее</a>
        </article>
      ))}
    </div>
  );
}

function ProductPage() {
  const { id } = useParams();
  const { products } = useStore();
  const product = products.find((p) => p.id === Number(id));
  if (!product) return <p>Товар не найден.</p>;
  return (
    <section className="product">
      <img src={product.image} alt={product.name} />
      <div>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <PriceBlock product={product} large />
        <p>Наличие: {product.stock} шт.</p>
        <div className="market-links">
          {(product.wbUrl || product.wb_url) && <a href={product.wbUrl || product.wb_url} target="_blank" rel="noreferrer">Wildberries</a>}
          {(product.ozonUrl || product.ozon_url) && <a href={product.ozonUrl || product.ozon_url} target="_blank" rel="noreferrer">Ozon</a>}
          {(product.ymUrl || product.ym_url) && <a href={product.ymUrl || product.ym_url} target="_blank" rel="noreferrer">Яндекс Маркет</a>}
        </div>
      </div>
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
    image: p.image,
    stock: p.stock,
    ozonUrl: p.ozonUrl ?? p.ozon_url ?? "",
    wbUrl: p.wbUrl ?? p.wb_url ?? "",
    ymUrl: p.ymUrl ?? p.ym_url ?? "",
    wbPrice: p.wbPrice ?? p.wb_price ?? "",
    ozonPrice: p.ozonPrice ?? p.ozon_price ?? "",
    ymPrice: p.ymPrice ?? p.ym_price ?? "",
  };
}

const EMPTY_ADMIN_FORM = { id: null, name: "", price: "", categoryId: 1, description: "", image: "", stock: 0, ozonUrl: "", wbUrl: "", ymUrl: "", wbPrice: "", ozonPrice: "", ymPrice: "" };

function AdminPage() {
  const { user, isAdminSessionValid, products, categories, upsertProduct, deleteProduct, orders, updateOrderStatus } = useStore();
  const [form, setForm] = useState(EMPTY_ADMIN_FORM);
  if (!user?.isAdmin || !isAdminSessionValid) return <Navigate to={ADMIN_ENTRY_PRIMARY} replace />;

  const uploadImage = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Выберите файл изображения");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, image: String(reader.result || "") }));
    reader.onerror = () => alert("Не удалось загрузить изображение");
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await upsertProduct({
        ...form,
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        categoryId: Number(form.categoryId),
        wbPrice: Number(form.wbPrice) || null,
        ozonPrice: Number(form.ozonPrice) || null,
        ymPrice: Number(form.ymPrice) || null,
      });
      setForm(EMPTY_ADMIN_FORM);
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <>
      <h1>Админ-панель</h1>
      <h2>Управление товарами</h2>
      <form className="form" onSubmit={submit}>
        <input required placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input type="number" min="0" placeholder="Основная цена, ₽" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <input type="url" placeholder="Ссылка Wildberries" value={form.wbUrl} onChange={(e) => setForm({ ...form, wbUrl: e.target.value })} />
        <input type="url" placeholder="Ссылка Ozon" value={form.ozonUrl} onChange={(e) => setForm({ ...form, ozonUrl: e.target.value })} />
        <input type="url" placeholder="Ссылка Яндекс Маркета" value={form.ymUrl} onChange={(e) => setForm({ ...form, ymUrl: e.target.value })} />
        <p className="form-hint">Цены указываются вручную. Если цена площадки не нужна — оставьте поле пустым.</p>
        <input type="number" min="0" placeholder="Цена Wildberries, ₽" value={form.wbPrice} onChange={(e) => setForm({ ...form, wbPrice: e.target.value })} />
        <input type="number" min="0" placeholder="Цена Ozon, ₽" value={form.ozonPrice} onChange={(e) => setForm({ ...form, ozonPrice: e.target.value })} />
        <input type="number" min="0" placeholder="Цена Яндекс Маркета, ₽" value={form.ymPrice} onChange={(e) => setForm({ ...form, ymPrice: e.target.value })} />
        <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <label className="image-upload">
          <span>Изображение товара</span>
          <input required placeholder="URL изображения" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
          <input type="file" accept="image/*" onChange={(e) => uploadImage(e.target.files?.[0])} />
        </label>
        {form.image && <img className="admin-image-preview" src={form.image} alt="Предпросмотр товара" />}
        <input required type="number" min="0" placeholder="Остаток" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
        <textarea required placeholder="Описание" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="btn" type="submit">{form.id ? "Сохранить" : "Добавить товар"}</button>
      </form>

      <div className="admin-list">
        {products.map((p) => (
          <div key={p.id} className="admin-product-row">
            <span className="admin-product-row__name">{p.name}</span>
            <span>{formatRub(p.price)} ₽</span>
            <button type="button" onClick={() => setForm(productToAdminForm(p))}>Редактировать</button>
            <button type="button" onClick={() => deleteProduct(p.id).catch((e) => alert(e.message))}>Удалить</button>
          </div>
        ))}
      </div>

      <h2>Управление заказами</h2>
      {orders.map((o) => (
        <div key={o.id} className="order">
          <b>#{o.id}</b> — {o.name} — {o.status}
          <select value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value).catch((err) => alert(err.message))}>
            <option>обрабатывается</option>
            <option>выполнен</option>
            <option>отменен</option>
          </select>
        </div>
      ))}
    </>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        {ADMIN_ENTRY_ROUTES.map((path) => <Route key={path} path={path} element={<AdminLoginPage />} />)}
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Layout>
  );
}
