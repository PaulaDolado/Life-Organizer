import { Router } from "express";
import authRoutes from "./auth.routes";
import agendaRoutes from "./agenda.routes";
import goalsRoutes from "./goals.routes";
import financeRoutes from "./finance.routes";
import projectsRoutes from "./projects.routes";
import hobbiesRoutes from "./hobbies.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/agenda", agendaRoutes);
router.use("/goals", goalsRoutes);
router.use("/finance", financeRoutes);
router.use("/projects", projectsRoutes);
router.use("/hobbies", hobbiesRoutes);

export default router;
