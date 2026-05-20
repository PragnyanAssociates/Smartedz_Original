import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { Loader2, ChevronRight, Star, BookOpen, Search, GraduationCap } from 'lucide-react';
import MarksEntry from './MarksEntry';
import ReportCards from './ReportCards';

// =====================================================================
//  ClassList — overview table of classes with performance summaries.
//  Clicking a class drills into MarksEntry or ReportCards depending
//  on `mode`.
// =====================================================================

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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-500 font-medium">
          {mode === 'marks'
            ? 'Pick a class to enter or edit marks.'
            : 'Pick a class to view and print report cards.'}
        </p>
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search classes…"
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 shadow-sm" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">
            {summaries.length === 0 ? 'No classes found.' : 'No classes match your search.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-4">Class</th>
                <th className="p-4">Total Marks</th>
                <th className="p-4">Top Student</th>
                <th className="p-4">Top Subject</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => (
                <tr key={s.class_id}
                  onClick={() => setPicked({ class_id: s.class_id, class_group: s.class_group })}
                  className="hover:bg-blue-50/40 cursor-pointer group">
                  <td className="p-4 font-bold text-slate-800">{s.class_group}</td>
                  <td className="p-4 font-black text-blue-600">{s.totalClassMarks}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Star size={14} className="text-amber-400 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-slate-700">{s.topStudent.name}</div>
                        <div className="text-xs text-slate-400">{s.topStudent.marks} marks</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-indigo-400 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-slate-700">{s.topSubject.name}</div>
                        <div className="text-xs text-slate-400">{s.topSubject.marks} marks</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
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