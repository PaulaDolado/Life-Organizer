import { createHobbySchema, createSessionSchema } from "../../../src/validators/hobbiesValidators";

describe("hobbiesValidators", () => {
  describe("createHobbySchema", () => {
    it("acepta un hobby válido", () => {
      const { error } = createHobbySchema.validate({ name: "Guitarra", category: "music" });
      expect(error).toBeUndefined();
    });

    it("rechaza una categoría no soportada", () => {
      const { error } = createHobbySchema.validate({ name: "Guitarra", category: "no-existe" });
      expect(error).toBeDefined();
    });

    it("requiere el nombre", () => {
      const { error } = createHobbySchema.validate({ category: "music" });
      expect(error).toBeDefined();
    });
  });

  describe("createSessionSchema", () => {
    it("acepta una sesión válida", () => {
      const { error } = createSessionSchema.validate({ durationMinutes: 30 });
      expect(error).toBeUndefined();
    });

    it("rechaza duración no positiva", () => {
      expect(createSessionSchema.validate({ durationMinutes: 0 }).error).toBeDefined();
      expect(createSessionSchema.validate({ durationMinutes: -10 }).error).toBeDefined();
    });

    it("rechaza duración no entera", () => {
      const { error } = createSessionSchema.validate({ durationMinutes: 30.5 });
      expect(error).toBeDefined();
    });
  });
});
