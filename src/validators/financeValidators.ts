import Joi from "joi";

const TRANSACTION_TYPES = ["income", "expense"];

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const monthYearParamSchema = Joi.object({
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
});

export const yearParamSchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).required(),
});

export const listTransactionsQuerySchema = Joi.object({
  type: Joi.string().valid(...TRANSACTION_TYPES),
  category: Joi.string().max(50),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const createTransactionSchema = Joi.object({
  type: Joi.string()
    .valid(...TRANSACTION_TYPES)
    .required(),
  amount: Joi.number().positive().precision(2).required(),
  category: Joi.string().min(1).max(50).required(),
  description: Joi.string().max(500).allow(null, ""),
  date: Joi.date().iso(),
}).options({ stripUnknown: true });

export const updateTransactionSchema = Joi.object({
  type: Joi.string().valid(...TRANSACTION_TYPES),
  amount: Joi.number().positive().precision(2),
  category: Joi.string().min(1).max(50),
  description: Joi.string().max(500).allow(null, ""),
  date: Joi.date().iso(),
}).min(1);

export const createSavingsGoalSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  targetAmount: Joi.number().positive().precision(2).required(),
  category: Joi.string().min(1).max(50).required(),
  deadline: Joi.date().iso().allow(null),
}).options({ stripUnknown: true });

export const analyticsQuerySchema = Joi.object({
  month: Joi.number().integer().min(1).max(12),
  year: Joi.number().integer().min(2000).max(2100),
});
