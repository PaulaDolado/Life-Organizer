jest.mock("../../../src/config/database", () => ({
  prisma: {
    hobby: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    hobbySession: { create: jest.fn(), aggregate: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  },
}));

import { prisma } from "../../../src/config/database";
import * as hobbiesService from "../../../src/services/hobbiesService";
import { ForbiddenError } from "../../../src/utils/errorHandler";

const prismaMock = prisma as unknown as {
  hobby: { findUnique: jest.Mock };
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
});
