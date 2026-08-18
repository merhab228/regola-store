const MARKET_LINKS = {
  wb: "https://www.wildberries.ru/seller/782141",
  ozon: "https://www.ozon.ru/seller/torretta/",
  ym: "https://market.yandex.ru/business--regola/203997184",
};

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
          <a href="https://t.me/" target="_blank" rel="noopener noreferrer" aria-label="Telegram" title="Telegram" className="contact-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 3L3 10.5l4.5 1.5L10 21l2-5 5.5 3L21 3z" fill="currentColor"/></svg>
          </a>
          <a href="https://max.ru/" target="_blank" rel="noopener noreferrer" aria-label="MAX" title="MAX" className="contact-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M7 12h10M7 8h10M7 16h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          <a href="https://wa.me/79829412000" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp" className="contact-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 14.5c0 3.1-2.5 5.5-5.5 5.5-1.4 0-2.7-.4-3.9-1l-3.1.8.8-3.1c-.6-1.2-1-2.5-1-3.9C7.3 7 9.7 4.5 12.8 4.5 16 4.5 18.5 7 18.5 10.2c0 1.1-.3 2.1-.8 3l1.3 1.3z" fill="currentColor"/></svg>
          </a>
        </nav>
      </div>
    </footer>
  );
}
