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

## Telegram-бот для заказов

После создания бота через [@BotFather](https://t.me/BotFather) укажите в `.env` его токен и ID чата администратора:

```env
TELEGRAM_BOT_TOKEN=123456:token
TELEGRAM_CHAT_ID=123456789
```

Перезапустите сервер, откройте диалог с ботом и отправьте `/start`. Бот показывает новые заказы, заявки/вопросы и карточки товаров; в заказах и заявках можно менять статус кнопками, а карточки — скрывать или публиковать. Доступ имеет только `TELEGRAM_CHAT_ID` и дополнительные ID из `TELEGRAM_ADMIN_CHAT_IDS`, поэтому не добавляйте туда посторонние чаты.

## Уведомления на email

Новые заказы и вопросы также отправляются на `regola-shop@mail.ru`. Для Mail.ru добавьте в production `.env` пароль приложения (обычный пароль от почты не используйте):

```env
EMAIL_TO=regola-shop@mail.ru
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=regola-shop@mail.ru
SMTP_PASSWORD=пароль-приложения
EMAIL_FROM=regola-shop@mail.ru
```

После изменения `.env` пересоздайте или перезапустите контейнер сервера.

## Важное

- `.env` не коммитить.
- Пароли и ключи держать только на сервере.
- Базу SQLite регулярно копировать в резервную папку.

## Оплата, СДЭК и редизайн

- Чек-лист клиенту: [PAYMENT_CDEK_TASK_FOR_CLIENT.md](PAYMENT_CDEK_TASK_FOR_CLIENT.md).
- Word-пакеты для согласования находятся в [docs](docs/).
