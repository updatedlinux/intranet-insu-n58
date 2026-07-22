# Intranet Corporativa (GitHub — Docker Compose)

Monorepo para la plataforma de intranet corporativa. Incluye una API REST en Node.js/Express y una aplicación web en React.

> **Track GitHub (`updatedlinux/intranet-insu-n58`):** entorno local/QA con **Docker Compose** (SQL Server, MinIO, Redis, API, frontend).  
> El despliegue **Nomad / GitLab CI** de Insular permanece en el repositorio de `gitlab.devtechspace.com` y no es el camino principal de este repo.

Ramas QA de este remoto:

| Rama | Uso |
|------|-----|
| `insular-qa` | Variante / QA Insular |
| `N58-qa` | Variante / QA N58 |

## Arranque con Docker Compose

Requisitos: Docker Desktop (o Engine + Compose v2). En Apple Silicon, SQL Server corre con `platform: linux/amd64`.

```bash
cp .env.example .env
docker compose up --build
```

| Servicio | URL / puerto |
|----------|----------------|
| Frontend | http://localhost:8080 |
| API | http://localhost:3000 (`/api/v1/health`) |
| MinIO API | http://localhost:9000 |
| MinIO Console | http://localhost:9001 |
| SQL Server | localhost:1433 |
| Redis | localhost:6379 |

El entrypoint de la API espera SQL/MinIO/Redis, crea la base si no existe y aplica migraciones.

Detener y conservar datos: `docker compose down`  
Borrar volúmenes: `docker compose down -v`

## Estructura del repositorio

```
intranet/
├── backend/                 # API REST (Express + TypeScript)
│   └── src/
│       ├── config/          # Variables de entorno y configuración (dotenv)
│       ├── controllers/     # Controladores HTTP
│       ├── middlewares/     # Middlewares (errores, 404, etc.)
│       ├── models/          # Modelos de datos / esquemas
│       ├── routes/          # Definición de rutas
│       ├── services/        # Lógica de negocio
│       ├── app.ts           # Configuración de Express
│       └── index.ts         # Punto de entrada del servidor
├── frontend/                # Cliente web (Vite + React + TypeScript)
│   └── src/
│       ├── components/
│       │   └── layout/      # Sidebar, Navbar, MainLayout
│       ├── pages/           # Vistas de la aplicación
│       ├── App.tsx
│       └── main.tsx
├── .gitignore
└── README.md
```

## Requisitos previos

- **Node.js** 20 LTS o superior
- **npm** 10+

## Inicio rápido

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

La API quedará disponible en `http://localhost:3000`.

Endpoint de salud (Nomad / QA / Prod): `GET http://localhost:3000/api/v1/health`

### 2. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La aplicación quedará en `http://localhost:5173`.

## Variables de entorno (backend)

Copia `backend/.env.example` a `backend/.env` y completa credenciales según el ambiente (Dev: VPN + SQL/MinIO de desarrollo; QA/Prod: valores del despliegue Nomad).

