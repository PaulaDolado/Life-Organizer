import Joi from "joi";
import { Request, Response, NextFunction } from "express";
import { validate } from "../../../src/middlewares/validation";
import { ValidationError } from "../../../src/utils/errorHandler";

function mockNext(): NextFunction & jest.Mock {
  return jest.fn() as unknown as NextFunction & jest.Mock;
}

describe("validate middleware", () => {
  const schema = Joi.object({
    name: Joi.string().min(2).required(),
    age: Joi.number().integer().min(0),
  });

  it("debería llamar a next() sin error cuando el body es válido", () => {
    const req = { body: { name: "Paula", age: 30 } } as unknown as Request;
    const next = mockNext();

    validate(schema)(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("debería reemplazar req.body con el valor saneado (stripUnknown)", () => {
    const req = { body: { name: "Paula", age: 30, extra: "campo no permitido" } } as unknown as Request;
    const next = mockNext();

    validate(schema)(req, {} as Response, next);

    expect(req.body).toEqual({ name: "Paula", age: 30 });
  });

  it("debería llamar a next(ValidationError) cuando el body es inválido", () => {
    const req = { body: { name: "P" } } as unknown as Request;
    const next = mockNext();

    validate(schema)(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const errorArg = next.mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(ValidationError);
  });

  it("debería validar req.query cuando se indica part='query'", () => {
    const querySchema = Joi.object({ status: Joi.string().valid("active", "completed").required() });
    const req = { query: { status: "invalid-status" } } as unknown as Request;
    const next = mockNext();

    validate(querySchema, "query")(req, {} as Response, next);

    const errorArg = next.mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(ValidationError);
  });
});
