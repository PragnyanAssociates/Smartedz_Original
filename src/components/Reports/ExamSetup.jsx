import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Loader2, Save, GripVertical,
  ListChecks, Grid3x3, UserCog, Check, ChevronDown, BookOpen, Layers,
  AlertTriangle, ShieldAlert, CalendarRange
} from 'lucide-react';

// =====================================================================
//  ExamSetup - three sub-sections, switched by inner tabs:
//    1. Exam Types     - create/rename/reorder/delete exam types
//    2. Max Marks      - per class: an "All Subjects" default OR
//                        per-subject values (mutually exclusive), per exam
//    3. Teacher Assign - per class, map each subject to a teacher
//
//  NOTE ON ACADEMIC YEARS: everything here is SHARED CONFIG, reused by
//  every academic year — unlike marks, which are stamped with the active
//  year. That makes deletion here cross-year: removing an exam type takes
//  its marks from EVERY year with it, not just the active one. Hence the
//  guarded delete flow below, which shows the real damage per year first.
// =====================================================================

export default function ExamSetup() {
  const [section, setSection] = useState('types');

  const sections = [
    { id: 'types',   label: 'Exam Types',        icon: ListChecks },
    { id: 'marks',   label: 'Max Marks',         icon: Grid3x3 },
    { id: 'assign',  label: 'Teacher Assignment', icon: UserCog }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-start">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar w-full sm:w-auto pb-2 sm:pb-0">
          {sections.map(s => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  active 
                    ? 'bg-primary text-white shadow-sm ring-1 ring-primary/20' 
                    : 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
                }`}>
                <Icon className="size-3.5 shrink-0" /> {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        {section === 'types'  && <ExamTypesPanel />}
        {section === 'marks'  && <MaxMarksPanel />}
        {section === 'assign' && <TeacherAssignPanel />}
      </div>
    </div>
  );
}

// =====================================================================
//  1. Exam Types
// =====================================================================
function ExamTypesPanel() {
  const { user } = useAuth();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', exam_order: 0 });
  const [saving, setSaving] = useState(false);
  const [deletingType, setDeletingType] = useState(null);   // exam type pending deletion

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exam-types/${user.institutionId}`);
      const data = await res.json();
      setTypes(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', exam_order: types.length });
    setShowModal(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name, exam_order: t.exam_order });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return alert('Name is required.');
    setSaving(true);
    try {
      const body = {
        institutionId: user.institutionId,
        name: form.name.trim(),
        exam_order: parseInt(form.exam_order, 10) || 0
      };
      const url = editing
        ? `${API_BASE_URL}/admin/exam-types/${editing.id}`
        : `${API_BASE_URL}/admin/exam-types`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setShowModal(false);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-zinc-900 text-sm">Exam Types</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Define the exams your school conducts. Order controls column order on report cards.
          </p>
        </div>
        <button onClick={openAdd}
          className="h-9 w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-4 rounded-md font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0">
          <Plus className="size-3.5" /> Add Exam Type
        </button>
      </div>

      {/* Exam types are shared across years — worth saying once, up front. */}
      <div className="rounded-md bg-blue-50/60 ring-1 ring-inset ring-blue-500/15 px-4 py-3 flex items-start gap-2.5">
        <CalendarRange className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-800 leading-relaxed">
          <span className="font-semibold">These carry across every academic year.</span> Unlike marks, exam types aren't tied to
          a year — the same list is reused each year, which is why you never have to rebuild it. The trade-off: deleting one
          removes its marks from <strong>every year</strong>, not just the active one. You'll see exactly what's at stake before it happens.
        </p>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
      ) : types.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <ListChecks className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No exam types yet. Add one to begin.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead className="bg-zinc-50/80">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-20">Order</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Exam Type</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {types.map(t => (
                <tr key={t.id} className="hover:bg-zinc-50/60 transition-colors group">
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 text-zinc-500 font-medium text-sm tabular-nums">
                      <GripVertical className="size-4 text-zinc-300" /> {t.exam_order}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-semibold text-zinc-900 text-sm">{t.name}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(t)}
                        className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors" title="Edit">
                        <Edit className="size-4" />
                      </button>
                      <button onClick={() => setDeletingType(t)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg">
              <h2 className="text-sm font-semibold text-zinc-900">
                {editing ? 'Edit Exam Type' : 'Add Exam Type'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                <X className="size-4 shrink-0" />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <FormField label="Name" required>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Unit Test 1" className={inputCls} />
              </FormField>
              <FormField label="Display Order">
                <input type="number" value={form.exam_order}
                  onChange={e => setForm({ ...form, exam_order: e.target.value })}
                  className={inputCls} />
                <p className="text-[11px] text-zinc-400 mt-1.5 font-medium">Lower numbers appear first.</p>
              </FormField>
            </div>
            <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg">
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors min-w-[100px]">
                {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
                {editing ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guarded, year-aware delete */}
      {deletingType && (
        <DeleteExamTypeModal
          examType={deletingType}
          onClose={() => setDeletingType(null)}
          onDeleted={() => { setDeletingType(null); load(); }}
        />
      )}
    </div>
  );
}

// =====================================================================
//  DeleteExamTypeModal — deletion with the real damage on screen.
//
//  Exam types are shared config but student_marks carry BOTH
//  exam_type_id and academic_year_id, so deleting one reaches into
//  EVERY year. A window.confirm saying "marks will be removed" hides
//  that: it reads like "this year's marks". So we ask the backend what
//  would actually go (/impact), list it per year, and only arm the
//  delete once the Super Admin has acknowledged closed-year losses.
// =====================================================================
function DeleteExamTypeModal({ examType, onClose, onDeleted }) {
  const [impact, setImpact]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [acknowledged, setAck] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/admin/exam-types/${examType.id}/impact`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Could not check what this would delete.');
        if (!cancel) setImpact(d);
      } catch (e) {
        if (!cancel) setError(e.message);
      }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, [examType.id]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exam-types/${examType.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Delete failed');
      }
      onDeleted();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  };

  const totalMarks  = impact?.total_marks ?? 0;
  const otherYears  = impact?.other_year_marks ?? 0;
  const needsAck    = totalMarks > 0;
  const canDelete   = !loading && !deleting && !error && (!needsAck || acknowledged);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-md bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <Trash2 className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Delete &ldquo;{examType.name}&rdquo;</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">Checking what this would remove&hellip;</p>
            </div>
          </div>
          <button onClick={onClose} disabled={deleting} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1 disabled:opacity-50">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="animate-spin size-7 text-primary" />
            </div>
          ) : error && !impact ? (
            <div className="rounded-md bg-red-50 ring-1 ring-inset ring-red-500/20 px-4 py-3 text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-px" /> {error}
            </div>
          ) : totalMarks === 0 ? (
            <>
              <div className="rounded-md bg-emerald-50 ring-1 ring-inset ring-emerald-600/20 px-4 py-3 flex items-start gap-2.5">
                <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800 leading-relaxed">
                  <strong>No marks have been entered against this exam type</strong> in any academic year. Nothing will be lost.
                  {impact?.max_marks_rows > 0 && (
                    <> Its max-marks settings ({impact.max_marks_rows} {impact.max_marks_rows === 1 ? 'row' : 'rows'}) will be removed with it.</>
                  )}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* The headline: what actually happens */}
              <div className="rounded-md bg-red-50 ring-1 ring-inset ring-red-500/20 px-4 py-3 flex items-start gap-2.5">
                <ShieldAlert className="size-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-700 leading-relaxed">
                  Deleting <strong>{examType.name}</strong> permanently removes <strong>{totalMarks}</strong> entered
                  {totalMarks === 1 ? ' mark' : ' marks'}
                  {otherYears > 0 && (
                    <> — <strong>including {otherYears} from academic {otherYears === 1 ? 'year' : 'years'} you are no longer working in</strong></>
                  )}.
                  Report cards for those years will change. <strong>This cannot be undone.</strong>
                </div>
              </div>

              {/* Per-year breakdown */}
              <div className="rounded-md ring-1 ring-black/5 overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-100">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Marks that would be deleted</p>
                </div>
                <div className="divide-y divide-zinc-100">
                  {(impact?.years || []).map((y, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-zinc-800 flex items-center gap-2 min-w-0">
                        <span className="truncate">{y.name}</span>
                        {y.is_active_year ? (
                          <span className="text-[9px] font-semibold uppercase tracking-wider bg-primary/10 text-primary ring-1 ring-primary/20 px-1.5 py-0.5 rounded shrink-0">
                            Active year
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold uppercase tracking-wider bg-red-50 text-red-700 ring-1 ring-red-600/20 px-1.5 py-0.5 rounded shrink-0">
                            Closed year
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-bold text-zinc-900 tabular-nums shrink-0">
                        {y.marks} {y.marks === 1 ? 'mark' : 'marks'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {otherYears > 0 && (
                <div className="rounded-md bg-amber-50 ring-1 ring-inset ring-amber-500/20 px-4 py-3 flex items-start gap-2.5">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    <strong>Back up the closed years first.</strong> Download their archives from
                    <strong> Manage Logins &rarr; Academics Year</strong> (or the <strong>Downloads</strong> tab) before you delete —
                    once these marks are gone they cannot be recovered from the app, and a past year's report cards will no longer match
                    what you already issued.
                  </p>
                </div>
              )}

              {/* Acknowledgement */}
              <label className="flex items-start gap-2 rounded-md ring-1 ring-black/5 p-4 cursor-pointer">
                <input type="checkbox" checked={acknowledged} onChange={e => setAck(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-zinc-300 text-primary focus:ring-2 focus:ring-primary/30" />
                <span className="text-[11px] text-zinc-600 leading-relaxed">
                  I understand this permanently deletes <strong>{totalMarks}</strong> {totalMarks === 1 ? 'mark' : 'marks'}
                  {otherYears > 0 && <> across <strong>{(impact?.years || []).length}</strong> academic years, including closed ones</>},
                  that affected report cards will change, and that it cannot be recovered from the app.
                </span>
              </label>

              {error && (
                <div className="rounded-md bg-red-50 ring-1 ring-inset ring-red-500/20 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-px" /> {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-zinc-100">
          <button onClick={onClose} disabled={deleting}
            className="text-zinc-700 px-4 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={!canDelete}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-md text-xs font-semibold inline-flex items-center gap-2 transition-colors disabled:cursor-not-allowed">
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {deleting ? 'Deleting…' : 'Delete Exam Type'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
//  2. Max Marks — per class, per exam, with subjects.
//
//  TWO MUTUALLY-EXCLUSIVE MODES per exam column:
//    • All-Subjects mode  — type a value in the "All Subjects" row. The
//      per-subject cells below lock (they all inherit that one value).
//    • Per-subject mode    — type a value in any subject row. The
//      "All Subjects" cell for that exam clears and locks.
//  Entering on one side automatically empties + disables the other side
//  (and vice-versa). Each exam column is independent.
//
//  Subjects shown for a class come from the same subject→class links used
//  everywhere else (a subject with no links applies to all classes).
// =====================================================================
function MaxMarksPanel() {
  const { user } = useAuth();
  const [types, setTypes]                 = useState([]);
  const [classes, setClasses]             = useState([]);
  const [subjects, setSubjects]           = useState([]);
  const [subjectClasses, setSubjectClasses] = useState({}); // { subject_id: [class_ids] }
  const [grid, setGrid]                   = useState({});    // `${typeId}:${classId}:${subjectId}` -> max string
  const [pickedClass, setPickedClass]     = useState('');
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, aggRes, mRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/exam-types/${user.institutionId}`),
        fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`),
        fetch(`${API_BASE_URL}/admin/exam-max-marks/${user.institutionId}`)
      ]);
      const tData = await tRes.json();
      const aggData = await aggRes.json();
      const mData = await mRes.json();

      const cls = aggData.classes || [];
      setTypes(Array.isArray(tData) ? tData : []);
      setClasses(cls);
      setSubjects(aggData.subjects || []);
      setSubjectClasses(aggData.subjectClasses || {});

      const g = {};
      (Array.isArray(mData) ? mData : []).forEach(r => {
        const sid = (r.subject_id === undefined || r.subject_id === null) ? 0 : r.subject_id;
        g[`${r.exam_type_id}:${r.class_id}:${sid}`] = String(r.max_marks);
      });
      setGrid(g);
      setPickedClass(prev => (prev ? prev : (cls[0] ? String(cls[0].id) : '')));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Subjects that belong to a class (no links = available to all classes).
  const subjectsForClass = useCallback((classId) => {
    const cid = parseInt(classId, 10);
    return subjects.filter(s => {
      const links = subjectClasses[s.id];
      if (!links || links.length === 0) return true;
      return links.map(Number).includes(cid);
    });
  }, [subjects, subjectClasses]);

  const classSubjects = useMemo(
    () => (pickedClass ? subjectsForClass(pickedClass) : []),
    [pickedClass, subjectsForClass]
  );

  // Per exam column: which side is locked for the picked class.
  //   perSubjectLocked -> All-Subjects has a value (subjects inherit it)
  //   allLocked        -> a subject has a value (one-value mode is off)
  const colMode = useMemo(() => {
    const map = {};
    if (!pickedClass) return map;
    types.forEach(t => {
      const allVal = grid[`${t.id}:${pickedClass}:0`] ?? '';
      const subjVal = classSubjects.some(s => (grid[`${t.id}:${pickedClass}:${s.id}`] ?? '') !== '');
      map[t.id] = {
        perSubjectLocked: allVal !== '',
        allLocked: allVal === '' && subjVal
      };
    });
    return map;
  }, [types, pickedClass, grid, classSubjects]);

  // Editing one side clears + disables the other (mutual exclusion).
  const setCell = (typeId, classId, subjectId, value) => {
    if (!/^\d*$/.test(value)) return;
    setGrid(prev => {
      const next = { ...prev, [`${typeId}:${classId}:${subjectId}`]: value };
      if (value !== '') {
        if (Number(subjectId) === 0) {
          // All-Subjects entered -> clear every per-subject override here
          subjectsForClass(classId).forEach(s => {
            next[`${typeId}:${classId}:${s.id}`] = '';
          });
        } else {
          // A per-subject value entered -> clear the All-Subjects default
          next[`${typeId}:${classId}:0`] = '';
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Persist every class fully. For each exam+class we send EITHER the
      // All-Subjects default (subject 0) with per-subject rows blanked, OR
      // the per-subject rows with the default blanked — never both. Blank
      // => the backend deletes that row, so the modes stay exclusive.
      const entries = [];
      classes.forEach(c => {
        const subs = subjectsForClass(c.id);
        types.forEach(t => {
          const allVal = grid[`${t.id}:${c.id}:0`] ?? '';
          if (allVal !== '') {
            entries.push({ exam_type_id: t.id, class_id: c.id, subject_id: 0, max_marks: allVal });
            subs.forEach(s => entries.push({ exam_type_id: t.id, class_id: c.id, subject_id: s.id, max_marks: '' }));
          } else {
            entries.push({ exam_type_id: t.id, class_id: c.id, subject_id: 0, max_marks: '' });
            subs.forEach(s => entries.push({
              exam_type_id: t.id, class_id: c.id, subject_id: s.id,
              max_marks: grid[`${t.id}:${c.id}:${s.id}`] ?? ''
            }));
          }
        });
      });

      const res = await fetch(`${API_BASE_URL}/admin/exam-max-marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      alert('Max marks saved.');
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  if (types.length === 0 || classes.length === 0) {
    return (
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
        <Grid3x3 className="size-10 text-zinc-300 mb-3" />
        <p className="text-zinc-500 text-sm font-medium">
          {types.length === 0 ? 'Add exam types first.' : 'Add classes first (Manage Logins).'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h3 className="font-semibold text-zinc-900 text-sm">Max Marks per Class</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5 max-w-2xl">
            Pick a class, then for each exam set the max marks <strong>one of two ways</strong>: type a value in the
            <strong> All Subjects</strong> row to use it for every subject (the subject rows lock), or type values in the
            <strong> individual subject</strong> rows to set them separately (the All-Subjects cell clears and locks).
            Each exam column is independent. Leave an exam fully blank if the class doesn't take it.
          </p>
        </div>

        {/* Class picker */}
        <div className="relative w-full sm:w-64 shrink-0">
          <select value={pickedClass} onChange={e => setPickedClass(e.target.value)}
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
            <option value="">Select a class...</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.className}{c.section ? ` - ${c.section}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Max marks are shared config too — changing one re-bases history. */}
      <div className="rounded-md bg-amber-50/70 ring-1 ring-inset ring-amber-500/20 px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-800 leading-relaxed">
          <span className="font-semibold">Max marks apply to every academic year, not just the active one.</span> Changing a value
          re-calculates the percentage on report cards that are already issued — past years included. Set these at the start and
          leave them; if a paper's total genuinely changes, add a new exam type instead of editing an old one.
        </p>
      </div>

      {!pickedClass ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <Grid3x3 className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">Pick a class to set its max marks.</p>
        </div>
      ) : classSubjects.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <BookOpen className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No subjects assigned to this class yet.</p>
          <p className="text-zinc-400 text-xs mt-1">Add subjects (and link them to this class) in the Subjects tab.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead className="bg-zinc-50/80">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider sticky left-0 bg-zinc-50/95 backdrop-blur z-10 border-b border-zinc-100 w-48">Subject</th>
                {types.map(t => (
                  <th key={t.id} className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-center whitespace-nowrap">{t.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {/* All Subjects (default) row */}
              <tr className="bg-primary/5">
                <td className="px-5 py-3 sticky left-0 bg-primary/5 z-10 border-r border-zinc-100 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-primary text-sm">
                    <Layers className="size-3.5" /> All Subjects
                  </span>
                  <span className="block text-[10px] font-medium text-primary/70 mt-0.5">One value for every subject</span>
                </td>
                {types.map(t => {
                  const locked = colMode[t.id]?.allLocked;
                  return (
                    <td key={t.id} className="p-2 border-r border-zinc-100 last:border-r-0">
                      <input
                        value={locked ? '' : (grid[`${t.id}:${pickedClass}:0`] ?? '')}
                        onChange={e => setCell(t.id, pickedClass, 0, e.target.value)}
                        disabled={locked}
                        inputMode="numeric"
                        placeholder={locked ? 'per-subj' : '-'}
                        title={locked
                          ? 'Per-subject marks are set for this exam. Clear them to use one value for all subjects.'
                          : 'Applies to every subject for this exam'}
                        className={`h-8 w-16 mx-auto block rounded-md px-2 text-sm text-center font-semibold tabular-nums outline-none transition-colors shadow-sm ${
                          locked
                            ? 'bg-zinc-100 border border-zinc-200 text-zinc-300 placeholder:text-zinc-300 cursor-not-allowed'
                            : 'bg-white border border-primary/30 focus:ring-2 focus:ring-primary/20 focus:border-primary/40'
                        }`} />
                    </td>
                  );
                })}
              </tr>

              {/* Per-subject override rows */}
              {classSubjects.map(s => (
                <tr key={s.id} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="px-5 py-3 font-semibold text-zinc-900 text-sm sticky left-0 bg-white whitespace-nowrap border-r border-zinc-100 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                    {s.name}
                  </td>
                  {types.map(t => {
                    const locked = colMode[t.id]?.perSubjectLocked;
                    const inherit = grid[`${t.id}:${pickedClass}:0`];
                    return (
                      <td key={t.id} className="p-2 border-r border-zinc-100 last:border-r-0">
                        <input
                          value={locked ? '' : (grid[`${t.id}:${pickedClass}:${s.id}`] ?? '')}
                          onChange={e => setCell(t.id, pickedClass, s.id, e.target.value)}
                          disabled={locked}
                          inputMode="numeric"
                          placeholder={locked ? (inherit ? String(inherit) : '-') : '-'}
                          title={locked
                            ? `Locked — inherits ${inherit || 'the'} from All Subjects. Clear All Subjects to set this subject separately.`
                            : 'Overrides the All-Subjects value for this subject'}
                          className={`h-8 w-16 mx-auto block rounded-md px-2 text-sm text-center font-semibold tabular-nums outline-none transition-colors shadow-sm ${
                            locked
                              ? 'bg-zinc-50 border border-dashed border-zinc-200 text-zinc-400 placeholder:text-zinc-400 cursor-not-allowed'
                              : 'bg-white border border-zinc-200 text-zinc-900 placeholder:text-zinc-300 focus:ring-2 focus:ring-primary/20 focus:border-primary/40'
                          }`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving}
          className="h-9 w-full sm:w-auto bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white px-6 rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors">
          {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
          {saving ? 'Saving...' : 'Save Max Marks'}
        </button>
      </div>
    </div>
  );
}

// =====================================================================
//  3. Teacher Assignment
// =====================================================================
function TeacherAssignPanel() {
  const { user } = useAuth();
  const [classes, setClasses]   = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [pickedClass, setPickedClass] = useState('');
  const [assignments, setAssignments] = useState({});  // subject_id -> {id, teacher_id, teacher_name}
  const [draft, setDraft] = useState({});              // subject_id -> teacher_id being picked
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  // Bootstrap classes/subjects/teachers, then default to the first class
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
        const agg = await res.json();
        const cls = agg.classes || [];
        setClasses(cls);
        setSubjects(agg.subjects || []);
        setTeachers((agg.users || []).filter(u =>
          (u.role || '').toLowerCase().includes('teacher')
        ));
        // Default-select the first class so subjects show immediately
        if (cls.length > 0) {
          setPickedClass(prev => (prev ? prev : String(cls[0].id)));
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user]);

  // Load assignments when class picked
  const loadAssignments = useCallback(async (classId) => {
    if (!classId) { setAssignments({}); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subject-teachers/${classId}`);
      const data = await res.json();
      const map = {};
      (Array.isArray(data) ? data : []).forEach(a => { map[a.subject_id] = a; });
      setAssignments(map);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadAssignments(pickedClass); }, [pickedClass, loadAssignments]);

  const handleAssign = async (subjectId) => {
    const teacherId = draft[subjectId];
    if (!teacherId) return alert('Pick a teacher first.');
    setSavingId(subjectId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subject-teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          class_id: parseInt(pickedClass, 10),
          subject_id: subjectId,
          teacher_id: parseInt(teacherId, 10)
        })
      });
      if (!res.ok) throw new Error('Assign failed');
      loadAssignments(pickedClass);
    } catch (e) { alert(e.message); }
    setSavingId(null);
  };

  const handleRemove = async (assignmentId, subjectId) => {
    if (!window.confirm('Remove this teacher assignment?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subject-teachers/${assignmentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed');
      setDraft(prev => ({ ...prev, [subjectId]: '' }));
      loadAssignments(pickedClass);
    } catch (e) { alert(e.message); }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-zinc-900 text-sm">Teacher Assignment</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          Assign one teacher per subject for a class. That teacher can enter marks only for their subject.
        </p>
      </div>

      <div className="relative w-full sm:w-72">
        <select value={pickedClass} onChange={e => setPickedClass(e.target.value)}
          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
          <option value="">Select a class...</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>
              {c.className}{c.section ? ` - ${c.section}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {!pickedClass ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <UserCog className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">Pick a class to assign teachers.</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <p className="text-zinc-500 text-sm font-medium">No subjects in this school yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm divide-y divide-zinc-100">
          {subjects.map(sub => {
            const current = assignments[sub.id];
            return (
              <div key={sub.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="font-semibold text-zinc-900 sm:w-48 text-sm">{sub.name}</div>
                {current ? (
                  <div className="flex-1 flex items-center justify-between gap-3 bg-emerald-50 ring-1 ring-emerald-600/20 rounded-md px-4 py-2">
                    <span className="text-sm text-emerald-800 flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">Assigned</span>
                      <span className="font-semibold">{current.teacher_name}</span>
                    </span>
                    <button onClick={() => handleRemove(current.id, sub.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors">
                      <X className="size-3.5 shrink-0" /> <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <select value={draft[sub.id] || ''}
                        onChange={e => setDraft(prev => ({ ...prev, [sub.id]: e.target.value }))}
                        className="h-9 w-full bg-zinc-50/50 border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors">
                        <option value="">Select teacher...</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <button onClick={() => handleAssign(sub.id)} disabled={savingId === sub.id}
                      className="h-9 px-4 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0">
                      {savingId === sub.id ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Check className="size-3.5 shrink-0" />}
                      Assign
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
const inputCls = 'h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm';

function FormField({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
        {label}{required && <span className="text-accent">*</span>}
      </label>
      {children}
    </div>
  );
}