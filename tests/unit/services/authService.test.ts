jest.mock("../../../src/config/database", () => ({
  prisma: {
    user: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  },
}));

import { prisma } from "../../../src/config/database";
import * as authService from "../../../src/services/authService";
import { hashPassword } from "../../../src/utils/password";
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

    it("updateProfile acepta lastName libre", async () => {
      prismaMock.user.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 1, email: "test@example.com", name: "Test", timezone: "UTC", ...data })
      );

      const profile = await authService.updateProfile(1, { lastName: "Dolado" });

      expect(prismaMock.user.update.mock.calls[0][0].data).toEqual({ lastName: "Dolado" });
      expect(profile.lastName).toBe("Dolado");
    });

    it("updateProfile permite borrar lastName mandando null", async () => {
      prismaMock.user.update.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }));

      await authService.updateProfile(1, { lastName: null });

      expect(prismaMock.user.update.mock.calls[0][0].data).toEqual({ lastName: null });
    });

    it("updateProfile acepta un email libre", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null); // email libre
      prismaMock.user.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 1, name: "Test", timezone: "UTC", ...data })
      );

      const profile = await authService.updateProfile(1, { email: "nuevo@example.com" });

      expect(prismaMock.user.update.mock.calls[0][0].data).toEqual({ email: "nuevo@example.com" });
      expect(profile.email).toBe("nuevo@example.com");
    });

    it("updateProfile lanza ConflictError si el email ya lo tiene OTRO usuario", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 999, email: "ocupado@example.com" });

      await expect(authService.updateProfile(1, { email: "ocupado@example.com" })).rejects.toThrow(ConflictError);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("updateProfile permite guardar el mismo email que ya tenía el propio usuario", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 1, email: "mio@example.com" }); // es él mismo
      prismaMock.user.update.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }));

      await expect(authService.updateProfile(1, { email: "mio@example.com" })).resolves.toBeDefined();
      expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    });
  });

  describe("changePassword", () => {
    it("lanza UnauthorizedError si el usuario ya no existe", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(authService.changePassword(999, "actual", "nuevaPassword123")).rejects.toThrow(UnauthorizedError);
    });

    it("lanza UnauthorizedError si la contraseña actual no coincide, sin tocar la BD", async () => {
      const storedHash = await hashPassword("LaDeVerdad123");
      prismaMock.user.findUnique.mockResolvedValue({ id: 1, password: storedHash });

      await expect(authService.changePassword(1, "OtraCosa", "nuevaPassword123")).rejects.toThrow(UnauthorizedError);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("con la contraseña actual correcta, guarda un hash nuevo (no la nueva contraseña en claro)", async () => {
      const storedHash = await hashPassword("LaDeVerdad123");
      prismaMock.user.findUnique.mockResolvedValue({ id: 1, password: storedHash });
      prismaMock.user.update.mockResolvedValue({ id: 1 });

      await authService.changePassword(1, "LaDeVerdad123", "nuevaPassword123");

      expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
      const { where, data } = prismaMock.user.update.mock.calls[0][0];
      expect(where).toEqual({ id: 1 });
      expect(data.password).not.toBe("nuevaPassword123");
      expect(data.password).not.toBe(storedHash);
    });
  });
});
