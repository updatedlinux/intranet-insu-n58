#!/bin/sh
# Espera a que host:port acepte conexiones TCP, luego exec del comando restante.
set -e

host="${1:?host requerido}"
port="${2:?port requerido}"
max="${3:-120}"
sleep_sec="${4:-5}"
shift 4

attempt=0
while [ "$attempt" -lt "$max" ]; do
  if nc -z "$host" "$port" 2>/dev/null; then
    echo "[wait-tcp] ${host}:${port} disponible"
    exec "$@"
  fi
  attempt=$((attempt + 1))
  echo "[wait-tcp] esperando ${host}:${port} (${attempt}/${max})..."
  sleep "$sleep_sec"
done

echo "[wait-tcp] timeout esperando ${host}:${port}" >&2
exit 1
