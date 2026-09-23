import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Loader2, RefreshCw, BarChart3, BookOpen, ChevronDown, Save,
  HelpCircle, ShieldCheck, Layers, Library as LibraryIcon
} from 'lucide-react';
import { fmtDate } from './SyllabusUtils';

const fmtTimeIST = (val) => {
  if (!val) return '';
  let d;
  if (typeof val === 'string' && !val.includes('T') && !val.endsWith('Z')) {
    d = new Date(val.replace(' ', 'T') + 'Z');
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const classLabel = (c) => `${c.className}${c.section ? ' - ' + c.section : ''}`;

// =====================================================================
//  Syllabus Management
//
//  Type tab + class filter are CONTROLLED by the parent (Syllabus.jsx),
//  which remembers them, so coming back to this screen - or to the
//  module later - reopens the same tab and class.
//  There is no "All Classes" option: exactly one class is always shown.
// =====================================================================
export default function SyllabusManagement({
  user, canEdit, classes, subjects, subjectClasses, teachers,
  activeTypeId, onTypeChange, filterClass, onClassChange,
  onOpenSyllabus, onOpenLibrary
}) {
  // ---- Syllabus types (tabs) ----
  const [types, setTypes]               = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typeModal, setTypeModal]       = useState(null); // { editing? } | null

  // ---- Syllabus rows ----
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const reqSeq = useRef(0);

  // ---- create / edit syllabus modal ----
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm] = useState({ class_id: '', subject_id: '', teacher_id: '', syllabus_type_id: '' });
  const [saving, setSaving] = useState(false);

  const activeType  = useMemo(() => types.find(t => String(t.id) === String(activeTypeId)) || null, [types, activeTypeId]);
  const activeClass = useMemo(() => classes.find(c => String(c.id) === String(filterClass)) || null, [classes, filterClass]);

  // ---- load types ----
  const loadTypes = useCallback(async () => {
    if (!user?.institutionId) return;
    setTypesLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/types/${user.institutionId}`);
      const d = await res.json();
      setTypes(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setTypesLoading(false);
  }, [user]);

  useEffect(() => { loadTypes(); }, [loadTypes]);

  // Keep a valid type selected - only AFTER types have loaded, otherwise the
  // empty initial list would wipe the remembered tab.
  useEffect(() => {
    if (typesLoading) return;
    if (types.length === 0) { if (activeTypeId != null) onTypeChange(null); return; }
    if (!types.some(t => String(t.id) === String(activeTypeId))) onTypeChange(String(types[0].id));
  }, [types, typesLoading, activeTypeId, onTypeChange]);

  // Keep a valid class selected (no "All Classes").
  useEffect(() => {
    if (classes.length === 0) return;
    if (!classes.some(c => String(c.id) === String(filterClass))) onClassChange(String(classes[0].id));
  }, [classes, filterClass, onClassChange]);

  // ---- load syllabus rows for the active type + class ----
  const load = useCallback(async () => {
    const seq = ++reqSeq.current;
    if (!user?.institutionId || !activeTypeId || !filterClass) { setRows([]); setLoading(false); return; }
    setLoading(true);
    try {
      const url = `${API_BASE_URL}/admin/syllabus/list/${user.institutionId}?typeId=${activeTypeId}&classId=${filterClass}`;
      const res = await fetch(url);
      const d = await res.json();
      if (seq === reqSeq.current) setRows(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    if (seq === reqSeq.current) setLoading(false);
  }, [user, filterClass, activeTypeId]);

  useEffect(() => { load(); }, [load]);

  // ---- subjects available for the class chosen in the modal ----
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
    if (!activeTypeId) return alert('Create a syllabus type first.');
    setEditing(null);
    setForm({ class_id: filterClass ? String(filterClass) : '', subject_id: '', teacher_id: '', syllabus_type_id: String(activeTypeId) });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      class_id: String(row.class_id),
      subject_id: String(row.subject_id),
      teacher_id: row.teacher_id ? String(row.teacher_id) : '',
      syllabus_type_id: row.syllabus_type_id ? String(row.syllabus_type_id) : String(activeTypeId || '')
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.class_id || !form.subject_id) return alert('Class and Subject are required.');
    if (!form.syllabus_type_id) return alert('A syllabus type is required.');
    setSaving(true);
    try {
      const payload = {
        class_id: parseInt(form.class_id, 10),
        subject_id: parseInt(form.subject_id, 10),
        teacher_id: form.teacher_id ? parseInt(form.teacher_id, 10) : null,
        syllabus_type_id: parseInt(form.syllabus_type_id, 10)
      };
      const res = editing
        ? await fetch(`${API_BASE_URL}/admin/syllabus/${editing.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
          })
        : await fetch(`${API_BASE_URL}/admin/syllabus`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, institutionId: user.institutionId, created_by: user.id })
          });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setModalOpen(false);
      // follow the syllabus if it landed in another type or class
      if (String(payload.syllabus_type_id) !== String(activeTypeId)) onTypeChange(String(payload.syllabus_type_id));
      if (String(payload.class_id) !== String(filterClass)) onClassChange(String(payload.class_id));
      loadTypes();
      load();
    } catch (e2) { alert(e2.message); }
    setSaving(false);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(
      `Delete the ${row.subject_name} syllabus for ${row.class_group}? All its lessons and keywords will be removed.`
    )) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      loadTypes();
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDeleteType = async () => {
    if (!activeType) return;
    if (!window.confirm(`Delete the "${activeType.name}" type?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/types/${activeType.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Delete failed');
      onTypeChange(null);
      loadTypes();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2 sm:mb-0">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <BookOpen className="text-primary size-5" />
            Syllabus Management
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Group syllabuses under types, then manage each class and subject.
          </p>
        </div>
        <SyllabusManagementHelp canEdit={canEdit} />
      </header>

      {/* ---- SYLLABUS TYPE TABS ---- */}
      <div className="border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Layers className="size-3.5 text-zinc-400" />
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Syllabus Type</span>
        </div>
        {typesLoading && types.length === 0 ? (
          <div className="h-9 flex items-center"><Loader2 className="size-4 animate-spin text-primary" /></div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
            {types.map(t => {
              const active = String(t.id) === String(activeTypeId);
              return (
                <button key={t.id} onClick={() => onTypeChange(String(t.id))}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    active ? 'bg-primary text-white shadow-sm' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
                  }`}>
                  {t.name}
                  <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${active ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                    {t.syllabus_count}
                  </span>
                </button>
              );
            })}

            {canEdit && (
              <button onClick={() => setTypeModal({})}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 text-primary ring-1 ring-dashed ring-primary/30 hover:bg-primary/5 transition-colors">
                <Plus className="size-3.5" /> New Type
              </button>
            )}

            {canEdit && activeType && (
              <div className="flex items-center gap-1 pl-1 ml-1 border-l border-zinc-200 shrink-0">
                <button onClick={() => setTypeModal({ editing: activeType })} title="Rename type"
                  className="size-8 bg-white ring-1 ring-black/5 shadow-sm hover:bg-zinc-50 text-zinc-500 hover:text-primary rounded-md flex items-center justify-center transition-colors">
                  <Edit className="size-3.5" />
                </button>
                <button onClick={handleDeleteType} title="Delete type"
                  className="size-8 bg-white ring-1 ring-black/5 shadow-sm hover:bg-zinc-50 text-zinc-500 hover:text-red-600 rounded-md flex items-center justify-center transition-colors">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!typesLoading && types.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center flex-1 justify-center">
          <Layers className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No syllabus types yet.</p>
          {canEdit
            ? <button onClick={() => setTypeModal({})} className="mt-3 h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"><Plus className="size-3.5" /> Create your first type</button>
            : <p className="text-zinc-400 text-xs mt-1.5">Ask a teacher to set one up.</p>}
        </div>
      ) : (
        <>
          {/* Action bar & Filters */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider shrink-0">Filter:</span>
                <div className="relative w-full sm:w-48">
                  <select value={filterClass} onChange={e => onClassChange(e.target.value)}
                    disabled={classes.length === 0}
                    className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                    {classes.length === 0 && <option value="">No classes</option>}
                    {classes.map(c => (<option key={c.id} value={String(c.id)}>{classLabel(c)}</option>))}
                  </select>
                  <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <button onClick={() => { loadTypes(); load(); }} disabled={loading}
                className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0">
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Refresh
              </button>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button onClick={() => activeType && onOpenLibrary(activeType)} disabled={!activeType}
                title={activeType ? `Textbooks and materials for ${activeType.name}` : ''}
                className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 hover:text-primary hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors flex-1 md:flex-none">
                <LibraryIcon className="size-3.5" /> Library
              </button>
              {canEdit && (
                <button onClick={openCreate}
                  className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors flex-1 md:flex-none">
                  <Plus className="size-3.5" /> Create Syllabus
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1">
            {loading ? (
              <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
            ) : rows.length === 0 ? (
              <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
                <BookOpen className="size-10 text-zinc-300 mb-3" />
                <p className="text-zinc-500 text-sm font-medium">
                  No syllabuses for {activeClass ? classLabel(activeClass) : 'this class'} in {activeType ? `"${activeType.name}"` : 'this type'} yet.
                </p>
                {canEdit && <p className="text-zinc-400 text-xs mt-1.5">Click "Create Syllabus" to begin.</p>}
              </div>
            ) : (
              <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar flex-1">
                <table className="w-full text-left border-collapse min-w-[860px]">
                  <thead className="bg-zinc-50/80">
                    <tr>
                      <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Subject</th>
                      <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Class</th>
                      <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-center">Lessons</th>
                      <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Teacher</th>
                      <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Last Updated</th>
                      <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {rows.map(row => (
                      <tr key={row.id} className="hover:bg-zinc-50/60 transition-colors group">
                        <td className="px-5 py-4 font-semibold text-zinc-900 text-sm">{row.subject_name}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-black/5">
                            {row.class_group}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center font-semibold text-primary tabular-nums">{row.lesson_count}</td>
                        <td className="px-5 py-4 text-sm font-medium text-zinc-700">
                          {row.teacher_name || <span className="text-zinc-400 italic">Unassigned</span>}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-xs font-semibold text-zinc-700">{row.updated_by_name || '-'}</div>
                          <div className="text-sm font-medium text-zinc-500 mt-0.5">{fmtDate(row.updated_at)}</div>
                          {row.updated_at && <div className="text-[11px] text-zinc-400 mt-0.5">{fmtTimeIST(row.updated_at)}</div>}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => onOpenSyllabus(row)} title="Manage Syllabus"
                              className="h-8 px-3 rounded-md font-semibold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                              <BarChart3 className="size-3.5" /> Manage
                            </button>
                            {canEdit && (
                              <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-1">
                                <button onClick={() => openEdit(row)} title="Edit"
                                  className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                                  <Edit className="size-3.5" />
                                </button>
                                <button onClick={() => handleDelete(row)} title="Delete"
                                  className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-red-600 rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {typeModal && (
        <TypeModal
          editing={typeModal.editing}
          onClose={() => setTypeModal(null)}
          onSaved={(newId) => {
            setTypeModal(null);
            loadTypes();
            if (newId) onTypeChange(String(newId));
          }} />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md shadow-xl relative flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">{editing ? 'Edit Syllabus' : 'Create Syllabus'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">
                {editing ? (
                  <Field label="Syllabus Type" type="select" required value={form.syllabus_type_id}
                    onChange={v => setForm({ ...form, syllabus_type_id: v })}
                    options={types.map(t => ({ value: String(t.id), label: t.name }))} />
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Syllabus Type</label>
                    <div className="h-9 w-full bg-zinc-50 border border-zinc-200 rounded-md px-3 text-sm text-zinc-700 font-medium flex items-center gap-1.5">
                      <Layers className="size-3.5 text-primary" /> {activeType?.name || '-'}
                    </div>
                  </div>
                )}

                <Field label="Class" type="select" required value={form.class_id}
                  onChange={v => setForm({ ...form, class_id: v, subject_id: '' })}
                  options={[{ value: '', label: 'Select class' }, ...classes.map(c => ({ value: String(c.id), label: classLabel(c) }))]} />

                <Field label="Subject" type="select" required value={form.subject_id}
                  onChange={v => setForm({ ...form, subject_id: v })}
                  options={[{ value: '', label: form.class_id ? 'Select subject' : 'Select a class first' }, ...subjectsForClass.map(s => ({ value: String(s.id), label: s.name }))]} />

                <Field label="Teacher" type="select" value={form.teacher_id}
                  onChange={v => setForm({ ...form, teacher_id: v })}
                  options={[{ value: '', label: 'Unassigned' }, ...teachers.map(t => ({ value: String(t.id), label: t.name }))]} />
              </div>
              <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
                <button type="button" onClick={() => setModalOpen(false)} disabled={saving}
                  className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">Cancel</button>
                <button type="submit" disabled={saving}
                  className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">
                  {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
                  {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Syllabus')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Add / rename a syllabus type ---
function TypeModal({ editing, onClose, onSaved }) {
  const [name, setName] = useState(editing?.name || '');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('A type name is required.');
    setSaving(true);
    try {
      const url = editing
        ? `${API_BASE_URL}/admin/syllabus/types/${editing.id}`
        : `${API_BASE_URL}/admin/syllabus/types`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      onSaved(editing ? editing.id : d.id);
    } catch (e2) { alert(e2.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-sm shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg">
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
            <Layers className="size-4 text-primary" /> {editing ? 'Rename Type' : 'New Syllabus Type'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md"><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col">
          <div className="p-5 sm:p-6 space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Type Name <span className="text-red-500">*</span></label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. State Board, CBSE, Bridge Course"
              className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
          </div>
          <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg">
            <button type="button" onClick={onClose} disabled={saving}
              className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors min-w-[100px]">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {saving ? 'Saving...' : (editing ? 'Save' : 'Add Type')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Shared Field Component ---
function Field({ label, value, onChange, type = 'text', options, required, placeholder }) {
  const base = "h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm";
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'select' ? (
        <div className="relative">
          <select value={value || ''} onChange={e => onChange(e.target.value)}
            className={`${base} cursor-pointer appearance-none pr-8`} required={required}>
            {(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={base} required={required} />
      )}
    </div>
  );
}

// =====================================================================
//  SyllabusManagementHelp - "How to use" guide
// =====================================================================
const GUIDES = {
  manage: {
    title: 'Syllabus Management',
    steps: [
      ['1 - Syllabus Types (tabs)', 'Syllabuses are grouped under types shown as tabs (e.g. State Board, CBSE). Add a type once with New Type; after that just click its tab. The tab you pick is remembered, even after you leave this page.'],
      ['2 - Class filter', 'One class is always selected. Switching tabs keeps the same class, and it is remembered too.'],
      ['3 - Create a syllabus', 'Create Syllabus adds one under the selected type tab, with the filtered class already chosen. One syllabus per class + subject per type.'],
      ['4 - Manage (Subject Index)', 'The green Manage button opens the Subject Index: upload the textbook, auto-detect chapters, add keywords and set lesson periods.'],
      ['5 - Library', 'Each type has its own Library. Create a folder for a class + subject and keep textbooks, notes and worksheets in it (PDF, Word, Excel).'],
      ['6 - Edit, move & delete', 'Hover a row for edit/delete. Editing lets you move a syllabus to another type. A type can only be deleted when it has no syllabuses and no library folders.'],
    ],
    note: 'Types, syllabuses and the library carry across academic years - there\'s no year to pick here.'
  },
  view: {
    title: 'Syllabus Management',
    steps: [
      ['1 - Types', 'Pick a type tab, then a class, to see the syllabuses under it.'],
      ['2 - Open a syllabus', 'The Manage button opens the Subject Index to read chapters, the textbook and keywords.'],
      ['3 - Library', 'Library holds the textbooks and materials for the selected type, in folders by class and subject.'],
    ],
    note: 'This is a read-only view - types, syllabuses and the library are set up by teachers.'
  }
};

function SyllabusManagementHelp({ canEdit = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const content = canEdit ? GUIDES.manage : GUIDES.view;
  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 self-start ${className}`}>
        <HelpCircle className="size-3.5" /> How to use
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
              <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X className="size-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              {content.steps.map(([t, d], i) => (
                <div key={i} className="rounded-md ring-1 ring-zinc-100 bg-zinc-50/60 p-3">
                  <p className="text-xs font-semibold text-zinc-800">{t}</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
                </div>
              ))}
              <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex gap-2">
                <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">{content.note}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}