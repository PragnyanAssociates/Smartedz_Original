import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Video, PlayCircle, Plus, Edit, Trash2, X, Search,
  Loader2, Calendar as CalIcon, Clock, FileVideo, ChevronDown, Save, Link as LinkIcon,
  HelpCircle, ShieldCheck
} from 'lucide-react';
// Render a UTC datetime (Railway stores UTC) as IST for display. Handles
// both bare "YYYY-MM-DD HH:MM:SS" strings and ISO strings / Date objects.
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

// ---------------------------------------------------------------------
//  openAuthedMedia — open a file served behind the /api auth gate (an
//  UPLOADED recorded video at /admin/online-classes/video/:id) in a new
//  tab. A plain window.open(url) is a navigation that sends NO token, so
//  the backend replies "Please sign in to continue." (401). We fetch the
//  bytes (the auth interceptor attaches the token) and point a pre-opened
//  tab at the blob. External links (YouTube, Meet) don't hit our gate and
//  open directly.
// ---------------------------------------------------------------------
async function openAuthedMedia(url) {
  // Open the tab synchronously (inside the click) so the popup blocker
  // allows it, then redirect it once the blob is ready.
  const win = window.open('', '_blank');
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const blob = await r.blob();
    const obj = URL.createObjectURL(blob);
    if (win) win.location.href = obj;
    else window.open(obj, '_blank');
    setTimeout(() => URL.revokeObjectURL(obj), 120000);
  } catch (e) {
    if (win) win.close();
    alert('Could not open the video. Please try again.');
  }
}

