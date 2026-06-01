import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  RefreshCw, Loader2, ChevronDown, ChevronUp, BarChart3, Search, X
} from 'lucide-react';
import { roundPct, band } from './PerfUtils';
import { PerfBar, BarRow, ChartModal } from './PerfBar';

// =====================================================================
//  TeacherPerformance - ranks teachers by their students' results,
//  plus a graphical Analysis comparison.
//
//  A teacher's % = sum(marks obtained by students in the classes+
//  subjects they're assigned via subject_teacher_map) / sum(possible).
// =====================================================================

export default function TeacherPerformance() {
  const { user } = useAuth();

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('all');
  const [query, setQuery]       = useState('');
  const [expanded, setExpanded] = useState(null);

  // Chart modals
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [graphTeacher, setGraphTeacher] = useState(null);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    setExpanded(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/performance/teachers/${user.institutionId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setTeachers(d || []);
    } catch (e) { alert(e.message); setTeachers([]); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Rank teachers - only those with measurable data.
  const ranked = useMemo(() => {
    const measurable = teachers
      .filter(t => t.overall_possible > 0)
      .map(t => ({ ...t, pct: roundPct(t.overall_percentage) }));
    measurable.sort((a, b) => b.pct - a.pct);
    return measurable.map((t, i) => ({ ...t, rank: i + 1 }));
  }, [teachers]);

  const counts = useMemo(() => {
    const c = { all: ranked.length, top: 0, avg: 0, low: 0 };
    ranked.forEach(t => {
      if (t.pct >= 85) c.top++;
      else if (t.pct >= 50) c.avg++;
      else c.low++;
    });
    return c;
  }, [ranked]);

  const visible = useMemo(() => {
    let list = ranked;
    if (tab === 'top') list = list.filter(t => t.pct >= 85);
    else if (tab === 'avg') list = list.filter(t => t.pct >= 50 && t.pct < 85);
    else if (tab === 'low') list = [...list.filter(t => t.pct < 50)].sort((a, b) => a.pct - b.pct);
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
          <Legend color="bg-emerald-500" text="85%+" />
          <Legend color="bg-primary" text="50-85%" />
          <Legend color="bg-red-500" text="Below 50%" />
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72 shrink-0">
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
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button onClick={() => setShowAnalysis(true)} disabled={ranked.length === 0}
            className="h-9 px-4 inline-flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200 disabled:opacity-50 rounded-md text-xs font-semibold shadow-sm transition-colors shrink-0 w-full sm:w-auto">
            <BarChart3 className="size-3.5" /> Analysis
          </button>
          
          <button onClick={load} title="Refresh Data"
            className="h-9 px-3 bg-white border border-zinc-200 text-zinc-600 hover:text-primary hover:bg-zinc-50 rounded-md flex items-center justify-center transition-colors shadow-sm shrink-0 w-full sm:w-auto">
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center flex-1 min-h-[300px]">
          <BarChart3 className="size-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium text-sm">No teacher performance data yet.</p>
          <p className="text-zinc-400 text-xs mt-1">
            Assign teachers to class+subject in <span className="font-semibold text-zinc-500">Reports -{'>'} Exam Setup</span> and enter marks first.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:gap-6 flex-1">
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
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Teacher</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-32">Assignments</th>
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
                          {t.detail.length} class{t.detail.length !== 1 ? 'es' : ''}
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
                          <div className="text-sm font-bold text-zinc-900 tabular-nums">{Math.round(t.overall_obtained)}</div>
                          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mt-0.5">of {Math.round(t.overall_possible)}</div>
                        </td>
                        <td className="px-5 py-3 text-zinc-300 group-hover:text-primary transition-colors text-center">
                          {isOpen ? <ChevronUp className="size-4 mx-auto" /> : <ChevronDown className="size-4 mx-auto" />}
                        </td>
                      </tr>
                      
                      {isOpen && (
                        <tr className="bg-zinc-50/50 border-t-0">
                          <td colSpan={6} className="p-4 sm:p-5">
                            <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-md ring-1 ring-black/5 shadow-sm">
                              <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                                Class & Subject Breakdown
                              </h4>
                              <button onClick={(e) => { e.stopPropagation(); setGraphTeacher(t); }}
                                className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-md bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 hover:text-orange-700 text-xs font-semibold transition-colors shadow-sm">
                                <BarChart3 className="size-3.5" /> Graph
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {t.detail.map((d, i) => {
                                const hasData = d.total_possible > 0;
                                const pct = hasData ? roundPct(d.percentage) : null;
                                const db = hasData ? band(pct) : null;
                                return (
                                  <div key={i} className="bg-white border border-zinc-200 rounded-md p-3 flex justify-between items-center shadow-sm">
                                    <div className="min-w-0 pr-3">
                                      <div className="text-sm font-semibold text-zinc-800 truncate">{d.class_group}</div>
                                      <div className="text-[11px] font-medium text-zinc-500 truncate mt-0.5">{d.subject_name}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      {hasData ? (
                                        <div className="flex flex-col items-end">
                                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${db.bg} ${db.text} ring-${db.text.split('-')[1]}-600/20`}>
                                            {pct}%
                                          </span>
                                          <div className="text-[10px] font-medium text-zinc-400 mt-1 uppercase tracking-wider tabular-nums">
                                            {Math.round(d.total_obtained)}/{Math.round(d.total_possible)}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-[11px] font-medium text-zinc-400 italic bg-zinc-50 px-2 py-1 rounded border border-zinc-100">No marks</span>
                                      )}
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

      {/* ---- ANALYSIS MODAL: teacher comparison bar chart ---- */}
      {showAnalysis && (
        <ChartModal
          title="Teacher Analysis"
          subtitle="All teachers ranked by their students' average performance"
          onClose={() => setShowAnalysis(false)}>
          <BarRow empty="No teacher data to chart.">
            {ranked.map(t => (
              <PerfBar key={t.teacher_id}
                percentage={t.pct}
                label={t.teacher_name}
                subLabel={`${t.detail.length} class${t.detail.length !== 1 ? 'es' : ''}`}
                marks={`${Math.round(t.overall_obtained)}/${Math.round(t.overall_possible)}`}
                highlight={t.rank === 1} />
            ))}
          </BarRow>
        </ChartModal>
      )}

      {/* ---- GRAPH MODAL: one teacher's class+subject breakdown ---- */}
      {graphTeacher && (
        <ChartModal
          title={`Breakdown - ${graphTeacher.teacher_name}`}
          subtitle="Performance per assigned class and subject"
          onClose={() => setGraphTeacher(null)}>
          <BarRow empty="No marks recorded for this teacher's classes.">
            {graphTeacher.detail
              .filter(d => d.total_possible > 0)
              .map((d, i) => (
                <PerfBar key={i}
                  percentage={roundPct(d.percentage)}
                  label={d.subject_name}
                  subLabel={d.class_group}
                  marks={`${Math.round(d.total_obtained)}/${Math.round(d.total_possible)}`} />
              ))}
          </BarRow>
        </ChartModal>
      )}
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