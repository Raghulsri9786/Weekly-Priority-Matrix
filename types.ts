export enum DayOfWeek {
  Monday = 'Monday',
  Tuesday = 'Tuesday',
  Wednesday = 'Wednesday',
  Thursday = 'Thursday',
  Friday = 'Friday'
}

export type PriorityGroup = 'P1' | 'P2' | 'P3' | 'Meeting';

export interface DayState {
  text: string;
  completed: boolean;
}

export interface PlannerRow {
  id: string;
  priorityGroup: PriorityGroup;
  effortLabel: string; // e.g., "50% E"
  label: string; // Sub-label or task title
  days: Record<DayOfWeek, DayState>;
}

export interface HistoryEntry {
  id: string;
  weekNumber: number;
  weekRange: string;
  timestamp: number;
  rows: PlannerRow[];
}

export interface UserSettings {
  userName: string;
  companyEmail: string;
  devOpsPat: string;
  organization: string;
  project: string;
  corsProxy?: string;
}