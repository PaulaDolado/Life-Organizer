# Testing

## Dos tipos de test, separados por carpeta

- **`tests/unit/`** — Prisma mockeado (`jest.mock("../config/database")`). No requieren base de datos, corren en segundos. Cubren `utils/`, `validators/` (esquemas Joi), `middlewares/`, y la lógica de negocio de cada `service` (cálculo de balance, streak de metas, expansión de recurrencia, dedup de notificaciones, expiración/renovación de metas, etc.). **189 tests.**
- **`tests/integration/`** — Supertest contra la app real (`app.ts`) + Postgres real. Se limpian entre tests (`beforeEach`). Cubren cada módulo end-to-end: request HTTP → controller → service → BD → respuesta.

```bash
npm test                    # unit + integration (requiere Postgres levantado)
npx jest tests/unit          # solo unitarios, sin BD
npm run test:coverage
```

Levantar Postgres para los tests de integración:

```bash
docker compose up -d db
npm run prisma:migrate -- --name init   # o el nombre que corresponda si ya migraste antes
npm test
```

> Los tests unitarios también necesitan un `.env` (aunque sea con los valores de `.env.example`) — `authMiddleware`/`jwt` leen `JWT_SECRET` etc. vía `dotenv/config` en `jest.config.js`, y eso falla si no hay `.env` en absoluto.

## Qué cubre cada carpeta de `tests/unit/`

| Carpeta | Qué prueba |
|---|---|
| `utils/` | `jwt` (firma/verificación, secretos distintos access/refresh), `password` (hash/compare), `dateHelpers` (rangos de día/semana **por timezone**), `recurrence` (expansión de eventos recurrentes, weekly/biweekly/monthly, drift de meses cortos), `timezone` (validación de zonas IANA), `errorHandler` (jerarquía de clases de error) |
| `validators/` | Cada schema Joi: casos válidos e inválidos, defaults, mensajes de error |
| `middlewares/` | `validate()` (saneo con `stripUnknown`, propagación de error), `authMiddleware` (token ausente/inválido/válido) |
| `services/` | Lógica de negocio de cada módulo con Prisma mockeado — incluye `computeGoalRisk`, `expandRecurringEvent` vs `nextOccurrenceStartingIn`, dedup de `notificationService`, idempotencia de `goalExpiryService` |

## Bugs reales que atraparon los tests

Vale la pena documentarlos porque son la prueba de que la suite de tests hace algo más que inflar un número de cobertura — encontraron comportamiento roto **antes** de que llegara a `main`.

### 1. `instanceof` roto en las subclases de error

`AppError` (en `utils/errorHandler.ts`) llamaba `Object.setPrototypeOf(this, AppError.prototype)` en su constructor — un workaround típico para que `class extends Error` funcione en target ES5. El proyecto compila a ES2020, donde ese workaround sobra y además **rompía `instanceof`** para las subclases: `new NotFoundError() instanceof NotFoundError` daba `false` (quedaba como `AppError` genérico). No afectaba las respuestas HTTP (el status code se lee de una propiedad propia, no del prototipo), pero sí cualquier código que discrimine errores por tipo. Lo detectaron los tests unitarios de los services (`.rejects.toThrow(NotFoundError)` fallaba en cadena). Corregido quitando esa línea.

### 2. Recordatorios de eventos recurrentes que nunca se habrían disparado

El scheduler de notificaciones reutilizaba `expandRecurringEvent` (pensada para vistas de agenda, donde el rango es un día/semana — mucho más ancho que la duración de un evento) para preguntar "¿hay una ocurrencia en los próximos 30 minutos?". Esa función exige que la ocurrencia **completa** (inicio y fin) quepa en el rango pedido; con una ventana de recordatorio de ~10 minutos, un evento de 1 hora **jamás** habría calzado, así que ningún evento recurrente habría generado nunca un recordatorio — un bug 100% silencioso, sin error, solo comportamiento ausente. Lo detectó un test que comparaba explícitamente el resultado de ambas funciones sobre el mismo caso. Se separó la semántica en `expandRecurringEvent` (contención completa, agenda) y `nextOccurrenceStartingIn` (solo el inicio debe caer en el rango, recordatorios).

### 3. Drift de recurrencia mensual en meses cortos

La primera versión de la expansión de recurrencia encadenaba `addMonths` desde la ocurrencia anterior (`cursor = addMonths(cursor, 1)`). Para un evento anclado el día 31, esto hace que en febrero se "clampe" a 28 — y como el siguiente `addMonths` parte de ese 28 (no del 31 original), marzo se queda en 28 también, para siempre, en vez de volver a 31. Un test que verificaba tres meses seguidos (enero 31 → febrero 28 → marzo 31) lo hizo evidente de inmediato. Se corrigió calculando cada ocurrencia siempre desde la fecha original (`addMonths(originalStart, n)`).

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada push/PR a `main`/`master`: lint (ESLint) → typecheck (`tsc --noEmit`) → migraciones contra un Postgres real (servicio de GitHub Actions) → suite completa con cobertura → build de la API → build del dashboard (job separado). El reporte de cobertura se sube como artifact de la ejecución.
