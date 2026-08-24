jest.mock("../../../src/config/database", () => ({
  prisma: {
    transaction: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    savingsGoal: { findMany: jest.fn(), create: jest.fn() },
  },
}));

import { prisma } from "../../../src/config/database";
import * as financeService from "../../../src/services/financeService";

const prismaMock = prisma as unknown as {
  transaction: {
    aggregate: jest.Mock;
    findMany: jest.Mock;
    groupBy: jest.Mock;
  };
  savingsGoal: { findMany: jest.Mock };
};

describe("financeService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getMonthlyBalance", () => {
    it("calcula income, expense y balance a partir de los aggregate", async () => {
      prismaMock.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 1000 } }) // income
        .mockResolvedValueOnce({ _sum: { amount: 300 } }); // expense

      const result = await financeService.getMonthlyBalance(1, 8, 2026);

      expect(result).toEqual({ month: 8, year: 2026, income: 1000, expense: 300, balance: 700 });
    });

    it("trata _sum null (sin transacciones) como 0", async () => {
      prismaMock.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });

      const result = await financeService.getMonthlyBalance(1, 8, 2026);

      expect(result.income).toBe(0);
      expect(result.expense).toBe(0);
      expect(result.balance).toBe(0);
    });
  });

  describe("getAnnualBalance", () => {
    it("agrupa las transacciones por mes en una sola consulta", async () => {
      prismaMock.transaction.findMany.mockResolvedValue([
        { type: "income", amount: 1000, date: new Date(2026, 0, 15) },
        { type: "expense", amount: 200, date: new Date(2026, 0, 20) },
        { type: "income", amount: 1000, date: new Date(2026, 1, 15) },
        { type: "expense", amount: 500, date: new Date(2026, 5, 1) },
      ]);

      const result = await financeService.getAnnualBalance(1, 2026);

      expect(prismaMock.transaction.findMany).toHaveBeenCalledTimes(1);
      expect(result.income).toBe(2000);
      expect(result.expense).toBe(700);
      expect(result.balance).toBe(1300);
      expect(result.monthlyBreakdown).toHaveLength(12);
      expect(result.monthlyBreakdown[0]).toEqual({ month: 1, year: 2026, income: 1000, expense: 200, balance: 800 });
      expect(result.monthlyBreakdown[1].income).toBe(1000);
      expect(result.monthlyBreakdown[5].expense).toBe(500);
      expect(result.monthlyBreakdown[11].income).toBe(0);
    });
  });

  describe("listSavingsGoals", () => {
    it("retorna [] sin consultar transacciones si el usuario no tiene metas de ahorro", async () => {
      prismaMock.savingsGoal.findMany.mockResolvedValue([]);

      const result = await financeService.listSavingsGoals(1);

      expect(result).toEqual([]);
      expect(prismaMock.transaction.groupBy).not.toHaveBeenCalled();
    });

    it("calcula currentAmount y progressPercent a partir de ingresos menos gastos de esa categoría", async () => {
      prismaMock.savingsGoal.findMany.mockResolvedValue([
        { id: 1, userId: 1, name: "Vacaciones", targetAmount: 200, category: "savings-vacation" },
      ]);
      prismaMock.transaction.groupBy.mockResolvedValue([
        { category: "savings-vacation", type: "income", _sum: { amount: 150 } },
        { category: "savings-vacation", type: "expense", _sum: { amount: 50 } },
      ]);

      const result = await financeService.listSavingsGoals(1);

      expect(result[0].currentAmount).toBe(100);
      expect(result[0].progressPercent).toBe(50);
    });

    it("progressPercent no supera 100 aunque currentAmount exceda targetAmount", async () => {
      prismaMock.savingsGoal.findMany.mockResolvedValue([
        { id: 1, userId: 1, name: "Meta", targetAmount: 100, category: "cat" },
      ]);
      prismaMock.transaction.groupBy.mockResolvedValue([
        { category: "cat", type: "income", _sum: { amount: 500 } },
      ]);

      const result = await financeService.listSavingsGoals(1);

      expect(result[0].currentAmount).toBe(500);
      expect(result[0].progressPercent).toBe(100);
    });

    it("currentAmount nunca es negativo aunque los gastos superen los ingresos", async () => {
      prismaMock.savingsGoal.findMany.mockResolvedValue([
        { id: 1, userId: 1, name: "Meta", targetAmount: 100, category: "cat" },
      ]);
      prismaMock.transaction.groupBy.mockResolvedValue([
        { category: "cat", type: "expense", _sum: { amount: 50 } },
      ]);

      const result = await financeService.listSavingsGoals(1);

      expect(result[0].currentAmount).toBe(0);
    });
  });

  describe("getAnalytics", () => {
    it("calcula topCategories del mes actual y monthlyTrend de 6 meses con una sola consulta", async () => {
      const reference = new Date(2026, 7, 1); // agosto 2026
      prismaMock.transaction.findMany.mockResolvedValue([
        { type: "expense", category: "food", amount: 300, date: new Date(2026, 7, 5) },
        { type: "expense", category: "transport", amount: 100, date: new Date(2026, 7, 10) },
        { type: "income", category: "salary", amount: 2000, date: new Date(2026, 7, 1) },
        // mes anterior, no debería contar para topCategories pero sí para monthlyTrend
        { type: "expense", category: "food", amount: 999, date: new Date(2026, 6, 5) },
      ]);

      const result = await financeService.getAnalytics(1, reference.getMonth() + 1, reference.getFullYear());

      expect(prismaMock.transaction.findMany).toHaveBeenCalledTimes(1);
      expect(result.topCategories).toEqual([
        { category: "food", total: 300 },
        { category: "transport", total: 100 },
      ]);
      expect(result.monthlyTrend).toHaveLength(6);

      const augustBucket = result.monthlyTrend.find((m) => m.month === 8 && m.year === 2026);
      expect(augustBucket?.income).toBe(2000);
      expect(augustBucket?.expense).toBe(400);

      const julyBucket = result.monthlyTrend.find((m) => m.month === 7 && m.year === 2026);
      expect(julyBucket?.expense).toBe(999);
    });

    it("limita topCategories a las 5 categorías con mayor gasto", async () => {
      const reference = new Date(2026, 7, 1);
      prismaMock.transaction.findMany.mockResolvedValue(
        ["a", "b", "c", "d", "e", "f"].map((cat, i) => ({
          type: "expense",
          category: cat,
          amount: (i + 1) * 10,
          date: new Date(2026, 7, 2),
        }))
      );

      const result = await financeService.getAnalytics(1, 8, 2026);

      expect(result.topCategories).toHaveLength(5);
      expect(result.topCategories[0]).toEqual({ category: "f", total: 60 });
    });
  });
});
