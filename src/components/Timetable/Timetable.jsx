import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import { CalendarDays, Clock, LayoutGrid, Plus, Trash2, Save, Coffee, AlertCircle, ChevronDown } from 'lucide-react';

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
        <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!data.academic_year_id) {
    return (
      <div className="p-4 sm:p-8 max-w-[1440px] w-full mx-auto">
        <div className="ring-1 ring-black/5 bg-white rounded-lg p-6 sm:p-10 text-center max-w-2xl mx-auto flex flex-col items-center">
          <AlertCircle className="text-accent mb-3 size-10 shrink-0" />
          <h2 className="text-lg font-semibold text-zinc-900">No Active Academic Year</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-[50ch] leading-relaxed">
            The timetable belongs to an academic year. Open <strong>Manage Logins → Academics</strong>,
            create a year and click <em>Set as Active</em>, then come back.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'setup', label: 'Days & Periods',  icon: Clock },
    { id: 'grid',  label: 'Class Timetable', icon: LayoutGrid }
  ];

  const tabProps = { data, fetchData, user, canEdit };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto animate-in fade-in duration-700">
      {/* 1. Page Header */}
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Timetable</h1>
        <p className="text-sm text-zinc-500 max-w-[56ch]">
          Configure the school's weekly schedule once, then fill in each class's grid.
        </p>
      </header>

      {/* Segmented Tabs - Horizontally Scrollable on Mobile */}
      <div className="flex items-center gap-2 mb-6 sm:mb-8 border-b border-zinc-200 pb-4 overflow-x-auto custom-scrollbar w-full">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === t.id 
                ? 'bg-primary text-white' 
                : 'text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
            }`}
          >
            <t.icon className="size-3.5 shrink-0" /> {t.label}
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
      body: JSON.stringify({ institutionId: user.institutionId, academic_year_id: data.academic_year_id, days })
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
    if (!window.confirm('Saving periods will clear all timetable entries that do not match the new period IDs. Continue?')) return;
    
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      
      {/* Column 1: Working Days */}
      <div className="lg:col-span-5 ring-1 ring-black/5 bg-white rounded-lg flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
          <CalendarDays className="size-4 text-primary shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Working Days</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">Tick the days your school operates.</p>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-2">
          {days.map(d => (
            <label key={d.day_index}
              className={`flex items-center gap-3 p-3 rounded-md ring-1 transition-all cursor-pointer ${
                d.is_working ? 'bg-primary/5 ring-primary/30' : 'bg-zinc-50 ring-black/5 hover:ring-zinc-200'
              } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <input 
                type="checkbox" 
                checked={d.is_working}
                onChange={() => toggleDay(d.day_index)}
                disabled={!canEdit}
                className="size-4 accent-primary cursor-pointer rounded border-zinc-300 text-primary focus:ring-primary" 
              />
              <span className="text-sm font-medium text-zinc-700">{d.day_name}</span>
              {d.is_working && <span className="ml-auto text-[10px] font-semibold text-primary uppercase tracking-wider">Working</span>}
            </label>
          ))}
          
          {canEdit && (
            <button onClick={saveDays} disabled={savingDays}
              className="mt-4 w-full bg-zinc-50 text-zinc-700 border border-zinc-200 hover:bg-zinc-100 py-2.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
              <Save className="size-3.5 shrink-0" /> {savingDays ? 'Saving...' : 'Save Days'}
            </button>
          )}
        </div>
      </div>

      {/* Column 2: Periods */}
      <div className="lg:col-span-7 ring-1 ring-black/5 bg-white rounded-lg flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
          <Clock className="size-4 text-primary shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Periods & Breaks</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">The bell schedule — applied globally to all classes.</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {periods.map((p, idx) => (
              <div key={idx} className={`flex flex-col sm:flex-row gap-3 p-3 rounded-md ring-1 items-start sm:items-center ${
                p.is_break ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-zinc-200'
              }`}>
                <div className="flex justify-between items-center w-full sm:w-8 sm:justify-center text-zinc-400 shrink-0">
                  <div className="flex items-center gap-2">
                    {p.is_break ? <Coffee className="size-4 text-amber-600" /> : <span className="text-sm font-semibold tabular-nums text-zinc-500">{idx + 1}</span>}
                    <span className="sm:hidden text-xs font-semibold uppercase text-zinc-500 tracking-wider">
                      {p.is_break ? 'Break' : 'Period'}
                    </span>
                  </div>
                  {canEdit && (
                    <button onClick={() => removePeriod(idx)} className="sm:hidden text-zinc-400 hover:text-accent p-1 transition-colors">
                      <Trash2 className="size-4 shrink-0" />
                    </button>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full flex-1">
                  <input 
                    placeholder="Name" disabled={!canEdit}
                    value={p.name}
                    onChange={e => updatePeriod(idx, 'name', e.target.value)}
                    className="h-9 w-full rounded border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-60" 
                  />
                  <div className="flex gap-2 w-full sm:w-auto shrink-0">
                    <input 
                      type="time" disabled={!canEdit}
                      value={p.start_time}
                      onChange={e => updatePeriod(idx, 'start_time', e.target.value)}
                      className="h-9 w-full sm:w-32 rounded border border-zinc-200 bg-white px-3 text-sm tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-60" 
                    />
                    <input 
                      type="time" disabled={!canEdit}
                      value={p.end_time}
                      onChange={e => updatePeriod(idx, 'end_time', e.target.value)}
                      className="h-9 w-full sm:w-32 rounded border border-zinc-200 bg-white px-3 text-sm tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-60" 
                    />
                  </div>
                </div>

                {canEdit && (
                  <button onClick={() => removePeriod(idx)} className="hidden sm:flex p-1.5 justify-center text-zinc-400 hover:text-accent transition-colors shrink-0">
                    <Trash2 className="size-4 shrink-0" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {canEdit && (
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-100">
              <div className="flex gap-2 w-full sm:flex-1">
                <button onClick={() => addPeriod(false)}
                  className="flex-1 text-zinc-700 h-9 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 flex items-center justify-center gap-1.5 transition-colors">
                  <Plus className="size-3.5 shrink-0" /> Add Period
                </button>
                <button onClick={() => addPeriod(true)}
                  className="flex-1 text-amber-700 bg-amber-50 h-9 border border-amber-200 rounded-md text-xs font-medium hover:bg-amber-100 flex items-center justify-center gap-1.5 transition-colors">
                  <Coffee className="size-3.5 shrink-0" /> Add Break
                </button>
              </div>
              <button onClick={savePeriods} disabled={savingPeriods}
                className="bg-primary text-white h-9 px-6 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0 shadow-sm">
                <Save className="size-3.5 shrink-0" /> {savingPeriods ? 'Saving...' : 'Save Periods'}
              </button>
            </div>
          )}
        </div>
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
      body: JSON.stringify({ institutionId: user.institutionId, academic_year_id: data.academic_year_id, class_id: selectedClassId, entries })
    });
    if (res.ok) { alert('Timetable saved.'); fetchData(); }
    else alert('Failed to save.');
    setSaving(false);
  };

  const classLabel = (c) => `${c.className}${c.section ? ' - ' + c.section : ''}`;

  if (workingDays.length === 0 || sortedPeriods.length === 0) {
    return (
      <div className="ring-1 ring-black/5 bg-white rounded-lg p-6 sm:p-10 text-center flex flex-col items-center">
        <AlertCircle className="text-accent mb-3 size-10 shrink-0" />
        <h2 className="text-sm font-semibold text-zinc-900">Set Up the Schedule First</h2>
        <p className="text-xs text-zinc-500 mt-1 max-w-[50ch]">
          Go to <strong>Days & Periods</strong> and configure the working days and bell schedule before filling in class timetables.
        </p>
      </div>
    );
  }

  if (data.classes.length === 0) {
    return (
      <div className="ring-1 ring-black/5 bg-white rounded-lg p-6 sm:p-10 text-center flex flex-col items-center">
        <AlertCircle className="text-accent mb-3 size-10 shrink-0" />
        <h2 className="text-sm font-semibold text-zinc-900">No Classes Created</h2>
        <p className="text-xs text-zinc-500 mt-1 max-w-[50ch]">
          Create classes first in <strong>Manage Logins → Classes</strong>, then return here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-end">
        <div className="flex flex-col gap-1.5 w-full sm:w-auto">
          <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Target Class</label>
          <div className="relative w-full sm:w-48">
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none transition-colors">
              {data.classes.map(c => (
                <option key={c.id} value={c.id}>{classLabel(c)}</option>
              ))}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        
        {canEdit && (
          <button onClick={handleSave} disabled={saving}
            className="bg-primary text-white h-9 px-6 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto shadow-sm">
            <Save className="size-3.5 shrink-0" /> {saving ? 'Saving...' : 'Save Timetable'}
          </button>
        )}
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-x-auto custom-scrollbar flex flex-col">
        <table className="w-full text-left border-collapse min-w-[880px]">
          <thead>
            <tr className="bg-white">
              <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-r border-zinc-100 sticky left-0 bg-white z-20 w-32 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                Day / Period
              </th>
              {sortedPeriods.map(p => (
                <th key={p.id} className="px-3 py-3 border-b border-r border-zinc-100 text-center min-w-[160px] bg-zinc-50/50">
                  <div className={`text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${p.is_break ? 'text-amber-600' : 'text-zinc-700'}`}>
                    {p.name}
                  </div>
                  <div className="text-[9px] font-medium text-zinc-400 mt-0.5 tabular-nums whitespace-nowrap">
                    {fmtTime(p.start_time)} – {fmtTime(p.end_time)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {workingDays.map(d => (
              <tr key={d.id} className="hover:bg-zinc-50/60 transition-colors">
                <td className="px-5 py-4 text-sm font-medium text-zinc-900 sticky left-0 bg-white z-10 border-r border-zinc-100 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                  {d.day_name}
                </td>
                {sortedPeriods.map(p => {
                  const key = `${d.id}-${p.id}`;
                  const cell = cells[key] || { subject_id: '', teacher_id: '', room_no: '' };
                  
                  if (p.is_break) {
                    return (
                      <td key={p.id} className="p-4 bg-amber-50/50 text-center border-r border-zinc-100">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 ring-1 ring-amber-600/10 whitespace-nowrap">
                          <Coffee className="size-3 shrink-0" /> Break
                        </span>
                      </td>
                    );
                  }

                  const eligibleTeachers = teachersForSubject(cell.subject_id);
                  return (
                    <td key={p.id} className="p-2 sm:p-3 border-r border-zinc-100 align-top">
                      <div className="flex flex-col gap-1.5">
                        <div className="relative">
                          <select
                            disabled={!canEdit}
                            value={cell.subject_id}
                            onChange={e => updateCell(d.id, p.id, 'subject_id', e.target.value)}
                            className="h-8 w-full rounded border border-zinc-200 bg-zinc-50 pl-2 pr-6 text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 disabled:opacity-60 appearance-none cursor-pointer">
                            <option value="">Select Subject</option>
                            {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <ChevronDown className="size-3 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        <div className="relative">
                          <select
                            disabled={!canEdit}
                            value={cell.teacher_id}
                            onChange={e => updateCell(d.id, p.id, 'teacher_id', e.target.value)}
                            className="h-8 w-full rounded border border-zinc-200 bg-zinc-50 pl-2 pr-6 text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 disabled:opacity-60 appearance-none cursor-pointer">
                            <option value="">
                              {cell.subject_id ? (eligibleTeachers.length ? 'Select Teacher' : 'No teacher') : 'Select Teacher'}
                            </option>
                            {eligibleTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                          <ChevronDown className="size-3 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        <input
                          disabled={!canEdit}
                          placeholder="Room (e.g. 101)"
                          value={cell.room_no}
                          onChange={e => updateCell(d.id, p.id, 'room_no', e.target.value)}
                          className="h-8 w-full rounded border border-zinc-200 bg-white px-2 text-[11px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 disabled:opacity-60" 
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 rounded-md p-4 flex gap-3 text-[11px] text-blue-700 leading-relaxed">
        <AlertCircle className="size-4 shrink-0 text-blue-500 mt-0.5" />
        <p>
          <strong className="font-semibold text-blue-900">Tip:</strong> Pick a subject first — the teacher dropdown will filter to show only teachers who are assigned to that subject. Manage subjects in <em>Manage Logins → Subjects</em>.
        </p>
      </div>
    </div>
  );
}