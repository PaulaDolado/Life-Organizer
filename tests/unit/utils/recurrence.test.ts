import { expandRecurringEvent, nextOccurrenceStartingIn } from "../../../src/utils/recurrence";

function makeEvent(overrides: Partial<Parameters<typeof expandRecurringEvent>[0]> = {}) {
  return {
    id: 1,
    isRecurring: true,
    recurringPattern: "weekly",
    startTime: new Date("2026-08-03T18:00:00.000Z"), // lunes
    endTime: new Date("2026-08-03T19:00:00.000Z"),
    ...overrides,
  };
}

describe("expandRecurringEvent", () => {
  it("retorna [] si el evento no es recurrente", () => {
    const event = makeEvent({ isRecurring: false });
    const occurrences = expandRecurringEvent(event, new Date("2026-08-01"), new Date("2026-08-31"));
    expect(occurrences).toEqual([]);
  });

  it("retorna [] si isRecurring=true pero recurringPattern es null", () => {
    const event = makeEvent({ recurringPattern: null });
    const occurrences = expandRecurringEvent(event, new Date("2026-08-01"), new Date("2026-08-31"));
    expect(occurrences).toEqual([]);
  });

  it("genera una ocurrencia por día para un patrón daily", () => {
    const event = makeEvent({ recurringPattern: "daily" });
    const occurrences = expandRecurringEvent(event, new Date("2026-08-03T00:00:00.000Z"), new Date("2026-08-07T23:59:59.000Z"));

    expect(occurrences.map((o) => o.startTime.toISOString().slice(0, 10))).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
    ]);
  });

  it("genera una ocurrencia por semana para un patrón weekly", () => {
    const event = makeEvent({ recurringPattern: "weekly" });
    // Rango de 3 semanas a partir del evento original
    const occurrences = expandRecurringEvent(event, new Date("2026-08-03T00:00:00.000Z"), new Date("2026-08-24T23:59:59.000Z"));

    expect(occurrences).toHaveLength(4); // 3, 10, 17, 24 de agosto
    expect(occurrences[0].startTime.toISOString()).toBe("2026-08-03T18:00:00.000Z");
    expect(occurrences[1].startTime.toISOString()).toBe("2026-08-10T18:00:00.000Z");
    expect(occurrences[3].startTime.toISOString()).toBe("2026-08-24T18:00:00.000Z");
  });

  it("preserva la duración original en cada ocurrencia", () => {
    const event = makeEvent({
      startTime: new Date("2026-08-03T18:00:00.000Z"),
      endTime: new Date("2026-08-03T19:30:00.000Z"), // 1.5h
    });
    const occurrences = expandRecurringEvent(event, new Date("2026-08-03T00:00:00.000Z"), new Date("2026-08-10T23:59:59.000Z"));

    occurrences.forEach((o) => {
      expect(o.endTime.getTime() - o.startTime.getTime()).toBe(90 * 60 * 1000);
    });
  });

  it("genera una ocurrencia cada 2 semanas para un patrón biweekly", () => {
    const event = makeEvent({ recurringPattern: "biweekly" });
    const occurrences = expandRecurringEvent(event, new Date("2026-08-01"), new Date("2026-09-01"));

    expect(occurrences.map((o) => o.startTime.toISOString().slice(0, 10))).toEqual(["2026-08-03", "2026-08-17", "2026-08-31"]);
  });

  it("respeta el día del mes para un patrón monthly", () => {
    const event = makeEvent({
      recurringPattern: "monthly",
      startTime: new Date("2026-01-31T10:00:00.000Z"), // día 31, mes con menos días afecta el clamping
      endTime: new Date("2026-01-31T11:00:00.000Z"),
    });
    const occurrences = expandRecurringEvent(event, new Date("2026-01-01"), new Date("2026-04-30"));

    // date-fns clampa al último día del mes cuando el mes no tiene 31 días
    const days = occurrences.map((o) => o.startTime.toISOString().slice(0, 10));
    expect(days).toContain("2026-01-31");
    expect(days).toContain("2026-02-28");
    expect(days).toContain("2026-03-31");
  });

  it("no incluye ocurrencias en un hueco entre dos ocurrencias semanales", () => {
    // El evento cae los lunes (Aug3, Aug10...); este rango cubre martes-domingo, sin ningún lunes.
    const event = makeEvent();
    const occurrences = expandRecurringEvent(event, new Date("2026-08-04T00:00:00.000Z"), new Date("2026-08-09T23:59:59.000Z"));
    expect(occurrences).toEqual([]);
  });

  it("un evento semanal recurre indefinidamente: SÍ aparece en rangos muy posteriores al original", () => {
    const event = makeEvent(); // ancla: lunes 3 de agosto 2026
    const occurrences = expandRecurringEvent(event, new Date("2026-09-01"), new Date("2026-09-30"));
    // No hay fecha de fin de recurrencia en el schema, así que un evento "weekly" sigue
    // generando ocurrencias meses después — el 7 y 14 y 21 y 28 de septiembre son lunes.
    expect(occurrences.map((o) => o.startTime.toISOString().slice(0, 10))).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
  });

  it("marca cada ocurrencia con isRecurringInstance y seriesId", () => {
    const event = makeEvent();
    const [occurrence] = expandRecurringEvent(event, new Date("2026-08-01"), new Date("2026-08-10"));
    expect(occurrence.isRecurringInstance).toBe(true);
    expect(occurrence.seriesId).toBe(event.id);
  });
});

