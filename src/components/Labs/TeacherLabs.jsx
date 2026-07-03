import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Search, Loader2, FlaskConical,
  Video, LinkIcon, Radio, ChevronDown, Save, FileText, 
  UploadCloud, ExternalLink, ArrowLeft, BookOpen, User, Clock, PencilLine
} from 'lucide-react';

// =====================================================================
//  Constants & Helpers
// =====================================================================

const RES_TYPES = [
  { value: 'video', label: 'Video', icon: Video, color: 'text-zinc-600', bg: 'bg-zinc-100' },
  { value: 'pdf',   label: 'PDF Document', icon: FileText, color: 'text-zinc-600', bg: 'bg-zinc-100' },
  { value: 'link',  label: 'Web Link', icon: LinkIcon, color: 'text-zinc-600', bg: 'bg-zinc-100' },
  { value: 'live',  label: 'Live Class', icon: Radio, color: 'text-zinc-600', bg: 'bg-zinc-100' }
];

const resTypeMeta = (t) => RES_TYPES.find(r => r.value === t) || RES_TYPES[2];

const fmtDateTime = (dt) => {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// Render a UTC audit timestamp (Railway stores UTC) as IST for display.
const fmtIST = (val) => {
  if (!val) return '';
  let d;
  if (typeof val === 'string' && !val.includes('T') && !val.endsWith('Z')) {
    d = new Date(val.replace(' ', 'T') + 'Z');
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

// Show the "updated" line only when it's meaningfully after creation.
const wasUpdated = (lab) =>
  lab.updated_at && lab.updated_by_name &&
  (!lab.created_at || new Date(lab.updated_at) - new Date(lab.created_at) > 1000);

const isoLocal = (dt) => {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// =====================================================================
//  MAIN COMPONENT
// =====================================================================

export default function TeacherLabs({ canManage = true }) {
  const { user } = useAuth();

  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // List filters (client-side, over the already-loaded labs). '' = All.
  const [classFilter, setClassFilter]     = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  // Data for Selects
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectClasses, setSC] = useState({});

  // Navigation / Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingLab, setViewingLab] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState({ title: '', description: '', class_id: '', subject_id: '' });
  const [resources, setResources] = useState([]);

  // --- API Actions ---

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/labs/teacher/${user.id}`);
      const d = await res.json();
      setLabs(Array.isArray(d) ? d : []);
    } catch (e) { console.error('Load Labs Error:', e); }
    setLoading(false);
  }, [user]);

  const loadFormData = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
      const d = await res.json();
      setClasses(d.classes || []);
      setSubjects(d.subjects || []);
      setSC(d.subjectClasses || {});
    } catch (e) { console.error('Load Form Data Error:', e); }
  }, [user]);

  useEffect(() => { load(); loadFormData(); }, [load, loadFormData]);

  // --- Filter Logic ---

  const subjectsForClass = useMemo(() => {
    if (!form.class_id) return subjects;
    const cid = parseInt(form.class_id, 10);
    return subjects.filter(s => {
      const links = subjectClasses[s.id];
      return !links || links.length === 0 || links.includes(cid);
    });
  }, [subjects, subjectClasses, form.class_id]);

  // Subject options for the Subject filter — narrowed to the selected class
  // filter (a subject with no class links counts as "all classes"), matching
  // the create/edit form's behaviour.
  const subjectFilterOptions = useMemo(() => {
    if (!classFilter) return subjects;
    const cid = parseInt(classFilter, 10);
    return subjects.filter(s => {
      const links = subjectClasses[s.id];
      return !links || links.length === 0 || links.includes(cid);
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
    let list = labs;
    if (classFilter)   list = list.filter(l => String(l.class_id) === String(classFilter));
    if (subjectFilter) list = list.filter(l => String(l.subject_id) === String(subjectFilter));
    const q = query.toLowerCase().trim();
    if (q) {
      list = list.filter(l =>
        (l.title || '').toLowerCase().includes(q) ||
        (l.class_group || '').toLowerCase().includes(q) ||
        (l.subject_name || '').toLowerCase().includes(q) ||
        (l.created_by_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [labs, query, classFilter, subjectFilter]);

  const hasActiveFilter = Boolean(query.trim() || classFilter || subjectFilter);

  const classLabel = (c) => `${c.className}${c.section ? ' - ' + c.section : ''}`;

  // --- Modal / Resource Helpers ---

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', class_id: '', subject_id: '' });
    setResources([]);
    setModalOpen(true);
  };

  const openEdit = async (lab, e) => {
    if (e) e.stopPropagation();
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
        ...r,
        source: r.has_file ? 'file' : 'url',
        scheduled_at: r.scheduled_at ? isoLocal(r.scheduled_at) : ''
      })));
    } catch { setResources([]); }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.class_id) return alert('Title and Class are required.');
    
    setSaving(true);

    // Create standard FormData payload
    const fd = new FormData();
    fd.append('institutionId', user.institutionId);
    fd.append('title', form.title.trim());
    fd.append('description', form.description);
    fd.append('class_id', form.class_id);
    fd.append('subject_id', form.subject_id);
    fd.append('created_by', user.id);
    if (editing) fd.append('id', editing.id);

    // Append actual File objects directly to the payload
    const resMetadata = resources.map((r, i) => {
      if (r.file) {
        fd.append(`file_${i}`, r.file);
      }
      
      return {
        id: r.id,
        resource_type: r.resource_type,
        title: r.title.trim(),
        url: r.url,
        source: r.source,
        has_file: Boolean(r.file || r.has_file),
        scheduled_at: r.resource_type === 'live' && r.scheduled_at ? r.scheduled_at.replace('T', ' ') + ':00' : null
      };
    });

    fd.append('resources', JSON.stringify(resMetadata));

    try {
      // Do NOT set Content-Type header. The browser does this automatically for FormData.
      const res = await fetch(`${API_BASE_URL}/admin/labs`, { 
        method: 'POST', 
        body: fd 
      });

      if (res.ok) { 
        setModalOpen(false); 
        load(); 
      } else { 
        const d = await res.json(); 
        throw new Error(d.error || 'Save failed'); 
      }
    } catch (e) { 
      alert(e.message); 
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lab, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete lab "${lab.title}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/labs/${lab.id}`, { method: 'DELETE' });
      if (!res.ok) {
        // Surface the real server reason instead of a silent failure.
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Delete failed (HTTP ${res.status})`);
      }
      // If we were viewing this lab in the detail screen, go back to the list.
      if (viewingLab && viewingLab.id === lab.id) setViewingLab(null);
      load();
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  };

  // --- Sub-View Navigation ---

  if (viewingLab) {
    return <LabDetailView lab={viewingLab} onBack={() => { setViewingLab(null); load(); }} canManage={canManage} onEdit={(l) => openEdit(l)} onDelete={(l) => handleDelete(l)} />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <FlaskConical className="text-primary size-5" />
            Digital Labs
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch] font-medium">
            Post videos, links and live classes for your students.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {/* Class + Subject filters */}
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-40">
              <select value={classFilter} onChange={e => onClassFilterChange(e.target.value)}
                className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={String(c.id)}>{classLabel(c)}</option>)}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative w-full sm:w-40">
              <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
                className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                <option value="">All Subjects</option>
                {subjectFilterOptions.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

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
      </header>

      <div className="flex-1">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin size-8 text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <FlaskConical className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">{hasActiveFilter ? 'No labs match your filters.' : 'No digital labs yet.'}</p>
            {canManage && !hasActiveFilter && <p className="text-zinc-400 text-xs mt-1.5">Click "Create Lab" to begin.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map(lab => (
              <div 
                key={lab.id} 
                onClick={() => setViewingLab(lab)}
                className="group bg-white rounded-lg ring-1 ring-black/5 shadow-sm flex flex-col hover:ring-primary/30 hover:shadow-md transition-all cursor-pointer overflow-hidden p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="size-10 bg-primary/10 rounded-md flex items-center justify-center text-primary shrink-0 ring-1 ring-inset ring-primary/20">
                    <FlaskConical className="size-5" />
                  </div>
                  {canManage && (
                    <div className="flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => openEdit(lab, e)}
                        className="size-7 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md shadow-sm ring-1 ring-inset ring-black/5 flex items-center justify-center transition-colors">
                        <Edit className="size-3.5" />
                      </button>
                      <button onClick={(e) => handleDelete(lab, e)}
                        className="size-7 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-red-600 rounded-md shadow-sm ring-1 ring-inset ring-black/5 flex items-center justify-center transition-colors">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                
                <h3 className="font-semibold text-zinc-900 text-base leading-tight line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors">
                  {lab.title}
                </h3>
                
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mt-1.5 line-clamp-1">
                  {lab.class_group} {lab.subject_name ? `• ${lab.subject_name}` : ''}
                </p>

                {/* Created / Updated audit line */}
                <div className="mt-2 space-y-0.5">
                  {lab.created_by_name && (
                    <div className="text-[10px] text-zinc-400 flex items-center gap-1 line-clamp-1">
                      <User className="size-3 shrink-0" /> {lab.created_by_name}
                      {lab.created_at && (
                        <><span className="text-zinc-300">·</span> {fmtIST(lab.created_at)}</>
                      )}
                    </div>
                  )}
                  {wasUpdated(lab) && (
                    <div className="text-[10px] text-zinc-400 flex items-center gap-1 line-clamp-1">
                      <PencilLine className="size-3 shrink-0" /> {lab.updated_by_name}
                      <span className="text-zinc-300">·</span> {fmtIST(lab.updated_at)}
                    </div>
                  )}
                </div>

                {lab.description && (
                  <p className="text-xs text-zinc-500 mt-3 line-clamp-3 leading-relaxed font-medium">
                    {lab.description}
                  </p>
                )}

                <div className="mt-auto pt-4 flex flex-col gap-3">
                   <div className="flex flex-wrap gap-1.5">
                      {lab.resource_count > 0 ? (
                        <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded uppercase tracking-wider ring-1 ring-inset ring-black/5">
                          {lab.resource_count} Resource{lab.resource_count !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium italic text-zinc-400">Empty Lab</span>
                      )}
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- CREATE / EDIT MODAL ---- */}
      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-2xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">
                {editing ? 'Edit Lab' : 'Create Digital Lab'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                <div className="space-y-1.5">
                   <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Lab Title <span className="text-red-500">*</span></label>
                   <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Optics - Reflection & Refraction" className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Class <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value, subject_id: '' })}
                        className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm cursor-pointer transition-colors" required>
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
                        className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm cursor-pointer transition-colors">
                        <option value="">{form.class_id ? 'Select a subject' : 'Select a class first'}</option>
                        {subjectsForClass.map(s => (
                          <option key={s.id} value={String(s.id)}>{s.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Description</label>
                   <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="What this lab covers..." className="w-full bg-white border border-zinc-200 rounded-md p-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm resize-none transition-colors" />
                </div>

                {/* Resources */}
                <div className="pt-4 border-t border-zinc-100">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Resources</label>
                    <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded uppercase tracking-wider ring-1 ring-inset ring-primary/20">{resources.length} Added</span>
                  </div>

                  <div className="space-y-4 mb-6">
                    {resources.map((r, i) => {
                      const meta = resTypeMeta(r.resource_type);
                      const Icon = meta.icon;
                      return (
                        <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 relative group">
                          <button type="button" onClick={() => setResources(p => p.filter((_, idx) => idx !== i))}
                            className="absolute top-3 right-3 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-white rounded-md transition-colors shadow-sm ring-1 ring-inset ring-black/5">
                            <Trash2 className="size-3.5" />
                          </button>
                          
                          <div className="flex items-center gap-2 mb-4">
                            <Icon className="size-4 text-zinc-600" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">{meta.label}</span>
                          </div>
                          
                          <div className="space-y-3">
                            <input value={r.title} required
                              onChange={e => setResources(p => p.map((rs, idx) => idx === i ? { ...rs, title: e.target.value } : rs))}
                              placeholder="Resource Title (e.g. Intro Video)"
                              className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
                            
                            {/* Toggle Upload or Link for Video/PDF */}
                            {(r.resource_type === 'video' || r.resource_type === 'pdf') && (
                               <div className="flex bg-zinc-200/50 p-1 rounded-md w-full sm:w-fit">
                                  <button type="button" 
                                    onClick={() => setResources(p => p.map((rs, idx) => idx === i ? { ...rs, source: 'file', url: '' } : rs))}
                                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all ${r.source === 'file' ? 'bg-white shadow-sm text-zinc-900 ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'}`}>
                                    <UploadCloud className="size-3 mr-1.5 inline" /> Upload
                                  </button>
                                  <button type="button" 
                                    onClick={() => setResources(p => p.map((rs, idx) => idx === i ? { ...rs, source: 'url', file: null } : rs))}
                                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all ${r.source === 'url' ? 'bg-white shadow-sm text-zinc-900 ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'}`}>
                                    <ExternalLink className="size-3 mr-1.5 inline" /> URL
                                  </button>
                               </div>
                            )}

                            {r.source === 'file' ? (
                               <div className="relative h-9 flex items-center justify-center border border-dashed border-primary/30 rounded-md bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer px-3">
                                  <input type="file" accept={r.resource_type === 'pdf' ? '.pdf' : 'video/*'} 
                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                    onChange={e => setResources(p => p.map((rs, idx) => idx === i ? { ...rs, file: e.target.files[0] } : rs))} />
                                  <UploadCloud className="size-4 text-primary mr-2" />
                                  <span className="text-xs text-primary truncate font-medium">
                                    {r.file ? r.file.name : (r.has_file ? 'Existing File Attached' : 'Choose File')}
                                  </span>
                               </div>
                            ) : (
                              <input value={r.url || ''} required
                                onChange={e => setResources(p => p.map((rs, idx) => idx === i ? { ...rs, url: e.target.value } : rs))}
                                placeholder={r.resource_type === 'live' ? 'Meeting Link (Zoom/Meet)' : 'External URL'}
                                className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
                            )}
                            
                            {r.resource_type === 'live' && (
                              <div className="pt-1">
                                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Scheduled Time (Optional)</label>
                                <input type="datetime-local" value={r.scheduled_at}
                                  onChange={e => setResources(p => p.map((rs, idx) => idx === i ? { ...rs, scheduled_at: e.target.value } : rs))}
                                  className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {RES_TYPES.map(rt => (
                      <button key={rt.value} type="button" 
                        onClick={() => setResources(p => [...p, { resource_type: rt.value, title: '', url: '', source: 'url', file: null, scheduled_at: '' }])}
                        className="h-8 inline-flex items-center gap-1.5 bg-white ring-1 ring-inset ring-black/5 hover:bg-zinc-50 text-zinc-700 px-3 rounded-md text-xs font-semibold transition-colors shadow-sm">
                        <Plus className="size-3" /> <rt.icon className="size-3" /> {rt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
                <button type="button" onClick={() => setModalOpen(false)} disabled={saving}
                  className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto shadow-sm">
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

// =====================================================================
//  ENLARGED DETAIL VIEW COMPONENT
// =====================================================================

function LabDetailView({ lab, onBack, canManage, onEdit, onDelete }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(lab);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/labs/${lab.id}`);
        const data = await res.json();
        setResources(data.resources || []);
        setMeta(m => ({ ...m, ...data }));
      } catch { setResources([]); }
      setLoading(false);
    })();
  }, [lab.id]);

  const ordered = useMemo(() => {
    const rank = { live: 0, video: 1, pdf: 2, link: 3 };
    return [...resources].sort((a, b) => (rank[a.resource_type] ?? 9) - (rank[b.resource_type] ?? 9));
  }, [resources]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* UPDATED BACK BUTTON: Removed box styling, added text hover */}
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="size-4" /> Back to Digital Labs
        </button>
        {canManage && (
           <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => onEdit(lab)} className="h-8 flex-1 sm:flex-none px-3 bg-white ring-1 ring-inset ring-black/5 text-zinc-600 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-zinc-50 shadow-sm transition-colors"><Edit className="size-3.5" /> Edit Lab</button>
              <button onClick={() => onDelete(lab)} className="h-8 flex-1 sm:flex-none px-3 bg-white ring-1 ring-inset ring-red-200 text-red-600 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-50 shadow-sm transition-colors"><Trash2 className="size-3.5" /> Delete Lab</button>
           </div>
        )}
      </div>

      <div className="bg-white rounded-lg ring-1 ring-black/5 p-5 sm:p-6 shadow-sm">
        <div className="flex items-start gap-4 mb-6">
          <div className="size-12 bg-primary/10 text-primary rounded-md flex items-center justify-center ring-1 ring-inset ring-primary/20 shrink-0">
            <FlaskConical className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 tracking-tight leading-tight">{meta.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 bg-zinc-100 px-2 py-1 rounded-md text-zinc-600">
                <BookOpen className="size-3.5" /> {meta.subject_name || 'General'}
              </span>
              <span className="flex items-center gap-1.5 bg-zinc-100 px-2 py-1 rounded-md text-zinc-600">
                <User className="size-3.5" /> {meta.created_by_name || 'Teacher'}
                {meta.created_at && <span className="normal-case font-normal text-zinc-400">· {fmtIST(meta.created_at)}</span>}
              </span>
              {wasUpdated(meta) && (
                <span className="flex items-center gap-1.5 bg-zinc-100 px-2 py-1 rounded-md text-zinc-600">
                  <PencilLine className="size-3.5" /> {meta.updated_by_name}
                  <span className="normal-case font-normal text-zinc-400">· {fmtIST(meta.updated_at)}</span>
                </span>
              )}
              <span className="bg-primary/10 text-primary px-2 py-1 rounded-md ring-1 ring-inset ring-primary/20 font-semibold">
                {meta.class_group}
              </span>
            </div>
          </div>
        </div>
        
        {meta.description && (
          <div className="mt-5 bg-zinc-50/50 p-4 rounded-md border border-zinc-100">
            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap font-medium">{meta.description}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">Lab Resources</h3>
        {loading ? (
          <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-primary size-6" /></div>
        ) : ordered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center">
            <p className="text-zinc-500 font-medium text-sm">No resources added to this lab yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ordered.map(r => {
              const meta = resTypeMeta(r.resource_type);
              const clickUrl = r.has_file ? `${API_BASE_URL}/admin/labs/resource/${r.id}` : r.url;
              return (
                <div key={r.id} className="bg-white ring-1 ring-black/5 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:shadow-md transition-shadow group gap-4">
                  <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                    <div className={`size-10 rounded-md flex items-center justify-center shrink-0 ${meta.bg} ${meta.color} ring-1 ring-inset ring-black/5`}>
                      <meta.icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
                        {r.resource_type === 'live' && r.scheduled_at && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded ring-1 ring-inset ring-black/5">
                             <Clock className="size-3" /> {fmtDateTime(r.scheduled_at)}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-zinc-900 text-sm truncate">{r.title}</p>
                    </div>
                  </div>
                  
                  {/* UNIFIED PRIMARY ACTION BUTTON */}
                  <a href={clickUrl} target="_blank" rel="noreferrer" 
                    className="h-9 px-4 rounded-md flex items-center justify-center gap-1.5 text-xs font-semibold text-white transition-colors shadow-sm sm:ml-4 shrink-0 w-full sm:w-auto bg-primary hover:bg-primary/90">
                    {r.resource_type === 'video' ? 'Watch' : r.resource_type === 'live' ? 'Join' : 'Open'}
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}