import Joi from "joi";

// El callback lo dispara el propio Google redirigiendo el navegador — si el usuario deniega el
// consentimiento, Google añade `error` en vez de `code`/`state` (ver googleCalendarController).
export const oauthCallbackQuerySchema = Joi.object({
  code: Joi.string(),
  state: Joi.string(),
  error: Joi.string(),
}).options({ stripUnknown: true, allowUnknown: true });
