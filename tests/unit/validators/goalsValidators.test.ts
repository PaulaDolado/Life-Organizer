import { createGoalSchema, updateGoalSchema, registerProgressSchema } from "../../../src/validators/goalsValidators";

describe("goalsValidators", () => {
  describe("createGoalSchema", () => {
    it("acepta una meta válida sin periodStart/periodEnd (se calculan después)", () => {
      const { error } = createGoalSchema.validate({
        title: "Ejercicio",
        period: "weekly",
        targetValue: 5,
      });
      expect(error).toBeUndefined();
    });

    it("aplica bonusPoints=10 por defecto", () => {
      const { value } = createGoalSchema.validate({
        title: "Ejercicio",
        period: "weekly",
        targetValue: 5,
      });
      expect(value.bonusPoints).toBe(10);
    });

    it("rechaza un period no soportado", () => {
      const { error } = createGoalSchema.validate({
        title: "Ejercicio",
        period: "daily",
        targetValue: 5,
      });
      expect(error).toBeDefined();
    });

    it("rechaza targetValue no positivo", () => {
      const { error } = createGoalSchema.validate({
        title: "Ejercicio",
        period: "weekly",
        targetValue: 0,
      });
      expect(error).toBeDefined();
    });

    it("rechaza periodEnd anterior o igual a periodStart", () => {
      const { error } = createGoalSchema.validate({
        title: "Ejercicio",
        period: "weekly",
        targetValue: 5,
        periodStart: "2026-08-24",
        periodEnd: "2026-08-20",
      });
      expect(error).toBeDefined();
    });
  });

  describe("updateGoalSchema", () => {
    it("rechaza un objeto vacío", () => {
      const { error } = updateGoalSchema.validate({});
      expect(error).toBeDefined();
    });

    it("no permite cambiar el period (no está en el schema)", () => {
      const { value } = updateGoalSchema.validate(
        { title: "Nuevo título", period: "monthly" },
        { stripUnknown: true }
      );
      expect(value.period).toBeUndefined();
    });
  });

  describe("registerProgressSchema", () => {
    it("acepta un valor entero (positivo o negativo, para correcciones)", () => {
      expect(registerProgressSchema.validate({ value: 1 }).error).toBeUndefined();
      expect(registerProgressSchema.validate({ value: -1 }).error).toBeUndefined();
    });

    it("rechaza un valor no entero", () => {
      const { error } = registerProgressSchema.validate({ value: 1.5 });
      expect(error).toBeDefined();
    });

    it("requiere el campo value", () => {
      const { error } = registerProgressSchema.validate({ note: "sin value" });
      expect(error).toBeDefined();
    });
  });
});
