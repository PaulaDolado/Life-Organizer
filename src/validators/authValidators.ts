import Joi from "joi";
import { isValidTimezone } from "../utils/timezone";

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(72).required(),
  name: Joi.string().min(2).max(100).required(),
  // Opcional: si no se indica, Prisma aplica el default del schema ("Europe/Madrid").
  timezone: Joi.string()
    .custom((value, helpers) => {
      if (!isValidTimezone(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    })
    .messages({ "any.invalid": "timezone debe ser una zona horaria IANA válida (ej. 'Europe/Madrid')" }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  timezone: Joi.string().custom((value, helpers) => {
    if (!isValidTimezone(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  }),
})
  .min(1)
  .messages({ "any.invalid": "timezone debe ser una zona horaria IANA válida (ej. 'Europe/Madrid')" });
