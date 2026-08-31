import Joi from "joi";

const EVENT_TYPES = ["work", "study", "gym", "meeting", "free", "evento", "cita"];
const RECURRING_PATTERNS = ["daily", "weekly", "biweekly", "monthly"];
const EXCEPTION_ACTIONS = ["moved", "cancelled"];
// Máx. 1 semana de antelación (10080 min) y como mucho 5 avisos por evento — de sobra para
// "15 min antes" + "1 día antes" y alguna combinación más, sin permitir listas absurdas.
const reminderMinutesBeforeSchema = Joi.array().items(Joi.number().integer().min(1).max(10080)).max(5);
const guestsSchema = Joi.array().items(Joi.string().trim().min(1).max(120)).max(30);

export const dateParamSchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({ "string.pattern.base": "date debe tener formato YYYY-MM-DD" }),
});

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const exceptionParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  originalStartTime: Joi.date().iso().required(),
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
  reminderMinutesBefore: reminderMinutesBeforeSchema,
  guests: guestsSchema,
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
  reminderMinutesBefore: reminderMinutesBeforeSchema,
  guests: guestsSchema,
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

export const importIcsSchema = Joi.object({
  ics: Joi.string().min(1).max(2_000_000).required(),
}).options({ stripUnknown: true });

export const setExceptionSchema = Joi.object({
  originalStartTime: Joi.date().iso().required(),
  action: Joi.string()
    .valid(...EXCEPTION_ACTIONS)
    .required(),
  newStartTime: Joi.date().iso().when("action", { is: "moved", then: Joi.required(), otherwise: Joi.forbidden() }),
  newEndTime: Joi.date()
    .iso()
    .greater(Joi.ref("newStartTime"))
    .when("action", { is: "moved", then: Joi.required(), otherwise: Joi.forbidden() })
    .messages({ "date.greater": "newEndTime debe ser posterior a newStartTime" }),
}).options({ stripUnknown: true });
