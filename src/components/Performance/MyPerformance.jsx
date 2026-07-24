import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  RefreshCw, Loader2, BarChart3, Trophy, User, ChevronDown, TrendingUp, Star
} from 'lucide-react';
import { roundPct, band, buildStudentTotals, studentExamBreakdown } from './PerfUtils';
import { PerfBar, BarRow, ChartModal } from './PerfBar';

// =====================================================================
//  MyPerformance - the logged-in user's own view.
//   * Teacher -> their teaching performance (assigned class+subjects).
//   * Student -> Topper vs You comparison.
//  Bands: 100-80 green, 80-50 blue, 50-0 red. Active academic year only.
// =====================================================================

export default function MyPerformance() {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const isStudent = role.includes('student');

  // Teachers (and any non-student) see their teaching performance.
  if (!isStudent) return <TeacherMyPerformance user={user} />;
  return <StudentMyPerformance user={user} />;
}

// =====================================================================
//  TEACHER's own performance uses /performance/teacher/:id
// =====================================================================
function TeacherMyPerformance({ user }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [examTypeId, setExam] = useState('all');
  const [showAnalysis, setShowAnalysis] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/performance/teacher/${user.id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setData(d);
    } catch (e) { alert(e.message); setData(null); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Per class+subject totals under the selected exam filter
  const rows = useMemo(() => {
    if (!data) return [];
    return (data.detail || []).map(d => {
      let o = 0, p = 0;
      (d.exams || []).forEach(e => {
        if (examTypeId !== 'all' && String(e.exam_type_id) !== String(examTypeId)) return;
        o += e.obtained; p += e.possible;
      });
      return { ...d, obtained: o, possible: p, pct: p > 0 ? roundPct((o / p) * 100) : null };
    }).filter(r => r.possible > 0).sort((a, b) => b.pct - a.pct);
  }, [data, examTypeId]);

  const overall = useMemo(() => {
    const o = rows.reduce((s, r) => s + r.obtained, 0);
    const p = rows.reduce((s, r) => s + r.possible, 0);
    return { obtained: o, possible: p, pct: p > 0 ? roundPct((o / p) * 100) : 0 };
  }, [rows]);

  const examLabel = examTypeId === 'all'
    ? 'All Exams'
    : (data?.examTypes || []).find(t => String(t.id) === examTypeId)?.name || 'All Exams';

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }

  const hasData = data && rows.length > 0;
  const ob = band(overall.pct);

  return (
    <div className="flex flex-col flex-1 gap-4 sm:gap-6 animate-in fade-in duration-300">

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
        <Selector label="Exam" value={examTypeId} onChange={setExam}
          options={[
            { value: 'all', label: 'All Exams' },
            ...((data?.examTypes || []).map(t => ({ value: String(t.id), label: t.name })))
          ]} />

        <div className="flex-1 min-w-[100px]" />

        <button onClick={() => setShowAnalysis(true)} disabled={!hasData}
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

      {!hasData ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 shadow-sm border-dashed text-center flex flex-col items-center justify-center flex-1 min-h-[300px]">
          <BarChart3 className="size-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium text-sm">No performance data yet.</p>
          <p className="text-zinc-400 text-xs mt-1">
            Marks need to be entered for your assigned class &amp; subject in <span className="font-semibold text-zinc-500">Reports</span> first.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:gap-6 flex-1">
          {/* Overall summary */}
          <div className="bg-gradient-to-r from-amber-50/80 to-white border border-amber-200/60 rounded-lg p-4 sm:p-5 flex items-center gap-4 shadow-sm shrink-0">
            <div className="size-10 sm:size-12 bg-amber-100 rounded-md flex items-center justify-center text-amber-600 shrink-0 ring-1 ring-inset ring-amber-500/20">
              <Trophy className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-0.5">My Overall Performance - {examLabel}</div>
              <div className="font-semibold text-zinc-900 truncate text-sm sm:text-base">{data.teacher_name}</div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-lg sm:text-2xl font-semibold tabular-nums leading-none ${ob.text}`}>{overall.pct}%</div>
              <div className="text-[11px] font-medium text-zinc-500 mt-1 uppercase tracking-wider">
                {Math.round(overall.obtained)} / {Math.round(overall.possible)}
              </div>
            </div>
          </div>

          {/* Per class+subject breakdown */}
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-zinc-50/80 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Class</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Subject</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-1/3">Performance</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right w-32">Marks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r, i) => {
                  const b = band(r.pct);
                  return (
                    <tr key={i} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="px-5 py-3 font-semibold text-sm text-zinc-900">{r.class_group}</td>
                      <td className="px-5 py-3 text-sm font-medium text-zinc-500">{r.subject_name}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1.5 justify-center w-full pr-4">
                          <span className={`text-[11px] font-semibold ${b.text}`}>{r.pct}%</span>
                          <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-1.5 rounded-full ${b.bar}`} style={{ width: `${Math.min(r.pct, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="text-sm font-semibold text-zinc-900 tabular-nums">{Math.round(r.obtained)}</div>
                        <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mt-0.5">of {Math.round(r.possible)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- ANALYSIS MODAL: my class+subject chart ---- */}
      {showAnalysis && hasData && (
        <ChartModal
          title="My Performance Analysis"
          subtitle={`${examLabel} / by class and subject`}
          onClose={() => setShowAnalysis(false)}>
          <BarRow empty="No marks recorded yet.">
            {rows.map((r, i) => (
              <PerfBar key={i}
                percentage={r.pct}
                label={r.subject_name}
                subLabel={r.class_group}
                marks={`${Math.round(r.obtained)}/${Math.round(r.possible)}`} />
            ))}
          </BarRow>
        </ChartModal>
      )}
    </div>
  );
}

// =====================================================================
//  STUDENT's own performance Topper vs You
// =====================================================================
function StudentMyPerformance({ user }) {
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
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 shadow-sm border-dashed text-center flex flex-col items-center justify-center flex-1 min-h-[300px]">
        <BarChart3 className="size-10 text-zinc-300 mx-auto mb-3" />
        <p className="text-zinc-500 font-medium text-sm">You're not assigned to a class yet.</p>
        <p className="text-zinc-400 text-xs mt-1">Please contact administration.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 gap-4 sm:gap-6 animate-in fade-in duration-300">

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
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
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 shadow-sm border-dashed text-center flex flex-col items-center justify-center flex-1 min-h-[300px]">
          <BarChart3 className="size-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium text-sm">No marks recorded for this selection yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-6 sm:p-8 flex flex-col flex-1 justify-center">

          {/* Increased container height from h-[340px] to h-[420px] to accommodate taller bars */}
          <div className="flex items-end justify-center gap-12 sm:gap-24 md:gap-32 h-[420px] pt-4">
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
        <div className="text-3xl font-semibold text-zinc-900 leading-none tabular-nums">{Math.round(row.obtained)}</div>
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-1.5">of {Math.round(row.possible)}</div>
        <div className={`text-sm font-semibold ${b.text} mt-1`}>{row.percentage}%</div>
      </div>

      {/* Increased bar height from h-64 sm:h-72 to h-72 sm:h-80 */}
      <div className="w-12 sm:w-16 h-72 sm:h-80 bg-zinc-100/80 rounded-t-md flex flex-col justify-end overflow-hidden ring-1 ring-inset ring-black/5">
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
      <div className="text-lg sm:text-xl font-semibold text-zinc-900 mt-1 tabular-nums">{value}</div>
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