import React, { useState } from 'react';
import { Plus, Edit, Trash2, X, Calendar, CheckCircle2, Circle } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

export default function AcademicsTab({ data, fetchData, user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing]         = useState(null);
  const emptyForm = { name: '', startDate: '', endDate: '' };
  const [form, setForm] = useState(emptyForm);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (y) => {
    setEditing(y);
    setForm({
      name: y.name || '',
      startDate: y.startDate ? y.startDate.slice(0, 10) : '',
      endDate:   y.endDate   ? y.endDate.slice(0, 10)   : ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing
      ? `${API_BASE_URL}/admin/academics/${editing.id}`
      : `${API_BASE_URL}/admin/academics`;
    const res = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, institutionId: user.institutionId })
    });
    if (res.ok) {
      setIsModalOpen(false);
      fetchData();
    } else alert('Failed to save academic year.');
  };

  const handleSetActive = async (y) => {
    const res = await fetch(`${API_BASE_URL}/admin/academics/set-active/${y.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ institutionId: user.institutionId })
    });
    if (res.ok) fetchData();
  };

  const handleDelete = async (y) => {
    if (y.isActive) return alert('Set another year active before deleting this one.');
    if (!window.confirm(`Delete academic year "${y.name}"?`)) return;
    const res = await fetch(`${API_BASE_URL}/admin/academics/${y.id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Academic Years</h3>
          <p className="text-slate-400 text-sm font-medium mt-1">
            One year is always <strong>active</strong>; modules like Attendance, Fees and Reports
            anchor to whichever is currently flagged.
          </p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
          <Plus size={18} /> Add Year
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {data.academicYears.map(y => (
          <div key={y.id} className={`rounded-3xl border p-6 shadow-sm transition-all ${
            y.isActive
              ? 'bg-emerald-50/50 border-emerald-200 shadow-emerald-100'
              : 'bg-white border-slate-100 hover:shadow-md'
          }`}>
            <div className="flex justify-between items-start mb-5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                y.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'
              }`}>
                <Calendar size={20} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(y)} className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                  <Edit size={16} />
                </button>
                <button onClick={() => handleDelete(y)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <h4 className="text-xl font-black text-slate-800">{y.name}</h4>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-2">
              {fmt(y.startDate)} → {fmt(y.endDate)}
            </p>
            <div className="mt-5">
              {y.isActive ? (
                <span className="inline-flex items-center gap-2 text-emerald-700 font-black text-xs uppercase tracking-widest">
                  <CheckCircle2 size={14} /> Currently Active
                </span>
              ) : (
                <button onClick={() => handleSetActive(y)}
                  className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-widest transition-colors">
                  <Circle size={14} /> Set as Active
                </button>
              )}
            </div>
          </div>
        ))}

        {data.academicYears.length === 0 && (
          <div className="col-span-full bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-bold">No academic years yet. Create one to get started.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-2 text-slate-800">
              {editing ? 'Edit Academic Year' : 'Create Academic Year'}
            </h2>
            <p className="text-sm text-slate-400 font-medium mb-8">
              Pick the start and end dates (e.g. June 2026 – April 2027).
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Name</label>
                <input required placeholder="e.g. 2026 - 2027"
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/10 outline-none"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
                  <input type="date" required
                    className="bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none"
                    value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">End Date</label>
                  <input type="date" required
                    className="bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none"
                    value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest mt-4 transition-all shadow-xl">
                {editing ? 'Save Changes' : 'Create Year'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}