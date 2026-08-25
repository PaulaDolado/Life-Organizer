# Contribuir

Proyecto personal de portfolio, pero estructurado para aceptar contribuciones si alguien quiere proponer algo.

## Setup

Ver [README.md](README.md#setup) para instalar dependencias, levantar Postgres y correr el servidor.

## Antes de abrir un PR

```bash
npm run lint          # ESLint sin errores
npx tsc --noEmit        # typecheck sin errores
npm test                 # unit + integration en verde (requiere Postgres levantado)
```

El CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) corre exactamente estos mismos pasos — si pasan en local, deberían pasar ahí.

## Convenciones de código

- **Controllers delgados**: parsean `req`, llaman al `service`, formatean la respuesta. Cero lógica de negocio ni acceso a Prisma directo — eso vive en `services/`.
- **Un `service` por módulo**, exporta funciones puras/async (no una clase). Los helpers puramente de cálculo (sin Prisma) se exportan para poder testearlos sin mockear la BD — ver `computeGoalRisk` en `goalsService.ts` o `expandRecurringEvent` en `utils/recurrence.ts`.
- **Ownership**: cualquier endpoint que lea/edite/borre un recurso de un usuario debe verificar `resource.userId === req.userId` antes de tocarlo, lanzando `ForbiddenError` (403) si no coincide y `NotFoundError` (404) si no existe. Sigue el patrón `findOwned*` ya usado en cada service.
- **Validación con Joi** en `validators/`, aplicada en las rutas vía el middleware `validate(schema)` — nunca valides a mano dentro de un controller.
- **Errores**: lanza una subclase de `AppError` (`utils/errorHandler.ts`) desde el service; el middleware de error centralizado (`middlewares/errorHandler.ts`) se encarga de mapearla a la respuesta HTTP. No captures errores en el controller salvo para pasarlos a `next(error)`.
- **Paginación** en cualquier listado nuevo: usa el `paginationQuerySchema` compartido (`validators/pagination.ts`) y `buildPagination()` (`utils/pagination.ts`) para mantener la misma forma de respuesta (`{ page, limit, total, pages }`) en todos lados.

## Añadir un módulo nuevo (checklist)

Sigue el patrón de los módulos existentes (`goals`, `projects`, etc.):

1. Modelo(s) en `prisma/schema.prisma` + `npx prisma generate`
2. `src/validators/miModuloValidators.ts` — esquemas Joi
3. `src/services/miModuloService.ts` — lógica de negocio, funciones exportadas
4. `src/controllers/miModuloController.ts` — capa HTTP delgada
5. `src/routes/miModulo.routes.ts` — rutas + anotaciones `@openapi` para Swagger
6. Wire en `src/routes/index.ts`
7. Tests unitarios en `tests/unit/services/miModuloService.test.ts` (Prisma mockeado) + `tests/unit/validators/miModuloValidators.test.ts`
8. Test de integración en `tests/integration/miModulo.test.ts` (contra Postgres real)
9. Documentar en [API.md](API.md) y, si aplica, [DATABASE.md](DATABASE.md)

## Commits y PRs

Sin convención estricta de commits (no Conventional Commits obligatorio), pero el mensaje debe explicar el *por qué*, no solo el *qué*. Un PR debe:
- Tener CI en verde
- Actualizar la documentación relevante si cambia comportamiento observable (endpoints, schema, variables de entorno)
- Incluir tests para el cambio (unitarios como mínimo; de integración si toca un flujo HTTP completo)
