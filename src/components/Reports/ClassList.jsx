import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { Loader2, ChevronRight, Star, BookOpen, Search, GraduationCap } from 'lucide-react';
import MarksEntry from './MarksEntry';
import ReportCards from './ReportCards';

// =====================================================================
//  ClassList - overview table of classes with performance summaries.
//  Clicking a class drills into MarksEntry or ReportCards depending
//  on `mode`. Summaries are scoped to the active academic year and
//  exclude alumni students (handled by the backend).
// =====================================================================

// Format a numeric mark without trailing decimals: 20.00 -> 20, 19.50 -> 19.5
const fmtNum = (v) => {
  if (v === null || v === undefined || v === '') return '0';
  const n = Number(v);
  if (isNaN(n)) return v;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
};

export default function ClassList({ mode, canManage }) {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);   // {class_id, class_group}

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reports/class-summaries/${user.institutionId}`);
      const data = await res.json();
      setSummaries(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Drill-down
  if (picked && mode === 'marks') {
    return <MarksEntry classInfo={picked} canManage={canManage} onBack={() => setPicked(null)} />;
  }
  if (picked && mode === 'cards') {
    return <ReportCards classInfo={picked} onBack={() => setPicked(null)} />;
  }

  const filtered = summaries.filter(s =>
    s.class_group.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-zinc-500 font-medium">
          {mode === 'marks'
            ? 'Pick a class to enter or edit marks.'
            : 'Pick a class to view and print report cards.'}
        </p>
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search classes..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="animate-spin size-8 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <GraduationCap className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">
            {summaries.length === 0 ? 'No classes found.' : 'No classes match your search.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-zinc-50/80">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Class</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Total Marks</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Top Student</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Top Subject</th>
                <th className="px-5 py-3 border-b border-zinc-100 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(s => (
                <tr key={s.class_id}
                  onClick={() => setPicked({ class_id: s.class_id, class_group: s.class_group })}
                  className="hover:bg-zinc-50/60 transition-colors cursor-pointer group">

                  <td className="px-5 py-4 font-semibold text-zinc-900 whitespace-nowrap">
                    {s.class_group}
                  </td>

                  <td className="px-5 py-4 font-semibold text-primary tabular-nums whitespace-nowrap">
                    {fmtNum(s.totalClassMarks)}
                  </td>

                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="size-6 rounded-md bg-amber-50 ring-1 ring-amber-500/20 flex items-center justify-center shrink-0">
                        <Star className="size-3.5 text-amber-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-zinc-800 leading-tight">{s.topStudent.name}</span>
                        <span className="text-[11px] font-medium text-zinc-500">{fmtNum(s.topStudent.marks)} marks</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="size-6 rounded-md bg-indigo-50 ring-1 ring-indigo-500/20 flex items-center justify-center shrink-0">
                        <BookOpen className="size-3.5 text-indigo-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-zinc-800 leading-tight">{s.topSubject.name}</span>
                        <span className="text-[11px] font-medium text-zinc-500">{fmtNum(s.topSubject.marks)} marks</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <ChevronRight className="size-4 text-zinc-300 group-hover:text-primary transition-colors ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}