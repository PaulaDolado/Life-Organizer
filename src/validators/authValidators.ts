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
  lastName: Joi.string().min(1).max(100).allow(null, ""),
  // El "nombre de usuario" es el propio email de acceso — cambiarlo aquí cambia con qué email
  // se inicia sesión a partir de ahora (el service comprueba que esté libre).
  email: Joi.string().email(),
  timezone: Joi.string().custom((value, helpers) => {
    if (!isValidTimezone(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  }),
})
  .min(1)
  .messages({ "any.invalid": "timezone debe ser una zona horaria IANA válida (ej. 'Europe/Madrid')" });

// Mismas reglas que registerSchema.password (min 8, max 72 — límite duro de bcrypt).
// currentPassword no lleva min/max: se compara tal cual contra el hash guardado, no se está
// creando una contraseña nueva con esa, así que no tiene sentido validarle formato aquí.
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(72).required(),
});
