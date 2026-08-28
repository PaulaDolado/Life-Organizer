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

  describe("GET/PUT /auth/me", () => {
    it("debería registrar con una timezone custom y devolverla en /auth/me", async () => {
      const register = await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
        timezone: "America/New_York",
      });

      const profile = await request(app)
        .get("/auth/me")
        .set({ Authorization: `Bearer ${register.body.token}` });

      expect(profile.status).toBe(200);
      expect(profile.body.timezone).toBe("America/New_York");
      expect(profile.body).not.toHaveProperty("password");
    });

    it("debería usar Europe/Madrid por defecto si no se indica timezone al registrar", async () => {
      const register = await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });

      expect(register.body.user.timezone).toBe("Europe/Madrid");
    });

    it("debería actualizar la timezone vía PUT /auth/me", async () => {
      const register = await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });
      const auth = { Authorization: `Bearer ${register.body.token}` };

      const updated = await request(app).put("/auth/me").set(auth).send({ timezone: "Asia/Tokyo" });
      expect(updated.status).toBe(200);
      expect(updated.body.timezone).toBe("Asia/Tokyo");

      const profile = await request(app).get("/auth/me").set(auth);
      expect(profile.body.timezone).toBe("Asia/Tokyo");
    });

    it("debería rechazar un timezone que no es una zona IANA real", async () => {
      const register = await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });

      const response = await request(app)
        .put("/auth/me")
        .set({ Authorization: `Bearer ${register.body.token}` })
        .send({ timezone: "no-existe" });

      expect(response.status).toBe(400);
    });

    it("debería actualizar el apellido vía PUT /auth/me", async () => {
      const register = await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });
      const auth = { Authorization: `Bearer ${register.body.token}` };

      const updated = await request(app).put("/auth/me").set(auth).send({ lastName: "Dolado" });
      expect(updated.status).toBe(200);
      expect(updated.body.lastName).toBe("Dolado");

      const profile = await request(app).get("/auth/me").set(auth);
      expect(profile.body.lastName).toBe("Dolado");
    });

    // No hay un `username` aparte del email: PUT /auth/me lo rechaza como campo desconocido.
    it("debería rechazar un campo username (no existe, el nombre de usuario es el email)", async () => {
      const register = await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });

      const response = await request(app)
        .put("/auth/me")
        .set({ Authorization: `Bearer ${register.body.token}` })
        .send({ username: "paula.dolado" });

      expect(response.status).toBe(400);
    });

    it("debería cambiar el email (nombre de usuario) vía PUT /auth/me y permitir login con el nuevo", async () => {
      const register = await request(app).post("/auth/register").send({
        email: "viejo@example.com",
        password: "Password123",
        name: "Test User",
      });
      const auth = { Authorization: `Bearer ${register.body.token}` };

      const updated = await request(app).put("/auth/me").set(auth).send({ email: "nuevo@example.com" });
      expect(updated.status).toBe(200);
      expect(updated.body.email).toBe("nuevo@example.com");

      const loginConNuevo = await request(app)
        .post("/auth/login")
        .send({ email: "nuevo@example.com", password: "Password123" });
      expect(loginConNuevo.status).toBe(200);

      const loginConViejo = await request(app)
        .post("/auth/login")
        .send({ email: "viejo@example.com", password: "Password123" });
      expect(loginConViejo.status).toBe(401);
    });

    it("debería rechazar un email ya usado por otra cuenta", async () => {
      await request(app).post("/auth/register").send({
        email: "primero@example.com",
        password: "Password123",
        name: "Primero",
      });
      const second = await request(app).post("/auth/register").send({
        email: "segundo@example.com",
        password: "Password123",
        name: "Segundo",
      });

      const response = await request(app)
        .put("/auth/me")
        .set({ Authorization: `Bearer ${second.body.token}` })
        .send({ email: "primero@example.com" });

      expect(response.status).toBe(409);
    });

    it("debería rechazar un email con formato inválido", async () => {
      const register = await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });

      const response = await request(app)
        .put("/auth/me")
        .set({ Authorization: `Bearer ${register.body.token}` })
        .send({ email: "no-es-un-email" });

      expect(response.status).toBe(400);
    });

    it("debería rechazar la petición sin token", async () => {
      const response = await request(app).get("/auth/me");
      expect(response.status).toBe(401);
    });
  });

  describe("PUT /auth/me/password", () => {
    async function registerAndAuth() {
      const register = await request(app).post("/auth/register").send({
        email: "test@example.com",
        password: "Password123",
        name: "Test User",
      });
      return { Authorization: `Bearer ${register.body.token}` };
    }

    it("debería cambiar la contraseña y permitir hacer login con la nueva", async () => {
      const auth = await registerAndAuth();

      const changed = await request(app)
        .put("/auth/me/password")
        .set(auth)
        .send({ currentPassword: "Password123", newPassword: "NuevaPassword456" });
      expect(changed.status).toBe(200);

      const loginConNueva = await request(app)
        .post("/auth/login")
        .send({ email: "test@example.com", password: "NuevaPassword456" });
      expect(loginConNueva.status).toBe(200);

      const loginConVieja = await request(app)
        .post("/auth/login")
        .send({ email: "test@example.com", password: "Password123" });
      expect(loginConVieja.status).toBe(401);
    });

    it("debería rechazar el cambio si currentPassword no coincide", async () => {
      const auth = await registerAndAuth();

      const response = await request(app)
        .put("/auth/me/password")
        .set(auth)
        .send({ currentPassword: "PasswordIncorrecta", newPassword: "NuevaPassword456" });

      expect(response.status).toBe(401);
    });

    it("debería rechazar una newPassword menor a 8 caracteres", async () => {
      const auth = await registerAndAuth();

      const response = await request(app)
        .put("/auth/me/password")
        .set(auth)
        .send({ currentPassword: "Password123", newPassword: "corta" });

      expect(response.status).toBe(400);
    });

    it("debería rechazar la petición sin token", async () => {
      const response = await request(app)
        .put("/auth/me/password")
        .send({ currentPassword: "Password123", newPassword: "NuevaPassword456" });

      expect(response.status).toBe(401);
    });
  });
});
