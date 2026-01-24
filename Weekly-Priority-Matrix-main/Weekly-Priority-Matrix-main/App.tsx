import React, { useState, useEffect, useMemo } from 'react';
import { DayOfWeek, PlannerRow, HistoryEntry, PriorityGroup, DayState, UserSettings } from './types';
import { EditableCell } from './components/EditableCell';
import { ChatBot } from './components/ChatBot';
import { analyzeDevOpsComments } from './services/geminiService';

interface DevOpsFeature {
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

const createEmptyDays = (): Record<DayOfWeek, DayState> => ({
  [DayOfWeek.Monday]: { text: '', completed: false },
  [DayOfWeek.Tuesday]: { text: '', completed: false },
  [DayOfWeek.Wednesday]: { text: '', completed: false },
  [DayOfWeek.Thursday]: { text: '', completed: false },
  [DayOfWeek.Friday]: { text: '', completed: false },
});

const INITIAL_ROWS: PlannerRow[] = [
  { id: '1', priorityGroup: 'P1', effortLabel: '50%', label: 'Top Strategic Priority', days: createEmptyDays() },
  { id: '2', priorityGroup: 'P2', effortLabel: '30%', label: 'Operational Goal 1', days: createEmptyDays() },
  { id: '3', priorityGroup: 'P3', effortLabel: '20%', label: 'Supporting Tasks', days: createEmptyDays() },
  { id: '4', priorityGroup: 'Meeting', effortLabel: '-', label: 'Team Collaboration', days: createEmptyDays() },
];

const GROUP_CONFIG: Record<PriorityGroup, { label: string; color: string; badge: string }> = {
  P1: { label: 'P1: Critical Path (DevOps P1)', color: 'border-l-rose-600 bg-rose-100/40', badge: 'bg-rose-200 text-rose-800' },
  P2: { label: 'P2: Strategic Ops (DevOps P2)', color: 'border-l-amber-600 bg-amber-100/40', badge: 'bg-amber-200 text-amber-800' },
  P3: { label: 'P3: Operational (DevOps P3+)', color: 'border-l-slate-500 bg-slate-100/40', badge: 'bg-slate-200 text-slate-700' },
  Meeting: { label: 'Engagement / Syncs', color: 'border-l-emerald-600 bg-emerald-100/40', badge: 'bg-emerald-200 text-emerald-800' },
};

const App: React.FC = () => {
  const [rows, setRows] = useState<PlannerRow[]>(() => {
    const saved = localStorage.getItem('matrix_pro_v10_rows');
    return saved ? JSON.parse(saved) : INITIAL_ROWS;
  });

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('matrix_pro_v10_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [weekNumber, setWeekNumber] = useState<number>(() => {
    const saved = localStorage.getItem('matrix_pro_v10_weeknum');
    return saved ? parseInt(saved) : 1;
  });

  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('matrix_pro_v10_settings');
    const defaultSettings = { 
      userName: '', 
      companyEmail: '', 
      devOpsPat: '', 
      organization: 'Aptean', 
      project: 'EDIOne', 
      corsProxy: 'https://corsproxy.io/?', 
      useProxy: true 
    };
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  const [view, setView] = useState<'current' | 'history'>('current');
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [featureSearchTerm, setFeatureSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedFeatureId, setExpandedFeatureId] = useState<number | null>(null);
  const [filterByMe, setFilterByMe] = useState(true);
  
  const [syncLogs, setSyncLogs] = useState<{msg: string, type: 'info' | 'error' | 'success'}[]>([]);
  const [showSyncLog, setShowSyncLog] = useState(false);

