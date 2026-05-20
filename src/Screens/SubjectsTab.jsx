import React, { useState } from 'react';
import { Plus, Edit, Trash2, X, BookOpen, Loader2, Check } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

// =====================================================================
//  SubjectsTab — manage the school's subjects (moved here from
//  Timetable). Each subject is linked to one or more classes via a
//  multi-select. The Marks Entry grid uses these links to show only a
//  class's own subjects.
//
//  A subject with NO classes selected is treated as "all classes".
// =====================================================================

export default function SubjectsTab({ data, fetchData, user }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [name, setName]           = useState('');
  const [classIds, setClassIds]   = useState([]);   // array of class id strings
  const [saving, setSaving]       = useState(false);

  const subjectClasses = data.subjectClasses || {};

  // -----------------------------------------------------------------
  const openAdd = () => {
    setEditing(null);
    setName('');
    setClassIds([]);
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setName(s.name);
    const linked = (subjectClasses[s.id] || []).map(String);
    setClassIds(linked);
    setShowModal(true);
  };

  const toggleClass = (cid) => {
    const id = String(cid);
    setClassIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return alert('Subject name is required.');
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        institutionId: user.institutionId,
        class_ids: classIds.map(x => parseInt(x, 10))
      };
      const url = editing
        ? `${API_BASE_URL}/admin/subjects/${editing.id}`
        : `${API_BASE_URL}/admin/subjects`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setShowModal(false);
      fetchData();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete "${s.name}"? It will be removed from all classes, timetables and marks.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subjects/${s.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      fetchData();
    } catch (e) { alert(e.message); }
  };

  // Human-readable class list for a subject
  const classLabel = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;
  const subjectClassNames = (subjectId) => {
    const ids = subjectClasses[subjectId] || [];
    if (ids.length === 0) return null;   // → "All classes"
    return ids
      .map(cid => {
        const c = data.classes.find(x => x.id === cid);
        return c ? classLabel(c) : null;
      })
      .filter(Boolean);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between gap-4 lg:items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Subjects</h3>
          <p className="text-sm text-slate-400 font-medium">
            Create subjects and assign them to classes. Marks Entry shows only a class's own subjects.
          </p>
        </div>
        <button onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
          <Plus size={18} /> Add Subject
        </button>
      </div>

      {(data.subjects || []).length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No subjects yet. Add one to begin.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-5">Subject</th>
                <th className="p-5">Assigned Classes</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.subjects.map(s => {
                const names = subjectClassNames(s.id);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-5 font-bold text-slate-700">{s.name}</td>
                    <td className="p-5">
                      {names === null ? (
                        <span className="text-xs font-bold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full">
                          All classes
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {names.map((n, i) => (
                            <span key={i} className="text-xs font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">
                              {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(s)}
                          className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(s)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setShowModal(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-2 text-slate-800">
              {editing ? 'Edit Subject' : 'Add Subject'}
            </h2>
            <p className="text-slate-400 text-sm font-medium mb-8">
              Pick every class that studies this subject.
            </p>

            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Subject Name <span className="text-red-500">*</span>
                </label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Mathematics"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/10 text-sm" />
              </div>

              <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-blue-600" />
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                    Assign to Classes
                  </span>
                  <span className="ml-auto text-[11px] font-bold text-blue-600 bg-white px-2.5 py-0.5 rounded-full">
                    {classIds.length} selected
                  </span>
                </div>

                {(data.classes || []).length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    No classes created yet. Add classes in the <strong>Classes</strong> tab first.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.classes.map(c => {
                      const id = String(c.id);
                      const selected = classIds.includes(id);
                      return (
                        <button type="button" key={c.id} onClick={() => toggleClass(c.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                            selected
                              ? 'bg-blue-600 text-white shadow shadow-blue-200'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
                          }`}>
                          {selected && <Check size={11} />}
                          {classLabel(c)}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-slate-400 font-medium">
                  Leave all unticked to make this subject available to <strong>every</strong> class.
                </p>
              </div>

              <button onClick={handleSave} disabled={saving}
                className="w-full bg-slate-900 hover:bg-blue-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Save Subject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}