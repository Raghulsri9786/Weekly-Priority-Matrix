

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { getPlanById, updatePlanById } from '../services/firebase';
import { WeeklyPlan, UserPlan, EMPTY_PLAN } from '../types';

const WeeklyPlanPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [userData, setUserData] = useState<UserPlan | null>(null);
  const [plan, setPlan] = useState<WeeklyPlan>(EMPTY_PLAN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');

  // Fix: Cast keyof WeeklyPlan to string to ensure it is assignable to Key and ReactNode
  const days: (keyof WeeklyPlan & string)[] = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];

  useEffect(() => {
    const fetchPlan = async () => {
      if (!id) return;
      try {
        // Fix: Cast returned data to UserPlan for proper state management
        const data = await getPlanById(id) as unknown as UserPlan;
        if (data) {
          setUserData(data);
          setPlan(data.plan);
        }
      } catch (err) { console.error(err); } 
      finally { setLoading(false); }
    };
    fetchPlan();
  }, [id]);

  useEffect(() => {
    if (!loading && userData) {
      gsap.from(".day-card", {
        opacity: 0,
        y: 30,
        stagger: 0.08,
        duration: 0.8,
        ease: "power3.out"
      });
    }
  }, [loading, userData]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updatePlanById(id, plan);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) { alert(err); } 
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617]">
      <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617]">
      <header className="sticky top-0 z-50 glass-card border-b border-slate-800/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div>
              <h2 className="text-sm font-black text-white">{userData?.name}'s Roadmap</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">Session Active</span>
                <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                <span className="text-[10px] font-bold text-slate-500 truncate max-w-[100px]">{id}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <AnimatePresence>
              {saveStatus === 'success' && (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-green-400 text-[10px] font-black uppercase tracking-widest">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Sync Complete
                </motion.div>
              )}
            </AnimatePresence>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                saving ? 'bg-slate-800 text-slate-500' : 'bg-white text-black hover:bg-slate-200'
              }`}
            >
              {saving ? 'Syncing...' : 'Save Roadmap'}
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {days.map((day) => (
            <div key={day} className="day-card group glass-card rounded-3xl p-8 hover:border-blue-500/50 transition-all flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover:text-blue-400 transition-colors">{day}</span>
                <div className="w-2 h-2 rounded-full bg-slate-800 group-focus-within:bg-blue-500 transition-colors"></div>
              </div>
              <textarea
                value={plan[day]}
                onChange={(e) => setPlan(prev => ({ ...prev, [day]: e.target.value }))}
                placeholder="Key objectives..."
                className="flex-grow w-full bg-transparent text-slate-200 text-sm font-medium leading-relaxed outline-none resize-none custom-scrollbar placeholder-slate-700"
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default WeeklyPlanPage;
