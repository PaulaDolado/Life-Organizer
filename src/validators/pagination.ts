import Joi from "joi";

/** Fragmento reutilizable de paginación — se combina con `.concat()` en los query schemas
 * de cada módulo (`GET /goals`, `/projects`, `/agenda/*`). */
export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
