import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  ArrowLeft, Loader2, Save, Lock, RefreshCw, AlertTriangle, Info, Search, ChevronDown, ArrowUpDown
} from 'lucide-react';

// =====================================================================
//  MarksEntry - editable grid of students x subjects for one exam type.
//
//  Column lock rule:
//   • Super Admin (isAllAccess)  -> every subject editable
//   • Teacher                    -> only subjects where they're the
//                                   assigned teacher for this class
//  "Overall" view shows the per-subject sum across all exam types and
//  is always read-only.
//
//  Marks are scoped to the active academic year by the backend.
//  Students are shown roll-wise by default, with an optional sort by
//  total (High -> Low / Low -> High) that recalculates live.
// =====================================================================

// Format a numeric mark without trailing decimals: 20.00 -> 20, 19.50 -> 19.5
const fmtNum = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return v;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
};

// Numeric roll for ordering (non-numeric rolls sort last)
const rollNum = (s) => {
  const n = parseInt(s.roll_no, 10);
  return isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

export default function MarksEntry({ classInfo, canManage, onBack }) {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();

  const [data, setData]       = useState(null);   // {class, students, subjects, examTypes, marks}
  const [marks, setMarks]     = useState({});     // `${studentId}:${subjectId}:${examTypeId}` -> value
  const [original, setOriginal] = useState({});
  const [examTypeId, setExamTypeId] = useState('overall');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [query, setQuery]     = useState('');
  const [sortMode, setSortMode] = useState('roll');   // 'roll' | 'high' | 'low'

  // -----------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reports/class-data/${classInfo.class_id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setData(d);

      // Seed marks map (strip trailing decimals so 19.00 shows as 19)
      const m = {};
      (d.marks || []).forEach(row => {
        m[`${row.student_id}:${row.subject_id}:${row.exam_type_id}`] =
          row.marks_obtained != null ? fmtNum(row.marks_obtained) : '';
      });
      setMarks(m);
      setOriginal(JSON.parse(JSON.stringify(m)));

      // Default to first real exam type
      if (d.examTypes && d.examTypes.length > 0) {
        setExamTypeId(String(d.examTypes[0].id));
      } else {
        setExamTypeId('overall');
      }
    } catch (e) { alert(e.message); }
    setLoading(false);
  }, [classInfo]);

  useEffect(() => { load(); }, [load]);

  // -----------------------------------------------------------------
  const canEditSubject = useCallback((subject) => {
    if (!canManage) return false;
    if (isAllAccess) return true;
    return subject.teacher_id === user.id;
  }, [canManage, isAllAccess, user]);

  const isOverall = examTypeId === 'overall';
  const activeExamType = data?.examTypes?.find(t => String(t.id) === examTypeId);

  // -----------------------------------------------------------------
  // Mark editing
  // -----------------------------------------------------------------
  const setMark = (studentId, subjectId, value) => {
    if (!/^\d*\.?\d*$/.test(value)) return;
    if (activeExamType && value !== '') {
      const num = parseFloat(value);
      if (!isNaN(num) && num > activeExamType.max_marks) return;
    }
    setMarks(prev => ({
      ...prev,
      [`${studentId}:${subjectId}:${examTypeId}`]: value
    }));
  };

  const getMark = (studentId, subjectId, etId) =>
    marks[`${studentId}:${subjectId}:${etId}`] ?? '';

  // Per-subject sum across all exam types (Overall view)
  const subjectOverall = (studentId, subjectId) => {
    if (!data) return 0;
    return data.examTypes.reduce((sum, t) => {
      const v = parseFloat(getMark(studentId, subjectId, t.id));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  };

  const studentGrandTotal = (studentId) => {
    if (!data) return 0;
    return data.subjects.reduce((sum, s) => sum + subjectOverall(studentId, s.id), 0);
  };

  // Row total for the currently-selected exam type
  const studentExamTotal = (studentId) => {
    if (!data) return 0;
    if (isOverall) return studentGrandTotal(studentId);
    return data.subjects.reduce((sum, s) => {
      const v = parseFloat(getMark(studentId, s.id, examTypeId));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  };

  // -----------------------------------------------------------------
  // Save - only changed cells (backend stamps the active academic year)
  // -----------------------------------------------------------------
  const handleSave = async () => {
    const entries = [];
    Object.keys(marks).forEach(key => {
      if (marks[key] !== original[key]) {
        const [studentId, subjectId, etId] = key.split(':');
        entries.push({
          student_id: parseInt(studentId, 10),
          subject_id: parseInt(subjectId, 10),
          exam_type_id: parseInt(etId, 10),
          marks_obtained: marks[key]
        });
      }
    });
    if (entries.length === 0) {
      alert('No changes to save.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reports/marks/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          class_id: classInfo.class_id,
          actor_id: user.id,
          entries
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setOriginal(JSON.parse(JSON.stringify(marks)));
      alert(`Saved ${entries.length} mark(s).`);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  // -----------------------------------------------------------------
  // Search filter, then sort (roll-wise default / by total)
  // -----------------------------------------------------------------
  const filteredStudents = useMemo(() => {
    if (!data) return [];
    if (!query.trim()) return data.students;
    const q = query.toLowerCase();
    return data.students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      String(s.roll_no || '').toLowerCase().includes(q)
    );
  }, [data, query]);

  const sortedStudents = useMemo(() => {
    const list = [...filteredStudents];
    if (sortMode === 'high' || sortMode === 'low') {
      list.sort((a, b) => {
        const diff = studentExamTotal(a.id) - studentExamTotal(b.id);
        return sortMode === 'high' ? -diff : diff;
      });
    } else {
      // roll-wise (default)
      list.sort((a, b) => {
        const r = rollNum(a) - rollNum(b);
        if (r !== 0) return r;
        return (a.name || '').localeCompare(b.name || '');
      });
    }
    return list;
    // recompute when marks or selected exam change so totals stay correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStudents, sortMode, marks, examTypeId, data]);

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }
  if (!data) return null;

  const noExamTypes = data.examTypes.length === 0;

  const sortOptions = [
    { id: 'roll', label: 'Roll wise' },
    { id: 'high', label: 'High → Low' },
    { id: 'low',  label: 'Low → High' }
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
        <ArrowLeft className="size-4" /> Back to classes
      </button>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">{classInfo.class_group}</h2>
          <p className="text-xs font-medium text-zinc-500 mt-1 uppercase tracking-wider">Marks Entry</p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search students..."
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <select value={examTypeId} onChange={e => setExamTypeId(e.target.value)}
                className="h-9 w-full sm:w-48 bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors shadow-sm">
                <option value="overall">Overall (read-only)</option>
                {data.examTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} (max {fmtNum(t.max_marks)})</option>
                ))}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button onClick={load}
              className="size-9 bg-white border border-zinc-200 rounded-md text-zinc-500 hover:text-primary hover:border-primary/40 transition-colors flex items-center justify-center shadow-sm shrink-0" title="Refresh">
              <RefreshCw className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sort control */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          <ArrowUpDown className="size-3.5" /> Sort
        </span>
        <div className="inline-flex items-center bg-white border border-zinc-200 rounded-md p-0.5 shadow-sm">
          {sortOptions.map(o => {
            const active = sortMode === o.id;
            return (
              <button key={o.id} onClick={() => setSortMode(o.id)}
                className={`px-3 h-7 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                  active ? 'bg-primary text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50'
                }`}>
                {o.label}
              </button>
            );
          })}
        </div>
        {sortMode !== 'roll' && (
          <span className="text-[11px] text-zinc-400 font-medium">
            by {isOverall ? 'grand total' : (activeExamType ? activeExamType.name + ' total' : 'total')}
          </span>
        )}
      </div>

      {noExamTypes && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed">
            No exam types are configured for this class. Go to <strong className="font-semibold">Exam Setup - Max Marks</strong> and
            set max marks for this class first.
          </div>
        </div>
      )}

      {!isOverall && activeExamType && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-md p-3 flex items-center gap-2 text-xs font-medium text-blue-700 leading-relaxed">
          <Info className="size-4 shrink-0" />
          <span>
            Editing <strong className="font-semibold text-blue-900">{activeExamType.name}</strong> - max {fmtNum(activeExamType.max_marks)} marks.
            {!isAllAccess && ' Locked columns belong to other teachers.'}
          </span>
        </div>
      )}

      {/* Grid */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-zinc-50/80">
              <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider sticky left-0 bg-zinc-50/95 backdrop-blur z-10 border-b border-zinc-100 w-16">Roll</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider sticky left-16 bg-zinc-50/95 backdrop-blur z-10 border-b border-r border-zinc-100 min-w-[160px]">Name</th>
              {data.subjects.map(s => {
                const editable = canEditSubject(s);
                return (
                  <th key={s.id} className="p-3 text-center whitespace-nowrap border-b border-r border-zinc-100 last:border-r-0 min-w-[100px]">
                    <div className="flex items-center justify-center gap-1.5 text-zinc-700">
                      {!editable && !isOverall && <Lock className="size-3 text-zinc-400" />}
                      <span className="text-xs font-semibold">{s.name}</span>
                    </div>
                    {s.teacher_name && (
                      <div className="text-[9px] font-medium text-zinc-400 mt-1 truncate max-w-[120px] mx-auto">
                        {s.teacher_name}
                      </div>
                    )}
                  </th>
                );
              })}
              <th className="p-3 text-center bg-primary/5 border-b border-zinc-100 min-w-[100px]">
                <span className="text-[10px] font-semibold uppercase text-primary tracking-wider">
                  {isOverall ? 'Grand Total' : 'Total'}
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sortedStudents.length === 0 ? (
              <tr>
                <td colSpan={data.subjects.length + 3} className="px-5 py-8 text-center text-zinc-400 text-sm italic">
                  No students found.
                </td>
              </tr>
            ) : sortedStudents.map(stu => (
              <tr key={stu.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-4 py-3 sticky left-0 bg-white z-10 font-semibold text-zinc-600 text-sm">{stu.roll_no || '-'}</td>
                <td className="px-4 py-3 sticky left-16 bg-white z-10 font-semibold text-zinc-900 text-sm border-r border-zinc-100 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] truncate max-w-[200px]">{stu.name}</td>
                {data.subjects.map(s => {
                  const editable = canEditSubject(s);
                  if (isOverall) {
                    return (
                      <td key={s.id} className="p-2 border-r border-zinc-100 last:border-r-0 text-center">
                        <span className="text-sm font-semibold text-zinc-600">
                          {fmtNum(subjectOverall(stu.id, s.id)) || '-'}
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={s.id} className="p-2 border-r border-zinc-100 last:border-r-0">
                      <input
                        value={getMark(stu.id, s.id, examTypeId)}
                        onChange={e => setMark(stu.id, s.id, e.target.value)}
                        disabled={!editable}
                        placeholder={editable ? '-' : ''}
                        className={`h-8 w-16 mx-auto block rounded-md px-2 text-sm text-center font-semibold tabular-nums outline-none transition-colors ${
                          editable
                            ? 'bg-white border border-zinc-200 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-zinc-900'
                            : 'bg-zinc-50/50 border border-transparent text-zinc-400 cursor-not-allowed'
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="p-2 text-center bg-primary/5 font-semibold text-primary text-sm">
                  {fmtNum(studentExamTotal(stu.id)) || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isOverall && !noExamTypes && (
        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="h-10 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 disabled:text-zinc-500 text-white px-6 rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors">
            {saving ? <Loader2 className="size-4 animate-spin shrink-0" /> : <Save className="size-4 shrink-0" />}
            {saving ? 'Saving...' : 'Save Marks'}
          </button>
        </div>
      )}
    </div>
  );
}