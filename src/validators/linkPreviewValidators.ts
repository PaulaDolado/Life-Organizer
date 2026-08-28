import Joi from "joi";

export const linkPreviewQuerySchema = Joi.object({
  url: Joi.string().uri({ scheme: ["http", "https"] }).max(2000).required(),
});
