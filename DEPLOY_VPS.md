# Regola: production на VPS

Домен: `regola.shop`. Приложение работает в Docker на `127.0.0.1:4000`, Nginx принимает HTTP/HTTPS, база хранится в `/opt/regola-data/regola.db`.

## Первичная установка

```bash
apt update
apt install -y git docker.io nginx certbot python3-certbot-nginx
systemctl enable --now docker nginx
git clone https://github.com/merhab228/regola-store /opt/regola
mkdir -p /opt/regola-data
cd /opt/regola
cp .env.example .env
nano .env
```

Минимально обязательные production-переменные:

```env
NODE_ENV=production
PORT=4000
TRUST_PROXY=1
DB_PATH=/app/data/regola.db
PUBLIC_BASE_URL=https://regola.shop
JWT_SECRET=strong-random-secret-at-least-32-characters
ADMIN_LOGIN=change-me
ADMIN_PASSWORD=change-me-at-least-12-characters
ADMIN_ACCESS_KEY=another-strong-random-secret
VITE_ADMIN_PATH=/_secure-admin-7f29A228lswP
```

## Сборка и запуск

```bash
cd /opt/regola
docker build -t regola-store:latest .
docker rm -f regola 2>/dev/null || true
docker run -d \
  --name regola \
  --restart unless-stopped \
  --env-file .env \
  -e DB_PATH=/app/data/regola.db \
  -p 127.0.0.1:4000:4000 \
  -v /opt/regola-data:/app/data \
  regola-store:latest
curl -fsS http://127.0.0.1:4000/api/health
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

## Обновление без потери базы

```bash
mkdir -p /opt/regola-backups
cp /opt/regola-data/regola.db /opt/regola-backups/regola-$(date +%F-%H%M%S).db
cd /opt/regola
git pull --ff-only origin main
docker build -t regola-store:latest .
docker rm -f regola
docker run -d \
  --name regola \
  --restart unless-stopped \
  --env-file .env \
  -e DB_PATH=/app/data/regola.db \
  -p 127.0.0.1:4000:4000 \
  -v /opt/regola-data:/app/data \
  regola-store:latest
curl -fsS http://127.0.0.1:4000/api/health
```

## Включение T-Банка и СДЭК

Сначала заполнить тестовые ключи из `.env.example` и оставить `TBANK_MODE=test`, `CDEK_MODE=test`. После тест-кейсов и письменной приёмки заменить ключи на боевые и переключить режимы на `production`. Изменение `.env` требует пересоздания контейнера командой из раздела обновления.

Публичная безопасная проверка конфигурации:

```bash
curl -fsS https://regola.shop/api/commerce/config
```

Этот endpoint возвращает только флаги готовности и режимы, но никогда не возвращает секреты.
