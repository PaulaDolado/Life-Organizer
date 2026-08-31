import Joi from "joi";

// Paleta cerrada a los tokens de color que ya existen en el diseño de la app (ver styles.css /
// CALENDAR_COLORS en el dashboard) — así cualquier categoría que el usuario invente sigue
// encajando visualmente con el resto de la interfaz, en vez de dejar que meta un hex cualquiera.
export const CALENDAR_COLORS = ["primary", "secondary", "habit", "hobby", "positive", "negative", "warning", "muted"] as const;

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const dateParamSchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
});

export const createCategorySchema = Joi.object({
  label: Joi.string().min(1).max(60).required(),
  color: Joi.string()
    .valid(...CALENDAR_COLORS)
    .required(),
}).options({ stripUnknown: true });

export const updateCategorySchema = Joi.object({
  label: Joi.string().min(1).max(60),
  color: Joi.string().valid(...CALENDAR_COLORS),
  order: Joi.number().integer().min(0),
}).min(1);

export const listMarksQuerySchema = Joi.object({
  from: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  to: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
});

// `categoryId: null` borra la marca de ese día (ver calendarLegendService.setDayMark) — por eso
// va explícito y obligatorio (no `.optional()`), para distinguir "pintar con esta categoría" de
// "no mandes nada" por accidente.
export const setDayMarkSchema = Joi.object({
  categoryId: Joi.number().integer().positive().allow(null).required(),
});
