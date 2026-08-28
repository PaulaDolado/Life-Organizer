import { idParamSchema, addRowSchema, updateRowSchema, moveRowSchema } from "../../../src/validators/scheduleValidators";

describe("scheduleValidators", () => {
  describe("idParamSchema", () => {
    it("acepta un id numérico positivo", () => {
      expect(idParamSchema.validate({ id: 5 }).error).toBeUndefined();
    });

    it("rechaza un id no numérico", () => {
      expect(idParamSchema.validate({ id: "abc" }).error).toBeDefined();
    });
  });

  describe("addRowSchema", () => {
    it("acepta un objeto vacío (timeLabel es opcional)", () => {
      expect(addRowSchema.validate({}).error).toBeUndefined();
    });

    it("acepta un timeLabel de texto libre", () => {
      expect(addRowSchema.validate({ timeLabel: "08:00 - 10:00" }).error).toBeUndefined();
    });

    it("rechaza un timeLabel demasiado largo", () => {
      expect(addRowSchema.validate({ timeLabel: "x".repeat(51) }).error).toBeDefined();
    });
  });

  describe("updateRowSchema", () => {
    it("rechaza un objeto vacío (min 1 campo)", () => {
      expect(updateRowSchema.validate({}).error).toBeDefined();
    });

    it("acepta actualizar solo una celda", () => {
      expect(updateRowSchema.validate({ monday: "Cálculo I" }).error).toBeUndefined();
    });

    it("acepta vaciar una celda con string vacío", () => {
      expect(updateRowSchema.validate({ friday: "" }).error).toBeUndefined();
    });

    it("acepta actualizar varias celdas y el timeLabel a la vez", () => {
      const { error } = updateRowSchema.validate({
        timeLabel: "10:00 - 12:00",
        monday: "Cálculo I",
        wednesday: "Cálculo I",
        friday: "Laboratorio",
      });
      expect(error).toBeUndefined();
    });

    it("rechaza el texto de una celda demasiado largo", () => {
      expect(updateRowSchema.validate({ tuesday: "x".repeat(201) }).error).toBeDefined();
    });
  });

  describe("moveRowSchema", () => {
    it("acepta direction 'up' o 'down'", () => {
      expect(moveRowSchema.validate({ direction: "up" }).error).toBeUndefined();
      expect(moveRowSchema.validate({ direction: "down" }).error).toBeUndefined();
    });

    it("rechaza una direction inválida", () => {
      expect(moveRowSchema.validate({ direction: "sideways" }).error).toBeDefined();
    });

    it("rechaza si falta direction", () => {
      expect(moveRowSchema.validate({}).error).toBeDefined();
    });
  });
});
