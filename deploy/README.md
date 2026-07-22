# Despliegue Insular Intranet en Nomad

## Requisitos del host (`pool = intranet`)

- Meta: `role=worker`, `env=intra`, `pool=intranet`
- `node_pool = intranet`
- Recursos: 8 vCPU / 8 GB RAM (job reserva ~5.8 GB RAM con SQL 4 GB)
- Datacenter: `dcprod`
- Puertos libres en el host: **8080** (front nginx), **1433**, **3000**, **6379**, **9000**, **9001** (red `host`)

### Error iptables / Permission denied en el alloc

Si el alloc falla con:

```text
pre-run hook "network" failed ... iptables ... Permission denied (you must be root)
```

el cliente Nomad no puede crear redes **bridge** (habitual si el agente no corre como root o está muy restringido).

Este job usa **`network { mode = "host" }`** para evitar iptables. Alternativa infra: ejecutar el agente Nomad como **root** (systemd `User=root`) y habilitar bridge/CNI si preferís aislamiento por alloc.

```bash
ps aux | grep '[n]omad'
sudo systemctl status nomad
```

## 1. Host volumes (una vez por nodo)

Datos persistentes bajo **`/logs`** (disco con ~150 GB en el nodo dedicado).

| Volumen host | Ruta | Espacio recomendado |
|--------------|------|---------------------|
| `insular-sqlserver-data` | `/logs/insular/intranet/sqlserver` | ~20 GB (crece con uso) |
| `insular-minio-data` | `/logs/insular/intranet/minio` | **≥ 80 GB** (documentos, adjuntos) |
| `insular-redis-data` | `/logs/insular/intranet/redis` | ~1 GB |

Nomad no impone cuota de disco en `host_volume`; asegurar que la partición de `/logs` tenga al menos **80 GB libres** para MinIO (es el mayor consumidor).

En el cliente Nomad, registrar volúmenes **dentro** de `client { }` (ver `nomad-client.example.hcl`).  
Si los `host_volume` quedan fuera del bloque `client`, el agente **no arranca** (error de sintaxis HCL).

```bash
sudo mkdir -p /logs/insular/intranet/{sqlserver,minio,redis}
sudo chown -R 10001:10001 /logs/insular/intranet/sqlserver
sudo chown -R 1000:1000 /logs/insular/intranet/minio
sudo chown -R 999:999 /logs/insular/intranet/redis
```

Reiniciar el agente Nomad tras añadir la config.

## 1b. Disco: `/` al 90% y `/logs` vacío

En el nodo dedicado (`svproelkinsu01`, pool `intranet`) la partición **`/` (lvroot, 10 GB)** se llena rápido con **capas Docker** (`/var/lib/docker`) y **estado Nomad** (`/opt/nomad/data`). Los datos de negocio (SQL, MinIO, Redis) **ya deben** vivir en **`/logs`** vía `host_volume`; si `/logs` muestra pocos MB usados, primero confirma que los volúmenes están registrados.

### Diagnóstico (en el nodo)

```bash
# ¿Datos persistentes en /logs?
sudo du -sh /logs/insular/intranet/* 2>/dev/null
sudo du -sh /var/lib/docker /opt/nomad/data /var/log 2>/dev/null

# ¿Host volumes en el agente Nomad?
grep -A2 host_volume /etc/nomad.d/*.hcl 2>/dev/null || grep -A2 host_volume /opt/nomad/config/*.hcl

# ¿Montajes activos del job?
nomad alloc status -json $(nomad job allocs -t '{{.ID}}' insular-intranet-prod 2>/dev/null | head -1) 2>/dev/null | jq '.TaskStates[].Events' 
```

Si `sqlserver` / `minio` / `redis` **no** montan `/logs/insular/intranet/...`, hay que añadir los `host_volume` del ejemplo `nomad-client.example.hcl` y reiniciar Nomad (ver §1).

