import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  RefreshCw, Loader2, ChevronDown, ChevronUp, BarChart3,
  Search, Users
} from 'lucide-react';
import { roundPct, band } from './PerfUtils';

// =====================================================================
//  TeacherPerformance — ranks teachers by their students' results.
//
//  A teacher's % = sum(marks obtained by students in the classes+
//  subjects they're assigned via subject_teacher_map) / sum(possible).
//  Expand a row → per class+subject breakdown.
// =====================================================================

export default function TeacherPerformance() {
  const { user } = useAuth();

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('all');
  const [query, setQuery]       = useState('');
  const [expanded, setExpanded] = useState(null);

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

  // Rank teachers — only those with measurable data (possible > 0).
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
    return <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-wrap gap-5 items-center">
        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
          A teacher's score is the average result of their students
        </span>
        <Legend color="bg-emerald-500" text="≥ 85%" />
        <Legend color="bg-blue-500" text="50–85%" />
        <Legend color="bg-red-500" text="< 50%" />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search teacher…"
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
        </div>
        <div className="flex-1" />
        <button onClick={load}
          className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {ranked.length === 0 ? (
        <div className="bg-white p-14 rounded-3xl border border-dashed border-slate-200 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No teacher performance data yet.</p>
          <p className="text-slate-400 text-sm mt-1">
            Assign teachers to class+subject in <strong>Reports → Exam Setup</strong> and enter marks first.
          </p>
        </div>
      ) : (
        <>
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            {[
              { id: 'all', label: 'All' },
              { id: 'top', label: 'Above Average' },
              { id: 'avg', label: 'Average' },
              { id: 'low', label: 'Below Average' }
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {t.label} ({counts[t.id]})
              </button>
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <tr>
                  <th className="p-4 w-16">Rank</th>
                  <th className="p-4">Teacher</th>
                  <th className="p-4">Assignments</th>
                  <th className="p-4 w-1/4">Performance</th>
                  <th className="p-4 text-right w-32">Marks</th>
                  <th className="p-4 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visible.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic">No teachers in this view.</td></tr>
                ) : visible.map(t => {
                  const b = band(t.pct);
                  const isOpen = expanded === t.teacher_id;
                  return (
                    <React.Fragment key={t.teacher_id}>
                      <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => setExpanded(isOpen ? null : t.teacher_id)}>
                        <td className="p-4">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-xs font-black text-slate-600">
                            {t.rank}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-700">{t.teacher_name}</td>
                        <td className="p-4 text-xs font-medium text-slate-500">
                          {t.detail.length} class{t.detail.length !== 1 ? 'es' : ''}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-black ${b.text}`}>{t.pct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className={`h-2 rounded-full ${b.bar}`} style={{ width: `${Math.min(t.pct, 100)}%` }} />
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="text-sm font-black text-slate-800">{Math.round(t.overall_obtained)}</div>
                          <div className="text-xs text-slate-400">of {Math.round(t.overall_possible)}</div>
                        </td>
                        <td className="p-4 text-slate-300">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={6} className="p-5">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                              Class &amp; Subject Breakdown
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {t.detail.map((d, i) => {
                                const hasData = d.total_possible > 0;
                                const pct = hasData ? roundPct(d.percentage) : null;
                                const db = hasData ? band(pct) : null;
                                return (
                                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center">
                                    <div>
                                      <div className="text-sm font-bold text-slate-700">{d.class_group}</div>
                                      <div className="text-xs text-slate-400">{d.subject_name}</div>
                                    </div>
                                    <div className="text-right">
                                      {hasData ? (
                                        <>
                                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${db.bg} ${db.text}`}>
                                            {pct}%
                                          </span>
                                          <div className="text-[10px] text-slate-400 mt-0.5">
                                            {Math.round(d.total_obtained)}/{Math.round(d.total_possible)}
                                          </div>
                                        </>
                                      ) : (
                                        <span className="text-[10px] text-slate-300 italic">No marks yet</span>
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
        </>
      )}
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