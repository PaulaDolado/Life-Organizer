import {
  idParamSchema,
  rowParamsSchema,
  createScheduleSchema,
  updateScheduleSchema,
  addRowSchema,
  updateRowSchema,
  moveSchema,
} from "../../../src/validators/scheduleValidators";

describe("scheduleValidators", () => {
  describe("idParamSchema", () => {
    it("acepta un id numérico positivo", () => {
      expect(idParamSchema.validate({ id: 5 }).error).toBeUndefined();
    });

    it("rechaza un id no numérico", () => {
      expect(idParamSchema.validate({ id: "abc" }).error).toBeDefined();
    });
  });

  describe("rowParamsSchema", () => {
    it("acepta id y rowId numéricos positivos", () => {
      expect(rowParamsSchema.validate({ id: 1, rowId: 2 }).error).toBeUndefined();
    });

    it("rechaza si falta rowId", () => {
      expect(rowParamsSchema.validate({ id: 1 }).error).toBeDefined();
    });
  });

  describe("createScheduleSchema / updateScheduleSchema", () => {
    it("acepta un nombre no vacío", () => {
      expect(createScheduleSchema.validate({ name: "1r trimestre" }).error).toBeUndefined();
      expect(updateScheduleSchema.validate({ name: "1r trimestre" }).error).toBeUndefined();
    });

    it("rechaza un nombre vacío", () => {
      expect(createScheduleSchema.validate({ name: "" }).error).toBeDefined();
    });

    it("rechaza si falta el nombre", () => {
      expect(createScheduleSchema.validate({}).error).toBeDefined();
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

    it("acepta una celda multilínea (Enter en el texto del horario)", () => {
      expect(updateRowSchema.validate({ monday: "Cálculo I\nAula 204" }).error).toBeUndefined();
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
      expect(updateRowSchema.validate({ tuesday: "x".repeat(501) }).error).toBeDefined();
    });
  });

  describe("moveSchema", () => {
    it("acepta direction 'up' o 'down'", () => {
      expect(moveSchema.validate({ direction: "up" }).error).toBeUndefined();
      expect(moveSchema.validate({ direction: "down" }).error).toBeUndefined();
    });

    it("rechaza una direction inválida", () => {
      expect(moveSchema.validate({ direction: "sideways" }).error).toBeDefined();
    });

    it("rechaza si falta direction", () => {
      expect(moveSchema.validate({}).error).toBeDefined();
    });
  });
});
