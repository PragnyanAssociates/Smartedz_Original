import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { RefreshCw, Loader2, BarChart3, Trophy, User, ChevronDown } from 'lucide-react';
import { roundPct, band, buildStudentTotals, studentExamBreakdown } from './PerfUtils';
import { PerfBar, BarRow, ChartModal } from './PerfBar';

// =====================================================================
//  MyPerformance - a student's own view.
//   - Topper vs You bar comparison, filtered by exam + subject.
//   - Analysis button -> bar chart of the student's own exams.
//  Bands: 100-80 green, 80-50 blue, 50-0 red. Active academic year only.
// =====================================================================

export default function MyPerformance() {
  const { user } = useAuth();

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [examTypeId, setExam]   = useState('overall');
  const [subjectId, setSubject] = useState('all');
  const [showAnalysis, setShowAnalysis] = useState(false);

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

  const examLabel = examTypeId === 'overall'
    ? 'Overall'
    : (data?.examTypes || []).find(t => String(t.id) === examTypeId)?.name || '';
  const subjectLabel = subjectId === 'all'
    ? 'All Subjects'
    : (data?.subjects || []).find(s => String(s.id) === subjectId)?.name || '';

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }

  if (!data || !data.class) {
    return (
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center flex-1 min-h-[300px]">
        <BarChart3 className="size-10 text-zinc-300 mx-auto mb-3" />
        <p className="text-zinc-500 font-medium text-sm">You're not assigned to a class yet.</p>
        <p className="text-zinc-400 text-xs mt-1">Please contact administration.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 gap-4 sm:gap-6 animate-in fade-in duration-300">

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 sm:gap-4 bg-white p-4 rounded-lg ring-1 ring-black/5 shadow-sm">
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

        <div className="flex-1 min-w-[100px]" />

        <button onClick={() => setShowAnalysis(true)} disabled={!me}
          className="h-9 px-4 inline-flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200 disabled:opacity-50 rounded-md text-xs font-semibold shadow-sm transition-colors shrink-0 w-full sm:w-auto">
          <BarChart3 className="size-3.5" /> Analysis
        </button>
        <button onClick={load} title="Refresh Data"
          className="h-9 px-3 bg-white border border-zinc-200 text-zinc-600 hover:text-primary hover:bg-zinc-50 rounded-md flex items-center justify-center transition-colors shadow-sm shrink-0 w-full sm:w-auto">
          <RefreshCw className="size-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="bg-amber-50/50 border border-amber-200/60 rounded-md px-4 py-3 flex flex-wrap gap-4 sm:gap-6 items-center shrink-0">
        <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Performance Index</span>
        <div className="flex flex-wrap gap-4">
          <Legend color="bg-emerald-500" text="80%+ Excellent" />
          <Legend color="bg-blue-500" text="50-80% Average" />
          <Legend color="bg-red-500" text="Below 50% Needs Work" />
        </div>
      </div>

      {(data.examTypes || []).length === 0 || !me ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center flex-1 min-h-[300px]">
          <BarChart3 className="size-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium text-sm">No marks recorded for this selection yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-6 sm:p-8 flex flex-col flex-1 justify-center">

          <div className="flex items-end justify-center gap-12 sm:gap-24 md:gap-32 h-[340px] pt-4">
            {topper && <BigBar row={topper} label="Topper" icon={<Trophy className="size-3.5" />} />}
            <BigBar row={me} label="You" highlight icon={<User className="size-3.5" />} />
          </div>

          <div className="mt-10 pt-6 border-t border-zinc-100 grid grid-cols-3 gap-4 text-center">
            <Stat label="Your Rank" value={`#${me.rank}`} />
            <Stat label="Your Marks" value={`${Math.round(me.obtained)}/${Math.round(me.possible)}`} />
            <Stat label="Class Size" value={ranked.length} />
          </div>
        </div>
      )}

      {/* ---- ANALYSIS MODAL: my exam-by-exam chart ---- */}
      {showAnalysis && me && (
        <ChartModal
          title="My Exam Analysis"
          subtitle={`${examLabel} / ${subjectLabel} / exam-by-exam`}
          onClose={() => setShowAnalysis(false)}>
          <BarRow empty="No exam-wise marks recorded yet.">
            {studentExamBreakdown(data, me.id).map(ex => (
              <PerfBar key={ex.exam_type_id}
                percentage={ex.percentage}
                label={ex.name}
                marks={`${Math.round(ex.obtained)}/${Math.round(ex.possible)}`} />
            ))}
          </BarRow>
        </ChartModal>
      )}
    </div>
  );
}

// --- Big vertical bar (Topper vs You) ------------------------------
function BigBar({ row, label, highlight, icon }) {
  const [fill, setFill] = useState(0);
  const b = band(row.percentage);

  useEffect(() => {
    const t = setTimeout(() => setFill(Math.min(row.percentage, 100)), 100);
    return () => clearTimeout(t);
  }, [row.percentage]);

  return (
    <div className="flex flex-col items-center justify-end h-full group">
      <div className="mb-4 text-center flex flex-col items-center">
        <div className="inline-flex items-center justify-center size-7 rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-black/5 mb-2">
          #{row.rank}
        </div>
        <div className="text-3xl font-bold text-zinc-900 leading-none tabular-nums">{Math.round(row.obtained)}</div>
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-1.5">of {Math.round(row.possible)}</div>
        <div className={`text-sm font-bold ${b.text} mt-1`}>{row.percentage}%</div>
      </div>

      <div className="w-20 sm:w-24 h-56 bg-zinc-100/80 rounded-t-md flex flex-col justify-end overflow-hidden ring-1 ring-inset ring-black/5">
        <div className={`w-full ${b.bar} transition-all duration-1000 ease-out rounded-t-md opacity-90 group-hover:opacity-100`}
          style={{ height: `${fill}%` }} />
      </div>

      <span className={`mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
        highlight ? 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 shadow-sm' : 'bg-zinc-50 text-zinc-600 ring-1 ring-inset ring-black/5'
      }`}>
        {icon} {label}
      </span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-lg sm:text-xl font-bold text-zinc-900 mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function Selector({ label, value, onChange, options }) {
  return (
    <div className="space-y-1.5 w-full sm:w-auto min-w-[150px]">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm transition-colors cursor-pointer truncate">
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

function Legend({ color, text }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2.5 rounded-sm ${color} shadow-sm`} />
      <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">{text}</span>
    </div>
  );
}