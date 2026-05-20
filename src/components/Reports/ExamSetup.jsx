import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Loader2, Save, GripVertical,
  ListChecks, Grid3x3, UserCog, Check
} from 'lucide-react';

// =====================================================================
//  ExamSetup — three sub-sections, switched by inner tabs:
//    1. Exam Types     — create/rename/reorder/delete exam types
//    2. Max Marks      — matrix of exam-type x class → max marks
//    3. Teacher Assign — per class, map each subject to a teacher
// =====================================================================

export default function ExamSetup() {
  const [section, setSection] = useState('types');

  const sections = [
    { id: 'types',   label: 'Exam Types',        icon: ListChecks },
    { id: 'marks',   label: 'Max Marks',         icon: Grid3x3 },
    { id: 'assign',  label: 'Teacher Assignment', icon: UserCog }
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
          {sections.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  section === s.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                <Icon size={13} /> {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {section === 'types'  && <ExamTypesPanel />}
      {section === 'marks'  && <MaxMarksPanel />}
      {section === 'assign' && <TeacherAssignPanel />}
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-slate-800">Exam Types</h3>
          <p className="text-xs text-slate-400 font-medium">
            Define the exams your school conducts. Order controls column order on report cards.
          </p>
        </div>
        <button onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-100">
          <Plus size={14} /> Add Exam Type
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="animate-spin w-7 h-7 text-blue-600 mx-auto" /></div>
      ) : types.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
          <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-400 font-medium">No exam types yet. Add one to begin.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-4 w-16">Order</th>
                <th className="p-4">Exam Type</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {types.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <GripVertical size={13} /> {t.exam_order}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-700">{t.name}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(t)}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Edit">
                        <Edit size={15} />
                      </button>
                      <button onClick={() => handleDelete(t)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                        <Trash2 size={15} />
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-800">
                {editing ? 'Edit Exam Type' : 'Add Exam Type'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <FormField label="Name" required>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Unit Test 1" className={inputCls} />
              </FormField>
              <FormField label="Display Order">
                <input type="number" value={form.exam_order}
                  onChange={e => setForm({ ...form, exam_order: e.target.value })}
                  className={inputCls} />
                <p className="text-[11px] text-slate-400 mt-1">Lower numbers appear first.</p>
              </FormField>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm flex items-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
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
  const [grid, setGrid]       = useState({});   // `${typeId}:${classId}` → max
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
    return <div className="text-center py-12"><Loader2 className="animate-spin w-7 h-7 text-blue-600 mx-auto" /></div>;
  }
  if (types.length === 0 || classes.length === 0) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
        <Grid3x3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-400 font-medium">
          {types.length === 0 ? 'Add exam types first.' : 'Add classes first (Manage Logins).'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-black text-slate-800">Max Marks per Class</h3>
        <p className="text-xs text-slate-400 font-medium">
          Set the maximum marks for each exam per class. Leave a cell blank if that class doesn't take the exam.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="p-4 sticky left-0 bg-slate-50">Class</th>
              {types.map(t => (
                <th key={t.id} className="p-4 text-center whitespace-nowrap">{t.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {classes.map(c => (
              <tr key={c.id} className="hover:bg-slate-50/50">
                <td className="p-4 font-bold text-slate-700 sticky left-0 bg-white whitespace-nowrap">
                  {c.className}{c.section ? ` - ${c.section}` : ''}
                </td>
                {types.map(t => (
                  <td key={t.id} className="p-2">
                    <input
                      value={grid[`${t.id}:${c.id}`] ?? ''}
                      onChange={e => setCell(t.id, c.id, e.target.value)}
                      placeholder="—"
                      className="w-20 mx-auto block bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-blue-500/10" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-100">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save Max Marks'}
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
  const [assignments, setAssignments] = useState({});  // subject_id → {id, teacher_id, teacher_name}
  const [draft, setDraft] = useState({});              // subject_id → teacher_id being picked
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  // Bootstrap classes/subjects/teachers
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
        const agg = await res.json();
        setClasses(agg.classes || []);
        setSubjects(agg.subjects || []);
        setTeachers((agg.users || []).filter(u =>
          (u.role || '').toLowerCase().includes('teacher')
        ));
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
    return <div className="text-center py-12"><Loader2 className="animate-spin w-7 h-7 text-blue-600 mx-auto" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-black text-slate-800">Teacher Assignment</h3>
        <p className="text-xs text-slate-400 font-medium">
          Assign one teacher per subject for a class. That teacher can enter marks only for their subject.
        </p>
      </div>

      <select value={pickedClass} onChange={e => setPickedClass(e.target.value)}
        className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 shadow-sm">
        <option value="">Select a class…</option>
        {classes.map(c => (
          <option key={c.id} value={c.id}>
            {c.className}{c.section ? ` - ${c.section}` : ''}
          </option>
        ))}
      </select>

      {!pickedClass ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
          <UserCog className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-400 font-medium">Pick a class to assign teachers.</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
          <p className="text-slate-400 font-medium">No subjects in this school yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {subjects.map(sub => {
            const current = assignments[sub.id];
            return (
              <div key={sub.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="font-bold text-slate-700 sm:w-48">{sub.name}</div>
                {current ? (
                  <div className="flex-1 flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2">
                    <span className="text-sm text-emerald-800">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mr-2">Assigned</span>
                      <span className="font-bold">{current.teacher_name}</span>
                    </span>
                    <button onClick={() => handleRemove(current.id, sub.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1">
                      <X size={13} /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex gap-2">
                    <select value={draft[sub.id] || ''}
                      onChange={e => setDraft(prev => ({ ...prev, [sub.id]: e.target.value }))}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10">
                      <option value="">Select teacher…</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button onClick={() => handleAssign(sub.id)} disabled={savingId === sub.id}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1.5">
                      {savingId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
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
const inputCls = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10';

function FormField({ label, required, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}