#!/usr/bin/env bash
set -euo pipefail
# redeploy trigger 2026-07-13

JOB_NAME="${NOMAD_JOB_NAME:-insular-intranet-prod}"
DATACENTER="${NOMAD_DATACENTER:-dcprod}"
NODE_POOL="${NOMAD_NODE_POOL:-intranet}"
TRAEFIK_HOST="${TRAEFIK_HOST:-intranet.insularcambios.com}"
TRAEFIK_ROUTER="${TRAEFIK_ROUTER:-insular-intranet-front-prod}"
INTRANET_NODE_IP="${INTRANET_NODE_IP:-172.28.163.12}"
WEB_HTTP_PORT="${WEB_HTTP_PORT:-8080}"
TRAEFIK_BACKEND_URL="${TRAEFIK_BACKEND_URL:-http://${INTRANET_NODE_IP}:${WEB_HTTP_PORT}}"
SERVICE_NAME="${NOMAD_SERVICE_NAME:-insular-intranet}"
API_SERVICE_NAME="${NOMAD_API_SERVICE_NAME:-insular-intranet-api}"
ENVIRONMENT="${DEPLOY_ENVIRONMENT:-prod}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
JOB_TEMPLATE="${SCRIPT_DIR}/job.nomad.hcl"
JOB_RENDERED="${SCRIPT_DIR}/job.rendered.nomad.hcl"

ENV_FILE=""
API_IMAGE=""
FRONT_IMAGE=""
REGISTRY_USER="${REGISTRY_USER:-}"
REGISTRY_TOKEN="${REGISTRY_TOKEN:-}"

usage() {
  cat <<'EOF'
Uso: deploy.sh --env-file PATH --api-image IMAGE --front-image IMAGE
     [--job-name NAME] [--datacenter DC]

Variables de entorno opcionales:
  NOMAD_ADDR              Dirección Nomad (requerida si no está exportada)
  NOMAD_JOB_NAME          Default: insular-intranet-prod
  REGISTRY_USER / REGISTRY_TOKEN
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --api-image)
      API_IMAGE="$2"
      shift 2
      ;;
    --front-image)
      FRONT_IMAGE="$2"
      shift 2
      ;;
    --job-name)
      JOB_NAME="$2"
      shift 2
      ;;
    --datacenter)
      DATACENTER="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Argumento desconocido: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${NOMAD_ADDR:-}" ]]; then
  echo "NOMAD_ADDR no definido." >&2
  exit 1
fi

if [[ -z "$ENV_FILE" || -z "$API_IMAGE" || -z "$FRONT_IMAGE" ]]; then
  echo "Faltan --env-file, --api-image o --front-image." >&2
  usage
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No existe env file: $ENV_FILE" >&2
  exit 1
fi

# SQL Server solo lee MSSQL_SA_PASSWORD al crear el volumen por primera vez.
# Siempre igual a DB_PASSWORD (usuario sa de la API).
ENV_FILE_PREPARED="${ENV_FILE}.nomad.prepared"
cp "$ENV_FILE" "$ENV_FILE_PREPARED"
db_password="$(grep -E '^DB_PASSWORD=' "$ENV_FILE_PREPARED" | head -1 | cut -d= -f2- || true)"
if [[ -z "$db_password" ]]; then
  echo "Falta DB_PASSWORD en ${ENV_FILE}" >&2
  exit 1
fi
grep -vE '^MSSQL_SA_PASSWORD=' "$ENV_FILE_PREPARED" > "${ENV_FILE_PREPARED}.tmp"
mv "${ENV_FILE_PREPARED}.tmp" "$ENV_FILE_PREPARED"
printf 'MSSQL_SA_PASSWORD=%s\n' "$db_password" >> "$ENV_FILE_PREPARED"
echo "[deploy] MSSQL_SA_PASSWORD sincronizado con DB_PASSWORD (sa SQL Server)."
ENV_FILE="$ENV_FILE_PREPARED"

if ! command -v nomad >/dev/null 2>&1; then
  echo "CLI nomad no encontrado en PATH." >&2
  exit 1
fi

sed "s/INSULAR_PLACEHOLDER_JOB/${JOB_NAME}/g" "$JOB_TEMPLATE" > "$JOB_RENDERED"

echo "[deploy] Job: ${JOB_NAME} @ ${NOMAD_ADDR} (dc=${DATACENTER}, pool=${NODE_POOL})"
echo "[deploy] API image: ${API_IMAGE}"
echo "[deploy] Front image: ${FRONT_IMAGE}"
echo "[deploy] Traefik backend: ${TRAEFIK_BACKEND_URL}"

WAIT_TCP_SCRIPT="${SCRIPT_DIR}/scripts/wait-tcp.sh"
if [[ ! -f "$WAIT_TCP_SCRIPT" ]]; then
  echo "No existe wait-tcp.sh: $WAIT_TCP_SCRIPT" >&2
  exit 1
fi

cd "${SCRIPT_DIR}"

NOMAD_EXTRA_VARS=()
if [ -n "${TRAEFIK_IP_ALLOWLIST:-}" ]; then
  NOMAD_EXTRA_VARS+=( -var="traefik_ip_allowlist_enabled=true" )
  echo "[deploy] Whitelist IP Traefik: activada (middlewares @file)"
fi

nomad job run \
  -var="env_file_path=${ENV_FILE}" \
  -var="wait_tcp_script_path=${WAIT_TCP_SCRIPT}" \
  -var="image_api=${API_IMAGE}" \
  -var="image_frontend=${FRONT_IMAGE}" \
  -var="registry_user=${REGISTRY_USER}" \
  -var="registry_token=${REGISTRY_TOKEN}" \
  -var="datacenter=${DATACENTER}" \
  -var="node_pool=${NODE_POOL}" \
  -var="traefik_host=${TRAEFIK_HOST}" \
  -var="traefik_router=${TRAEFIK_ROUTER}" \
  -var="traefik_entrypoint=websecure" \
  -var="traefik_certresolver=godaddy" \
  -var="web_http_port=${WEB_HTTP_PORT}" \
  -var="traefik_backend_url=${TRAEFIK_BACKEND_URL}" \
  -var="service_name=${SERVICE_NAME}" \
  -var="api_service_name=${API_SERVICE_NAME}" \
  -var="environment=${ENVIRONMENT}" \
  "${NOMAD_EXTRA_VARS[@]}" \
  "$JOB_RENDERED"

echo "[deploy] Despliegue enviado."
