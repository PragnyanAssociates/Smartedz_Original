import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Eye, Loader2, ArrowLeft, CalendarDays,
  Clock, MapPin, AlertTriangle, Star, ChevronDown
} from 'lucide-react';

// =====================================================================
//  SchedulesManager - full CRUD for Exam Schedules
// =====================================================================

// Manual time entry helpers
const parse24to12 = (t24) => {
  if (!t24) return { time: '09:00', period: 'AM' };
  // Supports formats like "09:00" or "14:30"
  const [hStr, mStr] = t24.split(':');
  let hh = parseInt(hStr, 10);
  const period = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return { time: `${String(hh).padStart(2, '0')}:${mStr || '00'}`, period };
};

const joinTo12String = (t, p) => {
  if (!t || !t.includes(':')) return `09:00 ${p}`;
  let [h, m] = t.split(':');
  return `${String(h).padStart(2, '0')}:${(m || '00').padEnd(2, '0').slice(0, 2)} ${p}`;
};

const emptyInternalRow = () => ({ 
  date: '', 
  subject: '', 
  time_from: '09:00', 
  from_period: 'AM', 
  time_to: '12:00', 
  to_period: 'PM', 
  room: '' 
});
const emptyExternalRow = () => ({ examName: '', fromDate: '', toDate: '' });
const emptySpecialRow  = () => ({ type: 'special', mainText: '', subText: '' });

const fmtDDMMYYYY = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

