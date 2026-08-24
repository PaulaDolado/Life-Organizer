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
        .set(authed());

      const progress = await request(app).get(`/projects/${project.body.id}/progress`).set(authed());
      expect(progress.status).toBe(200);
      expect(progress.body.total).toBe(2);
      expect(progress.body.completed).toBe(1);
      expect(progress.body.percent).toBe(50);

      const detail = await request(app).get(`/projects/${project.body.id}`).set(authed());
      expect(detail.body.tasks).toHaveLength(2);
      expect(detail.body.progress.percent).toBe(50);
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
});
