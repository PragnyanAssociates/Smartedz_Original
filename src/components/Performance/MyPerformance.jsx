import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { RefreshCw, Loader2, BarChart3, Trophy, User } from 'lucide-react';
import { roundPct, band, buildStudentTotals } from './PerfUtils';

// =====================================================================
//  MyPerformance — a student's own view: Topper vs You bar comparison,
//  filtered by exam + subject. Driven by the dynamic class dataset.
// =====================================================================

export default function MyPerformance() {
  const { user } = useAuth();

  const [data, setData]         = useState(null);   // { me, class, students, subjects, examTypes, marks }
  const [loading, setLoading]   = useState(true);
  const [examTypeId, setExam]   = useState('overall');
  const [subjectId, setSubject] = useState('all');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/performance/student/${user.id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setData(d);
    } catch (e) { alert(e.message); setData(null); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const ranked = useMemo(
    () => buildStudentTotals(data, { examTypeId, subjectId }),
    [data, examTypeId, subjectId]
  );

  const topper = ranked[0] || null;
  const me = ranked.find(r => r.id === user?.id) || null;

  if (loading) {
    return <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }

  if (!data || !data.class) {
    return (
      <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">You're not assigned to a class yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Selector label="Exam" value={examTypeId} onChange={setExam}
          options={[
            { value: 'overall', label: 'Overall' },
            ...((data.examTypes || []).map(t => ({ value: String(t.id), label: t.name })))
          ]} />
        <Selector label="Subject" value={subjectId} onChange={setSubject}
          options={[
            { value: 'all', label: 'All Subjects' },
            ...((data.subjects || []).map(s => ({ value: String(s.id), label: s.name })))
          ]} />
        <div className="flex-1" />
        <button onClick={load}
          className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-wrap gap-5 items-center">
        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Performance Index</span>
        <Legend color="bg-emerald-500" text="≥ 85%" />
        <Legend color="bg-blue-500" text="50–85%" />
        <Legend color="bg-red-500" text="< 50%" />
      </div>

      {(data.examTypes || []).length === 0 || !me ? (
        <div className="bg-white p-14 rounded-3xl border border-dashed border-slate-200 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No marks recorded for this selection yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-end justify-center gap-16 sm:gap-28 h-[360px]">
            {topper && <Bar row={topper} label="Topper" icon={<Trophy size={16} />} />}
            <Bar row={me} label="You" highlight icon={<User size={16} />} />
          </div>
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
            <Stat label="Your Rank" value={`#${me.rank}`} />
            <Stat label="Your Marks" value={`${Math.round(me.obtained)}/${Math.round(me.possible)}`} />
            <Stat label="Class Size" value={ranked.length} />
          </div>
        </div>
      )}
    </div>
  );
}

// --- A single vertical performance bar -----------------------------
function Bar({ row, label, highlight, icon }) {
  const [fill, setFill] = useState(0);
  const b = band(row.percentage);
  useEffect(() => {
    const t = setTimeout(() => setFill(Math.min(row.percentage, 100)), 100);
    return () => clearTimeout(t);
  }, [row.percentage]);

  return (
    <div className="flex flex-col items-center justify-end h-full">
      <div className="mb-3 text-center">
        <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-xs font-black text-slate-600 mb-1">
          #{row.rank}
        </div>
        <div className="text-3xl font-black text-slate-800 leading-none">{Math.round(row.obtained)}</div>
        <div className="text-[11px] font-bold text-slate-400">/ {Math.round(row.possible)}</div>
        <div className={`text-sm font-black ${b.text} mt-0.5`}>{row.percentage}%</div>
      </div>
      <div className="w-20 sm:w-28 h-56 bg-slate-100 rounded-t-xl flex flex-col justify-end overflow-hidden border border-slate-200">
        <div className={`w-full ${b.bar} transition-all duration-1000 ease-out rounded-t-xl`}
          style={{ height: `${fill}%` }} />
      </div>
      <span className={`mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold ${
        highlight ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-500'
      }`}>
        {icon} {label}
      </span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
      <div className="text-lg font-black text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}

function Selector({ label, value, onChange, options }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="block bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer min-w-[140px]">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Legend({ color, text }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded ${color}`} />
      <span className="text-xs font-bold text-slate-600">{text}</span>
    </div>
  );
}