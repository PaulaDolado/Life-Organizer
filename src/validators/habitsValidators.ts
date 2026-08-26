import Joi from "joi";

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const createHabitSchema = Joi.object({
  title: Joi.string().min(1).max(100).required(),
}).options({ stripUnknown: true });

export const updateHabitSchema = createHabitSchema;

// `date` es opcional: si no se manda, el servicio usa el día de hoy. Formato YYYY-MM-DD para no
// arrastrar horas/zona horaria — un hábito se marca "para el día X", no para un instante.
export const toggleHabitSchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
}).options({ stripUnknown: true });
