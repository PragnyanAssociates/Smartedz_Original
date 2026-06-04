import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, X, Layers } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

// Passed-out students (status 'alumni') have left the school, so they are
// not counted in a class's live student tally — matches the Users screen.
const isAlumni = (u) => (u.status || '').toLowerCase() === 'alumni';

export default function ClassesTab({ data, fetchData, user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing]         = useState(null);

  // -------- Form state --------
  // CREATE mode -> uses className + sections[] (chip array) + hasSections
  // EDIT mode   -> uses className + section (single string)
  const emptyForm = {
    className: '',
    hasSections: false,
    sections: [],         // chip list used only in Create mode
    sectionInput: '',     // typing buffer for the chip input
    section: ''           // single section used only in Edit mode
  };
  const [form, setForm] = useState(emptyForm);

  // Count active (non-alumni) students assigned to a given class row.
  const studentsInClass = (classId) =>
    data.users.filter(u => u.class_id === classId && !isAlumni(u)).length;

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
    const studentsHere = studentsInClass(c.id);
    const msg = studentsHere > 0
      ? `${studentsHere} student(s) are in this class. Deleting will unassign them. Continue?`
      : `Delete "${c.className}${c.section ? ' - ' + c.section : ''}"?`;
    if (!window.confirm(msg)) return;
    const res = await fetch(`${API_BASE_URL}/admin/classes/${c.id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  return (
    <div className="space-y-6">

      {/* Header - Fixed for Mobile */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-start mb-6">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Class Settings</h3>
          <p className="text-[11px] text-zinc-500 max-w-2xl mt-1">
            Create the classes that exist in your institution. Toggle "Has Sections"
            and add as many sections as you need in one go &mdash; A, B, C, D...
          </p>
        </div>
        <button onClick={openAdd}
          className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm shrink-0 w-fit self-start sm:self-auto">
          <Plus className="size-3.5 shrink-0" /> Add Class
        </button>
      </div>

      {grouped.length === 0 ? (
        <div className="bg-white p-8 rounded-lg ring-1 ring-black/5 border-dashed text-center">
          <Layers className="mx-auto text-zinc-300 mb-3 size-8" />
          <p className="text-xs text-zinc-500 italic">No classes created yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {grouped.map(g => (
            <div key={g.className} className="bg-white rounded-lg ring-1 ring-black/5 p-5 flex flex-col hover:ring-zinc-200 transition-colors">

              {/* Card Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 bg-zinc-50 ring-1 ring-black/5 rounded-md flex items-center justify-center text-primary shrink-0">
                  <Layers className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-zinc-900 leading-tight truncate">{g.className}</h4>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mt-0.5 whitespace-nowrap">
                    {g.rows.length} {g.rows.length === 1 && !g.rows[0].section ? 'entry' : 'section(s)'}
                  </p>
                </div>
              </div>

              {/* Rows */}
              <div className="space-y-2 mt-auto">
                {g.rows.map(c => {
                  const studentCount = studentsInClass(c.id);
                  return (
                    <div key={c.id} className="group flex items-center justify-between bg-zinc-50/50 rounded-md px-3 py-2 ring-1 ring-black/5 hover:bg-zinc-50 transition-colors">
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-zinc-700 text-xs truncate">
                          {c.section ? `Section ${c.section}` : 'No Sections'}
                        </p>
                        <p className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5 whitespace-nowrap">
                          {studentCount} student{studentCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => openEdit(c)} className="p-1.5 sm:p-1 text-zinc-400 hover:text-zinc-700 rounded transition-colors" title="Edit">
                          <Edit className="size-4 sm:size-3.5" />
                        </button>
                        <button onClick={() => handleDelete(c)} className="p-1.5 sm:p-1 text-zinc-400 hover:text-accent rounded transition-colors" title="Delete">
                          <Trash2 className="size-4 sm:size-3.5" />
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md p-6 shadow-xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors">
              <X className="size-5 shrink-0" />
            </button>

            <div className="mb-5">
              <h2 className="text-lg font-semibold text-zinc-900 mb-1">
                {editing ? 'Edit Class' : 'Create Class'}
              </h2>
              <p className="text-[11px] text-zinc-500">
                {editing
                  ? 'Editing a single row. To add more sections, close this and click "Add Class" again.'
                  : 'Tick to add Sections and type each section. Press Enter or comma to add Sections.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1.5 block">
                  Class Name <span className="text-accent">*</span>
                </label>
                <input required placeholder="e.g. Class 5"
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                  value={form.className} onChange={e => setForm({ ...form, className: e.target.value })} />
              </div>

              <label className="flex items-center gap-2 bg-zinc-50 ring-1 ring-black/5 rounded-md p-3 cursor-pointer mt-4 transition-colors hover:bg-zinc-100/50">
                <input type="checkbox" className="size-3.5 accent-primary cursor-pointer rounded border-zinc-300"
                  checked={form.hasSections}
                  onChange={e => setForm({ ...form, hasSections: e.target.checked })} />
                <span className="text-xs font-semibold text-zinc-700">This class has sections</span>
              </label>

              {/* CREATE MODE: chip input for multiple sections */}
              {form.hasSections && !editing && (
                <div className="flex flex-col gap-1.5 mt-4">
                  <label className="text-xs font-medium text-zinc-600 block">Sections</label>

                  <div className="bg-white border border-zinc-200 rounded-md p-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 min-h-[36px] flex flex-wrap items-center gap-1.5 transition-colors">
                    {form.sections.map(s => (
                      <span key={s} className="inline-flex items-center gap-1 bg-primary/10 text-primary ring-1 ring-primary/20 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded">
                        {s}
                        <button
                          type="button"
                          onClick={() => removeSectionChip(s)}
                          className="hover:bg-primary/20 rounded-full p-0.5 -mr-0.5 text-primary transition-colors">
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      autoFocus={form.sections.length === 0}
                      placeholder={form.sections.length ? 'Add another...' : 'Type A, then press Enter...'}
                      className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-zinc-900 placeholder:text-zinc-400 py-0.5"
                      value={form.sectionInput}
                      onChange={e => setForm({ ...form, sectionInput: e.target.value })}
                      onKeyDown={handleSectionKeyDown}
                      onBlur={() => form.sectionInput.trim() && addSectionChip()}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] mt-0.5">
                    <span className="text-zinc-500">
                      Press <kbd className="px-1 py-0.5 bg-zinc-100 rounded border border-zinc-200 font-mono">Enter</kbd> or <kbd className="px-1 py-0.5 bg-zinc-100 rounded border border-zinc-200 font-mono">,</kbd> to add the extra section at once.
                    </span>
                    <span className="text-zinc-500 font-medium">
                      {form.sections.length} section{form.sections.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              )}

              {/* EDIT MODE: single section input */}
              {form.hasSections && editing && (
                <div className="flex flex-col gap-1.5 mt-4">
                  <label className="text-xs font-medium text-zinc-600 block">
                    Section <span className="text-accent">*</span>
                  </label>
                  <input required placeholder="e.g. A"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors uppercase"
                    value={form.section}
                    onChange={e => setForm({ ...form, section: e.target.value.toUpperCase() })} />
                </div>
              )}

              <div className="pt-4 mt-4 border-t border-zinc-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-zinc-700 px-4 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="bg-primary text-white px-6 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                  {editing
                    ? 'Save Changes'
                    : form.hasSections
                      ? `Create ${form.sections.length || '...'} Section${form.sections.length === 1 ? '' : 's'}`
                      : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}