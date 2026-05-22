import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { 
  Users, Calendar, Clock, GraduationCap, Target, 
  Video, Search, X, Link as LinkIcon, Loader2 
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
    if (!query.trim()) return meetings;
    const q = query.toLowerCase();
    return meetings.filter(m => 
      (m.teacher_name || '').toLowerCase().includes(q) ||
      (m.className || '').toLowerCase().includes(q) ||
      (m.subject_focus || '').toLowerCase().includes(q)
    );
  }, [query, meetings]);

  const handleJoinMeeting = (link) => {
    if (link) window.open(link, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="text-blue-600" size={28} />
          Meeting Schedules
        </h2>
        <p className="text-slate-500 font-medium mt-1">
          View upcoming and past Parent-Teacher Meetings.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search meetings…"
            className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 w-full sm:w-72 shadow-sm" />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
        
        <button onClick={loadMeetings} disabled={loading}
          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm">
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No meetings found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map(item => {
            const meetingDate = new Date(item.meeting_datetime);
            const isCompleted = item.status === 'Completed';
            const isJoinable = item.status === 'Scheduled' && item.meeting_link;

            return (
              <div key={item.id} className={`bg-white rounded-3xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 border-l-4 ${isCompleted ? 'border-emerald-500' : 'border-blue-500'}`}>
                
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-slate-50">
                  <div className="flex items-center gap-4">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                      <Users size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-slate-800 truncate leading-tight">{item.teacher_name || 'N/A'}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Parent-Teacher Meeting</p>
                    </div>
                  </div>
                  
                  {isJoinable && (
                    <button onClick={() => handleJoinMeeting(item.meeting_link)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm text-xs">
                      <Video size={14} /> Join
                    </button>
                  )}
                </div>
                
                {/* Body */}
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</span>
                      <span className="text-sm font-bold text-slate-700">{meetingDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-slate-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</span>
                      <span className="text-sm font-bold text-slate-700">{meetingDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap size={16} className="text-slate-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</span>
                      <span className="text-sm font-bold text-slate-700">{item.className ? `${item.className}${item.section ? ` - ${item.section}` : ''}` : 'All Classes'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target size={16} className="text-slate-400" /> 
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Focus</span>
                      <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{item.subject_focus || 'General'}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-6 mt-auto flex flex-col gap-4 rounded-b-3xl">
                  {item.notes && (
                    <div className="text-sm text-slate-600 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                      <span className="font-bold block mb-1">Notes:</span>
                      {item.notes}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.status}
                    </span>
                    
                    {item.meeting_link && !isCompleted && !isJoinable && (
                      <div className="flex items-center gap-2 text-sm">
                        <LinkIcon size={14} className="text-slate-400" />
                        <button onClick={() => handleJoinMeeting(item.meeting_link)} className="text-blue-600 hover:underline font-bold truncate">
                          Join Link
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}