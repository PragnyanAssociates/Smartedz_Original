import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, X, Layers } from 'lucide-react';
import { API_BASE_URL } from '../../api';

export default function ClassesTab({ data, fetchData, user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing]         = useState(null);
  const emptyForm = { className: '', section: '', hasSections: false };
  const [form, setForm] = useState(emptyForm);

  // Group rows by className so multiple sections of the same class appear together.
  const grouped = useMemo(() => {
    const out = {};
    data.classes.forEach(c => {
      if (!out[c.className]) out[c.className] = [];
      out[c.className].push(c);
    });
    return Object.entries(out).map(([className, rows]) => ({ className, rows }));
  }, [data.classes]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      className: c.className || '',
      section: c.section || '',
      hasSections: !!c.section
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing
      ? `${API_BASE_URL}/admin/classes/${editing.id}`
      : `${API_BASE_URL}/admin/classes`;
    const body = {
      className: form.className,
      section: form.hasSections ? form.section : null,
      institutionId: user.institutionId
    };
    const res = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      setIsModalOpen(false);
      fetchData();
    } else alert('Failed to save class.');
  };

  const handleDelete = async (c) => {
    const studentsHere = data.users.filter(u => u.class_id === c.id).length;
    const msg = studentsHere > 0
      ? `${studentsHere} student(s) are in this class. Deleting will unassign them. Continue?`
      : `Delete "${c.className}${c.section ? ' - ' + c.section : ''}"?`;
    if (!window.confirm(msg)) return;
    const res = await fetch(`${API_BASE_URL}/admin/classes/${c.id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Class Settings</h3>
          <p className="text-slate-400 text-sm font-medium mt-1">
            Create the classes that exist in your institution. Toggle "Has Sections"
            to add Section A, B, C and so on. Classes with no sections are stored as a single row.
          </p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
          <Plus size={18} /> Add Class
        </button>
      </div>

      {grouped.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
          <Layers className="mx-auto text-slate-300 mb-3" size={42} />
          <p className="text-slate-400 font-bold">No classes created yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {grouped.map(g => (
            <div key={g.className} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <Layers size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-800">{g.className}</h4>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {g.rows.length} {g.rows.length === 1 && !g.rows[0].section ? 'entry' : 'section(s)'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {g.rows.map(c => {
                  const studentCount = data.users.filter(u => u.class_id === c.id).length;
                  return (
                    <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3">
                      <div>
                        <p className="font-bold text-slate-700 text-sm">
                          {c.section ? `Section ${c.section}` : 'No Sections'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {studentCount} student{studentCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(c)} className="p-2 text-slate-300 hover:text-blue-500 hover:bg-white rounded-lg transition-all">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(c)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-white rounded-lg transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-2 text-slate-800">
              {editing ? 'Edit Class' : 'Create Class'}
            </h2>
            <p className="text-sm text-slate-400 font-medium mb-8">
              To create multiple sections (A, B, C), save the class once per section.
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Class Name</label>
                <input required placeholder="e.g. Class 5"
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/10 outline-none"
                  value={form.className} onChange={e => setForm({ ...form, className: e.target.value })} />
              </div>

              <label className="flex items-center gap-3 bg-slate-50 rounded-2xl p-4 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 accent-blue-600 cursor-pointer"
                  checked={form.hasSections}
                  onChange={e => setForm({ ...form, hasSections: e.target.checked, section: e.target.checked ? form.section : '' })} />
                <span className="text-sm font-bold text-slate-700">This class has sections</span>
              </label>

              {form.hasSections && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Section</label>
                  <input required placeholder="e.g. A"
                    className="bg-slate-50 border border-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/10 outline-none"
                    value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} />
                </div>
              )}

              <button type="submit" className="w-full bg-slate-900 hover:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest mt-4 transition-all shadow-xl">
                {editing ? 'Save Changes' : 'Create Class'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}