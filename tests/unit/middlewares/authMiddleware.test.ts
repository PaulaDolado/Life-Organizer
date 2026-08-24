import { Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../../../src/middlewares/authMiddleware";
import { signAccessToken } from "../../../src/utils/jwt";
import { UnauthorizedError } from "../../../src/utils/errorHandler";

function mockNext(): NextFunction & jest.Mock {
  return jest.fn() as unknown as NextFunction & jest.Mock;
}

describe("authMiddleware", () => {
  it("debería llamar a next(UnauthorizedError) si no hay header Authorization", () => {
    const req = { headers: {} } as unknown as AuthRequest;
    const next = mockNext();

    authMiddleware(req, {} as Response, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
  });

  it("debería llamar a next(UnauthorizedError) si el header no empieza con 'Bearer '", () => {
    const req = { headers: { authorization: "Token abc123" } } as unknown as AuthRequest;
    const next = mockNext();

    authMiddleware(req, {} as Response, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
  });

  it("debería llamar a next(UnauthorizedError) con un token inválido", () => {
    const req = { headers: { authorization: "Bearer token-invalido" } } as unknown as AuthRequest;
    const next = mockNext();

    authMiddleware(req, {} as Response, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
  });

  it("debería asignar userId/userEmail y llamar a next() sin error con un token válido", () => {
    const token = signAccessToken({ userId: 42, email: "test@example.com" });
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
    const next = mockNext();

    authMiddleware(req, {} as Response, next);

    expect(req.userId).toBe(42);
    expect(req.userEmail).toBe("test@example.com");
    expect(next).toHaveBeenCalledWith();
  });
});
