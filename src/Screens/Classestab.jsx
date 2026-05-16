import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, X, Layers } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

export default function ClassesTab({ data, fetchData, user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing]         = useState(null);

  // -------- Form state --------
  // CREATE mode → uses className + sections[] (chip array) + hasSections
  // EDIT mode   → uses className + section (single string)
  const emptyForm = {
    className: '',
    hasSections: false,
    sections: [],         // chip list used only in Create mode
    sectionInput: '',     // typing buffer for the chip input
    section: ''           // single section used only in Edit mode
  };
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
      ...emptyForm,
      className: c.className || '',
      hasSections: !!c.section,
      section: c.section || ''
    });
    setIsModalOpen(true);
  };

  // -------- Chip helpers (Create mode) --------
  const addSectionChip = (raw) => {
    const value = (raw ?? form.sectionInput).trim().toUpperCase();
    if (!value) return;
    // Allow comma- or space-separated bulk paste: "A, B, C" or "A B C"
    const parts = value.split(/[\s,]+/).filter(Boolean);
    setForm(prev => {
      const merged = Array.from(new Set([...prev.sections, ...parts]));
      return { ...prev, sections: merged, sectionInput: '' };
    });
  };

  const removeSectionChip = (s) => {
    setForm(prev => ({ ...prev, sections: prev.sections.filter(x => x !== s) }));
  };

  const handleSectionKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSectionChip();
    } else if (e.key === 'Backspace' && !form.sectionInput && form.sections.length > 0) {
      // Backspace on empty input removes the last chip
      setForm(prev => ({ ...prev, sections: prev.sections.slice(0, -1) }));
    }
  };

  // -------- Submit --------
  const handleSubmit = async (e) => {
    e.preventDefault();

    // ===== EDIT MODE =====
    if (editing) {
      const body = {
        className: form.className,
        section: form.hasSections ? (form.section || null) : null,
        institutionId: user.institutionId
      };
      const res = await fetch(`${API_BASE_URL}/admin/classes/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert('Failed to save class.');
      }
      return;
    }

    // ===== CREATE MODE =====
    // Flush any pending text in the chip input into the array
    let sections = form.sections;
    if (form.sectionInput.trim()) {
      const flushed = form.sectionInput.trim().toUpperCase().split(/[\s,]+/).filter(Boolean);
      sections = Array.from(new Set([...sections, ...flushed]));
    }

    if (form.hasSections && sections.length === 0) {
      return alert('Please add at least one section, or uncheck "This class has sections".');
    }

    const body = {
      className: form.className,
      sections: form.hasSections ? sections : [null],   // [null] = a single row with no section
      institutionId: user.institutionId
    };

    const res = await fetch(`${API_BASE_URL}/admin/classes/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      if (json.skipped && json.skipped.length > 0) {
        alert(`Created ${json.created} section(s). Skipped duplicates: ${json.skipped.join(', ')}`);
      }
      setIsModalOpen(false);
      fetchData();
    } else {
      alert('Failed to save class.');
    }
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
            and add as many sections as you need in one go — A, B, C, D…
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
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-2 text-slate-800">
              {editing ? 'Edit Class' : 'Create Class'}
            </h2>
            <p className="text-sm text-slate-400 font-medium mb-8">
              {editing
                ? 'Editing a single row. To add more sections, close this and click "Add Class" again.'
                : 'Tick "Has Sections" and type each section. Press Enter or comma to add it as a chip.'}
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
                  onChange={e => setForm({ ...form, hasSections: e.target.checked })} />
                <span className="text-sm font-bold text-slate-700">This class has sections</span>
              </label>

              {/* CREATE MODE: chip input for multiple sections */}
              {form.hasSections && !editing && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Sections</label>

                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 focus-within:ring-2 focus-within:ring-blue-500/10 min-h-[52px] flex flex-wrap items-center gap-2">
                    {form.sections.map(s => (
                      <span key={s} className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full">
                        {s}
                        <button
                          type="button"
                          onClick={() => removeSectionChip(s)}
                          className="hover:bg-white/20 rounded-full p-0.5 -mr-1">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <input
                      autoFocus={form.sections.length === 0}
                      placeholder={form.sections.length ? 'Add another…' : 'Type A, then press Enter…'}
                      className="flex-1 min-w-[120px] bg-transparent outline-none text-sm py-1"
                      value={form.sectionInput}
                      onChange={e => setForm({ ...form, sectionInput: e.target.value })}
                      onKeyDown={handleSectionKeyDown}
                      onBlur={() => form.sectionInput.trim() && addSectionChip()}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400 font-medium">
                      Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">Enter</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">,</kbd> after each section. You can also paste "A, B, C, D".
                    </span>
                    <span className="text-slate-500 font-bold">
                      {form.sections.length} section{form.sections.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              )}

              {/* EDIT MODE: single section input */}
              {form.hasSections && editing && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Section</label>
                  <input required placeholder="e.g. A"
                    className="bg-slate-50 border border-slate-100 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/10 outline-none uppercase"
                    value={form.section}
                    onChange={e => setForm({ ...form, section: e.target.value.toUpperCase() })} />
                </div>
              )}

              <button type="submit" className="w-full bg-slate-900 hover:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest mt-4 transition-all shadow-xl">
                {editing
                  ? 'Save Changes'
                  : form.hasSections
                    ? `Create ${form.sections.length || '…'} Section${form.sections.length === 1 ? '' : 's'}`
                    : 'Create Class'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}