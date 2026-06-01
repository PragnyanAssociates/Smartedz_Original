import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  RefreshCw, Loader2, ChevronDown, ChevronUp, BarChart3,
  Trophy, GraduationCap, Search, X
} from 'lucide-react';
import { roundPct, band, buildStudentTotals, studentExamBreakdown } from './PerfUtils';
import { PerfBar, BarRow, ChartModal } from './PerfBar';

// =====================================================================
//  StudentPerformance - ranked class list + graphical Analysis.
//   - Table view: rank, %, marks, expand for exam breakdown.
//   - Analysis button -> bar-chart comparison of the whole class.
//   - Each expanded row -> "Graph" button for that student's exams.
//  All driven by the dynamic Reports tables - no hardcoded subjects.
// =====================================================================

export default function StudentPerformance() {
  const { user } = useAuth();

  const [classes, setClasses]       = useState([]);
  const [classId, setClassId]       = useState('');
  const [dataset, setDataset]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [loadingClasses, setLC]     = useState(true);

  const [examTypeId, setExamTypeId] = useState('overall');
  const [subjectId, setSubjectId]   = useState('all');
  const [tab, setTab]               = useState('all');
  const [query, setQuery]           = useState('');
  const [expanded, setExpanded]     = useState(null);

  // Chart modals
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [graphStudent, setGraphStudent] = useState(null);

  // --- Load class list -------------------------------------------
  useEffect(() => {
    if (!user?.institutionId) return;
    (async () => {
      setLC(true);
      try {
        const res = await fetch(`${API_BASE_URL}/admin/performance/classes/${user.institutionId}`);
        const d = await res.json();
        setClasses(d || []);
        if (d && d.length > 0) setClassId(String(d[0].id));
      } catch (e) { console.error(e); }
      setLC(false);
    })();
  }, [user]);

  // --- Load dataset for chosen class -----------------------------
  const loadClass = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setExpanded(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/performance/class/${classId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setDataset(d);
      setExamTypeId('overall');
      setSubjectId('all');
    } catch (e) { alert(e.message); setDataset(null); }
    setLoading(false);
  }, [classId]);

  useEffect(() => { loadClass(); }, [loadClass]);

  // --- Computed ---------------------------------------------------
  const ranked = useMemo(
    () => buildStudentTotals(dataset, { examTypeId, subjectId }),
    [dataset, examTypeId, subjectId]
  );

  const counts = useMemo(() => {
    const c = { all: ranked.length, top: 0, avg: 0, low: 0 };
    ranked.forEach(r => {
      if (r.percentage >= 85) c.top++;
      else if (r.percentage >= 50) c.avg++;
      else c.low++;
    });
    return c;
  }, [ranked]);

  const visible = useMemo(() => {
    let list = ranked;
    if (tab === 'top') list = list.filter(r => r.percentage >= 85);
    else if (tab === 'avg') list = list.filter(r => r.percentage >= 50 && r.percentage < 85);
    else if (tab === 'low') list = [...list.filter(r => r.percentage < 50)]
      .sort((a, b) => a.percentage - b.percentage);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        String(r.roll_no || '').toLowerCase().includes(q));
    }
    return list;
  }, [ranked, tab, query]);

  const topper = ranked[0] || null;
  const classLabel = classes.find(c => String(c.id) === String(classId))?.class_group || '';
  const examLabel = examTypeId === 'overall'
    ? 'Overall'
    : (dataset?.examTypes || []).find(t => String(t.id) === examTypeId)?.name || '';
  const subjectLabel = subjectId === 'all'
    ? 'All Subjects'
    : (dataset?.subjects || []).find(s => String(s.id) === subjectId)?.name || '';

  // ---------------------------------------------------------------
  if (loadingClasses) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }
  if (classes.length === 0) {
    return (
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center flex-1">
        <GraduationCap className="size-10 text-zinc-300 mx-auto mb-3" />
        <p className="text-zinc-500 font-medium text-sm">No classes found.</p>
        <p className="text-zinc-400 text-xs mt-1">Create classes first to view performance data.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 gap-4 sm:gap-6 animate-in fade-in duration-300">
      
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 sm:gap-4 bg-white p-4 rounded-lg ring-1 ring-black/5 shadow-sm">
        <Selector label="Class" value={classId} onChange={setClassId}
          options={classes.map(c => ({ value: String(c.id), label: c.class_group }))} />
        <Selector label="Exam" value={examTypeId} onChange={setExamTypeId}
          options={[
            { value: 'overall', label: 'Overall' },
            ...((dataset?.examTypes || []).map(t => ({ value: String(t.id), label: t.name })))
          ]} />
        <Selector label="Subject" value={subjectId} onChange={setSubjectId}
          options={[
            { value: 'all', label: 'All Subjects' },
            ...((dataset?.subjects || []).map(s => ({ value: String(s.id), label: s.name })))
          ]} />
          
        <div className="flex-1 min-w-[200px]" />
        
        <div className="relative w-full sm:w-56 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search student..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 transition-colors">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        
        <button onClick={() => setShowAnalysis(true)} disabled={ranked.length === 0}
          className="h-9 px-4 inline-flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200 disabled:opacity-50 rounded-md text-xs font-semibold shadow-sm transition-colors shrink-0 w-full sm:w-auto">
          <BarChart3 className="size-3.5" /> Analysis
        </button>
        
        <button onClick={loadClass} title="Refresh Data"
          className="h-9 px-3 bg-white border border-zinc-200 text-zinc-600 hover:text-primary hover:bg-zinc-50 rounded-md flex items-center justify-center transition-colors shadow-sm shrink-0 w-full sm:w-auto">
          <RefreshCw className="size-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="bg-amber-50/50 border border-amber-200/60 rounded-md px-4 py-3 flex flex-wrap gap-4 sm:gap-6 items-center shrink-0">
        <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Performance Index</span>
        <div className="flex flex-wrap gap-4">
          <Legend color="bg-emerald-500" text="85%+ Excellent" />
          <Legend color="bg-primary" text="50-85% Average" />
          <Legend color="bg-red-500" text="Below 50% Needs Work" />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <Loader2 className="animate-spin size-8 text-primary" />
        </div>
      ) : !dataset || (dataset.examTypes || []).length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center flex-1 min-h-[300px]">
          <BarChart3 className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 font-medium text-sm">No exam marks for this class yet.</p>
          <p className="text-zinc-400 text-xs mt-1">
            Configure exam types and enter marks in <strong>Reports</strong> first.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:gap-6 flex-1">
          {/* Topper highlight */}
          {topper && (
            <div className="bg-gradient-to-r from-amber-50/80 to-white border border-amber-200/60 rounded-lg p-4 sm:p-5 flex items-center gap-4 shadow-sm shrink-0">
              <div className="size-10 sm:size-12 bg-amber-100 rounded-md flex items-center justify-center text-amber-600 shrink-0 ring-1 ring-amber-200/50">
                <Trophy className="size-5 sm:size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-0.5">Class Topper</div>
                <div className="font-semibold text-zinc-900 truncate text-sm sm:text-base">{topper.name}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg sm:text-2xl font-bold text-zinc-900 tabular-nums leading-none">{topper.percentage}%</div>
                <div className="text-[11px] font-medium text-zinc-500 mt-1 uppercase tracking-wider">
                  {Math.round(topper.obtained)} / {Math.round(topper.possible)}
                </div>
              </div>
            </div>
          )}

          {/* Category tabs */}
          <div className="flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar shrink-0">
            {[
              { id: 'all', label: 'All' },
              { id: 'top', label: 'Above Average' },
              { id: 'avg', label: 'Average' },
              { id: 'low', label: 'Below Average' }
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  tab === t.id ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50/50'
                }`}>
                {t.label} ({counts[t.id]})
              </button>
            ))}
          </div>

          {/* Ranked list */}
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-zinc-50/80 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-16 text-center">Rank</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Student</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-24">Roll</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-1/3">Performance</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right w-32">Marks</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visible.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-zinc-400 text-sm font-medium">No students in this view.</td></tr>
                ) : visible.map(r => {
                  const b = band(r.percentage);
                  const isOpen = expanded === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <tr className="hover:bg-zinc-50/60 transition-colors cursor-pointer group"
                        onClick={() => setExpanded(isOpen ? null : r.id)}>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-flex items-center justify-center size-7 rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-black/5">
                            {r.rank}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-sm text-zinc-900">{r.name}</td>
                        <td className="px-5 py-3 text-sm font-medium text-zinc-500">{r.roll_no || '-'}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col gap-1.5 justify-center w-full pr-4">
                            <span className={`text-[11px] font-semibold ${b.text}`}>{r.percentage}%</span>
                            <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-1.5 rounded-full ${b.bar}`} style={{ width: `${Math.min(r.percentage, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="text-sm font-bold text-zinc-900 tabular-nums">{Math.round(r.obtained)}</div>
                          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mt-0.5">of {Math.round(r.possible)}</div>
                        </td>
                        <td className="px-5 py-3 text-zinc-300 group-hover:text-primary transition-colors text-center">
                          {isOpen ? <ChevronUp className="size-4 mx-auto" /> : <ChevronDown className="size-4 mx-auto" />}
                        </td>
                      </tr>
                      
                      {isOpen && (
                        <tr className="bg-zinc-50/50 border-t-0">
                          <td colSpan={6} className="p-4 sm:p-5">
                            <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-md ring-1 ring-black/5 shadow-sm">
                              <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                <GraduationCap className="size-3.5" /> Exam Breakdown
                              </h4>
                              <button onClick={(e) => { e.stopPropagation(); setGraphStudent(r); }}
                                className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-md bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 hover:text-orange-700 text-xs font-semibold transition-colors shadow-sm">
                                <BarChart3 className="size-3.5" /> Graph
                              </button>
                            </div>
                            <ExamBreakdown dataset={dataset} studentId={r.id} />
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
      )}

      {/* ---- ANALYSIS MODAL: class comparison bar chart ---- */}
      {showAnalysis && (
        <ChartModal
          title={`Class Analysis - ${classLabel}`}
          subtitle={`${examLabel} / ${subjectLabel} / ranked by performance`}
          onClose={() => setShowAnalysis(false)}>
          <BarRow empty="No marks to chart for this selection.">
            {ranked.map(r => (
              <PerfBar key={r.id}
                percentage={r.percentage}
                label={r.name}
                subLabel={`Roll ${r.roll_no || '-'}`}
                marks={`${Math.round(r.obtained)}/${Math.round(r.possible)}`}
                highlight={r.rank === 1} />
            ))}
          </BarRow>
        </ChartModal>
      )}

      {/* ---- EXAM GRAPH MODAL: one student's exams ---- */}
      {graphStudent && (
        <ChartModal
          title={`Exam Analysis - ${graphStudent.name}`}
          subtitle={`${classLabel} / exam-by-exam performance`}
          onClose={() => setGraphStudent(null)}>
          <BarRow empty="No exam-wise marks recorded.">
            {studentExamBreakdown(dataset, graphStudent.id).map(ex => (
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

// --- Sub: a single student's exam-by-exam breakdown (cards) --------
function ExamBreakdown({ dataset, studentId }) {
  const rows = useMemo(() => studentExamBreakdown(dataset, studentId), [dataset, studentId]);
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-400 font-medium italic p-4 text-center bg-white rounded-md ring-1 ring-black/5 border-dashed">No exam-wise marks recorded.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {rows.map(ex => {
        const b = band(ex.percentage);
        return (
          <div key={ex.exam_type_id} className="bg-white border border-zinc-200 rounded-md p-3 flex justify-between items-center shadow-sm">
            <span className="text-xs font-semibold text-zinc-700 truncate mr-2">{ex.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium text-zinc-400 tabular-nums uppercase tracking-wider">{Math.round(ex.obtained)}/{Math.round(ex.possible)}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${b.bg} ${b.text} ring-${b.text.split('-')[1]}-600/20`}>
                {ex.percentage}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Shared Selector Component ---
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