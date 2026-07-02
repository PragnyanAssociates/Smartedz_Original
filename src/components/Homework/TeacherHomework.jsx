import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Eye, Search, Loader2, ArrowLeft,
  Paperclip, FileText, Star, ClipboardList, BookOpen, ChevronDown, Save
} from 'lucide-react';
import { fmtDate, isoDate, fileToBase64 } from './HwUtils';
import FileViewer from './FileViewer';

// Numeric roll for ordering (non-numeric / missing rolls sort last)
const rollNum = (s) => {
  const n = parseInt(s?.roll_no, 10);
  return isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

// =====================================================================
//  TeacherHomework - two views:
//    'list'        -> all homework (create / edit / delete)
//    'submissions' -> roster for one homework (view & grade)
//  (Homework is no longer scoped to an academic year.)
// =====================================================================

export default function TeacherHomework({ canManage = true }) {
  const { user } = useAuth();
  const [view, setView]       = useState('list');
  const [activeHw, setActiveHw] = useState(null);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2 sm:mb-0">
        <header className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="text-primary size-5" />
            Homework
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Create assignments, then review and grade student submissions.
          </p>
        </header>
      </div>

      {view === 'list' ? (
        <AssignmentList user={user} canManage={canManage}
          onOpenSubmissions={(hw) => { setActiveHw(hw); setView('submissions'); }} />
      ) : (
        <SubmissionList user={user} homework={activeHw} canManage={canManage}
          onBack={() => { setActiveHw(null); setView('list'); }} />
      )}
    </div>
  );
}


