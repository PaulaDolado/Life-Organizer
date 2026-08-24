import { Request, Response, NextFunction } from "express";
import { ObjectSchema } from "joi";
import { ValidationError } from "../utils/errorHandler";

type RequestPart = "body" | "params" | "query";

/** Middleware factory: valida req[part] contra un schema de Joi. */
export function validate(schema: ObjectSchema, part: RequestPart = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[part], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((d) => d.message).join("; ");
      next(new ValidationError(message));
      return;
    }

    req[part] = value;
    next();
  };
}
