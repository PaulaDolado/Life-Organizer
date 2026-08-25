import { isValidTimezone, safeTimezone, DEFAULT_TIMEZONE } from "../../../src/utils/timezone";

describe("timezone utils", () => {
  describe("isValidTimezone", () => {
    it("acepta zonas IANA reales", () => {
      expect(isValidTimezone("Europe/Madrid")).toBe(true);
      expect(isValidTimezone("America/New_York")).toBe(true);
      expect(isValidTimezone("UTC")).toBe(true);
    });

    it("rechaza strings que no son zonas IANA", () => {
      expect(isValidTimezone("no-es-una-timezone")).toBe(false);
      expect(isValidTimezone("Europe/CiudadInventada")).toBe(false);
      expect(isValidTimezone("")).toBe(false);
    });
  });

  describe("safeTimezone", () => {
    it("retorna la timezone si es válida", () => {
      expect(safeTimezone("America/New_York")).toBe("America/New_York");
    });

    it("cae al default si es inválida", () => {
      expect(safeTimezone("inventada")).toBe(DEFAULT_TIMEZONE);
    });

    it("cae al default si es null/undefined", () => {
      expect(safeTimezone(null)).toBe(DEFAULT_TIMEZONE);
      expect(safeTimezone(undefined)).toBe(DEFAULT_TIMEZONE);
    });
  });
});
