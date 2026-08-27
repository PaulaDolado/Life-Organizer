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
  reminderMinutesBefore: number[];
  guests: string[];
  // Solo en ocurrencias recurrentes: horario "natural" (sin excepción) de esta ocurrencia —
  // necesario para crear/editar la excepción de ESTA ocurrencia concreta (ver EventException).
  originalStartTime?: string;
  isException?: boolean;
  exceptionStatus?: "moved";
}

export interface AgendaResponse {
  week?: string;
  date?: string;
  month?: string;
  weekStart?: string;
  weekEnd?: string;
  monthStart?: string;
  monthEnd?: string;
  timezone: string;
  events: Event[];
  pagination: Pagination;
}

export interface FreeBlock {
  start: string;
  end: string;
  durationMinutes: number;
}

export interface FreeTimeSuggestion {
  block: { start: string; end: string };
  task: { id: number; title: string; estimatedMinutes: number };
}

export interface FreeTimeResponse {
  date: string;
  timezone: string;
  freeBlocks: FreeBlock[];
  suggestions: FreeTimeSuggestion[];
}

export interface Habit {
  id: number;
  title: string;
  streak: number;
  completedDates: string[]; // YYYY-MM-DD, últimos 30 días con marca
}

export interface Note {
  id: number;
  content: string;
  checked: boolean;
  createdAt: string;
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Subtask {
  id: number;
  title: string;
  completed: boolean;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  order: number;
  dueDate: string | null;
  tags: string[];
  estimatedMinutes: number | null;
  actualMinutes: number;
  projectId: number | null;
  subtasks: Subtask[];
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
  type: "event_reminder" | "goal_at_risk" | "task_due";
  title: string;
  message: string;
  relatedId: number | null;
  read: boolean;
  createdAt: string;
}

export interface RecentProjectEntry {
  id: number;
  projectId: number;
  projectTitle: string;
  pageTitle: string;
  preview: string;
  updatedAt: string;
}

export interface TodayResponse {
  date: string;
  timezone: string;
  events: Event[];
  tasksDueToday: Task[];
  habits: Habit[];
  notes: Note[];
  recentProjectEntries: RecentProjectEntry[];
  combinedStreak: number;
}

export interface SearchResults {
  query: string;
  events: { id: number; title: string; startTime: string; isRecurring: boolean }[];
  tasks: { id: number; title: string; status: TaskStatus }[];
  notes: { id: number; content: string }[];
  projects: { id: number; title: string; status: Project["status"] }[];
}

export interface IcsImportResult {
  created: number;
  skippedUnparsable: number;
  importedAsSingleOccurrence: number;
}
