export interface User {
  id: number;
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface Event {
  id: number;
  title: string;
  description: string | null;
  type: string;
  startTime: string;
  endTime: string;
  location: string | null;
}

export interface AgendaWeekResponse {
  week: string;
  weekStart: string;
  weekEnd: string;
  events: Event[];
}

export interface Goal {
  id: number;
  title: string;
  description: string | null;
  period: "weekly" | "monthly";
  targetValue: number;
  currentValue: number;
  completed: boolean;
  bonusPoints: number;
  periodStart: string;
  periodEnd: string;
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

export interface ProjectTask {
  id: number;
  title: string;
  completed: boolean;
}

export interface Project {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  tasks?: ProjectTask[];
  progress?: { total: number; completed: number; percent: number };
}

export interface Hobby {
  id: number;
  name: string;
  category: string;
  description: string | null;
}
