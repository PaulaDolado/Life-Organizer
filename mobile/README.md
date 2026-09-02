# Tidely — Móvil (Fase 2, Agenda + Planificador offline con SQLite)

App Expo/React Native que replica localmente en SQLite el subconjunto de datos de uso diario
más valioso — eventos, tareas/subtareas, hábitos y notas — y sincroniza con el backend (Postgres,
sigue siendo la fuente de verdad) vía `GET /sync/pull` y `POST /sync/push` en cuanto hay conexión.
Ver la sección [Sincronización (Sync)](../API.md#sincronización-sync) de `API.md` para el contrato
completo, y `src/sync/` para cómo lo consume esta app.

## Alcance de esta fase

Tres pestañas tras iniciar sesión (`App.tsx`, `@react-navigation/bottom-tabs`):

- **Hoy**: eventos de hoy (ya expandiendo recurrentes, ver más abajo), tareas con vencimiento hoy
  (toggle hecha/pendiente), hábitos (toggle marcado hoy) y notas rápidas (crear/marcar/borrar).
- **Agenda** (`src/screens/AgendaScreen.tsx`): franja semanal + lista cronológica del día
  seleccionado. CRUD completo de eventos (título, descripción, tipo, horario, ubicación,
  recurrencia, avisos, invitados) — crear/editar/borrar funcionan sin conexión.
- **Planificador** (`src/screens/PlanificadorScreen.tsx`): un único tablero (el "planner por
  defecto" del usuario — el mismo fallback que ya usaba el backend de sync antes de que existiera
  el concepto de multi-tablero), 3 secciones fijas (Por hacer / En progreso / Hecho). CRUD
  completo de tareas (título, descripción, prioridad, fecha límite, tags, estado) y subtareas.
  Cambiar de sección es un botón, no arrastrar — más natural en pantalla de teléfono; el `order`
  fraccionario se calcula igual que `moveTask` en `dashboard/src/pages/PlanificadorPage.tsx`, así
  que no rompe el orden con lo creado desde la web.

La pantalla de login incluye también el registro (mismo toggle que
`dashboard/src/pages/LoginPage.tsx`).

**Explícitamente fuera de alcance** (quedan solo en web por ahora — extenderlas reutilizaría el
mismo mecanismo de `src/db/`+`src/sync/`, igual que esta fase reutilizó el de Fase 1):
notificaciones locales programadas para los avisos de evento (`expo-notifications` — los minutos
se guardan/sincronizan como dato, pero no se programa ninguna notificación nativa); excepciones
por-ocurrencia de un evento recurrente (mover/cancelar solo una vez — se leen y se aplican al
expandir, pero no se crean desde el móvil); import/export ICS; integración Google Calendar; panel
de tiempo libre; vistas mes/año de Agenda; selector de tablero / múltiples tableros y campos
personalizados del Planificador; imagen y seguimiento de tiempo (`estimatedMinutes`/
`actualMinutes`) de una tarea; vincular una tarea a un proyecto; reordenar tareas por arrastre
dentro de una columna (se puede añadir después con `react-native-draggable-flatlist` sin tocar el
backend). Proyectos, Finanzas, Hobbies, Objetivos y Horario también siguen sin pantalla propia.

## Cómo funciona el offline

- **Todas las escrituras del usuario van primero a SQLite local** (`src/db/`), nunca directas a
  la red — la UI se actualiza al instante, esté o no haya conexión.
- **`src/sync/index.ts` → `runSync()`** sube los cambios pendientes (`push`) y luego baja lo
  nuevo del servidor (`pull`), en ese orden — así el pull de cada ronda ya refleja los cambios
  que el propio push acaba de confirmar. Se dispara al abrir la app y al entrar en cada pestaña,
  al recuperar conexión (`@react-native-community/netinfo`), y cada 60s en primer plano mientras
  la pestaña "Hoy" está montada (React Navigation no desmonta las pestañas inactivas, así que su
  intervalo sigue corriendo aunque estés en Agenda o Planificador).
- **Conflictos**: last-write-wins, resuelto por el servidor (ver `API.md`) — si una edición local
  se descarta por ser más antigua que la del servidor, el siguiente pull trae la versión
  autoritativa sin que el móvil tenga que hacer nada especial.
- **`events`, `tasks` y `subtasks` pueden crearse offline** con el mismo patrón que `notes` ya
  usaba en Fase 1: `id` es un uuid (`expo-crypto`) mientras la fila no existe en el servidor,
  sustituido por el id de servidor (como texto) en cuanto se sincroniza; `synced`/`pendingOp`
  llevan la cuenta de qué falta subir. Ver los comentarios en `src/db/eventsRepo.ts`,
  `src/db/tasksRepo.ts`, `src/db/subtasksRepo.ts` y `src/types.ts`.
- **Una subtarea de una tarea creada offline no puede subirse hasta que esa tarea ya tenga id de
  servidor** (el backend exige un `taskId` numérico) — se queda pendiente y se reasigna sola
  (`subtasksRepo.reparentSubtasks`) en cuanto la tarea padre sincroniza; en la práctica tarda como
  mucho un ciclo de sync (≤60s con conexión).
- **Recurrencia**: `src/utils/recurrence.ts` es un puerto directo de la lógica de expansión del
  backend (`src/utils/recurrence.ts` ahí) — el pull solo trae la fila "plantilla" de un evento
  recurrente (nunca ocurrencias ya expandidas, igual que hace el propio backend al sincronizar),
  así que expandirlas para la semana visible es responsabilidad del cliente. Simplificación
  deliberada: usa fronteras de día en UTC (mismo criterio que `todayKey()`), no el timezone real
  del usuario como sí hace el backend para sus vistas `/agenda/*`.

## Setup

```bash
cd mobile
npm install
```

Configura la URL del backend en un `.env` (no versionado) — Expo incrusta automáticamente
cualquier variable con el prefijo `EXPO_PUBLIC_`:

```bash
# .env
EXPO_PUBLIC_API_URL=http://localhost:3000       # iOS Simulator
# EXPO_PUBLIC_API_URL=http://10.0.2.2:3000      # Emulador Android
# EXPO_PUBLIC_API_URL=http://192.168.1.X:3000   # Dispositivo físico — IP de tu máquina en la LAN
```

```bash
npx expo start
```

Escanea el QR con Expo Go, o pulsa `a`/`i` para abrir en un emulador Android/iOS ya configurado.
Inicia sesión con una cuenta ya creada en el dashboard web (o la demo: `demo@lifeorganizer.dev` /
`Password123`, si corriste `npm run prisma:seed` en el backend).

> Si ya tenías la Fase 1 instalada: el esquema de SQLite cambió (`events`/`tasks` pasan a usar un
> id de texto para poder crearse offline) y la app abre un fichero de base de datos nuevo
> (`life-organizer-v2.db`) — no hace falta ninguna migración manual, simplemente empieza con una
> caché local vacía que el primer `runSync()` rellena de nuevo.

## Verificado desde este entorno / lo que falta probar en un dispositivo real

Sin emulador ni dispositivo físico conectado a este entorno, se verificó lo que no requiere
nativo: `npx tsc --noEmit` sin errores, y que Metro compila el bundle completo para plataforma
nativa (`platform=ios`) sin fallos de resolución de módulos ni de sintaxis, incluyendo las
pantallas y dependencias nuevas (`@react-navigation/bottom-tabs`,
`@react-native-community/datetimepicker`). `expo-sqlite` es un módulo nativo — no funciona en el
target web de Expo, así que el flujo real de guardado/sync offline (SQLite, SecureStore, NetInfo)
**no se ha probado end-to-end** y debe verificarse en tu propio teléfono o emulador antes de darlo
por bueno. En concreto, sin dispositivo real tampoco se ha podido probar: el selector nativo de
fecha/hora (`@react-native-community/datetimepicker`) en Android (su UI difiere bastante de iOS —
en Android abre un diálogo modal por cada `mode`, nunca "inline"), la expansión de recurrencia con
datos reales de varios años, ni el reparto de subtareas al sincronizar una tarea recién creada.
