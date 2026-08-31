import { prisma } from "../config/database";
import { ForbiddenError, NotFoundError } from "../utils/errorHandler";
import { recordTombstone } from "./tombstoneService";

const DEFAULT_STATUS = "todo";
const DEFAULT_PRIORITY = "medium";

interface TaskInputFields {
  title?: string;
  description?: string | null;
  image?: string | null;
  notes?: string | null;
  status?: string;
  priority?: string;
  order?: number;
  dueDate?: string | Date | null;
  tags?: string[];
  estimatedMinutes?: number | null;
  projectId?: number | null;
}

type CreateTaskInput = TaskInputFields & { title: string };
type UpdateTaskInput = TaskInputFields;

interface ListTasksFilters {
  projectId?: number;
  tag?: string;
}

// Orden estable de las subtareas de una tarjeta: no tienen `order` propio (ver comentario en
// el schema), así que se listan por antigüedad.
const SUBTASKS_INCLUDE = { subtasks: { orderBy: { createdAt: "asc" as const } } };

async function assertOwnedProject(userId: number, projectId: number): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError("Proyecto no encontrado");
  if (project.userId !== userId) throw new ForbiddenError("No autorizado");
}

export async function listTasks(userId: number, filters: ListTasksFilters = {}) {
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      ...(filters.projectId !== undefined ? { projectId: filters.projectId } : {}),
      ...(filters.tag ? { tags: { has: filters.tag } } : {}),
    },
    orderBy: { order: "asc" },
    include: SUBTASKS_INCLUDE,
  });
  return { tasks };
}

export async function createTask(userId: number, input: CreateTaskInput) {
  const status = input.status ?? DEFAULT_STATUS;

  if (input.projectId !== undefined && input.projectId !== null) {
    await assertOwnedProject(userId, input.projectId);
  }

  // Sin `order` explícito, la tarea nueva va al final de su columna.
  let order = input.order;
  if (order === undefined) {
    const last = await prisma.task.findFirst({
      where: { userId, status },
      orderBy: { order: "desc" },
    });
    order = (last?.order ?? 0) + 1000;
  }

  return prisma.task.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      image: input.image ?? null,
      notes: input.notes ?? null,
      status,
      priority: input.priority ?? DEFAULT_PRIORITY,
      order,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      tags: input.tags ?? [],
      estimatedMinutes: input.estimatedMinutes ?? null,
      projectId: input.projectId ?? null,
    },
    include: SUBTASKS_INCLUDE,
  });
}

async function findOwnedTask(userId: number, taskId: number) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Tarea no encontrada");
  if (task.userId !== userId) throw new ForbiddenError("No autorizado");
  return task;
}

export async function updateTask(userId: number, taskId: number, input: UpdateTaskInput) {
  await findOwnedTask(userId, taskId);

  if (input.projectId !== undefined && input.projectId !== null) {
    await assertOwnedProject(userId, input.projectId);
  }

  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.image !== undefined ? { image: input.image || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.estimatedMinutes !== undefined ? { estimatedMinutes: input.estimatedMinutes } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    },
    include: SUBTASKS_INCLUDE,
  });
}

export async function deleteTask(userId: number, taskId: number) {
  await findOwnedTask(userId, taskId);
  // Tombstone en la misma transacción (ver tombstoneService.ts) — el móvil necesita saber que
  // esta tarea (y sus subtareas, que caen en cascada) desapareció en su próximo /sync/pull.
  await prisma.$transaction([
    prisma.task.delete({ where: { id: taskId } }),
    recordTombstone(prisma, userId, "task", taskId),
  ]);
}

// Tiempo real: en vez de guardar un booleano/valor absoluto, cada llamada SUMA minutos al
// acumulado (como una sesión de trabajo registrada) — así el usuario puede ir apuntando el
// tiempo dedicado en varias tandas sin tener que recalcular el total él mismo.
export async function logTime(userId: number, taskId: number, minutes: number) {
  await findOwnedTask(userId, taskId);
  return prisma.task.update({
    where: { id: taskId },
    data: { actualMinutes: { increment: minutes } },
    include: SUBTASKS_INCLUDE,
  });
}

export async function addSubtask(userId: number, taskId: number, title: string) {
  await findOwnedTask(userId, taskId);
  return prisma.subtask.create({ data: { taskId, title } });
}

async function findOwnedSubtask(userId: number, taskId: number, subtaskId: number) {
  await findOwnedTask(userId, taskId);
  const subtask = await prisma.subtask.findUnique({ where: { id: subtaskId } });
  if (!subtask || subtask.taskId !== taskId) {
    throw new NotFoundError("Subtarea no encontrada");
  }
  return subtask;
}

interface UpdateSubtaskInput {
  title?: string;
  completed?: boolean;
}

export async function updateSubtask(userId: number, taskId: number, subtaskId: number, input: UpdateSubtaskInput) {
  await findOwnedSubtask(userId, taskId, subtaskId);
  return prisma.subtask.update({
    where: { id: subtaskId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.completed !== undefined ? { completed: input.completed } : {}),
    },
  });
}

export async function deleteSubtask(userId: number, taskId: number, subtaskId: number) {
  await findOwnedSubtask(userId, taskId, subtaskId);
  await prisma.$transaction([
    prisma.subtask.delete({ where: { id: subtaskId } }),
    recordTombstone(prisma, userId, "subtask", subtaskId),
  ]);
}
