import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { Video, PlayCircle, Search, X, Loader2, RefreshCw } from 'lucide-react';

export default function StudentOnlineClasses() {
  const { user } = useAuth();
  
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('live'); 

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/online-classes/student/${user.id}`);
      const d = await res.json();
      setClassesList(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let list = classesList.filter(c => c.class_type === view);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c => 
        (c.title || '').toLowerCase().includes(q) ||
        (c.subject_name || '').toLowerCase().includes(q) ||
        (c.teacher_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [classesList, view, query]);

  const handleJoinOrWatch = (c) => {
    if (c.class_type === 'live' && c.meet_link) window.open(c.meet_link, '_blank');
    if (c.class_type === 'recorded' && c.video_path) window.open(`${API_BASE_URL.replace('/api', '')}${c.video_path}`, '_blank');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      
      <header className="flex flex-col mb-2 sm:mb-0">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
          <Video className="text-primary size-5" />
          Online Classes
        </h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
          Join your live sessions or watch recorded lectures.
        </p>
      </header>

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar w-full xl:w-auto shrink-0">
          <button onClick={() => setView('live')}
            className={`flex-1 xl:flex-none px-4 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
              view === 'live' ? 'bg-primary text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50/50'
            }`}>
            Live Classes
          </button>
          <button onClick={() => setView('recorded')}
            className={`flex-1 xl:flex-none px-4 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
              view === 'recorded' ? 'bg-primary text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50/50'
            }`}>
            Recorded Classes
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search classes..."
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors p-0.5">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          
          <button onClick={loadData} disabled={loading} 
            className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin size-8 text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <Video className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">No {view} classes scheduled for you.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-zinc-50/80">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Date & Time</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Class Details</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Subject</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Teacher</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(c => {
                  const dt = new Date(c.class_datetime);
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/60 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-primary font-semibold text-sm block">{dt.toLocaleDateString()}</span>
                        <span className="text-zinc-500 text-[11px] font-medium mt-0.5 block">{dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-zinc-900 text-sm mb-1.5 line-clamp-1">{c.title}</div>
                        {c.topic ? (
                          <span className="bg-primary/5 text-primary text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded ring-1 ring-primary/20 inline-block">
                            {c.topic}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs italic">No topic</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-zinc-900">
                        {c.subject_name}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-zinc-700">
                        {c.teacher_name}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <button onClick={() => handleJoinOrWatch(c)} 
                          className={`h-8 px-4 rounded-md font-semibold text-xs text-white transition-colors inline-flex items-center justify-center gap-1.5 shadow-sm ${
                            c.class_type === 'live' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary hover:bg-primary/90'
                          }`}>
                          {c.class_type === 'live' ? <><Video className="size-3.5"/> Join Live Class</> : <><PlayCircle className="size-3.5"/> Watch Recording</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}