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
| GET | `/agenda/month/:date` | JWT | Eventos del mes que contiene esa fecha. Mismos filtros (`?limit=` por defecto 200) |
| GET | `/agenda/free-time/:date` | JWT | Huecos libres del día (08:00–22:00 local) + sugerencias de tareas del Planificador que encajan (ver más abajo) |
| POST | `/agenda/events` | JWT | Crea evento. `isRecurring`+`recurringPattern` (`weekly`\|`biweekly`\|`monthly`) para series recurrentes. `reminderMinutesBefore` (minutos, default `[30]`) y `guests` (nombres/emails, default `[]`) opcionales |
| PUT | `/agenda/events/:id` | JWT | Edita — afecta a **toda la serie** si es recurrente |
| DELETE | `/agenda/events/:id` | JWT | Elimina — **toda la serie** si es recurrente |
| POST | `/agenda/events/:id/exceptions` | JWT | Mueve (`action: "moved"` + `newStartTime`/`newEndTime`) o cancela (`action: "cancelled"`) **una sola ocurrencia** de un evento recurrente, sin tocar el resto de la serie. `originalStartTime` identifica la ocurrencia (400 si el evento no es recurrente) |
| DELETE | `/agenda/events/:id/exceptions/:originalStartTime` | JWT | Revierte la excepción: la ocurrencia vuelve a su horario natural |
| GET | `/agenda/ics` | JWT | Exporta todos los eventos como `.ics` (`Content-Type: text/calendar`) — para Google Calendar/Outlook |
| POST | `/agenda/ics/import` | JWT | Importa eventos desde un `.ics` (`{ ics: "<texto>" }` en el body). Devuelve `{ created, skippedUnparsable, importedAsSingleOccurrence }` |

Los eventos recurrentes se expanden al vuelo: la respuesta mezcla eventos reales y ocurrencias virtuales (`isRecurringInstance: true`), todas con el mismo `id` de la plantilla. Una ocurrencia con excepción aplicada añade `originalStartTime`, `isException: true` y (si se movió) `exceptionStatus: "moved"`. Ver [ARCHITECTURE.md](ARCHITECTURE.md#eventos-recurrentes-expansión-virtual).

Los recordatorios de evento (`Notification` tipo `event_reminder`) usan `reminderMinutesBefore` de cada evento — un evento puede tener varias antelaciones configuradas (p.ej. `[15, 1440]`) y genera un aviso independiente por cada una.

`GET /agenda/free-time/:date` devuelve `{ freeBlocks: [{start, end, durationMinutes}], suggestions: [{block, task}] }`: los huecos ≥15 min entre eventos dentro de 08:00–22:00, y para cada uno (en orden cronológico) la tarea pendiente del Planificador de mayor prioridad con `estimatedMinutes` que quepa y no se haya sugerido ya en otro hueco.

El `.ics` exportado incluye RRULE (recurrencia), EXDATE (ocurrencias canceladas) y un VEVENT con RECURRENCE-ID por cada ocurrencia movida — ver `utils/ics.ts`. El import es best-effort: mapea `FREQ=WEEKLY`/`WEEKLY;INTERVAL=2`/`MONTHLY` a `weekly`/`biweekly`/`monthly` (otra recurrencia se importa como evento único) y no reconstruye excepciones (`RECURRENCE-ID` se ignora).

## Hoy (Today)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/today` | JWT | Vista "Hoy" combinada — eventos de hoy, tareas con `dueDate` hoy, hábitos, notas, últimas entradas de libreta tocadas (última semana) y la racha combinada |

Un único viaje al backend en vez de entrar a Agenda + Planificador + Proyectos por separado (ver `todayService.ts`). Respuesta: `{ date, timezone, events, tasksDueToday, habits, notes, recentProjectEntries, combinedStreak }`.

`recentProjectEntries` son páginas de libreta (`ProjectPage`) editadas o creadas en los últimos 7 días, como mucho 5, con `{ id, projectId, projectTitle, pageTitle, preview (texto plano, 160 car.), updatedAt }` — vacío ([]) si no se ha tocado ninguna libreta recientemente (ver `projectsService.listRecentEntries`).

`combinedStreak` (ver `streakService.ts`): días consecutivos, empezando hoy hacia atrás, en los que se marcaron todos los hábitos activos Y se completaron todas las tareas con vencimiento ese día. Un día sin hábitos ni tareas vencidas ese día se salta (ni cuenta ni rompe la racha).

## Búsqueda (Search)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/search?q=` | JWT | Busca por texto en eventos, tareas, notas y proyectos del usuario (insensible a mayúsculas, `contains`). Máx. 8 resultados por categoría |

Respuesta: `{ query, events, tasks, notes, projects }`, cada uno un array de resultados resumidos (id + campos mínimos para mostrar y navegar).

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
| GET | `/projects/recent-entries` | JWT | Últimas páginas de libreta tocadas (creadas o editadas) en la última semana, de cualquier proyecto — `{ entries: [{ id, projectId, projectTitle, pageTitle, preview, updatedAt }] }`, máx. 5. Usado en Hoy y en Agenda |
| GET | `/projects/:id` | JWT | Detalle + tareas + `{ total, completed, percent }` |
| POST | `/projects` | JWT | `status` default `idea`, `priority` default `medium` |
| PUT | `/projects/:id` | JWT | Edita |
| DELETE | `/projects/:id` | JWT | Elimina |
| GET | `/projects/:id/progress` | JWT | Solo el `{ total, completed, percent }` |
| POST | `/projects/:id/tasks` | JWT | Agrega tarea |
| PUT | `/projects/:id/tasks/:taskId` | JWT | Edita el título |
| PUT | `/projects/:id/tasks/:taskId/complete` | JWT | Marca completada (no hay endpoint para "descompletar") |

## Planificador (Planner)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/planner/tasks` | JWT | Tablero kanban. `?projectId=`, `?tag=` |
| POST | `/planner/tasks` | JWT | `status` default `todo`, `priority` default `medium`. Admite `dueDate`, `tags`, `estimatedMinutes`, `projectId` |
| PUT | `/planner/tasks/:id` | JWT | Edita cualquier campo (título, estado, prioridad, orden, `dueDate`, `tags`, `estimatedMinutes`, `projectId`) |
| DELETE | `/planner/tasks/:id` | JWT | Elimina (cascada sobre sus subtareas) |
| POST | `/planner/tasks/:id/time` | JWT | `{ minutes }` — suma al tiempo real acumulado (`actualMinutes`) |
| POST | `/planner/tasks/:id/subtasks` | JWT | Añade un paso al checklist de la tarea |
| PUT | `/planner/tasks/:id/subtasks/:subtaskId` | JWT | Edita título o `completed` de una subtarea |
| DELETE | `/planner/tasks/:id/subtasks/:subtaskId` | JWT | Elimina una subtarea |

`projectId` es opcional: vincula la tarea a un `Project` existente del mismo usuario (404/403 si no lo es). El recordatorio de `dueDate` lo genera el scheduler de notificaciones, no un endpoint (ver más abajo).

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

Las crean solo los schedulers (`event_reminder`, `goal_at_risk`, `task_due`), nunca el usuario directamente — no hay `POST /notifications`.

## Otras rutas

| Ruta | Descripción |
|---|---|
| `GET /health` | Healthcheck simple (`{ status: "OK" }`) |
| `GET /api-docs` | Swagger UI |
