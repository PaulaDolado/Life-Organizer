import { parseDateParam, dayRange, weekRange } from "../../../src/utils/dateHelpers";

describe("dateHelpers", () => {
  describe("parseDateParam", () => {
    it("no lanza con una fecha YYYY-MM-DD válida", () => {
      expect(() => parseDateParam("2026-08-24")).not.toThrow();
    });

    it("lanza con una fecha inválida", () => {
      expect(() => parseDateParam("no-es-una-fecha")).toThrow();
    });

    it("lanza con una fecha de calendario imposible", () => {
      expect(() => parseDateParam("2026-02-30")).toThrow();
    });
  });

  describe("dayRange", () => {
    it("calcula el mismo instante en UTC (sin desfase)", () => {
      const { start, end } = dayRange("2026-08-24", "UTC");
      expect(start.toISOString()).toBe("2026-08-24T00:00:00.000Z");
      expect(end.toISOString()).toBe("2026-08-24T23:59:59.999Z");
    });

    it("aplica el offset de verano de Europe/Madrid (UTC+2 en agosto)", () => {
      const { start, end } = dayRange("2026-08-24", "Europe/Madrid");
      // Medianoche en Madrid en verano = 22:00 UTC del día anterior.
      expect(start.toISOString()).toBe("2026-08-23T22:00:00.000Z");
      expect(end.toISOString()).toBe("2026-08-24T21:59:59.999Z");
    });

    it("da límites distintos para el mismo dateStr según la timezone (el bug que se corrigió)", () => {
      const utc = dayRange("2026-08-24", "UTC");
      const madrid = dayRange("2026-08-24", "Europe/Madrid");
      expect(utc.start.getTime()).not.toBe(madrid.start.getTime());
    });
  });

  describe("weekRange", () => {
    it("2026-08-24 es lunes: la semana empieza ese mismo día", () => {
      const { start } = weekRange("2026-08-24", "UTC");
      expect(start.toISOString().slice(0, 10)).toBe("2026-08-24");
    });

    it("termina en domingo, 6 días después", () => {
      const { end } = weekRange("2026-08-24", "UTC");
      expect(end.toISOString().slice(0, 10)).toBe("2026-08-30");
    });

    it("una fecha a mitad de semana retrocede hasta el lunes de esa semana", () => {
      const { start, end } = weekRange("2026-08-27", "UTC"); // jueves
      expect(start.toISOString().slice(0, 10)).toBe("2026-08-24");
      expect(end.toISOString().slice(0, 10)).toBe("2026-08-30");
    });

    it("un domingo pertenece a la semana que empezó el lunes anterior", () => {
      const { start, end } = weekRange("2026-08-30", "UTC"); // domingo
      expect(start.toISOString().slice(0, 10)).toBe("2026-08-24");
      expect(end.toISOString().slice(0, 10)).toBe("2026-08-30");
    });

    it("aplica timezone también en los límites de la semana", () => {
      const { start } = weekRange("2026-08-24", "Europe/Madrid");
      expect(start.toISOString()).toBe("2026-08-23T22:00:00.000Z");
    });
  });
});
