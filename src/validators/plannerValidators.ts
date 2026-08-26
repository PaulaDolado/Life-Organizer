import Joi from "joi";

const STATUSES = ["todo", "in_progress", "done"];
const PRIORITIES = ["low", "medium", "high"];

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const createTaskSchema = Joi.object({
  title: Joi.string().min(1).max(150).required(),
  description: Joi.string().max(2000).allow(null, ""),
  status: Joi.string().valid(...STATUSES),
  priority: Joi.string().valid(...PRIORITIES),
  order: Joi.number(),
}).options({ stripUnknown: true });

export const updateTaskSchema = Joi.object({
  title: Joi.string().min(1).max(150),
  description: Joi.string().max(2000).allow(null, ""),
  status: Joi.string().valid(...STATUSES),
  priority: Joi.string().valid(...PRIORITIES),
  order: Joi.number(),
}).min(1);
