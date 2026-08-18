const MARKET_LINKS = {
  wb: "https://www.wildberries.ru/seller/782141",
  ozon: "https://www.ozon.ru/seller/torretta/",
  ym: "https://market.yandex.ru/business--regola/203997184",
};

const CONTACT_LINKS = [
  ["https://t.me/", "TG", "Telegram"],
  ["https://max.ru/", "MAX", "MAX"],
  ["https://wa.me/79829412000", "WA", "WhatsApp"],
];

export default function BottomContacts() {
  return (
    <footer id="contacts" className="site-footer" role="contentinfo" aria-label="Контакты">
      <div className="container site-footer__inner">
        <div className="site-footer__brand" aria-hidden="true">
          <img src="/regola.jpg" alt="" />
        </div>
        <div className="site-footer__info">
          <p>Regola — интернет-магазин дверных ручек</p>
          <p>г. Санкт-Петербург, проспект Героев, д. 26</p>
          <p>ИНН / КПП 720324917448</p>
          <p>ОГРН 316723200095576</p>
          <nav className="site-footer__markets" aria-label="Маркетплейсы">
            <a href={MARKET_LINKS.wb} target="_blank" rel="noopener noreferrer">Wildberries</a>
            <a href={MARKET_LINKS.ozon} target="_blank" rel="noopener noreferrer">Ozon</a>
            <a href={MARKET_LINKS.ym} target="_blank" rel="noopener noreferrer">Яндекс Маркет</a>
          </nav>
        </div>
        <nav className="site-footer__contacts" aria-label="Написать нам">
          {CONTACT_LINKS.map(([href, icon, label]) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>{icon}</a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
