import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Eye, Search, Loader2, ArrowLeft,
  Paperclip, FileText, Star, ClipboardList, BookOpen
} from 'lucide-react';
import { fmtDate, isoDate, fileToBase64, openFile } from './HwUtils';

// =====================================================================
//  TeacherHomework — two views:
//    'list'        → all homework (create / edit / delete)
//    'submissions' → roster for one homework (view & grade)
// =====================================================================

export default function TeacherHomework({ canManage = true }) {
  const { user } = useAuth();
  const [view, setView]       = useState('list');
  const [activeHw, setActiveHw] = useState(null);

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ClipboardList className="text-blue-600" size={28} />
          Homework
        </h2>
        <p className="text-slate-500 font-medium mt-1">
          Create assignments, then review and grade student submissions.
        </p>
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
//  VIEW 1 — Assignment list + create/edit modal
// =====================================================================
function AssignmentList({ user, canManage, onOpenSubmissions }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');

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

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(it =>
      (it.title || '').toLowerCase().includes(q) ||
      (it.class_group || '').toLowerCase().includes(q) ||
      (it.subject_name || '').toLowerCase().includes(q));
  }, [items, query]);

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
  const handleSave = async () => {
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
    return <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search homework…"
            className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 w-full sm:w-72" />
        </div>
        {canManage && (
          <button onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
            <Plus size={18} /> Create Homework
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No homework yet.</p>
          {canManage && <p className="text-slate-400 text-sm mt-1">Click "Create Homework" to begin.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-5">Assignment</th>
                <th className="p-5">Type</th>
                <th className="p-5">Class / Subject</th>
                <th className="p-5">Due</th>
                <th className="p-5">Submissions</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(it => (
                <tr key={it.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-700">{it.title}</td>
                  <td className="p-5">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                      it.homework_type === 'Written'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}>{it.homework_type}</span>
                  </td>
                  <td className="p-5 text-sm font-medium text-slate-500">
                    {it.class_group}{it.subject_name ? ` · ${it.subject_name}` : ''}
                  </td>
                  <td className="p-5 text-sm font-medium text-slate-500">{fmtDate(it.due_date)}</td>
                  <td className="p-5 font-black text-blue-600">{it.submission_count}</td>
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => onOpenSubmissions(it)}
                        className="inline-flex items-center gap-1.5 border border-blue-200 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                        <Eye size={14} /> Submissions
                      </button>
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(it)}
                            className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => handleDelete(it)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- CREATE / EDIT MODAL ---- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setModalOpen(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-6 text-slate-800">
              {editing ? 'Edit Homework' : 'Create Homework'}
            </h2>

            <div className="space-y-5">
              <Field label="Title" required value={form.title}
                onChange={v => setForm({ ...form, title: v })} placeholder="e.g. Chapter 5 Exercise" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Type" type="select" value={form.homework_type}
                  onChange={v => setForm({ ...form, homework_type: v })}
                  options={[
                    { value: 'PDF', label: 'PDF / File Upload' },
                    { value: 'Written', label: 'Written / Text Answer' }
                  ]} />
                <Field label="Due Date" type="date" required value={form.due_date}
                  onChange={v => setForm({ ...form, due_date: v })} />
                <Field label="Class" type="select" required value={form.class_id}
                  onChange={v => setForm({ ...form, class_id: v, subject_id: '' })}
                  options={[
                    { value: '', label: 'Select a class' },
                    ...classes.map(c => ({ value: String(c.id), label: classLabel(c) }))
                  ]} />
                <Field label="Subject" type="select" value={form.subject_id}
                  onChange={v => setForm({ ...form, subject_id: v })}
                  options={[
                    { value: '', label: form.class_id ? 'Select a subject' : 'Select a class first' },
                    ...subjectsForClass.map(s => ({ value: String(s.id), label: s.name }))
                  ]} />
              </div>

              <Field label="Description / Instructions" type="textarea" value={form.description}
                onChange={v => setForm({ ...form, description: v })}
                placeholder="General instructions…" />

              {/* Questions */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Questions</label>
                <div className="space-y-2 mt-2">
                  {questions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-2.5 text-xs font-black text-slate-400 w-7">Q{i + 1}</span>
                      <textarea value={q} rows={2}
                        onChange={e => updateQuestion(i, e.target.value)}
                        placeholder="Enter question…"
                        className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 resize-none" />
                      {questions.length > 1 && (
                        <button onClick={() => removeQuestion(i)}
                          className="mt-1.5 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addQuestion}
                  className="mt-2 inline-flex items-center gap-1.5 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <Plus size={13} /> Add Question
                </button>
              </div>

              {/* Attachments */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Attachments</label>
                <div className="mt-2 flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition-all">
                    <Paperclip size={14} /> Attach Files
                    <input type="file" multiple onChange={handleFiles} className="hidden" />
                  </label>
                  <span className="text-[11px] text-slate-400">PDF / images · max 5 MB each</span>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attachments.map((f, i) => (
                      <div key={i} className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                        <span className="max-w-[160px] truncate">{f.name}</span>
                        <button onClick={() => removeAttachment(i)} className="hover:text-red-500">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={handleSave} disabled={saving}
                className="w-full bg-slate-900 hover:bg-blue-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Homework')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// =====================================================================
//  VIEW 2 — Submissions roster + grading modal
// =====================================================================
function SubmissionList({ user, homework, canManage, onBack }) {
  const [roster, setRoster]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('All');
  const [query, setQuery]     = useState('');

  const [grading, setGrading] = useState(null);   // roster row being graded
  const [gradeForm, setGradeForm] = useState({ grade: '', remarks: '' });
  const [saving, setSaving]   = useState(false);

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
    return list;
  }, [roster, tab, query]);

  const openGrade = (row) => {
    setGrading(row);
    setGradeForm({ grade: row.grade || '', remarks: row.remarks || '' });
  };

  const handleGrade = async () => {
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
    <div className="space-y-5">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
        <ArrowLeft size={14} /> Back to homework
      </button>

      <div>
        <h3 className="text-xl font-black text-slate-800">{homework.title}</h3>
        <p className="text-xs text-slate-400 font-medium">
          {homework.class_group}{homework.subject_name ? ` · ${homework.subject_name}` : ''} · {homework.homework_type}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {['All', 'Submitted', 'Pending'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search student…"
            className="bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 w-full sm:w-56" />
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-14 rounded-3xl border border-dashed border-slate-200 text-center">
          <p className="text-slate-400 font-medium italic">No students match this view.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-5">Student</th>
                <th className="p-5">Status</th>
                <th className="p-5">Grade</th>
                <th className="p-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(r => (
                <tr key={r.student_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 font-bold text-slate-700">
                    {r.roll_no ? <span className="text-slate-400 font-medium">({r.roll_no}) </span> : ''}
                    {r.student_name}
                  </td>
                  <td className="p-5">
                    {r.submission_id ? (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <div>
                          <div className="text-xs font-bold text-emerald-600">Submitted</div>
                          <div className="text-[11px] text-slate-400">{fmtDate(r.submitted_at)}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                        <span className="text-xs text-slate-400 italic">Not submitted</span>
                      </div>
                    )}
                  </td>
                  <td className="p-5">
                    {r.grade ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-sm">
                        <Star size={14} className="fill-amber-400 text-amber-400" /> {r.grade}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Not graded</span>
                    )}
                  </td>
                  <td className="p-5 text-right">
                    {r.submission_id && canManage && (
                      <button onClick={() => openGrade(r)}
                        className="inline-flex items-center gap-1.5 text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-xs font-bold">
                        <Star size={13} /> {r.grade ? 'Update Grade' : 'Grade'}
                      </button>
                    )}
                    {r.submission_id && !canManage && (
                      <button onClick={() => openGrade(r)}
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold">
                        <Eye size={13} /> View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- GRADING MODAL ---- */}
      {grading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setGrading(null)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-1 text-slate-800">Submission</h2>
            <p className="text-sm text-slate-400 font-medium mb-6">
              {grading.roll_no ? `(${grading.roll_no}) ` : ''}{grading.student_name}
            </p>

            {/* Questions context */}
            {homework.questions && homework.questions.length > 0 && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 mb-5">
                <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Questions</div>
                <ol className="list-decimal list-inside space-y-1">
                  {homework.questions.map((q, i) => (
                    <li key={i} className="text-sm text-slate-700">{q}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Submitted content */}
            <div className="mb-5">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Submitted Answer</div>
              {grading.written_answer && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-3 max-h-56 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans">{grading.written_answer}</pre>
                </div>
              )}
              {(grading.files || []).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {grading.files.map((f, i) => (
                    <button key={i} onClick={() => openFile(f)}
                      className="flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 p-3 rounded-xl transition-all text-left">
                      <FileText size={20} className="text-blue-500 shrink-0" />
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold text-slate-700 truncate">{f.name}</p>
                        <p className="text-xs text-blue-600 flex items-center gap-1"><Eye size={10} /> View file</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {!grading.written_answer && (grading.files || []).length === 0 && (
                <p className="text-sm text-slate-400 italic">No submission content.</p>
              )}
            </div>

            {/* Grade form */}
            {canManage && (
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <Field label="Grade" value={gradeForm.grade}
                  onChange={v => setGradeForm({ ...gradeForm, grade: v })}
                  placeholder="e.g. A+, 95/100" />
                <Field label="Remarks / Feedback" type="textarea" value={gradeForm.remarks}
                  onChange={v => setGradeForm({ ...gradeForm, remarks: v })}
                  placeholder="Feedback for the student…" />
                <button onClick={handleGrade} disabled={saving}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-3.5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? 'Saving…' : 'Submit Grade'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// --- Shared field input --------------------------------------------
function Field({ label, value, onChange, type = 'text', options, required, placeholder }) {
  const base = "w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/10 text-sm";
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {type === 'select' ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)}
          className={base + ' cursor-pointer'}>
          {(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3}
          placeholder={placeholder} className={base + ' resize-none'} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={base} />
      )}
    </div>
  );
}