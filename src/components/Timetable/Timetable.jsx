import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  CalendarDays, Clock, LayoutGrid, Plus, Trash2, Save,
  Coffee, AlertCircle
} from 'lucide-react';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hh = parseInt(h, 10);
  const mm = m || '00';
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${mm} ${ampm}`;
};

export default function Timetable() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('Timetable', 'edit');

  const [data, setData] = useState({
    academic_year_id: null,
    days: [], periods: [], entries: [],
    classes: [], teachers: [], subjects: [],
    teacherSubjects: {}
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('setup');

  const fetchData = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/timetable/${user.institutionId}`);
      const json = await res.json();
      setData(json);
    } catch (e) { console.error('Timetable fetch error:', e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data.academic_year_id) {
    return (
      <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center max-w-2xl mx-auto">
        <AlertCircle className="mx-auto text-amber-400 mb-3" size={42} />
        <h2 className="text-2xl font-black text-slate-800">No Active Academic Year</h2>
        <p className="text-slate-500 mt-2 font-medium">
          The timetable belongs to an academic year. Open <strong>Manage Logins → Academics</strong>,
          create a year and click <em>Set as Active</em>, then come back.
        </p>
      </div>
    );
  }

  const tabs = [
    { id: 'setup', label: 'Days & Periods',  icon: Clock },
    { id: 'grid',  label: 'Class Timetable', icon: LayoutGrid }
  ];

  const tabProps = { data, fetchData, user, canEdit };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Timetable</h2>
        <p className="text-slate-500 font-medium mt-1">
          Configure the school's weekly schedule once, then fill in each class's grid.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-bold text-sm transition-all ${
              activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
            }`}>
            <t.icon size={18} /> {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'setup' && <SetupTab {...tabProps} />}
        {activeTab === 'grid'  && <GridTab  {...tabProps} />}
      </div>
    </div>
  );
}


// =====================================================================
//  SUB-COMPONENT 1: SetupTab — Days + Periods
// =====================================================================
function SetupTab({ data, fetchData, user, canEdit }) {
  const [days, setDays] = useState(() => {
    return DAY_NAMES.map((name, idx) => {
      const existing = data.days.find(d => d.day_index === idx);
      return {
        day_index: idx,
        day_name:  existing?.day_name || name,
        is_working: existing ? !!existing.is_working : (idx < 5)
      };
    });
  });

  const [periods, setPeriods] = useState(() => {
    if (data.periods.length > 0) {
      return data.periods.map(p => ({
        period_index: p.period_index,
        name: p.name,
        start_time: (p.start_time || '').slice(0, 5),
        end_time:   (p.end_time   || '').slice(0, 5),
        is_break: !!p.is_break
      }));
    }
    return [{ period_index: 1, name: 'Period 1', start_time: '09:00', end_time: '09:45', is_break: false }];
  });

  const [savingDays, setSavingDays] = useState(false);
  const [savingPeriods, setSavingPeriods] = useState(false);

  const toggleDay = (idx) => {
    if (!canEdit) return;
    setDays(prev => prev.map(d => d.day_index === idx ? { ...d, is_working: !d.is_working } : d));
  };

  const saveDays = async () => {
    setSavingDays(true);
    const res = await fetch(`${API_BASE_URL}/admin/timetable/days`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institutionId: user.institutionId,
        academic_year_id: data.academic_year_id,
        days
      })
    });
    if (res.ok) { alert('Working days saved.'); fetchData(); }
    else alert('Failed to save days.');
    setSavingDays(false);
  };

  const addPeriod = (isBreak = false) => {
    const last = periods[periods.length - 1];
    const nextStart = last?.end_time || '09:00';
    setPeriods([...periods, {
      period_index: periods.length + 1,
      name: isBreak ? 'Lunch Break' : `Period ${periods.length + 1}`,
      start_time: nextStart,
      end_time: '',
      is_break: isBreak
    }]);
  };

  const updatePeriod = (idx, key, val) => {
    setPeriods(prev => prev.map((p, i) => i === idx ? { ...p, [key]: val } : p));
  };

  const removePeriod = (idx) => {
    setPeriods(prev => prev
      .filter((_, i) => i !== idx)
      .map((p, i) => ({ ...p, period_index: i + 1 })));
  };

  const savePeriods = async () => {
    for (const p of periods) {
      if (!p.name?.trim()) return alert('Every period needs a name.');
      if (!p.start_time || !p.end_time) return alert(`"${p.name}" needs both start and end time.`);
      if (p.start_time >= p.end_time) return alert(`"${p.name}" end time must be after start time.`);
    }
    if (periods.length === 0) return alert('Add at least one period.');
    if (!window.confirm('Saving periods will clear all timetable entries that don\'t match the new period IDs. Continue?')) return;
    setSavingPeriods(true);
    const res = await fetch(`${API_BASE_URL}/admin/timetable/periods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institutionId: user.institutionId,
        academic_year_id: data.academic_year_id,
        periods: periods.map((p, i) => ({ ...p, period_index: i + 1 }))
      })
    });
    if (res.ok) { alert('Periods saved.'); fetchData(); }
    else alert('Failed to save periods.');
    setSavingPeriods(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <CalendarDays size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">Working Days</h3>
            <p className="text-xs text-slate-400 font-medium">Tick the days your school operates.</p>
          </div>
        </div>

        <div className="space-y-2">
          {days.map(d => (
            <label key={d.day_index}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                d.is_working ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-transparent hover:border-slate-200'
              } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <input type="checkbox" checked={d.is_working}
                onChange={() => toggleDay(d.day_index)}
                disabled={!canEdit}
                className="w-5 h-5 accent-blue-600 cursor-pointer" />
              <span className="font-bold text-slate-700">{d.day_name}</span>
              {d.is_working && <span className="ml-auto text-[10px] font-black text-blue-600 uppercase tracking-widest">Working</span>}
            </label>
          ))}
        </div>

        {canEdit && (
          <button onClick={saveDays} disabled={savingDays}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-3 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2">
            <Save size={16} /> {savingDays ? 'Saving…' : 'Save Working Days'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <Clock size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">Periods & Breaks</h3>
            <p className="text-xs text-slate-400 font-medium">The bell schedule — same for every class.</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {periods.map((p, idx) => (
            <div key={idx} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-2xl border ${
              p.is_break ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="col-span-1 text-center text-slate-400">
                {p.is_break ? <Coffee size={16} /> : <span className="text-xs font-black">{idx + 1}</span>}
              </div>
              <input placeholder="Name" disabled={!canEdit}
                value={p.name}
                onChange={e => updatePeriod(idx, 'name', e.target.value)}
                className="col-span-4 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none disabled:opacity-60" />
              <input type="time" disabled={!canEdit}
                value={p.start_time}
                onChange={e => updatePeriod(idx, 'start_time', e.target.value)}
                className="col-span-3 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none disabled:opacity-60" />
              <input type="time" disabled={!canEdit}
                value={p.end_time}
                onChange={e => updatePeriod(idx, 'end_time', e.target.value)}
                className="col-span-3 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none disabled:opacity-60" />
              {canEdit && (
                <button onClick={() => removePeriod(idx)}
                  className="col-span-1 text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <>
            <div className="flex gap-2 mb-4">
              <button onClick={() => addPeriod(false)}
                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                <Plus size={14} /> Add Period
              </button>
              <button onClick={() => addPeriod(true)}
                className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                <Coffee size={14} /> Add Break
              </button>
            </div>
            <button onClick={savePeriods} disabled={savingPeriods}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-3 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
              <Save size={16} /> {savingPeriods ? 'Saving…' : 'Save Periods'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}


// =====================================================================
//  SUB-COMPONENT 2: GridTab — teacher dropdown filtered by subject
// =====================================================================
function GridTab({ data, fetchData, user, canEdit }) {
  const workingDays = useMemo(
    () => data.days.filter(d => d.is_working).sort((a, b) => a.day_index - b.day_index),
    [data.days]
  );
  const sortedPeriods = useMemo(
    () => [...data.periods].sort((a, b) => a.period_index - b.period_index),
    [data.periods]
  );

  const [selectedClassId, setSelectedClassId] = useState(data.classes[0]?.id || '');

  const initialMap = useMemo(() => {
    const map = {};
    data.entries
      .filter(e => String(e.class_id) === String(selectedClassId))
      .forEach(e => {
        map[`${e.day_id}-${e.period_id}`] = {
          subject_id: e.subject_id || '',
          teacher_id: e.teacher_id || '',
          room_no: e.room_no || ''
        };
      });
    return map;
  }, [data.entries, selectedClassId]);

  const [cells, setCells] = useState(initialMap);
  useEffect(() => { setCells(initialMap); }, [initialMap]);

  const [saving, setSaving] = useState(false);

  // Filter teachers by the subject chosen in the cell.
  const teachersForSubject = useCallback((subjectId) => {
    if (!subjectId) return data.teachers;
    const sid = parseInt(subjectId, 10);
    return data.teachers.filter(t => {
      const subs = data.teacherSubjects?.[t.id] || [];
      return subs.includes(sid);
    });
  }, [data.teachers, data.teacherSubjects]);

  const updateCell = (dayId, periodId, key, val) => {
    if (!canEdit) return;
    const k = `${dayId}-${periodId}`;
    setCells(prev => {
      const current = prev[k] || { subject_id: '', teacher_id: '', room_no: '' };
      const next = { ...current, [key]: val };
      if (key === 'subject_id' && next.teacher_id) {
        const sid = parseInt(val, 10);
        const subs = data.teacherSubjects?.[parseInt(next.teacher_id, 10)] || [];
        if (sid && !subs.includes(sid)) next.teacher_id = '';
      }
      return { ...prev, [k]: next };
    });
  };

  const handleSave = async () => {
    if (!selectedClassId) return;
    const entries = Object.entries(cells).map(([k, v]) => {
      const [day_id, period_id] = k.split('-').map(Number);
      return {
        day_id, period_id,
        subject_id: v.subject_id || null,
        teacher_id: v.teacher_id || null,
        room_no: v.room_no || null
      };
    });
    setSaving(true);
    const res = await fetch(`${API_BASE_URL}/admin/timetable/entries/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institutionId: user.institutionId,
        academic_year_id: data.academic_year_id,
        class_id: selectedClassId,
        entries
      })
    });
    if (res.ok) { alert('Timetable saved.'); fetchData(); }
    else alert('Failed to save.');
    setSaving(false);
  };

  const classLabel = (c) => `${c.className}${c.section ? ' - ' + c.section : ''}`;

  if (workingDays.length === 0 || sortedPeriods.length === 0) {
    return (
      <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center max-w-2xl mx-auto">
        <AlertCircle className="mx-auto text-amber-400 mb-3" size={42} />
        <h2 className="text-2xl font-black text-slate-800">Set Up the Schedule First</h2>
        <p className="text-slate-500 mt-2 font-medium">
          Go to <strong>Days & Periods</strong> and configure the working days and bell schedule before filling in class timetables.
        </p>
      </div>
    );
  }

  if (data.classes.length === 0) {
    return (
      <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center max-w-2xl mx-auto">
        <AlertCircle className="mx-auto text-amber-400 mb-3" size={42} />
        <h2 className="text-2xl font-black text-slate-800">No Classes Created</h2>
        <p className="text-slate-500 mt-2 font-medium">
          Create classes first in <strong>Manage Logins → Classes</strong>, then return here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 justify-between lg:items-center">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase">Class</label>
          <select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            className="bg-white border border-slate-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/10 min-w-[220px] font-bold">
            {data.classes.map(c => (
              <option key={c.id} value={c.id}>{classLabel(c)}</option>
            ))}
          </select>
        </div>
        {canEdit && (
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
            <Save size={16} /> {saving ? 'Saving…' : 'Save Timetable'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-x-auto custom-scrollbar">
        <table className="w-full text-left" style={{ minWidth: 880 }}>
          <thead>
            <tr className="bg-slate-50">
              <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest sticky left-0 bg-slate-50 z-10" style={{ minWidth: 110 }}>
                Day / Period
              </th>
              {sortedPeriods.map(p => (
                <th key={p.id} className={`p-4 text-center text-[10px] font-black uppercase tracking-widest border-l border-slate-100 ${
                  p.is_break ? 'bg-amber-50 text-amber-700' : 'text-slate-500'
                }`} style={{ minWidth: 160 }}>
                  <div>{p.name}</div>
                  <div className="text-[9px] font-bold text-slate-400 mt-0.5 tabular-nums">
                    {fmtTime(p.start_time)} – {fmtTime(p.end_time)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workingDays.map(d => (
              <tr key={d.id}>
                <td className="p-4 font-black text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-100">
                  {d.day_name}
                </td>
                {sortedPeriods.map(p => {
                  const key = `${d.id}-${p.id}`;
                  const cell = cells[key] || { subject_id: '', teacher_id: '', room_no: '' };
                  if (p.is_break) {
                    return (
                      <td key={p.id} className="p-4 bg-amber-50/40 text-center text-amber-700 font-bold text-xs uppercase tracking-widest border-l border-slate-100">
                        <Coffee size={16} className="inline mr-1" /> Break
                      </td>
                    );
                  }
                  const eligibleTeachers = teachersForSubject(cell.subject_id);
                  return (
                    <td key={p.id} className="p-2 border-l border-slate-100 align-top">
                      <div className="space-y-1.5">
                        <select
                          disabled={!canEdit}
                          value={cell.subject_id}
                          onChange={e => updateCell(d.id, p.id, 'subject_id', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs font-bold outline-none disabled:opacity-60">
                          <option value="">Subject</option>
                          {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select
                          disabled={!canEdit}
                          value={cell.teacher_id}
                          onChange={e => updateCell(d.id, p.id, 'teacher_id', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-60">
                          <option value="">
                            {cell.subject_id
                              ? (eligibleTeachers.length ? 'Teacher' : 'No teacher for subject')
                              : 'Teacher'}
                          </option>
                          {eligibleTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <input
                          disabled={!canEdit}
                          placeholder="Room"
                          value={cell.room_no}
                          onChange={e => updateCell(d.id, p.id, 'room_no', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-60" />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 font-medium">
        Tip: pick a subject first — the teacher dropdown will show only teachers who teach that subject.
        Manage subjects in <strong>Manage Logins → Subjects</strong>.
      </p>
    </div>
  );
}