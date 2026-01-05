import React, { useState, useEffect, useMemo } from 'react';
import { DayOfWeek, PlannerRow, HistoryEntry, PriorityGroup, DayState } from './types';
import { EditableCell } from './components/EditableCell';
import { fixSpelling } from './services/geminiService';
import { ChatBot } from './components/ChatBot';

const createEmptyDays = (): Record<DayOfWeek, DayState> => ({
  [DayOfWeek.Monday]: { text: '', completed: false },
  [DayOfWeek.Tuesday]: { text: '', completed: false },
  [DayOfWeek.Wednesday]: { text: '', completed: false },
  [DayOfWeek.Thursday]: { text: '', completed: false },
  [DayOfWeek.Friday]: { text: '', completed: false },
});

const INITIAL_ROWS: PlannerRow[] = [
  { id: '1', priorityGroup: 'P1', effortLabel: '50% E', label: 'Primary Goal 1', days: createEmptyDays() },
  { id: '2', priorityGroup: 'P2', effortLabel: '30% E', label: 'Secondary Goal 1', days: createEmptyDays() },
  { id: '3', priorityGroup: 'P3', effortLabel: '20% E', label: 'Other Task 1', days: createEmptyDays() },
  { id: '4', priorityGroup: 'Meeting', effortLabel: '-', label: 'Recurring Sync', days: createEmptyDays() },
];

const GROUP_CONFIG: Record<PriorityGroup, { label: string; color: string; effort: string }> = {
  P1: { label: 'P1: Primary Goals', color: 'border-l-rose-500 bg-rose-50/30', effort: '50% E' },
  P2: { label: 'P2: Secondary Goals', color: 'border-l-amber-500 bg-amber-50/30', effort: '30% E' },
  P3: { label: 'P3: Others', color: 'border-l-slate-400 bg-slate-50/30', effort: '20% E' },
  Meeting: { label: 'Meetings / Calls', color: 'border-l-blue-400 bg-blue-50/30', effort: '-' },
};

