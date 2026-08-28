import { Router } from "express";
import authRoutes from "./auth.routes";
import agendaRoutes from "./agenda.routes";
import plannerRoutes from "./planner.routes";
import notesRoutes from "./notes.routes";
import habitsRoutes from "./habits.routes";
import goalsRoutes from "./goals.routes";
import financeRoutes from "./finance.routes";
import projectsRoutes from "./projects.routes";
import hobbiesRoutes from "./hobbies.routes";
import notificationsRoutes from "./notifications.routes";
import todayRoutes from "./today.routes";
import searchRoutes from "./search.routes";
import syncRoutes from "./sync.routes";
import linkPreviewRoutes from "./linkPreview.routes";
import scheduleRoutes from "./schedule.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/agenda", agendaRoutes);
router.use("/planner", plannerRoutes);
router.use("/notes", notesRoutes);
router.use("/habits", habitsRoutes);
router.use("/goals", goalsRoutes);
router.use("/finance", financeRoutes);
router.use("/projects", projectsRoutes);
router.use("/hobbies", hobbiesRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/today", todayRoutes);
router.use("/search", searchRoutes);
router.use("/sync", syncRoutes);
router.use("/link-preview", linkPreviewRoutes);
router.use("/schedule", scheduleRoutes);

export default router;