describe("nextOccurrenceStartingIn", () => {
  it("retorna la primera ocurrencia cuyo inicio cae en el rango", () => {
    const event = makeEvent();
    const next = nextOccurrenceStartingIn(event, new Date("2026-08-01"), new Date("2026-08-31"));
    expect(next?.startTime.toISOString().slice(0, 10)).toBe("2026-08-03");
  });

  it("retorna null si no hay ocurrencias en el rango (hueco entre dos lunes)", () => {
    const event = makeEvent();
    const next = nextOccurrenceStartingIn(
      event,
      new Date("2026-08-04T00:00:00.000Z"),
      new Date("2026-08-09T23:59:59.000Z")
    );
    expect(next).toBeNull();
  });

  it("retorna null para un evento no recurrente", () => {
    const event = makeEvent({ isRecurring: false });
    const next = nextOccurrenceStartingIn(event, new Date("2026-08-01"), new Date("2026-08-31"));
    expect(next).toBeNull();
  });

  it("a diferencia de expandRecurringEvent, SÍ encuentra la ocurrencia aunque su duración no quepa en una ventana estrecha", () => {
    // Evento de 1h; ventana de recordatorio de solo 10 minutos alrededor del inicio de la ocurrencia.
    const event = makeEvent({
      startTime: new Date("2026-08-17T10:30:00.000Z"),
      endTime: new Date("2026-08-17T11:30:00.000Z"), // 1h de duración
      recurringPattern: "weekly",
    });
    const windowStart = new Date("2026-08-24T10:25:00.000Z");
    const windowEnd = new Date("2026-08-24T10:35:00.000Z");

    // expandRecurringEvent exige que la ocurrencia COMPLETA quepa en el rango — con un evento
    // de 1h en una ventana de 10 min, nunca calza: confirma que de verdad son semánticas distintas.
    expect(expandRecurringEvent(event, windowStart, windowEnd)).toEqual([]);

    const next = nextOccurrenceStartingIn(event, windowStart, windowEnd);
    expect(next?.startTime.toISOString()).toBe("2026-08-24T10:30:00.000Z");
  });
});