const App: React.FC = () => {
  const getWeekRangeString = (date: Date) => {
    const monday = new Date(date);
    const friday = new Date(date);
    friday.setDate(monday.getDate() + 4);
    const fmt = { month: '2-digit', day: '2-digit' } as const;
    return `[${monday.toLocaleDateString('en-US', fmt)} – ${friday.toLocaleDateString('en-US', fmt)}]`;
  };

  const [rows, setRows] = useState<PlannerRow[]>(() => {
    const saved = localStorage.getItem('matrix_v9_current');
    return saved ? JSON.parse(saved) : INITIAL_ROWS;
  });

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('matrix_v9_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [weekNumber, setWeekNumber] = useState<number>(() => {
    const saved = localStorage.getItem('matrix_v9_week_num');
    return saved ? parseInt(saved) : 1;
  });

  const [weekStart, setWeekStart] = useState<Date>(() => {
    const saved = localStorage.getItem('matrix_v9_date');
    if (saved) return new Date(saved);
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return d;
  });

  const [editableWeekRange, setEditableWeekRange] = useState<string>(() => {
    const saved = localStorage.getItem('matrix_v9_week_range');
    if (saved) return saved;
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return getWeekRangeString(d);
  });

  const [view, setView] = useState<'current' | 'history'>('current');
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('matrix_v9_current', JSON.stringify(rows));
    localStorage.setItem('matrix_v9_history', JSON.stringify(history));
    localStorage.setItem('matrix_v9_week_num', weekNumber.toString());
    localStorage.setItem('matrix_v9_date', weekStart.toISOString());
    localStorage.setItem('matrix_v9_week_range', editableWeekRange);
  }, [rows, history, weekNumber, weekStart, editableWeekRange]);

  const updateRow = (id: string, updates: Partial<PlannerRow>) => {
    if (view !== 'current') return;
    setRows(prev => prev.map(row => row.id === id ? { ...row, ...updates } : row));
  };

  const updateCell = (rowId: string, day: DayOfWeek, updates: Partial<DayState>) => {
    if (view !== 'current') return;
    setRows(prev => prev.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          days: {
            ...row.days,
            [day]: { ...row.days[day], ...updates }
          }
        };
      }
      return row;
    }));
  };

  const handleFixSpelling = async () => {
    if (view !== 'current') return;
    setIsProcessing(true);
    try {
      const newRows = await Promise.all(rows.map(async (row) => {
        const newDays = { ...row.days };
        for (const day of Object.values(DayOfWeek) as DayOfWeek[]) {
          if (newDays[day].text) {
            newDays[day].text = await fixSpelling(newDays[day].text);
          }
        }
        return { ...row, days: newDays };
      }));
      setRows(newRows);
    } finally {
      setIsProcessing(false);
    }
  };

  const startNextWeek = () => {
    const entry: HistoryEntry = {
      id: Math.random().toString(36).substr(2, 9),
      weekNumber: weekNumber,
      weekRange: `Week ${weekNumber} ${editableWeekRange}`,
      timestamp: Date.now(),
      rows: JSON.parse(JSON.stringify(rows))
    };
    setHistory(prev => [entry, ...prev]);

    const nextDate = new Date(weekStart);
    nextDate.setDate(nextDate.getDate() + 7);
    setWeekStart(nextDate);
    setWeekNumber(prev => prev + 1);
    setEditableWeekRange(getWeekRangeString(nextDate));

    const nextRows = rows.map(row => {
      const nextDays = createEmptyDays();
      (Object.values(DayOfWeek) as DayOfWeek[]).forEach(day => {
        if (!row.days[day].completed) {
          nextDays[day] = { ...row.days[day] };
        }
      });
      return { 
        ...row, 
        id: Math.random().toString(36).substr(2, 9),
        days: nextDays 
      };
    });

    setRows(nextRows);
    setView('current');
    setHistoryIndex(0);
  };

  const addRowToGroup = (group: PriorityGroup) => {
    const newRow: PlannerRow = {
      id: Math.random().toString(36).substr(2, 9),
      priorityGroup: group,
      effortLabel: GROUP_CONFIG[group].effort,
      label: 'New Task',
      days: createEmptyDays()
    };
    setRows([...rows, newRow]);
  };

  const filteredHistory = useMemo(() => {
    if (!searchTerm) return history;
    return history.filter(h => 
      h.weekRange.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.rows.some(r => (Object.values(r.days) as DayState[]).some(d => d.text.toLowerCase().includes(searchTerm.toLowerCase())))
    );
  }, [history, searchTerm]);

  const activeHistoryEntry = filteredHistory[historyIndex];
  const displayRows = view === 'current' ? rows : (activeHistoryEntry?.rows || []);

  const planSummary = useMemo(() => {
    return rows.map(r => {
      const tasks = (Object.entries(r.days) as [string, DayState][])
        .filter(([_, d]) => d.text.trim())
        .map(([day, d]) => `${day}: ${d.text} (${d.completed ? 'Done' : 'Pending'})`)
        .join('; ');
      return `[${r.priorityGroup}] ${r.label}: ${tasks || 'No tasks'}`;
    }).join('\n');
  }, [rows]);

  const renderGroupRows = (group: PriorityGroup, isReadOnly: boolean) => {
    const groupRows = displayRows.filter(r => r.priorityGroup === group);
    if (groupRows.length === 0 && isReadOnly) return null;

    return (
      <React.Fragment key={group}>
        <tr className={`border-b border-slate-200 ${GROUP_CONFIG[group].color}`}>
          <td colSpan={8} className="p-2 pl-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-l-4">
            {GROUP_CONFIG[group].label}
          </td>
        </tr>
        {groupRows.map((row) => (
          <tr 
            key={row.id} 
            className="group border-b border-slate-200 transition-all bg-white"
          >
            <td className="p-3 align-top w-[14%] border-l-4 border-l-transparent">
              <input 
                disabled={isReadOnly}
                className="w-full bg-transparent border-none outline-none text-[12px] font-bold text-slate-700 focus:ring-1 focus:ring-blue-400 rounded"
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
              />
              {!isReadOnly && (
                <button 
                  onClick={() => setRows(rows.filter(r => r.id !== row.id))}
                  className="mt-2 text-[8px] font-black uppercase text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 block transition-all no-print"
                >
                  Remove Row
                </button>
              )}
            </td>
            <td className="p-3 align-top text-center border-l border-slate-200/50 w-[10%] text-[11px] font-mono text-slate-400">
              {row.effortLabel}
            </td>
            <td className="p-3 align-top text-center border-l border-slate-200/50 w-[8%] text-[11px] font-black text-slate-600">
              {row.priorityGroup}
            </td>
            {(Object.values(DayOfWeek) as DayOfWeek[]).map((d) => (
              <td key={d} className="p-0 align-top border-l border-slate-200/50">
                <EditableCell 
                  text={row.days[d].text}
                  completed={row.days[d].completed}
                  onTextChange={newText => updateCell(row.id, d, { text: newText })}
                  onToggleComplete={() => updateCell(row.id, d, { completed: !row.days[d].completed })}
                  isReadOnly={isReadOnly}
                />
              </td>
            ))}
          </tr>
        ))}
        {!isReadOnly && (
          <tr className="border-b border-slate-200 bg-white/50 no-print">
            <td colSpan={8} className="p-1">
              <button 
                onClick={() => addRowToGroup(group)}
                className="w-full text-[9px] font-bold text-slate-400 hover:text-blue-500 uppercase tracking-widest py-1 transition-colors"
              >
                + Add row to {group}
              </button>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 selection:bg-blue-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-8 py-4 flex justify-between items-center shadow-sm no-print">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">WEEKLY MATRIX</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Management System v9.0</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setView('current')} className={`px-5 py-2 text-[11px] font-bold rounded-md transition-all ${view === 'current' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Current Plan</button>
            <button onClick={() => setView('history')} className={`px-5 py-2 text-[11px] font-bold rounded-md transition-all ${view === 'history' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Archives</button>
          </div>
        </div>

        {view === 'current' ? (
          <div className="flex items-center gap-4">
            <button onClick={() => setIsAssistantOpen(true)} className="flex items-center gap-2 text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              AI Assistant
            </button>
            <button onClick={handleFixSpelling} disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50">
              {isProcessing ? 'Fixing...' : 'Fix Spelling (Fast)'}
            </button>
            <button onClick={startNextWeek} className="bg-white border border-slate-300 hover:border-slate-800 text-slate-600 px-6 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all">
              Deploy Next Week
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input 
                type="text" 
                placeholder="Search keywords..." 
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-full text-[11px] font-medium outline-none focus:ring-2 focus:ring-indigo-100 w-64"
                value={searchTerm}
                onChange={(e) => {setSearchTerm(e.target.value); setHistoryIndex(0);}}
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-full border border-slate-200">
              <button 
                disabled={historyIndex >= filteredHistory.length - 1}
                onClick={() => setHistoryIndex(prev => prev + 1)}
                className="p-1.5 rounded-full hover:bg-white transition-all disabled:opacity-20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <span className="text-[10px] font-black w-10 text-center text-slate-500">{historyIndex + 1}/{filteredHistory.length || 0}</span>
              <button 
                disabled={historyIndex <= 0}
                onClick={() => setHistoryIndex(prev => prev - 1)}
                className="p-1.5 rounded-full hover:bg-white transition-all disabled:opacity-20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-[1700px] mx-auto p-12 print-container">
        <div className="mb-10 flex justify-between items-end">
          <div className="w-full max-w-xl">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">
              Week {view === 'current' ? weekNumber : (activeHistoryEntry?.weekNumber || 'Archive')}
            </h2>
            {view === 'current' ? (
              <input 
                className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mt-2 bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-200 rounded px-1 w-full"
                value={editableWeekRange}
                onChange={(e) => setEditableWeekRange(e.target.value)}
              />
            ) : (
              <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mt-2 px-1">
                {activeHistoryEntry?.weekRange.split(' ').slice(2).join(' ') || 'Historical Record'}
              </p>
            )}
          </div>
          <div className="text-right text-[10px] font-bold text-slate-300 uppercase tracking-widest no-print">
            {view === 'current' ? 'Live Matrix View' : 'Read-only Archive'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-2xl shadow-slate-200/50 overflow-hidden">
          <table className="w-full text-left border-collapse table-fixed min-w-[1300px]">
            <thead>
              <tr className="bg-slate-900 text-[11px] font-black text-white uppercase tracking-widest">
                <th className="p-4 w-[14%]">Planned / Meeting</th>
                <th className="p-4 w-[10%] text-center">Effort %</th>
                <th className="p-4 w-[8%] text-center">Prio</th>
                {(Object.values(DayOfWeek) as DayOfWeek[]).map(d => (
                  <th key={d} className="p-4 border-l border-slate-700/50">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderGroupRows('P1', view === 'history')}
              {renderGroupRows('P2', view === 'history')}
              {renderGroupRows('P3', view === 'history')}
              {renderGroupRows('Meeting', view === 'history')}
            </tbody>
          </table>
        </div>

        {view === 'history' && filteredHistory.length === 0 && (
          <div className="text-center py-32 bg-white/50 border-2 border-dashed border-slate-200 rounded-xl mt-8">
            <div className="text-slate-300 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">No historical plans found.</p>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 px-8 py-3 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 z-40 no-print">
        <div className="flex gap-10">
          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-rose-50 border border-rose-200 rounded"></span> Red = Pending</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-50 border border-emerald-200 rounded"></span> Green = Completed</div>
          <div className="flex items-center gap-2 text-indigo-500 italic">Hover cell to mark specific day task as done</div>
        </div>
        <div>Matrix v9.0 • AI Strategy Assistant Active</div>
      </footer>

      <ChatBot 
        isOpen={isAssistantOpen} 
        onClose={() => setIsAssistantOpen(false)} 
        planContext={planSummary}
      />
    </div>
  );
};

export default App;