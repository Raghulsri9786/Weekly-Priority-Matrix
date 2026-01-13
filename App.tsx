
import React, { useState, useEffect, useMemo } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { DayOfWeek, PlannerRow, HistoryEntry, PriorityGroup, UserSettings, DevOpsFeature, HistoryStats, DayState } from './types';
import { EditableCell } from './components/EditableCell';
import { ChatBot } from './components/ChatBot';
import * as XLSX from 'xlsx';

const INITIAL_ROWS: PlannerRow[] = [
  { id: '1', priorityGroup: 'P1', effortLabel: '50%', label: 'TOP STRATEGIC PRIORITY', days: createEmptyDays() },
  { id: '2', priorityGroup: 'P2', effortLabel: '30%', label: 'OPERATIONAL GOALS', days: createEmptyDays() },
  { id: '3', priorityGroup: 'P3', effortLabel: '20%', label: 'SUPPORTING TASKS', days: createEmptyDays() },
  { id: '4', priorityGroup: 'Meeting', effortLabel: '-', label: 'COLLABORATION & SYNCS', days: createEmptyDays() },
];

const PRIORITY_ORDER: PriorityGroup[] = ['P1', 'P2', 'P3', 'Meeting'];

function createEmptyDays(): Record<DayOfWeek, DayState> {
  const days: any = {};
  Object.values(DayOfWeek).forEach(d => days[d] = { text: '', completed: false });
  return days;
}

const getDefaultDates = () => {
  const today = new Date();
  const day = today.getDay();
  // Monday of current week
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  // Friday of current week
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  
  return {
    start: monday.toISOString().split('T')[0],
    end: friday.toISOString().split('T')[0]
  };
};

