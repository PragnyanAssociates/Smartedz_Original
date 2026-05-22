import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { 
  Users, Calendar, Clock, GraduationCap, Target, 
  Video, Edit, Trash2, Search, X, Link as LinkIcon, Plus, Loader2
} from 'lucide-react';

export default function TeacherAdminPTM({ canManage = true }) {
  const { user } = useAuth();
  
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  
  // Data for dropdowns
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    meeting_datetime: '', teacher_id: '', class_id: '', 
    subject_focus: '', status: 'Scheduled', notes: '', meeting_link: ''
  };
  const [form, setForm] = useState(emptyForm);

  // --- Load PTM list ---
  const loadMeetings = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ptm/${user.institutionId}`);
      const d = await res.json();
      setMeetings(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  // --- Load Teachers & Classes for the modal ---
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
    if (!query.trim()) return meetings;
    const q = query.toLowerCase();
    return meetings.filter(m => 
      (m.teacher_name || '').toLowerCase().includes(q) ||
      (m.className || '').toLowerCase().includes(q) ||
      (m.subject_focus || '').toLowerCase().includes(q)
    );
  }, [query, meetings]);

  const classLabel = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;

  // --- Modal Handlers ---
  const openCreate = () => {
    setEditingMeeting(null);
    const now = new Date();
    const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    setForm({ ...emptyForm, meeting_datetime: localNow });
    setIsModalOpen(true);
  };

  const openEdit = (m) => {
    setEditingMeeting(m);
    const dt = new Date(m.meeting_datetime);
    const localDt = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    
    setForm({
      meeting_datetime: localDt,
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
    if (!form.meeting_datetime || !form.teacher_id || !form.subject_focus) {
      return alert("Please fill in Date, Teacher, and Focus.");
    }
    setSaving(true);
    try {
      const formattedDate = form.meeting_datetime.replace('T', ' ') + ':00';
      const payload = {
        ...form,
        meeting_datetime: formattedDate,
        institutionId: user.institutionId,
        class_id: form.class_id ? parseInt(form.class_id, 10) : null,
        teacher_id: parseInt(form.teacher_id, 10),
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
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="text-blue-600" size={28} />
          PTM Schedule
        </h2>
        <p className="text-slate-500 font-medium mt-1">
          Manage and schedule Parent-Teacher Meetings.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search meetings…"
            className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 w-full sm:w-72 shadow-sm" />
        </div>
        {canManage && (
          <button onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 transition-all">
            <Plus size={18} /> Schedule Meeting
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No meetings found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map(item => {
            const meetingDate = new Date(item.meeting_datetime);
            const isCompleted = item.status === 'Completed';
            const isJoinable = item.status === 'Scheduled' && item.meeting_link;

            return (
              <div key={item.id} className={`bg-white rounded-3xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 border-l-4 ${isCompleted ? 'border-emerald-500' : 'border-blue-500'}`}>
                
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-slate-50">
                  <div className="flex items-center gap-4">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                      <Users size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-slate-800 truncate leading-tight">{item.teacher_name || 'N/A'}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Parent-Teacher Meeting</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {isJoinable && (
                      <button onClick={() => handleJoinMeeting(item.meeting_link)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-sm mr-2 text-xs">
                        <Video size={14} /> <span className="hidden sm:inline">Join</span>
                      </button>
                    )}
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(item)} className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(item)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Body */}
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</span>
                      <span className="text-sm font-bold text-slate-700">{meetingDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-slate-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</span>
                      <span className="text-sm font-bold text-slate-700">{meetingDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap size={16} className="text-slate-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class</span>
                      <span className="text-sm font-bold text-slate-700">{item.className ? `${item.className}${item.section ? ` - ${item.section}` : ''}` : 'All Classes'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target size={16} className="text-slate-400" /> 
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Focus</span>
                      <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{item.subject_focus || 'General'}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Notes & Status */}
                <div className="bg-slate-50 p-6 mt-auto flex flex-col gap-4 rounded-b-3xl">
                  {item.notes && (
                    <div className="text-sm text-slate-600 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                      <span className="font-bold block mb-1">Notes:</span>
                      {item.notes}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.status}
                    </span>
                    
                    {item.meeting_link && !isCompleted && !isJoinable && (
                      <div className="flex items-center gap-2 text-sm">
                        <LinkIcon size={14} className="text-slate-400" />
                        <button onClick={() => handleJoinMeeting(item.meeting_link)} className="text-blue-600 hover:underline font-bold truncate">
                          Join Link
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---- MODAL ---- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-6 text-slate-800">
              {editingMeeting ? 'Edit Meeting' : 'Schedule Meeting'}
            </h2>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Date & Time" type="datetime-local" required value={form.meeting_datetime}
                  onChange={v => setForm({ ...form, meeting_datetime: v })} />
                  
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

              <button type="submit" disabled={saving}
                className="w-full bg-slate-900 hover:bg-blue-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black uppercase tracking-widest mt-4 transition-all shadow-xl flex justify-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Saving...' : (editingMeeting ? 'Save Changes' : 'Schedule Meeting')}
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
  const base = "w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/10 text-sm font-medium";
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