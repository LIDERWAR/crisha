#!/bin/bash
# =============================================================
# Скрипт деплоя ContractCheck.ru на Ubuntu VPS
# Запускать: bash deploy.sh
# Предварительно: скопировать проект в /var/www/contractcheck/
# =============================================================

set -e
echo "🚀 Начинаем деплой ContractCheck.ru..."

PROJECT_DIR="/var/www/contractcheck"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# --- 1. Системные зависимости ---
echo "📦 Устанавливаем системные пакеты..."
apt-get update -qq
apt-get install -y python3 python3-pip python3-venv \
    postgresql postgresql-contrib \
    nginx redis-server \
    certbot python3-certbot-nginx \
    git curl

# --- 2. PostgreSQL ---
echo "🐘 Настраиваем PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE contractcheck_db;" 2>/dev/null || echo "БД уже существует"
sudo -u postgres psql -c "CREATE USER cc_user WITH PASSWORD 'СМЕНИТЬ_ПАРОЛЬ';" 2>/dev/null || echo "Пользователь уже существует"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE contractcheck_db TO cc_user;"
sudo -u postgres psql -c "ALTER DATABASE contractcheck_db OWNER TO cc_user;"

# --- 3. Python venv ---
echo "🐍 Создаём виртуальное окружение..."
cd "$BACKEND_DIR"
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# --- 4. Django ---
echo "⚙️ Настраиваем Django..."
python manage.py migrate
python manage.py collectstatic --noinput

# --- 5. Логи ---
echo "📝 Создаём директорию для логов..."
mkdir -p /var/log/contractcheck
chown www-data:www-data /var/log/contractcheck

# --- 6. Systemd сервисы ---
echo "🔧 Устанавливаем Systemd сервисы..."
cp "$PROJECT_DIR/deploy/systemd/contractcheck-gunicorn.service" /etc/systemd/system/
cp "$PROJECT_DIR/deploy/systemd/contractcheck-celery.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable contractcheck-gunicorn contractcheck-celery redis
systemctl start redis

# --- 7. Nginx ---
echo "🌐 Настраиваем Nginx..."
cp "$PROJECT_DIR/deploy/nginx/contractcheck.ru.conf" /etc/nginx/sites-available/contractcheck.ru
ln -sf /etc/nginx/sites-available/contractcheck.ru /etc/nginx/sites-enabled/contractcheck.ru
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# --- 8. SSL ---
echo "🔒 Получаем SSL-сертификат (Let's Encrypt)..."
certbot --nginx -d contractcheck.ru -d www.contractcheck.ru --non-interactive --agree-tos -m admin@contractcheck.ru

# --- 9. Запуск всего ---
echo "▶️ Запускаем сервисы..."
systemctl start contractcheck-gunicorn contractcheck-celery
systemctl status contractcheck-gunicorn --no-pager
systemctl status contractcheck-celery --no-pager

echo ""
echo "✅ Деплой завершён!"
echo "🌍 Сайт: https://contractcheck.ru"
echo ""
echo "⚠️  Не забудь:"
echo "   1. Заполнить /var/www/contractcheck/backend/.env (боевые ключи)"
echo "   2. В settings.py: CELERY_TASK_ALWAYS_EAGER = False"
echo "   3. Настроить боевые ключи Robokassa"