### Qué mover a `/logs` (cliente Nomad + Docker, una vez)

| Componente | Ruta actual (típica) | Ruta recomendada |
|------------|----------------------|------------------|
| SQL / MinIO / Redis | ya en host_volume | `/logs/insular/intranet/{sqlserver,minio,redis}` |
| Estado Nomad | `/opt/nomad/data` | `/logs/nomad/data` |
| Imágenes Docker | `/var/lib/docker` | `/logs/docker` |

**1. Nomad `data_dir` en `/logs`**

```bash
sudo systemctl stop nomad
sudo mkdir -p /logs/nomad/data
sudo rsync -a /opt/nomad/data/ /logs/nomad/data/   # si ya había datos
# En /etc/nomad.d/client.hcl (dentro del bloque raíz, no solo client):
#   data_dir = "/logs/nomad/data"
sudo systemctl start nomad
```

**2. Docker `data-root` en `/logs`** (requiere ventana de mantenimiento)

```bash
sudo systemctl stop nomad docker   # detiene allocs
sudo mkdir -p /logs/docker
# /etc/docker/daemon.json :
#   { "data-root": "/logs/docker" }
sudo rsync -a /var/lib/docker/ /logs/docker/
sudo systemctl start docker nomad
```

**3. Alivio inmediato sin migrar** (libera espacio en `/` ahora)

```bash
# Capas e imágenes huérfanas (no borra volúmenes nombrados en uso)
docker image prune -a -f
docker builder prune -a -f

# Logs del sistema (ajustar según política)
sudo journalctl --vacuum-size=200M

# Ver qué ocupa más en lvroot
sudo du -xh / --max-depth=2 2>/dev/null | sort -h | tail -20
```

No ejecutar `docker system prune --volumes` sin revisar: podría afectar volúmenes no montados vía `host_volume`.

### En el repositorio (job Nomad)

No hace falta cambiar `job.nomad.hcl` para el disco: los `volume { type = "host" }` ya apuntan a `insular-*-data`. El ajuste es **solo en el cliente Nomad** del nodo y, si aplica, en el daemon Docker.

## 2. Variables GitLab

### Grupo `insular` (heredadas)

| Variable | Uso |
|----------|-----|
| `REGISTRY_URL` | `https://registry.devtechspace.com` |
| `REGISTRY_USER` | Pull/push imágenes |
| `REGISTRY_TOKEN` | Token registry |

### Proyecto (`insular-intranet`)

| Variable | Tipo | Uso |
|----------|------|-----|
| `NOMAD_ADDR_PROD` | Variable | URL del servidor Nomad (ej. `http://10.x.x.x:4646`) |
| `PROD_ENV_FILE` | **File** | `.env` completo de producción |

#### Crear `PROD_ENV_FILE` en GitLab

1. **Settings → CI/CD → Variables → Add variable**
2. **Key:** `PROD_ENV_FILE` (exacto, sensible a mayúsculas)
3. **Type:** **File** (recomendado). GitLab escribe el contenido en un path y el job recibe `$PROD_ENV_FILE=/builds/.../tmp/PROD_ENV_FILE`.
4. **Value:** pegar el `.env` de producción (basado en `deploy/prod.env.example`, con secretos reales).
5. **Flags:**
   - **Protect variable:** solo si `main` es rama protegida (*Settings → Repository → Protected branches*).
   - **Mask variable:** desactivado (un `.env` multilínea no se puede enmascarar).
   - **Expand variable reference:** desactivado si el `.env` contiene `$` literales.
   - **Environment scope:** `*` o `production`.

**Si ya existe como Variable (texto):** en la lista verás badge *Expanded* y no *File*. El pipeline acepta ambos tipos, pero con executor **docker** los valores largos a veces **no llegan al contenedor** (variable vacía). Si el job dice «no llegó al job», borrar y recrear como **File**.

