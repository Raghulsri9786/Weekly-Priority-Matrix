
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
  effortLabel: string; 
  label: string; 
  days: Record<DayOfWeek, DayState>;
}

export interface HistoryStats {
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  distribution: Record<PriorityGroup, number>;
}

export interface HistoryEntry {
  id: string;
  weekNumber: number;
  weekRange: string;
  timestamp: number;
  rows: PlannerRow[];
  stats: HistoryStats;
}

export interface UserSettings {
  userName: string;
  companyEmail: string;
  devOpsPat: string;
  organization: string;
  project: string;
  corsProxy?: string;
  useProxy?: boolean;
}

export interface DevOpsFeature {
  id: number;
  title: string;
  priority: number;
  state: string;
  assignedTo: string;
  comments: string[];
  status?: {
    summary: string;
    completed: string[];
    next: string[];
  };
}

// Added missing types for roadmap functionality
export interface WeeklyPlan {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

// Added missing constant for initializing a new user's roadmap
export const EMPTY_PLAN: WeeklyPlan = {
  monday: '',
  tuesday: '',
  wednesday: '',
  thursday: '',
  friday: '',
  saturday: '',
  sunday: '',
};

// Added UserPlan interface to represent the full data structure in Firestore
export interface UserPlan {
  name: string;
  email: string;
  rows: PlannerRow[];
  history?: HistoryEntry[]; // Added history support for persistence
  plan: WeeklyPlan;
  lastUpdated: any;
}