const App: React.FC = () => {
  const [rows, setRows] = useState<PlannerRow[]>(() => {
    const saved = localStorage.getItem('matrix_pro_v12_rows');
    return saved ? JSON.parse(saved) : INITIAL_ROWS;
  });
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('matrix_pro_v12_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [startDate, setStartDate] = useState<string>(() => {
    return localStorage.getItem('matrix_pro_v12_start_date') || getDefaultDates().start;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return localStorage.getItem('matrix_pro_v12_end_date') || getDefaultDates().end;
  });

  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('matrix_pro_v12_settings');
    const defaults = { 
      userName: '', companyEmail: '', devOpsPat: '', 
      organization: 'Aptean', project: 'EDIOne', 
      corsProxy: 'https://corsproxy.io/?url=', useProxy: true 
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  const [features, setFeatures] = useState<DevOpsFeature[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFeatureDrawerOpen, setIsFeatureDrawerOpen] = useState(true);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Feature filtering states
  const [featureSearchTerm, setFeatureSearchTerm] = useState('');
  const [showOnlyMyFeatures, setShowOnlyMyFeatures] = useState(false);

  const [view, setView] = useState<'current' | 'history'>('current');
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  
  const [syncLogs, setSyncLogs] = useState<{msg: string, type: 'info' | 'error' | 'success'}[]>([]);
  const [showSyncLog, setShowSyncLog] = useState(false);

  // Drag and Drop Visual States
  const [draggingFeatureId, setDraggingFeatureId] = useState<number | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{rowId: string, day: DayOfWeek} | null>(null);

  useEffect(() => {
    localStorage.setItem('matrix_pro_v12_rows', JSON.stringify(rows));
    localStorage.setItem('matrix_pro_v12_history', JSON.stringify(history));
    localStorage.setItem('matrix_pro_v12_settings', JSON.stringify(settings));
    localStorage.setItem('matrix_pro_v12_start_date', startDate);
    localStorage.setItem('matrix_pro_v12_end_date', endDate);
  }, [rows, history, settings, startDate, endDate]);

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setSyncLogs(prev => [...prev, { msg, type }]);
  };

  const safeFetch = async (url: string, options: RequestInit) => {
    let finalUrl = url;
    if (settings.useProxy && settings.corsProxy) {
      const proxyBase = settings.corsProxy.trim();
      const separator = proxyBase.endsWith('=') || proxyBase.endsWith('?') ? '' : 
                        (proxyBase.includes('?') ? '&url=' : '?url=');
      finalUrl = `${proxyBase}${separator}${encodeURIComponent(url)}`;
    } else if (!settings.useProxy) {
        addLog("Warning: Fetching without proxy. This will likely fail due to CORS in a browser.", 'error');
    }

    try {
      const headers = {
        ...options.headers,
        'Accept': 'application/json',
      };

      const res = await fetch(finalUrl, {
        ...options,
        headers,
        mode: 'cors',
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.substring(0, 150) || res.statusText}`);
      }
      return await res.json();
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
        throw new Error("Network Error. Likely CORS block or Proxy failure. Check your Proxy URL and ensure it supports forwarding Authorization headers.");
      }
      throw e;
    }
  };

  const handleSync = async () => {
    const pat = settings.devOpsPat.trim();
    const org = settings.organization.trim();
    const proj = settings.project.trim();
    const email = settings.companyEmail.trim();

    if (!pat || !org || !proj) {
      addLog("Sync failed: Check Organization, Project, and PAT in settings.", "error");
      setShowSyncLog(true);
      setIsSettingsOpen(true);
      return;
    }
    
    setIsSyncing(true);
    setShowSyncLog(true);
    setSyncLogs([]);
    addLog(`Syncing features for workspace...`, 'info');

    try {
      const authHeader = `Basic ${btoa(`:${pat}`)}`;
      const wiqlUrl = `https://dev.azure.com/${org}/${proj}/_apis/wit/wiql?api-version=6.0`;
      
      // Removed server-side filtering by AssignedTo to allow UI-only filter to work as expected
      let query = `SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.WorkItemType] = 'Feature' AND [System.State] NOT IN ('Closed', 'Removed')`;

      addLog(`Connecting to Azure DevOps API...`, 'info');
      const wiqlResult = await safeFetch(wiqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ query })
      });

      const ids = (wiqlResult.workItems || []).slice(0, 100).map((wi: any) => wi.id);
      
      if (ids.length > 0) {
        addLog(`Hydrating details for ${ids.length} work items...`, 'info');
        const batchUrl = `https://dev.azure.com/${org}/${proj}/_apis/wit/workitemsbatch?api-version=6.0`;
        const batchData = await safeFetch(batchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
          body: JSON.stringify({ 
            ids, 
            fields: ["System.Id", "System.Title", "Microsoft.VSTS.Common.Priority", "System.State", "System.AssignedTo"] 
          })
        });
        
        const hydratedFeatures = await Promise.all(batchData.value.map(async (f: any) => {
          const featureId = f.fields["System.Id"];
          let rawComments: string[] = [];
          try {
            const commentsUrl = `https://dev.azure.com/${org}/${proj}/_apis/wit/workitems/${featureId}/comments?api-version=6.0`;
            const cRes = await safeFetch(commentsUrl, { 
              method: 'GET',
              headers: { 'Authorization': authHeader } 
            });
            rawComments = (cRes.comments || []).map((c: any) => c.text.replace(/<[^>]*>?/gm, ''));
          } catch (e: any) {
            console.warn(`Comments fetch failed for #${featureId}`, e);
          }

          const assignedToRaw = f.fields["System.AssignedTo"];
          let assignedTo = "Unassigned";
          if (assignedToRaw) {
            if (typeof assignedToRaw === 'string') {
              assignedTo = assignedToRaw;
            } else if (typeof assignedToRaw === 'object') {
              const dn = assignedToRaw.displayName || "";
              const un = assignedToRaw.uniqueName || assignedToRaw.email || assignedToRaw.id || "";
              assignedTo = un ? `${dn} <${un}>` : dn;
            }
          }

          return {
            id: featureId,
            title: f.fields["System.Title"] || "Untitled",
            priority: f.fields["Microsoft.VSTS.Common.Priority"] || 3,
            state: f.fields["System.State"] || "Unknown",
            assignedTo: assignedTo,
            comments: rawComments
          };
        }));

        setFeatures(hydratedFeatures);
        addLog(`Successfully synced ${hydratedFeatures.length} features.`, "success");
      } else {
        addLog("No active features found.", "info");
      }
    } catch (e: any) {
      addLog(`Sync failed: ${e.message}`, "error");
      console.error("Sync Error Detail:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const calculateStats = (matrixRows: PlannerRow[]): HistoryStats => {
    let totalTasks = 0;
    let completedTasks = 0;
    const distribution: Record<PriorityGroup, number> = { P1: 0, P2: 0, P3: 0, Meeting: 0 };

    matrixRows.forEach(row => {
      Object.values(row.days).forEach(day => {
        if (day.text.trim()) {
          totalTasks++;
          distribution[row.priorityGroup]++;
          if (day.completed) completedTasks++;
        }
      });
    });

    return {
      totalTasks,
      completedTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      distribution
    };
  };

  const archiveWeek = () => {
    const stats = calculateStats(rows);
    const rangeLabel = `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
    const entry: HistoryEntry = {
      id: Math.random().toString(36).substr(2, 9),
      weekNumber: history.length + 1,
      weekRange: rangeLabel,
      timestamp: Date.now(),
      rows: JSON.parse(JSON.stringify(rows)),
      stats
    };
    setHistory([entry, ...history]);
    setHistoryIndex(0);
    
    setRows(prevRows => prevRows.map(row => ({
      ...row,
      days: Object.entries(row.days).reduce((acc, [day, state]) => {
        acc[day as DayOfWeek] = state.completed ? { text: '', completed: false } : state;
        return acc;
      }, {} as Record<DayOfWeek, DayState>)
    })));
    
    const newDates = getDefaultDates();
    setStartDate(newDates.start);
    setEndDate(newDates.end);

    alert(`Week snapshot "${rangeLabel}" deployed to archive. Non-completed tasks carried forward.`);
  };

  const addRow = (priorityGroup: PriorityGroup) => {
    const newRow: PlannerRow = {
      id: Math.random().toString(36).substr(2, 9),
      priorityGroup,
      effortLabel: priorityGroup === 'Meeting' ? '-' : '10%',
      label: 'NEW TASK',
      days: createEmptyDays()
    };
    setRows(prev => [...prev, newRow]);
  };

  const removeRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  const exportExcel = () => {
    const data = rows.map(r => ({
      Category: r.label,
      Effort: r.effortLabel,
      Priority: r.priorityGroup,
      ...Object.keys(r.days).reduce((acc: any, day: any) => {
        acc[day] = r.days[day as DayOfWeek].text;
        return acc;
      }, {})
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MatrixPlan");
    XLSX.writeFile(wb, "Weekly_Plan_Export.xlsx");
  };

  const filteredRows = useMemo(() => {
    const activeRows = view === 'current' ? rows : (history[historyIndex]?.rows || []);
    if (!searchTerm) return activeRows;
    return activeRows.filter(r => r.label.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [rows, history, historyIndex, view, searchTerm]);

  const filteredFeatures = useMemo(() => {
    const term = featureSearchTerm.toLowerCase();
    let filtered = features.filter(f => 
      (f.title || "").toLowerCase().includes(term) || (f.id || "").toString().includes(term)
    );
    
    if (showOnlyMyFeatures) {
      const email = (settings.companyEmail || "").toLowerCase().trim();
      const name = (settings.userName || "").toLowerCase().trim();
      
      if (email || name) {
        filtered = filtered.filter(f => {
          const assigned = String(f.assignedTo || "").toLowerCase();
          return (email && assigned.includes(email)) || (name && assigned.includes(name));
        });
      }
    }
    
    return [...filtered].sort((a, b) => a.priority - b.priority);
  }, [features, featureSearchTerm, showOnlyMyFeatures, settings.companyEmail, settings.userName]);

  const currentHistoryStats = useMemo(() => {
    if (view === 'history' && history[historyIndex]) {
      return history[historyIndex].stats;
    }
    return null;
  }, [history, historyIndex, view]);

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
      {/* SaaS Sidebar */}
      <aside className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-30 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-100">M</div>
          {isSidebarOpen && <span className="font-black text-lg tracking-tight uppercase">Matrix<span className="text-blue-600">Pro</span></span>}
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setView('current')} className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${view === 'current' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
            <span className="text-xl">📅</span>
            {isSidebarOpen && <span className="text-[11px] uppercase tracking-widest font-black">Planner</span>}
          </button>
          
          <div className="pt-4 pb-2">
            <p className="px-3 mb-2 text-[9px] font-black uppercase text-slate-400 tracking-widest">{isSidebarOpen ? 'Archive History' : '📁'}</p>
            {history.length > 0 ? (
              <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar px-1">
                {history.map((entry, idx) => (
                  <button 
                    key={entry.id} 
                    onClick={() => { setView('history'); setHistoryIndex(idx); }}
                    className={`w-full text-left p-3 rounded-xl transition-all border ${view === 'history' && historyIndex === idx ? 'bg-white border-slate-200 shadow-sm text-blue-600' : 'border-transparent text-slate-400 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📁</span>
                      {isSidebarOpen && (
                        <div className="flex-1 truncate">
                          <p className="text-[10px] font-black uppercase tracking-tighter truncate">{entry.weekRange}</p>
                          <p className="text-[8px] font-bold opacity-60">ID: {entry.id.toUpperCase()}</p>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              isSidebarOpen && <p className="px-3 text-[10px] italic text-slate-300">No archives yet.</p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-50">
            <button onClick={() => setIsSettingsOpen(true)} className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all text-slate-400 hover:bg-slate-50 hover:text-slate-600`}>
              <span className="text-xl">⚙️</span>
              {isSidebarOpen && <span className="text-[11px] uppercase tracking-widest font-black">Settings</span>}
            </button>
          </div>
        </nav>
        
        <div className="p-4 bg-slate-50 m-4 rounded-2xl border border-slate-100">
          {isSidebarOpen ? (
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Active Environment</p>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-900 truncate">{settings.companyEmail || 'No Identity'}</p>
                <p className="text-[8px] font-medium text-slate-400 uppercase tracking-tighter mt-1">{settings.organization} / {settings.project}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center text-slate-300">🏢</div>
          )}
        </div>
      </aside>

      {/* Main Board Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]/30 overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between z-20 sticky top-0">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">
                {view === 'current' ? 'Weekly Matrix Board' : 'Archive Snapshot'}
              </h2>
              {view === 'history' && (
                <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded shadow-lg animate-pulse">Immutable Artifact</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Search plan context..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-10 pr-4 py-2.5 bg-slate-100/80 border-transparent rounded-full text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 w-72 transition-all border group-hover:border-slate-200" 
              />
              <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            
            <div className="h-8 w-px bg-slate-200 mx-2" />
            
            {view === 'current' ? (
              <>
                <button onClick={handleSync} disabled={isSyncing} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSyncing ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-100'}`}>
                  {isSyncing ? 'Syncing...' : 'Sync Features'}
                </button>
                <button onClick={exportExcel} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-all shadow-sm" title="Export Excel">📊</button>
              </>
            ) : (
               <button onClick={() => setView('current')} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Return to Live</button>
            )}
            
            <button onClick={() => setIsAssistantOpen(true)} className="flex items-center gap-2 p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg text-xs font-black uppercase tracking-widest px-4">
              <span className="text-blue-400">✨</span> Strategy
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex relative">
          <div className="flex-1 overflow-auto p-8 custom-scrollbar">
            <div className="max-w-[1700px] mx-auto space-y-6 pb-32">
              <div className="flex flex-col gap-6 border-b border-slate-200 pb-6">
                <div className="flex items-end justify-between">
                  <div className="flex-1">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                      {view === 'current' ? 'Productivity Matrix' : `Archive: ${history[historyIndex]?.weekRange}`}
                    </h3>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workload Balance • </p>
                      {view === 'current' ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50/50 border-none rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                          />
                          <span className="text-[10px] font-black text-slate-300">TO</span>
                          <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50/50 border-none rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                          />
                        </div>
                      ) : (
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Artifact Signature: {history[historyIndex]?.id.toUpperCase()}
                        </p>
                      )}
                    </div>
                  </div>
                  {view === 'current' && (
                    <button onClick={archiveWeek} className="px-8 py-3.5 bg-emerald-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all active:scale-95">Deploy Next Week</button>
                  )}
                </div>

                {view === 'history' && currentHistoryStats && (
                  <div className="grid grid-cols-4 gap-4 animate-in slide-in-from-top-4 duration-500">
                    <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Velocity</p>
                        <p className="text-2xl font-black text-slate-900">{currentHistoryStats.completionRate}%</p>
                      </div>
                      <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-bold text-sm">✓</div>
                    </div>
                    <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">P1 Density</p>
                        <p className="text-2xl font-black text-slate-900">{currentHistoryStats.distribution.P1}</p>
                      </div>
                      <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 font-bold text-sm">!!</div>
                    </div>
                    <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Payload</p>
                        <p className="text-2xl font-black text-slate-900">{currentHistoryStats.totalTasks}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">Σ</div>
                    </div>
                    <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Completion</p>
                        <p className="text-2xl font-black text-slate-900">{currentHistoryStats.completedTasks}</p>
                      </div>
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-900 font-bold text-sm">{currentHistoryStats.completedTasks}/{currentHistoryStats.totalTasks}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-200 overflow-hidden border-t-8 border-t-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[1200px]">
                    <thead>
                      <tr className="bg-[#0f172a] text-white">
                        <th className="p-6 text-left w-64 border-r border-slate-800 uppercase text-[10px] font-black tracking-[0.2em]">Activity Layer</th>
                        <th className="p-6 text-center w-24 border-r border-slate-800 uppercase text-[10px] font-black tracking-[0.2em]">Target %</th>
                        <th className="p-6 text-center w-32 border-r border-slate-800 uppercase text-[10px] font-black tracking-[0.2em]">Status</th>
                        {Object.values(DayOfWeek).map(day => (
                          <th key={day} className="p-6 text-center border-r border-slate-800 last:border-r-0 uppercase text-[10px] font-black tracking-[0.2em]">{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PRIORITY_ORDER.map(group => {
                        const sectionRows = filteredRows.filter(r => r.priorityGroup === group);
                        return (
                          <React.Fragment key={group}>
                            <tr className="bg-slate-100/50 border-b border-slate-200">
                              <td colSpan={8} className="px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${
                                    group === 'P1' ? 'bg-rose-600' :
                                    group === 'P2' ? 'bg-amber-500' :
                                    group === 'P3' ? 'bg-slate-400' : 'bg-emerald-500'
                                  }`}></span>
                                  {group} PRIORITY SECTION
                                </div>
                              </td>
                            </tr>
                            {sectionRows.map((row) => (
                              <tr key={row.id} className="border-b border-slate-100 transition-colors group/row">
                                <td className="p-6 align-top border-r border-slate-100 bg-slate-50/20">
                                  <div className="flex items-center justify-between mb-2">
                                     <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                                        row.priorityGroup === 'P1' ? 'bg-rose-600 text-white shadow-sm shadow-rose-200' : 
                                        row.priorityGroup === 'P2' ? 'bg-amber-500 text-white shadow-sm shadow-amber-200' : 
                                        row.priorityGroup === 'Meeting' ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' : 'bg-slate-400 text-white'
                                      }`}>{row.priorityGroup}</span>
                                      {view === 'current' && (
                                        <button onClick={() => removeRow(row.id)} className="text-[8px] font-black uppercase text-slate-300 hover:text-rose-500 opacity-0 group-hover/row:opacity-100 transition-opacity">Remove</button>
                                      )}
                                  </div>
                                  <div contentEditable={view === 'current'} onBlur={(e) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, label: e.currentTarget.innerText } : r))} className="text-sm font-black text-slate-800 outline-none uppercase tracking-tight leading-tight" suppressContentEditableWarning>{row.label}</div>
                                </td>
                                <td className="p-6 text-center text-[12px] font-mono font-black text-slate-400 border-r border-slate-100 bg-slate-50/10 italic">{row.effortLabel}</td>
                                <td className="p-6 text-center border-r border-slate-100">
                                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                    row.priorityGroup === 'P1' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                    row.priorityGroup === 'P2' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                    row.priorityGroup === 'Meeting' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                                  }`}>{row.priorityGroup}</span>
                                </td>
                                {Object.values(DayOfWeek).map(day => (
                                  <td key={day} className={`p-0 align-top h-full border-r border-slate-100 last:border-r-0 transition-all duration-300 relative ${dragOverCell?.rowId === row.id && dragOverCell?.day === day ? 'bg-blue-50/60 ring-4 ring-inset ring-blue-500/30' : ''}`} onDragOver={e => e.preventDefault()} onDragEnter={() => setDragOverCell({ rowId: row.id, day })} onDragLeave={() => setDragOverCell(null)} onDrop={e => {
                                      setDragOverCell(null); setDraggingFeatureId(null);
                                      try {
                                        const data = JSON.parse(e.dataTransfer.getData('application/json'));
                                        const finalContent = `[#${data.id}] ${data.title}`;
                                        setRows(prev => prev.map(r => r.id === row.id ? { ...r, days: { ...r.days, [day]: { ...r.days[day], text: finalContent } } } : r));
                                      } catch (err) { console.error("Drop Error", err); }
                                    }}><EditableCell text={row.days[day].text} completed={row.days[day].completed} onTextChange={(text) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, days: { ...r.days, [day]: { ...r.days[day], text } } } : r))} onToggleComplete={() => setRows(prev => prev.map(r => r.id === row.id ? { ...r, days: { ...r.days, [day]: { ...r.days[day], completed: !r.days[day].completed } } } : r))} isReadOnly={view !== 'current'} /></td>
                                ))}
                              </tr>
                            ))}
                            {view === 'current' && (
                              <tr className="border-b border-slate-200">
                                <td colSpan={8} className="p-0">
                                  <button onClick={() => addRow(group)} className="w-full py-3 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 border-none outline-none"><span className="text-sm font-light">+</span> Add row to {group}</button>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {isFeatureDrawerOpen && view === 'current' && (
            <aside className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-2xl z-40 animate-in slide-in-from-right duration-500">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">DevOps Workspace</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Available Features</p>
                </div>
                <button onClick={() => setIsFeatureDrawerOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-all">✕</button>
              </div>

              <div className="p-4 bg-white border-b border-slate-100 space-y-3">
                <div className="relative">
                  <input type="text" placeholder="Search features by title..." value={featureSearchTerm} onChange={(e) => setFeatureSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-100/50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all" />
                  <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={showOnlyMyFeatures} onChange={(e) => setShowOnlyMyFeatures(e.target.checked)} />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Show only my features</span>
                </label>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 custom-scrollbar">
                {filteredFeatures.length > 0 ? filteredFeatures.map(f => (
                  <div key={f.id} draggable onDragStart={(e) => { setDraggingFeatureId(f.id); e.dataTransfer.setData('application/json', JSON.stringify(f)); }} onDragEnd={() => { setDraggingFeatureId(null); setDragOverCell(null); }} className={`bg-white p-5 rounded-3xl border transition-all cursor-grab active:cursor-grabbing ${draggingFeatureId === f.id ? 'border-blue-500 border-dashed opacity-40 scale-95 shadow-inner' : 'border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 hover:translate-y-[-2px]'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">#{f.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${f.priority === 1 ? 'bg-rose-100 text-rose-700' : f.priority === 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>P{f.priority}</span>
                    </div>
                    <p className="text-sm font-black text-slate-800 leading-snug hover:text-blue-600 transition-colors">{f.title}</p>
                    <div className="mt-2 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span><span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">{f.assignedTo}</span></div>
                  </div>
                )) : <div className="py-20 text-center"><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No matching features</p></div>}
              </div>
            </aside>
          )}
        </div>

        {showSyncLog && (
          <div className="fixed bottom-10 left-80 w-[500px] bg-[#0f172a]/95 backdrop-blur-xl text-white rounded-[2rem] shadow-2xl z-[60] overflow-hidden border border-slate-800 animate-in slide-in-from-bottom duration-500 ring-1 ring-white/10">
            <div className="p-4 bg-slate-800/50 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-3"><div className={`w-2 h-2 ${isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'} rounded-full`} /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Environment Sync Logs</span></div>
              <button onClick={() => setShowSyncLog(false)} className="text-[10px] font-black opacity-50 hover:opacity-100 transition-all uppercase">Close</button>
            </div>
            <div className="p-6 max-h-64 overflow-y-auto space-y-3 custom-scrollbar font-mono text-[11px] leading-relaxed">
              {syncLogs.length > 0 ? syncLogs.map((log, i) => (
                <div key={i} className={`flex gap-3 border-l-2 pl-3 transition-all ${log.type === 'error' ? 'text-rose-400 border-rose-500' : log.type === 'success' ? 'text-emerald-400 border-emerald-500' : 'text-blue-300 border-blue-500/50'}`}><span className="opacity-30 whitespace-nowrap">[{new Date().toLocaleTimeString([], {hour12: false})}]</span><span>{log.msg}</span></div>
              )) : <div className="text-slate-500 italic">No activity logs recorded.</div>}
            </div>
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 bg-slate-950 text-white flex justify-between items-center relative"><div><h3 className="text-2xl font-black uppercase tracking-tighter italic">Global Config</h3></div><button onClick={() => setIsSettingsOpen(false)} className="p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all text-xl">✕</button></div>
            <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-white">
              <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Full Name</label><input type="text" value={settings.userName} onChange={e => setSettings({...settings, userName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" placeholder="John Doe" /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Company Email</label><input type="text" value={settings.companyEmail} onChange={e => setSettings({...settings, companyEmail: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" placeholder="user@aptean.com" /></div></div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">DevOps PAT (Token)</label><input type="password" value={settings.devOpsPat} onChange={e => setSettings({...settings, devOpsPat: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" placeholder="••••••••••••••••" /></div>
              <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Organization</label><input type="text" value={settings.organization} onChange={e => setSettings({...settings, organization: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Project Name</label><input type="text" value={settings.project} onChange={e => setSettings({...settings, project: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" /></div></div>
              <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between"><label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Use CORS Proxy</label><button onClick={() => setSettings({...settings, useProxy: !settings.useProxy})} className={`w-12 h-6 rounded-full transition-colors relative ${settings.useProxy ? 'bg-blue-600' : 'bg-slate-200'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.useProxy ? 'left-7' : 'left-1'}`} /></button></div>
                {settings.useProxy && <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Proxy URL</label><input type="text" value={settings.corsProxy} onChange={e => setSettings({...settings, corsProxy: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-mono outline-none" placeholder="https://corsproxy.io/?url=" /></div>}
                <button onClick={() => setIsSettingsOpen(false)} className="w-full py-5 bg-slate-950 text-white rounded-3xl font-black uppercase tracking-[0.2em] hover:bg-slate-900 shadow-2xl transition-all">Save & Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ChatBot isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} planContext={(view === 'current' ? rows : (history[historyIndex]?.rows || [])).map(r => `${r.label}: ${Object.values(r.days).map(d => d.text).join(' | ')}`).join('\n')} userProfile={{ name: settings.userName, email: settings.companyEmail }} />
      <SpeedInsights />
    </div>
  );
};

export default App;
