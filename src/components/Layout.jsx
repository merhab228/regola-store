import { Link, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useStore } from "../context/StoreContext";
import BottomContacts from "./BottomContacts";

const NAV_LINKS = [
  ["/", "Каталог"],
  ["/payment", "Оплата и доставка"],
  ["/about", "Цель компании"],
  ["/guarantees", "Гарантии"],
  ["/contacts", "Контакты"],
];

export default function Layout({ children }) {
  const { cartItems } = useStore();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartPulse, setCartPulse] = useState(false);
  const cartCount = cartItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  // Pulse the cart count when items are added to draw attention (mobile UX)
  const prevCountRef = useRef(cartCount);
  useEffect(() => {
    if (cartCount > prevCountRef.current) {
      setCartPulse(true);
      const t = setTimeout(() => setCartPulse(false), 350);
      return () => clearTimeout(t);
    }
    prevCountRef.current = cartCount;
  }, [cartCount]);

  return (
    <div className="page-shell">
      <header className="header">
        <div className="container nav">
          <div className="nav-top">
            <Link to="/" className="nav-tagline">ИНТЕРНЕТ-МАГАЗИН ДВЕРНЫХ РУЧЕК</Link>
            <Link to="/" className="logo" aria-label="Regola — на главную">
              <img src="/regola.jpg" alt="Regola" className="logo-img" width="300" height="84" />
            </Link>
            <div className="nav-actions">
              <div className="nav-marketplaces" aria-label="Магазины Regola на маркетплейсах">
                <a className="market-icon market-icon--wb" href="https://www.wildberries.ru/seller/782141" target="_blank" rel="noreferrer" aria-label="Wildberries"><span>WB</span></a>
                <a className="market-icon market-icon--ozon" href="https://www.ozon.ru/seller/torretta/" target="_blank" rel="noreferrer" aria-label="Ozon"><span>OZON</span></a>
                <a className="market-icon market-icon--ym" href="https://market.yandex.ru/business--regola/203997184" target="_blank" rel="noreferrer" aria-label="Яндекс Маркет"><span>Я</span><span>Маркет</span></a>
              </div>
              <Link className="cart-link" to="/cart" aria-label={`Корзина, товаров: ${cartCount}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 7H7M9.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" /></svg>
                <span className="cart-link__label">Корзина</span>
                <b className={"cart-link__count" + (cartCount ? " is-visible" : "") + (cartPulse ? " is-pulse" : "")}>
                  {cartCount}
                </b>
              </Link>
              <button
                type="button"
                className="nav-toggle"
                aria-expanded={menuOpen}
                aria-controls="main-nav"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
                <span>{menuOpen ? "Закрыть" : "Меню"}</span>
              </button>
            </div>
          </div>
          <nav id="main-nav" className={"nav-menu" + (menuOpen ? " nav-menu--open" : "")} aria-label="Основное меню">
            {NAV_LINKS.map(([to, label]) => (
              <Link key={to} to={to} className={location.pathname === to ? "active" : ""} onClick={() => setMenuOpen(false)}>{label}</Link>
            ))}
          </nav>
        </div>
      </header>
      <main key={location.pathname} className="container page-main page-route-enter">
        {children}
      </main>
      <BottomContacts />
    </div>
  );
}
