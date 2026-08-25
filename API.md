# Referencia de la API

Documentación interactiva (Swagger/OpenAPI) disponible en `/api-docs` con el servidor corriendo. Esto es la referencia estática, para leer sin levantar nada.

Todas las rutas salvo `/auth/register`, `/auth/login` y `/auth/refresh` requieren `Authorization: Bearer <token>`. Todas devuelven 401 sin token válido, y los endpoints de edición/borrado devuelven 403 si el recurso no pertenece al usuario autenticado.

## Paginación

Todos los listados (`/goals`, `/projects`, `/hobbies`, `/hobbies/category/:category`, `/agenda/day`, `/agenda/week`, `/finance/transactions`, `/notifications`) aceptan `?page=` (default 1) y `?limit=` (default 20, excepto agenda que usa 50 — el tamaño natural de "eventos en un día/semana"). La respuesta siempre incluye:

```json
{ "pagination": { "page": 1, "limit": 20, "total": 42, "pages": 3 } }
```

## Auth

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/register` | - | Registro. Body: `email`, `password` (min 8), `name`, `timezone?` (zona IANA, default `Europe/Madrid`) |
| POST | `/auth/login` | - | Login, retorna `token` + `refreshToken` |
| POST | `/auth/refresh` | - | Nuevo `token`+`refreshToken` a partir de un `refreshToken` válido |
| GET | `/auth/me` | JWT | Perfil: `{ id, email, name, timezone }` |
| PUT | `/auth/me` | JWT | Actualiza `name` y/o `timezone` |

## Agenda

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/agenda/day/:date` | JWT | Eventos del día (`YYYY-MM-DD`), en la timezone del usuario. `?type=`, `?page=`, `?limit=` |
| GET | `/agenda/week/:date` | JWT | Eventos de la semana que contiene esa fecha (lunes-domingo). Mismos filtros |
| POST | `/agenda/events` | JWT | Crea evento. `isRecurring`+`recurringPattern` (`weekly`\|`biweekly`\|`monthly`) para series recurrentes |
| PUT | `/agenda/events/:id` | JWT | Edita — afecta a **toda la serie** si es recurrente |
| DELETE | `/agenda/events/:id` | JWT | Elimina — **toda la serie** si es recurrente |

Los eventos recurrentes se expanden al vuelo: la respuesta mezcla eventos reales y ocurrencias virtuales (`isRecurringInstance: true`), todas con el mismo `id` de la plantilla. Ver [ARCHITECTURE.md](ARCHITECTURE.md#eventos-recurrentes-expansión-virtual).

## Metas (Goals)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/goals` | JWT | `?status=active\|completed\|expired\|all` (default `active` = ni completada ni expirada), `?page=`, `?limit=` |
| GET | `/goals/:id` | JWT | Detalle + histórico de `GoalProgress` |
| POST | `/goals` | JWT | Crea meta. `periodEnd` se calcula solo si no se indica. `autoRenew` (default `true`): al vencer, crea sola la del siguiente periodo |
| PUT | `/goals/:id` | JWT | Edita (no se puede cambiar `period`) |
| DELETE | `/goals/:id` | JWT | Elimina |
| POST | `/goals/:id/progress` | JWT | Registra progreso (`value` entero, puede ser negativo para correcciones). Devuelve `justCompleted`+`bonusPointsAwarded` |
| GET | `/goals/:id/analytics` | JWT | `percentComplete`, `streakDays`, `daysRemaining`, `requiredPacePerDay`, `atRisk` |

Una meta que pasa su `periodEnd` sin completarse queda `expired=true` automáticamente (scheduler cada hora) y deja de contar como `active`; si `autoRenew`, se crea la del siguiente periodo con progreso en cero.

## Finanzas (Finance)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/finance/balance/:month/:year` | JWT | Balance del mes (`income`, `expense`, `balance`) |
| GET | `/finance/balance/year/:year` | JWT | Balance anual + `monthlyBreakdown` (12 meses) |
| GET | `/finance/transactions` | JWT | Filtros: `type`, `category`, `from`, `to`, `page`, `limit` |
| POST | `/finance/transactions` | JWT | Registra ingreso/gasto |
| PUT | `/finance/transactions/:id` | JWT | Edita |
| DELETE | `/finance/transactions/:id` | JWT | Elimina |
| GET | `/finance/savings-goals` | JWT | `currentAmount`/`progressPercent` calculados dinámicamente (no guardados) |
| POST | `/finance/savings-goals` | JWT | Crea meta de ahorro (`stepAmount`: € por "casilla" en el dashboard, default 100) |
| DELETE | `/finance/savings-goals/:id` | JWT | Elimina meta de ahorro |
| POST | `/finance/savings-goals/:id/contribute` | JWT | Asigna (`amount` > 0) o retira (`amount` < 0) dinero — crea una transacción real (`income`/`expense`) en la categoría de la meta. Es lo que dispara cada clic de casilla en el dashboard |
| GET | `/finance/analytics` | JWT | Top 5 categorías del mes, tendencia de 6 meses, proyección anual |

## Proyectos (Projects)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/projects` | JWT | `?status=`, `?priority=`, `?page=`, `?limit=` |
| GET | `/projects/:id` | JWT | Detalle + tareas + `{ total, completed, percent }` |
| POST | `/projects` | JWT | `status` default `idea`, `priority` default `medium` |
| PUT | `/projects/:id` | JWT | Edita |
| DELETE | `/projects/:id` | JWT | Elimina |
| GET | `/projects/:id/progress` | JWT | Solo el `{ total, completed, percent }` |
| POST | `/projects/:id/tasks` | JWT | Agrega tarea |
| PUT | `/projects/:id/tasks/:taskId` | JWT | Edita el título |
| PUT | `/projects/:id/tasks/:taskId/complete` | JWT | Marca completada (no hay endpoint para "descompletar") |

## Hobbies

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/hobbies` | JWT | `?page=`, `?limit=` |
| POST | `/hobbies` | JWT | `category`: `reading`\|`gaming`\|`music`\|`sports`\|`art` |
| PUT | `/hobbies/:id` | JWT | Edita |
| DELETE | `/hobbies/:id` | JWT | Elimina |
| POST | `/hobbies/:id/sessions` | JWT | Registra sesión (duración, fecha, notas) |
| GET | `/hobbies/:id/analytics` | JWT | Horas totales, nº sesiones, últimas 5 |
| GET | `/hobbies/category/:category` | JWT | Filtra por categoría (`?page=`, `?limit=`) |

## Notificaciones (Notifications)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/notifications` | JWT | `?unreadOnly=true`, `?page=`, `?limit=` |
| GET | `/notifications/unread-count` | JWT | `{ unreadCount }` |
| PUT | `/notifications/:id/read` | JWT | Marca una como leída |
| PUT | `/notifications/read-all` | JWT | Marca todas como leídas |
| DELETE | `/notifications/:id` | JWT | Elimina |

Las crean solo los schedulers (`event_reminder`, `goal_at_risk`), nunca el usuario directamente — no hay `POST /notifications`.

## Otras rutas

| Ruta | Descripción |
|---|---|
| `GET /health` | Healthcheck simple (`{ status: "OK" }`) |
| `GET /api-docs` | Swagger UI |
