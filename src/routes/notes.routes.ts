import { Router } from "express";
import * as notesController from "../controllers/notesController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import { idParamSchema, createNoteSchema, updateNoteSchema } from "../validators/notesValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /notes:
 *   get:
 *     tags: [Notes]
 *     summary: Lista las notas rápidas del usuario (Agenda)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de notas }
 *   post:
 *     tags: [Notes]
 *     summary: Crear nota rápida
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Nota creada }
 */
router.get("/", notesController.listNotes);
router.post("/", validate(createNoteSchema), notesController.createNote);

/**
 * @openapi
 * /notes/{id}:
 *   put:
 *     tags: [Notes]
 *     summary: Editar nota rápida (marcar/desmarcar o cambiar el texto)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Nota actualizada }
 *   delete:
 *     tags: [Notes]
 *     summary: Eliminar nota rápida
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Nota eliminada }
 */
router.put("/:id", validate(idParamSchema, "params"), validate(updateNoteSchema), notesController.updateNote);
router.delete("/:id", validate(idParamSchema, "params"), notesController.deleteNote);

export default router;
