export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  timezone?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export type EventType = "work" | "study" | "gym" | "meeting" | "free";
export type RecurringPattern = "weekly" | "biweekly" | "monthly";

export interface Event {
  id: number;
  title: string;
  description: string | null;
  type: string;
  startTime: string;
  endTime: string;
  location: string | null;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern | null;
  isRecurringInstance?: boolean;
}

export interface AgendaResponse {
  week?: string;
  date?: string;
  weekStart?: string;
  weekEnd?: string;
  timezone: string;
  events: Event[];
  pagination: Pagination;
}

export interface Note {
  id: number;
  content: string;
  checked: boolean;
  createdAt: string;
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  order: number;
}

export type GoalStatus = "active" | "completed" | "expired" | "all";

export interface Goal {
  id: number;
  title: string;
  description: string | null;
  period: "weekly" | "monthly";
  targetValue: number;
  currentValue: number;
  completed: boolean;
  expired: boolean;
  autoRenew: boolean;
  bonusPoints: number;
  periodStart: string;
  periodEnd: string;
}

export interface Transaction {
  id: number;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  date: string;
}

export interface MonthlyBalance {
  month: number;
  year: number;
  income: number;
  expense: number;
  balance: number;
}

export interface FinanceAnalytics {
  month: number;
  year: number;
  topCategories: { category: string; total: number }[];
  monthlyTrend: MonthlyBalance[];
  projectedAnnual: {
    basedOnMonths: number;
    avgMonthlyBalance: number;
    projectedYearEnd: number;
  };
}

export interface SavingsGoal {
  id: number;
  name: string;
  type: "ahorro" | "inversion";
  targetAmount: number;
  currentAmount: number;
  progressPercent: number;
  stepAmount: number;
  category: string;
  deadline: string | null;
  createdAt: string;
}

export interface ProjectTask {
  id: number;
  title: string;
  completed: boolean;
}

export interface Project {
  id: number;
  title: string;
  description: string | null;
  status: "idea" | "en_curso" | "pausado" | "completado";
  priority: "low" | "medium" | "high";
  deadline: string | null;
  tasks?: ProjectTask[];
  progress?: { total: number; completed: number; percent: number };
}

// Página de la libreta de un proyecto: contenido enriquecido (HTML) al estilo de un documento
// de texto — listas, negrita/cursiva, imágenes embebidas como data URL.
export interface ProjectPage {
  id: number;
  projectId: number;
  title: string;
  content: string;
  order: number;
}

export type HobbyCategory = "reading" | "gaming" | "music" | "sports" | "art";

export interface Hobby {
  id: number;
  name: string;
  category: HobbyCategory;
  description: string | null;
}

export interface HobbySession {
  id: number;
  durationMinutes: number;
  date: string;
  notes: string | null;
}

export interface HobbyAnalytics {
  hobbyId: number;
  totalSessions: number;
  totalMinutes: number;
  totalHours: number;
  recentSessions: HobbySession[];
}

export interface Notification {
  id: number;
  type: "event_reminder" | "goal_at_risk";
  title: string;
  message: string;
  relatedId: number | null;
  read: boolean;
  createdAt: string;
}
