import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { 
  Users, Calendar, Clock, GraduationCap, Target, 
  Video, Edit, Trash2, Search, X, Link as LinkIcon, Plus, Loader2, ChevronDown, Save, User
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

// --- Helpers for 12h Time Logic ---
const parseDateTimeToParts = (dtString) => {
  if (!dtString) {
    const now = new Date();
    return { 
      date: now.toISOString().split('T')[0], 
      time: '09:00', 
      period: 'AM' 
    };
  }
  const dt = new Date(dtString);
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

export default function TeacherAdminPTM({ canEdit = false, canDelete = false }) {
  const { user } = useAuth();
  
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // List filters (client-side, over the already-loaded meetings). '' = All.
  const [classFilter, setClassFilter]     = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    date: '', time: '09:00', period: 'AM',
    teacher_id: '', class_id: '', 
    subject_focus: '', status: 'Scheduled', notes: '', meeting_link: ''
  });

  const loadMeetings = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ptm/${user.institutionId}?userId=${user.id}`);
      const d = await res.json();
      setMeetings(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  const loadFormData = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
      const d = await res.json();
      setClasses(d.classes || []);
      setTeachers((d.users || []).filter(u => (u.role || '').toLowerCase().includes('teacher')));
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => { 
    loadMeetings(); 
    loadFormData();
  }, [loadMeetings, loadFormData]);

  const filtered = useMemo(() => {
    let list = [...meetings];
    if (classFilter)   list = list.filter(m => String(m.class_id) === String(classFilter));
    if (teacherFilter) list = list.filter(m => String(m.teacher_id) === String(teacherFilter));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(m => 
        (m.teacher_name || '').toLowerCase().includes(q) ||
        (m.className || '').toLowerCase().includes(q) ||
        (m.subject_focus || '').toLowerCase().includes(q) ||
        (m.created_by_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [query, meetings, classFilter, teacherFilter]);

  const hasActiveFilter = Boolean(query.trim() || classFilter || teacherFilter);

  const classLabel = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;

  const openCreate = () => {
    setEditingMeeting(null);
    const parts = parseDateTimeToParts(null);
    setForm({
      date: parts.date,
      time: parts.time,
      period: parts.period,
      teacher_id: '',
      class_id: '',
      subject_focus: '',
      status: 'Scheduled',
      notes: '',
      meeting_link: ''
    });
    setIsModalOpen(true);
  };

  const openEdit = (m) => {
    setEditingMeeting(m);
    const parts = parseDateTimeToParts(m.meeting_datetime);
    
    setForm({
      date: parts.date,
      time: parts.time,
      period: parts.period,
      teacher_id: m.teacher_id ? String(m.teacher_id) : '',
      class_id: m.class_id ? String(m.class_id) : '',
      subject_focus: m.subject_focus || '',
      status: m.status || 'Scheduled',
      notes: m.notes || '',
      meeting_link: m.meeting_link || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Delete meeting regarding "${m.subject_focus}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ptm/${m.id}`, { method: 'DELETE' });
      if (res.ok) loadMeetings();
    } catch (e) { alert('Failed to delete meeting.'); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.date || !form.time || !form.teacher_id || !form.subject_focus) {
      return alert("Please fill in Date, Time, Teacher, and Focus.");
    }
    setSaving(true);
    try {
      const fullDateTime = joinPartsToDateTime(form.date, form.time, form.period);
      const payload = {
        meeting_datetime: fullDateTime,
        teacher_id: parseInt(form.teacher_id, 10),
        class_id: form.class_id ? parseInt(form.class_id, 10) : null,
        subject_focus: form.subject_focus,
        status: form.status,
        notes: form.notes,
        meeting_link: form.meeting_link,
        institutionId: user.institutionId,
        created_by: user.id
      };

      const url = editingMeeting 
        ? `${API_BASE_URL}/admin/ptm/${editingMeeting.id}` 
        : `${API_BASE_URL}/admin/ptm`;

      const res = await fetch(url, {
        method: editingMeeting ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        loadMeetings();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save meeting.');
      }
    } catch (e) {
      alert('Error saving meeting.');
    } finally {
      setSaving(false);
    }
  };

  const handleJoinMeeting = (link) => {
    if (link) window.open(link, '_blank');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      
      <header className="flex flex-col mb-2 sm:mb-0">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
          <Users className="text-primary size-5" />
          PTM Schedule
        </h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
          Manage and schedule Parent-Teacher Meetings.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search meetings..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
        </div>

        {/* Class + Teacher filters */}
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-44">
            <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={String(c.id)}>{classLabel(c)}</option>)}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative w-full sm:w-44">
            <select value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)}
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
              <option value="">All Teachers</option>
              {teachers.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        
        {canEdit && (
          <button onClick={openCreate}
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0 sm:ml-auto">
            <Plus className="size-3.5" /> Schedule Meeting
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
            <Users className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">{hasActiveFilter ? 'No meetings match your filters.' : 'No meetings found.'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1040px]">
              <thead className="bg-zinc-50/80">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Date & Time</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Teacher & Class</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Meeting Focus</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Status</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Created By</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map(item => {
                  const meetingDate = new Date(item.meeting_datetime);
                  const isExpired = meetingDate < new Date();
                  const isCompleted = item.status === 'Completed';
                  const isJoinable = item.status === 'Scheduled' && item.meeting_link && !isExpired;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/60 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-zinc-900 font-semibold text-sm block">
                          {meetingDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-zinc-500 text-[11px] font-medium mt-0.5 block flex items-center gap-1">
                          <Clock className="size-3" />
                          {meetingDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-zinc-900 text-sm mb-1">{item.teacher_name || 'N/A'}</div>
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <GraduationCap className="size-3" />
                          {item.className ? `${item.className}${item.section ? ` - ${item.section}` : ''}` : 'All Classes'}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-zinc-900 text-sm line-clamp-1">{item.subject_focus || 'General'}</div>
                        {item.notes ? (
                          <div className="text-xs text-zinc-500 mt-1 line-clamp-1 max-w-[250px]" title={item.notes}>{item.notes}</div>
                        ) : (
                          <div className="text-xs text-zinc-400 italic mt-1">No additional notes</div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2 items-start">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                            isCompleted ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-primary/10 text-primary ring-primary/20'
                          }`}>
                            {isExpired && item.status !== 'Completed' ? 'Expired' : item.status}
                          </span>
                          {isExpired && !isCompleted ? (
                            <span className="text-[10px] font-semibold text-red-500 uppercase tracking-tight">Date is Expired</span>
                          ) : isJoinable ? (
                            <button onClick={() => handleJoinMeeting(item.meeting_link)} 
                              className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                              <LinkIcon className="size-3" /> Join Link
                            </button>
                          ) : item.meeting_link ? (
                            <span className="text-zinc-400 text-[11px] flex items-center gap-1 cursor-not-allowed opacity-50">
                               <LinkIcon className="size-3" /> Join Link
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-medium text-zinc-800 text-sm">{item.created_by_name || '—'}</div>
                        {item.created_at && (
                          <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
                            <Clock className="size-3" /> {fmtIST(item.created_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            disabled={!isJoinable}
                            onClick={() => handleJoinMeeting(item.meeting_link)} 
                            className={`h-8 px-3 rounded-md font-semibold text-xs text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm ${
                              isJoinable ? 'bg-primary hover:bg-primary/90' : 'bg-zinc-300 text-zinc-500 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <Video className="size-3.5"/> Join
                          </button>
                          
                          {(canEdit || canDelete) && (
                            <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-1">
                              {canEdit && (
                                <button onClick={() => openEdit(item)} className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5" title="Edit">
                                  <Edit className="size-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={() => handleDelete(item)} className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-red-600 rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5" title="Delete">
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

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-2xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">
                {editingMeeting ? 'Edit Meeting' : 'Schedule Meeting'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  
                  {/* Date & Time with manual logic */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Date & Time <span className="text-red-500">*</span></label>
                    <div className="flex flex-col gap-2">
                      <input type="date" value={form.date} required
                        onChange={e => setForm({ ...form, date: e.target.value })}
                        className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                      <div className="flex items-center gap-2">
                        <input type="text" value={form.time} placeholder="09:00" required
                          onChange={e => setForm({ ...form, time: e.target.value })}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-center tabular-nums outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        <div className="relative shrink-0">
                          <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })}
                            className="h-9 w-20 pl-3 pr-8 bg-white border border-zinc-200 rounded-md text-xs font-semibold appearance-none outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer">
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-zinc-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                    
                  <Field label="Teacher" type="select" required value={form.teacher_id}
                    onChange={v => setForm({ ...form, teacher_id: v })}
                    options={[
                      { value: '', label: 'Select a teacher' },
                      ...teachers.map(t => ({ value: String(t.id), label: t.name }))
                    ]} />
                    
                  <Field label="Class" type="select" value={form.class_id}
                    onChange={v => setForm({ ...form, class_id: v })}
                    options={[
                      { value: '', label: 'All Classes' },
                      ...classes.map(c => ({ value: String(c.id), label: classLabel(c) }))
                    ]} />

                  <Field label="Subject Focus" required placeholder="e.g. Science Performance" value={form.subject_focus}
                    onChange={v => setForm({ ...form, subject_focus: v })} />
                </div>

                <Field label="Meeting Link (Video Call)" type="url" placeholder="https://meet.google.com/..." value={form.meeting_link}
                  onChange={v => setForm({ ...form, meeting_link: v })} />

                <Field label="Additional Notes" type="textarea" placeholder="Discussion points..." value={form.notes}
                  onChange={v => setForm({ ...form, notes: v })} />

                {editingMeeting && (
                  <Field label="Status" type="select" value={form.status}
                    onChange={v => setForm({ ...form, status: v })}
                    options={[
                      { value: 'Scheduled', label: 'Scheduled' },
                      { value: 'Completed', label: 'Completed' }
                    ]} />
                )}
              </div>

              <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={saving}
                  className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">
                  {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
                  {saving ? 'Saving...' : (editingMeeting ? 'Save Changes' : 'Schedule Meeting')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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