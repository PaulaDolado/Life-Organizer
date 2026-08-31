import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";

describe("Projects Endpoints", () => {
  let token: string;

  beforeEach(async () => {
    await prisma.projectTask.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});

    const response = await request(app).post("/auth/register").send({
      username: "projects",
      email: "projects@example.com",
      password: "Password123",
      name: "Projects User",
    });
    token = response.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function authed() {
    return { Authorization: `Bearer ${token}` };
  }

  describe("POST /projects", () => {
    it("debería crear un proyecto con valores por defecto", async () => {
      const response = await request(app).post("/projects").set(authed()).send({
        title: "Portfolio API",
      });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("idea");
      expect(response.body.priority).toBe("medium");
    });
  });

  describe("Tareas y progreso", () => {
    it("debería calcular el progreso a partir de las tareas completadas", async () => {
      const project = await request(app).post("/projects").set(authed()).send({
        title: "Life Organizer",
        priority: "high",
      });

      const task1 = await request(app)
        .post(`/projects/${project.body.id}/tasks`)
        .set(authed())
        .send({ title: "Setup" });
      await request(app)
        .post(`/projects/${project.body.id}/tasks`)
        .set(authed())
        .send({ title: "Auth" });

      await request(app)
        .put(`/projects/${project.body.id}/tasks/${task1.body.id}/complete`)
        .set(authed())
        .send({ completed: true });

      const progress = await request(app).get(`/projects/${project.body.id}/progress`).set(authed());
      expect(progress.status).toBe(200);
      expect(progress.body.total).toBe(2);
      expect(progress.body.completed).toBe(1);
      expect(progress.body.percent).toBe(50);

      const detail = await request(app).get(`/projects/${project.body.id}`).set(authed());
      expect(detail.body.tasks).toHaveLength(2);
      expect(detail.body.progress.percent).toBe(50);
    });

    it("debería permitir desmarcar una tarea ya completada", async () => {
      const project = await request(app).post("/projects").set(authed()).send({ title: "Desmarcable" });
      const task = await request(app)
        .post(`/projects/${project.body.id}/tasks`)
        .set(authed())
        .send({ title: "Revisar" });

      await request(app)
        .put(`/projects/${project.body.id}/tasks/${task.body.id}/complete`)
        .set(authed())
        .send({ completed: true });

      const uncompleted = await request(app)
        .put(`/projects/${project.body.id}/tasks/${task.body.id}/complete`)
        .set(authed())
        .send({ completed: false });

      expect(uncompleted.status).toBe(200);
      expect(uncompleted.body.completed).toBe(false);
      expect(uncompleted.body.completedAt).toBeNull();
    });

    it("debería eliminar una tarea", async () => {
      const project = await request(app).post("/projects").set(authed()).send({ title: "Con apuntes" });
      const task = await request(app)
        .post(`/projects/${project.body.id}/tasks`)
        .set(authed())
        .send({ title: "Borrar esto" });

      const deleted = await request(app)
        .delete(`/projects/${project.body.id}/tasks/${task.body.id}`)
        .set(authed());
      expect(deleted.status).toBe(200);

      const detail = await request(app).get(`/projects/${project.body.id}`).set(authed());
      expect(detail.body.tasks).toHaveLength(0);
    });

    it("debería editar el título de una tarea", async () => {
      const project = await request(app).post("/projects").set(authed()).send({ title: "Editable" });
      const task = await request(app)
        .post(`/projects/${project.body.id}/tasks`)
        .set(authed())
        .send({ title: "Tarea original" });

      const updated = await request(app)
        .put(`/projects/${project.body.id}/tasks/${task.body.id}`)
        .set(authed())
        .send({ title: "Tarea editada" });

      expect(updated.status).toBe(200);
      expect(updated.body.title).toBe("Tarea editada");
    });
  });

  describe("Ownership", () => {
    it("no debería permitir agregar tareas a un proyecto de otro usuario", async () => {
      const project = await request(app).post("/projects").set(authed()).send({ title: "Privado" });

      const otherUser = await request(app).post("/auth/register").send({
        username: "otro_projects",
        email: "otro-projects@example.com",
        password: "Password123",
        name: "Otro",
      });

      const response = await request(app)
        .post(`/projects/${project.body.id}/tasks`)
        .set({ Authorization: `Bearer ${otherUser.body.token}` })
        .send({ title: "Hackeada" });

      expect(response.status).toBe(403);
    });
  });

  describe("GET /projects/recent-entries", () => {
    it("devuelve las páginas de libreta editadas recientemente, de cualquier proyecto propio", async () => {
      const project = await request(app).post("/projects").set(authed()).send({ title: "Mudanza" });
      const page = await request(app).post(`/projects/${project.body.id}/pages`).set(authed()).send({ title: "Checklist" });
      await request(app).put(`/projects/${project.body.id}/pages/${page.body.id}`).set(authed()).send({ content: "<p>Cajas</p>" });

      const response = await request(app).get("/projects/recent-entries").set(authed());

      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(1);
      expect(response.body.entries[0]).toMatchObject({ projectTitle: "Mudanza", pageTitle: "Checklist", preview: "Cajas" });
    });

    it("no confunde 'recent-entries' con un :id de proyecto", async () => {
      const response = await request(app).get("/projects/recent-entries").set(authed());
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.entries)).toBe(true);
    });
  });
});
