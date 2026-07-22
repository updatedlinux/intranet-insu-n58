#!/usr/bin/env bash
# Ejecutar como root EN EL NODO INTRANET (172.28.163.12).
# Permite que el servidor Traefik (172.28.163.3) conecte al front nginx.
#
# Uso:
#   sudo bash deploy/scripts/allow-traefik-firewall.sh
#   sudo bash deploy/scripts/allow-traefik-firewall.sh 172.28.163.3 8080

set -euo pipefail

TRAEFIK_IP="${1:-172.28.163.3}"
WEB_PORT="${2:-8080}"

echo "[firewall] Permitir ${TRAEFIK_IP} → TCP ${WEB_PORT} (front intranet)"

if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld 2>/dev/null; then
  RULE="rule family=ipv4 source address=${TRAEFIK_IP} port port=${WEB_PORT} protocol=tcp accept"
  firewall-cmd --permanent --add-rich-rule="${RULE}"
  firewall-cmd --reload
  echo "[firewall] firewalld: regla añadida (${RULE})"
  exit 0
fi

if command -v iptables >/dev/null 2>&1; then
  if ! iptables -C INPUT -p tcp -s "${TRAEFIK_IP}" --dport "${WEB_PORT}" -j ACCEPT 2>/dev/null; then
    iptables -I INPUT -p tcp -s "${TRAEFIK_IP}" --dport "${WEB_PORT}" -j ACCEPT
    echo "[firewall] iptables: regla INPUT añadida"
  else
    echo "[firewall] iptables: regla ya existía"
  fi
  echo "[firewall] Persistir iptables según la distro (iptables-save / netfilter-persistent)."
  exit 0
fi

echo "[firewall] No se encontró firewalld ni iptables." >&2
exit 1
