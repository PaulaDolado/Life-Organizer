import { registerSchema, loginSchema, refreshSchema } from "../../../src/validators/authValidators";

describe("authValidators", () => {
  describe("registerSchema", () => {
    it("acepta un registro válido", () => {
      const { error } = registerSchema.validate({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });
      expect(error).toBeUndefined();
    });

    it("rechaza un email inválido", () => {
      const { error } = registerSchema.validate({
        email: "no-es-un-email",
        password: "Password123",
        name: "Test User",
      });
      expect(error).toBeDefined();
    });

    it("rechaza un password menor a 8 caracteres", () => {
      const { error } = registerSchema.validate({
        email: "test@example.com",
        password: "short",
        name: "Test User",
      });
      expect(error).toBeDefined();
    });

    it("rechaza si falta el nombre", () => {
      const { error } = registerSchema.validate({
        email: "test@example.com",
        password: "Password123",
      });
      expect(error).toBeDefined();
    });
  });

  describe("loginSchema", () => {
    it("acepta credenciales válidas", () => {
      const { error } = loginSchema.validate({ email: "test@example.com", password: "cualquiera" });
      expect(error).toBeUndefined();
    });

    it("rechaza si falta el password", () => {
      const { error } = loginSchema.validate({ email: "test@example.com" });
      expect(error).toBeDefined();
    });
  });

  describe("refreshSchema", () => {
    it("rechaza si falta refreshToken", () => {
      const { error } = refreshSchema.validate({});
      expect(error).toBeDefined();
    });

    it("acepta un refreshToken presente", () => {
      const { error } = refreshSchema.validate({ refreshToken: "algun-token" });
      expect(error).toBeUndefined();
    });
  });
});
