jest.mock("../../../src/config/database", () => ({
  prisma: {
    goal: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    goalProgress: { create: jest.fn(), findMany: jest.fn() },
  },
}));

import { prisma } from "../../../src/config/database";
import * as goalsService from "../../../src/services/goalsService";
import { ForbiddenError, NotFoundError } from "../../../src/utils/errorHandler";

const prismaMock = prisma as unknown as {
  goal: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  goalProgress: { create: jest.Mock; findMany: jest.Mock };
};

describe("goalsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createGoal", () => {
    it("calcula periodEnd como fin de semana cuando period=weekly y no se indica", async () => {
      prismaMock.goal.create.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }));

      await goalsService.createGoal(1, { title: "Ejercicio", period: "weekly", targetValue: 5 });

      const dataArg = prismaMock.goal.create.mock.calls[0][0].data;
      expect(dataArg.periodStart).toBeInstanceOf(Date);
      expect(dataArg.periodEnd).toBeInstanceOf(Date);
      expect(dataArg.periodEnd.getTime()).toBeGreaterThan(dataArg.periodStart.getTime());
    });

    it("respeta periodEnd explícito si se indica", async () => {
      prismaMock.goal.create.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }));
      const explicitEnd = "2026-12-31T00:00:00.000Z";

      await goalsService.createGoal(1, {
        title: "Meta anual",
        period: "monthly",
        targetValue: 12,
        periodEnd: explicitEnd,
      });

      const dataArg = prismaMock.goal.create.mock.calls[0][0].data;
      expect(dataArg.periodEnd.toISOString()).toBe(explicitEnd);
    });
  });

  describe("registerProgress", () => {
    const existingGoal = {
      id: 1,
      userId: 1,
      targetValue: 3,
      currentValue: 2,
      completed: false,
      bonusPoints: 25,
    };

    it("marca la meta como completada al alcanzar targetValue y devuelve bonusPointsAwarded", async () => {
      prismaMock.goal.findUnique.mockResolvedValue(existingGoal);
      prismaMock.goalProgress.create.mockResolvedValue({ id: 10, value: 1 });
      prismaMock.goal.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...existingGoal, ...data })
      );

      const result = await goalsService.registerProgress(1, 1, { value: 1 });

      expect(result.goal.currentValue).toBe(3);
      expect(result.goal.completed).toBe(true);
      expect(result.justCompleted).toBe(true);
      expect(result.bonusPointsAwarded).toBe(25);
    });

    it("no vuelve a otorgar bonusPoints si la meta ya estaba completada", async () => {
      const alreadyCompleted = { ...existingGoal, currentValue: 3, completed: true };
      prismaMock.goal.findUnique.mockResolvedValue(alreadyCompleted);
      prismaMock.goalProgress.create.mockResolvedValue({ id: 11, value: 1 });
      prismaMock.goal.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...alreadyCompleted, ...data })
      );

      const result = await goalsService.registerProgress(1, 1, { value: 1 });

      expect(result.justCompleted).toBe(false);
      expect(result.bonusPointsAwarded).toBe(0);
    });

    it("lanza NotFoundError si la meta no existe", async () => {
      prismaMock.goal.findUnique.mockResolvedValue(null);

      await expect(goalsService.registerProgress(1, 999, { value: 1 })).rejects.toThrow(NotFoundError);
    });

    it("lanza ForbiddenError si la meta pertenece a otro usuario", async () => {
      prismaMock.goal.findUnique.mockResolvedValue({ ...existingGoal, userId: 2 });

      await expect(goalsService.registerProgress(1, 1, { value: 1 })).rejects.toThrow(ForbiddenError);
    });
  });

  describe("getGoalAnalytics", () => {
    it("calcula percentComplete y streakDays a partir del progreso reciente", async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const goal = {
        id: 1,
        userId: 1,
        targetValue: 10,
        currentValue: 4,
        completed: false,
        periodStart: new Date(today.getFullYear(), 0, 1),
        periodEnd: new Date(today.getFullYear(), 11, 31),
      };

      prismaMock.goal.findUnique.mockResolvedValue(goal);
      prismaMock.goalProgress.findMany.mockResolvedValue([
        { date: today, value: 2 },
        { date: yesterday, value: 2 },
      ]);

      const analytics = await goalsService.getGoalAnalytics(1, 1);

      expect(analytics.percentComplete).toBe(40);
      expect(analytics.streakDays).toBe(2);
      expect(analytics.completed).toBe(false);
    });

    it("percentComplete nunca supera 100 aunque currentValue exceda targetValue", async () => {
      const goal = {
        id: 1,
        userId: 1,
        targetValue: 5,
        currentValue: 8,
        completed: true,
        periodStart: new Date(2026, 0, 1),
        periodEnd: new Date(2026, 11, 31),
      };
      prismaMock.goal.findUnique.mockResolvedValue(goal);
      prismaMock.goalProgress.findMany.mockResolvedValue([]);

      const analytics = await goalsService.getGoalAnalytics(1, 1);

      expect(analytics.percentComplete).toBe(100);
    });
  });
});
