import { Link, useLocation } from "react-router-dom";

/** Замените URL на свои страницы / чаты */
const CONTACTS = {
  vk: "https://vk.com/",
  telegram: "https://t.me/",
  max: "https://max.ru/",
};

export default function BottomContacts() {
  const location = useLocation();

  const onAboutClick = (e) => {
    if (location.pathname === "/" && location.hash === "#about") {
      e.preventDefault();
      document.getElementById("about")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <footer className="bottom-nav" role="contentinfo" aria-label="Контакты">
      <div className="bottom-nav-inner">
        <Link to="/#about" className="bottom-nav-about" onClick={onAboutClick}>
          О нас
        </Link>
        <span className="bottom-nav-divider" aria-hidden />
        <span className="bottom-nav-caption">Написать нам</span>
        <nav className="bottom-nav-chips" aria-label="Мессенджеры">
          <a
            className="bottom-chip bottom-chip--vk"
            href={CONTACTS.vk}
            target="_blank"
            rel="noopener noreferrer"
          >
            ВКонтакте
          </a>
          <a
            className="bottom-chip bottom-chip--tg"
            href={CONTACTS.telegram}
            target="_blank"
            rel="noopener noreferrer"
          >
            Telegram
          </a>
          <a
            className="bottom-chip bottom-chip--max"
            href={CONTACTS.max}
            target="_blank"
            rel="noopener noreferrer"
          >
            Max
          </a>
        </nav>
      </div>
    </footer>
  );
}
