import { prisma } from "../config/database";
import { ForbiddenError, NotFoundError } from "../utils/errorHandler";

interface CreateProjectInput {
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  deadline?: string | Date | null;
}

export async function createProject(userId: number, input: CreateProjectInput) {
  return prisma.project.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "idea",
      priority: input.priority ?? "medium",
      deadline: input.deadline ? new Date(input.deadline) : null,
    },
  });
}

interface ListProjectsFilters {
  status?: string;
  priority?: string;
}

export async function listProjects(userId: number, filters: ListProjectsFilters = {}) {
  return prisma.project.findMany({
    where: {
      userId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

async function findOwnedProject(userId: number, projectId: number) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError("Proyecto no encontrado");
  if (project.userId !== userId) throw new ForbiddenError("No autorizado");
  return project;
}

function computeProgress(tasks: { completed: boolean }[]) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
}

export async function getProjectDetail(userId: number, projectId: number) {
  const project = await findOwnedProject(userId, projectId);
  const tasks = await prisma.projectTask.findMany({
    where: { projectId },
    orderBy: { id: "asc" },
  });

  return { ...project, tasks, progress: computeProgress(tasks) };
}

export async function updateProject(userId: number, projectId: number, input: Partial<CreateProjectInput>) {
  await findOwnedProject(userId, projectId);

  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.deadline !== undefined ? { deadline: input.deadline ? new Date(input.deadline) : null } : {}),
    },
  });
}

export async function deleteProject(userId: number, projectId: number) {
  await findOwnedProject(userId, projectId);
  await prisma.project.delete({ where: { id: projectId } });
}

export async function getProjectProgress(userId: number, projectId: number) {
  await findOwnedProject(userId, projectId);
  const tasks = await prisma.projectTask.findMany({ where: { projectId } });
  return { projectId, ...computeProgress(tasks) };
}

export async function addTask(userId: number, projectId: number, title: string) {
  await findOwnedProject(userId, projectId);
  return prisma.projectTask.create({ data: { projectId, title } });
}

async function findOwnedTask(userId: number, projectId: number, taskId: number) {
  await findOwnedProject(userId, projectId);
  const task = await prisma.projectTask.findUnique({ where: { id: taskId } });
  if (!task || task.projectId !== projectId) {
    throw new NotFoundError("Tarea no encontrada");
  }
  return task;
}

export async function updateTask(userId: number, projectId: number, taskId: number, title: string) {
  await findOwnedTask(userId, projectId, taskId);
  return prisma.projectTask.update({ where: { id: taskId }, data: { title } });
}

export async function completeTask(userId: number, projectId: number, taskId: number) {
  await findOwnedTask(userId, projectId, taskId);
  return prisma.projectTask.update({
    where: { id: taskId },
    data: { completed: true, completedAt: new Date() },
  });
}
