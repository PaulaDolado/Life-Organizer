import { prisma } from "../config/database";
import { hashPassword, comparePassword } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { ConflictError, UnauthorizedError } from "../utils/errorHandler";

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  timezone?: string;
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

// Proyección pública del usuario — nunca incluye `password`. Centralizada aquí para no repetir
// los mismos campos en register/login/getProfile/updateProfile cada vez que se añade uno nuevo.
// No hay un `username` aparte: el nombre de usuario ES el email con el que se inicia sesión.
function toProfile(user: { id: number; email: string; name: string; lastName: string | null; timezone: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    lastName: user.lastName,
    timezone: user.timezone,
  };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("Email ya existe");
  }

  const hashedPassword = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      name: input.name,
      ...(input.timezone ? { timezone: input.timezone } : {}),
    },
  });

  const tokens = buildTokens(user);
  return { ...tokens, user: toProfile(user) };
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
  return { ...tokens, user: toProfile(user) };
}

export async function getProfile(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UnauthorizedError("Usuario no encontrado");
  }
  return toProfile(user);
}

interface UpdateProfileInput {
  name?: string;
  lastName?: string | null;
  email?: string;
  timezone?: string;
}

export async function updateProfile(userId: number, input: UpdateProfileInput) {
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing && existing.id !== userId) {
      throw new ConflictError("Ese email ya está en uso por otra cuenta");
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      // lastName admite explícitamente `null` para poder BORRARLO (a diferencia de `undefined`,
      // que significa "no tocar este campo") — por eso se compara contra undefined y no con un
      // simple `if (input.lastName)`.
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    },
  });
  return toProfile(user);
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UnauthorizedError("Usuario no encontrado");
  }

  const valid = await comparePassword(currentPassword, user.password);
  if (!valid) {
    throw new UnauthorizedError("La contraseña actual no es correcta");
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });
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
