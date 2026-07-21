import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Loader2, RefreshCw, BarChart3, BookOpen, ChevronDown, Save,
  HelpCircle, ShieldCheck
} from 'lucide-react';
import { fmtDate } from './SyllabusUtils';
// Time-only, rendered in IST (Railway stores UTC). Pairs with fmtDate for
// the date line so "Last Updated" can show name / date / time.
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
// =====================================================================
//  Syllabus Management - the landing screen.
//
//  A table of syllabuses: SUBJECT / CLASS / LESSONS / TEACHER /
//  LAST UPDATED / ACTIONS. Filter by class, create / edit / delete.
//  The green chart action opens the Subject Index for that syllabus.
//  (Academic-year logic removed — syllabuses are no longer year-stamped.)
// =====================================================================
export default function SyllabusManagement({
  user, canEdit, classes, subjects, subjectClasses, teachers,
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
  const handleSave = async (e) => {
    e.preventDefault();
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2 sm:mb-0">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <BookOpen className="text-primary size-5" />
            Syllabus Management
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Create and manage syllabuses for different classes and subjects.
          </p>
        </div>
        <SyllabusManagementHelp canEdit={canEdit} />
      </header>
      {/* Action bar & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider shrink-0">Filter:</span>
            <div className="relative w-full sm:w-48">
              <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
                className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                <option value="">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{classLabel(c)}</option>
                ))}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <button onClick={load} disabled={loading}
            className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Refresh
          </button>
        </div>
        {canEdit && (
          <button onClick={openCreate}
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full md:w-auto shrink-0">
            <Plus className="size-3.5" /> Create Syllabus
          </button>
        )}
      </div>
      {/* Table */}
      <div className="flex-1">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin size-8 text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <BookOpen className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">No syllabuses yet.</p>
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
                      <div className="text-xs font-semibold text-zinc-700">{row.updated_by_name || '\u2014'}</div>
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
      {/* ---- CREATE / EDIT MODAL ---- */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md shadow-xl relative flex flex-col animate-in fade-in zoom-in-95 duration-200">

            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">
                {editing ? 'Edit Syllabus' : 'Create Syllabus'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">

                <Field label="Class" type="select" required value={form.class_id}
                  onChange={v => setForm({ ...form, class_id: v, subject_id: '' })}
                  options={[
                    { value: '', label: 'Select class' },
                    ...classes.map(c => ({ value: String(c.id), label: classLabel(c) }))
                  ]} />

                <Field label="Subject" type="select" required value={form.subject_id}
                  onChange={v => setForm({ ...form, subject_id: v })}
                  options={[
                    { value: '', label: form.class_id ? 'Select subject' : 'Select a class first' },
                    ...subjectsForClass.map(s => ({ value: String(s.id), label: s.name }))
                  ]} />

                <Field label="Teacher" type="select" value={form.teacher_id}
                  onChange={v => setForm({ ...form, teacher_id: v })}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...teachers.map(t => ({ value: String(t.id), label: t.name }))
                  ]} />

              </div>
              <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
                <button type="button" onClick={() => setModalOpen(false)} disabled={saving}
                  className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
                  Cancel
                </button>
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
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3}
          placeholder={placeholder} className={`${base} h-auto py-2.5 resize-none`} required={required} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={base} required={required} />
      )}
    </div>
  );
}

// =====================================================================
//  SyllabusManagementHelp — "How to use" guide (same theme as ReportsHelp).
//  Editors get the manage guide; read-only users get the browse one.
// =====================================================================
const GUIDES = {
  manage: {
    title: 'Syllabus Management',
    steps: [
      ['1 \u00b7 What this is', 'One syllabus per class + subject. The table shows the subject, class, how many lessons it has, its teacher, and who last updated it.'],
      ['2 \u00b7 Create a syllabus', 'Create Syllabus picks a class, a subject and (optionally) a teacher. A class-and-subject pair is unique \u2014 you can\u2019t create the same one twice.'],
      ['3 \u00b7 Manage (Subject Index)', 'The green Manage button opens the Subject Index for that syllabus: upload the textbook, auto-detect chapters, add keywords, and set the lesson periods.'],
      ['4 \u00b7 Filter & refresh', 'Narrow the table by class, and use Refresh to reload the list.'],
      ['5 \u00b7 Edit & delete', 'Hover a row for the edit and delete actions. Deleting a syllabus also removes its lessons and keywords.'],
    ],
    note: 'A syllabus carries across academic years \u2014 there\u2019s no year to pick here, so what you build stays until you change it.'
  },
  view: {
    title: 'Syllabus Management',
    steps: [
      ['1 \u00b7 Browse', 'One row per syllabus \u2014 a class + subject pairing \u2014 with its lesson count and teacher.'],
      ['2 \u00b7 Open a syllabus', 'The Manage button opens the Subject Index, where you can read the chapters, the textbook and the keywords.'],
      ['3 \u00b7 Filter', 'Narrow the list by class to find one quickly.'],
    ],
    note: 'This is a read-only view \u2014 syllabuses are created and edited by teachers.'
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