# Life Organizer API

API REST de organización personal integral: **Agenda · Metas · Finanzas · Proyectos · Hobbies**, con notificaciones automáticas y eventos recurrentes de verdad.

> Estado: **Sprints 1-5 completos** + hardening post-sprint (notificaciones, recurrencia real, paginación, timezone). Los 5 módulos de negocio + notificaciones están implementados, testeados (189 tests unitarios + integración) y endurecidos.
>
> ⚠️ **Deployment real requiere acción tuya**: no puedo crear una cuenta en Railway/Render ni desplegar en tu nombre. Todo lo necesario — Dockerfile, `render.yaml`, CI, guía paso a paso — está listo en [DEPLOYMENT.md](DEPLOYMENT.md).

## Documentación

| Documento | Contenido |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Estructura de carpetas, flujo request→response, auth, schedulers, zonas horarias, decisiones de diseño |
| [API.md](API.md) | Referencia completa de endpoints por módulo (o `/api-docs` con el servidor corriendo, para Swagger interactivo) |
| [DATABASE.md](DATABASE.md) | ERD, los 11 modelos y sus relaciones, índices, migraciones |
| [TESTING.md](TESTING.md) | Cómo correr los tests, qué cubre cada carpeta, bugs reales que atraparon los tests |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Guía paso a paso para desplegar en Railway o Render |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Convenciones de código, checklist para añadir un módulo nuevo |
| [dashboard/README.md](dashboard/README.md) | Dashboard demo en React — cómo correrlo localmente |
| [mobile/README.md](mobile/README.md) | App móvil (Expo/React Native) offline con SQLite — Fase 1, cómo correrla localmente |

## Stack

- Node.js 20+ / TypeScript
- Express.js
- Prisma ORM + PostgreSQL
- JWT (access + refresh) + bcrypt
- Joi (validación)
- `node-cron` (notificaciones + expiración de metas, en proceso)
- Jest + Supertest (testing)
- Swagger (OpenAPI)
- Docker + docker-compose

## Setup

```bash
npm install
cp .env.example .env              # ajusta los valores, sobre todo si no usas Docker
docker compose up -d db           # o tu propio Postgres, ajustando DATABASE_URL
npm run prisma:migrate -- --name init
npm run prisma:seed               # opcional: crea demo@lifeorganizer.dev / Password123
npm run dev
```

- API: http://localhost:3000 · Health check: `/health` · Swagger: `/api-docs`

## Tests

```bash
npm test                 # unit + integration (requiere Postgres levantado)
npx jest tests/unit       # solo unitarios, sin BD, corren en segundos
npm run test:coverage
```

Detalle completo (qué cubre cada carpeta, bugs reales encontrados por los tests) en [TESTING.md](TESTING.md).

## Roadmap

- [x] **Sprint 1** — Setup, Auth, Agenda CRUD + tests
- [x] **Sprint 2** — Metas + Finanzas + tests
- [x] **Sprint 3** — Proyectos + Hobbies + tests
- [x] **Sprint 4** — Tests unitarios, ESLint, rate limiting, optimización de queries N+1
- [x] **Sprint 5** — CI/CD, deployment config (Railway/Render), dashboard demo en React
- [x] **Post-Sprint-5** — Notificaciones (recordatorios + alertas), eventos recurrentes reales, paginación en todos los listados, timezone del usuario aplicada en Agenda, expiración/auto-renovación de metas, documentación separada en archivos dedicados
- [x] **Rediseño del dashboard** — nueva identidad visual (paleta oklch, Tailwind v4, Outfit + Instrument Serif) adaptada de [difarmed/life-weaver-pro-23](https://github.com/difarmed/life-weaver-pro-23), con las 5 páginas (Agenda, Metas, Finanzas, Proyectos, Hobbies) más notificaciones — ver [dashboard/README.md](dashboard/README.md#origen-del-diseño-y-qué-se-adaptó) para qué se adoptó tal cual y qué se adaptó a nuestra API
- [x] **Sync offline + app móvil (Fase 1)** — `/sync/pull` y `/sync/push` (tombstones para borrados, last-write-wins para conflictos) cubriendo Eventos, Tareas/Subtareas, Notas y Hábitos; app Expo/React Native nueva en [mobile/](mobile/README.md) con SQLite local y una pantalla "Hoy" que funciona sin conexión — ver [API.md](API.md#sincronización-sync) para el contrato y qué módulos quedan fuera de esta fase

## Nota de seguridad conocida (dependencias)

`npm install` reporta ~10 vulnerabilidades en subdependencias. Ninguna es explotable a través del tráfico HTTP de la API en ejecución — están en herramientas de dev (`@typescript-eslint` vía `minimatch`, ReDoS) o en la descarga del binario nativo de `bcrypt` en tiempo de instalación (`@mapbox/node-pre-gyp` vía `tar`). Arreglarlas requiere subir `@typescript-eslint` a v8 y `node-cron` a v4 (ambos breaking changes) — no los apliqué sin verificar compatibilidad primero; corre `npm audit` para ver el detalle y decide tú si quieres asumir esas actualizaciones.
