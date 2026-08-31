import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";

describe("Schedule Endpoints", () => {
  let token: string;
  let token2: string;

  beforeEach(async () => {
    await prisma.scheduleRow.deleteMany({});
    await prisma.user.deleteMany({});

    const response = await request(app).post("/auth/register").send({
      username: "schedule",
      email: "schedule@example.com",
      password: "Password123",
      name: "Schedule User",
    });
    token = response.body.token;

    const response2 = await request(app).post("/auth/register").send({
      username: "otro",
      email: "otro@example.com",
      password: "Password123",
      name: "Otro User",
    });
    token2 = response2.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function authed() {
    return { Authorization: `Bearer ${token}` };
  }

  describe("GET /schedule", () => {
    it("empieza vacío", async () => {
      const response = await request(app).get("/schedule").set(authed());
      expect(response.status).toBe(200);
      expect(response.body.rows).toEqual([]);
    });

    it("rechaza la petición sin token", async () => {
      const response = await request(app).get("/schedule");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /schedule", () => {
    it("crea una fila con timeLabel y celdas vacías", async () => {
      const response = await request(app).post("/schedule").set(authed()).send({ timeLabel: "08:00 - 10:00" });

      expect(response.status).toBe(201);
      expect(response.body.timeLabel).toBe("08:00 - 10:00");
      expect(response.body.monday).toBe("");
      expect(response.body.friday).toBe("");
    });

    it("varias filas quedan ordenadas por orden de creación", async () => {
      await request(app).post("/schedule").set(authed()).send({ timeLabel: "08:00" });
      await request(app).post("/schedule").set(authed()).send({ timeLabel: "10:00" });
      await request(app).post("/schedule").set(authed()).send({ timeLabel: "12:00" });

      const response = await request(app).get("/schedule").set(authed());
      expect(response.body.rows.map((r: { timeLabel: string }) => r.timeLabel)).toEqual(["08:00", "10:00", "12:00"]);
    });
  });

  describe("PUT /schedule/:id", () => {
    it("rellena una asignatura en una celda de un día", async () => {
      const created = await request(app).post("/schedule").set(authed()).send({ timeLabel: "08:00 - 10:00" });

      const updated = await request(app)
        .put(`/schedule/${created.body.id}`)
        .set(authed())
        .send({ monday: "Cálculo I", wednesday: "Cálculo I" });

      expect(updated.status).toBe(200);
      expect(updated.body.monday).toBe("Cálculo I");
      expect(updated.body.wednesday).toBe("Cálculo I");
      expect(updated.body.tuesday).toBe("");
    });

    it("no permite editar una fila de otro usuario", async () => {
      const created = await request(app).post("/schedule").set(authed()).send({ timeLabel: "08:00" });

      const response = await request(app)
        .put(`/schedule/${created.body.id}`)
        .set({ Authorization: `Bearer ${token2}` })
        .send({ monday: "Intrusión" });

      expect(response.status).toBe(403);
    });

    it("devuelve 404 sobre una fila inexistente", async () => {
      const response = await request(app).put("/schedule/999999").set(authed()).send({ monday: "x" });
      expect(response.status).toBe(404);
    });
  });

  describe("PUT /schedule/:id/move", () => {
    it("sube una fila y el orden se refleja en el siguiente GET", async () => {
      const first = await request(app).post("/schedule").set(authed()).send({ timeLabel: "08:00" });
      const second = await request(app).post("/schedule").set(authed()).send({ timeLabel: "10:00" });

      const moved = await request(app).put(`/schedule/${second.body.id}/move`).set(authed()).send({ direction: "up" });
      expect(moved.status).toBe(200);

      const list = await request(app).get("/schedule").set(authed());
      expect(list.body.rows.map((r: { id: number }) => r.id)).toEqual([second.body.id, first.body.id]);
    });

    it("mover 'up' la primera fila no cambia nada (no-op)", async () => {
      const first = await request(app).post("/schedule").set(authed()).send({ timeLabel: "08:00" });
      await request(app).post("/schedule").set(authed()).send({ timeLabel: "10:00" });

      const moved = await request(app).put(`/schedule/${first.body.id}/move`).set(authed()).send({ direction: "up" });
      expect(moved.status).toBe(200);

      const list = await request(app).get("/schedule").set(authed());
      expect(list.body.rows[0].id).toBe(first.body.id);
    });
  });

  describe("DELETE /schedule/:id", () => {
    it("elimina una fila", async () => {
      const created = await request(app).post("/schedule").set(authed()).send({ timeLabel: "08:00" });

      const deleted = await request(app).delete(`/schedule/${created.body.id}`).set(authed());
      expect(deleted.status).toBe(200);

      const list = await request(app).get("/schedule").set(authed());
      expect(list.body.rows).toHaveLength(0);
    });

    it("no permite eliminar una fila de otro usuario", async () => {
      const created = await request(app).post("/schedule").set(authed()).send({ timeLabel: "08:00" });

      const response = await request(app).delete(`/schedule/${created.body.id}`).set({ Authorization: `Bearer ${token2}` });
      expect(response.status).toBe(403);
    });
  });
});
