#!/bin/sh
set -e

if [ -z "${BACKEND_ORIGIN:-}" ]; then
  echo "[entrypoint] BACKEND_ORIGIN es obligatorio (template Nomad)." >&2
  exit 1
fi

NGINX_PORT="${NOMAD_PORT_http:-8080}"
echo "[entrypoint] nginx → 0.0.0.0:${NGINX_PORT} | proxy /api → ${BACKEND_ORIGIN}"

rm -f /etc/nginx/conf.d/*.conf

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
  listen 0.0.0.0:${NGINX_PORT} default_server;
  listen [::]:${NGINX_PORT} default_server;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  client_max_body_size 25m;

  location = /health {
    access_log off;
    default_type text/plain;
    return 200 'ok';
  }

  location /api/ {
    proxy_pass ${BACKEND_ORIGIN}/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$http_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$proxy_x_forwarded_proto;
    proxy_set_header X-Forwarded-Host \$http_host;
    proxy_read_timeout 300s;
    proxy_connect_timeout 30s;
    proxy_send_timeout 300s;
  }

  location /socket.io/ {
    proxy_pass ${BACKEND_ORIGIN}/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$http_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$proxy_x_forwarded_proto;
    proxy_set_header X-Forwarded-Host \$http_host;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
EOF

grep -E '^\s*listen|proxy_pass' /etc/nginx/conf.d/default.conf
nginx -t -c /etc/nginx/nginx.conf
exec nginx -c /etc/nginx/nginx.conf -g 'daemon off;'
