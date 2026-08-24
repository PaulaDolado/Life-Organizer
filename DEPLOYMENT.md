# Deployment

Dos rutas soportadas: **Railway** (recomendada, más simple) y **Render** (usa el `render.yaml` incluido). Ambas construyen la API desde el [Dockerfile](Dockerfile) de este repo.

> Ninguna de las dos requiere tarjeta de crédito en su plan gratuito/hobby actual (verifica al momento de desplegar, las políticas cambian). **Yo no puedo crear la cuenta ni desplegar por ti** — esto son los pasos para que lo hagas tú.

## Opción A: Railway

1. Crea un repo en GitHub y sube este proyecto (`git init && git add . && git commit -m "Initial commit"` dentro de `life-organizer-api/`, luego `git push`).
2. En [railway.app](https://railway.app), **New Project → Deploy from GitHub repo** y selecciona el repo.
3. **Add a service → Database → PostgreSQL** (Railway te da `DATABASE_URL` automáticamente vía variable de referencia).
4. En el servicio de la API, pestaña **Variables**, añade:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}   # referencia automática al servicio de Postgres
   JWT_SECRET=<genera un secreto largo aleatorio>
   JWT_REFRESH_SECRET=<otro secreto distinto>
   NODE_ENV=production
   CORS_ORIGIN=<dominio del dashboard, o * mientras pruebas>
   ```
5. **Settings → Deploy → Custom Start Command** no hace falta tocarlo (usa el `CMD` del Dockerfile). Si quieres correr las migraciones como parte del deploy, añade en **Settings → Deploy Triggers / Pre-Deploy Command**:
   ```
   npx prisma migrate deploy
   ```
   Si tu plan no soporta pre-deploy command, hazlo manualmente una vez desde la pestaña **Shell** del servicio (o desde tu máquina, apuntando `DATABASE_URL` a la BD de producción):
   ```bash
   npx prisma migrate deploy
   ```
6. Railway asigna una URL pública automáticamente (Settings → Networking → Generate Domain). Prueba `https://<tu-app>.up.railway.app/health`.

## Opción B: Render (con `render.yaml`)

1. Sube el repo a GitHub (igual que en el paso 1 de Railway).
2. En [render.com](https://render.com), **New → Blueprint**, apunta al repo — Render detecta [`render.yaml`](render.yaml) y crea automáticamente el servicio web + la base de datos Postgres, con `DATABASE_URL` conectada y `JWT_SECRET`/`JWT_REFRESH_SECRET` generados.
3. Antes del primer deploy exitoso necesitas aplicar las migraciones. Opciones:
   - Si tu plan soporta **Pre-Deploy Command** (Settings del servicio web): `npx prisma migrate deploy`.
   - Si no, entra a **Shell** del servicio ya desplegado y corre `npx prisma migrate deploy` manualmente.
4. Revisa `CORS_ORIGIN` en las variables de entorno del servicio y cámbialo al dominio real del dashboard cuando lo despliegues.
5. Render asigna una URL tipo `https://life-organizer-api.onrender.com`. Prueba `/health` y `/api-docs`.

## Después de desplegar

- **Swagger**: `https://<tu-url>/api-docs`
- **Health check**: `https://<tu-url>/health`
- **Seed de datos demo** (opcional, para tener una cuenta de prueba): corre una vez apuntando `DATABASE_URL` a producción:
  ```bash
  DATABASE_URL="<url-de-produccion>" npm run prisma:seed
  ```
  Crea `demo@lifeorganizer.dev` / `Password123` con un par de eventos de ejemplo.
- **CI**: cada push a `main`/`master` corre lint + typecheck + tests (con Postgres real en un contenedor) vía [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Ese workflow no despliega nada — solo verifica que el código esté sano antes de mergear. Si quieres deploy automático en cada push, tanto Railway como Render lo hacen solos en cuanto conectas el repo (no necesitas un paso extra en GitHub Actions para eso).

## Variables de entorno de producción (checklist)

| Variable | Obligatoria | Notas |
|---|---|---|
| `DATABASE_URL` | Sí | La da el proveedor (Postgres administrado) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Sí | Deben ser distintos entre sí, largos y aleatorios. Nunca reutilices los de `.env.example` |
| `NODE_ENV=production` | Sí | Activa `trust proxy`, logs en JSON, oculta detalles de error 500 |
| `CORS_ORIGIN` | Recomendada | Dominio exacto del dashboard en vez de `*` una vez lo tengas desplegado |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `RATE_LIMIT_*` | No | Tienen defaults razonables en `src/config/environment.ts` |
