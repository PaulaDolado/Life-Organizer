jest.mock("../../../src/config/database", () => ({
  prisma: {
    event: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

import { prisma } from "../../../src/config/database";
import * as agendaService from "../../../src/services/agendaService";
import { ForbiddenError, NotFoundError } from "../../../src/utils/errorHandler";

const prismaMock = prisma as unknown as {
  event: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock; delete: jest.Mock };
  user: { findUnique: jest.Mock };
};

describe("agendaService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ timezone: "UTC" });
  });

  describe("getDay", () => {
    it("filtra eventos entre el inicio y fin del día indicado (en UTC, la timezone del usuario mockeado)", async () => {
      prismaMock.event.findMany.mockResolvedValue([{ id: 1 }]);

      const result = await agendaService.getDay(1, "2026-08-24");

      const whereArg = prismaMock.event.findMany.mock.calls[0][0].where;
      expect(whereArg.startTime.gte.toISOString()).toBe("2026-08-24T00:00:00.000Z");
      expect(whereArg.endTime.lte.toISOString()).toBe("2026-08-24T23:59:59.999Z");
      expect(result.events).toHaveLength(1);
    });

    it("usa la timezone guardada del usuario, no la del servidor", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ timezone: "Europe/Madrid" });
      prismaMock.event.findMany.mockResolvedValue([]);

      const result = await agendaService.getDay(1, "2026-08-24");

      const whereArg = prismaMock.event.findMany.mock.calls[0][0].where;
      // Medianoche en Madrid en agosto (verano, UTC+2) = 22:00 UTC del día anterior.
      expect(whereArg.startTime.gte.toISOString()).toBe("2026-08-23T22:00:00.000Z");
      expect(result.timezone).toBe("Europe/Madrid");
    });

    it("cae de vuelta al timezone por defecto si el guardado en BD es inválido", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ timezone: "no-es-una-timezone-real" });
      prismaMock.event.findMany.mockResolvedValue([]);

      const result = await agendaService.getDay(1, "2026-08-24");

      expect(result.timezone).toBe("Europe/Madrid"); // DEFAULT_TIMEZONE
    });

    it("aplica el filtro por type cuando se indica", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);

      await agendaService.getDay(1, "2026-08-24", { type: "gym" });

      const whereArg = prismaMock.event.findMany.mock.calls[0][0].where;
      expect(whereArg.type).toBe("gym");
    });

    it("no incluye type en el where cuando no se indica filtro", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);

      await agendaService.getDay(1, "2026-08-24");

      const whereArg = prismaMock.event.findMany.mock.calls[0][0].where;
      expect(whereArg.type).toBeUndefined();
    });
  });

  describe("getWeek con eventos recurrentes", () => {
    it("expande una plantilla recurrente cuya ocurrencia cae dentro de la semana pedida, aunque su startTime original sea de semanas atrás", async () => {
      const recurringTemplate = {
        id: 5,
        userId: 1,
        title: "Gym recurrente",
        type: "gym",
        isRecurring: true,
        recurringPattern: "weekly",
        startTime: new Date("2026-08-03T18:00:00.000Z"), // 3 semanas antes de la semana consultada
        endTime: new Date("2026-08-03T19:00:00.000Z"),
      };

      prismaMock.event.findMany.mockImplementation(({ where }) => {
        if (where.isRecurring === true) return Promise.resolve([recurringTemplate]);
        return Promise.resolve([]); // no hay eventos no-recurrentes esta semana
      });

      const result = await agendaService.getWeek(1, "2026-08-24");

      expect(result.events).toHaveLength(1);
      expect(result.events[0].isRecurringInstance).toBe(true);
      expect(result.events[0].startTime.toISOString()).toBe("2026-08-24T18:00:00.000Z");
      // la plantilla original no se modifica ni se duplica
      expect(recurringTemplate.startTime.toISOString()).toBe("2026-08-03T18:00:00.000Z");
    });

    it("no expande una plantilla cuyo recurringPattern no produce ninguna ocurrencia esa semana", async () => {
      const recurringTemplate = {
        id: 5,
        userId: 1,
        isRecurring: true,
        recurringPattern: "monthly",
        startTime: new Date("2026-08-03T18:00:00.000Z"),
        endTime: new Date("2026-08-03T19:00:00.000Z"),
      };

      prismaMock.event.findMany.mockImplementation(({ where }) => {
        if (where.isRecurring === true) return Promise.resolve([recurringTemplate]);
        return Promise.resolve([]);
      });

      // Semana siguiente a la original (Aug10-Aug16): la próxima ocurrencia "monthly" es Sep3, no cae aquí.
      const result = await agendaService.getWeek(1, "2026-08-10");

      expect(result.events).toHaveLength(0);
    });
  });

  describe("paginación", () => {
    it("aplica page/limit sobre el conjunto combinado de eventos y reporta el total real", async () => {
      const events = [1, 2, 3].map((n) => ({
        id: n,
        userId: 1,
        isRecurring: false,
        startTime: new Date(`2026-08-24T0${n}:00:00.000Z`),
        endTime: new Date(`2026-08-24T0${n}:30:00.000Z`),
      }));

      prismaMock.event.findMany.mockImplementation(({ where }) => {
        if (where.isRecurring === false) return Promise.resolve(events);
        return Promise.resolve([]);
      });

      const result = await agendaService.getDay(1, "2026-08-24", { page: 2, limit: 2 });

      expect(result.events).toHaveLength(1); // 3 eventos, página 2 de tamaño 2 → solo el 3º
      expect(result.events[0].id).toBe(3);
      expect(result.pagination).toEqual({ page: 2, limit: 2, total: 3, pages: 2 });
    });
  });

  describe("updateEvent / deleteEvent (ownership)", () => {
    it("lanza NotFoundError si el evento no existe", async () => {
      prismaMock.event.findUnique.mockResolvedValue(null);

      await expect(agendaService.updateEvent(1, 999, { title: "x" })).rejects.toThrow(NotFoundError);
    });

    it("lanza ForbiddenError si el evento pertenece a otro usuario", async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 1, userId: 2 });

      await expect(agendaService.deleteEvent(1, 1)).rejects.toThrow(ForbiddenError);
    });

    it("permite actualizar un evento propio", async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      prismaMock.event.update.mockResolvedValue({ id: 1, userId: 1, title: "Nuevo" });

      const updated = await agendaService.updateEvent(1, 1, { title: "Nuevo" });

      expect(updated.title).toBe("Nuevo");
    });
  });
});
