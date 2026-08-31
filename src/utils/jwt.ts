import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/environment";

export interface JwtPayload {
  userId: number;
  email: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  } as SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.secret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as JwtPayload;
}

// El callback de Google Calendar (ver googleCalendarService/googleCalendar.routes) lo abre el
// propio navegador redirigido por Google, SIN nuestra cabecera Authorization — así que no hay
// forma de saber qué usuario iba conectando su cuenta salvo llevándolo ida y vuelta en el
// parámetro `state` del flujo OAuth. Un JWT de corta duración (10 min, tiempo de sobra para
// completar el consentimiento) sirve de "carnet" firmado: si alguien lo manipulara, la firma no
// cuadraría. `purpose` evita que un access/refresh token cualquiera (firmados con el mismo
// secreto) se pudiera colar aquí como `state` válido.
interface GoogleOAuthStatePayload {
  userId: number;
  purpose: "google-calendar-connect";
}

export function signGoogleOAuthState(userId: number): string {
  const payload: GoogleOAuthStatePayload = { userId, purpose: "google-calendar-connect" };
  return jwt.sign(payload, env.jwt.secret, { expiresIn: "10m" });
}

export function verifyGoogleOAuthState(token: string): number {
  const payload = jwt.verify(token, env.jwt.secret) as GoogleOAuthStatePayload;
  if (payload.purpose !== "google-calendar-connect") {
    throw new Error("Token de estado inválido");
  }
  return payload.userId;
}
