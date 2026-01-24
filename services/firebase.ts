
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDoc, 
  getDocs,
  query,
  doc, 
  setDoc,
  updateDoc,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { PlannerRow, DayOfWeek, DayState, WeeklyPlan, EMPTY_PLAN, HistoryEntry } from '../types';

const firebaseConfig = {
  apiKey: "e7KD4OPCz7tPkw03irlA1s5ItotIGCuSiKAZvRUr",
  authDomain: "weekly-plan-484317.firebaseapp.com",
  projectId: "weekly-plan-484317",
  storageBucket: "weekly-plan-484317.appspot.com",
  messagingSenderId: "484317",
  appId: "1:484317:web:8c5b8e9b0e1a2b3c4d5e6f" 
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const createEmptyDays = (): Record<DayOfWeek, DayState> => ({
  [DayOfWeek.Monday]: { text: '', completed: false },
  [DayOfWeek.Tuesday]: { text: '', completed: false },
  [DayOfWeek.Wednesday]: { text: '', completed: false },
  [DayOfWeek.Thursday]: { text: '', completed: false },
  [DayOfWeek.Friday]: { text: '', completed: false },
});

const INITIAL_ROWS: PlannerRow[] = [
  { id: '1', priorityGroup: 'P1', effortLabel: '50%', label: 'STRATEGIC INITIATIVES', days: createEmptyDays() },
  { id: '2', priorityGroup: 'P2', effortLabel: '30%', label: 'OPERATIONAL TASKS', days: createEmptyDays() },
  { id: '3', priorityGroup: 'P3', effortLabel: '15%', label: 'SUPPORT & AD-HOC', days: createEmptyDays() },
  { id: '4', priorityGroup: 'Meeting', effortLabel: '5%', label: 'ENGAGEMENT & SYNCS', days: createEmptyDays() },
];

export const loginOrRegister = async (name: string, email: string): Promise<string> => {
  const userId = btoa(email.toLowerCase()).replace(/=/g, '');
  const userRef = doc(db, "user_plans", userId);
  
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        name,
        email,
        rows: INITIAL_ROWS,
        plan: EMPTY_PLAN, // Initialize empty roadmap
        lastUpdated: serverTimestamp()
      });
    }
    return userId;
  } catch (err: any) {
    console.error("Firebase Error:", err);
    throw new Error(err.message);
  }
};

export const getPlan = async (userId: string) => {
  const docRef = doc(db, "user_plans", userId);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
};

// New function to fetch all plans for user-grouped archives
export const getAllPlans = async () => {
  const q = query(collection(db, "user_plans"));
  const querySnapshot = await getDocs(q);
  const plans: any[] = [];
  querySnapshot.forEach((doc) => {
    plans.push({ id: doc.id, ...doc.data() });
  });
  return plans;
};

// Export getPlanById as an alias to getPlan
export const getPlanById = getPlan;

// Modified to support history persistence
export const updatePlan = async (userId: string, rows: PlannerRow[], history?: HistoryEntry[]) => {
  const docRef = doc(db, "user_plans", userId);
  const data: any = { rows, lastUpdated: serverTimestamp() };
  if (history) data.history = history;
  await updateDoc(docRef, data);
};

// Export updatePlanById specifically for updating the WeeklyPlan object
export const updatePlanById = async (userId: string, plan: WeeklyPlan) => {
  const docRef = doc(db, "user_plans", userId);
  await updateDoc(docRef, { plan, lastUpdated: serverTimestamp() });
};
