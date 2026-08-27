jest.mock("../../../src/config/database", () => ({
  prisma: {
    habit: { findMany: jest.fn() },
    habitLog: { findMany: jest.fn() },
    task: { findMany: jest.fn() },
  },
}));

import { prisma } from "../../../src/config/database";
import * as streakService from "../../../src/services/streakService";

const prismaMock = prisma as unknown as {
  habit: { findMany: jest.Mock };
  habitLog: { findMany: jest.Mock };
  task: { findMany: jest.Mock };
};

// Congelamos "hoy" para que los tests no dependan del día real en que se ejecutan. Reemplazo
// directo de global.Date (con `as any`, no jest.spyOn) porque DateConstructor tiene demasiadas
// sobrecargas para tipar un mock parcial limpiamente.
const REAL_DATE = Date;
function freezeToday(iso: string) {
  const fixed = new REAL_DATE(iso);
  class FakeDate extends REAL_DATE {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fixed.getTime());
      } else {
        // @ts-expect-error -- construir con los argumentos originales para `new Date(x, ...)`
        super(...args);
      }
    }
    static override now(): number {
      return fixed.getTime();
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).Date = FakeDate;
}

function dayKey(daysAgo: number, base = "2026-08-27"): string {
  const d = new REAL_DATE(`${base}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

describe("streakService.computeCombinedStreak", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    freezeToday("2026-08-27T12:00:00.000Z"); // "hoy" = 2026-08-27 durante el test
  });

  afterEach(() => {
    global.Date = REAL_DATE;
  });

  it("cuenta 0 si el hábito de hoy no está marcado", async () => {
    prismaMock.habit.findMany.mockResolvedValue([{ id: 1, createdAt: new REAL_DATE("2026-08-01") }]);
    prismaMock.habitLog.findMany.mockResolvedValue([]); // nada marcado nunca
    prismaMock.task.findMany.mockResolvedValue([]);

    const result = await streakService.computeCombinedStreak(1);

    expect(result.streak).toBe(0);
  });

  it("cuenta los días consecutivos con el hábito marcado", async () => {
    prismaMock.habit.findMany.mockResolvedValue([{ id: 1, createdAt: new REAL_DATE("2026-08-01") }]);
    prismaMock.habitLog.findMany.mockResolvedValue([
      { habitId: 1, date: new REAL_DATE(`${dayKey(0)}T00:00:00.000Z`) },
      { habitId: 1, date: new REAL_DATE(`${dayKey(1)}T00:00:00.000Z`) },
      { habitId: 1, date: new REAL_DATE(`${dayKey(2)}T00:00:00.000Z`) },
      // dayKey(3) sin marcar -> corta ahí
    ]);
    prismaMock.task.findMany.mockResolvedValue([]);

    const result = await streakService.computeCombinedStreak(1);

    expect(result.streak).toBe(3);
    expect(result.sinceDate).toBe(dayKey(2));
  });

  it("una tarea vencida y sin completar rompe la racha ese día", async () => {
    prismaMock.habit.findMany.mockResolvedValue([]); // sin hábitos, solo tareas
    prismaMock.habitLog.findMany.mockResolvedValue([]);
    prismaMock.task.findMany.mockResolvedValue([
      { dueDate: new REAL_DATE(`${dayKey(0)}T00:00:00.000Z`), status: "done" },
      { dueDate: new REAL_DATE(`${dayKey(1)}T00:00:00.000Z`), status: "todo" }, // sin completar
    ]);

    const result = await streakService.computeCombinedStreak(1);

    expect(result.streak).toBe(1); // solo hoy cuenta, ayer rompe la racha
  });

  it("un día sin hábitos activos ni tareas con vencimiento no rompe ni cuenta la racha (se salta)", async () => {
    // Hábito creado hoy: dayKey(1) (ayer) no tenía el hábito activo todavía -> se salta, no rompe.
    prismaMock.habit.findMany.mockResolvedValue([{ id: 1, createdAt: new REAL_DATE(`${dayKey(0)}T00:00:00.000Z`) }]);
    prismaMock.habitLog.findMany.mockResolvedValue([{ habitId: 1, date: new REAL_DATE(`${dayKey(0)}T00:00:00.000Z`) }]);
    prismaMock.task.findMany.mockResolvedValue([]);

    const result = await streakService.computeCombinedStreak(1);

    // Solo hoy tenía algo que evaluar (el hábito ya existía); los días anteriores se saltan
    // por no tener nada que trackear, así que la racha sigue siendo 1 y no se corta ahí mismo.
    expect(result.streak).toBe(1);
  });

  it("una cuenta sin hábitos ni tareas con vencimiento nunca da una racha por vacuidad", async () => {
    prismaMock.habit.findMany.mockResolvedValue([]);
    prismaMock.habitLog.findMany.mockResolvedValue([]);
    prismaMock.task.findMany.mockResolvedValue([]);

    const result = await streakService.computeCombinedStreak(1);

    expect(result.streak).toBe(0);
    expect(result.sinceDate).toBeNull();
  });

  it("combina hábitos Y tareas: ambos deben cumplirse el mismo día", async () => {
    prismaMock.habit.findMany.mockResolvedValue([{ id: 1, createdAt: new REAL_DATE("2026-08-01") }]);
    prismaMock.habitLog.findMany.mockResolvedValue([{ habitId: 1, date: new REAL_DATE(`${dayKey(0)}T00:00:00.000Z`) }]);
    // Hábito marcado hoy, pero hay una tarea de hoy sin completar -> no cuenta.
    prismaMock.task.findMany.mockResolvedValue([{ dueDate: new REAL_DATE(`${dayKey(0)}T00:00:00.000Z`), status: "todo" }]);

    const result = await streakService.computeCombinedStreak(1);

    expect(result.streak).toBe(0);
  });
});
