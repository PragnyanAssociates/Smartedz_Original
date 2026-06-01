import React, { useState } from 'react';
import { Plus, Edit, Trash2, X, BookOpen, Loader2, Check } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

export default function SubjectsTab({ data, fetchData, user }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [name, setName]           = useState('');
  const [classIds, setClassIds]   = useState([]);   // array of class id strings
  const [saving, setSaving]       = useState(false);

  const subjectClasses = data.subjectClasses || {};

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
    if (ids.length === 0) return null;   // -> "All classes"
    return ids
      .map(cid => {
        const c = data.classes.find(x => x.id === cid);
        return c ? classLabel(c) : null;
      })
      .filter(Boolean);
  };

  return (
    <div className="space-y-6">
      
      {/* Header - Fixed for Mobile */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-start mb-6">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Subjects</h3>
          <p className="text-[11px] text-zinc-500 max-w-2xl mt-1">
            Create subjects and assign them to classes. Marks Entry shows only a class's own subjects.
          </p>
        </div>
        <button onClick={openAdd}
          className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-sm shrink-0 w-fit self-start sm:self-auto">
          <Plus className="size-3.5 shrink-0" /> Add Subject
        </button>
      </div>

      {(data.subjects || []).length === 0 ? (
        <div className="bg-white p-8 rounded-lg ring-1 ring-black/5 border-dashed text-center">
          <BookOpen className="mx-auto text-zinc-300 mb-3 size-8" />
          <p className="text-xs text-zinc-500 italic">No subjects yet. Add one to begin.</p>
        </div>
      ) : (
        /* Main Table Layout - Fixed Mobile Scroll Overflow */
        <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap">Subject Name</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap">Assigned Classes</th>
                <th className="px-5 py-3 border-b border-zinc-100"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.subjects.map(s => {
                const names = subjectClassNames(s.id);
                return (
                  <tr key={s.id} className="hover:bg-zinc-50/60 transition-colors group">
                    <td className="px-5 py-4 text-sm font-medium text-zinc-900 whitespace-nowrap">{s.name}</td>
                    <td className="px-5 py-4">
                      {names === null ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 whitespace-nowrap">
                          All classes
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {names.map((n, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary ring-1 ring-primary/20 whitespace-nowrap">
                              {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(s)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded transition-colors" title="Edit">
                          <Edit className="size-4 shrink-0" />
                        </button>
                        <button onClick={() => handleDelete(s)}
                          className="p-1.5 text-zinc-400 hover:text-accent rounded transition-colors" title="Delete">
                          <Trash2 className="size-4 shrink-0" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg p-6 shadow-xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors">
              <X className="size-5 shrink-0" />
            </button>
            
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-zinc-900 mb-1">
                {editing ? 'Edit Subject' : 'Add Subject'}
              </h2>
              <p className="text-[11px] text-zinc-500">
                Pick every class that studies this subject.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1.5 block">
                  Subject Name <span className="text-accent">*</span>
                </label>
                <input 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Mathematics"
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" 
                />
              </div>

              <div className="ring-1 ring-black/5 rounded-md p-5 bg-zinc-50/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="size-3.5 text-zinc-500" />
                    <span className="text-xs font-semibold text-zinc-700">Assign to Classes</span>
                  </div>
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full tabular-nums">
                    {classIds.length} selected
                  </span>
                </div>

                {(data.classes || []).length === 0 ? (
                  <p className="text-[11px] text-zinc-500 italic bg-white p-3 rounded ring-1 ring-black/5">
                    No classes created yet. Add classes in the Classes tab first.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.classes.map(c => {
                      const id = String(c.id);
                      const selected = classIds.includes(id);
                      return (
                        <button type="button" key={c.id} onClick={() => toggleClass(c.id)}
                          className={`px-2.5 py-1.5 rounded-md text-[10px] font-semibold tracking-wide transition-colors flex items-center gap-1.5 ${
                            selected
                              ? 'bg-primary text-white ring-1 ring-primary'
                              : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
                          }`}>
                          {selected && <Check className="size-3" />}
                          {classLabel(c)}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-zinc-400 mt-3 pt-3 border-t border-zinc-200/60">
                  Leave all unticked to make this subject available to <strong>every</strong> class.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} 
                  className="text-zinc-700 px-4 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-2">
                  {saving && <Loader2 className="size-3.5 animate-spin" />}
                  {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Subject')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}