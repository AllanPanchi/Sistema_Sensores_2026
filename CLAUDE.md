# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**HidroSentinel** — backend API for a marine environmental risk monitoring platform. Thesis project (TIC), 2-person team, deadline first week of July. **MVP velocity over architectural purity** — no over-engineering.

## Commands

All commands run from `backend/`:

```bash
npm run dev        # nodemon src/server.js (development, hot-reload)
npm start          # node src/server.js (production)
npm run seed       # creates the initial admin user in the DB
```

**Infrastructure** (run from repo root):

```bash
docker compose up -d          # starts Postgres (port 5434) + InfluxDB (port 8086)
docker compose down -v        # destroys containers AND volumes (wipes DB data)
```

`server.js` uses top-level `await` to ping all three databases before accepting traffic. If any connection fails, the process exits with code 1.

## Architecture

Monolito modular con **3 capas estrictas** por módulo de dominio:

```
Routes/Controller  →  Service  →  Repository
(req/res only)        (logic)      (SQL/InfluxDB only)
```

- **Controllers** call one service function and return `ok()` or forward to `next(err)`. Zero logic.
- **Services** own all business rules, validations, and domain checks. They throw `AppError`.
- **Repositories** contain only SQL queries or InfluxDB writes/reads. No logic.

```
backend/src/
├── config/
│   ├── db.usuarios.js   # pg Pool → DB 'usuarios'
│   ├── db.sensores.js   # pg Pool → DB 'sensores'
│   └── influxdb.js      # getWriteApi() / getQueryApi()
├── middlewares/
│   ├── auth.middleware.js    # verifyToken, requireRole(...roles)
│   └── error.middleware.js   # errorHandler, class AppError
├── modules/
│   ├── auth/        # login, register (POST /api/auth/*)
│   ├── usuarios/    # user CRUD, role assignment (POST /api/usuarios/*)
│   ├── boyas/       # buoys + sensors + units CRUD (POST /api/boyas/*)
│   └── telemetria/  # CSV ingestion → InfluxDB (POST /api/telemetria/*)
├── utils/
│   └── response.js  # ok(res, msg, data, status) / fail(res, msg, errors, status)
├── app.js           # Express setup: helmet, cors, routes, 404, errorHandler
└── server.js        # DB health checks, then app.listen
scripts/
└── seed.admin.js    # one-shot: creates admin@hidrosentinel.ec / Admin2026!
```

## Database Layout

**Two separate Postgres databases** (same container, single credentials):

| Pool | Env var | Database | Tables |
|---|---|---|---|
| `db.usuarios.js` | `PG_DB_USUARIOS` | `usuarios` | USUARIO, ROL, ROLASIGNACION |
| `db.sensores.js` | `PG_DB_SENSORES` | `sensores` | BOYA, SENSOR, UNIDADESMEDIDA |

**InfluxDB** (`config/influxdb.js`): time-series for telemetry. `getWriteApi()` returns a new instance per call — the caller must call `.close()` to flush the write buffer.

Init SQL lives in `init_db/sql/` and is injected by `init_db/01_init_multiple_dbs.sh` on first container start. Recreating with `docker compose down -v && docker compose up -d` re-runs all init scripts.

## Response Contract

Every endpoint returns this shape — use the helpers, never `res.json()` directly:

```js
// Success
ok(res, 'message', data, statusCode=200)
// → { success: true, message, data, timestamp }

// Error (via AppError or errorHandler)
throw new AppError('message', statusCode=400, errors=[])
// → { success: false, message, errors, timestamp }
```

## Auth Flow

1. `POST /api/auth/login` returns a JWT (`{ sub, correo, roles[] }`).
2. All protected routes go through `verifyToken` (sets `req.user`).
3. Role gates: `requireRole('ADMINISTRADOR')` or `requireRole('ADMINISTRADOR', 'OPERADOR')`.
4. One exception: `PUT /api/usuarios/:id/password` skips `requireRole` — the service itself compares `req.user.sub` vs `:id` to allow self-service while blocking cross-user access.

Roles in DB: `ADMINISTRADOR`, `OPERADOR` (seeded in `Usuario.sql`).

## Key Invariants

**Route ordering**: static segments must be declared before dynamic params in the same router. Violated examples to avoid:

```js
router.get('/:id', ...)        // ← this would swallow /perfil and /roles
router.get('/perfil', ...)     // ← must be first
```

**Sensor threshold constraint**: `umbralriesgomin < umbralriesgomax`. Validated in `boyas.service.js:validarUmbrales`.

**FK constraints to handle explicitly**:
- `SENSOR → BOYA` (`ON DELETE RESTRICT`): service checks `countSensoresByBoya` before delete → returns `409`.
- `SENSOR → UNIDADESMEDIDA` (`ON DELETE RESTRICT`): caught by pg error code `23503` → returns `409`.
- `ROLASIGNACION → USUARIO` (`ON DELETE CASCADE`): deleting a user auto-removes role assignments.

**CORREO is immutable**: it is embedded in the JWT payload. Changing it would silently invalidate all active tokens. `actualizarUsuario` only updates `nombre`, `apellido`, `cedula`.

**`replaceRoles`** in `usuarios.repository.js` runs DELETE + N INSERTs inside an explicit `pg` transaction (`BEGIN/COMMIT/ROLLBACK`) with a dedicated `client` from the pool.

## Environment Variables

Copy `.env.example` → `.env`. Two variable groups exist side by side:

- `POSTGRES_*` — read by Docker Compose to initialize the container.
- `PG_*` — read by the Node.js pg pools at runtime.

`JWT_SECRET` and `JWT_EXPIRES_IN` (default `8h`) are required for auth to work.
