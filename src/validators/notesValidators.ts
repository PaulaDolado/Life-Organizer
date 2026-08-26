import Joi from "joi";

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const createNoteSchema = Joi.object({
  content: Joi.string().min(1).max(500).required(),
}).options({ stripUnknown: true });

export const updateNoteSchema = Joi.object({
  content: Joi.string().min(1).max(500),
  checked: Joi.boolean(),
})
  .min(1)
  .options({ stripUnknown: true });
