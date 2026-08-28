import Joi from "joi";

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

// Texto libre por celda (asignatura, aula, lo que el usuario quiera escribir) — sin estructura
// forzada, tal como pidió: "ya agrego yo cada asignatura en cada espacio".
const CELL_MAX = 200;

export const addRowSchema = Joi.object({
  timeLabel: Joi.string().max(50).allow(""),
}).options({ stripUnknown: true });

export const updateRowSchema = Joi.object({
  timeLabel: Joi.string().max(50).allow(""),
  monday: Joi.string().max(CELL_MAX).allow(""),
  tuesday: Joi.string().max(CELL_MAX).allow(""),
  wednesday: Joi.string().max(CELL_MAX).allow(""),
  thursday: Joi.string().max(CELL_MAX).allow(""),
  friday: Joi.string().max(CELL_MAX).allow(""),
}).min(1);

export const moveRowSchema = Joi.object({
  direction: Joi.string().valid("up", "down").required(),
});
