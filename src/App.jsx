import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import Layout from "./components/Layout";
import { useStore } from "./context/StoreContext";
import { useEffect, useState } from "react";

/** Основной URL входа в админку; без .env совпадает с .env.example */
const ADMIN_ENTRY_PRIMARY =
  import.meta.env.VITE_ADMIN_PATH || "/_secure-admin-7f29A228lswP";
/** Прежний путь — остаётся маршрутом для старых закладок */
const ADMIN_ENTRY_LEGACY = "/_secure-admin-7f29a";

const ADMIN_ENTRY_ROUTES = [
  ...new Set(
    [ADMIN_ENTRY_PRIMARY, ADMIN_ENTRY_LEGACY].filter(
      (p) => typeof p === "string" && p.startsWith("/")
    )
  ),
];

function formatRub(value) {
  return Number(value).toLocaleString("ru-RU");
}

function formatSyncedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function priceTrend(product) {
  const prev = product.pricePrevious ?? product.price_previous;
  if (prev == null || prev === product.price) return null;
  return product.price < prev ? "down" : "up";
}

function PriceBlock({ product, large = false }) {
  const trend = priceTrend(product);
  const prev = product.pricePrevious ?? product.price_previous;
  const synced = formatSyncedAt(product.wbSyncedAt ?? product.wb_synced_at);
  const tracking = product.wbPriceTracking;
  const syncError = product.wbSyncError ?? product.wb_sync_error;

  return (
    <div className={`price-block${large ? " price-block--large" : ""}`}>
      <p className="price-block__value">
        <b>{formatRub(product.price)} ₽</b>
        {trend === "down" && <span className="price-trend price-trend--down" title="Цена снизилась">↓</span>}
        {trend === "up" && <span className="price-trend price-trend--up" title="Цена выросла">↑</span>}
      </p>
      {tracking && (
        <p className="price-block__wb">
          <span className="wb-badge">Цена с Wildberries</span>
          {synced && <span className="price-block__sync">обновлено {synced}</span>}
        </p>
      )}
      {trend && prev != null && (
        <p className="price-block__prev">Было: {formatRub(prev)} ₽</p>
      )}
      {tracking && syncError && <p className="price-block__error">{syncError}</p>}
    </div>
  );
}

function HomePage() {
  const { products } = useStore();
  const location = useLocation();
  const handles = products.filter((p) => (p.category_id ?? p.categoryId) === 1);
  const catalogHandles = [...handles].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), "ru", { sensitivity: "base" })
  );

  useEffect(() => {
    if (location.hash !== "#about") return;
    const el = document.getElementById("about");
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(t);
  }, [location.hash, location.pathname]);

  return (
    <>
      <section className="hero motion-in">
        <h1>Regola - дверные ручки</h1>
        <p>Добро пожаловать в Regola — бренд стильных и надёжных дверных ручек!
Предлагаем элегантную фурнитуру для межкомнатных дверей. 
</p>
<p>Выбирайте качество и дизайн, который подчеркнёт индивидуальность вашего интерьера!</p>
      </section>
      <section className="promo-strip motion-in motion-in--delay-1">
        <div className="promo-box">Наличие на складе</div>
        <div className="promo-box">Доставка по РФ</div>
        <div className="promo-box">Гарантия качества</div>
      </section>
      <section id="about" className="about-section motion-in motion-in--delay-2" aria-labelledby="about-heading">
        <h2 id="about-heading">Кто мы</h2>
        <div className="about-grid">
          <div className="about-card">
            <h3>О нас</h3>
            <p>
              Regola — специализированный магазин дверной фурнитуры. Мы отбираем ручки и комплектующие по качеству
              материалов и эргономике, чтобы каждая деталь интерьера служила долго и выглядела выразительно.
            </p>
          </div>
          <div className="about-card">
            <h3>Как работаем</h3>
            <p>
              Заказ оформляется на маркетплейсах, доставка по России, на складе поддерживаем актуальные остатки. Если нужна
              консультация по модели или монтажу — напишите нам в соцсетях или мессенджерах, ответим в рабочее время.
            </p>
          </div>
        </div>
      </section>
      <section id="catalog" className="catalog-section motion-in motion-in--delay-3" aria-labelledby="catalog-heading">
        <h2 id="catalog-heading">Каталог</h2>
        <p className="catalog-lead">Все дверные ручки в одном разделе — выберите модель и перейдите к карточке товара.</p>
        {catalogHandles.length === 0 ? (
          <p className="catalog-empty">Сейчас в каталоге нет позиций. Зайдите позже или обновите страницу.</p>
        ) : (
          <ProductGrid products={catalogHandles} />
        )}
      </section>
      <section id="delivery" className="info-section motion-in motion-in--delay-3" aria-labelledby="delivery-heading">
        <h2 id="delivery-heading">Доставка и оплата</h2>
        <div className="info-grid">
          <div className="info-card">
            <h3>Доставка</h3>
            <p>
              Отправляем заказы по всей России. Сроки и стоимость зависят от региона и выбранного способа — курьер до двери
              или пункт выдачи. Точные условия уточняйте при оформлении заказа или у менеджера в мессенджере.
            </p>
          </div>
          <div className="info-card">
            <h3>Оплата</h3>
            <p>
              Доступны оплата при получении и безналичный расчёт. На сайте вы выбираете удобный вариант на этапе оформления;
              для юридических лиц возможны отдельные условия по запросу.
            </p>
          </div>
        </div>
      </section>
      <section id="guarantees" className="info-section motion-in motion-in--delay-3" aria-labelledby="guarantees-heading">
        <h2 id="guarantees-heading">Гарантии</h2>
        <div className="info-grid info-grid--triple">
          <div className="info-card">
            <h3>Качество</h3>
            <p>Работаем только с проверенными материалами и фурнитурой; каждая позиция в каталоге соответствует заявленным характеристикам.</p>
          </div>
          <div className="info-card">
            <h3>Срок службы</h3>
            <p>При правильном монтаже и эксплуатации ручки сохраняют внешний вид и механику на весь заявленный производителем ресурс.</p>
          </div>
          <div className="info-card">
            <h3>Поддержка</h3>
            <p>Если возник вопрос по заказу или комплектации — напишите нам в соцсетях или мессенджерах, поможем разобраться.</p>
          </div>
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
          <a className="btn-outline" href={`/product/${p.id}`}>Подробнее</a>
        </article>
      ))}
    </div>
  );
}

