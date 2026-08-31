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

/** La acción en sí es válida, pero el usuario ya la hizo hace muy poco (p.ej. cambiar el
 * nombre de usuario/email más de 1 vez cada 15 días) — no es un error de validación del
 * request, así que no encaja en 400, y tampoco es un conflicto de estado (409). */
export class TooManyRequestsError extends AppError {
  constructor(message = "Has hecho esto hace muy poco, inténtalo más tarde") {
    super(message, 429);
  }
}
