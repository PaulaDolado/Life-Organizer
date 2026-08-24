import Joi from "joi";

const PERIODS = ["weekly", "monthly"];

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const listGoalsQuerySchema = Joi.object({
  status: Joi.string().valid("active", "completed", "all").default("active"),
});

export const createGoalSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(1000).allow(null, ""),
  period: Joi.string()
    .valid(...PERIODS)
    .required(),
  targetValue: Joi.number().integer().positive().required(),
  bonusPoints: Joi.number().integer().min(0).default(10),
  periodStart: Joi.date().iso(),
  periodEnd: Joi.date().iso().greater(Joi.ref("periodStart")).messages({
    "date.greater": "periodEnd debe ser posterior a periodStart",
  }),
}).options({ stripUnknown: true });

export const updateGoalSchema = Joi.object({
  title: Joi.string().min(1).max(200),
  description: Joi.string().max(1000).allow(null, ""),
  targetValue: Joi.number().integer().positive(),
  bonusPoints: Joi.number().integer().min(0),
  periodStart: Joi.date().iso(),
  periodEnd: Joi.date().iso(),
}).min(1);

export const registerProgressSchema = Joi.object({
  value: Joi.number().integer().required(),
  note: Joi.string().max(500).allow(null, ""),
  date: Joi.date().iso(),
});
