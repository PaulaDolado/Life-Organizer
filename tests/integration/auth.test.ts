import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";

describe("Auth Endpoints", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("POST /auth/register", () => {
    it("debería crear un usuario y retornar token", async () => {
      const response = await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body.user.email).toBe("test@example.com");
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("debería retornar error si el email ya existe", async () => {
      await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });

      const response = await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password456",
        name: "Another User",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/Email ya existe/);
    });

    it("debería retornar error de validación con email inválido", async () => {
      const response = await request(app).post("/auth/register").send({
        email: "no-es-un-email",
        password: "Password123",
        name: "Test User",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    it("debería hacer login y retornar token", async () => {
      await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });

      const response = await request(app).post("/auth/login").send({
        email: "test@example.com",
        password: "Password123",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
    });

    it("debería retornar error con credenciales inválidas", async () => {
      const response = await request(app).post("/auth/login").send({
        email: "nonexistent@example.com",
        password: "Password123",
      });

      expect(response.status).toBe(401);
    });
  });

  describe("POST /auth/refresh", () => {
    it("debería retornar un nuevo token a partir de un refresh token válido", async () => {
      const registerResponse = await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });

      const response = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: registerResponse.body.refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
    });

    it("debería retornar error con un refresh token inválido", async () => {
      const response = await request(app).post("/auth/refresh").send({ refreshToken: "token-invalido" });

      expect(response.status).toBe(401);
    });
  });
});
