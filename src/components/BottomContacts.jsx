const MARKET_LINKS = {
  wb: "https://www.wildberries.ru/seller/782141",
  ozon: "https://www.ozon.ru/seller/torretta/",
  ym: "https://market.yandex.ru/business--regola/203997184?generalContext=t%3DshopInShop%3Bi%3D1%3Bbi%3D203997184%3B&rs=eJwz4v_EyMPBKLDwEKsEg8az06wAJY8EuA%2C%2C&searchContext=sins_ctx",
};

export default function BottomContacts() {
  return (
    <footer id="contacts" className="site-footer" role="contentinfo" aria-label="Контакты">
      <div className="container site-footer__inner">
        <div className="site-footer__brand" aria-hidden="true">
          <img src="/regola.jpg" alt="" />
        </div>
        <div className="site-footer__info">
          <p>Regola — магазин дверных ручек</p>
          <p>г. Санкт-Петербург, проспект Героев, д. 26</p>
          <p>ИНН / КПП 720324917448</p>
          <p>ОГРН 316723200095576</p>
          <nav className="site-footer__markets" aria-label="Маркетплейсы">
            <a href={MARKET_LINKS.wb} target="_blank" rel="noopener noreferrer">Wildberries</a>
            <a href={MARKET_LINKS.ozon} target="_blank" rel="noopener noreferrer">Ozon</a>
            <a href={MARKET_LINKS.ym} target="_blank" rel="noopener noreferrer">Яндекс Маркет</a>
          </nav>
        </div>
        <div className="site-footer__contacts">
          <a className="site-footer__phone" href="tel:+79829412000">+7 982 941-20-00</a>
        </div>
      </div>
    </footer>
  );
}