`NOMAD_ADDR_PROD` y las del registry deben seguir las mismas reglas de **Protected** / **scope** que `PROD_ENV_FILE`.

## 3. `PROD_ENV_FILE` — qué va y qué no

Todo SQL Server, Redis y MinIO corren **en el mismo allocation** que la API. Se hablan por **`127.0.0.1`** (localhost del grupo `stack`). No hay IPs ni DNS externos para infraestructura.

### Lo que **inyecta el job** (no hace falta en el `.env`)

| Variable | Valor fijado por Nomad |
|----------|------------------------|
| `DB_SERVER` | `127.0.0.1` |
| `REDIS_HOST` | `127.0.0.1` |
| `MINIO_ENDPOINT` | `127.0.0.1` |
| `REDIS_ENABLED` | `true` |
| `MINIO_ENABLED` | `true` |

Si las incluyes en `PROD_ENV_FILE`, la task **api** las sobrescribe igual. En dev local sí las necesitas apuntando a servidores remotos; en prod **sobran**.

### Lo que **sí va** en `PROD_ENV_FILE`

Secretos, puertos, nombres de BD/bucket y URLs públicas. Plantilla: `deploy/prod.env.example`.

```env
NODE_ENV=production
PORT=3000

CORS_ORIGIN=https://intranet.insularcambios.com
APP_URL=https://intranet.insularcambios.com

DB_PORT=1433
DB_NAME=insular_intranet
DB_USER=sa
DB_PASSWORD=<contraseña-fuerte-sa>
DB_ENCRYPT=false

MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=<minio-user>
MINIO_SECRET_KEY=<minio-secret>
MINIO_BUCKET=insular-docs

REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>

JWT_SECRET=<secreto-largo>
JWT_EXPIRES_IN=24h
AUTH_COOKIE_NAME=intranet_session

SMTP_HOST=send.insularcambios.com
SMTP_PORT=25
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM_NAME=Insular Cambios
SMTP_FROM_EMAIL=...
```

Relay en puerto **25** sin STARTTLS: `SMTP_IGNORE_TLS=true`. Conexión por `SMTP_CONNECT_HOST` (Nomad inyecta `172.28.163.15`).

**Postal exige autenticación.** Crear una credencial SMTP en Postal (servidor `send.insularcambios.com`) y configurar en `PROD_ENV_FILE`:

```env
SMTP_USER=<usuario-de-la-credencial-postal>
SMTP_PASSWORD=<password-de-la-credencial-postal>
SMTP_FROM_EMAIL=no-reply@insularcambios.com
```

Sin `SMTP_USER` / `SMTP_PASSWORD` el relay responde `530 Authentication required` (la contraseña se resetea en BD pero el correo no sale).

`DB_PASSWORD` es la clave del usuario `sa` (API y SQL). `deploy.sh` **siempre** escribe `MSSQL_SA_PASSWORD` con el mismo valor antes del `nomad job run`. En GitLab basta con `DB_PASSWORD=P@ssw0rd` (o la clave que elijas); no hace falta `MSSQL_SA_PASSWORD` en el File.  
SQL Server **solo aplica** `MSSQL_SA_PASSWORD` la **primera vez** que inicializa el volumen (`/logs/insular/intranet/sqlserver`). Si cambias la contraseña después y ves `Login failed for user 'sa'`, hay que **recrear el volumen SQL** o volver a la contraseña con la que se creó.

```bash
# Solo si hace falta resetear SQL (borra datos de BD):
nomad job stop -purge insular-intranet-prod  # o solo el grupo database
sudo systemctl stop nomad  # si el alloc retiene el volumen
sudo rm -rf /logs/insular/intranet/sqlserver/*
sudo chown -R 10001:10001 /logs/insular/intranet/sqlserver
# redeploy pipeline
```

`MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` los usan la API y el contenedor MinIO del job.  
`REDIS_PASSWORD` lo usan la API y `redis-server` del job.

