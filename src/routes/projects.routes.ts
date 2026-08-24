import { Router } from "express";
import * as projectsController from "../controllers/projectsController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import {
  idParamSchema,
  projectTaskParamsSchema,
  listProjectsQuerySchema,
  createProjectSchema,
  updateProjectSchema,
  createTaskSchema,
  updateTaskSchema,
} from "../validators/projectsValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: Lista proyectos del usuario
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [idea, en_curso, pausado, completado] }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high] }
 *     responses:
 *       200: { description: Lista de proyectos }
 *   post:
 *     tags: [Projects]
 *     summary: Crear proyecto
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Proyecto creado }
 */
router.get("/", validate(listProjectsQuerySchema, "query"), projectsController.listProjects);
router.post("/", validate(createProjectSchema), projectsController.createProject);

/**
 * @openapi
 * /projects/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Detalle de proyecto + tareas + progreso
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Proyecto con tareas y % de progreso }
 *   put:
 *     tags: [Projects]
 *     summary: Editar proyecto
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Proyecto actualizado }
 *   delete:
 *     tags: [Projects]
 *     summary: Eliminar proyecto
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Proyecto eliminado }
 */
router.get("/:id", validate(idParamSchema, "params"), projectsController.getProject);
router.put(
  "/:id",
  validate(idParamSchema, "params"),
  validate(updateProjectSchema),
  projectsController.updateProject
);
router.delete("/:id", validate(idParamSchema, "params"), projectsController.deleteProject);

/**
 * @openapi
 * /projects/{id}/progress:
 *   get:
 *     tags: [Projects]
 *     summary: Porcentaje de progreso del proyecto (tareas completadas / total)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Progreso del proyecto }
 */
router.get("/:id/progress", validate(idParamSchema, "params"), projectsController.getProgress);

/**
 * @openapi
 * /projects/{id}/tasks:
 *   post:
 *     tags: [Projects]
 *     summary: Agregar tarea al proyecto
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Tarea creada }
 */
router.post(
  "/:id/tasks",
  validate(idParamSchema, "params"),
  validate(createTaskSchema),
  projectsController.addTask
);

/**
 * @openapi
 * /projects/{id}/tasks/{taskId}:
 *   put:
 *     tags: [Projects]
 *     summary: Editar tarea
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tarea actualizada }
 */
router.put(
  "/:id/tasks/:taskId",
  validate(projectTaskParamsSchema, "params"),
  validate(updateTaskSchema),
  projectsController.updateTask
);

/**
 * @openapi
 * /projects/{id}/tasks/{taskId}/complete:
 *   put:
 *     tags: [Projects]
 *     summary: Marcar tarea como completada
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tarea marcada como completada }
 */
router.put(
  "/:id/tasks/:taskId/complete",
  validate(projectTaskParamsSchema, "params"),
  projectsController.completeTask
);

export default router;
