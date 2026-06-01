import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { Loader2, CalendarDays } from 'lucide-react';
import { ScheduleDetailView } from './SchedulesManager';

// =====================================================================
//  StudentSchedulesView - read-only listing of schedules for the
//  logged-in student's class.
// =====================================================================

export default function StudentSchedulesView() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [tab, setTab] = useState('Internal');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/admin/exam-schedules/student/${user.id}`)
      .then(r => r.json())
      .then(d => setSchedules(Array.isArray(d) ? d : []))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(
    () => schedules.filter(s => s.exam_type === tab),
    [schedules, tab]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Tab Switcher */}
      <div className="flex justify-center sm:justify-start">
        <div className="inline-flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar max-w-full">
          {['Internal', 'External'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                tab === t ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              {t === 'Internal' ? 'School Exams' : 'Govt Schedule'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="animate-spin size-8 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <CalendarDays className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No {tab.toLowerCase()} schedules published yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map(s => <ScheduleDetailView key={s.id} schedule={s} />)}
        </div>
      )}
    </div>
  );
}