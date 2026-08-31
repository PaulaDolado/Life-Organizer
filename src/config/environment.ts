import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3000", 10),
  databaseUrl: required("DATABASE_URL"),
  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN ?? "1h",
    refreshSecret: required("JWT_REFRESH_SECRET"),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? "*",
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? "100", 10),
    // Límite propio (más estricto) para /auth, antes fijo en el código a 20/15min. Configurable
    // para poder relajarlo en desarrollo sin tocar la protección real de producción.
    authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? "900000", 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? "20", 10),
  },
  // Integración de solo lectura con Google Calendar (ver googleCalendarService) — a diferencia
  // del resto de variables, NO son obligatorias: sin ellas la app funciona igual, simplemente
  // esa integración responde "no configurada" en vez de tumbar el arranque entero (a diferencia
  // de JWT_SECRET/DATABASE_URL, que si faltan no hay app que levantar).
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    // URL del propio backend a la que Google redirige tras el consentimiento — debe coincidir
    // EXACTAMENTE con un "Authorized redirect URI" del cliente OAuth en Google Cloud Console.
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/integrations/google/callback",
  },
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
  isTest: (process.env.NODE_ENV ?? "development") === "test",
};