## 4. Arquitectura del job

**Un grupo Nomad por componente** (5 allocations independientes, red **host** en el mismo nodo):

```
1. database  → sqlserver :1433 (4 GB RAM)
2. minio     → prestart wait :1433 → MinIO :9000 (volumen ≥80 GB)
3. redis     → prestart wait :9000 → Redis :6379
4. api       → prestart wait :6379 → API :3000 (+ entrypoint valida SQL/MinIO/Redis)
5. web       → prestart wait :3000 → nginx :**8080** (Traefik → `http://172.28.163.12:8080`)
```

Si falla un grupo (p. ej. `api`), **SQL/MinIO/Redis no reciben SIGTERM** por cascada.

Los `prestart` usan Alpine + `deploy/scripts/wait-tcp.sh` (hasta ~20 min por puerto).

**Red host:** MSSQL suele escuchar en la **IP del nodo** (ej. `172.28.163.12:1433`), no en `127.0.0.1`. Los waits usan `nomadService` para obtener la IP/puerto real del servicio anterior (misma máquina, distinta allocation).

**Frontend / Traefik:** nginx debe escuchar en **`0.0.0.0:8080`** (todas las interfaces), no solo en `172.28.163.12`. El entrypoint del front genera `listen 0.0.0.0:8080` sin bind a `NOMAD_IP_http`. Tras deploy, comprobar:

```bash
ss -ltn | grep ':8080'
# debe mostrar 0.0.0.0:8080 (o *:8080), NO solo 172.28.163.12:8080

curl -s -o /dev/null -w "%{http_code}\n" http://172.28.163.12:8080/health
```

Traefik remoto (172.28.163.3) usa `http://172.28.163.12:8080` (tag explícito + provider Nomad).

```
Traefik (172.28.163.3, websecure + godaddy)
    └── intranet.insularcambios.com → http://172.28.163.12:8080 (nginx)
            ├── /api/*       → proxy → group api (:3000)
            ├── /socket.io/* → proxy → group api (:3000)
            └── /*           → SPA estática

group database → SQL Server :1433
group minio    → MinIO :9000
group redis    → Redis :6379
group api      → Node API :3000
```

Service discovery **Nomad nativo** (`provider = "nomad"`), sin Consul.

## 5. CI/CD

Pipeline en `.gitlab-ci.yml` — **solo rama `main`**:

1. `lint` — ESLint backend + frontend  
2. `build` — TypeScript compile  
3. `docker` — build & push imágenes  
4. `deploy` — `nomad job run` con `PROD_ENV_FILE`

Imágenes:

- `registry.devtechspace.com/insular/intranet-api:<sha>`
- `registry.devtechspace.com/insular/intranet-front:<sha>`

## 6. Deploy manual (debug)

```bash
export NOMAD_ADDR="http://<nomad-server>:4646"
export PROD_ENV_FILE=/ruta/al/.env.prod

bash deploy/deploy.sh \
  --env-file "$PROD_ENV_FILE" \
  --api-image registry.devtechspace.com/insular/intranet-api:local \
  --front-image registry.devtechspace.com/insular/intranet-front:local \
  --registry-user "$REGISTRY_USER" \
  --registry-token "$REGISTRY_TOKEN"
```

## 7. Traefik (172.28.163.3) → intranet (172.28.163.12:8080)

Traefik en **otro servidor**; el front debe escuchar en **`0.0.0.0:8080`**. Tag Traefik: `loadbalancer.server.url=http://172.28.163.12:8080`.

```bash
ss -ltn | grep ':8080'    # esperado: 0.0.0.0:8080
curl http://172.28.163.12:8080/health   # 200 en el nodo
# misma prueba desde 172.28.163.3 (Traefik)
```

Logs del alloc: `nomad alloc logs <web> frontend` debe mostrar `nginx bind 0.0.0.0:8080`.
