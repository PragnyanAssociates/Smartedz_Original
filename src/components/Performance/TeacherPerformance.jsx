import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  RefreshCw, Loader2, ChevronDown, ChevronUp, BarChart3, Search, X,
  ArrowUpDown, Table2, User
} from 'lucide-react';
import { roundPct, band } from './PerfUtils';
import { PerfBar, BarRow, ChartModal } from './PerfBar';

// =====================================================================
//  TeacherPerformance - ranks teachers by their students' results.
//   - Class / Subject / Exam-type filters + High->Low / Low->High sort.
//   - "Table" button: detailed per class+subject breakdown (image 8).
//   - "Analysis" button: exam-wise + class-filter bar chart (image 9).
//
//  A teacher's % = sum(marks obtained by their students in the
//  classes+subjects they're assigned) / sum(possible), filtered live.
//  Bands: 100-80 green, 80-50 blue, 50-0 red. Active academic year only.
// =====================================================================

// Compute a teacher's obtained/possible (+ per class/subject breakdown)
// under the given class/subject/exam filters.
function teacherTotals(teacher, { classId = 'all', subjectId = 'all', examTypeId = 'all' } = {}) {
  let obtained = 0, possible = 0;
  const breakdown = [];
  (teacher.detail || []).forEach(d => {
    if (classId !== 'all' && String(d.class_id) !== String(classId)) return;
    if (subjectId !== 'all' && String(d.subject_id) !== String(subjectId)) return;
    let o = 0, p = 0;
    (d.exams || []).forEach(e => {
      if (examTypeId !== 'all' && String(e.exam_type_id) !== String(examTypeId)) return;
      o += e.obtained; p += e.possible;
    });
    if (p > 0) {
      obtained += o; possible += p;
      breakdown.push({
        class_id: d.class_id, class_group: d.class_group,
        subject_id: d.subject_id, subject_name: d.subject_name,
        student_count: d.student_count,
        obtained: o, possible: p, pct: roundPct((o / p) * 100)
      });
    }
  });
  return { obtained, possible, pct: possible > 0 ? roundPct((obtained / possible) * 100) : null, breakdown };
}

