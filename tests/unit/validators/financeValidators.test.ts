import {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsQuerySchema,
  createSavingsGoalSchema,
  contributeSchema,
} from "../../../src/validators/financeValidators";

describe("financeValidators", () => {
  describe("createTransactionSchema", () => {
    it("acepta una transacción válida", () => {
      const { error } = createTransactionSchema.validate({
        type: "expense",
        amount: 49.99,
        category: "food",
      });
      expect(error).toBeUndefined();
    });

    it("rechaza un monto negativo", () => {
      const { error } = createTransactionSchema.validate({
        type: "expense",
        amount: -10,
        category: "food",
      });
      expect(error).toBeDefined();
    });

    it("rechaza un monto de 0", () => {
      const { error } = createTransactionSchema.validate({
        type: "income",
        amount: 0,
        category: "salary",
      });
      expect(error).toBeDefined();
    });

    it("rechaza un type no soportado", () => {
      const { error } = createTransactionSchema.validate({
        type: "transferencia",
        amount: 10,
        category: "food",
      });
      expect(error).toBeDefined();
    });

    it("acepta cualquier categoría de texto libre (no hay enum cerrado)", () => {
      const { error } = createTransactionSchema.validate({
        type: "income",
        amount: 100,
        category: "categoria-personalizada-cualquiera",
      });
      expect(error).toBeUndefined();
    });
  });

  describe("updateTransactionSchema", () => {
    it("rechaza un objeto vacío", () => {
      const { error } = updateTransactionSchema.validate({});
      expect(error).toBeDefined();
    });
  });

  describe("listTransactionsQuerySchema", () => {
    it("aplica page=1 y limit=20 por defecto", () => {
      const { value } = listTransactionsQuerySchema.validate({});
      expect(value.page).toBe(1);
      expect(value.limit).toBe(20);
    });

    it("rechaza un limit mayor a 100", () => {
      const { error } = listTransactionsQuerySchema.validate({ limit: 500 });
      expect(error).toBeDefined();
    });
  });

  describe("createSavingsGoalSchema", () => {
    it("acepta una meta de ahorro válida", () => {
      const { error } = createSavingsGoalSchema.validate({
        name: "Vacaciones",
        targetAmount: 500,
        category: "savings-vacation",
      });
      expect(error).toBeUndefined();
    });

    it("rechaza targetAmount no positivo", () => {
      const { error } = createSavingsGoalSchema.validate({
        name: "Vacaciones",
        targetAmount: 0,
        category: "savings-vacation",
      });
      expect(error).toBeDefined();
    });

    it("aplica stepAmount=100 por defecto", () => {
      const { value } = createSavingsGoalSchema.validate({
        name: "Vacaciones",
        targetAmount: 500,
        category: "savings-vacation",
      });
      expect(value.stepAmount).toBe(100);
    });

    it("acepta un stepAmount custom", () => {
      const { value, error } = createSavingsGoalSchema.validate({
        name: "Vacaciones",
        targetAmount: 500,
        category: "savings-vacation",
        stepAmount: 50,
      });
      expect(error).toBeUndefined();
      expect(value.stepAmount).toBe(50);
    });
  });

  describe("contributeSchema", () => {
    it("acepta un amount positivo (aportar)", () => {
      expect(contributeSchema.validate({ amount: 100 }).error).toBeUndefined();
    });

    it("acepta un amount negativo (retirar/corregir)", () => {
      expect(contributeSchema.validate({ amount: -50 }).error).toBeUndefined();
    });

    it("rechaza amount=0", () => {
      expect(contributeSchema.validate({ amount: 0 }).error).toBeDefined();
    });

    it("requiere el campo amount", () => {
      expect(contributeSchema.validate({}).error).toBeDefined();
    });
  });
});