describe("excepciones a ocurrencias recurrentes", () => {
  it("expandRecurringEvent omite una ocurrencia cancelada", () => {
    const event = makeEvent(); // lunes 3, 10, 17, 24 de agosto
    const exceptions = [{ originalStartTime: new Date("2026-08-10T18:00:00.000Z"), status: "cancelled" }];

    const occurrences = expandRecurringEvent(event, new Date("2026-08-03T00:00:00.000Z"), new Date("2026-08-24T23:59:59.000Z"), exceptions);

    expect(occurrences.map((o) => o.startTime.toISOString().slice(0, 10))).toEqual(["2026-08-03", "2026-08-17", "2026-08-24"]);
  });

  it("expandRecurringEvent usa el horario nuevo de una ocurrencia movida", () => {
    const event = makeEvent();
    const exceptions = [
      {
        originalStartTime: new Date("2026-08-10T18:00:00.000Z"),
        status: "moved",
        newStartTime: new Date("2026-08-12T09:00:00.000Z"),
        newEndTime: new Date("2026-08-12T10:00:00.000Z"),
      },
    ];

    const occurrences = expandRecurringEvent(event, new Date("2026-08-03T00:00:00.000Z"), new Date("2026-08-24T23:59:59.000Z"), exceptions);

    const moved = occurrences.find((o) => o.isException);
    expect(moved?.startTime.toISOString()).toBe("2026-08-12T09:00:00.000Z");
    expect(moved?.originalStartTime?.toISOString()).toBe("2026-08-10T18:00:00.000Z");
    expect(moved?.exceptionStatus).toBe("moved");
    expect(occurrences).toHaveLength(4); // sigue habiendo 4: la del 10 no desaparece, solo cambia de horario
  });

  it("una ocurrencia movida fuera del rango pedido no aparece, aunque su horario natural sí cayera dentro", () => {
    const event = makeEvent();
    const exceptions = [
      {
        originalStartTime: new Date("2026-08-10T18:00:00.000Z"),
        status: "moved",
        newStartTime: new Date("2026-09-15T09:00:00.000Z"),
        newEndTime: new Date("2026-09-15T10:00:00.000Z"),
      },
    ];

    const occurrences = expandRecurringEvent(event, new Date("2026-08-03T00:00:00.000Z"), new Date("2026-08-24T23:59:59.000Z"), exceptions);

    expect(occurrences.map((o) => o.startTime.toISOString().slice(0, 10))).toEqual(["2026-08-03", "2026-08-17", "2026-08-24"]);
  });

  it("las ocurrencias sin excepción llevan originalStartTime igual a su propio startTime", () => {
    const event = makeEvent();
    const [occurrence] = expandRecurringEvent(event, new Date("2026-08-01"), new Date("2026-08-10"));
    expect(occurrence.originalStartTime?.toISOString()).toBe(occurrence.startTime.toISOString());
    expect(occurrence.isException).toBeUndefined();
  });

  it("nextOccurrenceStartingIn no encuentra nada si la única ocurrencia de la ventana está cancelada", () => {
    const event = makeEvent();
    const exceptions = [{ originalStartTime: new Date("2026-08-03T18:00:00.000Z"), status: "cancelled" }];

    const next = nextOccurrenceStartingIn(event, new Date("2026-08-01"), new Date("2026-08-09"), exceptions);
    expect(next).toBeNull();
  });

  it("nextOccurrenceStartingIn devuelve el horario nuevo de una ocurrencia movida dentro del rango", () => {
    const event = makeEvent();
    const exceptions = [
      {
        originalStartTime: new Date("2026-08-03T18:00:00.000Z"),
        status: "moved",
        newStartTime: new Date("2026-08-05T12:00:00.000Z"),
        newEndTime: new Date("2026-08-05T13:00:00.000Z"),
      },
    ];

    const next = nextOccurrenceStartingIn(event, new Date("2026-08-01"), new Date("2026-08-09"), exceptions);
    expect(next?.startTime.toISOString()).toBe("2026-08-05T12:00:00.000Z");
    expect(next?.isException).toBe(true);
  });
});

describe("expandRecurringEvent con weekday_range", () => {
  it("genera una ocurrencia de lunes a viernes, saltándose el fin de semana", () => {
    // 2026-08-03 es lunes (ver makeEvent) — rango 1=lunes..5=viernes.
    const event = makeEvent({ recurringPattern: "weekday_range", recurringWeekdayStart: 1, recurringWeekdayEnd: 5 });
    const occurrences = expandRecurringEvent(event, new Date("2026-08-03T00:00:00.000Z"), new Date("2026-08-16T23:59:59.000Z"));

    // Lun 3 a vie 7, y lun 10 a vie 14 — sáb/dom (8,9,15,16) quedan fuera.
    expect(occurrences.map((o) => o.startTime.toISOString().slice(0, 10))).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
    ]);
  });

  it("un rango que da la vuelta a la semana (start > end) también funciona, p.ej. viernes a lunes", () => {
    const event = makeEvent({ recurringPattern: "weekday_range", recurringWeekdayStart: 5, recurringWeekdayEnd: 1 });
    const occurrences = expandRecurringEvent(event, new Date("2026-08-03T00:00:00.000Z"), new Date("2026-08-10T23:59:59.000Z"));

    // Vie 7, sáb 8, dom 9, lun 10 caen dentro (mar-jue quedan fuera); lunes 3 también entra (≤1).
    expect(occurrences.map((o) => o.startTime.toISOString().slice(0, 10))).toEqual([
      "2026-08-03",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
    ]);
  });

  it("sin recurringWeekdayStart/End explícitos, cae de vuelta a lunes-viernes por defecto", () => {
    const event = makeEvent({ recurringPattern: "weekday_range" });
    const occurrences = expandRecurringEvent(event, new Date("2026-08-03T00:00:00.000Z"), new Date("2026-08-09T23:59:59.000Z"));
    expect(occurrences).toHaveLength(5); // lun-vie, sin sáb/dom
  });
});