function ProductPage() {
  const { id } = useParams();
  const { products, addToCart } = useStore();
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
        <button className="btn" onClick={() => addToCart(product.id)}>Добавить в корзину</button>
        <div className="market-links">
          {(product.ozonUrl || product.ozon_url) && (
            <a href={product.ozonUrl || product.ozon_url} target="_blank" rel="noreferrer">Ozon</a>
          )}
          {(product.wbUrl || product.wb_url) && (
            <a href={product.wbUrl || product.wb_url} target="_blank" rel="noreferrer">Wildberries</a>
          )}
        </div>
      </div>
    </section>
  );
}

function CartPage() {
  const { cartDetailed, updateCartItem, cartTotal } = useStore();
  const navigate = useNavigate();
  return (
    <>
      <h1>Корзина</h1>
      {cartDetailed.length === 0 ? <p>Корзина пуста.</p> : (
        <>
          {cartDetailed.map((row) => (
            <div key={row.product.id} className="cart-row">
              <span>{row.product.name}</span>
              <input
                type="number"
                min="0"
                value={row.qty}
                onChange={(e) => updateCartItem(row.product.id, Number(e.target.value))}
              />
              <span>{(row.product.price * row.qty).toLocaleString("ru-RU")} ₽</span>
            </div>
          ))}
          <h3>Итого: {cartTotal.toLocaleString("ru-RU")} ₽</h3>
          <button className="btn" onClick={() => navigate("/checkout")}>Оформить заказ</button>
        </>
      )}
    </>
  );
}

function CheckoutPage() {
  const { placeOrder, user } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
    delivery: "Курьер",
    payment: "Наличный",
  });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await placeOrder(form);
      if (!res.ok) {
        alert(res.message);
        return;
      }
      alert(`Заказ #${res.orderId} создан`);
      navigate("/");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <h1>Оформление заказа</h1>
      <input required placeholder="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input required placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <input required placeholder="Адрес" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      <select value={form.delivery} onChange={(e) => setForm({ ...form, delivery: e.target.value })}>
        <option>Курьер</option>
        <option>Самовывоз</option>
      </select>
      <select value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })}>
        <option>Наличный</option>
        <option>Безналичный</option>
      </select>
      <button className="btn" type="submit">Подтвердить</button>
    </form>
  );
}