| Variable | Descripción |
|----------|-------------|
| `NODE_ENV` | `development` \| `test` \| `production` |
| `PORT` | Puerto HTTP (default `3000`) |
| `CORS_ORIGIN` | Origen del frontend |
| `DB_*` | SQL Server (`DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`) |
| `MINIO_*` | Almacenamiento S3-compatible (`MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, keys, `MINIO_BUCKET`) |
| `JWT_*` | `JWT_SECRET`, `JWT_EXPIRES_IN` |

Al arrancar, el backend conecta el pool de SQL Server y verifica/crea el bucket MinIO. El health check reporta el estado de ambos.

## Migraciones de base de datos

**Regla:** ningún cambio de esquema se aplica manualmente. Todo va por migraciones versionadas.

| Comando | Descripción |
|---------|-------------|
| `npm run migrate` | Aplica migraciones pendientes |
| `npm run migrate:undo` | Revierte la última migración |
| `npm run migrate:status` | Estado de migraciones |

El ambiente de `db-migrate` se resuelve desde `NODE_ENV` → `development`→`dev`, `test`→`test`, `production`→`production`. Usa las mismas variables `DB_*` del `.env`.

**Esquema base (orden):**

1. `Roles` — roles del sistema  
2. `Areas` — jerarquía (`parentAreaId`)  
3. `Positions` — cargos por área  
4. `Users` — usuarios (`INT IDENTITY` en todas las tablas)  
5. Seed inicial: rol `superadmin`, usuario `admin@yopmail.com` (contraseña temporal `ChangeMe123!` por defecto, `mustChangePassword=1`)  
6. Seed roles: `admin`, `colaborador`; usuario `colaborador@yopmail.com` (misma contraseña temporal por defecto)

**Usuarios de prueba (después de `npm run migrate`):**

| Email | Rol | Uso |
|-------|-----|-----|
| `admin@yopmail.com` | `admin` (antes `superadmin`) | Menú con Colaboradores y panel admin |
| `colaborador@yopmail.com` | `colaborador` | Menú operativo (sin administración) |

Contraseña por defecto: `ChangeMe123!` (configurable con `SEED_ADMIN_PASSWORD` / `SEED_COLLABORATOR_PASSWORD` en `.env`).

Promoción Dev → QA → Prod: backup del ambiente origen y `npm run migrate` en el destino con su `.env` correspondiente.

## Scripts disponibles

### Backend (`/backend`)

| Comando            | Descripción                              |
|--------------------|------------------------------------------|
| `npm run dev`      | Servidor en modo desarrollo (hot reload) |
| `npm run build`    | Compila TypeScript a `dist/`             |
| `npm start`        | Ejecuta build de producción              |
| `npm run lint`     | Ejecuta ESLint                           |
| `npm run lint:fix` | Corrige problemas de ESLint              |
| `npm run format`   | Formatea con Prettier                    |
| `npm run typecheck`| Verificación de tipos sin emitir         |
| `npm run migrate`  | Aplica migraciones SQL pendientes        |
| `npm run migrate:undo` | Revierte última migración            |
| `npm run migrate:status` | Estado de migraciones              |

### Frontend (`/frontend`)

| Comando            | Descripción                    |
|--------------------|--------------------------------|
| `npm run dev`      | Servidor de desarrollo Vite    |
| `npm run build`    | Build de producción            |
| `npm run preview`  | Vista previa del build         |
| `npm run lint`     | Ejecuta ESLint                 |
| `npm run lint:fix` | Corrige problemas de ESLint    |
| `npm run format`   | Formatea con Prettier          |

## Arquitectura del backend

Flujo típico de una petición:

```
Request → Routes → Controller → Service → (Model) → Response
```

- **config**: Configuración centralizada (`config/index.ts`), pool SQL (`database.ts`), cliente MinIO (`storage.ts`).
- **routes**: Agrupa endpoints bajo prefijos (`/api`).
- **controllers**: Orquestan la respuesta HTTP.
- **services**: Contienen la lógica reutilizable.
- **middlewares**: Manejo global de errores y rutas no encontradas.

## Arquitectura del frontend (template Axero)

El diseño visual proviene del template en `frontend/legacy-axero/`. Los assets estáticos se sirven desde `frontend/public/axero/assets/` (copia de `legacy-axero/assets`).

Componentes React del layout (clases y estructura HTML del template):

| Componente   | Origen en Axero              |
|--------------|------------------------------|
| `Sidebar`    | `.sidebar-nav-wrapper`       |
| `Header`     | `.header`                    |
| `MainLayout` | `.main-wrapper` + `.section` |
| `Footer`     | `.footer`                    |
| `PageHeader` | `.title-wrapper` + breadcrumb|

Rutas configuradas en `src/config/navigation.ts`. El dashboard (`/`) replica `legacy-axero/index.html`. Las demás páginas muestran un placeholder hasta migrar cada HTML.

**Sincronizar assets** tras cambios en `legacy-axero`:

```bash
cp -R frontend/legacy-axero/assets frontend/public/axero/
```

## Calidad de código

Ambos proyectos usan **ESLint** (flat config) y **Prettier** con reglas alineadas. Ejecuta lint y format antes de abrir un merge request:

```bash
cd backend && npm run lint && npm run format:check
cd ../frontend && npm run lint && npm run format:check
```

## Próximos pasos sugeridos

- [ ] Autenticación (JWT / SSO corporativo)
- [ ] Conexión a base de datos y modelos en `backend/src/models`
- [ ] React Router para rutas del frontend
- [ ] Proxy de Vite hacia la API en desarrollo
- [ ] CI/CD (GitLab CI) con lint y build

## Licencia

Uso interno — N58 Banco Digital.
