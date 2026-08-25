// date-fns v3 publica sus tipos vía "exports" condicional en package.json, que el
// resolver clásico de TypeScript (moduleResolution: "node") no lee. Declaramos aquí
// las firmas de las funciones que usamos en el proyecto.
declare module "date-fns" {
  export interface WeekOptions {
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  }

  export function startOfDay(date: Date | number): Date;
  export function endOfDay(date: Date | number): Date;
  export function startOfWeek(date: Date | number, options?: WeekOptions): Date;
  export function endOfWeek(date: Date | number, options?: WeekOptions): Date;
  export function startOfMonth(date: Date | number): Date;
  export function endOfMonth(date: Date | number): Date;
  export function startOfYear(date: Date | number): Date;
  export function endOfYear(date: Date | number): Date;
  export function subMonths(date: Date | number, amount: number): Date;
  export function addWeeks(date: Date | number, amount: number): Date;
  export function addMonths(date: Date | number, amount: number): Date;
  export function addMinutes(date: Date | number, amount: number): Date;
  export function differenceInCalendarDays(dateLeft: Date | number, dateRight: Date | number): number;
  export function differenceInMinutes(dateLeft: Date | number, dateRight: Date | number): number;
  export function isValid(date: unknown): boolean;
  export function parseISO(dateString: string): Date;
}
