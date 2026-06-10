import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { 
  Users, Clock, GraduationCap, Video, Search, X, 
  Link as LinkIcon, Loader2, RefreshCw 
} from 'lucide-react';

export default function StudentPTM() {
  const { user } = useAuth();
  
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const loadMeetings = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ptm/student/${user.id}`);
      const d = await res.json();
      setMeetings(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  const filtered = useMemo(() => {
    let list = [...meetings];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(m => 
        (m.teacher_name || '').toLowerCase().includes(q) ||
        (m.className || '').toLowerCase().includes(q) ||
        (m.subject_focus || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [query, meetings]);

  const handleJoinMeeting = (link) => {
    if (link) window.open(link, '_blank');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      
      <header className="flex flex-col mb-2 sm:mb-0">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
          <Users className="text-primary size-5" />
          Meeting Schedules
        </h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
          View upcoming and past Parent-Teacher Meetings.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search meetings..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors p-0.5">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        
        <button onClick={loadMeetings} disabled={loading}
          className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Refresh
        </button>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin size-8 text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <Users className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">No meetings found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-zinc-50/80">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Date & Time</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Teacher & Class</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Meeting Focus</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Status</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(item => {
                  const meetingDate = new Date(item.meeting_datetime);
                  const isExpired = meetingDate < new Date();
                  const isCompleted = item.status === 'Completed';
                  const isJoinable = item.status === 'Scheduled' && item.meeting_link && !isExpired;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/60 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-zinc-900 font-semibold text-sm block">
                          {meetingDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-zinc-500 text-[11px] font-medium mt-0.5 block flex items-center gap-1">
                          <Clock className="size-3" />
                          {meetingDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-zinc-900 text-sm mb-1">{item.teacher_name || 'N/A'}</div>
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <GraduationCap className="size-3" />
                          {item.className ? `${item.className}${item.section ? ` - ${item.section}` : ''}` : 'All Classes'}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-zinc-900 text-sm line-clamp-1">{item.subject_focus || 'General'}</div>
                        {item.notes ? (
                          <div className="text-xs text-zinc-500 mt-1 line-clamp-1 max-w-[250px]" title={item.notes}>{item.notes}</div>
                        ) : (
                          <div className="text-xs text-zinc-400 italic mt-1">No additional notes</div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2 items-start">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                            isCompleted ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-primary/10 text-primary ring-primary/20'
                          }`}>
                            {isExpired && item.status !== 'Completed' ? 'Expired' : item.status}
                          </span>
                          {isExpired && !isCompleted ? (
                             <span className="text-[10px] font-bold text-red-500 uppercase tracking-tight">Date is Expired</span>
                          ) : item.meeting_link && !isCompleted ? (
                            <button 
                              disabled={!isJoinable}
                              onClick={() => handleJoinMeeting(item.meeting_link)} 
                              className={`text-xs font-semibold flex items-center gap-1 transition-colors ${isJoinable ? 'text-primary hover:text-primary/80' : 'text-zinc-400 cursor-not-allowed opacity-50'}`}>
                              <LinkIcon className="size-3" /> Join Link
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end">
                          {isJoinable ? (
                            <button onClick={() => handleJoinMeeting(item.meeting_link)} 
                              className="h-8 px-4 rounded-md font-semibold text-xs text-white transition-colors inline-flex items-center justify-center gap-1.5 shadow-sm bg-primary hover:bg-primary/90">
                              <Video className="size-3.5"/> Join
                            </button>
                          ) : isExpired ? (
                            <span className="text-zinc-400 text-xs font-medium italic">Meeting Expired</span>
                          ) : (
                            <span className="text-zinc-400 text-xs font-medium">-</span>
                          )}
                        </div>
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