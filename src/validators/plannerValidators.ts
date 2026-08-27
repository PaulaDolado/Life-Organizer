import Joi from "joi";

const STATUSES = ["todo", "in_progress", "done"];
const PRIORITIES = ["low", "medium", "high"];
const MAX_TAGS = 10;

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const subtaskParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  subtaskId: Joi.number().integer().positive().required(),
});

export const listTasksQuerySchema = Joi.object({
  projectId: Joi.number().integer().positive(),
  tag: Joi.string().trim().min(1).max(30),
}).options({ stripUnknown: true });

const tagsSchema = Joi.array().items(Joi.string().trim().min(1).max(30)).max(MAX_TAGS);

export const createTaskSchema = Joi.object({
  title: Joi.string().min(1).max(150).required(),
  description: Joi.string().max(2000).allow(null, ""),
  status: Joi.string().valid(...STATUSES),
  priority: Joi.string().valid(...PRIORITIES),
  order: Joi.number(),
  dueDate: Joi.date().iso().allow(null),
  tags: tagsSchema,
  estimatedMinutes: Joi.number().integer().min(1).max(100000).allow(null),
  projectId: Joi.number().integer().positive().allow(null),
}).options({ stripUnknown: true });

export const updateTaskSchema = Joi.object({
  title: Joi.string().min(1).max(150),
  description: Joi.string().max(2000).allow(null, ""),
  status: Joi.string().valid(...STATUSES),
  priority: Joi.string().valid(...PRIORITIES),
  order: Joi.number(),
  dueDate: Joi.date().iso().allow(null),
  tags: tagsSchema,
  estimatedMinutes: Joi.number().integer().min(1).max(100000).allow(null),
  projectId: Joi.number().integer().positive().allow(null),
}).min(1);

export const logTimeSchema = Joi.object({
  minutes: Joi.number().integer().min(1).max(1000).required(),
});

export const createSubtaskSchema = Joi.object({
  title: Joi.string().min(1).max(150).required(),
}).options({ stripUnknown: true });

export const updateSubtaskSchema = Joi.object({
  title: Joi.string().min(1).max(150),
  completed: Joi.boolean(),
}).min(1);
