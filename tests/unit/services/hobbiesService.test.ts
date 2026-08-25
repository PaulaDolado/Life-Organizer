jest.mock("../../../src/config/database", () => ({
  prisma: {
    hobby: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    hobbySession: { create: jest.fn(), aggregate: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  },
}));

import { prisma } from "../../../src/config/database";
import * as hobbiesService from "../../../src/services/hobbiesService";
import { ForbiddenError } from "../../../src/utils/errorHandler";

const prismaMock = prisma as unknown as {
  hobby: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  hobbySession: { aggregate: jest.Mock; findMany: jest.Mock; count: jest.Mock };
};

describe("hobbiesService", () => {
  const ownedHobby = { id: 1, userId: 1, name: "Lectura", category: "reading" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getHobbyAnalytics", () => {
    it("convierte minutos totales a horas con 2 decimales", async () => {
      prismaMock.hobby.findUnique.mockResolvedValue(ownedHobby);
      prismaMock.hobbySession.aggregate.mockResolvedValue({ _sum: { durationMinutes: 125 } });
      prismaMock.hobbySession.findMany.mockResolvedValue([]);
      prismaMock.hobbySession.count.mockResolvedValue(3);

      const analytics = await hobbiesService.getHobbyAnalytics(1, 1);

      expect(analytics.totalMinutes).toBe(125);
      expect(analytics.totalHours).toBe(2.08);
      expect(analytics.totalSessions).toBe(3);
    });

    it("retorna 0 horas cuando no hay sesiones (_sum null)", async () => {
      prismaMock.hobby.findUnique.mockResolvedValue(ownedHobby);
      prismaMock.hobbySession.aggregate.mockResolvedValue({ _sum: { durationMinutes: null } });
      prismaMock.hobbySession.findMany.mockResolvedValue([]);
      prismaMock.hobbySession.count.mockResolvedValue(0);

      const analytics = await hobbiesService.getHobbyAnalytics(1, 1);

      expect(analytics.totalMinutes).toBe(0);
      expect(analytics.totalHours).toBe(0);
    });

    it("lanza ForbiddenError si el hobby es de otro usuario", async () => {
      prismaMock.hobby.findUnique.mockResolvedValue({ ...ownedHobby, userId: 2 });

      await expect(hobbiesService.getHobbyAnalytics(1, 1)).rejects.toThrow(ForbiddenError);
    });
  });

  describe("listHobbies / listByCategory (paginación)", () => {
    it("listHobbies pagina con skip/take y retorna el total real", async () => {
      prismaMock.hobby.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      prismaMock.hobby.count.mockResolvedValue(9);

      const result = await hobbiesService.listHobbies(1, 2, 3);

      expect(prismaMock.hobby.findMany.mock.calls[0][0]).toMatchObject({ skip: 3, take: 3 });
      expect(result.pagination).toEqual({ page: 2, limit: 3, total: 9, pages: 3 });
    });

    it("listByCategory filtra por categoría además de paginar", async () => {
      prismaMock.hobby.findMany.mockResolvedValue([]);
      prismaMock.hobby.count.mockResolvedValue(0);

      await hobbiesService.listByCategory(1, "music", 1, 20);

      expect(prismaMock.hobby.findMany.mock.calls[0][0].where).toEqual({ userId: 1, category: "music" });
    });
  });
});
