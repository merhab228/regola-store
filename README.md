# Regola — магазин дверных ручек

React (Vite) + Express + SQLite. Синхронизация цен с Wildberries по ссылке на карточку.

## Быстрый старт

```bash
cp .env.example .env
# отредактируйте .env (JWT, админ, ключи)

npm install
npm run dev:all
```

- Сайт: http://localhost:5173/
- API: http://localhost:4000/

На Windows без Git Bash запускайте в **двух** терминалах: `npm run server` и `npm run dev`.

## Работа с GitHub с разных устройств

### 1. Один раз на каждом компьютере

```bash
git config --global user.name "Ваше Имя"
git config --global user.email "ggggtvink228@gmail.com"
```

Вход в GitHub (без пароля в командной строке):

```bash
gh auth login
```

Выберите: GitHub.com → HTTPS → Login with browser.

Либо создайте **Personal Access Token** на https://github.com/settings/tokens и используйте его вместо пароля при `git push`.

### 2. Скачать проект на новое устройство

```bash
git clone https://github.com/ВАШ_ЛОГИН/regola-store.git
cd regola-store
cp .env.example .env
npm install
npm run dev:all
```

Файл `.env` в репозиторий **не попадает** — на каждой машине свой локальный `.env`.

### 3. Сохранить изменения (версии)

```bash
git status
git add .
git commit -m "Кратко: что изменили"
git push
```

### 4. Подтянуть чужие / свои изменения с другого ПК

```bash
git pull
npm install
```

### Полезные команды

| Действие | Команда |
|----------|---------|
| История версий | `git log --oneline` |
| Откатить файл | `git checkout -- путь/к/файлу` |
| Ветка для эксперимента | `git checkout -b feature/имя` |
| Слить ветку | `git checkout main && git merge feature/имя` |

## Структура

- `src/` — фронтенд (React)
- `server/` — API, БД, синхронизация WB
- `.env.example` — шаблон секретов

## Безопасность

- Не коммитьте `.env` и пароли.
- Для GitHub используйте токен или `gh auth login`, не обычный пароль аккаунта.
