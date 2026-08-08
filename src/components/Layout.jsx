import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useStore } from "../context/StoreContext";
import BottomContacts from "./BottomContacts";

const SECTION_LINKS = [
  ["catalog", "Каталог"],
  ["payment", "Оплата и доставка"],
  ["about", "Цель компании"],
  ["order", "Заказ через маркетплейсы"],
  ["guarantees", "Гарантии"],
  ["question", "Задать вопрос"],
  ["contacts", "Контакты"],
];

export default function Layout({ children }) {
  const { user, logout, cartItems } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const cartCount = cartItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  const scrollToSection = (id) => (e) => {
    e.preventDefault();
    if (location.pathname !== "/") {
      navigate("/#" + id);
      return;
    }
    window.history.replaceState(null, "", "/#" + id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  };

  const onLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="page-shell">
      <header className="header">
        <div className="container nav">
          <div className="nav-top">
            <Link to="/" className="nav-tagline">МАГАЗИН ДВЕРНЫХ РУЧЕК</Link>
            <Link to="/" className="logo" aria-label="Regola — на главную">
              <img src="/regola.jpg" alt="Regola" className="logo-img" width="300" height="84" />
            </Link>
            <div className="nav-marketplaces">
              <a className="market-icon market-icon--wb" href="https://www.wildberries.ru/seller/782141" target="_blank" rel="noreferrer" aria-label="Wildberries"><span>WB</span></a>
              <a className="market-icon market-icon--ozon" href="https://www.ozon.ru/seller/torretta/" target="_blank" rel="noreferrer" aria-label="Ozon"><span>OZON</span></a>
              <a className="market-icon market-icon--ym" href="https://market.yandex.ru/business--regola/203997184?generalContext=t%3DshopInShop%3Bi%3D1%3Bbi%3D203997184%3B&rs=eJwz4v_EyMPBKLDwEKsEg8az06wAJY8EuA%2C%2C&searchContext=sins_ctx" target="_blank" rel="noreferrer" aria-label="Яндекс Маркет"><span>Я</span><span>Маркет</span></a>
            </div>
            <button
              type="button"
              className="nav-toggle"
              aria-expanded={menuOpen}
              aria-controls="main-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? "Закрыть" : "Меню"}
            </button>
          </div>
          <nav
            id="main-nav"
            className={"nav-menu" + (menuOpen ? " nav-menu--open" : "")}
            aria-label="Основное меню"
          >
            {SECTION_LINKS.map(([id, label]) => (
              <a key={id} href={"/#" + id} onClick={scrollToSection(id)}>{label}</a>
            ))}
            <Link to="/cart">Корзина{cartCount ? ` (${cartCount})` : ""}</Link>
            {user ? <button className="link-btn" onClick={onLogout}>Выйти</button> : null}
          </nav>
        </div>
      </header>
      <main key={location.pathname} className="container page-main page-route-enter">
        {children}
      </main>
      <a className="floating-question" href="/#question" onClick={scrollToSection("question")}>Задать вопрос</a>
      <BottomContacts />
    </div>
  );
}
