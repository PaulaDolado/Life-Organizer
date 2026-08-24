jest.mock("../../../src/config/database", () => ({
  prisma: {
    project: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    projectTask: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  },
}));

import { prisma } from "../../../src/config/database";
import * as projectsService from "../../../src/services/projectsService";
import { ForbiddenError, NotFoundError } from "../../../src/utils/errorHandler";

const prismaMock = prisma as unknown as {
  project: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  projectTask: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
};

describe("projectsService", () => {
  const ownedProject = { id: 1, userId: 1, title: "Life Organizer" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getProjectDetail / getProjectProgress", () => {
    it("calcula el progreso como 0% cuando no hay tareas", async () => {
      prismaMock.project.findUnique.mockResolvedValue(ownedProject);
      prismaMock.projectTask.findMany.mockResolvedValue([]);

      const detail = await projectsService.getProjectDetail(1, 1);

      expect(detail.progress).toEqual({ total: 0, completed: 0, percent: 0 });
    });

    it("calcula el % de tareas completadas correctamente", async () => {
      prismaMock.project.findUnique.mockResolvedValue(ownedProject);
      prismaMock.projectTask.findMany.mockResolvedValue([
        { id: 1, completed: true },
        { id: 2, completed: true },
        { id: 3, completed: false },
      ]);

      const progress = await projectsService.getProjectProgress(1, 1);

      expect(progress).toEqual({ projectId: 1, total: 3, completed: 2, percent: 67 });
    });

    it("lanza NotFoundError si el proyecto no existe", async () => {
      prismaMock.project.findUnique.mockResolvedValue(null);

      await expect(projectsService.getProjectDetail(1, 999)).rejects.toThrow(NotFoundError);
    });

    it("lanza ForbiddenError si el proyecto es de otro usuario", async () => {
      prismaMock.project.findUnique.mockResolvedValue({ ...ownedProject, userId: 2 });

      await expect(projectsService.getProjectDetail(1, 1)).rejects.toThrow(ForbiddenError);
    });
  });

  describe("completeTask", () => {
    it("lanza NotFoundError si la tarea no pertenece al proyecto indicado", async () => {
      prismaMock.project.findUnique.mockResolvedValue(ownedProject);
      prismaMock.projectTask.findUnique.mockResolvedValue({ id: 5, projectId: 999 });

      await expect(projectsService.completeTask(1, 1, 5)).rejects.toThrow(NotFoundError);
    });

    it("marca la tarea como completada con completedAt", async () => {
      prismaMock.project.findUnique.mockResolvedValue(ownedProject);
      prismaMock.projectTask.findUnique.mockResolvedValue({ id: 5, projectId: 1, completed: false });
      prismaMock.projectTask.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 5, projectId: 1, ...data })
      );

      const task = await projectsService.completeTask(1, 1, 5);

      expect(task.completed).toBe(true);
      expect(task.completedAt).toBeInstanceOf(Date);
    });
  });
});
