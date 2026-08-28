import { Router } from "express";
import * as authController from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "../validators/authValidators";

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registro de usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string }
 *     responses:
 *       201: { description: Usuario creado, retorna token + refreshToken }
 *       409: { description: El email ya existe }
 */
router.post("/register", validate(registerSchema), authController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login de usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login correcto, retorna token + refreshToken }
 *       401: { description: Credenciales inválidas }
 */
router.post("/login", validate(loginSchema), authController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refrescar token expirado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Nuevo token + refreshToken }
 *       401: { description: Refresh token inválido o expirado }
 */
router.post("/refresh", validate(refreshSchema), authController.refresh);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Perfil del usuario autenticado
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ id, email, name, timezone }" }
 *   put:
 *     tags: [Auth]
 *     summary: Actualizar nombre y/o timezone (zona IANA, ej. 'Europe/Madrid')
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Perfil actualizado }
 */
router.get("/me", authMiddleware, authController.getProfile);
router.put("/me", authMiddleware, validate(updateProfileSchema), authController.updateProfile);

/**
 * @openapi
 * /auth/me/password:
 *   put:
 *     tags: [Auth]
 *     summary: Cambiar la contraseña del usuario autenticado
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Contraseña actualizada }
 *       401: { description: La contraseña actual no es correcta }
 */
router.put("/me/password", authMiddleware, validate(changePasswordSchema), authController.changePassword);

export default router;
