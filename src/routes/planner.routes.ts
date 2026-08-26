import { Router } from "express";
import * as plannerController from "../controllers/plannerController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import { idParamSchema, createTaskSchema, updateTaskSchema } from "../validators/plannerValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /planner/tasks:
 *   get:
 *     tags: [Planner]
 *     summary: Lista las tareas del tablero kanban del usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de tareas }
 *   post:
 *     tags: [Planner]
 *     summary: Crear tarea
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Tarea creada }
 */
router.get("/tasks", plannerController.listTasks);
router.post("/tasks", validate(createTaskSchema), plannerController.createTask);

/**
 * @openapi
 * /planner/tasks/{id}:
 *   put:
 *     tags: [Planner]
 *     summary: Editar tarea (título, estado, prioridad u orden dentro de la columna)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tarea actualizada }
 *   delete:
 *     tags: [Planner]
 *     summary: Eliminar tarea
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tarea eliminada }
 */
router.put("/tasks/:id", validate(idParamSchema, "params"), validate(updateTaskSchema), plannerController.updateTask);
router.delete("/tasks/:id", validate(idParamSchema, "params"), plannerController.deleteTask);

export default router;
