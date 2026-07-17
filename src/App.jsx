import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
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
      <p className="price-block__value"><span>от</span><b>{formatRub(product.price)} ₽</b></p>
    </div>
  );
}

function MarketplaceLinks({ product }) {
  const links = [
    ["Wildberries", product.wbUrl ?? product.wb_url],
    ["Ozon", product.ozonUrl ?? product.ozon_url],
    ["Яндекс Маркет", product.ymUrl ?? product.ym_url],
  ].filter(([, url]) => url);

  if (!links.length) return null;
  return (
    <div className="market-links">
      {links.map(([label, url]) => (
        <a key={label} href={url} target="_blank" rel="noreferrer">{label}</a>
      ))}
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
          <div className="info-card"><h3>1. Выберите ручку</h3><p>Откройте карточку товара в каталоге и сравните предложения на маркетплейсах.</p></div>
          <div className="info-card"><h3>2. Перейдите на площадку</h3><p>Нажмите Wildberries, Ozon или Яндекс Маркет в карточке товара.</p></div>
          <div className="info-card"><h3>3. Оформите покупку</h3><p>Завершите заказ на выбранном маркетплейсе или свяжитесь с нами по телефону.</p></div>
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
          <img src={productImages(p)[0]} alt={p.name} />
          <h3>{p.name}</h3>
          <PriceBlock product={p} />
          <MarketplaceLinks product={p} />
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
  const images = useMemo(() => productImages(product || {}), [product]);
  const [activeImage, setActiveImage] = useState("");

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
      </div>
      <div>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <PriceBlock product={product} large />
        <MarketplaceLinks product={product} />
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
    images: productImages(p),
    imageUrl: "",
    ozonUrl: p.ozonUrl ?? p.ozon_url ?? "",
    wbUrl: p.wbUrl ?? p.wb_url ?? "",
    ymUrl: p.ymUrl ?? p.ym_url ?? "",
  };
}

const EMPTY_ADMIN_FORM = { id: null, name: "", price: "", categoryId: 1, description: "", images: [], imageUrl: "", ozonUrl: "", wbUrl: "", ymUrl: "" };

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
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function AdminPage() {
  const { user, isAdminSessionValid, products, categories, upsertProduct, deleteProduct, orders, updateOrderStatus } = useStore();
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

  const addImages = (items) => {
    setForm((prev) => ({ ...prev, images: [...new Set([...prev.images, ...items])].slice(0, 12) }));
  };

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

  const removeImage = (src) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((item) => item !== src) }));
  };

  const moveImage = (index, direction) => {
    setForm((prev) => {
      const next = [...prev.images];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, images: next };
    });
  };

  const makeMainImage = (src) => {
    setForm((prev) => ({ ...prev, images: [src, ...prev.images.filter((item) => item !== src)] }));
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
    if (!form.images.length) {
      alert("Добавьте хотя бы одно фото товара");
      return;
    }
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
          <p>Быстрое управление каталогом Regola: товары, фото, цены и ссылки на маркетплейсы.</p>
        </div>
        <div className="admin-stats">
          <span><b>{products.length}</b> товаров</span>
          <span><b>{products.filter((p) => productImages(p).length > 1).length}</b> с галереей</span>
          <span><b>{products.filter((p) => (p.wbUrl || p.ozonUrl || p.ymUrl || p.wb_url || p.ozon_url || p.ym_url)).length}</b> со ссылками</span>
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
        <input required type="number" min="0" placeholder="Цена от, ₽" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <textarea required placeholder="Описание" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

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
            <span>от {formatRub(p.price)} ₽</span>
            <span>{productImages(p).length} фото</span>
            <MarketplaceLinks product={p} />
            <button type="button" onClick={() => editProduct(p)}>Редактировать</button>
            <button type="button" onClick={() => removeProduct(p)}>Удалить</button>
          </div>
        ))}
      </div>

      {orders.length > 0 && (
        <>
          <h2>Заказы</h2>
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
      )}
    </section>
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
