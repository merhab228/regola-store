# Regola — магазин дверных ручек

React (Vite) + Express + SQLite. Цены товаров задаются вручную через админ-панель.

## Локальный запуск

```bash
cp .env.example .env
npm install
npm run dev:all
```

- сайт: http://localhost:5173/
- API: http://localhost:4000/

Если Windows не запускает общий режим, откройте два терминала:

```bash
npm run server
npm run dev
```

## Security case study

A security review identified a business-logic vulnerability in the checkout flow: the server trusted client-supplied item prices and totals. The checkout now loads authoritative prices from SQLite, calculates delivery and payable totals on the server, and rejects invalid products and quantities. The remediation is covered by regression tests.

Full report: [Client-Controlled Pricing in an E-commerce Checkout](https://github.com/merhab228/regola-checkout-security-audit)

## Production

```bash
npm run build
npm start
```

Подробно: [DEPLOY_VPS.md](DEPLOY_VPS.md).

## Админ-панель

Инструкция: [ADMIN_MANUAL.md](ADMIN_MANUAL.md).

## Важное

- `.env` не коммитить.
- Пароли и ключи держать только на сервере.
- Базу SQLite регулярно копировать в резервную папку.

## Оплата, СДЭК и редизайн

- Чек-лист клиенту: [PAYMENT_CDEK_TASK_FOR_CLIENT.md](PAYMENT_CDEK_TASK_FOR_CLIENT.md).
- Word-пакеты для согласования находятся в [docs](docs/).