function AccountPage() {
  const { user, orders, updateProfile } = useStore();
  const [form, setForm] = useState({ name: user?.name ?? "", phone: user?.phone ?? "", address: user?.address ?? "" });
  if (!user) return <Navigate to="/" replace />;
  const myOrders = orders.filter((o) => o.userId === user.id);
  return (
    <>
      <h1>Личный кабинет</h1>
      <form className="form" onSubmit={(e) => { e.preventDefault(); updateProfile(form); alert("Профиль сохранен"); }}>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <button className="btn" type="submit">Сохранить</button>
      </form>
      <h2>История заказов</h2>
      {myOrders.map((o) => (
        <div key={o.id} className="order">
          <b>#{o.id}</b> - {o.status} - {o.total.toLocaleString("ru-RU")} ₽
        </div>
      ))}
    </>
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
      if (!res.ok) {
        setError(res.message);
        return;
      }
      navigate("/admin");
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <h1>Вход в админ-панель</h1>
      <input
        required
        type="text"
        autoComplete="username"
        placeholder="Логин администратора"
        value={form.login}
        onChange={(e) => setForm({ ...form, login: e.target.value })}
      />
      <input
        required
        type="password"
        placeholder="Пароль"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <input
        required
        type="password"
        placeholder="Секретный ключ"
        value={form.accessKey}
        onChange={(e) => setForm({ ...form, accessKey: e.target.value })}
      />
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
  };
}

const EMPTY_ADMIN_FORM = {
  id: null,
  name: "",
  price: 0,
  categoryId: 1,
  description: "",
  image: "",
  stock: 0,
  ozonUrl: "",
  wbUrl: "",
};

function AdminPage() {
  const { user, isAdminSessionValid, products, categories, upsertProduct, deleteProduct, syncWbPrice, orders, updateOrderStatus } = useStore();
  const [form, setForm] = useState(EMPTY_ADMIN_FORM);
  if (!user?.isAdmin || !isAdminSessionValid)
    return <Navigate to={ADMIN_ENTRY_PRIMARY} replace />;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await upsertProduct({ ...form, price: Number(form.price), stock: Number(form.stock), categoryId: Number(form.categoryId) });
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
        <input
          type="number"
          placeholder="Цена (₽) — подставится с WB, если указана ссылка"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
        <input
          type="url"
          placeholder="Ссылка на карточку Wildberries (для авто-цены)"
          value={form.wbUrl}
          onChange={(e) => setForm({ ...form, wbUrl: e.target.value })}
        />
        <p className="form-hint">
          Формат: https://www.wildberries.ru/catalog/АРТИКУЛ/detail.aspx — цена на сайте будет синхронизироваться с WB.
        </p>
        <input
          type="url"
          placeholder="Ссылка Ozon (необязательно)"
          value={form.ozonUrl}
          onChange={(e) => setForm({ ...form, ozonUrl: e.target.value })}
        />
        <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input required placeholder="URL изображения" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
        <input required type="number" placeholder="Остаток" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
        <textarea required placeholder="Описание" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="btn" type="submit">{form.id ? "Сохранить" : "Добавить товар"}</button>
      </form>
      <div className="admin-list">
        {products.map((p) => (
          <div key={p.id} className="cart-row admin-product-row">
            <span className="admin-product-row__name">{p.name}</span>
            <span>{formatRub(p.price)} ₽</span>
            {p.wbPriceTracking && (
              <span className="wb-badge wb-badge--compact">WB</span>
            )}
            {(p.wbSyncError ?? p.wb_sync_error) && (
              <span className="price-block__error" title={p.wbSyncError ?? p.wb_sync_error}>ошибка WB</span>
            )}
            {p.wbPriceTracking && (
              <button type="button" onClick={() => syncWbPrice(p.id).catch((e) => alert(e.message))}>
                Обновить цену
              </button>
            )}
            <button type="button" onClick={() => setForm(productToAdminForm(p))}>Редактировать</button>
            <button type="button" onClick={() => deleteProduct(p.id).catch((e) => alert(e.message))}>Удалить</button>
          </div>
        ))}
      </div>
      <h2>Управление заказами</h2>
      {orders.map((o) => (
        <div key={o.id} className="order">
          <b>#{o.id}</b> - {o.name} - {o.status}
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
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/account" element={<AccountPage />} />
        {ADMIN_ENTRY_ROUTES.map((path) => (
          <Route key={path} path={path} element={<AdminLoginPage />} />
        ))}
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Layout>
  );
}
