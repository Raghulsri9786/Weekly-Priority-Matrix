
import React, { useState, useEffect, useMemo } from 'react';
import { DayOfWeek, PlannerRow, PriorityGroup, HistoryEntry, DevOpsFeature, UserSettings, HistoryStats, DayState } from './types';
import { EditableCell } from './components/EditableCell';
import { ChatBot } from './components/ChatBot';
import { Login } from './components/Login';
import { getPlan, updatePlan, getAllPlans } from './services/firebase';

const PRIORITY_ORDER: PriorityGroup[] = ['P1', 'P2', 'P3', 'Meeting'];

const App: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('matrix_user_id'));
  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Multi-user Archive states
  const [allUsersPlans, setAllUsersPlans] = useState<any[]>([]);
  const [expandedUserFolderId, setExpandedUserFolderId] = useState<string | null>(null);
  const [selectedHistoryUser, setSelectedHistoryUser] = useState<any>(null);

  // UI States
  const [view, setView] = useState<'current' | 'history'>('current');
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFeatureDrawerOpen, setIsFeatureDrawerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // New state to manage settings visibility
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Manual Date Selection states
  const [startDate, setStartDate] = useState('2026-01-12');
  const [endDate, setEndDate] = useState('2026-01-16');

  // DevOps States
  const [features, setFeatures] = useState<DevOpsFeature[]>([]);
  const [isDevOpsLoading, setIsDevOpsLoading] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('matrix_settings');
    const defaults = {
      userName: '', companyEmail: '', devOpsPat: '',
      organization: 'Aptean', project: 'EDIOne',
      corsProxy: 'https://corsproxy.io/?url=', useProxy: true
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  // Load Data on Login
  useEffect(() => {
    if (userId) {
      localStorage.setItem('matrix_user_id', userId);
      setLoading(true);
      
      Promise.all([getPlan(userId), getAllPlans()]).then(([data, allPlans]) => {
        if (data) {
          setUser(data);
          setRows(data.rows || []);
          if (!data.rows || data.rows.length === 0) {
            setRows([]);
          }
          setHistory(data.history || []);
        }
        setAllUsersPlans(allPlans);
        setLoading(false);
      }).catch(err => {
        console.error("Fetch Error:", err);
        setLoading(false);
      });
    }
  }, [userId]);

  // Sync with Cloud
  const handleCloudSync = async () => {
    if (!userId) return;
    setIsSyncing(true);
    try {
      await updatePlan(userId, rows, history);
      const refreshedAll = await getAllPlans();
      setAllUsersPlans(refreshedAll);
    } catch (e) {
      alert("Sync failed. Check connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper function to calculate productivity metrics for the archive
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

  // Deployment function to capture, archive, and save current week's data
  const handleDeploy = async () => {
    if (!userId) return;
    setIsSyncing(true);
    try {
      const stats = calculateStats(rows);
      const newEntry: HistoryEntry = {
        id: Math.random().toString(36).substr(2, 9),
        weekNumber: history.length + 1,
        weekRange: `${startDate} TO ${endDate}`,
        timestamp: Date.now(),
        rows: JSON.parse(JSON.stringify(rows)),
        stats
      };
      
      const updatedHistory = [newEntry, ...history];
      setHistory(updatedHistory);
      
      const nextWeekRows: PlannerRow[] = rows.map(row => ({
        ...row,
        days: (Object.keys(row.days) as DayOfWeek[]).reduce((acc, day) => {
          const currentDayState = row.days[day];
          acc[day] = currentDayState.completed 
            ? { text: '', completed: false } 
            : { ...currentDayState };
          return acc;
        }, {} as Record<DayOfWeek, DayState>)
      }));

      setRows(nextWeekRows);
      
      await updatePlan(userId, nextWeekRows, updatedHistory);
      
      const refreshedAll = await getAllPlans();
      setAllUsersPlans(refreshedAll);
      
      alert("Week successfully deployed. Incomplete tasks carried forward to next week.");
    } catch (e) {
      console.error("Deployment Error:", e);
      alert("Deployment failed. Check connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const addRow = (group: PriorityGroup) => {
    const newRow: PlannerRow = {
      id: Math.random().toString(36).substr(2, 9),
      priorityGroup: group,
      effortLabel: group === 'Meeting' ? '-' : '10%',
      label: 'New Strategic Priority',
      days: {
        [DayOfWeek.Monday]: { text: '', completed: false },
        [DayOfWeek.Tuesday]: { text: '', completed: false },
        [DayOfWeek.Wednesday]: { text: '', completed: false },
        [DayOfWeek.Thursday]: { text: '', completed: false },
        [DayOfWeek.Friday]: { text: '', completed: false },
      }
    };
    setRows(prev => [...prev, newRow]);
  };

  const syncDevOps = async (isAuto = false) => {
    // Safety check for user profile to prevent null access errors
    if (!user || !user.email) {
      if (!isAuto) alert("Identity not established. Please login again.");
      return;
    }

    // Check for Personal Access Token (PAT) before proceeding with DevOps calls
    if (!settings.devOpsPat) {
      if (!isAuto) {
        alert("Please configure DevOps PAT in settings.");
        setIsSettingsOpen(true);
      }
      return;
    }

    if (isDevOpsLoading) return;

    setIsDevOpsLoading(true);
    if (!isAuto) setIsFeatureDrawerOpen(true);
    
    try {
      // Use configured PAT for Basic Auth (Azure DevOps requirement)
      const authHeader = `Basic ${btoa(`:${settings.devOpsPat}`)}`;
      const url = `https://dev.azure.com/${settings.organization}/${settings.project}/_apis/wit/wiql?api-version=6.0`;
      
      // Ensure the proxy URL is correctly formed and parameters are encoded
      const proxyUrl = settings.useProxy ? `${settings.corsProxy}${encodeURIComponent(url)}` : url;

      // WIQL query restricted specifically to work items assigned to the current user's email
      const wiqlQuery = `SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.WorkItemType] = 'Feature' AND [System.State] <> 'Closed' AND [System.AssignedTo] CONTAINS '${user.email}'`;

      const res = await fetch(proxyUrl, {
        method: 'POST',
        // mode: 'cors' is critical when using proxies to avoid 'Failed to fetch' errors
        mode: 'cors',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': authHeader,
          'Accept': 'application/json'
        },
        body: JSON.stringify({ query: wiqlQuery })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      
      const ids = (data.workItems || []).slice(0, 50).map((wi: any) => wi.id);
      if (ids.length > 0) {
        const batchUrl = `https://dev.azure.com/${settings.organization}/_apis/wit/workitemsbatch?api-version=6.0`;
        const batchProxy = settings.useProxy ? `${settings.corsProxy}${encodeURIComponent(batchUrl)}` : batchUrl;
        
        const details = await fetch(batchProxy, {
          method: 'POST',
          mode: 'cors',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': authHeader,
            'Accept': 'application/json'
          },
          body: JSON.stringify({ ids, fields: ["System.Id", "System.Title", "Microsoft.VSTS.Common.Priority", "System.State"] })
        });

        if (!details.ok) {
          throw new Error(`Batch details failed: ${details.status}`);
        }

        const detailsData = await details.json();

        // Fetch the most recent comment for each work item in the batch
        const featuresWithComments = await Promise.all((detailsData.value || []).map(async (f: any) => {
          const featureId = f.fields["System.Id"];
          let lastComment = "";
          try {
            // Azure DevOps API: Fetching only the latest comment for the feature
            const commentUrl = `https://dev.azure.com/${settings.organization}/${settings.project}/_apis/wit/workitems/${featureId}/comments?$top=1&api-version=6.0-preview.3`;
            const commentProxy = settings.useProxy ? `${settings.corsProxy}${encodeURIComponent(commentUrl)}` : commentUrl;
            const cRes = await fetch(commentProxy, { 
              method: 'GET',
              mode: 'cors',
              headers: { 'Authorization': authHeader, 'Accept': 'application/json' } 
            });
            if (cRes.ok) {
              const cData = await cRes.json();
              if (cData.comments && cData.comments.length > 0) {
                // Remove HTML tags from the comment for clean presentation in the planner
                lastComment = cData.comments[0].text.replace(/<[^>]*>?/gm, '');
              }
            }
          } catch (e) {
            console.error(`Failed to fetch latest comment for feature #${featureId}`, e);
          }

          return {
            id: featureId,
            title: f.fields["System.Title"] || "Untitled",
            priority: f.fields["Microsoft.VSTS.Common.Priority"] || 3,
            state: f.fields["System.State"] || "Unknown",
            assignedTo: user.email,
            // Storing the single latest comment in the comments array to maintain model compatibility
            comments: lastComment ? [lastComment] : []
          };
        }));

        setFeatures(featuresWithComments);
      } else {
        setFeatures([]);
      }
    } catch (e: any) {
      console.error("DevOps Sync Error Detail:", e);
      if (!isAuto) alert(`DevOps Sync Error: ${e.message}. Check your PAT and Proxy settings.`);
    } finally {
      setIsDevOpsLoading(false);
    }
  };

  // Save updated settings to localStorage for persistence
  const saveSettings = (updatedSettings: UserSettings) => {
    setSettings(updatedSettings);
    localStorage.setItem('matrix_settings', JSON.stringify(updatedSettings));
    setIsSettingsOpen(false);
  };

  useEffect(() => {
    const handleFocus = () => {
      if (userId && settings.devOpsPat) {
        syncDevOps(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [userId, settings.devOpsPat]);

  const handleLogout = () => {
    localStorage.removeItem('matrix_user_id');
    setUserId(null);
    setUser(null);
    setRows([]);
    setAllUsersPlans([]);
  };

  const filteredRows = useMemo(() => {
    if (view === 'current') return rows;
    const activeHistory = selectedHistoryUser?.history || [];
    return activeHistory[historyIndex]?.rows || [];
  }, [rows, historyIndex, view, selectedHistoryUser]);

  const searchableRows = useMemo(() => {
    if (!searchTerm) return filteredRows;
    return filteredRows.filter(r => r.label.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [filteredRows, searchTerm]);

  if (!userId) return <Login onLogin={setUserId} />;
  
  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0f172a] text-white">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Initializing Board...</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-['Plus_Jakarta_Sans'] text-slate-900">
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-20'} bg-white border-r border-slate-200 flex flex-col transition-all duration-300 z-30 shrink-0`}>
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-200">M</div>
          {isSidebarOpen && (
            <div className="animate-in fade-in duration-500">
              <span className="font-black text-lg uppercase tracking-tight block leading-none">Matrix<span className="text-blue-600">Pro</span></span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          <button onClick={() => setView('current')} className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${view === 'current' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
            <span className="text-lg">📅</span>
            {isSidebarOpen && <span className="text-[11px] font-black uppercase tracking-widest">Planner</span>}
          </button>
          
          <div className="pt-6">
            <p className="px-4 mb-2 text-[9px] font-black uppercase text-slate-400 tracking-widest">{isSidebarOpen ? 'Archive History' : '📁'}</p>
            {allUsersPlans.length > 0 ? (
              allUsersPlans.map((planUser) => (
                <div key={planUser.id} className="mb-1">
                  <button 
                    onClick={() => setExpandedUserFolderId(expandedUserFolderId === planUser.id ? null : planUser.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-slate-50 ${expandedUserFolderId === planUser.id ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}
                  >
                    <span className="text-lg">{expandedUserFolderId === planUser.id ? '📂' : '📁'}</span>
                    {isSidebarOpen && (
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase truncate">{planUser.name || 'Anonymous'}</p>
                        <p className="text-[8px] text-slate-400 truncate">{planUser.email}</p>
                      </div>
                    )}
                  </button>

                  {isSidebarOpen && expandedUserFolderId === planUser.id && (
                    <div className="ml-8 mt-1 space-y-1 border-l border-slate-100 pl-2 animate-in slide-in-from-top-2 duration-300">
                      {(planUser.history || []).length > 0 ? (
                        planUser.history.map((entry: any, idx: number) => (
                          <button 
                            key={entry.id} 
                            onClick={() => { 
                              setView('history'); 
                              setHistoryIndex(idx); 
                              setSelectedHistoryUser(planUser);
                            }} 
                            className={`w-full text-left p-2 rounded-lg text-[9px] font-bold uppercase transition-all ${view === 'history' && historyIndex === idx && selectedHistoryUser?.id === planUser.id ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {entry.weekRange}
                          </button>
                        ))
                      ) : (
                        <p className="p-2 text-[8px] italic text-slate-300">No archives</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              isSidebarOpen && <p className="px-4 text-[10px] text-slate-300 italic">Connecting to cloud...</p>
            )}
          </div>

          <div className="pt-6">
            {/* Action button to open settings interface */}
            <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-4 p-3 rounded-xl text-slate-400 hover:bg-slate-50 transition-all">
              <span className="text-lg">⚙️</span>
              {isSidebarOpen && <span className="text-[11px] font-black uppercase tracking-widest">Settings</span>}
            </button>
          </div>
        </nav>

        <div className="p-4 bg-slate-50 m-4 rounded-2xl border border-slate-100">
          <div className="flex flex-col gap-1">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Active Environment</p>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
              <p className="text-[10px] font-bold text-slate-800 truncate">{user?.name || 'No Identity'}</p>
              <p className="text-[8px] font-medium text-slate-400 uppercase mt-1">Aptean / EDIOne</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full mt-4 py-3 text-slate-400 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all">Sign Out</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#fcfdfe]">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {view === 'current' ? 'Weekly Matrix Board' : `Viewing Archive: ${selectedHistoryUser?.name || 'User'}`}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Search plan context..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-6 py-2.5 bg-slate-100 border-transparent rounded-full text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all w-64 font-medium" 
              />
              <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            
            <button onClick={() => syncDevOps()} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
              {isDevOpsLoading ? 'Syncing...' : 'Sync Features'}
            </button>

            <button onClick={() => setIsAssistantOpen(true)} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-blue-600 transition-all shadow-lg text-[10px] font-black uppercase tracking-widest px-4 flex items-center gap-2">
              <span className="text-blue-400">✨</span> Strategy
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10 bg-[#fcfdfe] custom-scrollbar">
          <div className="max-w-[1600px] mx-auto space-y-8">
            <div className="flex items-end justify-between">
              <div className="space-y-1">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                  {view === 'current' ? 'Productivity Matrix' : 'Archived View'}
                </h1>
                <div className="flex items-center gap-3">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workload Balance • </p>
                   {view === 'current' ? (
                     <>
                      <input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)}
                        className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg border-none outline-none cursor-pointer"
                      />
                      <span className="text-[10px] font-black text-slate-300">TO</span>
                      <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)}
                        className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg border-none outline-none cursor-pointer"
                      />
                     </>
                   ) : (
                     <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-lg">
                        {selectedHistoryUser?.history?.[historyIndex]?.weekRange}
                     </p>
                   )}
                </div>
              </div>
              {view === 'current' ? (
                <button onClick={handleDeploy} disabled={isSyncing} className="bg-emerald-500 text-white px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all active:scale-95">
                  {isSyncing ? 'Processing...' : 'Deploy Next Week'}
                </button>
              ) : (
                <button onClick={() => setView('current')} className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-slate-100 hover:bg-slate-800 transition-all active:scale-95">
                  Return to Active Matrix
                </button>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-200/50 border-t-[12px] border-t-[#0f172a]">
              <table className="w-full border-collapse table-fixed">
                <thead>
                  <tr className="bg-[#0f172a] text-white">
                    <th className="p-6 text-left w-64 border-r border-slate-800 uppercase text-[10px] font-black tracking-[0.2em]">Activity Layer</th>
                    <th className="p-6 text-center w-24 border-r border-slate-800 uppercase text-[10px] font-black tracking-[0.2em]">Target %</th>
                    <th className="p-6 text-center w-32 border-r border-slate-800 uppercase text-[10px] font-black tracking-[0.2em]">Status</th>
                    {Object.values(DayOfWeek).map(d => (
                      <th key={d} className="p-6 text-center border-r border-slate-800 last:border-r-0 uppercase text-[10px] font-black tracking-[0.2em]">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {PRIORITY_ORDER.map(group => (
                    <React.Fragment key={group}>
                      <tr className="bg-slate-50">
                        <td colSpan={8} className="px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                             <span className={`w-2 h-2 rounded-full ${
                               group === 'P1' ? 'bg-rose-600' : 
                               group === 'P2' ? 'bg-amber-500' : 
                               group === 'P3' ? 'bg-slate-400' : 'bg-emerald-500'
                             }`}></span>
                             {group} Priority Section
                          </div>
                        </td>
                      </tr>
                      {searchableRows.filter(r => r.priorityGroup === group).map(row => (
                        <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group divide-x divide-slate-100">
                          <td className="p-6 align-top">
                            <div className="flex flex-col gap-2">
                              <span className={`w-fit px-2 py-0.5 rounded text-[8px] font-black uppercase text-white ${
                                group === 'P1' ? 'bg-rose-600' : 
                                group === 'P2' ? 'bg-amber-500' : 
                                group === 'P3' ? 'bg-slate-400' : 'bg-emerald-500'
                              }`}>{group}</span>
                              <div 
                                contentEditable={view === 'current'}
                                onBlur={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, label: e.currentTarget.innerText } : r))}
                                className="text-sm font-black text-slate-800 uppercase tracking-tight outline-none focus:text-blue-600 min-h-[1.5em] leading-tight"
                                suppressContentEditableWarning
                              >
                                {row.label}
                              </div>
                            </div>
                          </td>
                          <td className="p-6 text-center align-middle">
                            <div
                              contentEditable={view === 'current'}
                              onBlur={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, effortLabel: e.currentTarget.innerText } : r))}
                              className="text-xs font-black text-slate-400 italic outline-none"
                              suppressContentEditableWarning
                            >
                              {row.effortLabel}
                            </div>
                          </td>
                          <td className="p-6 text-center align-middle">
                             <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                               group === 'P1' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                               group === 'P2' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                               group === 'P3' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                               'bg-emerald-50 text-emerald-600 border-emerald-100'
                             }`}>
                               {group}
                             </span>
                          </td>
                          {Object.values(DayOfWeek).map(day => (
                            <td 
                              key={day} 
                              className="p-0 align-top"
                              // Implementing Drop logic for DevOps features
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => {
                                // Only allow drops in the current active view
                                if (view !== 'current') return;
                                try {
                                  // Parse the dropped feature data
                                  const feature = JSON.parse(e.dataTransfer.getData('application/json'));
                                  // Extract feature metadata and last comment
                                  const lastCommentText = feature.comments && feature.comments.length > 0 
                                    ? `\n\nLatest Update:\n${feature.comments[0]}` 
                                    : "";
                                  // Construct the combined task text
                                  const combinedTaskText = `[#${feature.id}] ${feature.title}${lastCommentText}`;
                                  
                                  // Update the grid state with the dropped feature's details
                                  setRows(prev => prev.map(r => r.id === row.id ? { 
                                    ...r, 
                                    days: { 
                                      ...r.days, 
                                      [day]: { ...r.days[day], text: combinedTaskText } 
                                    } 
                                  } : r));
                                } catch (err) {
                                  console.error("Feature Drop Failed:", err);
                                }
                              }}
                            >
                              <EditableCell 
                                text={row.days[day].text} 
                                completed={row.days[day].completed} 
                                onTextChange={text => setRows(prev => prev.map(r => r.id === row.id ? { ...r, days: { ...r.days, [day]: { ...r.days[day], text } } } : r))}
                                onToggleComplete={() => setRows(prev => prev.map(r => r.id === row.id ? { ...r, days: { ...r.days, [day]: { ...r.days[day], completed: !r.days[day].completed } } } : r))}
                                isReadOnly={view !== 'current'}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                      {view === 'current' && (
                        <tr>
                          <td colSpan={8} className="p-0">
                            <button 
                              onClick={() => addRow(group)} 
                              className="w-full py-2.5 text-[9px] font-black uppercase tracking-[0.3em] text-slate-300 hover:text-blue-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 border-none outline-none"
                            >
                              <span className="text-base font-light">+</span> Add Row to {group}
                            </button>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {isFeatureDrawerOpen && view === 'current' && (
          <aside className="fixed top-0 right-0 h-full w-96 bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[60] flex flex-col animate-in slide-in-from-right duration-500 border-l border-slate-200">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                   <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">DevOps Workspace</h3>
                   <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">My Assigned Features</p>
                </div>
                <button onClick={() => setIsFeatureDrawerOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-all text-xl">✕</button>
             </div>
             
             <div className="p-4 border-b border-slate-100 space-y-3">
               <div className="relative">
                 <input type="text" placeholder="Search features..." className="w-full pl-9 pr-4 py-2 bg-slate-100/50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
                 <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round"/></svg>
               </div>
             </div>

             <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
                {features.map(f => (
                   <div 
                     key={f.id} 
                     draggable 
                     onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify(f))}
                     className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-400 cursor-grab transition-all group"
                   >
                      <div className="flex justify-between items-start mb-2">
                         <span className="text-[10px] font-black text-blue-500">#{f.id}</span>
                         <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${f.priority === 1 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>P{f.priority}</span>
                      </div>
                      <p className="text-sm font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors uppercase">{f.title}</p>
                      {/* Visual indicator of existing last comment in the drawer */}
                      {f.comments && f.comments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-50">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Comment</p>
                          <p className="text-[10px] text-slate-500 italic truncate">{f.comments[0]}</p>
                        </div>
                      )}
                   </div>
                ))}
                {features.length === 0 && !isDevOpsLoading && (
                   <div className="text-center py-20 text-slate-300">
                      <p className="text-[10px] font-black uppercase tracking-widest">No personal tasks found</p>
                   </div>
                )}
             </div>
          </aside>
        )}
      </main>

      {/* Configuration interface for user identity and DevOps Personal Access Token (PAT) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 bg-slate-950 text-white flex justify-between items-center relative">
               <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic">Personal Configuration</h3>
               </div>
               <button onClick={() => setIsSettingsOpen(false)} className="p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all text-xl">✕</button>
            </div>
            <div className="p-10 space-y-8 bg-white">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Full Name</label>
                  <input 
                    type="text" 
                    value={settings.userName} 
                    onChange={e => setSettings({...settings, userName: e.target.value})} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" 
                    placeholder="John Doe" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Identity Email</label>
                  <input 
                    type="text" 
                    value={settings.companyEmail} 
                    onChange={e => setSettings({...settings, companyEmail: e.target.value})} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" 
                    placeholder="user@aptean.com" 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">DevOps PAT (Private Token)</label>
                <input 
                  type="password" 
                  value={settings.devOpsPat} 
                  onChange={e => setSettings({...settings, devOpsPat: e.target.value})} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" 
                  placeholder="Paste your Azure DevOps PAT here" 
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Organization</label>
                  <input 
                    type="text" 
                    value={settings.organization} 
                    onChange={e => setSettings({...settings, organization: e.target.value})} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Project Name</label>
                  <input 
                    type="text" 
                    value={settings.project} 
                    onChange={e => setSettings({...settings, project: e.target.value})} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" 
                  />
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between"><label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Use CORS Proxy</label><button onClick={() => setSettings({...settings, useProxy: !settings.useProxy})} className={`w-12 h-6 rounded-full transition-colors relative ${settings.useProxy ? 'bg-blue-600' : 'bg-slate-200'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.useProxy ? 'left-7' : 'left-1'}`} /></button></div>
                {settings.useProxy && <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Proxy URL</label><input type="text" value={settings.corsProxy} onChange={e => setSettings({...settings, corsProxy: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-mono outline-none" placeholder="https://corsproxy.io/?url=" /></div>}
              </div>

              <button 
                onClick={() => saveSettings(settings)} 
                className="w-full py-5 bg-slate-950 text-white rounded-3xl font-black uppercase tracking-[0.2em] hover:bg-slate-900 shadow-2xl transition-all"
              >
                Save Identity Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      <ChatBot isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} planContext={JSON.stringify(rows)} userProfile={user} />
    </div>
  );
};

export default App;
