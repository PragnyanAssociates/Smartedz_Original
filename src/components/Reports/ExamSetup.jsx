import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Loader2, Save, GripVertical,
  ListChecks, Grid3x3, UserCog, Check, ChevronDown
} from 'lucide-react';

// =====================================================================
//  ExamSetup - three sub-sections, switched by inner tabs:
//    1. Exam Types     - create/rename/reorder/delete exam types
//    2. Max Marks      - matrix of exam-type x class -> max marks
//    3. Teacher Assign - per class, map each subject to a teacher
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

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete "${t.name}"? All max-marks and entered marks for this exam will be removed.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exam-types/${t.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      load();
    } catch (e) { alert(e.message); }
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
                      <button onClick={() => handleDelete(t)}
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
    </div>
  );
}


// =====================================================================
//  2. Max Marks matrix
// =====================================================================
function MaxMarksPanel() {
  const { user } = useAuth();
  const [types, setTypes]     = useState([]);
  const [classes, setClasses] = useState([]);
  const [grid, setGrid]       = useState({});   // `${typeId}:${classId}` -> max
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

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
      setTypes(Array.isArray(tData) ? tData : []);
      setClasses(aggData.classes || []);
      const g = {};
      (Array.isArray(mData) ? mData : []).forEach(r => {
        g[`${r.exam_type_id}:${r.class_id}`] = String(r.max_marks);
      });
      setGrid(g);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const setCell = (typeId, classId, value) => {
    if (!/^\d*$/.test(value)) return;
    setGrid(prev => ({ ...prev, [`${typeId}:${classId}`]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = [];
      types.forEach(t => {
        classes.forEach(c => {
          entries.push({
            exam_type_id: t.id,
            class_id: c.id,
            max_marks: grid[`${t.id}:${c.id}`] ?? ''
          });
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
      <div>
        <h3 className="font-semibold text-zinc-900 text-sm">Max Marks per Class</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          Set the maximum marks for each exam per class. Leave a cell blank if that class doesn't take the exam.
        </p>
      </div>

      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead className="bg-zinc-50/80">
            <tr>
              <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider sticky left-0 bg-zinc-50/95 backdrop-blur z-10 border-b border-zinc-100 w-48">Class</th>
              {types.map(t => (
                <th key={t.id} className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-center whitespace-nowrap">{t.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {classes.map(c => (
              <tr key={c.id} className="hover:bg-zinc-50/60 transition-colors">
                <td className="px-5 py-3 font-semibold text-zinc-900 text-sm sticky left-0 bg-white whitespace-nowrap border-r border-zinc-100 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                  {c.className}{c.section ? ` - ${c.section}` : ''}
                </td>
                {types.map(t => (
                  <td key={t.id} className="p-2 border-r border-zinc-100 last:border-r-0">
                    <input
                      value={grid[`${t.id}:${c.id}`] ?? ''}
                      onChange={e => setCell(t.id, c.id, e.target.value)}
                      placeholder="-"
                      className="h-8 w-16 mx-auto block bg-white border border-zinc-200 rounded-md px-2 text-sm text-center font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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