export default function TeacherPerformance() {
  const { user } = useAuth();

  const [data, setData]         = useState({ examTypes: [], teachers: [] });
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('all');
  const [query, setQuery]       = useState('');
  const [expanded, setExpanded] = useState(null);

  // Filters
  const [classId, setClassId]       = useState('all');
  const [subjectId, setSubjectId]   = useState('all');
  const [examTypeId, setExamTypeId] = useState('all');
  const [sortOrder, setSortOrder]   = useState('high');   // 'high' | 'low'

  // Modals
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showTable, setShowTable]       = useState(false);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    setExpanded(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/performance/teachers/${user.institutionId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setData({ examTypes: d.examTypes || [], teachers: d.teachers || [] });
    } catch (e) { alert(e.message); setData({ examTypes: [], teachers: [] }); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Filter option lists derived from the data
  const classOptions = useMemo(() => {
    const m = new Map();
    data.teachers.forEach(t => (t.detail || []).forEach(d => m.set(String(d.class_id), d.class_group)));
    return [...m.entries()].map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const subjectOptions = useMemo(() => {
    const m = new Map();
    data.teachers.forEach(t => (t.detail || []).forEach(d => m.set(String(d.subject_id), d.subject_name)));
    return [...m.entries()].map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  // Rank teachers by filtered totals
  const ranked = useMemo(() => {
    const rows = data.teachers
      .map(t => {
        const tot = teacherTotals(t, { classId, subjectId, examTypeId });
        return { ...t, ...tot };
      })
      .filter(t => t.possible > 0);
    rows.sort((a, b) => sortOrder === 'low' ? a.pct - b.pct : b.pct - a.pct);
    return rows.map((t, i) => ({ ...t, rank: i + 1 }));
  }, [data, classId, subjectId, examTypeId, sortOrder]);

  const counts = useMemo(() => {
    const c = { all: ranked.length, top: 0, avg: 0, low: 0 };
    ranked.forEach(t => {
      if (t.pct >= 80) c.top++;
      else if (t.pct >= 50) c.avg++;
      else c.low++;
    });
    return c;
  }, [ranked]);

  const visible = useMemo(() => {
    let list = ranked;
    if (tab === 'top') list = list.filter(t => t.pct >= 80);
    else if (tab === 'avg') list = list.filter(t => t.pct >= 50 && t.pct < 80);
    else if (tab === 'low') list = list.filter(t => t.pct < 50);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(t => (t.teacher_name || '').toLowerCase().includes(q));
    }
    return list;
  }, [ranked, tab, query]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 gap-4 sm:gap-6 animate-in fade-in duration-300">

      {/* Legend & Context */}
      <div className="bg-amber-50/50 border border-amber-200/60 rounded-md px-4 py-3 flex flex-wrap gap-4 sm:gap-6 items-center shrink-0">
        <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">
          A teacher's score is the average result of their students
        </span>
        <div className="flex flex-wrap gap-4 ml-auto sm:ml-0">
          <Legend color="bg-emerald-500" text="80%+" />
          <Legend color="bg-blue-500" text="50-80%" />
          <Legend color="bg-red-500" text="Below 50%" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
        <Selector label="Class" value={classId} onChange={setClassId}
          options={[{ value: 'all', label: 'All Classes' }, ...classOptions]} />
        <Selector label="Subject" value={subjectId} onChange={setSubjectId}
          options={[{ value: 'all', label: 'All Subjects' }, ...subjectOptions]} />
        <Selector label="Exam Type" value={examTypeId} onChange={setExamTypeId}
          options={[{ value: 'all', label: 'All Exams' }, ...data.examTypes.map(t => ({ value: String(t.id), label: t.name }))]} />

        <div className="flex-1 min-w-[120px]" />

        <div className="relative w-full sm:w-56 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search teacher..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 transition-colors">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <button onClick={() => setShowTable(true)} disabled={ranked.length === 0}
          className="h-9 px-4 inline-flex items-center justify-center gap-2 bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-200 disabled:opacity-50 rounded-md text-xs font-semibold shadow-sm transition-colors shrink-0 w-full sm:w-auto">
          <Table2 className="size-3.5" /> Table
        </button>
        <button onClick={() => setShowAnalysis(true)} disabled={ranked.length === 0}
          className="h-9 px-4 inline-flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200 disabled:opacity-50 rounded-md text-xs font-semibold shadow-sm transition-colors shrink-0 w-full sm:w-auto">
          <BarChart3 className="size-3.5" /> Analysis
        </button>
        <button onClick={load} title="Refresh Data"
          className="h-9 px-3 bg-white border border-zinc-200 text-zinc-600 hover:text-primary hover:bg-zinc-50 rounded-md flex items-center justify-center transition-colors shadow-sm shrink-0 w-full sm:w-auto">
          <RefreshCw className="size-4" />
        </button>
      </div>

      {ranked.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center flex-1 min-h-[300px]">
          <BarChart3 className="size-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium text-sm">No teacher performance data for this selection.</p>
          <p className="text-zinc-400 text-xs mt-1">
            Assign teachers to class+subject in <span className="font-semibold text-zinc-500">Reports -{'>'} Exam Setup</span> and enter marks first.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:gap-6 flex-1">
          {/* Category tabs + sort */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 shrink-0">
            <div className="flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar flex-1">
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
            <SortControl mode={sortOrder} onChange={setSortOrder} />
          </div>

          {/* Ranked list */}
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-zinc-50/80 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-16 text-center">Rank</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Teacher</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-32">Class/Subjects</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-1/4">Performance</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right w-32">Marks</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visible.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-zinc-400 text-sm font-medium">No teachers in this view.</td></tr>
                ) : visible.map(t => {
                  const b = band(t.pct);
                  const isOpen = expanded === t.teacher_id;
                  return (
                    <React.Fragment key={t.teacher_id}>
                      <tr className="hover:bg-zinc-50/60 transition-colors cursor-pointer group"
                        onClick={() => setExpanded(isOpen ? null : t.teacher_id)}>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-flex items-center justify-center size-7 rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-black/5">
                            {t.rank}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-sm text-zinc-900">{t.teacher_name}</td>
                        <td className="px-5 py-3 text-xs font-medium text-zinc-500">
                          {t.breakdown.length} class{t.breakdown.length !== 1 ? 'es' : ''}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col gap-1.5 justify-center w-full pr-4">
                            <span className={`text-[11px] font-semibold ${b.text}`}>{t.pct}%</span>
                            <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-1.5 rounded-full ${b.bar}`} style={{ width: `${Math.min(t.pct, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="text-sm font-bold text-zinc-900 tabular-nums">{Math.round(t.obtained)}</div>
                          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mt-0.5">of {Math.round(t.possible)}</div>
                        </td>
                        <td className="px-5 py-3 text-zinc-300 group-hover:text-primary transition-colors text-center">
                          {isOpen ? <ChevronUp className="size-4 mx-auto" /> : <ChevronDown className="size-4 mx-auto" />}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="bg-zinc-50/50 border-t-0">
                          <td colSpan={6} className="p-4 sm:p-5">
                            <div className="mb-4 bg-white p-3 rounded-md ring-1 ring-black/5 shadow-sm">
                              <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                                Class & Subject Breakdown
                              </h4>
                              {t.teacher_email && (
                                <p className="text-[11px] text-zinc-400 mt-1">{t.teacher_email}</p>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {t.breakdown.map((d, i) => {
                                const db = band(d.pct);
                                return (
                                  <div key={i} className="bg-white border border-zinc-200 rounded-md p-3 flex justify-between items-center shadow-sm">
                                    <div className="min-w-0 pr-3">
                                      <div className="text-sm font-semibold text-zinc-800 truncate">{d.class_group}</div>
                                      <div className="text-[11px] font-medium text-zinc-500 truncate mt-0.5">{d.subject_name}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${db.bg} ${db.text}`}>
                                        {d.pct}%
                                      </span>
                                      <div className="text-[10px] font-medium text-zinc-400 mt-1 uppercase tracking-wider tabular-nums">
                                        {Math.round(d.obtained)}/{Math.round(d.possible)}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
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

      {/* ---- TABLE MODAL (image 8): detailed per class+subject ---- */}
      {showTable && (
        <TeacherTableModal
          rows={visible}
          examLabel={examTypeId === 'all' ? 'All Exams' : (data.examTypes.find(t => String(t.id) === examTypeId)?.name || '')}
          onClose={() => setShowTable(false)} />
      )}

      {/* ---- ANALYSIS MODAL (image 9): exam-wise + class filter ---- */}
      {showAnalysis && (
        <TeacherAnalysisModal
          teachers={data.teachers}
          examTypes={data.examTypes}
          classOptions={classOptions}
          initialExam={examTypeId !== 'all' ? examTypeId : (data.examTypes[0]?.id ? String(data.examTypes[0].id) : 'all')}
          initialClass={classId}
          onClose={() => setShowAnalysis(false)} />
      )}
    </div>
  );
}


// =====================================================================
//  Table modal image 8 layout: S.No, teacher (avatar + classes count),
//  Class/Subject list with per-row %, Performance.
// =====================================================================
function TeacherTableModal({ rows, examLabel, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-lg font-black text-slate-800">Teacher Performance - Table</h3>
            <p className="text-xs text-slate-500 font-medium">{examLabel} - class &amp; subject breakdown</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={22} /></button>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase text-slate-500 tracking-wider w-16">S.No</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Name</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Class/Subject</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase text-slate-500 tracking-wider text-right w-32">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((t, idx) => (
                <tr key={t.teacher_id} className="align-top">
                  <td className="px-5 py-4 text-sm font-semibold text-slate-500">{idx + 1}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-slate-100 ring-1 ring-black/5 flex items-center justify-center shrink-0">
                        <User className="size-5 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{t.teacher_name}</div>
                        <div className="text-[11px] text-slate-400 font-medium">{t.breakdown.length} Class{t.breakdown.length !== 1 ? 'es' : ''} Assigned</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-1.5">
                      {t.breakdown.map((d, i) => (
                        <div key={i} className="text-sm text-slate-700">
                          <span className="font-semibold text-slate-800">{d.class_group}</span>
                          <span className="text-slate-300"> | </span>
                          <span className="text-slate-500">{d.subject_name}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="space-y-1.5">
                      {t.breakdown.map((d, i) => {
                        const db = band(d.pct);
                        return (
                          <div key={i} className={`text-sm font-bold ${db.text} tabular-nums`}>{d.pct}%</div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// =====================================================================
//  Analysis modal image 9: EXAM WISE + CLASS FILTER + sort, one bar
//  per teacher for the chosen exam.
// =====================================================================
function TeacherAnalysisModal({ teachers, examTypes, classOptions, initialExam, initialClass, onClose }) {
  const [examTypeId, setExamTypeId] = useState(initialExam || (examTypes[0]?.id ? String(examTypes[0].id) : 'all'));
  const [classId, setClassId]       = useState(initialClass || 'all');
  const [sortOrder, setSortOrder]   = useState('high');

  const bars = useMemo(() => {
    const rows = teachers.map(t => {
      const tot = teacherTotals(t, { classId, subjectId: 'all', examTypeId });
      const subjects = [...new Set(tot.breakdown.map(d => d.subject_name))].join(', ');
      return { teacher_id: t.teacher_id, teacher_name: t.teacher_name, subjects, ...tot };
    }).filter(t => t.possible > 0);
    rows.sort((a, b) => sortOrder === 'low' ? a.pct - b.pct : b.pct - a.pct);
    return rows;
  }, [teachers, classId, examTypeId, sortOrder]);

  const examLabel = examTypeId === 'all' ? 'All Exams' : (examTypes.find(t => String(t.id) === examTypeId)?.name || '');

  const filters = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4">
      <Selector label="Exam Wise" value={examTypeId} onChange={setExamTypeId}
        options={[
          { value: 'all', label: 'All Exams' },
          ...examTypes.map(t => ({ value: String(t.id), label: t.name }))
        ]} />
      <Selector label="Class Filter" value={classId} onChange={setClassId}
        options={[{ value: 'all', label: 'All Classes' }, ...classOptions]} />
      <Selector label="Sort Order" value={sortOrder} onChange={setSortOrder}
        options={[{ value: 'high', label: 'High to Low' }, { value: 'low', label: 'Low to High' }]} />
    </div>
  );

  return (
    <ChartModal
      title="Teacher Performance Metrics"
      subtitle={`Performance - ${examLabel}`}
      onClose={onClose}
      filters={filters}>
      <BarRow empty="No teacher data to chart for this selection.">
        {bars.map(t => (
          <PerfBar key={t.teacher_id}
            percentage={t.pct}
            label={t.teacher_name}
            subLabel={t.subjects}
            marks={`${Math.round(t.obtained)}/${Math.round(t.possible)}`} />
        ))}
      </BarRow>
    </ChartModal>
  );
}


function SortControl({ mode, onChange }) {
  const opts = [
    { id: 'high', label: 'High -> Low' },
    { id: 'low',  label: 'Low -> High' }
  ];
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        <ArrowUpDown className="size-3.5" /> Sort
      </span>
      <div className="inline-flex items-center bg-white border border-zinc-200 rounded-md p-0.5 shadow-sm">
        {opts.map(o => (
          <button key={o.id} onClick={() => onChange(o.id)}
            className={`px-3 h-7 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
              mode === o.id ? 'bg-primary text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
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