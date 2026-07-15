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
