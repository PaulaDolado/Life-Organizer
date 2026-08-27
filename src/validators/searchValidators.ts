import Joi from "joi";

export const searchQuerySchema = Joi.object({
  q: Joi.string().min(1).max(200).required(),
}).options({ stripUnknown: true });
