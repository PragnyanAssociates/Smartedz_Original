import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Eye, Loader2, ArrowLeft, FileText,
  Save, BookOpen, HelpCircle, CheckCircle2, Clock, Search, User, ChevronDown
} from 'lucide-react';
import ExamEditor from './ExamEditor';
import GradingView from './GradingView';

// =====================================================================
//  ExamsManager - teacher / admin side
//
//  Views: list -> create | edit | submissions | grade
// =====================================================================

// Render a UTC datetime (Railway stores UTC) as IST for display.
// Handles both plain "YYYY-MM-DD HH:MM:SS" and ISO strings/Date objects.
const fmtIST = (val) => {
  if (!val) return '';
  let d;
  if (typeof val === 'string' && !val.includes('T') && !val.endsWith('Z')) {
    d = new Date(val.replace(' ', 'T') + 'Z');
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

export default function ExamsManager({ canManage }) {
  const { user } = useAuth();
  const [view, setView] = useState('list');     // list | create | submissions | grade
  const [editingExam, setEditingExam] = useState(null);
  const [pickedExam, setPickedExam]   = useState(null);
  const [pickedSubmission, setPickedSubmission] = useState(null);

  const [exams, setExams]     = useState([]);
  const [loading, setLoading] = useState(true);

  // List filters. '' = All. Both are client-side over the loaded exams —
  // /admin/exams/teacher already returns class_id + subject_id on every row,
  // so there's nothing to refetch.
  const [classFilter, setClassFilter]     = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  // -----------------------------------------------------------------
  const loadExams = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exams/teacher/${user.id}`);
      const data = await res.json();
      setExams(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { if (view === 'list') loadExams(); }, [view, loadExams]);

  // Options come from the exams themselves rather than /admin/data, so the
  // dropdowns only ever offer combinations that actually exist — no picking a
  // class or subject and landing on an empty table.
  const classOptions = useMemo(() => {
    const map = new Map();
    exams.forEach(e => {
      if (e.class_id == null) return;
      const key = String(e.class_id);
      if (!map.has(key)) map.set(key, e.className || `Class ${e.class_id}`);
    });
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [exams]);

  // Subjects narrow to the selected class.
  const subjectOptions = useMemo(() => {
    const map = new Map();
    exams.forEach(e => {
      if (e.subject_id == null) return;
      if (classFilter && String(e.class_id) !== String(classFilter)) return;
      const key = String(e.subject_id);
      if (!map.has(key)) map.set(key, e.subject_name || `Subject ${e.subject_id}`);
    });
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [exams, classFilter]);

  // Changing the class clears the subject only when that subject has no exam
  // in the newly-chosen class.
  const onClassFilterChange = (v) => {
    setClassFilter(v);
    if (v && subjectFilter) {
      const stillValid = exams.some(e =>
        String(e.class_id) === String(v) && String(e.subject_id) === String(subjectFilter));
      if (!stillValid) setSubjectFilter('');
    }
  };

  const filtered = useMemo(() => {
    let list = exams;
    if (classFilter)   list = list.filter(e => String(e.class_id) === String(classFilter));
    if (subjectFilter) list = list.filter(e => String(e.subject_id) === String(subjectFilter));
    return list;
  }, [exams, classFilter, subjectFilter]);

  const hasActiveFilter = Boolean(classFilter || subjectFilter);

  // -----------------------------------------------------------------
  const handleDelete = async (exam) => {
    if (!window.confirm(`Delete "${exam.title}"? All submissions will be lost.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exams/${exam.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      loadExams();
    } catch (e) { alert(e.message); }
  };

  // ---- Sub-views ---------------------------------------------------
  if (view === 'create') {
    return (
      <ExamEditor
        examToEdit={editingExam}
        onFinish={() => { setEditingExam(null); setView('list'); }}
      />
    );
  }

  if (view === 'submissions' && pickedExam) {
    return (
      <SubmissionsView
        exam={pickedExam}
        onBack={() => setView('list')}
        onGrade={(sub) => { setPickedSubmission(sub); setView('grade'); }}
      />
    );
  }

  if (view === 'grade' && pickedSubmission && pickedExam) {
    return (
      <GradingView
        attemptId={pickedSubmission.attempt_id}
        examTitle={pickedExam.title}
        totalMarks={pickedExam.total_marks}
        onBack={() => setView('submissions')}
      />
    );
  }

  // ---- List view ---------------------------------------------------
  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Filters + Create */}
      {(exams.length > 0 || canManage) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          {exams.length > 0 ? (
            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-44">
                <select value={classFilter} onChange={e => onClassFilterChange(e.target.value)}
                  className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                  <option value="">All classes</option>
                  {classOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="relative w-full sm:w-44">
                <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
                  className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors disabled:bg-zinc-50 disabled:text-zinc-400"
                  disabled={subjectOptions.length === 0}>
                  <option value="">All subjects</option>
                  {subjectOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {hasActiveFilter && (
                <button onClick={() => { setClassFilter(''); setSubjectFilter(''); }}
                  className="text-[11px] font-medium text-primary hover:underline self-center whitespace-nowrap col-span-2 sm:col-auto">
                  Reset
                </button>
              )}
            </div>
          ) : <span />}

          {canManage && (
            <button onClick={() => { setEditingExam(null); setView('create'); }}
              className="h-9 bg-primary hover:bg-primary/90 text-white px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto shrink-0">
              <Plus className="size-4" /> Create Online Exam
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="animate-spin size-8 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <FileText className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">
            {hasActiveFilter ? 'No exams match these filters.' : 'No exams created yet.'}
          </p>
          {hasActiveFilter ? (
            <button onClick={() => { setClassFilter(''); setSubjectFilter(''); }}
              className="text-xs font-semibold text-primary hover:underline mt-2">
              Clear filters
            </button>
          ) : (
            canManage && <p className="text-xs text-zinc-400 mt-1">Click "Create Online Exam" to start.</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead className="bg-zinc-50/50">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Exam</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Class - Subject</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Details</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Created By</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Submissions</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-zinc-50/60 transition-colors group">
                  <td className="px-5 py-4 min-w-[180px]">
                    <div className="font-medium text-zinc-900 text-sm truncate">{e.title}</div>
                  </td>
                  <td className="px-5 py-4 text-sm text-zinc-700 whitespace-nowrap">
                    <div className="font-medium">{e.className}{e.section ? ` - ${e.section}` : ''}</div>
                    {e.subject_name && (
                      <div className="text-[11px] flex items-center gap-1.5 text-zinc-500 mt-1">
                        <BookOpen className="size-3.5" /> {e.subject_name}
                      </div>
                    )}
                    {e.teacher_name && (
                      <div className="text-[11px] flex items-center gap-1.5 text-zinc-400 mt-0.5">
                        <User className="size-3.5" /> {e.teacher_name}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
                      <Pill icon={HelpCircle} color="primary" label={`${e.question_count} Qs`} />
                      <Pill icon={CheckCircle2} color="emerald" label={`${e.total_marks} Marks`} />
                      <Pill icon={Clock} color="amber" label={e.time_limit_mins > 0 ? `${e.time_limit_mins} min` : 'No limit'} />
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="font-medium text-zinc-800 text-sm truncate">{e.created_by_name || '-'}</div>
                    {e.created_at && (
                      <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
                        <Clock className="size-3" /> {fmtIST(e.created_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold ring-1 ${
                      e.submission_count > 0 ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-zinc-50 text-zinc-600 ring-zinc-200'
                    }`}>
                      {e.submission_count} submission{e.submission_count === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setPickedExam(e); setView('submissions'); }}
                        className="p-1.5 text-zinc-400 hover:text-primary hover:bg-primary/10 rounded-md transition-colors" title="Submissions">
                        <Eye className="size-4" />
                      </button>
                      {canManage && (
                        <>
                          <button onClick={() => { setEditingExam(e); setView('create'); }}
                            className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors" title="Edit">
                            <Edit className="size-4" />
                          </button>
                          <button onClick={() => handleDelete(e)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
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

// =====================================================================
//  SubmissionsView - list of who attempted an exam
// =====================================================================
function SubmissionsView({ exam, onBack, onGrade }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE_URL}/admin/exams/${exam.id}/submissions`)
      .then(r => r.json())
      .then(d => setSubs(Array.isArray(d) ? d : []))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [exam.id]);

  const filtered = subs.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.student_name || '').toLowerCase().includes(q) ||
           (s.roll_no || '').toString().toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
        <ArrowLeft className="size-4" /> Back to exams
      </button>

      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center gap-4 justify-between bg-zinc-50/50">
          <div>
            <h2 className="font-semibold text-zinc-900 text-base">{exam.title}</h2>
            <p className="text-[11px] text-zinc-500 font-medium mt-1">Student submissions | {exam.total_marks} total marks</p>
          </div>
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              placeholder="Search name or roll..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" 
            />
          </div>
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="animate-spin size-6 text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center border-t border-zinc-100 bg-white">
            <p className="text-zinc-500 text-sm font-medium">No submissions yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-zinc-50/50">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Student</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Status</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Score</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {filtered.map(s => (
                  <tr key={s.attempt_id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-4 min-w-[200px]">
                      <div className="font-medium text-zinc-900 text-sm truncate">{s.student_name}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                        {s.roll_no ? `Roll ${s.roll_no}` : (s.username ? `@${s.username}` : '')}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ring-1 ${
                        s.status === 'graded' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                          : s.status === 'submitted' ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                          : 'bg-zinc-50 text-zinc-600 ring-zinc-200'
                      }`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-semibold text-zinc-700 text-sm">
                        {s.status === 'graded' ? `${s.final_score} / ${exam.total_marks}` : '-'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => onGrade(s)}
                        className="h-8 bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-3 rounded-md inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto">
                        <Edit className="size-3.5" /> {s.status === 'graded' ? 'Update' : 'Grade'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------
function Pill({ icon: Icon, color, label }) {
  const map = {
    primary: 'bg-primary/10 text-primary ring-primary/20',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    amber:   'bg-amber-50 text-amber-700 ring-amber-600/20'
  };
  return (
    <span className={`${map[color]} ring-1 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap`}>
      <Icon className="size-3" /> {label}
    </span>
  );
}