import { prisma } from "../config/database";
import { hashPassword, comparePassword } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { ConflictError, UnauthorizedError } from "../utils/errorHandler";

interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

interface LoginInput {
  email: string;
  password: string;
}

function buildTokens(user: { id: number; email: string }) {
  const payload = { userId: user.id, email: user.email };
  return {
    token: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("Email ya existe");
  }

  const hashedPassword = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { email: input.email, password: hashedPassword, name: input.name },
  });

  const tokens = buildTokens(user);
  return { ...tokens, user: { id: user.id, email: user.email, name: user.name } };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new UnauthorizedError("Credenciales inválidas");
  }

  const valid = await comparePassword(input.password, user.password);
  if (!valid) {
    throw new UnauthorizedError("Credenciales inválidas");
  }

  const tokens = buildTokens(user);
  return { ...tokens, user: { id: user.id, email: user.email, name: user.name } };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError("Refresh token inválido o expirado");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw new UnauthorizedError("Usuario no encontrado");
  }

  return buildTokens(user);
}
