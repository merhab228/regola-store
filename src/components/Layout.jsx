import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useStore } from "../context/StoreContext";
import BottomContacts from "./BottomContacts";

export default function Layout({ children }) {
  const { user, cartDetailed, logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const cartCount = cartDetailed.reduce((sum, row) => sum + row.qty, 0);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  const onLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="page-shell">
      <header className="header">
        <div className="container nav">
          <div className="nav-row">
            <div className="nav-left">
              <Link to="/" className="nav-tagline">
                Магазин дверных ручек
              </Link>
            </div>
            <div className="nav-center">
              <Link to="/" className="logo" aria-label="Regola — на главную">
                <img src="/regola.jpg" alt="Regola" className="logo-img" width="220" height="40" />
              </Link>
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
            <nav
              id="main-nav"
              className={`nav-right${menuOpen ? " nav-right--open" : ""}`}
              aria-label="Основное меню"
            >
              <NavLink to="/cart">Корзина ({cartCount})</NavLink>
              <a className="market-icon wb" href="https://www.wildberries.ru/" target="_blank" rel="noreferrer" aria-label="Wildberries">
                WB
              </a>
              <a className="market-icon ozon" href="https://www.ozon.ru/" target="_blank" rel="noreferrer" aria-label="Ozon">
                OZ
              </a>
              <a className="market-icon ym" href="https://market.yandex.ru/" target="_blank" rel="noreferrer" aria-label="Yandex Market">
                YM
              </a>
              {user ? (
                <>
                  <NavLink to="/account">Кабинет</NavLink>
                  <button className="link-btn" onClick={onLogout}>Выйти</button>
                </>
              ) : null}
            </nav>
          </div>
        </div>
      </header>
      <main key={location.pathname} className="container page-main page-route-enter">
        {children}
      </main>
      <BottomContacts />
    </div>
  );
}
