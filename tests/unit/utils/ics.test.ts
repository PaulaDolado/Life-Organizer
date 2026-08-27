import { buildIcs, parseIcs } from "../../../src/utils/ics";

describe("buildIcs", () => {
  it("genera un VEVENT con los campos básicos", () => {
    const ics = buildIcs([
      {
        id: 1,
        title: "Dentista",
        description: "Revisión anual",
        location: "Clínica",
        startTime: new Date("2026-08-24T16:00:00.000Z"),
        endTime: new Date("2026-08-24T17:00:00.000Z"),
        isRecurring: false,
      },
    ]);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:event-1@life-organizer.local");
    expect(ics).toContain("DTSTART:20260824T160000Z");
    expect(ics).toContain("DTEND:20260824T170000Z");
    expect(ics).toContain("SUMMARY:Dentista");
    expect(ics).toContain("DESCRIPTION:Revisión anual");
    expect(ics).toContain("LOCATION:Clínica");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("escapa comas, puntos y coma y saltos de línea en texto", () => {
    const ics = buildIcs([
      {
        id: 2,
        title: "Reunión: A, B; C",
        description: "línea1\nlínea2",
        startTime: new Date("2026-08-24T16:00:00.000Z"),
        endTime: new Date("2026-08-24T17:00:00.000Z"),
        isRecurring: false,
      },
    ]);

    expect(ics).toContain("SUMMARY:Reunión: A\\, B\\; C");
    expect(ics).toContain("DESCRIPTION:línea1\\nlínea2");
  });

  it("mapea el patrón de recurrencia a RRULE", () => {
    const weekly = buildIcs([
      { id: 1, title: "A", startTime: new Date(), endTime: new Date(Date.now() + 3600000), isRecurring: true, recurringPattern: "weekly" },
    ]);
    const biweekly = buildIcs([
      { id: 1, title: "A", startTime: new Date(), endTime: new Date(Date.now() + 3600000), isRecurring: true, recurringPattern: "biweekly" },
    ]);
    const monthly = buildIcs([
      { id: 1, title: "A", startTime: new Date(), endTime: new Date(Date.now() + 3600000), isRecurring: true, recurringPattern: "monthly" },
    ]);

    expect(weekly).toContain("RRULE:FREQ=WEEKLY");
    expect(biweekly).toContain("RRULE:FREQ=WEEKLY;INTERVAL=2");
    expect(monthly).toContain("RRULE:FREQ=MONTHLY");
  });

  it("añade EXDATE para ocurrencias canceladas y un VEVENT con RECURRENCE-ID para las movidas", () => {
    const ics = buildIcs([
      {
        id: 5,
        title: "Yoga",
        startTime: new Date("2026-08-03T18:00:00.000Z"),
        endTime: new Date("2026-08-03T19:00:00.000Z"),
        isRecurring: true,
        recurringPattern: "weekly",
        exceptions: [
          { originalStartTime: new Date("2026-08-10T18:00:00.000Z"), status: "cancelled" },
          {
            originalStartTime: new Date("2026-08-17T18:00:00.000Z"),
            status: "moved",
            newStartTime: new Date("2026-08-19T09:00:00.000Z"),
            newEndTime: new Date("2026-08-19T10:00:00.000Z"),
          },
        ],
      },
    ]);

    expect(ics).toContain("EXDATE:20260810T180000Z");
    expect(ics).toContain("RECURRENCE-ID:20260817T180000Z");
    expect(ics).toContain("DTSTART:20260819T090000Z");
    // dos VEVENT: la serie base + la ocurrencia movida
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it("pliega líneas largas (DESCRIPTION extensa) a 75 caracteres con continuación indentada", () => {
    const longText = "x".repeat(200);
    const ics = buildIcs([
      { id: 1, title: "A", description: longText, startTime: new Date(), endTime: new Date(Date.now() + 3600000), isRecurring: false },
    ]);
    const lines = ics.split("\r\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    // la línea de continuación empieza con un espacio (regla de "unfolding")
    expect(lines.some((l) => l.startsWith(" xxxx"))).toBe(true);
  });
});

describe("parseIcs", () => {
  const MADRID = "Europe/Madrid";

  it("parsea un VEVENT simple con fecha UTC", () => {
    const raw = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "SUMMARY:Dentista", "DTSTART:20260824T160000Z", "DTEND:20260824T170000Z", "END:VEVENT", "END:VCALENDAR"].join(
      "\r\n"
    );

    const { events, skipped } = parseIcs(raw, MADRID);

    expect(skipped).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Dentista");
    expect(events[0].startTime.toISOString()).toBe("2026-08-24T16:00:00.000Z");
    expect(events[0].isRecurring).toBe(false);
  });

  it("interpreta una fecha sin zona horaria como hora local en la timezone indicada", () => {
    const raw = ["BEGIN:VEVENT", "SUMMARY:Café", "DTSTART:20260824T180000", "DTEND:20260824T190000", "END:VEVENT"].join("\r\n");

    const { events } = parseIcs(raw, MADRID);

    // 18:00 en Madrid (verano, UTC+2) = 16:00 UTC
    expect(events[0].startTime.toISOString()).toBe("2026-08-24T16:00:00.000Z");
  });

  it("desdobla líneas plegadas (continuación con espacio inicial)", () => {
    const raw = ["BEGIN:VEVENT", "SUMMARY:Uno\r\n dos\r\n tres", "DTSTART:20260824T160000Z", "END:VEVENT"].join("\r\n");

    const { events } = parseIcs(raw, MADRID);

    expect(events[0].title).toBe("Unodostres");
  });

  it("desescapa comas, puntos y coma y saltos de línea", () => {
    const raw = ["BEGIN:VEVENT", "SUMMARY:A\\, B\\; C", "DESCRIPTION:línea1\\nlínea2", "DTSTART:20260824T160000Z", "END:VEVENT"].join("\r\n");

    const { events } = parseIcs(raw, MADRID);

    expect(events[0].title).toBe("A, B; C");
    expect(events[0].description).toBe("línea1\nlínea2");
  });

  it("mapea RRULE FREQ=WEEKLY/INTERVAL=2 a biweekly", () => {
    const raw = ["BEGIN:VEVENT", "SUMMARY:Quincenal", "DTSTART:20260824T160000Z", "RRULE:FREQ=WEEKLY;INTERVAL=2", "END:VEVENT"].join("\r\n");

    const { events } = parseIcs(raw, MADRID);

    expect(events[0].isRecurring).toBe(true);
    expect(events[0].recurringPattern).toBe("biweekly");
    expect(events[0].unsupportedRecurrence).toBe(false);
  });

  it("marca unsupportedRecurrence en un RRULE que no mapea a nuestros patrones (p.ej. DAILY)", () => {
    const raw = ["BEGIN:VEVENT", "SUMMARY:Diario", "DTSTART:20260824T160000Z", "RRULE:FREQ=DAILY", "END:VEVENT"].join("\r\n");

    const { events } = parseIcs(raw, MADRID);

    expect(events[0].isRecurring).toBe(false);
    expect(events[0].unsupportedRecurrence).toBe(true);
  });

  it("ignora un VEVENT con RECURRENCE-ID (excepción de otra serie, evita duplicados)", () => {
    const raw = ["BEGIN:VEVENT", "SUMMARY:Excepción", "DTSTART:20260824T160000Z", "RECURRENCE-ID:20260817T160000Z", "END:VEVENT"].join("\r\n");

    const { events, skipped } = parseIcs(raw, MADRID);

    expect(events).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("cuenta como 'skipped' un VEVENT sin DTSTART", () => {
    const raw = ["BEGIN:VEVENT", "SUMMARY:Sin fecha", "END:VEVENT"].join("\r\n");

    const { events, skipped } = parseIcs(raw, MADRID);

    expect(events).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("sin DTEND, usa 1 hora de duración por defecto", () => {
    const raw = ["BEGIN:VEVENT", "SUMMARY:Corto", "DTSTART:20260824T160000Z", "END:VEVENT"].join("\r\n");

    const { events } = parseIcs(raw, MADRID);

    expect(events[0].endTime.toISOString()).toBe("2026-08-24T17:00:00.000Z");
  });

  it("round-trip: lo que exporta buildIcs se vuelve a leer igual con parseIcs", () => {
    const original = buildIcs([
      {
        id: 1,
        title: "Reunión de equipo",
        description: "Revisión de sprint",
        location: "Sala 2",
        startTime: new Date("2026-08-24T16:00:00.000Z"),
        endTime: new Date("2026-08-24T17:00:00.000Z"),
        isRecurring: true,
        recurringPattern: "monthly",
      },
    ]);

    const { events } = parseIcs(original, MADRID);

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Reunión de equipo");
    expect(events[0].description).toBe("Revisión de sprint");
    expect(events[0].location).toBe("Sala 2");
    expect(events[0].startTime.toISOString()).toBe("2026-08-24T16:00:00.000Z");
    expect(events[0].endTime.toISOString()).toBe("2026-08-24T17:00:00.000Z");
    expect(events[0].recurringPattern).toBe("monthly");
  });
});
