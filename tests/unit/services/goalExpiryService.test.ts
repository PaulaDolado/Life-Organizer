jest.mock("../../../src/config/database", () => ({
  prisma: {
    goal: { findMany: jest.fn(), update: jest.fn(), create: jest.fn() },
  },
}));

import { prisma } from "../../../src/config/database";
import { processExpiredGoals } from "../../../src/services/goalExpiryService";

const prismaMock = prisma as unknown as {
  goal: { findMany: jest.Mock; update: jest.Mock; create: jest.Mock };
};

describe("goalExpiryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("no hace nada si no hay metas expiradas", async () => {
    prismaMock.goal.findMany.mockResolvedValue([]);

    const result = await processExpiredGoals();

    expect(result).toEqual({ archived: 0, renewed: 0 });
    expect(prismaMock.goal.update).not.toHaveBeenCalled();
    expect(prismaMock.goal.create).not.toHaveBeenCalled();
  });

  it("archiva una meta expirada con autoRenew=false sin crear una nueva", async () => {
    const expiredGoal = {
      id: 1,
      userId: 7,
      title: "Meta puntual",
      description: null,
      period: "weekly",
      targetValue: 5,
      bonusPoints: 10,
      autoRenew: false,
      periodStart: new Date(2026, 0, 1),
      periodEnd: new Date(2026, 0, 7),
    };
    prismaMock.goal.findMany.mockResolvedValue([expiredGoal]);

    const result = await processExpiredGoals();

    expect(result).toEqual({ archived: 1, renewed: 0 });
    expect(prismaMock.goal.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { expired: true } });
    expect(prismaMock.goal.create).not.toHaveBeenCalled();
  });

  it("archiva y renueva una meta expirada con autoRenew=true, continuando desde periodEnd", async () => {
    const expiredGoal = {
      id: 2,
      userId: 7,
      title: "Ejercicio 5 días",
      description: "Cardio",
      period: "weekly",
      targetValue: 5,
      bonusPoints: 15,
      autoRenew: true,
      periodStart: new Date(2026, 0, 1), // jueves
      periodEnd: new Date(2026, 0, 4), // domingo (fin de semana ISO)
    };
    prismaMock.goal.findMany.mockResolvedValue([expiredGoal]);

    const result = await processExpiredGoals();

    expect(result).toEqual({ archived: 1, renewed: 1 });
    expect(prismaMock.goal.create).toHaveBeenCalledTimes(1);

    const createdData = prismaMock.goal.create.mock.calls[0][0].data;
    expect(createdData.userId).toBe(7);
    expect(createdData.title).toBe("Ejercicio 5 días");
    expect(createdData.targetValue).toBe(5);
    expect(createdData.autoRenew).toBe(true);
    expect(createdData.periodStart).toEqual(expiredGoal.periodEnd); // continúa justo donde terminó
    expect(createdData.periodEnd.getTime()).toBeGreaterThan(createdData.periodStart.getTime());
    // No debe traer currentValue/completed de la meta anterior — Prisma aplica sus defaults (0/false).
    expect(createdData.currentValue).toBeUndefined();
    expect(createdData.completed).toBeUndefined();
  });

  it("procesa varias metas expiradas de distintos usuarios en una sola pasada", async () => {
    prismaMock.goal.findMany.mockResolvedValue([
      {
        id: 1,
        userId: 1,
        title: "A",
        description: null,
        period: "weekly",
        targetValue: 1,
        bonusPoints: 10,
        autoRenew: true,
        periodStart: new Date(2026, 0, 1),
        periodEnd: new Date(2026, 0, 4),
      },
      {
        id: 2,
        userId: 2,
        title: "B",
        description: null,
        period: "monthly",
        targetValue: 1,
        bonusPoints: 10,
        autoRenew: false,
        periodStart: new Date(2026, 0, 1),
        periodEnd: new Date(2026, 0, 31),
      },
    ]);

    const result = await processExpiredGoals();

    expect(result).toEqual({ archived: 2, renewed: 1 });
    expect(prismaMock.goal.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.goal.create).toHaveBeenCalledTimes(1);
  });

  it("consulta solo metas con periodEnd pasado y expired=false", async () => {
    prismaMock.goal.findMany.mockResolvedValue([]);
    const now = new Date(2026, 5, 15);

    await processExpiredGoals(now);

    expect(prismaMock.goal.findMany).toHaveBeenCalledWith({
      where: { periodEnd: { lt: now }, expired: false },
    });
  });
});
