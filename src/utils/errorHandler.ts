/** Error de aplicación con código HTTP asociado, para el middleware de error centralizado. */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    // No usar Object.setPrototypeOf(this, AppError.prototype) aquí: con target ES2020,
    // "class X extends AppError" ya deja la cadena de prototipos correcta, y forzarla a
    // AppError.prototype rompería "instanceof NotFoundError/UnauthorizedError/etc." en
    // las subclases (solo haría falta ese workaround si el target de compilación fuera ES5).
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No autorizado") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acceso denegado") {
    super(message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Datos inválidos") {
    super(message, 400);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflicto con el estado actual del recurso") {
    super(message, 409);
  }
}
