import Joi from "joi";
import { paginationQuerySchema } from "./pagination";

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const listNotificationsQuerySchema = Joi.object({
  unreadOnly: Joi.boolean().default(false),
}).concat(paginationQuerySchema);
