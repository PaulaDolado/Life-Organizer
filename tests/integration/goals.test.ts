import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";

describe("Goals Endpoints", () => {
  let token: string;

  beforeEach(async () => {
    await prisma.goalProgress.deleteMany({});
    await prisma.goal.deleteMany({});
    await prisma.user.deleteMany({});

    const response = await request(app).post("/auth/register").send({
      email: "goals@example.com",
      password: "Password123",
      name: "Goals User",
    });
    token = response.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function authed() {
    return { Authorization: `Bearer ${token}` };
  }

  describe("POST /goals", () => {
    it("debería crear una meta con periodEnd calculado automáticamente", async () => {
      const response = await request(app).post("/goals").set(authed()).send({
        title: "Ejercicio 5 días",
        period: "weekly",
        targetValue: 5,
      });

      expect(response.status).toBe(201);
      expect(response.body.currentValue).toBe(0);
      expect(response.body.completed).toBe(false);
      expect(response.body.periodEnd).toBeTruthy();
    });
  });

  describe("GET /goals", () => {
    it("debería listar solo metas activas por defecto", async () => {
      await request(app).post("/goals").set(authed()).send({
        title: "Meta activa",
        period: "monthly",
        targetValue: 10,
      });

      const response = await request(app).get("/goals").set(authed());

      expect(response.status).toBe(200);
      expect(response.body.goals).toHaveLength(1);
    });
  });

  describe("POST /goals/:id/progress", () => {
    it("debería acumular progreso y completar la meta al alcanzar el objetivo", async () => {
      const created = await request(app).post("/goals").set(authed()).send({
        title: "Leer 3 días",
        period: "weekly",
        targetValue: 3,
        bonusPoints: 25,
      });

      await request(app)
        .post(`/goals/${created.body.id}/progress`)
        .set(authed())
        .send({ value: 1, note: "Día 1" });
      await request(app)
        .post(`/goals/${created.body.id}/progress`)
        .set(authed())
        .send({ value: 1, note: "Día 2" });
      const finalResponse = await request(app)
        .post(`/goals/${created.body.id}/progress`)
        .set(authed())
        .send({ value: 1, note: "Día 3" });

      expect(finalResponse.status).toBe(201);
      expect(finalResponse.body.goal.currentValue).toBe(3);
      expect(finalResponse.body.goal.completed).toBe(true);
      expect(finalResponse.body.justCompleted).toBe(true);
      expect(finalResponse.body.bonusPointsAwarded).toBe(25);
    });
  });

  describe("GET /goals/:id/analytics", () => {
    it("debería retornar % completado y racha", async () => {
      const created = await request(app).post("/goals").set(authed()).send({
        title: "Meditar",
        period: "weekly",
        targetValue: 7,
      });

      await request(app).post(`/goals/${created.body.id}/progress`).set(authed()).send({ value: 2 });

      const response = await request(app).get(`/goals/${created.body.id}/analytics`).set(authed());

      expect(response.status).toBe(200);
      expect(response.body.percentComplete).toBeGreaterThan(0);
      expect(response.body.streakDays).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Ownership", () => {
    it("no debería permitir ver una meta de otro usuario", async () => {
      const created = await request(app).post("/goals").set(authed()).send({
        title: "Privada",
        period: "weekly",
        targetValue: 5,
      });

      const otherUser = await request(app).post("/auth/register").send({
        email: "otro-goals@example.com",
        password: "Password123",
        name: "Otro",
      });

      const response = await request(app)
        .get(`/goals/${created.body.id}`)
        .set({ Authorization: `Bearer ${otherUser.body.token}` });

      expect(response.status).toBe(403);
    });
  });
});
