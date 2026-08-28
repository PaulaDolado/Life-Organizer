# Life Organizer — Móvil (Fase 1, offline con SQLite)

App Expo/React Native que replica localmente en SQLite el subconjunto de datos de uso diario
más valioso — eventos, tareas, hábitos y notas — y sincroniza con el backend (Postgres, sigue
siendo la fuente de verdad) vía `GET /sync/pull` y `POST /sync/push` en cuanto hay conexión. Ver
la sección [Sincronización (Sync)](../API.md#sincronización-sync) de `API.md` para el contrato
completo, y `src/sync/` para cómo lo consume esta app.

## Alcance de esta fase

Una única pantalla ("Hoy") tras iniciar sesión: eventos de hoy (solo lectura), tareas con
vencimiento hoy (toggle hecha/pendiente), hábitos (toggle marcado hoy) y notas rápidas
(crear/marcar/borrar) — todo funciona sin conexión, escribiendo primero en SQLite y
sincronizando después. **No hay registro** (la cuenta se crea desde el dashboard web) ni vista
semanal/mensual de Agenda, tablero del Planificador, Proyectos, Finanzas, Hobbies u Objetivos —
quedan solo en web por ahora; extenderlos reutilizaría el mismo mecanismo de `src/sync/`.

## Cómo funciona el offline

- **Todas las escrituras del usuario van primero a SQLite local** (`src/db/`), nunca directas a
  la red — la UI se actualiza al instante, esté o no haya conexión.
- **`src/sync/index.ts` → `runSync()`** sube los cambios pendientes (`push`) y luego baja lo
  nuevo del servidor (`pull`), en ese orden — así el pull de cada ronda ya refleja los cambios
  que el propio push acaba de confirmar. Se dispara al abrir la app, al recuperar conexión
  (`@react-native-community/netinfo`), cada 60s en primer plano, y con el botón manual de la
  pantalla "Hoy".
- **Conflictos**: last-write-wins, resuelto por el servidor (ver `API.md`) — si una edición local
  se descarta por ser más antigua que la del servidor, el siguiente pull trae la versión
  autoritativa sin que el móvil tenga que hacer nada especial.
- **Solo `notes` necesita el baile de id local→id de servidor** (crear offline genera un `id`
  provisional con `expo-crypto`; el resto de tablas —eventos, tareas, hábitos, registros de
  hábito— nunca se crean desde el móvil o se identifican por clave compuesta, así que no lo
  necesitan). Ver los comentarios en `src/db/notesRepo.ts` y `src/types.ts`.

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

## Verificado desde este entorno / lo que falta probar en un dispositivo real

Sin emulador ni dispositivo físico conectado a este entorno, se verificó lo que no requiere
nativo: `npx tsc --noEmit` sin errores, y que Metro compila el bundle completo para plataforma
nativa (`platform=ios`) sin fallos de resolución de módulos ni de sintaxis. `expo-sqlite` es un
módulo nativo — no funciona en el target web de Expo, así que el flujo real de guardado/sync
offline (SQLite, SecureStore, NetInfo) **no se ha probado end-to-end** y debe verificarse en tu
propio teléfono o emulador antes de darlo por bueno.
