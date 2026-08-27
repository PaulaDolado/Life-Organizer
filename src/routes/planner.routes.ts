import { Router } from "express";
import * as plannerController from "../controllers/plannerController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import {
  idParamSchema,
  subtaskParamSchema,
  listTasksQuerySchema,
  createTaskSchema,
  updateTaskSchema,
  logTimeSchema,
  createSubtaskSchema,
  updateSubtaskSchema,
} from "../validators/plannerValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /planner/tasks:
 *   get:
 *     tags: [Planner]
 *     summary: Lista las tareas del tablero kanban del usuario (filtrable por proyecto o etiqueta)
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
router.get("/tasks", validate(listTasksQuerySchema, "query"), plannerController.listTasks);
router.post("/tasks", validate(createTaskSchema), plannerController.createTask);

/**
 * @openapi
 * /planner/tasks/{id}:
 *   put:
 *     tags: [Planner]
 *     summary: Editar tarea (título, estado, prioridad, orden, fecha límite, etiquetas, estimación o proyecto)
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

/**
 * @openapi
 * /planner/tasks/{id}/time:
 *   post:
 *     tags: [Planner]
 *     summary: Registrar minutos de tiempo real dedicados a la tarea (se suman al acumulado)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tarea actualizada con el nuevo tiempo acumulado }
 */
router.post("/tasks/:id/time", validate(idParamSchema, "params"), validate(logTimeSchema), plannerController.logTime);

/**
 * @openapi
 * /planner/tasks/{id}/subtasks:
 *   post:
 *     tags: [Planner]
 *     summary: Añadir una subtarea (paso del checklist) a la tarea
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Subtarea creada }
 */
router.post(
  "/tasks/:id/subtasks",
  validate(idParamSchema, "params"),
  validate(createSubtaskSchema),
  plannerController.addSubtask
);

/**
 * @openapi
 * /planner/tasks/{id}/subtasks/{subtaskId}:
 *   put:
 *     tags: [Planner]
 *     summary: Editar una subtarea (título o completada)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Subtarea actualizada }
 *   delete:
 *     tags: [Planner]
 *     summary: Eliminar una subtarea
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Subtarea eliminada }
 */
router.put(
  "/tasks/:id/subtasks/:subtaskId",
  validate(subtaskParamSchema, "params"),
  validate(updateSubtaskSchema),
  plannerController.updateSubtask
);
router.delete(
  "/tasks/:id/subtasks/:subtaskId",
  validate(subtaskParamSchema, "params"),
  plannerController.deleteSubtask
);

export default router;
