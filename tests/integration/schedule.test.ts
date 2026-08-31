import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";

describe("Schedule Endpoints", () => {
  let token: string;
  let token2: string;

  beforeEach(async () => {
    await prisma.scheduleRow.deleteMany({});
    await prisma.schedule.deleteMany({});
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

  const createSchedule = (name = "1r trimestre") => request(app).post("/schedule").set(authed()).send({ name });

  describe("GET /schedule", () => {
    it("empieza vacío", async () => {
      const response = await request(app).get("/schedule").set(authed());
      expect(response.status).toBe(200);
      expect(response.body.schedules).toEqual([]);
    });

    it("rechaza la petición sin token", async () => {
      const response = await request(app).get("/schedule");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /schedule", () => {
    it("crea un horario con nombre propio, sin filas", async () => {
      const response = await createSchedule("2n semestre");

      expect(response.status).toBe(201);
      expect(response.body.name).toBe("2n semestre");
    });

    it("rechaza un nombre vacío", async () => {
      const response = await createSchedule("");
      expect(response.status).toBe(400);
    });

    it("varios horarios quedan ordenados por orden de creación", async () => {
      await createSchedule("1r trimestre");
      await createSchedule("2n trimestre");
      await createSchedule("3r trimestre");

      const response = await request(app).get("/schedule").set(authed());
      expect(response.body.schedules.map((s: { name: string }) => s.name)).toEqual(["1r trimestre", "2n trimestre", "3r trimestre"]);
    });
  });

  describe("PUT /schedule/:id", () => {
    it("renombra un horario", async () => {
      const created = await createSchedule("Borrador");

      const updated = await request(app).put(`/schedule/${created.body.id}`).set(authed()).send({ name: "1r trimestre" });
      expect(updated.status).toBe(200);
      expect(updated.body.name).toBe("1r trimestre");
    });

    it("no permite renombrar un horario de otro usuario", async () => {
      const created = await createSchedule();

      const response = await request(app)
        .put(`/schedule/${created.body.id}`)
        .set({ Authorization: `Bearer ${token2}` })
        .send({ name: "Intrusión" });
      expect(response.status).toBe(403);
    });

    it("devuelve 404 sobre un horario inexistente", async () => {
      const response = await request(app).put("/schedule/999999").set(authed()).send({ name: "x" });
      expect(response.status).toBe(404);
    });
  });

  describe("PUT /schedule/:id/move", () => {
    it("sube un horario y el orden se refleja en el siguiente GET", async () => {
      const first = await createSchedule("1r trimestre");
      const second = await createSchedule("2n trimestre");

      const moved = await request(app).put(`/schedule/${second.body.id}/move`).set(authed()).send({ direction: "up" });
      expect(moved.status).toBe(200);

      const list = await request(app).get("/schedule").set(authed());
      expect(list.body.schedules.map((s: { id: number }) => s.id)).toEqual([second.body.id, first.body.id]);
    });
  });

  describe("DELETE /schedule/:id", () => {
    it("elimina un horario y sus filas", async () => {
      const created = await createSchedule();
      await request(app).post(`/schedule/${created.body.id}/rows`).set(authed()).send({ timeLabel: "08:00" });

      const deleted = await request(app).delete(`/schedule/${created.body.id}`).set(authed());
      expect(deleted.status).toBe(200);

      const list = await request(app).get("/schedule").set(authed());
      expect(list.body.schedules).toHaveLength(0);
    });

    it("no permite eliminar un horario de otro usuario", async () => {
      const created = await createSchedule();

      const response = await request(app).delete(`/schedule/${created.body.id}`).set({ Authorization: `Bearer ${token2}` });
      expect(response.status).toBe(403);
    });
  });

  describe("GET /schedule/:id/rows", () => {
    it("empieza vacío", async () => {
      const created = await createSchedule();
      const response = await request(app).get(`/schedule/${created.body.id}/rows`).set(authed());
      expect(response.status).toBe(200);
      expect(response.body.rows).toEqual([]);
    });

    it("no permite ver las filas de un horario de otro usuario", async () => {
      const created = await createSchedule();
      const response = await request(app).get(`/schedule/${created.body.id}/rows`).set({ Authorization: `Bearer ${token2}` });
      expect(response.status).toBe(403);
    });
  });

  describe("POST /schedule/:id/rows", () => {
    it("crea una fila con timeLabel y celdas vacías", async () => {
      const created = await createSchedule();
      const response = await request(app).post(`/schedule/${created.body.id}/rows`).set(authed()).send({ timeLabel: "08:00 - 10:00" });

      expect(response.status).toBe(201);
      expect(response.body.timeLabel).toBe("08:00 - 10:00");
      expect(response.body.monday).toBe("");
      expect(response.body.friday).toBe("");
    });

    it("varias filas quedan ordenadas por orden de creación", async () => {
      const created = await createSchedule();
      await request(app).post(`/schedule/${created.body.id}/rows`).set(authed()).send({ timeLabel: "08:00" });
      await request(app).post(`/schedule/${created.body.id}/rows`).set(authed()).send({ timeLabel: "10:00" });
      await request(app).post(`/schedule/${created.body.id}/rows`).set(authed()).send({ timeLabel: "12:00" });

      const response = await request(app).get(`/schedule/${created.body.id}/rows`).set(authed());
      expect(response.body.rows.map((r: { timeLabel: string }) => r.timeLabel)).toEqual(["08:00", "10:00", "12:00"]);
    });

    it("dos horarios distintos no comparten filas", async () => {
      const a = await createSchedule("1r trimestre");
      const b = await createSchedule("2n trimestre");
      await request(app).post(`/schedule/${a.body.id}/rows`).set(authed()).send({ timeLabel: "08:00" });

      const rowsB = await request(app).get(`/schedule/${b.body.id}/rows`).set(authed());
      expect(rowsB.body.rows).toEqual([]);
    });
  });

  describe("PUT /schedule/:id/rows/:rowId", () => {
    it("rellena una asignatura en una celda de un día, incluso con varias líneas", async () => {
      const schedule = await createSchedule();
      const created = await request(app).post(`/schedule/${schedule.body.id}/rows`).set(authed()).send({ timeLabel: "08:00 - 10:00" });

      const updated = await request(app)
        .put(`/schedule/${schedule.body.id}/rows/${created.body.id}`)
        .set(authed())
        .send({ monday: "Cálculo I\nAula 204", wednesday: "Cálculo I" });

      expect(updated.status).toBe(200);
      expect(updated.body.monday).toBe("Cálculo I\nAula 204");
      expect(updated.body.wednesday).toBe("Cálculo I");
      expect(updated.body.tuesday).toBe("");
    });

    it("no permite editar una fila de otro usuario", async () => {
      const schedule = await createSchedule();
      const created = await request(app).post(`/schedule/${schedule.body.id}/rows`).set(authed()).send({ timeLabel: "08:00" });

      const response = await request(app)
        .put(`/schedule/${schedule.body.id}/rows/${created.body.id}`)
        .set({ Authorization: `Bearer ${token2}` })
        .send({ monday: "Intrusión" });

      expect(response.status).toBe(403);
    });

    it("devuelve 404 sobre una fila inexistente", async () => {
      const schedule = await createSchedule();
      const response = await request(app).put(`/schedule/${schedule.body.id}/rows/999999`).set(authed()).send({ monday: "x" });
      expect(response.status).toBe(404);
    });
  });

  describe("PUT /schedule/:id/rows/:rowId/move", () => {
    it("sube una fila y el orden se refleja en el siguiente GET", async () => {
      const schedule = await createSchedule();
      const first = await request(app).post(`/schedule/${schedule.body.id}/rows`).set(authed()).send({ timeLabel: "08:00" });
      const second = await request(app).post(`/schedule/${schedule.body.id}/rows`).set(authed()).send({ timeLabel: "10:00" });

      const moved = await request(app)
        .put(`/schedule/${schedule.body.id}/rows/${second.body.id}/move`)
        .set(authed())
        .send({ direction: "up" });
      expect(moved.status).toBe(200);

      const list = await request(app).get(`/schedule/${schedule.body.id}/rows`).set(authed());
      expect(list.body.rows.map((r: { id: number }) => r.id)).toEqual([second.body.id, first.body.id]);
    });

    it("mover 'up' la primera fila no cambia nada (no-op)", async () => {
      const schedule = await createSchedule();
      const first = await request(app).post(`/schedule/${schedule.body.id}/rows`).set(authed()).send({ timeLabel: "08:00" });
      await request(app).post(`/schedule/${schedule.body.id}/rows`).set(authed()).send({ timeLabel: "10:00" });

      const moved = await request(app)
        .put(`/schedule/${schedule.body.id}/rows/${first.body.id}/move`)
        .set(authed())
        .send({ direction: "up" });
      expect(moved.status).toBe(200);

      const list = await request(app).get(`/schedule/${schedule.body.id}/rows`).set(authed());
      expect(list.body.rows[0].id).toBe(first.body.id);
    });
  });

  describe("DELETE /schedule/:id/rows/:rowId", () => {
    it("elimina una fila", async () => {
      const schedule = await createSchedule();
      const created = await request(app).post(`/schedule/${schedule.body.id}/rows`).set(authed()).send({ timeLabel: "08:00" });

      const deleted = await request(app).delete(`/schedule/${schedule.body.id}/rows/${created.body.id}`).set(authed());
      expect(deleted.status).toBe(200);

      const list = await request(app).get(`/schedule/${schedule.body.id}/rows`).set(authed());
      expect(list.body.rows).toHaveLength(0);
    });

    it("no permite eliminar una fila de otro usuario", async () => {
      const schedule = await createSchedule();
      const created = await request(app).post(`/schedule/${schedule.body.id}/rows`).set(authed()).send({ timeLabel: "08:00" });

      const response = await request(app)
        .delete(`/schedule/${schedule.body.id}/rows/${created.body.id}`)
        .set({ Authorization: `Bearer ${token2}` });
      expect(response.status).toBe(403);
    });
  });
});
