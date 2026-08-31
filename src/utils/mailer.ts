import { logger } from "./logger";
import { env } from "../config/environment";

// No hay ningún proveedor de email configurado todavía (SMTP, SendGrid, Resend...) — de momento
// el "envío" es solo un log claro con el enlace, para poder desarrollar/probar la verificación
// de email sin depender de credenciales externas. Cuando se quiera enviar de verdad, esta es la
// ÚNICA función que hay que cambiar (p.ej. usando nodemailer contra un SMTP real): el resto del
// flujo (generar token, guardar hash, comprobar caducidad) no depende de cómo se entrega.
export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verifyUrl = `${env.cors.origin}/verify-email?token=${token}`;
  logger.info(`📧 [DEV] Email de verificación (no se envía de verdad) para ${to} → ${verifyUrl}`);
}
