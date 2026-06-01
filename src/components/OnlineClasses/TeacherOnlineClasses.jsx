import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { 
  Video, PlayCircle, Plus, Edit, Trash2, X, Search, 
  Loader2, Calendar as CalIcon, Clock, FileVideo, ChevronDown, Save
} from 'lucide-react';

export default function TeacherOnlineClasses({ canEdit = false, canDelete = false }) {
  const { user } = useAuth();
  
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('live'); // 'live' | 'recorded'

  // Dropdown data
  const [dbClasses, setDbClasses] = useState([]);
  const [dbSubjects, setDbSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const emptyForm = {
    title: '', class_type: 'live', class_id: '', subject_id: '', 
    teacher_id: '', class_datetime: '', meet_link: '', topic: '', description: ''
  };
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const [clsRes, dbRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/online-classes/${user.institutionId}?userId=${user.id}`),
        fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`)
      ]);
      const clsData = await clsRes.json();
      const dbData = await dbRes.json();
      
      setClassesList(Array.isArray(clsData) ? clsData : []);
      setDbClasses(dbData.classes || []);
      setDbSubjects(dbData.subjects || []);
      setTeachers((dbData.users || []).filter(u => (u.role || '').toLowerCase().includes('teacher')));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let list = classesList.filter(c => c.class_type === view);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c => 
        (c.title || '').toLowerCase().includes(q) ||
        (c.subject_name || '').toLowerCase().includes(q) ||
        (c.teacher_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [classesList, view, query]);

  const classLabel = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;

  // --- Modal Handlers ---
  const openCreate = () => {
    setEditingItem(null);
    const now = new Date();
    const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    setForm({ ...emptyForm, class_datetime: localNow });
    setSelectedVideo(null);
    setIsModalOpen(true);
  };

  const openEdit = (c) => {
    setEditingItem(c);
    const dt = new Date(c.class_datetime);
    const localDt = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    setForm({
      title: c.title,
      class_type: c.class_type,
      class_id: c.class_id ? String(c.class_id) : '',
      subject_id: c.subject_id ? String(c.subject_id) : '',
      teacher_id: c.teacher_id ? String(c.teacher_id) : '',
      class_datetime: localDt,
      meet_link: c.meet_link || '',
      topic: c.topic || '',
      description: c.description || ''
    });
    setSelectedVideo(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this online class?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/online-classes/${id}`, { method: 'DELETE' });
      if (res.ok) loadData();
    } catch (e) { alert('Delete failed'); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title || !form.subject_id || !form.teacher_id) {
      return alert("Title, Subject, and Teacher are required.");
    }
    if (form.class_type === 'live' && !form.meet_link) return alert("Meeting link required for live classes.");
    if (form.class_type === 'recorded' && !selectedVideo && !editingItem?.video_path) {
      return alert("Video file required for recorded classes.");
    }

    setSaving(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('institutionId', user.institutionId);
      formDataObj.append('title', form.title);
      formDataObj.append('class_type', form.class_type);
      if (form.class_id) formDataObj.append('class_id', form.class_id);
      formDataObj.append('subject_id', form.subject_id);
      formDataObj.append('teacher_id', form.teacher_id);
      
      const formattedDate = form.class_datetime.replace('T', ' ') + ':00';
      formDataObj.append('class_datetime', formattedDate);
      
      if (form.class_type === 'live') formDataObj.append('meet_link', form.meet_link);
      if (form.topic) formDataObj.append('topic', form.topic);
      if (form.description) formDataObj.append('description', form.description);
      formDataObj.append('created_by', user.id);

      if (form.class_type === 'recorded' && selectedVideo) {
        formDataObj.append('videoFile', selectedVideo);
      }

      const url = editingItem 
        ? `${API_BASE_URL}/admin/online-classes/${editingItem.id}` 
        : `${API_BASE_URL}/admin/online-classes`;

      const res = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        body: formDataObj
      });

      if (res.ok) {
        setIsModalOpen(false);
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Save failed.');
      }
    } catch (e) { alert('Error saving class.'); }
    setSaving(false);
  };

  const handleJoinOrWatch = (c) => {
    if (c.class_type === 'live' && c.meet_link) window.open(c.meet_link, '_blank');
    if (c.class_type === 'recorded' && c.video_path) window.open(`${API_BASE_URL.replace('/api', '')}${c.video_path}`, '_blank');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      
      <header className="flex flex-col mb-2 sm:mb-0">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
          <Video className="text-primary size-5" />
          Online Classes
        </h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
          Manage and join live and recorded sessions.
        </p>
      </header>

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar w-full xl:w-auto shrink-0">
          <button onClick={() => setView('live')}
            className={`flex-1 xl:flex-none px-4 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
              view === 'live' ? 'bg-primary text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50/50'
            }`}>
            Live Classes
          </button>
          <button onClick={() => setView('recorded')}
            className={`flex-1 xl:flex-none px-4 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
              view === 'recorded' ? 'bg-primary text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50/50'
            }`}>
            Recorded Classes
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search classes..."
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
          </div>
          
          {canEdit && (
            <button onClick={openCreate} className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0">
              <Plus className="size-3.5" /> Schedule Class
            </button>
          )}
        </div>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin size-8 text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <Video className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">No {view} classes found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-zinc-50/80">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Date & Time</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Class Details</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Subject & Audience</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Teacher</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(c => {
                  const dt = new Date(c.class_datetime);
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/60 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-primary font-semibold text-sm block">{dt.toLocaleDateString()}</span>
                        <span className="text-zinc-500 text-[11px] font-medium mt-0.5 block">{dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-zinc-900 text-sm mb-1.5 line-clamp-1">{c.title}</div>
                        {c.topic ? (
                          <span className="bg-primary/5 text-primary text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded ring-1 ring-primary/20 inline-block">
                            {c.topic}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs italic">No topic</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-zinc-600">
                        <div className="text-zinc-900 font-semibold">{c.subject_name}</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">{c.className ? classLabel(c) : 'All Classes'}</div>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-zinc-700">
                        {c.teacher_name}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleJoinOrWatch(c)} 
                            className={`h-8 px-3 rounded-md font-semibold text-xs text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm ${
                              c.class_type === 'live' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary hover:bg-primary/90'
                            }`}>
                            {c.class_type === 'live' ? <><Video className="size-3.5"/> Join</> : <><PlayCircle className="size-3.5"/> Watch</>}
                          </button>
                          
                          {(canEdit || canDelete) && (
                            <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-2">
                              {canEdit && (
                                <button onClick={() => openEdit(c)} className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5" title="Edit">
                                  <Edit className="size-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={() => handleDelete(c.id)} className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-red-600 rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5" title="Delete">
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-2xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">
                {editingItem ? 'Edit Class' : 'Schedule Class'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                {!editingItem && (
                  <Field label="Class Type" type="select" value={form.class_type} onChange={v => setForm({...form, class_type: v})}
                    options={[ {value: 'live', label: 'Live Class'}, {value: 'recorded', label: 'Recorded Class'} ]} />
                )}
                
                <Field label="Class Title" required placeholder="e.g. Algebra Review" value={form.title} onChange={v => setForm({...form, title: v})} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <Field label="Class Group" type="select" value={form.class_id} onChange={v => setForm({...form, class_id: v})}
                    options={[ {value: '', label: 'All Classes'}, ...dbClasses.map(c => ({value: String(c.id), label: classLabel(c)})) ]} />
                  
                  <Field label="Subject" type="select" required value={form.subject_id} onChange={v => setForm({...form, subject_id: v})}
                    options={[ {value: '', label: 'Select Subject'}, ...dbSubjects.map(s => ({value: String(s.id), label: s.name})) ]} />
                  
                  <Field label="Teacher" type="select" required value={form.teacher_id} onChange={v => setForm({...form, teacher_id: v})}
                    options={[ {value: '', label: 'Select Teacher'}, ...teachers.map(t => ({value: String(t.id), label: t.name})) ]} />
                  
                  <Field label="Date & Time" type="datetime-local" required value={form.class_datetime} onChange={v => setForm({...form, class_datetime: v})} />
                </div>

                <Field label="Topic" placeholder="e.g. Linear Equations" value={form.topic} onChange={v => setForm({...form, topic: v})} />

                {form.class_type === 'live' ? (
                  <Field label="Meeting Link" type="url" required placeholder="https://meet.google.com/..." value={form.meet_link} onChange={v => setForm({...form, meet_link: v})} />
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      Video File {!editingItem && <span className="text-red-500">*</span>}
                    </label>
                    <input type="file" accept="video/*" onChange={e => setSelectedVideo(e.target.files[0])} 
                      className="block w-full text-sm text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer border border-zinc-200 rounded-md bg-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 h-9 leading-9" />
                    {editingItem?.video_path && !selectedVideo && <p className="text-xs text-emerald-600 font-medium mt-1.5">Video currently uploaded. Select file only to replace.</p>}
                  </div>
                )}

                <Field label="Description" type="textarea" placeholder="Prerequisites or notes..." value={form.description} onChange={v => setForm({...form, description: v})} />
              </div>

              <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={saving}
                  className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">
                  {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
                  {saving ? 'Saving...' : (editingItem ? 'Save Changes' : 'Publish Class')}
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