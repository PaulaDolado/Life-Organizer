import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  TooManyRequestsError,
} from "../../../src/utils/errorHandler";

describe("error classes", () => {
  it("AppError debería usar 500 por defecto", () => {
    const error = new AppError("Algo falló");
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error).toBeInstanceOf(Error);
  });

  it("AppError debería aceptar un statusCode custom", () => {
    const error = new AppError("Custom", 418);
    expect(error.statusCode).toBe(418);
  });

  it.each([
    [NotFoundError, 404, "Recurso no encontrado"],
    [UnauthorizedError, 401, "No autorizado"],
    [ForbiddenError, 403, "Acceso denegado"],
    [ValidationError, 400, "Datos inválidos"],
    [ConflictError, 409, "Conflicto con el estado actual del recurso"],
    [TooManyRequestsError, 429, "Has hecho esto hace muy poco, inténtalo más tarde"],
  ])("%p debería tener statusCode %i y mensaje por defecto", (ErrorClass, statusCode, defaultMessage) => {
    const error = new (ErrorClass as new (msg?: string) => AppError)();
    expect(error.statusCode).toBe(statusCode);
    expect(error.message).toBe(defaultMessage);
    expect(error).toBeInstanceOf(AppError);
  });

  it("debería permitir sobreescribir el mensaje por defecto", () => {
    const error = new NotFoundError("Evento no encontrado");
    expect(error.message).toBe("Evento no encontrado");
    expect(error.statusCode).toBe(404);
  });
});
