# Life Organizer API

API REST de organización personal integral: **Agenda · Metas · Finanzas · Proyectos · Hobbies**.

> Estado actual: **Sprint 1-5 completos.** API con los 5 módulos de negocio, endurecida y testeada, más CI/CD, configuración de deployment y un dashboard demo en React. Ver [Roadmap](#roadmap) para el detalle de cada sprint.
>
> ⚠️ **Lo único que falta es acción tuya**: yo no puedo crear una cuenta en Railway/Render ni desplegar en tu nombre (requiere tus propias credenciales). Todo lo demás — Dockerfile, `render.yaml`, CI, guía paso a paso — ya está listo en [DEPLOYMENT.md](DEPLOYMENT.md).

## Stack

- Node.js 20+ / TypeScript
- Express.js
- Prisma ORM + PostgreSQL
- JWT (access + refresh) + bcrypt
- Joi (validación)
- Jest + Supertest (testing)
- Swagger (OpenAPI) para documentación
- Docker + docker-compose

## Setup

### 1. Requisitos

- Node.js 20+
- PostgreSQL 14+ (o Docker)

### 2. Instalar dependencias

```bash
npm install
```

### 3. Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

```bash
cp .env.example .env
```

### 4. Base de datos

Con Docker (recomendado para desarrollo local):

```bash
docker compose up -d db
```

O usa tu propio PostgreSQL y ajusta `DATABASE_URL` en `.env`.

Luego aplica las migraciones:

```bash
npm run prisma:migrate -- --name init
```

(Opcional) cargar datos de ejemplo:

```bash
npm run prisma:seed
```

### 5. Levantar el servidor

```bash
npm run dev
```

- API: http://localhost:3000
- Health check: http://localhost:3000/health
- Swagger docs: http://localhost:3000/api-docs

## Tests

Hay dos tipos de tests, separados por carpeta:

- **`tests/unit/`** — Prisma mockeado (`jest.mock("../config/database")`); no requieren base de datos. Cubren utils, validadores Joi, middlewares y la lógica de negocio de cada `service` (cálculo de balance, streak de metas, % de progreso de proyectos, etc.). **114 tests, corren en unos segundos.**
- **`tests/integration/`** — Supertest contra la app real + Postgres. Usan la base de datos de `DATABASE_URL` y la limpian entre tests (`beforeEach`). Usa una base de datos de desarrollo/test dedicada, no producción.

```bash
npm test                 # unit + integration (requiere Postgres levantado)
npx jest tests/unit       # solo unitarios, sin BD
npm run test:coverage
```

> Nota: `authMiddleware`/`jwt` en los tests unitarios leen `JWT_SECRET` etc. desde `.env` (cargado vía `dotenv/config` en `jest.config.js`), así que necesitas tener un `.env` (aunque sea con los valores de `.env.example`) incluso para correr solo los tests unitarios.

## Estructura del proyecto

```
src/
├── config/         # environment, database (Prisma client), swagger
├── middlewares/     # auth, validación, manejo de errores
├── routes/          # rutas agrupadas por módulo + anotaciones Swagger
├── controllers/      # capa HTTP (thin), delega a services
├── services/          # lógica de negocio
├── validators/         # esquemas Joi
├── utils/               # jwt, password, dateHelpers, logger, errores
├── app.ts                # configuración de Express (sin listen, testeable)
└── index.ts               # entry point (listen)
prisma/
├── schema.prisma           # 7 modelos: User, Event, Goal, GoalProgress,
│                              Transaction, SavingsGoal, Project, ProjectTask,
│                              Hobby, HobbySession
└── seed.ts
tests/
├── unit/                    # utils, validators, middlewares, services (Prisma mockeado)
└── integration/             # Supertest end-to-end por módulo (requiere Postgres)
```

## Endpoints implementados (Sprint 1)

### Auth
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/register` | - | Registro de usuario |
| POST | `/auth/login` | - | Login, retorna `token` + `refreshToken` |
| POST | `/auth/refresh` | - | Refresca el access token a partir de un refresh token válido |

### Agenda
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/agenda/day/:date` | JWT | Eventos del día (`?type=` opcional) |
| GET | `/agenda/week/:date` | JWT | Eventos de la semana (`?type=` opcional) |
| POST | `/agenda/events` | JWT | Crear evento |
| PUT | `/agenda/events/:id` | JWT | Editar evento (requiere ser el dueño) |
| DELETE | `/agenda/events/:id` | JWT | Eliminar evento (requiere ser el dueño) |

### Metas (Goals)
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/goals` | JWT | Lista metas (`?status=active\|completed\|all`, default `active`) |
| GET | `/goals/:id` | JWT | Detalle de una meta + histórico de progreso |
| POST | `/goals` | JWT | Crear meta (`periodEnd` se calcula automáticamente si no se indica) |
| PUT | `/goals/:id` | JWT | Editar meta |
| DELETE | `/goals/:id` | JWT | Eliminar meta |
| POST | `/goals/:id/progress` | JWT | Registrar progreso; marca `completed` y devuelve `bonusPointsAwarded` al alcanzar el objetivo |
| GET | `/goals/:id/analytics` | JWT | % completado, racha (`streakDays`), ritmo requerido y alerta `atRisk` |

### Finanzas (Finance)
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/finance/balance/:month/:year` | JWT | Balance del mes (ingresos - gastos) |
| GET | `/finance/balance/year/:year` | JWT | Balance anual + desglose mensual |
| GET | `/finance/transactions` | JWT | Historial filtrable (`type`, `category`, `from`, `to`, `page`, `limit`) |
| POST | `/finance/transactions` | JWT | Registrar ingreso/gasto |
| PUT | `/finance/transactions/:id` | JWT | Editar transacción (requiere ser el dueño) |
| DELETE | `/finance/transactions/:id` | JWT | Eliminar transacción (requiere ser el dueño) |
| GET | `/finance/savings-goals` | JWT | Metas de ahorro con `currentAmount`/`progressPercent` calculados a partir de las transacciones de esa categoría |
| POST | `/finance/savings-goals` | JWT | Crear meta de ahorro |
| GET | `/finance/analytics` | JWT | Top 5 categorías de gasto del mes, tendencia de 6 meses y proyección anual |

### Proyectos (Projects)
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/projects` | JWT | Lista proyectos (`?status=`, `?priority=`) |
| GET | `/projects/:id` | JWT | Detalle + tareas + progreso (`{ total, completed, percent }`) |
| POST | `/projects` | JWT | Crear proyecto (`status` default `idea`, `priority` default `medium`) |
| PUT | `/projects/:id` | JWT | Editar proyecto |
| DELETE | `/projects/:id` | JWT | Eliminar proyecto |
| GET | `/projects/:id/progress` | JWT | % de tareas completadas |
| POST | `/projects/:id/tasks` | JWT | Agregar tarea |
| PUT | `/projects/:id/tasks/:taskId` | JWT | Editar título de tarea |
| PUT | `/projects/:id/tasks/:taskId/complete` | JWT | Marcar tarea como completada |

### Hobbies
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/hobbies` | JWT | Lista hobbies |
| POST | `/hobbies` | JWT | Crear hobby (`category`: reading/gaming/music/sports/art) |
| PUT | `/hobbies/:id` | JWT | Editar hobby |
| DELETE | `/hobbies/:id` | JWT | Eliminar hobby |
| POST | `/hobbies/:id/sessions` | JWT | Registrar sesión (duración, fecha, notas) |
| GET | `/hobbies/:id/analytics` | JWT | Horas totales, nº de sesiones, últimas 5 sesiones |
| GET | `/hobbies/category/:category` | JWT | Filtrar hobbies por categoría |

Todas las rutas protegidas esperan `Authorization: Bearer <token>`.

## Roadmap

Según `Life_Organizer_API_Especificacion.docx` y `Life_Organizer_Seguimiento_Semanal.docx`:

- [x] **Sprint 1** — Setup, Auth (register/login/refresh), Agenda CRUD + tests
- [x] **Sprint 2** — Metas (Goal + GoalProgress) y Finanzas (Transaction + SavingsGoal) + tests
- [x] **Sprint 3** — Proyectos (Project + ProjectTask) y Hobbies (Hobby + HobbySession) + tests
- [x] **Sprint 4** — 114 tests unitarios (Prisma mockeado, corren sin BD) + validadores/middlewares/servicios cubiertos; ESLint configurado; rate limiting reforzado (límite estricto en `/auth`); `trust proxy` y límite de tamaño de body; optimización de queries N+1 en Finanzas (balance anual, analytics, savings-goals: de ~25 consultas a 1-2)
- [x] **Sprint 5** — CI/CD con GitHub Actions (lint + typecheck + tests con Postgres real + build, en cada push/PR); `render.yaml` para deploy con un clic en Render; guía paso a paso para Railway y Render ([DEPLOYMENT.md](DEPLOYMENT.md)); dashboard demo en [dashboard/](dashboard) (React + TS + Vite) con login, agenda semanal, metas, finanzas (balance + gráfico + top categorías), proyectos y hobbies

## Deployment y dashboard (Sprint 5)

- **CI**: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — en cada push/PR a `main`/`master` corre lint, typecheck, tests de integración contra un Postgres real (contenedor de servicio de GitHub Actions) con cobertura, build de la API y build del dashboard.
- **Deployment**: ver [DEPLOYMENT.md](DEPLOYMENT.md) para Railway (recomendado) o Render (usa [`render.yaml`](render.yaml) como blueprint). Ninguno de los dos lo hice yo — necesitas tu propia cuenta; los pasos están documentados para que los seas tú quien los ejecute.
- **Dashboard**: ver [dashboard/README.md](dashboard/README.md) para correrlo localmente contra la API.

El esquema de base de datos (`prisma/schema.prisma`) ya incluye **los 7 modelos completos** de la especificación, así que los siguientes sprints solo añaden rutas/controllers/services — no requieren cambios estructurales grandes en la BD.

## Notas de diseño

- **App vs. entry point**: `app.ts` exporta la app de Express configurada (sin `listen`), para que los tests de Supertest no levanten un servidor real. `index.ts` es el único punto que llama `.listen()`.
- **Refresh tokens**: implementación stateless (JWT firmado con secreto distinto y expiración más larga), sin tabla en BD. Es un enfoque simple y suficiente para este proyecto; si se necesita revocación de tokens, se puede añadir una tabla `RefreshToken` más adelante.
- **Autorización por recurso**: los endpoints de edición/borrado verifican que el recurso pertenezca al usuario autenticado (403 si no).
- **Metas de ahorro (`SavingsGoal.currentAmount`)**: se calcula dinámicamente en cada lectura como `Σ ingresos - Σ gastos` de las transacciones cuya `category` coincide con la de la meta, en vez de mantenerse como contador manual — así siempre refleja el estado real sin necesitar sincronización en cada escritura de `Transaction`.
- **Bonificaciones de metas**: `Goal.bonusPoints` se marca como otorgado (`bonusPointsAwarded` en la respuesta de `POST /goals/:id/progress`) al completar la meta, pero no existe todavía un "monedero" de puntos por usuario en el esquema — si se quiere un total acumulado, se puede agregar sumando `bonusPoints` de las metas completadas, o añadir un campo `User.points` en un sprint futuro.
- **Racha (streak)** en `/goals/:id/analytics`: cuenta días consecutivos con al menos un registro de progreso, empezando hoy hacia atrás.
- **Tiempo estimado vs. real (Proyectos)**: la funcionalidad se menciona en la especificación, pero el esquema de `ProjectTask` (sección 4 del documento) no define campos para ello; no se implementó para no desviarse del schema acordado. Se puede añadir en un sprint futuro (`estimatedMinutes`/`actualMinutes` en `ProjectTask`) si se necesita.
- **`PUT /projects/:id/tasks/:taskId/complete`** marca la tarea como completada (idempotente); no hay endpoint para "descompletarla" — si se necesita, se puede reutilizar `PUT /projects/:id/tasks/:taskId` añadiendo `completed` al validador.
- **Bug real encontrado y corregido en Sprint 4**: `AppError` (en `utils/errorHandler.ts`) llamaba `Object.setPrototypeOf(this, AppError.prototype)` en su constructor — un workaround típico para que `class extends Error` funcione en target ES5. Como el proyecto compila a ES2020, ese `setPrototypeOf` sobra y además **rompía `instanceof`** para las subclases: `new NotFoundError() instanceof NotFoundError` daba `false` (quedaba como `AppError`). No afectaba las respuestas HTTP (el status code se lee de una propiedad propia, no del prototipo), pero sí rompería cualquier código que discrimine errores por tipo (`catch` específicos, tests). Lo detectaron los tests unitarios nuevos (`.rejects.toThrow(NotFoundError)` fallaba); se corrigió quitando esa línea.
- **Rate limiting en dos niveles**: límite general (`env.rateLimit.*`, configurable) para toda la API, y uno más estricto (20 req / 15 min) solo en `/auth`, para dificultar fuerza bruta sobre login/register. Ambos se desactivan en `NODE_ENV=test` para no interferir con los tests de integración.
- **`trust proxy`** solo se activa en producción (Railway/Render corren detrás de un proxy inverso; sin esto, `express-rate-limit` limitaría por la IP del proxy, no la del cliente real).
