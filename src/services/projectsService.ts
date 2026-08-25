import { prisma } from "../config/database";
import { buildPagination } from "../utils/pagination";
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
  page?: number;
  limit?: number;
}

export async function listProjects(userId: number, filters: ListProjectsFilters = {}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const where = {
    userId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.project.count({ where }),
  ]);

  return { projects, pagination: buildPagination(page, limit, total) };
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

interface PageInput {
  title?: string | null;
  content?: string;
}

export async function listPages(userId: number, projectId: number) {
  await findOwnedProject(userId, projectId);
  return prisma.projectPage.findMany({ where: { projectId }, orderBy: { order: "asc" } });
}

export async function addPage(userId: number, projectId: number, input: PageInput) {
  await findOwnedProject(userId, projectId);
  const last = await prisma.projectPage.findFirst({ where: { projectId }, orderBy: { order: "desc" } });
  return prisma.projectPage.create({
    data: {
      projectId,
      title: input.title?.trim() || "Página sin título",
      content: input.content ?? "",
      order: (last?.order ?? -1) + 1,
    },
  });
}

async function findOwnedPage(userId: number, projectId: number, pageId: number) {
  await findOwnedProject(userId, projectId);
  const page = await prisma.projectPage.findUnique({ where: { id: pageId } });
  if (!page || page.projectId !== projectId) {
    throw new NotFoundError("Página no encontrada");
  }
  return page;
}

export async function updatePage(userId: number, projectId: number, pageId: number, input: PageInput & { order?: number }) {
  await findOwnedPage(userId, projectId, pageId);
  return prisma.projectPage.update({
    where: { id: pageId },
    data: {
      ...(input.title !== undefined ? { title: input.title?.trim() || "Página sin título" } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
    },
  });
}

export async function deletePage(userId: number, projectId: number, pageId: number) {
  await findOwnedPage(userId, projectId, pageId);
  await prisma.projectPage.delete({ where: { id: pageId } });
}

export async function completeTask(userId: number, projectId: number, taskId: number) {
  await findOwnedTask(userId, projectId, taskId);
  return prisma.projectTask.update({
    where: { id: taskId },
    data: { completed: true, completedAt: new Date() },
  });
}
