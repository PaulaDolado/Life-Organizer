jest.mock("../../../src/config/database", () => ({
  prisma: {
    user: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  },
}));

import { prisma } from "../../../src/config/database";
import * as authService from "../../../src/services/authService";
import { ConflictError, UnauthorizedError } from "../../../src/utils/errorHandler";

const prismaMock = prisma as unknown as {
  user: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
};

describe("authService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("guarda el timezone indicado si se pasa uno", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 1, ...data })
      );

      await authService.register({
        email: "test@example.com",
        password: "Password123",
        name: "Test",
        timezone: "America/New_York",
      });

      expect(prismaMock.user.create.mock.calls[0][0].data.timezone).toBe("America/New_York");
    });

    it("no pasa timezone a Prisma si no se indica (Prisma aplica su @default)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 1, timezone: "Europe/Madrid", ...data })
      );

      await authService.register({ email: "test@example.com", password: "Password123", name: "Test" });

      expect(prismaMock.user.create.mock.calls[0][0].data.timezone).toBeUndefined();
    });

    it("lanza ConflictError si el email ya existe", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 1 });

      await expect(
        authService.register({ email: "test@example.com", password: "Password123", name: "Test" })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("getProfile / updateProfile", () => {
    it("getProfile lanza UnauthorizedError si el usuario ya no existe", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(authService.getProfile(999)).rejects.toThrow(UnauthorizedError);
    });

    it("getProfile retorna el perfil sin el hash de password", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        email: "test@example.com",
        name: "Test",
        timezone: "UTC",
        password: "hash-secreto",
      });

      const profile = await authService.getProfile(1);

      expect(profile).toEqual({ id: 1, email: "test@example.com", name: "Test", timezone: "UTC" });
      expect(profile).not.toHaveProperty("password");
    });

    it("updateProfile solo actualiza los campos indicados", async () => {
      prismaMock.user.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 1, email: "test@example.com", name: "Nuevo", timezone: "Asia/Tokyo", ...data })
      );

      await authService.updateProfile(1, { timezone: "Asia/Tokyo" });

      expect(prismaMock.user.update.mock.calls[0][0].data).toEqual({ timezone: "Asia/Tokyo" });
    });
  });
});