export default function SchedulesManager({ canManage, activeYearName = '' }) {
  const { user } = useAuth();

  // ------------ data state ----------------
  const [schedules, setSchedules] = useState([]);
  const [classes, setClasses]     = useState([]);
  const [loading, setLoading]     = useState(true);

  // ------------ view state ----------------
  const [view, setView] = useState('list');   
  const [selected, setSelected] = useState(null);

  // ------------ filters -------------------
  const [activeTab, setActiveTab] = useState('Internal');
  const [filterClass, setFilterClass] = useState('all');

  // ------------ modal state ---------------
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);

  const [form, setForm] = useState({
    title: '', subtitle: '', exam_type: 'Internal',
    class_id: '', section: '',
    rows: [emptyInternalRow()]
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, dataRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/exam-schedules/${user.institutionId}`),
        fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`)
      ]);
      const schedData = await schedRes.json();
      const aggData   = await dataRes.json();
      setSchedules(Array.isArray(schedData) ? schedData : []);
      setClasses(aggData.classes || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return schedules.filter(s => {
      if (s.exam_type !== activeTab) return false;
      if (filterClass === 'all') return true;
      return String(s.class_id) === String(filterClass);
    });
  }, [schedules, activeTab, filterClass]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      title: '',
      subtitle: activeYearName || '',
      exam_type: 'Internal',
      class_id: '', section: '',
      rows: [emptyInternalRow()]
    });
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    const rows = (s.schedule_data || []).map(r => {
      if (r.type === 'special') return { ...r };
      if (s.exam_type === 'External') return { ...r };
      
      const [fromPart = '', toPart = ''] = (r.time || '').split('-').map(x => x.trim());
      // Handle existing strings like "09:00 AM"
      const fromParsed = parseExisting12h(fromPart);
      const toParsed = parseExisting12h(toPart);

      return {
        date: r.date || '',
        subject: r.subject || '',
        time_from: fromParsed.time,
        from_period: fromParsed.period,
        time_to: toParsed.time,
        to_period: toParsed.period,
        room: r.room || r.block || ''
      };
    });
    setForm({
      title: s.title || '',
      subtitle: activeYearName || s.subtitle || '',
      exam_type: s.exam_type || 'Internal',
      class_id: s.class_id ? String(s.class_id) : '',
      section: s.section || '',
      rows: rows.length ? rows : [s.exam_type === 'External' ? emptyExternalRow() : emptyInternalRow()]
    });
    setShowModal(true);
  };

  // Helper to parse stored "09:00 AM" back into state
  function parseExisting12h(str) {
    if (!str) return { time: '09:00', period: 'AM' };
    const m = str.match(/(\d{1,2}:\d{2})\s*(AM|PM)/i);
    if (!m) return { time: '09:00', period: 'AM' };
    return { time: m[1], period: m[2].toUpperCase() };
  }

  const handleTypeChange = (newType) => {
    setForm(f => ({
      ...f,
      exam_type: newType,
      rows: [newType === 'External' ? emptyExternalRow() : emptyInternalRow()]
    }));
  };

  const addRow = (special = false) => {
    setForm(f => ({
      ...f,
      rows: [...f.rows, special ? emptySpecialRow()
                        : (f.exam_type === 'External' ? emptyExternalRow() : emptyInternalRow())]
    }));
  };

  const removeRow = (idx) => {
    setForm(f => ({ ...f, rows: f.rows.filter((_, i) => i !== idx) }));
  };

  const updateRow = (idx, field, value) => {
    setForm(f => ({
      ...f,
      rows: f.rows.map((r, i) => i === idx ? { ...r, [field]: value } : r)
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) return alert('Title is required.');
    if (!form.class_id) return alert('Pick a class.');
    if (form.rows.length === 0) return alert('Add at least one row.');

    setSaving(true);
    try {
      const payloadRows = form.rows.map(r => {
        if (r.type === 'special') return { type: 'special', mainText: r.mainText, subText: r.subText };
        if (form.exam_type === 'External') {
          return {
            examName: r.examName,
            fromDate: fmtDDMMYYYY(r.fromDate),
            toDate:   fmtDDMMYYYY(r.toDate)
          };
        }
        return {
          date: fmtDDMMYYYY(r.date),
          subject: r.subject,
          time: `${joinTo12String(r.time_from, r.from_period)} - ${joinTo12String(r.time_to, r.to_period)}`,
          room: r.room
        };
      });

      const body = {
        institutionId: user.institutionId,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        exam_type: form.exam_type,
        class_id: parseInt(form.class_id, 10),
        section: form.section.trim() || null,
        schedule_data: payloadRows,
        created_by: user.id
      };

      const url = editing
        ? `${API_BASE_URL}/admin/exam-schedules/${editing.id}`
        : `${API_BASE_URL}/admin/exam-schedules`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setShowModal(false);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete "${s.title}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exam-schedules/${s.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      load();
    } catch (e) { alert(e.message); }
  };

  if (view === 'detail' && selected) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <button onClick={() => setView('list')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="size-4" /> Back to schedules
        </button>
        <ScheduleDetailView schedule={selected} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="inline-flex bg-zinc-100/80 p-1 rounded-md shrink-0 w-full sm:w-auto overflow-x-auto custom-scrollbar">
          {['Internal', 'External'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                activeTab === t ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              {t === 'Internal' ? 'School Exams' : 'Govt Schedule'}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center w-full sm:w-auto">
          <div className="relative w-full sm:w-48">
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors">
              <option value="all">All classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.className}{c.section ? ` - ${c.section}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {canManage && (
            <button onClick={openAdd}
              className="h-9 bg-primary hover:bg-primary/90 text-white px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0">
              <Plus className="size-4" /> Create Schedule
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <Loader2 className="animate-spin size-6 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <CalendarDays className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No {activeTab.toLowerCase()} schedules yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-zinc-50/50">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Title</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Class</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Created By</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-zinc-50/60 transition-colors group">
                  <td className="px-5 py-4 min-w-[200px]">
                    <div className="font-medium text-zinc-900 text-sm truncate">{s.title}</div>
                    {s.subtitle && <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{s.subtitle}</div>}
                  </td>
                  <td className="px-5 py-4 text-sm text-zinc-700 whitespace-nowrap">
                    {s.className ? `${s.className}${s.section ? ` - ${s.section}` : ''}` : <span className="italic text-zinc-400">-</span>}
                  </td>
                  <td className="px-5 py-4 text-sm text-zinc-500 whitespace-nowrap">{s.created_by_name || '-'}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setSelected(s); setView('detail'); }}
                        className="p-1.5 text-zinc-400 hover:text-primary hover:bg-primary/10 rounded-md transition-colors" title="View">
                        <Eye className="size-4" />
                      </button>
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(s)}
                            className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors" title="Edit">
                            <Edit className="size-4" />
                          </button>
                          <button onClick={() => handleDelete(s)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                            <Trash2 className="size-4" />
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

      {showModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-5xl max-h-[92vh] flex flex-col shadow-xl">

            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <h2 className="text-lg font-semibold text-zinc-900">
                {editing ? 'Edit Schedule' : 'Create Schedule'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                <X className="size-5 shrink-0" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Title" required>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Final Term Exam" className={inputCls} />
                </FormField>
                <FormField label="Academic Year">
                  <input value={form.subtitle} readOnly tabIndex={-1}
                    placeholder="Set an active academic year under Academics"
                    className={`${inputCls} bg-zinc-50 text-zinc-600 cursor-not-allowed`} />
                </FormField>
                <FormField label="Schedule Type">
                  <div className="relative">
                    <select value={form.exam_type} onChange={e => handleTypeChange(e.target.value)}
                      className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                      <option value="Internal">School Exam</option>
                      <option value="External">Govt Schedule</option>
                    </select>
                    <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </FormField>
                <FormField label="Class" required>
                  <div className="relative">
                    <select value={form.class_id}
                      onChange={e => setForm({ ...form, class_id: e.target.value })}
                      className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                      <option value="">Select class...</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.className}{c.section ? ` - ${c.section}` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </FormField>
              </div>

              <div className="border-t border-zinc-100 pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <h3 className="font-semibold text-zinc-800 text-sm">Schedule Rows</h3>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => addRow(false)} type="button"
                      className="flex-1 sm:flex-none h-8 px-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                      <Plus className="size-3.5" /> Add Row
                    </button>
                    <button onClick={() => addRow(true)} type="button"
                      className="flex-1 sm:flex-none h-8 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                      <Star className="size-3.5" /> Special Row
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {form.rows.map((r, i) => (
                    <div key={i} className="bg-zinc-50/50 ring-1 ring-black/5 rounded-lg p-4 relative group">
                      <button onClick={() => removeRow(i)} type="button"
                        className="absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-red-500 rounded-md transition-colors sm:opacity-0 sm:group-hover:opacity-100" title="Remove">
                        <X className="size-4 shrink-0" />
                      </button>

                      {r.type === 'special' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-6">
                          <FormField label="Main text">
                            <input value={r.mainText} onChange={e => updateRow(i, 'mainText', e.target.value)}
                              placeholder="e.g. Holiday" className={inputCls} />
                          </FormField>
                          <FormField label="Sub text">
                            <input value={r.subText} onChange={e => updateRow(i, 'subText', e.target.value)}
                              placeholder="Optional" className={inputCls} />
                          </FormField>
                        </div>
                      ) : form.exam_type === 'External' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-6">
                          <FormField label="Exam Name">
                            <input value={r.examName} onChange={e => updateRow(i, 'examName', e.target.value)}
                              placeholder="e.g. FA-1" className={inputCls} />
                          </FormField>
                          <FormField label="From">
                            <input type="date" value={r.fromDate}
                              onChange={e => updateRow(i, 'fromDate', e.target.value)} className={inputCls} />
                          </FormField>
                          <FormField label="To">
                            <input type="date" value={r.toDate}
                              onChange={e => updateRow(i, 'toDate', e.target.value)} className={inputCls} />
                          </FormField>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 pr-6 items-end">
                          <FormField label="Date" className="lg:col-span-3">
                            <input type="date" value={r.date}
                              onChange={e => updateRow(i, 'date', e.target.value)} className={inputCls} />
                          </FormField>

                          <FormField label="Subject" className="lg:col-span-2">
                            <input value={r.subject} onChange={e => updateRow(i, 'subject', e.target.value)}
                              placeholder="Maths" className={inputCls} />
                          </FormField>

                          <FormField label="Time" className="lg:col-span-5">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1">
                                <input type="text" value={r.time_from} placeholder="09:00"
                                  onChange={e => updateRow(i, 'time_from', e.target.value)}
                                  className="h-9 w-20 bg-white border border-zinc-200 rounded-md text-center text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/20" />
                                <div className="relative">
                                  <select value={r.from_period} onChange={e => updateRow(i, 'from_period', e.target.value)}
                                    className="h-9 w-16 pl-2 pr-6 bg-white border border-zinc-200 rounded-md text-[10px] font-bold appearance-none outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer">
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-zinc-400 pointer-events-none" />
                                </div>
                              </div>
                              <span className="text-zinc-400 text-xs">-</span>
                              <div className="flex items-center gap-1">
                                <input type="text" value={r.time_to} placeholder="12:00"
                                  onChange={e => updateRow(i, 'time_to', e.target.value)}
                                  className="h-9 w-20 bg-white border border-zinc-200 rounded-md text-center text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/20" />
                                <div className="relative">
                                  <select value={r.to_period} onChange={e => updateRow(i, 'to_period', e.target.value)}
                                    className="h-9 w-16 pl-2 pr-6 bg-white border border-zinc-200 rounded-md text-[10px] font-bold appearance-none outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer">
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-zinc-400 pointer-events-none" />
                                </div>
                              </div>
                            </div>
                          </FormField>

                          <FormField label="Room" className="lg:col-span-2">
                            <input value={r.room} onChange={e => updateRow(i, 'room', e.target.value)}
                              placeholder="e.g. 5" className={inputCls} />
                          </FormField>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50">
              <button onClick={() => setShowModal(false)} disabled={saving} type="button"
                className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} type="button"
                className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors min-w-[120px]">
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Schedule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScheduleDetailView({ schedule }) {
  const isExternal = schedule.exam_type === 'External';
  const rows = schedule.schedule_data || [];

  const dates = useMemo(() => {
    const real = rows.filter(r => r.type !== 'special');
    if (real.length === 0) return { start: null, end: null };
    if (isExternal) return { start: real[0].fromDate, end: real[real.length - 1].toDate };
    return { start: real[0].date, end: real[real.length - 1].date };
  }, [rows, isExternal]);

  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col">
      <div className="p-6 border-b border-zinc-100 text-center bg-zinc-50/50">
        <div className="inline-flex size-12 rounded-lg bg-primary/10 items-center justify-center mb-4 ring-1 ring-primary/20">
          <CalendarDays className="text-primary size-6" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-900">{schedule.title}</h2>
        <div className="mt-2.5">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md ring-1 ${
            isExternal ? 'bg-purple-50 text-purple-700 ring-purple-600/20' : 'bg-rose-50 text-rose-700 ring-rose-600/20'
          }`}>
            {isExternal ? 'Govt Schedule' : 'School Exam'}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-zinc-600">
          {schedule.className && (
            <span className="font-medium bg-white ring-1 ring-zinc-200 px-2 py-0.5 rounded text-zinc-700">
              {schedule.className}{schedule.section ? ` - ${schedule.section}` : ''}
            </span>
          )}
          {schedule.subtitle && <span className="text-zinc-500">{schedule.subtitle}</span>}
          {dates.start && (
            <span className="flex items-center gap-1.5 text-zinc-500">
              <span className="font-medium text-zinc-700">{dates.start}</span>
              {dates.end && dates.end !== dates.start && (
                <>
                  <span className="text-zinc-300">|</span>
                  <span className="font-medium text-zinc-700">{dates.end}</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead className="bg-white">
            <tr>
              {isExternal ? (
                <>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Exam Name</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">From</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">To</th>
                </>
              ) : (
                <>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Date</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Subject</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Time</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Room</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r, i) => {
              if (r.type === 'special') {
                return (
                  <tr key={i} className="bg-primary/5">
                    <td colSpan={isExternal ? 3 : 4} className="px-5 py-4 text-center">
                      <span className="font-semibold text-primary block">{r.mainText}</span>
                      {r.subText && <span className="text-xs text-primary/70 mt-0.5 block">{r.subText}</span>}
                    </td>
                  </tr>
                );
              }
              if (isExternal) {
                return (
                  <tr key={i} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-4 text-sm font-semibold text-zinc-900 whitespace-nowrap">{r.examName}</td>
                    <td className="px-5 py-4 text-sm text-zinc-600 whitespace-nowrap">{r.fromDate || '-'}</td>
                    <td className="px-5 py-4 text-sm text-zinc-600 whitespace-nowrap">{r.toDate || '-'}</td>
                  </tr>
                );
              }
              return (
                <tr key={i} className="hover:bg-zinc-50/60 transition-colors">
                  <td className="px-5 py-4 text-sm font-semibold text-zinc-900 whitespace-nowrap">{r.date}</td>
                  <td className="px-5 py-4 text-sm text-zinc-700 whitespace-nowrap">{r.subject}</td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center text-[11px] font-medium text-zinc-600">
                      <Clock className="size-3.5 mr-1.5 text-zinc-400" /> {r.time}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center text-[11px] font-medium text-zinc-600">
                      <MapPin className="size-3.5 mr-1.5 text-zinc-400" /> Room {r.room || r.block || '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputCls = 'h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors';

function FormField({ label, required, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
        {label}{required && <span className="text-accent">*</span>}
      </label>
      {children}
    </div>
  );
}