import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";

describe("Agenda Endpoints", () => {
  let token: string;

  beforeEach(async () => {
    await prisma.eventException.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.user.deleteMany({});

    const response = await request(app).post("/auth/register").send({
      username: "agenda",
      email: "agenda@example.com",
      password: "Password123",
      name: "Agenda User",
    });
    token = response.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function authed() {
    return { Authorization: `Bearer ${token}` };
  }

  describe("POST /agenda/events", () => {
    it("debería crear un evento", async () => {
      const response = await request(app)
        .post("/agenda/events")
        .set(authed())
        .send({
          title: "Gimnasio",
          type: "gym",
          startTime: "2026-08-24T18:00:00.000Z",
          endTime: "2026-08-24T19:00:00.000Z",
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe("Gimnasio");
    });

    it("debería rechazar un evento sin token", async () => {
      const response = await request(app).post("/agenda/events").send({
        title: "Gimnasio",
        type: "gym",
        startTime: "2026-08-24T18:00:00.000Z",
        endTime: "2026-08-24T19:00:00.000Z",
      });

      expect(response.status).toBe(401);
    });

    it("debería rechazar endTime anterior a startTime", async () => {
      const response = await request(app)
        .post("/agenda/events")
        .set(authed())
        .send({
          title: "Evento inválido",
          type: "work",
          startTime: "2026-08-24T18:00:00.000Z",
          endTime: "2026-08-24T17:00:00.000Z",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /agenda/day/:date", () => {
    it("debería listar los eventos del día", async () => {
      await request(app)
        .post("/agenda/events")
        .set(authed())
        .send({
          title: "Reunión",
          type: "meeting",
          startTime: "2026-08-24T10:00:00.000Z",
          endTime: "2026-08-24T11:00:00.000Z",
        });

      const response = await request(app).get("/agenda/day/2026-08-24").set(authed());

      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(1);
    });
  });

  describe("Eventos recurrentes", () => {
    it("una plantilla weekly aparece en semanas futuras aunque su startTime original ya haya pasado", async () => {
      // 2026-08-03 es lunes; la creamos como recurrente semanal.
      await request(app)
        .post("/agenda/events")
        .set(authed())
        .send({
          title: "Gimnasio semanal",
          type: "gym",
          startTime: "2026-08-03T18:00:00.000Z",
          endTime: "2026-08-03T19:00:00.000Z",
          isRecurring: true,
          recurringPattern: "weekly",
        });

      // Consultamos 3 semanas después: no hay ninguna fila real ahí, solo la ocurrencia virtual.
      const response = await request(app).get("/agenda/week/2026-08-24").set(authed());

      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].isRecurringInstance).toBe(true);
      expect(response.body.events[0].startTime).toBe("2026-08-24T18:00:00.000Z");
    });
  });

  describe("Paginación", () => {
    it("GET /agenda/day acepta page/limit y reporta el total real", async () => {
      for (let hour = 8; hour < 12; hour += 1) {
        await request(app)
          .post("/agenda/events")
          .set(authed())
          .send({
            title: `Bloque ${hour}h`,
            type: "work",
            startTime: `2026-08-24T${String(hour).padStart(2, "0")}:00:00.000Z`,
            endTime: `2026-08-24T${String(hour).padStart(2, "0")}:30:00.000Z`,
          });
      }

      const response = await request(app)
        .get("/agenda/day/2026-08-24")
        .query({ page: 2, limit: 2 })
        .set(authed());

      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(2);
      expect(response.body.pagination).toEqual({ page: 2, limit: 2, total: 4, pages: 2 });
    });
  });

  describe("PUT/DELETE /agenda/events/:id", () => {
    it("debería editar y luego eliminar un evento propio", async () => {
      const created = await request(app)
        .post("/agenda/events")
        .set(authed())
        .send({
          title: "Estudio",
          type: "study",
          startTime: "2026-08-24T09:00:00.000Z",
          endTime: "2026-08-24T10:00:00.000Z",
        });

      const updated = await request(app)
        .put(`/agenda/events/${created.body.id}`)
        .set(authed())
        .send({ title: "Estudio TS" });
      expect(updated.status).toBe(200);
      expect(updated.body.title).toBe("Estudio TS");

      const deleted = await request(app).delete(`/agenda/events/${created.body.id}`).set(authed());
      expect(deleted.status).toBe(200);
    });

    it("no debería permitir editar un evento de otro usuario", async () => {
      const created = await request(app)
        .post("/agenda/events")
        .set(authed())
        .send({
          title: "Privado",
          type: "work",
          startTime: "2026-08-24T09:00:00.000Z",
          endTime: "2026-08-24T10:00:00.000Z",
        });

      const otherUser = await request(app).post("/auth/register").send({
        username: "otro",
        email: "otro@example.com",
        password: "Password123",
        name: "Otro",
      });

      const response = await request(app)
        .put(`/agenda/events/${created.body.id}`)
        .set({ Authorization: `Bearer ${otherUser.body.token}` })
        .send({ title: "Hackeado" });

      expect(response.status).toBe(403);
    });
  });

  describe("GET /agenda/month/:date", () => {
    it("lista los eventos del mes completo, incluidas ocurrencias recurrentes de semanas distintas", async () => {
      await request(app).post("/agenda/events").set(authed()).send({
        title: "Suelto",
        type: "work",
        startTime: "2026-08-05T09:00:00.000Z",
        endTime: "2026-08-05T10:00:00.000Z",
      });
      await request(app).post("/agenda/events").set(authed()).send({
        title: "Semanal",
        type: "gym",
        startTime: "2026-08-03T18:00:00.000Z",
        endTime: "2026-08-03T19:00:00.000Z",
        isRecurring: true,
        recurringPattern: "weekly",
      });

      const response = await request(app).get("/agenda/month/2026-08-15").set(authed());

      expect(response.status).toBe(200);
      // El suelto (1) + 4 ocurrencias semanales en agosto 2026 (3, 10, 17, 24, 31 -> 31 cae en agosto también = 5).
      expect(response.body.events.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Recordatorios configurables por evento", () => {
    it("crea un evento con varias antelaciones de aviso y las devuelve", async () => {
      const response = await request(app).post("/agenda/events").set(authed()).send({
        title: "Boda",
        type: "meeting",
        startTime: "2026-08-24T18:00:00.000Z",
        endTime: "2026-08-24T22:00:00.000Z",
        reminderMinutesBefore: [15, 1440],
      });

      expect(response.status).toBe(201);
      expect(response.body.reminderMinutesBefore).toEqual([15, 1440]);
    });

    it("usa [30] por defecto si no se especifica", async () => {
      const response = await request(app).post("/agenda/events").set(authed()).send({
        title: "Café",
        type: "free",
        startTime: "2026-08-24T18:00:00.000Z",
        endTime: "2026-08-24T18:30:00.000Z",
      });

      expect(response.body.reminderMinutesBefore).toEqual([30]);
    });

    it("rechaza una antelación fuera de rango", async () => {
      const response = await request(app).post("/agenda/events").set(authed()).send({
        title: "X",
        type: "work",
        startTime: "2026-08-24T18:00:00.000Z",
        endTime: "2026-08-24T19:00:00.000Z",
        reminderMinutesBefore: [999999],
      });

      expect(response.status).toBe(400);
    });
  });

  describe("Invitados", () => {
    it("crea y edita la lista de invitados de un evento", async () => {
      const created = await request(app).post("/agenda/events").set(authed()).send({
        title: "Cena",
        type: "free",
        startTime: "2026-08-24T20:00:00.000Z",
        endTime: "2026-08-24T22:00:00.000Z",
        guests: ["ana@example.com", "Luis"],
      });
      expect(created.body.guests).toEqual(["ana@example.com", "Luis"]);

      const updated = await request(app)
        .put(`/agenda/events/${created.body.id}`)
        .set(authed())
        .send({ guests: ["ana@example.com"] });

      expect(updated.body.guests).toEqual(["ana@example.com"]);
    });
  });

  describe("Excepciones a eventos recurrentes", () => {
    async function createWeeklyEvent() {
      const response = await request(app).post("/agenda/events").set(authed()).send({
        title: "Gimnasio semanal",
        type: "gym",
        startTime: "2026-08-03T18:00:00.000Z", // lunes
        endTime: "2026-08-03T19:00:00.000Z",
        isRecurring: true,
        recurringPattern: "weekly",
      });
      return response.body;
    }

    it("cancela una única ocurrencia sin afectar al resto de la serie", async () => {
      const event = await createWeeklyEvent();

      const exception = await request(app)
        .post(`/agenda/events/${event.id}/exceptions`)
        .set(authed())
        .send({ originalStartTime: "2026-08-10T18:00:00.000Z", action: "cancelled" });
      expect(exception.status).toBe(201);

      const cancelledWeek = await request(app).get("/agenda/week/2026-08-10").set(authed());
      expect(cancelledWeek.body.events).toHaveLength(0);

      const nextWeek = await request(app).get("/agenda/week/2026-08-17").set(authed());
      expect(nextWeek.body.events).toHaveLength(1); // la serie sigue intacta la semana siguiente
    });

    it("mueve una única ocurrencia a otro horario", async () => {
      const event = await createWeeklyEvent();

      await request(app)
        .post(`/agenda/events/${event.id}/exceptions`)
        .set(authed())
        .send({
          originalStartTime: "2026-08-10T18:00:00.000Z",
          action: "moved",
          newStartTime: "2026-08-12T09:00:00.000Z",
          newEndTime: "2026-08-12T10:00:00.000Z",
        });

      const week = await request(app).get("/agenda/week/2026-08-10").set(authed());
      expect(week.body.events).toHaveLength(1);
      expect(week.body.events[0].startTime).toBe("2026-08-12T09:00:00.000Z");
      expect(week.body.events[0].isException).toBe(true);
    });

    it("rechaza una excepción sobre un evento no recurrente", async () => {
      const single = await request(app).post("/agenda/events").set(authed()).send({
        title: "Único",
        type: "work",
        startTime: "2026-08-24T09:00:00.000Z",
        endTime: "2026-08-24T10:00:00.000Z",
      });

      const response = await request(app)
        .post(`/agenda/events/${single.body.id}/exceptions`)
        .set(authed())
        .send({ originalStartTime: "2026-08-24T09:00:00.000Z", action: "cancelled" });

      expect(response.status).toBe(400);
    });

    it("borrar la excepción restaura la ocurrencia en su horario natural", async () => {
      const event = await createWeeklyEvent();
      await request(app)
        .post(`/agenda/events/${event.id}/exceptions`)
        .set(authed())
        .send({ originalStartTime: "2026-08-10T18:00:00.000Z", action: "cancelled" });

      const deleted = await request(app)
        .delete(`/agenda/events/${event.id}/exceptions/2026-08-10T18:00:00.000Z`)
        .set(authed());
      expect(deleted.status).toBe(200);

      const week = await request(app).get("/agenda/week/2026-08-10").set(authed());
      expect(week.body.events).toHaveLength(1);
    });
  });

  describe("GET /agenda/free-time/:date", () => {
    it("calcula huecos libres y sugiere una tarea pendiente del planificador que encaje", async () => {
      await request(app).post("/agenda/events").set(authed()).send({
        title: "Reunión",
        type: "meeting",
        startTime: "2026-08-24T10:00:00.000Z",
        endTime: "2026-08-24T12:00:00.000Z",
      });
      await request(app).post("/planner/tasks").set(authed()).send({
        title: "Preparar informe",
        priority: "high",
        estimatedMinutes: 60,
      });

      const response = await request(app).get("/agenda/free-time/2026-08-24").set(authed());

      expect(response.status).toBe(200);
      expect(response.body.freeBlocks.length).toBeGreaterThan(0);
      expect(response.body.suggestions.length).toBeGreaterThan(0);
      expect(response.body.suggestions[0].task.title).toBe("Preparar informe");
    });
  });

  describe("Exportar/importar ICS", () => {
    it("GET /agenda/ics exporta los eventos como .ics descargable", async () => {
      await request(app).post("/agenda/events").set(authed()).send({
        title: "Dentista",
        type: "work",
        startTime: "2026-08-24T16:00:00.000Z",
        endTime: "2026-08-24T17:00:00.000Z",
      });

      const response = await request(app).get("/agenda/ics").set(authed());

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/calendar");
      expect(response.text).toContain("BEGIN:VCALENDAR");
      expect(response.text).toContain("SUMMARY:Dentista");
    });

    it("no incluye eventos de otro usuario en la exportación", async () => {
      const otherUser = await request(app).post("/auth/register").send({
        username: "otro_ics",
        email: "otro-ics@example.com",
        password: "Password123",
        name: "Otro",
      });
      await request(app)
        .post("/agenda/events")
        .set({ Authorization: `Bearer ${otherUser.body.token}` })
        .send({ title: "Privado ajeno", type: "work", startTime: "2026-08-24T09:00:00.000Z", endTime: "2026-08-24T10:00:00.000Z" });

      const response = await request(app).get("/agenda/ics").set(authed());

      expect(response.text).not.toContain("Privado ajeno");
    });

    it("POST /agenda/ics/import crea eventos a partir de un .ics", async () => {
      const ics = [
        "BEGIN:VCALENDAR",
        "BEGIN:VEVENT",
        "SUMMARY:Evento importado",
        "DTSTART:20260901T100000Z",
        "DTEND:20260901T110000Z",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");

      const response = await request(app).post("/agenda/ics/import").set(authed()).send({ ics });

      expect(response.status).toBe(201);
      expect(response.body.created).toBe(1);

      const week = await request(app).get("/agenda/week/2026-08-31").set(authed());
      expect(week.body.events.some((e: { title: string }) => e.title === "Evento importado")).toBe(true);
    });

    it("importa una serie semanal con RRULE como evento recurrente", async () => {
      const ics = [
        "BEGIN:VEVENT",
        "SUMMARY:Yoga",
        "DTSTART:20260803T180000Z",
        "DTEND:20260803T190000Z",
        "RRULE:FREQ=WEEKLY",
        "END:VEVENT",
      ].join("\r\n");

      const response = await request(app).post("/agenda/ics/import").set(authed()).send({ ics });
      expect(response.body.created).toBe(1);

      // Semana muy posterior a la del DTSTART: solo aparece si se importó como recurrente de verdad.
      const laterWeek = await request(app).get("/agenda/week/2026-08-24").set(authed());
      expect(laterWeek.body.events.some((e: { title: string; isRecurringInstance?: boolean }) => e.title === "Yoga" && e.isRecurringInstance)).toBe(
        true
      );
    });

    it("cuenta un VEVENT sin DTSTART como no interpretable, sin crear nada", async () => {
      const ics = ["BEGIN:VEVENT", "SUMMARY:Sin fecha", "END:VEVENT"].join("\r\n");

      const response = await request(app).post("/agenda/ics/import").set(authed()).send({ ics });

      expect(response.body.created).toBe(0);
      expect(response.body.skippedUnparsable).toBe(1);
    });

    it("rechaza un import sin contenido", async () => {
      const response = await request(app).post("/agenda/ics/import").set(authed()).send({ ics: "" });
      expect(response.status).toBe(400);
    });
  });
});
