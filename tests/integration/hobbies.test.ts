import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";

describe("Hobbies Endpoints", () => {
  let token: string;

  beforeEach(async () => {
    await prisma.hobbySession.deleteMany({});
    await prisma.hobby.deleteMany({});
    await prisma.user.deleteMany({});

    const response = await request(app).post("/auth/register").send({
      username: "hobbies",
      email: "hobbies@example.com",
      password: "Password123",
      name: "Hobbies User",
    });
    token = response.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function authed() {
    return { Authorization: `Bearer ${token}` };
  }

  describe("POST /hobbies", () => {
    it("debería crear un hobby", async () => {
      const response = await request(app).post("/hobbies").set(authed()).send({
        name: "Guitarra",
        category: "music",
      });

      expect(response.status).toBe(201);
      expect(response.body.category).toBe("music");
    });

    it("debería rechazar una categoría inválida", async () => {
      const response = await request(app).post("/hobbies").set(authed()).send({
        name: "Algo raro",
        category: "no-existe",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /hobbies/category/:category", () => {
    it("debería filtrar hobbies por categoría", async () => {
      await request(app).post("/hobbies").set(authed()).send({ name: "Ajedrez", category: "sports" });
      await request(app).post("/hobbies").set(authed()).send({ name: "Lectura", category: "reading" });

      const response = await request(app).get("/hobbies/category/reading").set(authed());

      expect(response.status).toBe(200);
      expect(response.body.hobbies).toHaveLength(1);
      expect(response.body.hobbies[0].name).toBe("Lectura");
    });
  });

  describe("Sesiones y analytics", () => {
    it("debería registrar sesiones y calcular horas totales", async () => {
      const hobby = await request(app).post("/hobbies").set(authed()).send({
        name: "Lectura",
        category: "reading",
      });

      await request(app)
        .post(`/hobbies/${hobby.body.id}/sessions`)
        .set(authed())
        .send({ durationMinutes: 30, notes: "Capítulo 1" });
      await request(app)
        .post(`/hobbies/${hobby.body.id}/sessions`)
        .set(authed())
        .send({ durationMinutes: 90 });

      const analytics = await request(app).get(`/hobbies/${hobby.body.id}/analytics`).set(authed());

      expect(analytics.status).toBe(200);
      expect(analytics.body.totalSessions).toBe(2);
      expect(analytics.body.totalMinutes).toBe(120);
      expect(analytics.body.totalHours).toBe(2);
      expect(analytics.body.recentSessions).toHaveLength(2);
    });
  });

  describe("Ownership", () => {
    it("no debería permitir editar un hobby de otro usuario", async () => {
      const hobby = await request(app).post("/hobbies").set(authed()).send({
        name: "Privado",
        category: "art",
      });

      const otherUser = await request(app).post("/auth/register").send({
        username: "otro_hobbies",
        email: "otro-hobbies@example.com",
        password: "Password123",
        name: "Otro",
      });

      const response = await request(app)
        .put(`/hobbies/${hobby.body.id}`)
        .set({ Authorization: `Bearer ${otherUser.body.token}` })
        .send({ name: "Hackeado" });

      expect(response.status).toBe(403);
    });
  });
});
