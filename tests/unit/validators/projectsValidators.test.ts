import { createProjectSchema, updateProjectSchema, createTaskSchema } from "../../../src/validators/projectsValidators";

describe("projectsValidators", () => {
  describe("createProjectSchema", () => {
    it("aplica status=idea y priority=medium por defecto", () => {
      const { value, error } = createProjectSchema.validate({ title: "Mi proyecto" });
      expect(error).toBeUndefined();
      expect(value.status).toBe("idea");
      expect(value.priority).toBe("medium");
    });

    it("rechaza un status no soportado", () => {
      const { error } = createProjectSchema.validate({ title: "Mi proyecto", status: "cancelado" });
      expect(error).toBeDefined();
    });

    it("rechaza una priority no soportada", () => {
      const { error } = createProjectSchema.validate({ title: "Mi proyecto", priority: "urgente" });
      expect(error).toBeDefined();
    });

    it("requiere el título", () => {
      const { error } = createProjectSchema.validate({});
      expect(error).toBeDefined();
    });
  });

  describe("updateProjectSchema", () => {
    it("rechaza un objeto vacío", () => {
      const { error } = updateProjectSchema.validate({});
      expect(error).toBeDefined();
    });

    it("acepta actualizar solo el status", () => {
      const { error } = updateProjectSchema.validate({ status: "en_curso" });
      expect(error).toBeUndefined();
    });
  });

  describe("createTaskSchema", () => {
    it("requiere un título no vacío", () => {
      expect(createTaskSchema.validate({ title: "" }).error).toBeDefined();
      expect(createTaskSchema.validate({}).error).toBeDefined();
      expect(createTaskSchema.validate({ title: "Setup inicial" }).error).toBeUndefined();
    });
  });
});
