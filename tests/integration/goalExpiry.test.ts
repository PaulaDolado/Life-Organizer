import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";
import { processExpiredGoals } from "../../src/services/goalExpiryService";

describe("Goal expiry / auto-renew (vía processExpiredGoals)", () => {
  let token: string;

  beforeEach(async () => {
    await prisma.goalProgress.deleteMany({});
    await prisma.goal.deleteMany({});
    await prisma.user.deleteMany({});

    const response = await request(app).post("/auth/register").send({
      email: "expiry@example.com",
      password: "Password123",
      name: "Expiry User",
    });
    token = response.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function authed() {
    return { Authorization: `Bearer ${token}` };
  }

  it("archiva una meta vencida y crea la del siguiente periodo (autoRenew por defecto)", async () => {
    const created = await request(app).post("/goals").set(authed()).send({
      title: "Ejercicio 5 días",
      period: "weekly",
      targetValue: 5,
      periodStart: "2020-01-01T00:00:00.000Z",
      periodEnd: "2020-01-07T23:59:59.000Z", // muy en el pasado: garantizado expirado
    });

    const result = await processExpiredGoals();
    expect(result.archived).toBe(1);
    expect(result.renewed).toBe(1);

    const active = await request(app).get("/goals").set(authed());
    expect(active.body.goals).toHaveLength(1);
    expect(active.body.goals[0].id).not.toBe(created.body.id);
    expect(active.body.goals[0].title).toBe("Ejercicio 5 días");

    const expired = await request(app).get("/goals").query({ status: "expired" }).set(authed());
    expect(expired.body.goals).toHaveLength(1);
    expect(expired.body.goals[0].id).toBe(created.body.id);
  });

  it("no renueva una meta con autoRenew:false, solo la archiva", async () => {
    await request(app).post("/goals").set(authed()).send({
      title: "Meta puntual",
      period: "monthly",
      targetValue: 1,
      autoRenew: false,
      periodStart: "2020-01-01T00:00:00.000Z",
      periodEnd: "2020-01-31T23:59:59.000Z",
    });

    const result = await processExpiredGoals();
    expect(result).toEqual({ archived: 1, renewed: 0 });

    const active = await request(app).get("/goals").set(authed());
    expect(active.body.goals).toHaveLength(0);
  });

  it("es idempotente: correrlo dos veces no duplica la renovación", async () => {
    await request(app).post("/goals").set(authed()).send({
      title: "Leer",
      period: "weekly",
      targetValue: 3,
      periodStart: "2020-01-01T00:00:00.000Z",
      periodEnd: "2020-01-07T23:59:59.000Z",
    });

    await processExpiredGoals();
    const second = await processExpiredGoals();

    expect(second).toEqual({ archived: 0, renewed: 0 });

    const all = await request(app).get("/goals").query({ status: "all" }).set(authed());
    expect(all.body.goals).toHaveLength(2); // la original archivada + la renovada
  });
});
