import {
  dateParamSchema,
  createEventSchema,
  updateEventSchema,
} from "../../../src/validators/agendaValidators";

describe("agendaValidators", () => {
  describe("dateParamSchema", () => {
    it("acepta una fecha YYYY-MM-DD", () => {
      const { error } = dateParamSchema.validate({ date: "2026-08-24" });
      expect(error).toBeUndefined();
    });

    it("rechaza una fecha con formato incorrecto", () => {
      const { error } = dateParamSchema.validate({ date: "24/08/2026" });
      expect(error).toBeDefined();
    });
  });

  describe("createEventSchema", () => {
    const base = {
      title: "Gimnasio",
      type: "gym",
      startTime: "2026-08-24T18:00:00.000Z",
      endTime: "2026-08-24T19:00:00.000Z",
    };

    it("acepta un evento válido", () => {
      const { error } = createEventSchema.validate(base);
      expect(error).toBeUndefined();
    });

    it("rechaza un tipo de evento no soportado", () => {
      const { error } = createEventSchema.validate({ ...base, type: "inventado" });
      expect(error).toBeDefined();
    });

    it("rechaza endTime anterior o igual a startTime", () => {
      const { error } = createEventSchema.validate({
        ...base,
        endTime: "2026-08-24T18:00:00.000Z",
      });
      expect(error).toBeDefined();
    });

    it("requiere recurringPattern cuando isRecurring es true", () => {
      const { error } = createEventSchema.validate({ ...base, isRecurring: true });
      expect(error).toBeDefined();
    });

    it("acepta isRecurring true con un recurringPattern válido", () => {
      const { error } = createEventSchema.validate({
        ...base,
        isRecurring: true,
        recurringPattern: "weekly",
      });
      expect(error).toBeUndefined();
    });
  });

  describe("updateEventSchema", () => {
    it("rechaza un objeto vacío (min 1 campo)", () => {
      const { error } = updateEventSchema.validate({});
      expect(error).toBeDefined();
    });

    it("rechaza endTime anterior a startTime cuando ambos se editan", () => {
      const { error } = updateEventSchema.validate({
        startTime: "2026-08-24T18:00:00.000Z",
        endTime: "2026-08-24T17:00:00.000Z",
      });
      expect(error).toBeDefined();
    });

    it("acepta editar solo el título", () => {
      const { error } = updateEventSchema.validate({ title: "Nuevo título" });
      expect(error).toBeUndefined();
    });
  });
});
