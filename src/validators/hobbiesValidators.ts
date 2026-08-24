import Joi from "joi";

const CATEGORIES = ["reading", "gaming", "music", "sports", "art"];

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const categoryParamSchema = Joi.object({
  category: Joi.string()
    .valid(...CATEGORIES)
    .required(),
});

export const createHobbySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  category: Joi.string()
    .valid(...CATEGORIES)
    .required(),
  description: Joi.string().max(1000).allow(null, ""),
}).options({ stripUnknown: true });

export const updateHobbySchema = Joi.object({
  name: Joi.string().min(1).max(100),
  category: Joi.string().valid(...CATEGORIES),
  description: Joi.string().max(1000).allow(null, ""),
}).min(1);

export const createSessionSchema = Joi.object({
  durationMinutes: Joi.number().integer().positive().required(),
  date: Joi.date().iso(),
  notes: Joi.string().max(500).allow(null, ""),
}).options({ stripUnknown: true });
