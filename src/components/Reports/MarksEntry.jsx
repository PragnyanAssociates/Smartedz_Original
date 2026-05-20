import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  ArrowLeft, Loader2, Save, Lock, RefreshCw, AlertTriangle, Info
} from 'lucide-react';

// =====================================================================
//  MarksEntry — editable grid of students x subjects for one exam type.
//
//  Column lock rule:
//   • Super Admin (isAllAccess)  → every subject editable
//   • Teacher                    → only subjects where they're the
//                                  assigned teacher for this class
//  "Overall" view shows the per-subject sum across all exam types and
//  is always read-only.
// =====================================================================

export default function MarksEntry({ classInfo, canManage, onBack }) {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();

  const [data, setData]       = useState(null);   // {class, students, subjects, examTypes, marks}
  const [marks, setMarks]     = useState({});     // `${studentId}:${subjectId}:${examTypeId}` → value
  const [original, setOriginal] = useState({});
  const [examTypeId, setExamTypeId] = useState('overall');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [query, setQuery]     = useState('');

  // -----------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reports/class-data/${classInfo.class_id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setData(d);

      // Seed marks map
      const m = {};
      (d.marks || []).forEach(row => {
        m[`${row.student_id}:${row.subject_id}:${row.exam_type_id}`] =
          row.marks_obtained != null ? String(row.marks_obtained) : '';
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
  // Can the current user edit a given subject column?
  // -----------------------------------------------------------------
  const canEditSubject = useCallback((subject) => {
    if (!canManage) return false;
    if (isAllAccess) return true;
    // Teacher: only their assigned subject for this class
    return subject.teacher_id === user.id;
  }, [canManage, isAllAccess, user]);

  const isOverall = examTypeId === 'overall';
  const activeExamType = data?.examTypes?.find(t => String(t.id) === examTypeId);

  // -----------------------------------------------------------------
  // Mark editing
  // -----------------------------------------------------------------
  const setMark = (studentId, subjectId, value) => {
    if (!/^\d*\.?\d*$/.test(value)) return;
    // Clamp to max marks
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

  // Student's grand total across all subjects + exam types
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
  // Save — only changed cells
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
  const filteredStudents = useMemo(() => {
    if (!data) return [];
    if (!query.trim()) return data.students;
    const q = query.toLowerCase();
    return data.students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      String(s.roll_no || '').toLowerCase().includes(q)
    );
  }, [data, query]);

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }
  if (!data) return null;

  const noExamTypes = data.examTypes.length === 0;

  return (
    <div className="space-y-4">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
        <ArrowLeft size={14} /> Back to classes
      </button>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800">{classInfo.class_group}</h2>
          <p className="text-xs text-slate-400 font-medium">Marks Entry</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search students…"
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm w-full sm:w-48 outline-none focus:ring-2 focus:ring-blue-500/10" />
          <select value={examTypeId} onChange={e => setExamTypeId(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer">
            <option value="overall">Overall (read-only)</option>
            {data.examTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name} (max {t.max_marks})</option>
            ))}
          </select>
          <button onClick={load}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600" title="Refresh">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {noExamTypes && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700">
            No exam types are configured for this class. Go to <strong>Exam Setup → Max Marks</strong> and
            set max marks for this class first.
          </div>
        </div>
      )}

      {!isOverall && activeExamType && (
        <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3 flex items-center gap-2 text-xs text-blue-700">
          <Info size={14} className="shrink-0" />
          <span>
            Editing <strong>{activeExamType.name}</strong> · max {activeExamType.max_marks} marks.
            {!isAllAccess && ' Locked columns belong to other teachers.'}
          </span>
        </div>
      )}

      {/* Grid */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="p-3 sticky left-0 bg-slate-50 w-16">Roll</th>
              <th className="p-3 sticky left-16 bg-slate-50 min-w-[140px]">Name</th>
              {data.subjects.map(s => {
                const editable = canEditSubject(s);
                return (
                  <th key={s.id} className="p-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      {!editable && !isOverall && <Lock size={10} className="text-slate-300" />}
                      {s.name}
                    </div>
                    {s.teacher_name && (
                      <div className="text-[9px] font-medium text-slate-300 normal-case mt-0.5">
                        {s.teacher_name}
                      </div>
                    )}
                  </th>
                );
              })}
              <th className="p-3 text-center bg-blue-50 text-blue-600">
                {isOverall ? 'Grand Total' : 'Total'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={data.subjects.length + 3} className="p-10 text-center text-slate-400 italic">
                  No students.
                </td>
              </tr>
            ) : filteredStudents.map(stu => (
              <tr key={stu.id} className="hover:bg-slate-50/40">
                <td className="p-3 sticky left-0 bg-white font-bold text-slate-600 text-sm">{stu.roll_no || '—'}</td>
                <td className="p-3 sticky left-16 bg-white font-bold text-slate-700 text-sm">{stu.name}</td>
                {data.subjects.map(s => {
                  const editable = canEditSubject(s);
                  if (isOverall) {
                    return (
                      <td key={s.id} className="p-2 text-center">
                        <span className="text-sm font-bold text-slate-500">
                          {subjectOverall(stu.id, s.id) || '—'}
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={s.id} className="p-2">
                      <input
                        value={getMark(stu.id, s.id, examTypeId)}
                        onChange={e => setMark(stu.id, s.id, e.target.value)}
                        disabled={!editable}
                        placeholder={editable ? '—' : ''}
                        className={`w-16 mx-auto block rounded-lg px-2 py-1.5 text-sm text-center font-bold outline-none ${
                          editable
                            ? 'bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/10'
                            : 'bg-slate-50 border border-slate-100 text-slate-300 cursor-not-allowed'
                        }`} />
                    </td>
                  );
                })}
                <td className="p-2 text-center bg-blue-50/50 font-black text-blue-600 text-sm">
                  {studentExamTotal(stu.id) || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isOverall && !noExamTypes && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-100">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Marks'}
          </button>
        </div>
      )}
    </div>
  );
}