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
          <p>г. Санкт-Петербург, проспект Героев, д. 26, к. 1</p>
          <p><a href="mailto:regola-shop@mail.ru">regola-shop@mail.ru</a></p>
          <p>ИНН / КПП 720324917448</p>
          <p>ОГРН 316723200095576</p>
          <nav className="site-footer__markets" aria-label="Маркетплейсы">
            <a href={MARKET_LINKS.wb} target="_blank" rel="noopener noreferrer">Wildberries</a>
            <a href={MARKET_LINKS.ozon} target="_blank" rel="noopener noreferrer">Ozon</a>
            <a href={MARKET_LINKS.ym} target="_blank" rel="noopener noreferrer">Яндекс Маркет</a>
          </nav>
        </div>
        <nav className="site-footer__contacts" aria-label="Написать нам">
          <a href="https://t.me/+79782870744" target="_blank" rel="noopener noreferrer" aria-label="Написать Regola в Telegram" title="Telegram Regola" className="contact-icon">
            <SocialIcon name="telegram" />
          </a>
          <a href="https://max.ru/u/f9LHodD0cOLK1N9PmwC4ImfAZmC_l-pb6N17Bx8Fr6ul2DtWMJ0p0kLRQJ0" target="_blank" rel="noopener noreferrer" aria-label="Написать Regola в MAX" title="MAX Regola" className="contact-icon">
            <SocialIcon name="max" />
          </a>
          <a href="https://vk.ru/id498734600" target="_blank" rel="noopener noreferrer" aria-label="Regola во ВКонтакте" title="ВКонтакте Regola" className="contact-icon">
            <SocialIcon name="vk" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
import SocialIcon from "./SocialIcons";
