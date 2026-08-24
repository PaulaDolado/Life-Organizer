# Life Organizer — Dashboard demo

Dashboard demo en React + TypeScript + Vite que consume la [Life Organizer API](../README.md). Es intencionalmente simple (sin router, sin librería de estado, sin librería de gráficos) — suficiente para mostrar el proyecto en un portfolio, no un frontend de producción.

## Qué incluye

- Login / registro / logout (JWT guardado en `localStorage`)
- Vista de agenda semanal (agrupada por día)
- Metas con barra de progreso
- Finanzas: balance del mes, tendencia de 6 meses (gráfico de barras en SVG puro, sin dependencias), top 5 categorías de gasto, proyección anual
- Lista de proyectos con % de progreso (tareas completadas/total)
- Lista de hobbies con horas totales

## Setup

```bash
npm install
cp .env.example .env   # ajusta VITE_API_URL si tu API no corre en localhost:3000
npm run dev
```

Abre http://localhost:5173. Necesitas la API corriendo (`cd ../ && npm run dev`, con Postgres levantado) para poder iniciar sesión de verdad — sin la API, el login muestra un error claro ("No se pudo conectar con la API...") en vez de fallar en silencio.

Para probar rápido, corre el seed de la API (`npm run prisma:seed` en la carpeta raíz) y entra con `demo@lifeorganizer.dev` / `Password123`.

## Build

```bash
npm run build    # tsc --noEmit + vite build -> dist/
npm run preview  # sirve dist/ localmente
```

`dist/` es estático — se puede desplegar en Vercel, Netlify, Cloudflare Pages o como sitio estático en el mismo Render/Railway. Recuerda configurar `VITE_API_URL` como variable de entorno de build apuntando a la URL de producción de la API, y actualizar `CORS_ORIGIN` en la API para que acepte el dominio del dashboard.

## Decisiones de diseño

- **Sin React Router**: con 5 secciones y sin necesidad de URLs profundas, un simple `useState<Tab>` en `DashboardPage` es más simple que añadir una dependencia de routing para un demo.
- **Sin librería de gráficos**: `MiniBarChart` es un componente SVG de ~30 líneas. Evita añadir Recharts/Chart.js solo para una tendencia de 6 barras.
- **`useFetch`** ([src/hooks/useFetch.ts](src/hooks/useFetch.ts)) centraliza loading/error/reload para no repetir ese boilerplate en cada componente.
