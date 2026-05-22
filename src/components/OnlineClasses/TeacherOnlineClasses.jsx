import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { 
  Video, PlayCircle, Plus, Edit, Trash2, X, Search, Loader2, Calendar as CalIcon, Clock, FileVideo
} from 'lucide-react';

export default function TeacherOnlineClasses({ canManage = true }) {
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
        // DO NOT set Content-Type header manually; browser must set it with the boundary for FormData
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
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center text-center gap-1">
        <h1 className="text-xl lg:text-2xl font-black text-slate-800">Online Classes</h1>
        <p className="text-sm text-slate-500 font-medium">Manage and join live and recorded sessions</p>
      </div>

      <div className="flex justify-center mb-2">
        <div className="inline-flex bg-slate-100 rounded-xl p-1">
          <button onClick={() => setView('live')}
            className={`px-6 py-2 rounded-lg font-bold transition-all text-sm ${view === 'live' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>
            Live Classes
          </button>
          <button onClick={() => setView('recorded')}
            className={`px-6 py-2 rounded-lg font-bold transition-all text-sm ${view === 'recorded' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>
            Recorded Classes
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search classes…"
            className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 w-full sm:w-72 shadow-sm" />
        </div>
        {canManage && (
          <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
            <Plus size={18} /> Schedule Class
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No {view} classes found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(c => {
            const dt = new Date(c.class_datetime);
            return (
              <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4 hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-blue-700 font-bold text-sm">{dt.toLocaleDateString()}</span>
                    <span className="text-slate-500 text-xs font-bold ml-2">{dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  {c.topic && <span className="bg-blue-50 text-blue-700 text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full">{c.topic}</span>}
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-800 leading-tight mb-2">{c.title}</h3>
                  <div className="grid grid-cols-2 gap-y-2 text-xs font-medium text-slate-600">
                    <div className="flex flex-col"><span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Subject</span><span className="truncate">{c.subject_name}</span></div>
                    <div className="flex flex-col"><span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Class</span><span className="truncate">{c.className ? classLabel(c) : 'All Classes'}</span></div>
                    <div className="col-span-2 flex flex-col"><span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Teacher</span><span>{c.teacher_name}</span></div>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button onClick={() => handleJoinOrWatch(c)} className={`flex items-center gap-2 font-bold py-2 px-4 rounded-xl text-xs text-white shadow-md transition-all ${c.class_type === 'live' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                    {c.class_type === 'live' ? <><Video size={14}/> Join</> : <><PlayCircle size={14}/> Watch</>}
                  </button>

                  {canManage && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-6 text-slate-800">
              {editingItem ? 'Edit Class' : 'Schedule Class'}
            </h2>

            <form onSubmit={handleSave} className="space-y-5">
              {!editingItem && (
                <Field label="Class Type" type="select" value={form.class_type} onChange={v => setForm({...form, class_type: v})}
                  options={[ {value: 'live', label: 'Live Class'}, {value: 'recorded', label: 'Recorded Class'} ]} />
              )}
              
              <Field label="Class Title" required placeholder="e.g. Algebra Review" value={form.title} onChange={v => setForm({...form, title: v})} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Video File {editingItem ? '' : '*'}</label>
                  <input type="file" accept="video/*" onChange={e => setSelectedVideo(e.target.files[0])} 
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-100 rounded-xl bg-slate-50" />
                  {editingItem?.video_path && !selectedVideo && <p className="text-xs text-emerald-600 font-bold mt-1">Video currently uploaded. Select file only to replace.</p>}
                </div>
              )}

              <Field label="Description" type="textarea" placeholder="Prerequisites or notes..." value={form.description} onChange={v => setForm({...form, description: v})} />

              <button type="submit" disabled={saving} className="w-full bg-slate-900 hover:bg-blue-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black uppercase tracking-widest mt-4 transition-all shadow-xl flex justify-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Saving...' : (editingItem ? 'Save Changes' : 'Publish Class')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Shared Field Component ---
function Field({ label, value, onChange, type = 'text', options, required, placeholder }) {
  const base = "w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/10 text-sm font-medium";
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {type === 'select' ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={base + ' cursor-pointer'}>
          {(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3} placeholder={placeholder} className={base + ' resize-none'} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder} className={base} />
      )}
    </div>
  );
}