# Запуск Regola на VPS

## 1. DNS

В панели REG.RU для `regola.ru` создайте записи:

```text
A     @      IP_ВАШЕГО_VPS
A     www    IP_ВАШЕГО_VPS
```

Подождите обновления DNS.

## 2. Подготовка сервера

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker nginx
```

## 3. Загрузка проекта

```bash
cd /opt
sudo git clone YOUR_REPO_URL regola
sudo chown -R $USER:$USER /opt/regola
cd /opt/regola
cp .env.example .env
nano .env
```

В `.env` задайте:

```env
NODE_ENV=production
PORT=4000
JWT_SECRET=long_random_secret
ADMIN_LOGIN=your_login
ADMIN_PASSWORD=your_strong_password
ADMIN_ACCESS_KEY=your_secret_key
VITE_ADMIN_PATH=/_secure-admin-7f29A228lswP
DB_PATH=/app/data/regola.db
```

## 4. Запуск

```bash
docker compose up -d --build
docker compose logs -f
```

Проверка:

```bash
curl http://127.0.0.1:4000/api/health
```

## 5. Nginx

Создайте конфиг:

```bash
sudo nano /etc/nginx/sites-available/regola.ru
```

Вставьте:

```nginx
server {
    server_name regola.ru www.regola.ru;

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

Включите сайт:

```bash
sudo ln -s /etc/nginx/sites-available/regola.ru /etc/nginx/sites-enabled/regola.ru
sudo nginx -t
sudo systemctl reload nginx
```

## 6. HTTPS

```bash
sudo certbot --nginx -d regola.ru -d www.regola.ru
```

## 7. Обновление сайта

```bash
cd /opt/regola
git pull
docker compose up -d --build
```

## 8. Бэкап базы

```bash
mkdir -p ~/regola-backups
docker compose exec regola sh -c 'cp /app/data/regola.db /tmp/regola.db'
docker cp regola-regola-1:/tmp/regola.db ~/regola-backups/regola-$(date +%F).db
```
