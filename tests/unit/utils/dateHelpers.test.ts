import { parseDateParam, dayRange, weekRange } from "../../../src/utils/dateHelpers";

describe("dateHelpers", () => {
  describe("parseDateParam", () => {
    it("debería parsear una fecha YYYY-MM-DD válida", () => {
      const date = parseDateParam("2026-08-24");
      expect(date.getFullYear()).toBe(2026);
    });

    it("debería lanzar con una fecha inválida", () => {
      expect(() => parseDateParam("no-es-una-fecha")).toThrow();
    });
  });

  describe("dayRange", () => {
    it("debería retornar el inicio y fin del mismo día", () => {
      const { start, end } = dayRange(new Date("2026-08-24T15:30:00.000Z"));
      expect(start.getDate()).toBe(end.getDate());
      expect(start.getHours()).toBe(0);
      expect(end.getHours()).toBe(23);
    });
  });

  describe("weekRange", () => {
    it("debería empezar la semana en lunes", () => {
      // 2026-08-24 es lunes
      const { start } = weekRange(new Date("2026-08-26T00:00:00"));
      expect(start.getDay()).toBe(1); // 1 = lunes
    });

    it("debería terminar la semana en domingo", () => {
      const { end } = weekRange(new Date("2026-08-26T00:00:00"));
      expect(end.getDay()).toBe(0); // 0 = domingo
    });
  });
});
