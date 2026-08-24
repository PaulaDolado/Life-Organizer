import Joi from "joi";

const STATUSES = ["idea", "en_curso", "pausado", "completado"];
const PRIORITIES = ["low", "medium", "high"];

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const projectTaskParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  taskId: Joi.number().integer().positive().required(),
});

export const listProjectsQuerySchema = Joi.object({
  status: Joi.string().valid(...STATUSES),
  priority: Joi.string().valid(...PRIORITIES),
});

export const createProjectSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(1000).allow(null, ""),
  status: Joi.string()
    .valid(...STATUSES)
    .default("idea"),
  priority: Joi.string()
    .valid(...PRIORITIES)
    .default("medium"),
  deadline: Joi.date().iso().allow(null),
}).options({ stripUnknown: true });

export const updateProjectSchema = Joi.object({
  title: Joi.string().min(1).max(200),
  description: Joi.string().max(1000).allow(null, ""),
  status: Joi.string().valid(...STATUSES),
  priority: Joi.string().valid(...PRIORITIES),
  deadline: Joi.date().iso().allow(null),
}).min(1);

export const createTaskSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
}).options({ stripUnknown: true });

export const updateTaskSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
}).options({ stripUnknown: true });
