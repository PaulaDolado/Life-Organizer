import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";

describe("Calendar Legend Endpoints", () => {
  let token: string;
  let token2: string;

  beforeEach(async () => {
    await prisma.calendarDayMark.deleteMany({});
    await prisma.calendarLegendCategory.deleteMany({});
    await prisma.user.deleteMany({});

    const response = await request(app).post("/auth/register").send({
      username: "calendarlegend",
      email: "calendarlegend@example.com",
      password: "Password123",
      name: "Calendar Legend User",
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

  const createCategory = (label = "Clase", color = "primary") =>
    request(app).post("/calendar-legend").set(authed()).send({ label, color });

  describe("GET /calendar-legend", () => {
    it("empieza vacío", async () => {
      const response = await request(app).get("/calendar-legend").set(authed());
      expect(response.status).toBe(200);
      expect(response.body.categories).toEqual([]);
    });

    it("rechaza la petición sin token", async () => {
      const response = await request(app).get("/calendar-legend");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /calendar-legend", () => {
    it("crea una categoría con un color de la paleta", async () => {
      const response = await createCategory("Vacances", "warning");
      expect(response.status).toBe(201);
      expect(response.body.label).toBe("Vacances");
      expect(response.body.color).toBe("warning");
    });

    it("rechaza un color fuera de la paleta", async () => {
      const response = await createCategory("Clase", "morado-fosforito");
      expect(response.status).toBe(400);
    });

    it("rechaza una etiqueta vacía", async () => {
      const response = await createCategory("", "primary");
      expect(response.status).toBe(400);
    });
  });

  describe("PUT /calendar-legend/:id", () => {
    it("edita nombre y color", async () => {
      const created = await createCategory("Borrador", "muted");
      const updated = await request(app)
        .put(`/calendar-legend/${created.body.id}`)
        .set(authed())
        .send({ label: "Festius", color: "negative" });

      expect(updated.status).toBe(200);
      expect(updated.body.label).toBe("Festius");
      expect(updated.body.color).toBe("negative");
    });

    it("no permite editar una categoría de otro usuario", async () => {
      const created = await createCategory();
      const response = await request(app)
        .put(`/calendar-legend/${created.body.id}`)
        .set({ Authorization: `Bearer ${token2}` })
        .send({ label: "Intrusión" });
      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /calendar-legend/:id", () => {
    it("elimina la categoría y desmarca los días que la usaban", async () => {
      const category = await createCategory();
      await request(app).put("/calendar-legend/marks/2026-09-15").set(authed()).send({ categoryId: category.body.id });

      const deleted = await request(app).delete(`/calendar-legend/${category.body.id}`).set(authed());
      expect(deleted.status).toBe(200);

      const marks = await request(app)
        .get("/calendar-legend/marks")
        .query({ from: "2026-09-01", to: "2026-09-30" })
        .set(authed());
      expect(marks.body.marks).toEqual([]);
    });
  });

  describe("PUT /calendar-legend/marks/:date", () => {
    it("pinta un día con una categoría", async () => {
      const category = await createCategory("Clase", "primary");
      const response = await request(app)
        .put("/calendar-legend/marks/2026-09-15")
        .set(authed())
        .send({ categoryId: category.body.id });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ date: "2026-09-15", categoryId: category.body.id });
    });

    it("repintar el mismo día sustituye la categoría en vez de acumularla", async () => {
      const clase = await createCategory("Clase", "primary");
      const vacances = await createCategory("Vacances", "warning");

      await request(app).put("/calendar-legend/marks/2026-09-15").set(authed()).send({ categoryId: clase.body.id });
      await request(app).put("/calendar-legend/marks/2026-09-15").set(authed()).send({ categoryId: vacances.body.id });

      const marks = await request(app)
        .get("/calendar-legend/marks")
        .query({ from: "2026-09-01", to: "2026-09-30" })
        .set(authed());
      expect(marks.body.marks).toEqual([{ date: "2026-09-15", categoryId: vacances.body.id }]);
    });

    it("categoryId null borra la marca del día", async () => {
      const category = await createCategory();
      await request(app).put("/calendar-legend/marks/2026-09-15").set(authed()).send({ categoryId: category.body.id });

      const cleared = await request(app).put("/calendar-legend/marks/2026-09-15").set(authed()).send({ categoryId: null });
      expect(cleared.status).toBe(200);
      expect(cleared.body).toEqual({ date: "2026-09-15", categoryId: null });

      const marks = await request(app)
        .get("/calendar-legend/marks")
        .query({ from: "2026-09-01", to: "2026-09-30" })
        .set(authed());
      expect(marks.body.marks).toEqual([]);
    });

    it("rechaza una categoría de otro usuario", async () => {
      const category = await createCategory();
      const response = await request(app)
        .put("/calendar-legend/marks/2026-09-15")
        .set({ Authorization: `Bearer ${token2}` })
        .send({ categoryId: category.body.id });
      expect(response.status).toBe(403);
    });
  });

  describe("GET /calendar-legend/marks", () => {
    it("solo devuelve las marcas dentro del rango pedido", async () => {
      const category = await createCategory();
      await request(app).put("/calendar-legend/marks/2026-08-15").set(authed()).send({ categoryId: category.body.id });
      await request(app).put("/calendar-legend/marks/2026-09-15").set(authed()).send({ categoryId: category.body.id });

      const marks = await request(app)
        .get("/calendar-legend/marks")
        .query({ from: "2026-09-01", to: "2026-09-30" })
        .set(authed());

      expect(marks.body.marks).toEqual([{ date: "2026-09-15", categoryId: category.body.id }]);
    });
  });
});
