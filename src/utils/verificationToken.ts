import crypto from "crypto";

const TOKEN_BYTES = 32;
export const EMAIL_VERIFICATION_TTL_HOURS = 24;

// El token de verificación no es una contraseña (bcrypt sería un coste innecesario para algo
// que ya es aleatorio de 32 bytes y de un solo uso, corto de vida): un hash rápido (sha256)
// alcanza — lo importante es no guardar el token en claro en la BD, para que un volcado de la
// tabla User no deje enlaces de verificación válidos reutilizables.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateVerificationToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000),
  };
}
