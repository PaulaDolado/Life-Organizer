import { prisma } from "../config/database";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { ForbiddenError, NotFoundError } from "../utils/errorHandler";

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

async function sumByType(userId: number, start: Date, end: Date) {
  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: "income", date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: "expense", date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
  ]);

  const income = toNumber(incomeAgg._sum.amount);
  const expense = toNumber(expenseAgg._sum.amount);
  return { income, expense, balance: income - expense };
}

export async function getMonthlyBalance(userId: number, month: number, year: number) {
  const reference = new Date(year, month - 1, 1);
  const start = startOfMonth(reference);
  const end = endOfMonth(reference);
  const totals = await sumByType(userId, start, end);
  return { month, year, ...totals };
}

export async function getAnnualBalance(userId: number, year: number) {
  const reference = new Date(year, 0, 1);
  const start = startOfYear(reference);
  const end = endOfYear(reference);
  const totals = await sumByType(userId, start, end);

  const monthlyBreakdown = [];
  for (let month = 1; month <= 12; month += 1) {
    const monthTotals = await getMonthlyBalance(userId, month, year);
    monthlyBreakdown.push(monthTotals);
  }

  return { year, ...totals, monthlyBreakdown };
}

interface ListTransactionsFilters {
  type?: string;
  category?: string;
  from?: string | Date;
  to?: string | Date;
  page: number;
  limit: number;
}

export async function listTransactions(userId: number, filters: ListTransactionsFilters) {
  const where = {
    userId,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.from || filters.to
      ? {
          date: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions,
    pagination: { page: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) },
  };
}

interface TransactionInput {
  type: "income" | "expense";
  amount: number;
  category: string;
  description?: string | null;
  date?: string | Date;
}

export async function createTransaction(userId: number, input: TransactionInput) {
  return prisma.transaction.create({
    data: {
      userId,
      type: input.type,
      amount: input.amount,
      category: input.category,
      description: input.description ?? null,
      ...(input.date ? { date: new Date(input.date) } : {}),
    },
  });
}

async function findOwnedTransaction(userId: number, id: number) {
  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction) throw new NotFoundError("Transacción no encontrada");
  if (transaction.userId !== userId) throw new ForbiddenError("No autorizado");
  return transaction;
}

export async function updateTransaction(userId: number, id: number, input: Partial<TransactionInput>) {
  await findOwnedTransaction(userId, id);

  return prisma.transaction.update({
    where: { id },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.date !== undefined ? { date: new Date(input.date) } : {}),
    },
  });
}

export async function deleteTransaction(userId: number, id: number) {
  await findOwnedTransaction(userId, id);
  await prisma.transaction.delete({ where: { id } });
}

interface SavingsGoalInput {
  name: string;
  targetAmount: number;
  category: string;
  deadline?: string | Date | null;
}

async function computeSavingsProgress(userId: number, category: string) {
  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, category, type: "income" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, category, type: "expense" },
      _sum: { amount: true },
    }),
  ]);
  return Math.max(0, toNumber(incomeAgg._sum.amount) - toNumber(expenseAgg._sum.amount));
}

export async function listSavingsGoals(userId: number) {
  const goals = await prisma.savingsGoal.findMany({ where: { userId } });

  return Promise.all(
    goals.map(async (goal) => {
      const currentAmount = await computeSavingsProgress(userId, goal.category);
      const targetAmount = toNumber(goal.targetAmount);
      return {
        ...goal,
        currentAmount,
        progressPercent: targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0,
      };
    })
  );
}

export async function createSavingsGoal(userId: number, input: SavingsGoalInput) {
  const goal = await prisma.savingsGoal.create({
    data: {
      userId,
      name: input.name,
      targetAmount: input.targetAmount,
      category: input.category,
      deadline: input.deadline ? new Date(input.deadline) : null,
    },
  });
  const currentAmount = await computeSavingsProgress(userId, goal.category);
  return { ...goal, currentAmount };
}

export async function getAnalytics(userId: number, month?: number, year?: number) {
  const now = new Date();
  const refMonth = month ?? now.getMonth() + 1;
  const refYear = year ?? now.getFullYear();
  const reference = new Date(refYear, refMonth - 1, 1);
  const start = startOfMonth(reference);
  const end = endOfMonth(reference);

  const grouped = await prisma.transaction.groupBy({
    by: ["category"],
    where: { userId, type: "expense", date: { gte: start, lte: end } },
    _sum: { amount: true },
  });

  const topCategories = grouped
    .map((g) => ({ category: g.category, total: toNumber(g._sum.amount) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const monthlyTrend = [];
  for (let i = 5; i >= 0; i -= 1) {
    const monthDate = subMonths(reference, i);
    const totals = await getMonthlyBalance(userId, monthDate.getMonth() + 1, monthDate.getFullYear());
    monthlyTrend.push(totals);
  }

  const avgMonthlyBalance =
    monthlyTrend.reduce((sum, m) => sum + m.balance, 0) / (monthlyTrend.length || 1);

  return {
    month: refMonth,
    year: refYear,
    topCategories,
    monthlyTrend,
    projectedAnnual: {
      basedOnMonths: monthlyTrend.length,
      avgMonthlyBalance: Math.round(avgMonthlyBalance * 100) / 100,
      projectedYearEnd: Math.round(avgMonthlyBalance * 12 * 100) / 100,
    },
  };
}
