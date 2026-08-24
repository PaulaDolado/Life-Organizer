# Life Organizer API

API REST de organización personal integral: **Agenda · Metas · Finanzas · Proyectos · Hobbies**.

> Estado actual: **Sprint 1, 2 y 3 completos** (Setup + Auth + Agenda + Metas + Finanzas + Proyectos + Hobbies). Todos los módulos de negocio de la especificación están implementados. Ver [Roadmap](#roadmap) para lo que falta (Sprint 4: testing exhaustivo/hardening, Sprint 5: deployment + dashboard).

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

Los tests de integración usan la base de datos configurada en `DATABASE_URL` y la limpian entre ejecuciones (`beforeEach`). Usa una base de datos de desarrollo/test dedicada, no producción.

```bash
npm test
npm run test:coverage
```

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
└── integration/             # auth.test.ts, agenda.test.ts
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
- [ ] **Sprint 4** — Tests exhaustivos (80%+ coverage con la BD real; unitarios además de integración), rate limiting (ya base), logging (ya base), optimización de queries, edge cases
- [ ] **Sprint 5** — Deployment (Railway/Render), CI/CD, dashboard React demo

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
