import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Loader2, RefreshCw, BarChart3, BookOpen
} from 'lucide-react';
import { fmtDate } from './SyllabusUtils';

// =====================================================================
//  Syllabus Management — the landing screen (image 2).
//
//  A table of syllabuses: SUBJECT / CLASS / LESSONS / TEACHER /
//  LAST UPDATED / ACTIONS. Filter by class, create / edit / delete.
//  The green chart action opens the Subject Index for that syllabus.
// =====================================================================

export default function SyllabusManagement({
  user, canEdit, classes, subjects, subjectClasses, teachers, activeYear,
  onOpenSyllabus
}) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState('');

  // create / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm] = useState({ class_id: '', subject_id: '', teacher_id: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/admin/syllabus/list/${user.institutionId}`;
      if (filterClass) url += `?classId=${filterClass}`;
      const res = await fetch(url);
      const d = await res.json();
      setRows(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user, filterClass]);

  useEffect(() => { load(); }, [load]);

  const classLabel = (c) => `${c.className}${c.section ? ' - ' + c.section : ''}`;

  // subjects available for the class chosen in the modal
  const subjectsForClass = useMemo(() => {
    if (!form.class_id) return subjects;
    const cid = parseInt(form.class_id, 10);
    return subjects.filter(s => {
      const links = subjectClasses[s.id];
      if (!links || links.length === 0) return true;
      return links.includes(cid);
    });
  }, [subjects, subjectClasses, form.class_id]);

  const openCreate = () => {
    setEditing(null);
    setForm({ class_id: '', subject_id: '', teacher_id: '' });
    setModalOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      class_id: String(row.class_id),
      subject_id: String(row.subject_id),
      teacher_id: row.teacher_id ? String(row.teacher_id) : ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.class_id || !form.subject_id) {
      return alert('Class and Subject are required.');
    }
    setSaving(true);
    try {
      const payload = {
        class_id: parseInt(form.class_id, 10),
        subject_id: parseInt(form.subject_id, 10),
        teacher_id: form.teacher_id ? parseInt(form.teacher_id, 10) : null
      };
      let res;
      if (editing) {
        res = await fetch(`${API_BASE_URL}/admin/syllabus/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE_URL}/admin/syllabus`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            institutionId: user.institutionId,
            academic_year_id: activeYear ? activeYear.id : null,
            created_by: user.id
          })
        });
      }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setModalOpen(false);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(
      `Delete the ${row.subject_name} syllabus for ${row.class_group}? All its lessons and keywords will be removed.`
    )) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Syllabus Management</h2>
        <p className="text-slate-500 font-medium mt-1">
          Create and manage syllabuses for different classes and subjects.
        </p>
      </div>

      {/* Action bar */}
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
            <Plus size={18} /> Create Syllabus
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-slate-500">Filter by Class:</span>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer">
          <option value="">All Classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{classLabel(c)}</option>
          ))}
        </select>
        <button onClick={load}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No syllabuses yet.</p>
          {canEdit && <p className="text-slate-400 text-sm mt-1">Click "Create Syllabus" to begin.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-5">Subject</th>
                <th className="p-5">Class</th>
                <th className="p-5 text-center">Lessons</th>
                <th className="p-5">Teacher</th>
                <th className="p-5">Last Updated</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-black text-slate-800">{row.subject_name}</td>
                  <td className="p-5">
                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-lg">
                      {row.class_group}
                    </span>
                  </td>
                  <td className="p-5 text-center font-black text-slate-700">{row.lesson_count}</td>
                  <td className="p-5 text-sm font-medium text-slate-500 uppercase">
                    {row.teacher_name || <span className="text-slate-300 italic normal-case">Unassigned</span>}
                  </td>
                  <td className="p-5 text-sm font-medium text-slate-500">{fmtDate(row.updated_at)}</td>
                  <td className="p-5">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => onOpenSyllabus(row)} title="Open syllabus"
                        className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all">
                        <BarChart3 size={16} />
                      </button>
                      {canEdit && (
                        <>
                          <button onClick={() => handleDelete(row)} title="Delete"
                            className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-all">
                            <Trash2 size={16} />
                          </button>
                          <button onClick={() => openEdit(row)} title="Edit"
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all">
                            <Edit size={16} />
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

      {/* ---- CREATE / EDIT MODAL ---- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative">
            <button onClick={() => setModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">
              <X size={22} />
            </button>
            <h3 className="text-xl font-black mb-5 text-slate-800">
              {editing ? 'Edit Syllabus' : 'Create Syllabus'}
            </h3>
            <div className="space-y-4">
              <ModalSelect label="Class" required value={form.class_id}
                onChange={v => setForm({ ...form, class_id: v, subject_id: '' })}
                options={[
                  { value: '', label: 'Select class' },
                  ...classes.map(c => ({ value: String(c.id), label: classLabel(c) }))
                ]} />
              <ModalSelect label="Subject" required value={form.subject_id}
                onChange={v => setForm({ ...form, subject_id: v })}
                options={[
                  { value: '', label: form.class_id ? 'Select subject' : 'Select a class first' },
                  ...subjectsForClass.map(s => ({ value: String(s.id), label: s.name }))
                ]} />
              <ModalSelect label="Teacher" value={form.teacher_id}
                onChange={v => setForm({ ...form, teacher_id: v })}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...teachers.map(t => ({ value: String(t.id), label: t.name }))
                ]} />
              <button onClick={handleSave} disabled={saving}
                className="w-full bg-slate-900 hover:bg-blue-600 disabled:bg-slate-300 text-white py-3 rounded-xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Syllabus')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalSelect({ label, value, onChange, options, required }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}