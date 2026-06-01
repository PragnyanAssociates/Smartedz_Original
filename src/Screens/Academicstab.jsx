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
      
      {/* Header - Fixed Mobile Flex and Button Width */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-start mb-6">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Academic Years</h3>
          <p className="text-[11px] text-zinc-500 max-w-2xl mt-1">
            One year is always <strong>active</strong>; modules like Attendance, Fees and Reports anchor to whichever is currently flagged.
          </p>
        </div>
        <button onClick={openAdd} 
          className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-sm shrink-0 w-fit self-start sm:self-auto">
          <Plus className="size-3.5 shrink-0" /> Add Year
        </button>
      </div>

      {/* Cards Grid - Progressive Breakpoints */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.academicYears.map(y => (
          <div key={y.id} className={`group relative bg-white rounded-lg p-5 transition-all flex flex-col ${
            y.isActive
              ? 'ring-2 ring-green-500/20 bg-green-50/30'
              : 'ring-1 ring-black/5 hover:ring-zinc-200 hover:shadow-sm'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`size-10 rounded-md flex items-center justify-center shrink-0 ${
                y.isActive ? 'bg-green-100 text-green-600' : 'bg-zinc-50 text-zinc-500 ring-1 ring-black/5'
              }`}>
                <Calendar className="size-4" />
              </div>

              {/* Hover Actions */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(y)} className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors" title="Edit">
                  <Edit className="size-4 shrink-0" />
                </button>
                <button onClick={() => handleDelete(y)} className="p-1.5 rounded text-zinc-400 hover:text-accent hover:bg-accent/10 transition-colors" title="Delete">
                  <Trash2 className="size-4 shrink-0" />
                </button>
              </div>
            </div>

            <h4 className="text-sm font-semibold text-zinc-900 leading-tight">{y.name}</h4>
            <p className="text-[10px] font-medium text-zinc-500 mt-1 uppercase tracking-wider whitespace-nowrap">
              {fmt(y.startDate)} &mdash; {fmt(y.endDate)}
            </p>

            {/* Footer Row */}
            <div className="mt-5 pt-4 border-t border-zinc-100/60 flex items-center">
              {y.isActive ? (
                <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">
                  <CheckCircle2 className="size-3.5" /> Currently Active
                </span>
              ) : (
                <button onClick={() => handleSetActive(y)}
                  className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-primary font-semibold text-[10px] uppercase tracking-wider transition-colors whitespace-nowrap">
                  <Circle className="size-3.5" /> Set as Active
                </button>
              )}
            </div>
          </div>
        ))}

        {data.academicYears.length === 0 && (
          <div className="col-span-full bg-white p-8 rounded-lg ring-1 ring-black/5 border-dashed text-center">
            <p className="text-xs text-zinc-500 italic">No academic years yet. Create one to get started.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-sm p-6 shadow-xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors">
              <X className="size-5 shrink-0" />
            </button>
            
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-zinc-900 mb-1">
                {editing ? 'Edit Academic Year' : 'Create Academic Year'}
              </h2>
              <p className="text-[11px] text-zinc-500">
                Pick the start and end dates (e.g. June 2026 - April 2027).
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1.5 block">
                  Name <span className="text-accent">*</span>
                </label>
                <input required placeholder="e.g. 2026 - 2027"
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-600 mb-1.5 block">Start Date <span className="text-accent">*</span></label>
                  <input type="date" required
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                    value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 mb-1.5 block">End Date <span className="text-accent">*</span></label>
                  <input type="date" required
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                    value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-zinc-700 px-4 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="bg-primary text-white px-6 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                  {editing ? 'Save Changes' : 'Create Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}