import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Search, Loader2, FlaskConical,
  Video, LinkIcon, Radio, ChevronDown, Save
} from 'lucide-react';

// =====================================================================
//  TeacherLabs - create / edit / delete digital labs.
//  Each lab targets one class and bundles many resources:
//    video  -> a video URL (YouTube etc.)
//    link   -> a generic web link / document
//    live   -> a live-class link (Zoom / Meet) with optional schedule
// =====================================================================

const RES_TYPES = [
  { value: 'video', label: 'Video',       icon: Video },
  { value: 'link',  label: 'Link',        icon: LinkIcon },
  { value: 'live',  label: 'Live Class',  icon: Radio }
];

const resTypeMeta = (t) => RES_TYPES.find(r => r.value === t) || RES_TYPES[1];

const isoLocal = (dt) => {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '';
  // for <input type="datetime-local">
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function TeacherLabs({ canManage = true }) {
  const { user } = useAuth();

  const [labs, setLabs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');

  // class + subject options for the modal
  const [classes, setClasses]       = useState([]);
  const [subjects, setSubjects]     = useState([]);
  const [subjectClasses, setSC]     = useState({});

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);

  const emptyForm = { title: '', description: '', class_id: '', subject_id: '' };
  const [form, setForm]         = useState(emptyForm);
  const [resources, setResources] = useState([]);

  // --- Load labs -------------------------------------------------
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/labs/teacher/${user.id}`);
      const d = await res.json();
      setLabs(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // --- Load classes + subjects -----------------------------------
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

  // Subjects available for the chosen class (subject with no link = all)
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
    if (!query.trim()) return labs;
    const q = query.toLowerCase();
    return labs.filter(l =>
      (l.title || '').toLowerCase().includes(q) ||
      (l.class_group || '').toLowerCase().includes(q) ||
      (l.subject_name || '').toLowerCase().includes(q));
  }, [labs, query]);

  const classLabel = (c) => `${c.className}${c.section ? ' - ' + c.section : ''}`;

  // --- Modal helpers ---------------------------------------------
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setResources([]);
    setModalOpen(true);
  };

  const openEdit = async (lab) => {
    setEditing(lab);
    setForm({
      title: lab.title || '',
      description: lab.description || '',
      class_id: lab.class_id ? String(lab.class_id) : '',
      subject_id: lab.subject_id ? String(lab.subject_id) : ''
    });
    try {
      const res = await fetch(`${API_BASE_URL}/admin/labs/${lab.id}`);
      const full = await res.json();
      setResources((full.resources || []).map(r => ({
        resource_type: r.resource_type,
        title: r.title,
        url: r.url,
        scheduled_at: isoLocal(r.scheduled_at)
      })));
    } catch { setResources([]); }
    setModalOpen(true);
  };

  // --- Resource list editing -------------------------------------
  const addResource = (type) =>
    setResources(p => [...p, { resource_type: type, title: '', url: '', scheduled_at: '' }]);
  const updateResource = (i, key, val) =>
    setResources(p => p.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  const removeResource = (i) =>
    setResources(p => p.filter((_, idx) => idx !== i));

  // --- Save ------------------------------------------------------
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.class_id) {
      return alert('Title and Class are required.');
    }
    for (const r of resources) {
      if (!r.title.trim() || !r.url.trim()) {
        return alert('Every resource needs both a title and a URL.');
      }
    }
    setSaving(true);
    try {
      const payload = {
        institutionId: user.institutionId,
        title: form.title.trim(),
        description: form.description,
        class_id: parseInt(form.class_id, 10),
        subject_id: form.subject_id ? parseInt(form.subject_id, 10) : null,
        created_by: user.id,
        resources: resources.map(r => ({
          resource_type: r.resource_type,
          title: r.title.trim(),
          url: r.url.trim(),
          scheduled_at: r.resource_type === 'live' && r.scheduled_at
            ? r.scheduled_at.replace('T', ' ') + ':00'
            : null
        }))
      };
      const url = editing
        ? `${API_BASE_URL}/admin/labs/${editing.id}`
        : `${API_BASE_URL}/admin/labs`;
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

  const handleDelete = async (lab) => {
    if (!window.confirm(`Delete lab "${lab.title}"? All its resources will be removed.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/labs/${lab.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      
      <header className="flex flex-col mb-2 sm:mb-0">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
          <FlaskConical className="text-primary size-5" />
          Digital Labs
        </h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
          Post videos, links and live classes for your students.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search labs..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
        </div>
        
        {canManage && (
          <button onClick={openCreate}
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0">
            <Plus className="size-3.5" /> Create Lab
          </button>
        )}
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin size-8 text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <FlaskConical className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">No digital labs yet.</p>
            {canManage && <p className="text-zinc-400 text-xs mt-1.5">Click "Create Lab" to begin.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map(lab => (
              <div key={lab.id} className="group bg-white rounded-lg ring-1 ring-black/5 shadow-sm flex flex-col hover:ring-primary/30 hover:shadow-md transition-all overflow-hidden p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="size-10 bg-primary/10 rounded-md flex items-center justify-center text-primary shrink-0 ring-1 ring-primary/20">
                    <FlaskConical className="size-5" />
                  </div>
                  {canManage && (
                    <div className="flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(lab)}
                        className="size-7 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md shadow-sm ring-1 ring-black/5 flex items-center justify-center transition-colors">
                        <Edit className="size-3.5" />
                      </button>
                      <button onClick={() => handleDelete(lab)}
                        className="size-7 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-red-600 rounded-md shadow-sm ring-1 ring-black/5 flex items-center justify-center transition-colors">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-zinc-900 text-base leading-tight line-clamp-1">{lab.title}</h3>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-1.5 line-clamp-1">
                  {lab.class_group}{lab.subject_name ? ` - ${lab.subject_name}` : ''}
                </p>
                {lab.description && (
                  <p className="text-xs text-zinc-500 mt-3 line-clamp-2 leading-relaxed">{lab.description}</p>
                )}
                <div className="mt-auto pt-4 flex items-center">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-1 rounded">
                    {lab.resource_count} resource{lab.resource_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- CREATE / EDIT MODAL ---- */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-2xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">
                {editing ? 'Edit Lab' : 'Create Digital Lab'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                <Field label="Lab Title" required value={form.title}
                  onChange={v => setForm({ ...form, title: v })}
                  placeholder="e.g. Optics - Reflection & Refraction" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      Class <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value, subject_id: '' })}
                        className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors" required>
                        <option value="" disabled>Select a class</option>
                        {classes.map(c => (
                          <option key={c.id} value={String(c.id)}>{classLabel(c)}</option>
                        ))}
                      </select>
                      <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Subject</label>
                    <div className="relative">
                      <select value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })}
                        className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                        <option value="">{form.class_id ? 'Select a subject' : 'Select a class first'}</option>
                        {subjectsForClass.map(s => (
                          <option key={s.id} value={String(s.id)}>{s.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <Field label="Description" type="textarea" value={form.description}
                  onChange={v => setForm({ ...form, description: v })}
                  placeholder="What this lab covers..." />

                {/* Resources */}
                <div className="pt-4 border-t border-zinc-100">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-xs font-semibold text-zinc-800 tracking-tight">
                      Resources
                    </label>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{resources.length} added</span>
                  </div>

                  <div className="space-y-3 mb-4">
                    {resources.map((r, i) => {
                      const meta = resTypeMeta(r.resource_type);
                      const Icon = meta.icon;
                      return (
                        <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-md p-4 relative group">
                          
                          <button type="button" onClick={() => removeResource(i)}
                            className="absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-white rounded-md transition-colors shadow-sm ring-1 ring-black/5 sm:opacity-0 sm:group-hover:opacity-100">
                            <Trash2 className="size-3.5" />
                          </button>
                          
                          <div className="flex items-center gap-2.5 mb-3.5 pr-8">
                            <div className="size-6 bg-white rounded-md flex items-center justify-center text-primary ring-1 ring-black/5 shadow-sm">
                              <Icon className="size-3.5" />
                            </div>
                            <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
                              {meta.label}
                            </span>
                          </div>
                          
                          <div className="space-y-3">
                            <input value={r.title} required
                              onChange={e => updateResource(i, 'title', e.target.value)}
                              placeholder="Resource title"
                              className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                            
                            <input value={r.url} required
                              onChange={e => updateResource(i, 'url', e.target.value)}
                              placeholder={r.resource_type === 'video'
                                ? 'Video URL (YouTube etc.)'
                                : r.resource_type === 'live'
                                  ? 'Live class link (Zoom / Meet)'
                                  : 'Web link / document URL'}
                              className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                            
                            {r.resource_type === 'live' && (
                              <div className="pt-1">
                                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">
                                  Scheduled time (optional)
                                </label>
                                <input type="datetime-local" value={r.scheduled_at}
                                  onChange={e => updateResource(i, 'scheduled_at', e.target.value)}
                                  className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add-resource buttons */}
                  <div className="flex flex-wrap gap-2">
                    {RES_TYPES.map(rt => {
                      const Icon = rt.icon;
                      return (
                        <button key={rt.value} type="button" onClick={() => addResource(rt.value)}
                          className="h-8 inline-flex items-center justify-center gap-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-3 rounded-md text-xs font-semibold transition-colors shadow-sm">
                          <Plus className="size-3" /> <Icon className="size-3" /> {rt.label}
                        </button>
                      );
                    })}
                  </div>
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
                  {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Lab')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------

function Field({ label, value, onChange, type = 'text', required, placeholder }) {
  const base = "h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm";
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3}
          placeholder={placeholder} className={`${base} h-auto py-2.5 resize-none`} required={required} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={base} required={required} />
      )}
    </div>
  );
}