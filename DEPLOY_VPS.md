# Regola: production на VPS

Домен: `regola.shop`. Приложение работает в Docker на `127.0.0.1:4000`, Nginx принимает HTTP/HTTPS, база хранится в `/opt/regola-data/regola.db`.

## Быстрый старт (за 5 минут)

### 1. Инициализация VPS (один раз)

Запусти на VPS как root:

```bash
# Клонируй репо и запусти автоматическую установку
git clone https://github.com/merhab228/regola-store /opt/regola
cd /opt/regola
# Передай публичный SSH-ключ deploy-пользователя (если нужен auto-deploy)
DEPLOY_PUBKEY="ssh-ed25519 AAAA..." bash scripts/setup_vps.sh
```

Скрипт:
- Установит Docker, Nginx, Git
- Создаст пользователя `deploy`
- Клонирует репо в `/opt/regola`
- Создаст `/opt/regola/.env` из `.env.example`

### 2. Заполни .env переменными

```bash
nano /opt/regola/.env
```

Минимально обязательные production-переменные:

```env
NODE_ENV=production
PORT=4000
TRUST_PROXY=1
DB_PATH=/app/data/regola.db
PUBLIC_BASE_URL=https://regola.shop
JWT_SECRET=strong-random-secret-at-least-32-characters
ADMIN_LOGIN=your-admin-login
ADMIN_PASSWORD=your-admin-password-at-least-12-chars
ADMIN_ACCESS_KEY=another-strong-random-secret
VITE_ADMIN_PATH=/_secure-admin-7f29A228lswP
```

### 3. Развертывание контейнера

```bash
cd /opt/regola
# Вариант A: ручной деплой (как deploy-пользователь или через sudo)
sudo -u deploy bash scripts/deploy.sh

# Вариант B: автоматический деплой с переменными (не требует редактирования .env после первого раза)
NODE_ENV=production \
JWT_SECRET="your-random-secret-here" \
ADMIN_ACCESS_KEY="another-secret" \
bash scripts/deploy.sh
```

Скрипт автоматически:
- Создает `.env` если его нет
- Заполняет значения из переменных окружения (если переданы)
- Делает бэкап БД
- Собирает Docker image
- Запускает контейнер
- Проверяет здоровье приложения

### 4. Проверка

```bash
curl -fsS http://127.0.0.1:4000/api/health
curl -fsS http://127.0.0.1:4000/api/commerce/config
```

## Nginx

`/etc/nginx/sites-available/regola.shop`:

```nginx
server {
    server_name regola.shop www.regola.shop;

    client_max_body_size 40m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -sf /etc/nginx/sites-available/regola.shop /etc/nginx/sites-enabled/regola.shop
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
certbot --nginx -d regola.shop -d www.regola.shop
```

## Обновление (на продакшене)

Просто запусти скрипт деплоя — он всё сделает автоматически:

```bash
cd /opt/regola
# Как deploy-пользователь (или через sudo -u deploy):
bash scripts/deploy.sh

# Или с переменными окружения для обновления .env на лету:
NODE_ENV=production JWT_SECRET="new-secret" bash scripts/deploy.sh
```

Скрипт автоматически:
- Создаст бэкап БД в `/opt/regola-backups/`
- Скачает свежие коммиты (`git pull origin main`)
- Пересоберет Docker image
- Перезапустит контейнер
- Проверит здоровье приложения

Если что-то пошло не так, восстанови БД из бэкапа:

```bash
cp /opt/regola-backups/regola-YYYY-MM-DDTHH-MM-SS-sssZ.db /opt/regola-data/regola.db
# и перезапусти контейнер
```

## Ежедневные резервные копии

Деплой создаёт проверенную SQLite-копию перед перезапуском контейнера. Она создаётся через SQLite Backup API, поэтому содержит данные из WAL, включая последние карточки и заказы.

Один раз на VPS от root включи ежедневный backup (в 03:20, с небольшим случайным разбросом):

```bash
cd /opt/regola
bash scripts/install_backup_timer.sh
```

Проверить таймер и последние копии:

```bash
systemctl list-timers regola-db-backup.timer
ls -lah /opt/regola-backups
```

Копии старше 31 дня автоматически удаляются. Перед восстановлением останови контейнер и обязательно скопируй текущую БД в отдельный файл.

## Включение T-Банка и СДЭК

Сначала заполнить тестовые ключи из `.env.example` и оставить `TBANK_MODE=test`, `CDEK_MODE=test`. После тест-кейсов и письменной приёмки заменить ключи на боевые и переключить режимы на `production`. Изменение `.env` требует пересоздания контейнера командой из раздела обновления.

Публичная безопасная проверка конфигурации:

```bash
curl -fsS https://regola.shop/api/commerce/config
```

Этот endpoint возвращает только флаги готовности и режимы, но никогда не возвращает секреты.
