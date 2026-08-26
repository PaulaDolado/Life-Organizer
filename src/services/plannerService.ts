import { prisma } from "../config/database";
import { ForbiddenError, NotFoundError } from "../utils/errorHandler";

const DEFAULT_STATUS = "todo";
const DEFAULT_PRIORITY = "medium";

interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  order?: number;
}

interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  order?: number;
}

export async function listTasks(userId: number) {
  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { order: "asc" },
  });
  return { tasks };
}

export async function createTask(userId: number, input: CreateTaskInput) {
  const status = input.status ?? DEFAULT_STATUS;

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
      status,
      priority: input.priority ?? DEFAULT_PRIORITY,
      order,
    },
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

  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
    },
  });
}

export async function deleteTask(userId: number, taskId: number) {
  await findOwnedTask(userId, taskId);
  await prisma.task.delete({ where: { id: taskId } });
}
