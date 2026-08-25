import Joi from "joi";

const EVENT_TYPES = ["work", "study", "gym", "meeting", "free"];
const RECURRING_PATTERNS = ["weekly", "biweekly", "monthly"];

export const dateParamSchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({ "string.pattern.base": "date debe tener formato YYYY-MM-DD" }),
});

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const createEventSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(1000).allow(null, ""),
  type: Joi.string()
    .valid(...EVENT_TYPES)
    .required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().greater(Joi.ref("startTime")).required().messages({
    "date.greater": "endTime debe ser posterior a startTime",
  }),
  location: Joi.string().max(200).allow(null, ""),
  isRecurring: Joi.boolean().default(false),
  recurringPattern: Joi.string()
    .valid(...RECURRING_PATTERNS)
    .when("isRecurring", { is: true, then: Joi.required(), otherwise: Joi.optional().allow(null) }),
}).options({ stripUnknown: true });

export const updateEventSchema = Joi.object({
  title: Joi.string().min(1).max(200),
  description: Joi.string().max(1000).allow(null, ""),
  type: Joi.string().valid(...EVENT_TYPES),
  startTime: Joi.date().iso(),
  endTime: Joi.date().iso(),
  location: Joi.string().max(200).allow(null, ""),
  isRecurring: Joi.boolean(),
  recurringPattern: Joi.string().valid(...RECURRING_PATTERNS).allow(null),
})
  .min(1)
  .custom((value, helpers) => {
    if (value.startTime && value.endTime && new Date(value.endTime) <= new Date(value.startTime)) {
      return helpers.error("any.invalid", { message: "endTime debe ser posterior a startTime" });
    }
    return value;
  })
  .messages({ "any.invalid": "endTime debe ser posterior a startTime" });

export const eventTypeQuerySchema = Joi.object({
  type: Joi.string().valid(...EVENT_TYPES),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
});
