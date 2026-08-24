jest.mock("../../../src/config/database", () => ({
  prisma: {
    event: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
  },
}));

import { prisma } from "../../../src/config/database";
import * as agendaService from "../../../src/services/agendaService";
import { ForbiddenError, NotFoundError } from "../../../src/utils/errorHandler";

const prismaMock = prisma as unknown as {
  event: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock; delete: jest.Mock };
};

describe("agendaService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDay", () => {
    it("filtra eventos entre el inicio y fin del día indicado", async () => {
      prismaMock.event.findMany.mockResolvedValue([{ id: 1 }]);

      const result = await agendaService.getDay(1, "2026-08-24");

      const whereArg = prismaMock.event.findMany.mock.calls[0][0].where;
      expect(whereArg.startTime.gte.getHours()).toBe(0);
      expect(whereArg.endTime.lte.getHours()).toBe(23);
      expect(result.events).toHaveLength(1);
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
