import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  RefreshCw, Loader2, ChevronDown, ChevronUp, BarChart3,
  Trophy, GraduationCap, Search, Filter
} from 'lucide-react';
import { roundPct, band, buildStudentTotals, studentExamBreakdown } from './PerfUtils';

// =====================================================================
//  StudentPerformance — ranked class list driven by student_marks.
//  Class + Exam + Subject filters all read from the dynamic dataset.
//  Expand a row → that student's exam-by-exam breakdown.
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
  const [tab, setTab]               = useState('all');   // all | top | avg | low
  const [query, setQuery]           = useState('');
  const [expanded, setExpanded]     = useState(null);

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

  // --- Compute ranked rows ---------------------------------------
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

  // ---------------------------------------------------------------
  if (loadingClasses) {
    return <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }
  if (classes.length === 0) {
    return (
      <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
        <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">No classes found. Create classes first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
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
        <div className="flex-1" />
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search student…"
            className="bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 w-48" />
        </div>
        <button onClick={loadClass}
          className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Performance band legend */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-wrap gap-5 items-center">
        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Performance Index</span>
        <Legend color="bg-emerald-500" text="≥ 85% Excellent" />
        <Legend color="bg-blue-500" text="50–85% Average" />
        <Legend color="bg-red-500" text="< 50% Needs Work" />
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : !dataset || (dataset.examTypes || []).length === 0 ? (
        <div className="bg-white p-14 rounded-3xl border border-dashed border-slate-200 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No exam marks for this class yet.</p>
          <p className="text-slate-400 text-sm mt-1">
            Configure exam types and enter marks in <strong>Reports</strong> first.
          </p>
        </div>
      ) : (
        <>
          {/* Topper highlight */}
          {topper && (
            <div className="bg-gradient-to-r from-amber-50 to-white border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                <Trophy size={22} />
              </div>
              <div>
                <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Class Topper</div>
                <div className="font-black text-slate-800">{topper.name}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-2xl font-black text-slate-800">{topper.percentage}%</div>
                <div className="text-xs font-bold text-slate-400">
                  {Math.round(topper.obtained)} / {Math.round(topper.possible)}
                </div>
              </div>
            </div>
          )}

          {/* Category tabs */}
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

          {/* Ranked list */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <tr>
                  <th className="p-4 w-16">Rank</th>
                  <th className="p-4">Student</th>
                  <th className="p-4 w-24">Roll</th>
                  <th className="p-4 w-1/3">Performance</th>
                  <th className="p-4 text-right w-32">Marks</th>
                  <th className="p-4 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visible.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic">No students in this view.</td></tr>
                ) : visible.map(r => {
                  const b = band(r.percentage);
                  const isOpen = expanded === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => setExpanded(isOpen ? null : r.id)}>
                        <td className="p-4">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-xs font-black text-slate-600">
                            {r.rank}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-700">{r.name}</td>
                        <td className="p-4 text-sm font-medium text-slate-500">{r.roll_no || '—'}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-black ${b.text}`}>{r.percentage}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className={`h-2 rounded-full ${b.bar}`} style={{ width: `${Math.min(r.percentage, 100)}%` }} />
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="text-sm font-black text-slate-800">{Math.round(r.obtained)}</div>
                          <div className="text-xs text-slate-400">of {Math.round(r.possible)}</div>
                        </td>
                        <td className="p-4 text-slate-300">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={6} className="p-5">
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
        </>
      )}
    </div>
  );
}

// --- Sub: a single student's exam-by-exam breakdown ----------------
function ExamBreakdown({ dataset, studentId }) {
  const rows = useMemo(() => studentExamBreakdown(dataset, studentId), [dataset, studentId]);
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 italic">No exam-wise marks recorded.</p>;
  }
  return (
    <div>
      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Exam Breakdown</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {rows.map(ex => {
          const b = band(ex.percentage);
          return (
            <div key={ex.exam_type_id} className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-600">{ex.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{Math.round(ex.obtained)}/{Math.round(ex.possible)}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${b.bg} ${b.text}`}>
                  {ex.percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Selector({ label, value, onChange, options }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="block bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer min-w-[130px]">
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