  const [features, setFeatures] = useState<DevOpsFeature[]>(() => {
    const saved = localStorage.getItem('matrix_pro_v10_features');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('matrix_pro_v10_rows', JSON.stringify(rows));
    localStorage.setItem('matrix_pro_v10_history', JSON.stringify(history));
    localStorage.setItem('matrix_pro_v10_weeknum', weekNumber.toString());
    localStorage.setItem('matrix_pro_v10_settings', JSON.stringify(settings));
    localStorage.setItem('matrix_pro_v10_features', JSON.stringify(features));
  }, [rows, history, weekNumber, settings, features]);

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setSyncLogs(prev => [...prev, { msg, type }]);
  };

  const processCommentHtml = (html: string) => {
    if (!html) return "";
    try {
      const tmp = document.createElement("DIV");
      tmp.innerHTML = html;
      
      const imgs = tmp.querySelectorAll('img');
      if (imgs.length > 0) {
        imgs.forEach((img, i) => {
          const alt = img.alt || `Visual Confirmation ${i + 1}`;
          const span = document.createElement('span');
          span.innerText = ` [IMAGE: ${alt}] `;
          img.parentNode?.replaceChild(span, img);
        });
      }
      
      return tmp.textContent || tmp.innerText || "";
    } catch (e) {
      return html;
    }
  };

  const getProxiedUrl = (url: string) => {
    if (settings.useProxy && settings.corsProxy) {
      const proxy = settings.corsProxy.trim();
      return `${proxy}${encodeURIComponent(url)}`;
    }
    return url;
  };

  const safeFetchJson = async (url: string, options: RequestInit) => {
    try {
      const targetUrl = getProxiedUrl(url);
      const response = await fetch(targetUrl, options);
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (contentType && contentType.includes("text/html")) {
          throw new Error(`Server returned HTML instead of JSON. Check Org/Project/PAT.`);
        }
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText.substring(0, 150)}`);
      }

      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server response was not JSON.");
      }

      return await response.json();
    } catch (err: any) {
      if (err.message === "Failed to fetch") {
        throw new Error("Network Error. Likely CORS. Enable proxy in settings.");
      }
      throw err;
    }
  };

  const syncDevOps = async () => {
    if (!settings.devOpsPat || !settings.companyEmail) {
      alert("Please configure settings first.");
      setIsSettingsOpen(true);
      return;
    }

    setSyncLogs([]);
    setShowSyncLog(true);
    setIsProcessing(true);
    
    const targetIdentity = settings.companyEmail.trim();
    addLog(`Identity Target: ${targetIdentity}`, 'info');

    try {
      const authHeader = `Basic ${btoa(`:${settings.devOpsPat}`)}`;
      const wiqlUrl = `https://dev.azure.com/${settings.organization}/${settings.project}/_apis/wit/wiql?api-version=6.0`;
      
      addLog(`Searching active features...`, 'info');

      let queryStr = `SELECT [System.Id], [System.Title], [Microsoft.VSTS.Common.Priority], [System.State], [System.AssignedTo] 
                      FROM WorkItems 
                      WHERE [System.WorkItemType] = 'Feature' 
                      AND [System.State] NOT IN ('Closed', 'Removed', 'Done')`;
      
      if (filterByMe) {
        queryStr += ` AND ([System.AssignedTo] CONTAINS '${targetIdentity}' OR [System.AssignedTo] CONTAINS '${settings.userName || targetIdentity}')`;
      }

      const result = await safeFetchJson(wiqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ query: queryStr })
      });

      await handleSyncResponse(result, authHeader);

    } catch (e: any) {
      addLog(`Error: ${e.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncResponse = async (result: any, authHeader: string) => {
    const ids = (result.workItems || []).map((wi: any) => wi.id);
    
    if (ids.length === 0) {
      addLog(`No matching features found.`, 'error');
      setFeatures([]);
      return;
    }

    addLog(`Retrieving data for ${ids.length} items...`, 'info');
    
    const detailsUrl = `https://dev.azure.com/${settings.organization}/_apis/wit/workitemsbatch?api-version=6.0`;
    const details = await safeFetchJson(detailsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: JSON.stringify({ 
        ids: ids.slice(0, 100),
        fields: ["System.Id", "System.Title", "Microsoft.VSTS.Common.Priority", "System.State", "System.AssignedTo"] 
      })
    });

    const featuresWithAnalysis = await Promise.all((details.value || []).map(async (f: any) => {
      const featureId = f.fields["System.Id"];
      let rawComments: string[] = [];
      let statusSummary = { summary: "Analysis in progress...", completed: [], next: [] };

      try {
        const commentsUrl = `https://dev.azure.com/${settings.organization}/_apis/wit/workItems/${featureId}/comments?api-version=6.0-preview.3`;
        const cRes = await fetch(getProxiedUrl(commentsUrl), { headers: { 'Authorization': authHeader } });
        if (cRes.ok) {
          const cData = await cRes.json();
          // We keep HTML tags for image detection, then Gemini handles extraction
          rawComments = (cData.comments || []).map((c: any) => processCommentHtml(c.text));
          if (rawComments.length > 0) {
            statusSummary = await analyzeDevOpsComments(rawComments);
          }
        }
      } catch (err) {
        console.error(`AI analysis skipped for ${featureId}`, err);
      }

      return {
        id: featureId,
        title: f.fields["System.Title"],
        priority: f.fields["Microsoft.VSTS.Common.Priority"] || 3,
        state: f.fields["System.State"],
        assignedTo: f.fields["System.AssignedTo"] || "Unassigned",
        comments: rawComments,
        status: statusSummary
      };
    }));

    setFeatures(featuresWithAnalysis);
    addLog(`Successfully synced ${featuresWithAnalysis.length} features.`, 'success');
  };

  const handleFeatureDrop = (rowId: string, day: DayOfWeek, content: string) => {
    setRows(prev => prev.map(r => 
      r.id === rowId 
        ? { ...r, days: { ...r.days, [day]: { ...r.days[day], text: content } } }
        : r
    ));
  };

  const deployNextWeek = () => {
    const entry: HistoryEntry = {
      id: Math.random().toString(36).substring(2, 9),
      weekNumber: weekNumber,
      weekRange: `Week of ${new Date().toLocaleDateString()}`,
      timestamp: Date.now(),
      rows: JSON.parse(JSON.stringify(rows))
    };
    setHistory(prev => [entry, ...prev]);
    setWeekNumber(prev => prev + 1);
    setRows(prev => prev.map(row => ({ ...row, days: createEmptyDays() })));
    alert("Week archived.");
  };

  const renderMatrixSection = (group: PriorityGroup) => {
    const sectionRows = filteredRows.filter(r => r.priorityGroup === group);
    if (sectionRows.length === 0 && view === 'history') return null;

    return (
      <React.Fragment key={group}>
        <tr className={`border-b border-slate-200 ${GROUP_CONFIG[group].color}`}>
          <td colSpan={8} className="px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${group === 'P1' ? 'bg-rose-600' : group === 'P2' ? 'bg-amber-600' : group === 'P3' ? 'bg-slate-500' : 'bg-emerald-600'}`}></span>
              {GROUP_CONFIG[group].label}
            </div>
          </td>
        </tr>
        {sectionRows.map((row) => (
          <tr key={row.id} className="border-b border-slate-200 bg-white hover:bg-slate-50/50 group/row transition-colors">
            <td className="p-4 align-top w-[18%]">
              <div 
                contentEditable={view === 'current'}
                onBlur={(e) => {
                  const target = e.currentTarget;
                  if (target) {
                    setRows(prev => prev.map(r => r.id === row.id ? { ...r, label: target.innerText || "" } : r));
                  }
                }}
                suppressContentEditableWarning
                className="text-sm font-bold text-slate-800 outline-none uppercase tracking-tight"
              >
                {row.label}
              </div>
              {view === 'current' && (
                <button 
                  onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))} 
                  className="mt-2 text-[8px] font-black uppercase text-slate-300 hover:text-rose-500 opacity-0 group-hover/row:opacity-100 transition-all"
                >
                  Delete
                </button>
              )}
            </td>
            <td className="p-4 text-center align-top border-l border-slate-100 w-[10%] text-xs font-black text-slate-500 font-mono bg-slate-50/30">
              {row.effortLabel}
            </td>
            <td className="p-4 text-center align-top border-l border-slate-100 w-[10%] bg-slate-50/30">
              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${GROUP_CONFIG[row.priorityGroup].badge}`}>
                {row.priorityGroup}
              </span>
            </td>
            {(Object.values(DayOfWeek) as DayOfWeek[]).map(day => (
              <td 
                key={day} 
                className="p-0 align-top border-l border-slate-100"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const dropData = e.dataTransfer.getData('application/json');
                  if (dropData) {
                    try {
                      const data = JSON.parse(dropData);
                      // Formatted text structure: Completed -> Next Task -> Summary
                      const formatted = `[#${data.id}] ${data.title}\n\nCompleted:\n${data.completed.length ? data.completed.join('\n') : 'Testing ongoing'}\n\nNext Task:\n${data.next.length ? data.next.join('\n') : 'Pending deployment'}\n\nSummary for the feature:\n${data.summary}`;
                      handleFeatureDrop(row.id, day, formatted);
                    } catch (err) {
                      console.error("Drop failed", err);
                    }
                  }
                }}
              >
                <EditableCell 
                  text={row.days[day].text}
                  completed={row.days[day].completed}
                  onTextChange={(text) => setRows(prev => prev.map(r => r.id === row.id ? { ...r, days: { ...r.days, [day]: { ...r.days[day], text } } } : r))}
                  onToggleComplete={() => setRows(prev => prev.map(r => r.id === row.id ? { ...r, days: { ...r.days, [day]: { ...r.days[day], completed: !r.days[day].completed } } } : r))}
                  isReadOnly={view !== 'current'}
                />
              </td>
            ))}
          </tr>
        ))}
        {view === 'current' && (
          <tr className="border-b border-slate-200 bg-slate-50/30 no-print">
            <td colSpan={8} className="p-0">
              <button 
                onClick={() => setRows(prev => [...prev, { 
                  id: Math.random().toString(36).substr(2, 9), 
                  priorityGroup: group, 
                  effortLabel: '10%', 
                  label: 'NEW ENTRY', 
                  days: createEmptyDays() 
                }])} 
                className="w-full py-2.5 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-blue-600 hover:bg-white transition-all flex items-center justify-center gap-2"
              >
                <span className="text-base font-normal">+</span> ADD NEW ENTRY TO {group}
              </button>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  const activeRows = view === 'current' ? rows : history[historyIndex]?.rows || [];
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return activeRows;
    const term = searchTerm.toLowerCase();
    return activeRows.filter(row => row.label.toLowerCase().includes(term));
  }, [activeRows, searchTerm]);

  const filteredFeatures = useMemo(() => {
    const term = featureSearchTerm.toLowerCase().trim();
    return features.filter(f => 
      f.title.toLowerCase().includes(term) || 
      f.id.toString().includes(term)
    );
  }, [features, featureSearchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter'] selection:bg-blue-100">
      <header className="glass-header sticky top-0 z-40 border-b border-slate-200 px-8 py-4 flex items-center justify-between no-print shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter text-slate-900 uppercase leading-none">PLANNER<span className="text-blue-600">MATRIX</span></h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Aptean EDIOne Center</span>
          </div>
          <div className="flex bg-slate-200/50 p-1 rounded-full border border-slate-200">
            <button onClick={() => setView('current')} className={`px-6 py-1.5 text-[10px] font-black uppercase rounded-full transition-all ${view === 'current' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Current</button>
            <button onClick={() => { if (history.length) setView('history'); }} className={`px-6 py-1.5 text-[10px] font-black uppercase rounded-full transition-all ${view === 'history' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>History ({history.length})</button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative mr-2">
            <input 
              type="text" 
              placeholder="Search weekly plan..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-4 py-2 bg-slate-100 border border-transparent focus:bg-white focus:border-blue-200 rounded-full text-[11px] font-medium outline-none transition-all w-48"
            />
            <svg className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2.5 rounded-lg transition-all border ${isSidebarOpen ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-inner' : 'bg-white border-slate-200 text-slate-600 shadow-sm hover:bg-slate-50'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
          </button>

          <button 
            onClick={syncDevOps} 
            disabled={isProcessing}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 disabled:opacity-50 ${isProcessing ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'}`}
          >
            {isProcessing ? 'Syncing...' : 'Sync DevOps'}
          </button>

          <button onClick={() => setIsAssistantOpen(!isAssistantOpen)} className="p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="AI assistant">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="Settings">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
          </button>
        </div>
      </header>

      {showSyncLog && syncLogs.length > 0 && (
        <div className="fixed bottom-8 left-8 w-96 bg-slate-900 text-white rounded-2xl shadow-2xl z-50 overflow-hidden border border-slate-800 animate-in slide-in-from-bottom duration-300">
          <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Sync status monitor</span>
            <button onClick={() => { setShowSyncLog(false); setSyncLogs([]); }} className="text-[10px] font-black hover:text-white transition-colors">Dismiss</button>
          </div>
          <div className="p-4 max-h-64 overflow-y-auto space-y-3 bg-slate-900 custom-scrollbar">
            {syncLogs.map((log, i) => (
              <div key={i} className={`text-[11px] font-mono leading-relaxed border-l-2 pl-3 ${
                log.type === 'error' ? 'text-rose-400 border-rose-500' : log.type === 'success' ? 'text-emerald-400 border-emerald-500' : 'text-slate-400 border-slate-700'
              }`}>
                {log.msg}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-80px)] relative">
        <aside 
          className={`bg-white border-r border-slate-200 flex flex-col no-print transition-all duration-300 ease-in-out shadow-xl z-30 ${isSidebarOpen ? 'w-[340px] lg:w-[420px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
        >
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Project Features</h2>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <p className="text-[10px] text-slate-400 font-bold">Identity: <span className="text-slate-600">{settings.companyEmail || 'Raghul S'}</span></p>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors" title="Collapse">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Filter Features..." 
                  value={featureSearchTerm}
                  onChange={(e) => setFeatureSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all shadow-sm"
                />
                <svg className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
              
              <div className="flex items-center justify-between px-1">
                <button 
                  onClick={() => setFilterByMe(!filterByMe)}
                  className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all ${filterByMe ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <div className={`w-3.5 h-3.5 border-2 rounded flex items-center justify-center ${filterByMe ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                    {filterByMe && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>}
                  </div>
                  My assigned features
                </button>
                <button onClick={syncDevOps} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 flex items-center gap-1 transition-colors">
                  <svg className={`w-2.5 h-2.5 ${isProcessing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                  Sync
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
            {filteredFeatures.length === 0 ? (
              <div className="py-24 text-center px-10">
                <div className="w-16 h-16 bg-white text-slate-200 rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-2">Empty state</h4>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                  {features.length === 0 
                    ? "Connect to Azure DevOps to see assigned work." 
                    : "No features match your search."}
                </p>
              </div>
            ) : (
              filteredFeatures.map(feature => (
                <div 
                  key={feature.id}
                  draggable
                  onDragStart={(e) => {
                    const data = {
                      id: feature.id,
                      title: feature.title,
                      summary: feature.status?.summary || "Status pending analysis",
                      completed: feature.status?.completed || [],
                      next: feature.status?.next || []
                    };
                    e.dataTransfer.setData('application/json', JSON.stringify(data));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-xl hover:border-blue-300 transition-all cursor-grab active:cursor-grabbing group overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">#{feature.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                      feature.priority === 1 ? 'bg-rose-100 text-rose-700' : feature.priority === 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      P{feature.priority}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-900 leading-snug uppercase tracking-tight group-hover:text-blue-600 transition-colors mb-3">{feature.title}</h3>
                  
                  {feature.status && (
                    <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="pb-2 border-b border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Status Summary</p>
                        <p className="text-[11px] text-slate-800 font-bold leading-tight">{feature.status.summary}</p>
                      </div>
                      
                      {feature.status.completed.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-emerald-700 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-1">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full"></span> Completed
                          </p>
                          <ul className="space-y-1.5">
                            {feature.status.completed.slice(0, 3).map((task, i) => (
                              <li key={i} className="text-[10px] text-slate-600 leading-tight pl-2 border-l border-emerald-200">{task}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {feature.status.next.length > 0 && (
                        <div className="pt-2">
                          <p className="text-[9px] font-black text-blue-700 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-1">
                            <span className="w-1 h-1 bg-blue-500 rounded-full"></span> Next Task
                          </p>
                          <ul className="space-y-1.5">
                            {feature.status.next.slice(0, 2).map((task, i) => (
                              <li key={i} className="text-[10px] text-slate-600 leading-tight pl-2 border-l border-blue-200 font-medium">{task}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setExpandedFeatureId(expandedFeatureId === feature.id ? null : feature.id); }}
                      className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors flex items-center gap-2"
                    >
                      {expandedFeatureId === feature.id ? 'Hide Discussion' : `View Discussion (${feature.comments.length})`}
                      <svg className={`w-3 h-3 transform transition-transform ${expandedFeatureId === feature.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    
                    {expandedFeatureId === feature.id && (
                      <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                        {feature.comments.map((comment, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-lg text-[10px] text-slate-500 leading-relaxed border border-slate-100 italic shadow-sm">
                            {comment}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="fixed left-4 top-24 z-40 p-3 bg-white border border-slate-200 shadow-lg rounded-full text-blue-600 hover:bg-blue-50 transition-all animate-bounce no-print"
            title="Open Features"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <main 
          className={`flex-1 overflow-y-auto p-10 bg-slate-50/50 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[calc(100%-340px)] lg:w-[calc(100%-420px)]' : 'w-full'}`}
        >
          <div className="mb-10 flex justify-between items-end border-b border-slate-200 pb-8">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white rounded-3xl shadow-xl border border-slate-100 flex items-center justify-center p-3">
                <img src="https://www.aptean.com/favicon.ico" className="w-full h-full object-contain grayscale opacity-40" alt="Aptean" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase">Weekly Plan Center</span>
                  <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Management Matrix</h2>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                  Environment: <span className="text-blue-500">{settings.organization}</span> / {settings.project} &bull; 
                  Active identity: <span className="text-slate-600">{settings.companyEmail || 'Raghul S (rs1@aptean.com)'}</span>
                </p>
              </div>
            </div>
            {view === 'current' && (
              <button onClick={deployNextWeek} className="bg-emerald-500 text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all active:scale-95 glow-button">Archive week</button>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 border-t-8 border-t-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-[#0f172a] text-white">
                    <th className="w-[18%] py-6 px-8 text-[11px] font-black uppercase tracking-[0.2em] text-left border-r border-slate-800">Activity target</th>
                    <th className="w-[10%] py-6 text-[11px] font-black uppercase tracking-[0.2em] text-center border-r border-slate-800">Resource %</th>
                    <th className="w-[10%] py-6 text-[11px] font-black uppercase tracking-[0.2em] text-center border-r border-slate-800">Priority</th>
                    {Object.values(DayOfWeek).map(day => <th key={day} className="py-6 text-[11px] font-black uppercase tracking-[0.2em] text-center border-r border-slate-800 last:border-r-0">{day}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {renderMatrixSection('P1')}
                  {renderMatrixSection('P2')}
                  {renderMatrixSection('P3')}
                  {renderMatrixSection('Meeting')}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-10 bg-[#0f172a] text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest italic">DevOps identity</h3>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">Global sync configuration</p>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all text-2xl leading-none">&times;</button>
            </div>
            <div className="p-10 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Display name</label>
                <input type="text" value={settings.userName} onChange={(e) => setSettings({...settings, userName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none" placeholder="Raghul S" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email identity</label>
                <input type="text" value={settings.companyEmail} onChange={(e) => setSettings({...settings, companyEmail: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100" placeholder="rs1@aptean.com" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Personal access token (PAT)</label>
                <input type="password" value={settings.devOpsPat} onChange={(e) => setSettings({...settings, devOpsPat: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100" placeholder="Required for sync" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Org</label>
                  <input type="text" value={settings.organization} onChange={(e) => setSettings({...settings, organization: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Project</label>
                  <input type="text" value={settings.project} onChange={(e) => setSettings({...settings, project: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Enable CORS Proxy</label>
                  <button 
                    onClick={() => setSettings({...settings, useProxy: !settings.useProxy})}
                    className={`w-12 h-6 rounded-full transition-colors relative ${settings.useProxy ? 'bg-blue-600' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.useProxy ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
                {settings.useProxy && (
                  <input 
                    type="text" 
                    value={settings.corsProxy} 
                    onChange={(e) => setSettings({...settings, corsProxy: e.target.value})} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-mono outline-none" 
                    placeholder="e.g., https://corsproxy.io/?"
                  />
                )}
              </div>

              <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-[#0f172a] text-white py-5 rounded-2xl text-xs font-black uppercase tracking-[0.3em] shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98]">Update configuration</button>
            </div>
          </div>
        </div>
      )}

      <ChatBot isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} planContext={filteredRows.map(r => r.label).join(', ')} userProfile={{ name: settings.userName, email: settings.companyEmail }} />
    </div>
  );
};

export default App;