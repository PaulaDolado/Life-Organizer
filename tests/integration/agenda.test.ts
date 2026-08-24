import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";

describe("Agenda Endpoints", () => {
  let token: string;

  beforeEach(async () => {
    await prisma.event.deleteMany({});
    await prisma.user.deleteMany({});

    const response = await request(app).post("/auth/register").send({
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
});