// =====================================================================
//  VIEW 1 - Assignment list + create/edit modal
// =====================================================================
function AssignmentList({ user, canManage, onOpenSubmissions }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');

  // List filters (client-side, over the already-loaded homework).
  // '' = All. Subject options narrow to the chosen class.
  const [classFilter, setClassFilter]     = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  // form data for the create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [classes, setClasses]     = useState([]);
  const [subjects, setSubjects]   = useState([]);
  const [subjectClasses, setSC]   = useState({});
  const [saving, setSaving]       = useState(false);

  const emptyForm = {
    title: '', description: '', homework_type: 'PDF',
    class_id: '', subject_id: '', due_date: ''
  };
  const [form, setForm]             = useState(emptyForm);
  const [questions, setQuestions]   = useState(['']);
  const [attachments, setAttachments] = useState([]);

  // --- Load homework list ----------------------------------------
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/homework/teacher/${user.id}`);
      const d = await res.json();
      setItems(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // --- Load classes + subjects for the modal ---------------------
  const loadFormData = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
      const d = await res.json();
      setClasses(d.classes || []);
      setSubjects(d.subjects || []);
      setSC(d.subjectClasses || {});
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => { loadFormData(); }, [loadFormData]);

  // Subjects available for the class chosen in the form.
  // A subject with no class links is treated as "all classes".
  const subjectsForClass = useMemo(() => {
    if (!form.class_id) return subjects;
    const cid = parseInt(form.class_id, 10);
    return subjects.filter(s => {
      const links = subjectClasses[s.id];
      if (!links || links.length === 0) return true;
      return links.includes(cid);
    });
  }, [subjects, subjectClasses, form.class_id]);

  // Subject options for the Subject filter — narrowed to the selected class
  // filter (a subject with no class links counts as "all classes"), matching
  // the create/edit modal's behaviour.
  const subjectFilterOptions = useMemo(() => {
    if (!classFilter) return subjects;
    const cid = parseInt(classFilter, 10);
    return subjects.filter(s => {
      const links = subjectClasses[s.id];
      if (!links || links.length === 0) return true;
      return links.includes(cid);
    });
  }, [subjects, subjectClasses, classFilter]);

  // Changing the class clears the subject filter only if that subject isn't
  // offered for the newly-chosen class.
  const onClassFilterChange = (v) => {
    setClassFilter(v);
    if (v && subjectFilter) {
      const cid = parseInt(v, 10);
      const links = subjectClasses[parseInt(subjectFilter, 10)];
      const stillValid = !links || links.length === 0 || links.includes(cid);
      if (!stillValid) setSubjectFilter('');
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (classFilter)   list = list.filter(it => String(it.class_id) === String(classFilter));
    if (subjectFilter) list = list.filter(it => String(it.subject_id) === String(subjectFilter));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(it =>
        (it.title || '').toLowerCase().includes(q) ||
        (it.class_group || '').toLowerCase().includes(q) ||
        (it.subject_name || '').toLowerCase().includes(q));
    }
    return list;
  }, [items, query, classFilter, subjectFilter]);

  const hasActiveFilter = Boolean(query.trim() || classFilter || subjectFilter);

  const classLabel = (c) => `${c.className}${c.section ? ' - ' + c.section : ''}`;

  // --- Modal open helpers ----------------------------------------
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setQuestions(['']);
    setAttachments([]);
    setModalOpen(true);
  };

  const openEdit = async (hw) => {
    setEditing(hw);
    setForm({
      title: hw.title || '',
      description: hw.description || '',
      homework_type: hw.homework_type || 'PDF',
      class_id: hw.class_id ? String(hw.class_id) : '',
      subject_id: hw.subject_id ? String(hw.subject_id) : '',
      due_date: isoDate(hw.due_date)
    });
    setQuestions(hw.questions && hw.questions.length ? hw.questions : ['']);
    // fetch full record for attachments
    try {
      const res = await fetch(`${API_BASE_URL}/admin/homework/${hw.id}`);
      const full = await res.json();
      setAttachments(full.attachments || []);
    } catch { setAttachments([]); }
    setModalOpen(true);
  };

  // --- Questions list editing ------------------------------------
  const addQuestion = () => setQuestions(q => [...q, '']);
  const updateQuestion = (i, v) => setQuestions(q => q.map((x, idx) => idx === i ? v : x));
  const removeQuestion = (i) => setQuestions(q => q.filter((_, idx) => idx !== i));

  // --- Attachment handling ---------------------------------------
  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      try {
        const obj = await fileToBase64(f, 5);
        setAttachments(prev => [...prev, obj]);
      } catch (err) { alert(err.message); }
    }
    e.target.value = '';
  };
  const removeAttachment = (i) => setAttachments(prev => prev.filter((_, idx) => idx !== i));

  // --- Save ------------------------------------------------------
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.class_id || !form.due_date) {
      return alert('Title, Class and Due Date are required.');
    }
    setSaving(true);
    try {
      const payload = {
        institutionId: user.institutionId,
        title: form.title.trim(),
        description: form.description,
        homework_type: form.homework_type,
        class_id: parseInt(form.class_id, 10),
        subject_id: form.subject_id ? parseInt(form.subject_id, 10) : null,
        due_date: form.due_date,
        questions: questions.filter(q => q.trim() !== ''),
        attachments,
        created_by: user.id
      };
      const url = editing
        ? `${API_BASE_URL}/admin/homework/${editing.id}`
        : `${API_BASE_URL}/admin/homework`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setModalOpen(false);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleDelete = async (hw) => {
    if (!window.confirm(`Delete "${hw.title}"? All its submissions will be removed.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/homework/${hw.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      load();
    } catch (e) { alert(e.message); }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-4 flex flex-col flex-1">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search homework..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
        </div>

        {/* Class + Subject filters */}
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-44">
            <select value={classFilter} onChange={e => onClassFilterChange(e.target.value)}
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={String(c.id)}>{classLabel(c)}</option>)}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative w-full sm:w-44">
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
              <option value="">All Subjects</option>
              {subjectFilterOptions.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {canManage && (
          <button onClick={openCreate}
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0 sm:ml-auto">
            <Plus className="size-3.5" /> Create Homework
          </button>
        )}
      </div>

      <div className="flex-1">
        {filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <ClipboardList className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">{hasActiveFilter ? 'No homework matches your filters.' : 'No homework yet.'}</p>
            {canManage && !hasActiveFilter && <p className="text-zinc-400 text-xs mt-1.5">Click "Create Homework" to begin.</p>}
          </div>
        ) : (
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-zinc-50/80">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Assignment</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Type</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Class / Subject</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Due</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Submissions</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(it => (
                  <tr key={it.id} className="hover:bg-zinc-50/60 transition-colors group">
                    <td className="px-5 py-4 font-semibold text-zinc-900 text-sm">{it.title}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                        it.homework_type === 'Written'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                          : 'bg-primary/10 text-primary ring-primary/20'
                      }`}>{it.homework_type}</span>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-zinc-600">
                      {it.class_group}{it.subject_name ? ` - ${it.subject_name}` : ''}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-zinc-500 whitespace-nowrap">{fmtDate(it.due_date)}</td>
                    <td className="px-5 py-4 font-semibold text-primary tabular-nums">{it.submission_count}</td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => onOpenSubmissions(it)}
                          className="h-8 px-3 bg-white border border-zinc-200 text-zinc-700 hover:text-primary hover:border-primary/30 hover:bg-primary/5 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors">
                          <Eye className="size-3.5" /> Submissions
                        </button>
                        {canManage && (
                          <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(it)}
                              className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5" title="Edit">
                              <Edit className="size-3.5" />
                            </button>
                            <button onClick={() => handleDelete(it)}
                              className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-red-600 rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5" title="Delete">
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
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-3xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">
                {editing ? 'Edit Homework' : 'Create Homework'}
              </h2>
              <button onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                <Field label="Title" required value={form.title}
                  onChange={v => setForm({ ...form, title: v })} placeholder="e.g. Chapter 5 Exercise" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <Field label="Type" type="select" value={form.homework_type}
                    onChange={v => setForm({ ...form, homework_type: v })}
                    options={[
                      { value: 'PDF', label: 'PDF / File Upload' },
                      { value: 'Written', label: 'Written / Text Answer' }
                    ]} />
                  <Field label="Due Date" type="date" required value={form.due_date}
                    onChange={v => setForm({ ...form, due_date: v })} />
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      Class <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select required value={form.class_id}
                        onChange={v => setForm({ ...form, class_id: v.target.value, subject_id: '' })}
                        className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                        <option value="" disabled>Select a class</option>
                        {classes.map(c => <option key={c.id} value={String(c.id)}>{classLabel(c)}</option>)}
                      </select>
                      <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      Subject
                    </label>
                    <div className="relative">
                      <select value={form.subject_id}
                        onChange={v => setForm({ ...form, subject_id: v.target.value })}
                        className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                        <option value="">{form.class_id ? 'Select a subject' : 'Select a class first'}</option>
                        {subjectsForClass.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                      </select>
                      <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <Field label="Description / Instructions" type="textarea" value={form.description}
                  onChange={v => setForm({ ...form, description: v })}
                  placeholder="General instructions..." />

                {/* Questions */}
                <div className="pt-2 border-t border-zinc-100">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Questions</label>
                  <div className="space-y-3 mt-3">
                    {questions.map((q, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="mt-2.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0 w-6">Q{i + 1}</span>
                        <textarea value={q} rows={2}
                          onChange={e => updateQuestion(i, e.target.value)}
                          placeholder="Enter question..."
                          className="flex-1 bg-white border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none shadow-sm transition-colors" />
                        {questions.length > 1 && (
                          <button type="button" onClick={() => removeQuestion(i)}
                            className="mt-1.5 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors ring-1 ring-black/5 shadow-sm bg-white">
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addQuestion}
                    className="mt-3 h-8 inline-flex items-center justify-center gap-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-3 rounded-md text-xs font-semibold transition-colors shadow-sm">
                    <Plus className="size-3" /> Add Question
                  </button>
                </div>

                {/* Attachments */}
                <div className="pt-2 border-t border-zinc-100">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Attachments</label>
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="cursor-pointer h-8 inline-flex items-center justify-center gap-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-3 rounded-md text-xs font-semibold transition-colors shadow-sm w-full sm:w-auto shrink-0">
                      <Paperclip className="size-3" /> Attach Files
                      <input type="file" multiple onChange={handleFiles} className="hidden" />
                    </label>
                    <span className="text-[11px] font-medium text-zinc-400">PDF / images - max 5 MB each</span>
                  </div>
                  {attachments.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {attachments.map((f, i) => (
                        <div key={i} className="bg-primary/5 text-primary ring-1 ring-primary/20 px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 max-w-[200px]">
                          <span className="truncate flex-1">{f.name}</span>
                          <button type="button" onClick={() => removeAttachment(i)} className="hover:text-red-500 shrink-0">
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
                <button type="button" onClick={() => setModalOpen(false)} disabled={saving}
                  className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">
                  {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
                  {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Homework')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


// =====================================================================
//  VIEW 2 - Submissions roster + grading modal
// =====================================================================
function SubmissionList({ user, homework, canManage, onBack }) {
  const [roster, setRoster]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('All');
  const [query, setQuery]     = useState('');

  const [grading, setGrading] = useState(null);   // roster row being graded
  const [gradeForm, setGradeForm] = useState({ grade: '', remarks: '' });
  const [saving, setSaving]   = useState(false);
  const [viewFile, setViewFile] = useState(null); // file shown in the in-screen viewer

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/homework/${homework.id}/submissions`);
      const d = await res.json();
      setRoster(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [homework]);

  useEffect(() => { load(); }, [load]);

  // Filter by tab + search, then order roll-number-wise (numeric).
  const filtered = useMemo(() => {
    let list = roster;
    if (tab === 'Submitted') list = list.filter(r => r.submission_id);
    else if (tab === 'Pending') list = list.filter(r => !r.submission_id);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(r =>
        (r.student_name || '').toLowerCase().includes(q) ||
        String(r.roll_no || '').toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const r = rollNum(a) - rollNum(b);
      if (r !== 0) return r;
      return (a.student_name || '').localeCompare(b.student_name || '');
    });
  }, [roster, tab, query]);

  const openGrade = (row) => {
    setGrading(row);
    setGradeForm({ grade: row.grade || '', remarks: row.remarks || '' });
  };

  const handleGrade = async (e) => {
    e.preventDefault();
    if (!grading?.submission_id) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/homework/grade/${grading.submission_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...gradeForm, graded_by: user.id })
      });
      if (!res.ok) throw new Error('Grading failed');
      setGrading(null);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="space-y-4 flex flex-col flex-1">
      <div className="flex items-center">
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="size-4" /> Back to homework
        </button>
      </div>

      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-4 sm:p-5">
        <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">{homework.title}</h3>
        <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mt-1.5">
          {homework.class_group}{homework.subject_name ? ` - ${homework.subject_name}` : ''} - {homework.homework_type}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
        <div className="flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar w-full sm:w-auto">
          {['All', 'Submitted', 'Pending'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                tab === t ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50/50'
              }`}>
              {t}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search student..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
        </div>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <p className="text-zinc-500 text-sm font-medium">No students match this view.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-zinc-50/80">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Roll / Student</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Status</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Grade</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(r => (
                  <tr key={r.student_id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-4 font-semibold text-zinc-900 text-sm whitespace-nowrap">
                      {r.roll_no ? <span className="text-zinc-400 font-medium mr-1.5">({r.roll_no})</span> : ''}
                      {r.student_name}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {r.submission_id ? (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-xs font-semibold text-emerald-700">Submitted</span>
                          </div>
                          <div className="text-[11px] text-zinc-500 font-medium mt-0.5 ml-3.5">{fmtDate(r.submitted_at)}</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-zinc-300 shrink-0" />
                          <span className="text-xs text-zinc-500 italic font-medium">Not submitted</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {r.grade ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-sm bg-emerald-50 px-2 py-0.5 rounded ring-1 ring-inset ring-emerald-600/20">
                          <Star className="size-3.5 fill-amber-400 text-amber-400" /> {r.grade}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-zinc-400">Not graded</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {r.submission_id && canManage && (
                        <button onClick={() => openGrade(r)}
                          className="h-8 px-3 bg-white border border-zinc-200 text-zinc-700 hover:text-primary hover:border-primary/30 hover:bg-primary/5 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors">
                          <Star className="size-3.5" /> {r.grade ? 'Update Grade' : 'Grade'}
                        </button>
                      )}
                      {r.submission_id && !canManage && (
                        <button onClick={() => openGrade(r)}
                          className="h-8 px-3 bg-white border border-zinc-200 text-zinc-700 hover:text-primary hover:border-primary/30 hover:bg-primary/5 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors">
                          <Eye className="size-3.5" /> View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- GRADING MODAL ---- */}
      {grading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-2xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 leading-tight">Submission</h2>
                <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mt-1">
                  {grading.roll_no ? `(${grading.roll_no}) ` : ''}{grading.student_name}
                </p>
              </div>
              <button onClick={() => setGrading(null)} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleGrade} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                {/* Questions context */}
                {homework.questions && homework.questions.length > 0 && (
                  <div className="bg-primary/5 border border-primary/10 rounded-md p-4">
                    <div className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2.5">Questions</div>
                    <ol className="list-decimal list-inside space-y-1.5">
                      {homework.questions.map((q, i) => (
                        <li key={i} className="text-sm text-zinc-700 font-medium leading-relaxed">{q}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Submitted content */}
                <div>
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Submitted Answer</div>
                  
                  {grading.written_answer && (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-md p-4 mb-4 max-h-56 overflow-y-auto custom-scrollbar shadow-sm">
                      <pre className="whitespace-pre-wrap text-sm text-zinc-800 font-sans leading-relaxed">{grading.written_answer}</pre>
                    </div>
                  )}
                  
                  {(grading.files || []).length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {grading.files.map((f, i) => (
                        <button type="button" key={i} onClick={() => setViewFile(f)}
                          className="flex items-start gap-3 bg-white hover:bg-zinc-50 border border-zinc-200 p-3 rounded-md transition-colors text-left shadow-sm ring-1 ring-black/5 group">
                          <FileText className="size-5 text-primary shrink-0 mt-0.5" />
                          <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-semibold text-zinc-800 truncate group-hover:text-primary transition-colors">{f.name}</p>
                            <p className="text-[11px] text-zinc-500 font-medium flex items-center gap-1 mt-0.5 uppercase tracking-wider"><Eye className="size-3" /> View file</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {!grading.written_answer && (grading.files || []).length === 0 && (
                    <p className="text-sm text-zinc-400 font-medium italic bg-zinc-50 border border-dashed border-zinc-200 p-4 rounded-md text-center">No submission content.</p>
                  )}
                </div>

                {/* Grade form */}
                {canManage && (
                  <div className="border-t border-zinc-100 pt-5 space-y-4">
                    <Field label="Grade" value={gradeForm.grade}
                      onChange={v => setGradeForm({ ...gradeForm, grade: v })}
                      placeholder="e.g. A+, 95/100" />
                    <Field label="Remarks / Feedback" type="textarea" value={gradeForm.remarks}
                      onChange={v => setGradeForm({ ...gradeForm, remarks: v })}
                      placeholder="Feedback for the student..." />
                  </div>
                )}
              </div>

              {canManage && (
                <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
                  <button type="button" onClick={() => setGrading(null)} disabled={saving}
                    className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="h-9 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">
                    {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
                    {saving ? 'Saving...' : 'Submit Grade'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* In-screen file viewer */}
      <FileViewer file={viewFile} onClose={() => setViewFile(null)} />
    </div>
  );
}


// --- Shared field input --------------------------------------------
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
            className={`${base} cursor-pointer appearance-none pr-8`}>
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