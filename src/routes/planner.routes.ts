import { Router } from "express";
import * as plannerController from "../controllers/plannerController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import {
  idParamSchema,
  subtaskParamSchema,
  fieldParamSchema,
  createPlannerSchema,
  updatePlannerSchema,
  movePlannerSchema,
  createFieldSchema,
  updateFieldSchema,
  moveFieldSchema,
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
 * /planner/boards:
 *   get:
 *     tags: [Planner]
 *     summary: Lista los tableros de planificador del usuario (puede tener varios), ordenados
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ planners: [...] }" }
 *   post:
 *     tags: [Planner]
 *     summary: Crea un tablero de planificador nuevo con nombre propio
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Tablero creado, sin tareas }
 */
router.get("/boards", plannerController.listPlanners);
router.post("/boards", validate(createPlannerSchema), plannerController.createPlanner);

/**
 * @openapi
 * /planner/boards/{id}:
 *   put:
 *     tags: [Planner]
 *     summary: Renombra un tablero de planificador
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tablero actualizado }
 *   delete:
 *     tags: [Planner]
 *     summary: Elimina un tablero de planificador y todas sus tareas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tablero eliminado }
 */
router.put("/boards/:id", validate(idParamSchema, "params"), validate(updatePlannerSchema), plannerController.updatePlanner);
router.delete("/boards/:id", validate(idParamSchema, "params"), plannerController.deletePlanner);

/**
 * @openapi
 * /planner/boards/{id}/move:
 *   put:
 *     tags: [Planner]
 *     summary: Sube o baja un tablero un puesto entre los del usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tablero movido (no-op si ya está en el extremo) }
 */
router.put("/boards/:id/move", validate(idParamSchema, "params"), validate(movePlannerSchema), plannerController.movePlanner);

/**
 * @openapi
 * /planner/boards/{id}/fields:
 *   get:
 *     tags: [Planner]
 *     summary: Lista las columnas personalizadas de un tablero (texto, número, fecha o selección)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ fields: [...] }" }
 *   post:
 *     tags: [Planner]
 *     summary: Crea una columna personalizada nueva en el tablero
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Columna creada }
 */
router.get("/boards/:id/fields", validate(idParamSchema, "params"), plannerController.listFields);
router.post("/boards/:id/fields", validate(idParamSchema, "params"), validate(createFieldSchema), plannerController.createField);

/**
 * @openapi
 * /planner/boards/{id}/fields/{fieldId}:
 *   put:
 *     tags: [Planner]
 *     summary: Renombra una columna personalizada o cambia sus opciones (tipo "selección")
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Columna actualizada }
 *   delete:
 *     tags: [Planner]
 *     summary: Elimina una columna personalizada (los valores que tuvieran las tareas dejan de mostrarse)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Columna eliminada }
 */
router.put(
  "/boards/:id/fields/:fieldId",
  validate(fieldParamSchema, "params"),
  validate(updateFieldSchema),
  plannerController.updateField
);
router.delete("/boards/:id/fields/:fieldId", validate(fieldParamSchema, "params"), plannerController.deleteField);

/**
 * @openapi
 * /planner/boards/{id}/fields/{fieldId}/move:
 *   put:
 *     tags: [Planner]
 *     summary: Sube o baja una columna personalizada un puesto entre las del tablero
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Columna movida (no-op si ya está en el extremo) }
 */
router.put(
  "/boards/:id/fields/:fieldId/move",
  validate(fieldParamSchema, "params"),
  validate(moveFieldSchema),
  plannerController.moveField
);

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