// --- Helpers for 12h Time Logic ---
const parseDateTimeToParts = (dtString) => {
  if (!dtString) {
    const now = new Date();
    return { date: now.toISOString().split('T')[0], time: '09:00', period: 'AM' };
  }
  const dt = new Date(dtString.replace(' ', 'T'));
  const date = dt.toISOString().split('T')[0];
  let hh = dt.getHours();
  const mm = String(dt.getMinutes()).padStart(2, '0');
  const period = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  const time = `${String(hh).padStart(2, '0')}:${mm}`;
  return { date, time, period };
};
const joinPartsToDateTime = (date, time, period) => {
  if (!date || !time) return '';
  let [h, m] = time.split(':');
  let hh = parseInt(h, 10) || 0;
  if (period === 'PM' && hh < 12) hh += 12;
  if (period === 'AM' && hh === 12) hh = 0;
  return `${date} ${String(hh).padStart(2, '0')}:${(m || '00').padEnd(2, '0').slice(0, 2)}:00`;
};
export default function TeacherOnlineClasses({ canEdit = false, canDelete = false }) {
  const { user } = useAuth();
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('live');
  // List filters (client-side, over the already-loaded classes). '' = All.
  const [classFilter, setClassFilter]     = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [dbClasses, setDbClasses] = useState([]);
  const [dbSubjects, setDbSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [videoSource, setVideoSource] = useState('upload');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [form, setForm] = useState({
    title: '', class_type: 'live', class_id: '', subject_id: '',
    teacher_id: '', date: '', time: '', period: '',
    meet_link: '', topic: '', description: ''
  });
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
    if (classFilter)   list = list.filter(c => String(c.class_id) === String(classFilter));
    if (subjectFilter) list = list.filter(c => String(c.subject_id) === String(subjectFilter));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.subject_name || '').toLowerCase().includes(q) ||
        (c.teacher_name || '').toLowerCase().includes(q) ||
        (c.created_by_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [classesList, view, query, classFilter, subjectFilter]);
  const hasActiveFilter = Boolean(query.trim() || classFilter || subjectFilter);
  const classLabel = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;
  const openCreate = () => {
    setEditingItem(null);
    const parts = parseDateTimeToParts(null);
    setForm({
      title: '', class_type: view, class_id: '', subject_id: '',
      teacher_id: '', date: parts.date, time: parts.time, period: parts.period,
      meet_link: '', topic: '', description: ''
    });
    setSelectedVideo(null);
    setVideoSource('upload');
    setIsModalOpen(true);
  };
  const openEdit = (c) => {
    setEditingItem(c);
    const parts = parseDateTimeToParts(c.class_datetime);
    setForm({
      title: c.title, class_type: c.class_type, class_id: c.class_id ? String(c.class_id) : '',
      subject_id: c.subject_id ? String(c.subject_id) : '', teacher_id: c.teacher_id ? String(c.teacher_id) : '',
      date: parts.date, time: parts.time, period: parts.period,
      meet_link: c.meet_link || '', topic: c.topic || '', description: c.description || ''
    });
    setSelectedVideo(null);
    if (c.class_type === 'recorded') { setVideoSource(c.has_video_data ? 'upload' : 'link'); }
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
    if (!form.title || !form.subject_id || !form.teacher_id || !form.date || !form.time) {
      return alert("Required fields missing.");
    }
    if (form.class_type === 'live' && !form.meet_link) return alert("Meeting link required.");
    if (form.class_type === 'recorded') {
        if (videoSource === 'upload' && !selectedVideo && !editingItem?.has_video_data) return alert("Video file required.");
        if (videoSource === 'link' && !form.meet_link) return alert("Video link required.");
    }
    setSaving(true);
    try {
      const fullDateTime = joinPartsToDateTime(form.date, form.time, form.period);
      const fd = new FormData();
      fd.append('institutionId', user.institutionId); fd.append('title', form.title);
      fd.append('class_type', form.class_type); if (form.class_id) fd.append('class_id', form.class_id);
      fd.append('subject_id', form.subject_id); fd.append('teacher_id', form.teacher_id);
      fd.append('class_datetime', fullDateTime); if (form.topic) fd.append('topic', form.topic);
      if (form.description) fd.append('description', form.description); fd.append('created_by', user.id);
      if (form.class_type === 'live') { fd.append('meet_link', form.meet_link); }
      else if (form.class_type === 'recorded') {
        if (videoSource === 'link') { fd.append('meet_link', form.meet_link); fd.append('clear_video', 'true'); }
        else if (videoSource === 'upload' && selectedVideo) { fd.append('videoFile', selectedVideo); }
      }
      const url = editingItem ? `${API_BASE_URL}/admin/online-classes/${editingItem.id}` : `${API_BASE_URL}/admin/online-classes`;
      const res = await fetch(url, { method: editingItem ? 'PUT' : 'POST', body: fd });
      if (res.ok) { setIsModalOpen(false); loadData(); }
      else { const err = await res.json(); alert(err.error || 'Save failed.'); }
    } catch (e) { alert('Error saving class.'); }
    setSaving(false);
  };
  const handleJoinOrWatch = (c) => {
    if (c.class_type === 'live' && c.meet_link) {
      window.open(c.meet_link, '_blank', 'noopener,noreferrer');
    } else if (c.class_type === 'recorded') {
        // Uploaded video is served behind the auth gate -> fetch as a blob so
        // it doesn't 401. An external video link opens directly.
        if (c.has_video_data) openAuthedMedia(`${API_BASE_URL}/admin/online-classes/video/${c.id}`);
        else if (c.meet_link) window.open(c.meet_link, '_blank', 'noopener,noreferrer');
    }
  };
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2 sm:mb-0">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <Video className="text-primary size-5" /> Online Classes
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Manage and join sessions.</p>
        </div>
        <OnlineClassesHelp canEdit={canEdit} />
      </header>
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar w-full xl:w-auto shrink-0">
          {['live', 'recorded'].map(t => (
            <button key={t} onClick={() => setView(t)} className={`flex-1 xl:flex-none px-4 py-1.5 rounded-md text-[11px] font-semibold transition-colors uppercase ${view === t ? 'bg-primary text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
              {t} Classes
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          {/* Class + Subject filters (apply to the current tab) */}
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-40">
              <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
                className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                <option value="">All Classes</option>
                {dbClasses.map(c => <option key={c.id} value={String(c.id)}>{classLabel(c)}</option>)}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative w-full sm:w-40">
              <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
                className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                <option value="">All Subjects</option>
                {dbSubjects.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search classes..." className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
          </div>
          {canEdit && (
            <button onClick={openCreate} className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm shrink-0">
              <Plus className="size-3.5" /> Schedule Class
            </button>
          )}
        </div>
      </div>
      <div className="flex-1">
        {loading ? ( <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <Video className="size-10 text-zinc-300 mb-3" /><p className="text-zinc-500 text-sm font-medium">{hasActiveFilter ? `No ${view} classes match your filters.` : `No ${view} classes found.`}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1040px]">
              <thead className="bg-zinc-50/80">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 border-b border-zinc-100">Date & Time</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 border-b border-zinc-100">Class Details</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 border-b border-zinc-100">Audience</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 border-b border-zinc-100">Teacher</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 border-b border-zinc-100">Created By</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 border-b border-zinc-100 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(c => {
                  const dt = new Date(c.class_datetime);
                  const isLive = c.class_type === 'live';
                  const isExpired = isLive && (dt < new Date());
                  const isJoinable = !isExpired;
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/60 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-primary font-semibold text-sm block">{dt.toLocaleDateString()}</span>
                        <span className="text-zinc-500 text-[11px] font-medium mt-0.5 block flex items-center gap-1"><Clock className="size-3" />{dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-zinc-900 text-sm mb-1.5 line-clamp-1">{c.title}</div>
                        <div className="flex flex-wrap gap-2">
                           {c.topic ? <span className="bg-primary/5 text-primary text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded ring-1 ring-primary/20">{c.topic}</span> : null}
                           {isExpired && <span className="text-[10px] font-bold text-red-500 uppercase tracking-tight self-center">Date is Expired</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-zinc-600">
                        <div className="text-zinc-900 font-semibold">{c.subject_name}</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">{c.className ? classLabel(c) : 'All Classes'}</div>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-zinc-700">{c.teacher_name}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-medium text-zinc-800 text-sm">{c.created_by_name || '\u2014'}</div>
                        {c.created_at && (
                          <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
                            <Clock className="size-3" /> {fmtIST(c.created_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button disabled={!isJoinable} onClick={() => handleJoinOrWatch(c)} className={`h-8 px-3 rounded-md font-semibold text-xs text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm ${!isJoinable ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed opacity-60' : isLive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary hover:bg-primary/90'}`}>
                            {isLive ? <><Video className="size-3.5"/> Join</> : <><PlayCircle className="size-3.5"/> Watch</>}
                          </button>
                          {(canEdit || canDelete) && (
                            <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-2">
                              {canEdit && <button onClick={() => openEdit(c)} className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md flex items-center justify-center shadow-sm ring-1 ring-black/5"><Edit className="size-3.5" /></button>}
                              {canDelete && <button onClick={() => handleDelete(c.id)} className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-red-600 rounded-md flex items-center justify-center shadow-sm ring-1 ring-black/5"><Trash2 className="size-3.5" /></button>}
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
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-2xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">{editingItem ? 'Edit Class' : 'Schedule Class'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md"><X className="size-4" /></button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
                {!editingItem && <Field label="Class Type" type="select" value={form.class_type} onChange={v => setForm({...form, class_type: v})} options={[ {value: 'live', label: 'Live Class'}, {value: 'recorded', label: 'Recorded Class'} ]} />}
                <Field label="Class Title" required placeholder="e.g. Algebra Review" value={form.title} onChange={v => setForm({...form, title: v})} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <Field label="Class Group" type="select" value={form.class_id} onChange={v => setForm({...form, class_id: v})} options={[ {value: '', label: 'All Classes'}, ...dbClasses.map(c => ({value: String(c.id), label: classLabel(c)})) ]} />
                  <Field label="Subject" type="select" required value={form.subject_id} onChange={v => setForm({...form, subject_id: v})} options={[ {value: '', label: 'Select Subject'}, ...dbSubjects.map(s => ({value: String(s.id), label: s.name})) ]} />
                  <Field label="Teacher" type="select" required value={form.teacher_id} onChange={v => setForm({...form, teacher_id: v})} options={[ {value: '', label: 'Select Teacher'}, ...teachers.map(t => ({value: String(t.id), label: t.name})) ]} />
                  <div className="space-y-1.5"><label className="text-[10px] font-semibold text-zinc-500 uppercase">Date & Time <span className="text-red-500">*</span></label>
                    <div className="flex flex-col gap-2"><input type="date" value={form.date} required onChange={e => setForm({ ...form, date: e.target.value })} className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm" />
                      <div className="flex items-center gap-2"><input type="text" value={form.time} placeholder="09:00" required onChange={e => setForm({ ...form, time: e.target.value })} className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-center tabular-nums" />
                        <div className="relative shrink-0"><select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className="h-9 w-20 pl-3 pr-8 bg-white border border-zinc-200 rounded-md text-xs font-bold appearance-none cursor-pointer"><option value="AM">AM</option><option value="PM">PM</option></select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-zinc-400 pointer-events-none" /></div>
                      </div>
                    </div>
                  </div>
                </div>
                <Field label="Topic" placeholder="e.g. Linear Equations" value={form.topic} onChange={v => setForm({...form, topic: v})} />
                {form.class_type === 'live' ? <Field label="Meeting Link" type="url" required placeholder="https://meet.google.com/..." value={form.meet_link} onChange={v => setForm({...form, meet_link: v})} /> : (
                  <div className="space-y-3 p-4 bg-zinc-50 rounded-lg border border-zinc-100">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase">Video Source</label>
                    <div className="flex bg-zinc-200/50 p-1 rounded-md max-w-fit">
                      <button type="button" onClick={() => setVideoSource('upload')} className={`px-4 py-1.5 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${videoSource === 'upload' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}><FileVideo className="size-3.5" /> Upload File</button>
                      <button type="button" onClick={() => setVideoSource('link')} className={`px-4 py-1.5 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${videoSource === 'link' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}><LinkIcon className="size-3.5" /> External Link</button>
                    </div>
                    <div className="mt-2">
                      {videoSource === 'upload' ? <div><input type="file" accept="video/*" onChange={e => setSelectedVideo(e.target.files[0])} className="block w-full text-sm text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 cursor-pointer border border-zinc-200 rounded-md bg-white h-9 leading-9" />{editingItem?.has_video_data && !selectedVideo && <p className="text-xs text-emerald-600 font-medium mt-1.5">Video stored in DB. Select file to replace.</p>}</div> : <Field label="Video Link URL" type="url" required={videoSource === 'link'} placeholder="https://youtube.com/..." value={form.meet_link} onChange={v => setForm({...form, meet_link: v})} />}
                    </div>
                  </div>
                )}
                <Field label="Description" type="textarea" placeholder="Prerequisites..." value={form.description} onChange={v => setForm({...form, description: v})} />
              </div>
              <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={saving} className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">Cancel</button>
                <button type="submit" disabled={saving} className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">{saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{saving ? 'Saving...' : (editingItem ? 'Save Changes' : 'Publish Class')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
function Field({ label, value, onChange, type = 'text', options, required, placeholder }) {
  const base = "h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 transition-colors shadow-sm";
  return (
    <div className="space-y-1.5 w-full">
      {label && <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label} {required && <span className="text-red-500">*</span>}</label>}
      {type === 'select' ? (
        <div className="relative"><select value={value || ''} onChange={e => onChange(e.target.value)} className={`${base} cursor-pointer appearance-none pr-8`} required={required}>{(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select><ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3} placeholder={placeholder} className={`${base} h-auto py-2.5 resize-none`} required={required} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={base} required={required} />
      )}
    </div>
  );
}

// =====================================================================
//  OnlineClassesHelp — "How to use" guide (same theme as ReportsHelp).
//  Managers get the schedule/manage guide; read-only staff get the view one.
// =====================================================================
const GUIDES = {
  manage: {
    title: 'Online Classes',
    steps: [
      ['1 \u00b7 Live vs Recorded', 'The two tabs. Live is a scheduled session with a meeting link students join at the set time; Recorded is an uploaded video or a video link they can watch anytime.'],
      ['2 \u00b7 Schedule a class', 'Schedule Class opens the form \u2014 title, class group (or All Classes), subject, teacher, date & time and an optional topic. A live class needs a meeting link; a recorded one takes an uploaded video file or an external link.'],
      ['3 \u00b7 Join / Watch', 'Join opens a live meeting; Watch plays a recorded video. A live class whose time has passed shows \u201cDate is Expired\u201d and Join is disabled.'],
      ['4 \u00b7 Find classes', 'Search by title, subject, teacher or author, and narrow with the Class and Subject filters (they apply to the tab you\u2019re on).'],
      ['5 \u00b7 Edit & delete', 'Hover a row for the edit and delete actions. Each row shows who created the class and when.'],
    ],
    note: 'Uploaded videos are stored in the school\u2019s library and stream for signed-in users; external links (YouTube, Meet) open directly. Times display in your device\u2019s local time.'
  },
  view: {
    title: 'Online Classes',
    steps: [
      ['1 \u00b7 Live vs Recorded', 'The two tabs. Live sessions are joined at their scheduled time; recorded ones can be watched whenever.'],
      ['2 \u00b7 Join / Watch', 'Join opens a live meeting; Watch plays a recorded video. A past live class shows \u201cDate is Expired\u201d and can\u2019t be joined.'],
      ['3 \u00b7 Find a class', 'Search by title, subject or teacher, and use the Class and Subject filters to narrow the current tab.'],
    ],
    note: 'This is a read-only view \u2014 classes are scheduled and edited by staff with edit rights. Times display in your device\u2019s local time.'
  }
};

function OnlineClassesHelp({ canEdit = false, className = '' }) {
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