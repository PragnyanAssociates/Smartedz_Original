import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import { CalendarDays, Clock, LayoutGrid, Plus, Trash2, Save, Coffee, AlertCircle, ChevronDown, Users, Search, GraduationCap, CalendarRange } from 'lucide-react';

// =====================================================================
//  HOW THIS MODULE WORKS
//  ---------------------------------------------------------------------
//  The whole timetable is anchored to the institution's ACTIVE academic
//  year. The backend resolves it via resolveYearId(); every read/write
//  is scoped to that year, so switching the active year under Academics
//  switches the timetable everyone sees.
//
//  Roles:
//   • Student / Teacher        -> read-only "My Timetable" (own schedule).
//   • Edit OR Delete perm      -> full manager view with three tabs:
//        [ Class Timetable ] [ Teachers Timetable ] [ Days & Periods ]
//   • Read-only (view perm)    -> "Class Timetable" tab only (disabled).
//
//  Setup flow (Days & Periods tab — now the LAST tab):
//   1. Tick the working days.
//   2. Define the bell schedule (periods + breaks). Times are entered
//      MANUALLY as HH:MM with an AM / PM dropdown — no native time
//      picker. Internally everything is stored in 24-hour "HH:MM" form
//      so it stays compatible with the grids and the personal view.
//   3. ONE "Save Days & Periods" button persists BOTH the working days
//      and the bell schedule together. Once saved the data is read back
//      from the backend, so it survives a page refresh.
//
//  Filling grids:
//   • Class Timetable   -> per class, pick subject + teacher (+ room).
//   • Teachers Timetable-> per teacher, pick class + subject (+ room).
//  Both write to the SAME shared timetable_entries table and warn on
//  teacher / class clashes before saving.
// =====================================================================

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

// Render a UTC audit timestamp (Railway stores UTC) as an IST date + time.
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

// --- 12h <-> 24h helpers for the manual time inputs -----------------
// 24h "HH:MM"  ->  { t12: "hh:mm", ap: "AM"|"PM" }
const split24 = (t) => {
  if (!t) return { t12: '', ap: 'AM' };
  const [h, m] = t.split(':');
  const hh = parseInt(h, 10);
  if (isNaN(hh)) return { t12: '', ap: 'AM' };
  const mm = String(m || '00').padStart(2, '0').slice(0, 2);
  const ap = hh >= 12 ? 'PM' : 'AM';
  const h12 = ((hh + 11) % 12) + 1;
  return { t12: `${String(h12).padStart(2, '0')}:${mm}`, ap };
};

// "hh:mm" (12h) + ap  ->  24h "HH:MM", or '' when invalid
const join24 = (t12, ap) => {
  if (!t12) return '';
  const m = String(t12).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  let hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return '';
  if (ap === 'PM' && hh !== 12) hh += 12;
  if (ap === 'AM' && hh === 12) hh = 0;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// =====================================================================
//  ACTIVE-YEAR BADGE — read-only context chip, identical to Attendance.
// =====================================================================
function YearBadge({ name }) {
  if (!name) return null;
  return (
    <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary/5 ring-1 ring-primary/15 text-primary text-xs font-semibold whitespace-nowrap self-start sm:self-auto">
      <CalendarRange className="size-3.5" /> Academic Year: {name}
    </div>
  );
}

// Shared hook: fetch the institution's ACTIVE academic year name (for the badge).
function useActiveYearName(user) {
  const [activeYearName, setActiveYearName] = useState('');
  useEffect(() => {
    if (!user?.institutionId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
        const data = await res.json();
        const list = data.academicYears || [];
        const active = list.find(y => y.isActive) || list[0];
        if (active) setActiveYearName(active.name || '');
      } catch (e) { console.error('academic year load:', e); }
    })();
  }, [user]);
  return activeYearName;
}

// =====================================================================
//  ENTRY POINT
// =====================================================================
export default function Timetable() {
  const { user } = useAuth();
  const { can, loading: permsLoading } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role.includes('student');
  const isTeacher = role.includes('teacher');
  const canEdit   = can('Timetable', 'edit');
  const canDelete = can('Timetable', 'delete');
  const canRead   = can('Timetable', 'read');

  const isManager = canEdit || canDelete;   // edit OR delete => can configure

  if (permsLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Students and teachers always get their own personal, read-only timetable.
  if (isStudent || isTeacher) {
    return <PersonalTimetable user={user} mode={isStudent ? 'student' : 'teacher'} />;
  }

  // Everyone else needs at least read access to view anything.
  if (!isManager && !canRead) {
    return (
      <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="ring-1 ring-black/5 bg-white rounded-lg p-6 sm:p-10 text-center max-w-2xl mx-auto flex flex-col items-center">
          <AlertCircle className="text-accent mb-3 size-10 shrink-0" />
          <h2 className="text-lg font-semibold text-zinc-900">No Access</h2>
          <p className="text-sm text-zinc-500 mt-1">You don't have permission to view the timetable.</p>
        </div>
      </div>
    );
  }

  return <AdminTimetable user={user} canEdit={canEdit} canDelete={canDelete} isManager={isManager} />;
}

// =====================================================================
//  ADMIN / MANAGER + READ-ONLY VIEWER VIEW
// =====================================================================
function AdminTimetable({ user, canEdit, canDelete, isManager }) {
  const [data, setData] = useState({
    academic_year_id: null,
    days: [], periods: [], entries: [],
    classes: [], teachers: [], subjects: [],
    teacherSubjects: {}, metaByClass: {}
  });
  const [loading, setLoading] = useState(true);

  // Class Timetable is the default tab for everyone (managers included).
  const [activeTab, setActiveTab] = useState('grid');
  // Active academic year name — shown as a read-only badge (like Attendance).
  const activeYearName = useActiveYearName(user);

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
      <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
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

  // Build the tab set from permissions.
  //  • Class Timetable    -> everyone with view access (read-only sees disabled inputs)
  //  • Teachers Timetable -> managers only (edit/delete)
  //  • Days & Periods     -> managers only (edit/delete) — kept LAST.
  const tabs = [];
  tabs.push({ id: 'grid', label: 'Class Timetable', icon: LayoutGrid });
  if (isManager) tabs.push({ id: 'teachers', label: 'Teachers Timetable', icon: Users });
  if (isManager) tabs.push({ id: 'setup',    label: 'Days & Periods',     icon: Clock });

  const tabIds = tabs.map(t => t.id);
  const current = tabIds.includes(activeTab) ? activeTab : tabIds[0];
  const tabProps = { data, fetchData, user, canEdit };

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      {/* 1. Page Header */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Timetable</h1>
          <p className="text-sm text-zinc-500 max-w-[56ch]">
            Configure the school's weekly schedule once, then fill in each class's grid.
          </p>
        </div>
        <YearBadge name={activeYearName} />
      </header>

      {/* Segmented Tabs - Horizontally Scrollable on Mobile */}
      <div className="flex items-center gap-2 mb-6 sm:mb-8 border-b border-zinc-200 pb-4 overflow-x-auto custom-scrollbar w-full">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              current === t.id
                ? 'bg-primary text-white'
                : 'text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
            }`}
          >
            <t.icon className="size-3.5 shrink-0" /> {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        {current === 'setup'    && isManager && <SetupTab    {...tabProps} />}
        {current === 'grid'     &&              <GridTab     {...tabProps} />}
        {current === 'teachers' && isManager && <TeachersTimetableTab {...tabProps} />}
      </div>
    </div>
  );
}

// =====================================================================
//  SUB-COMPONENT 1: SetupTab — Days + Periods (ONE save button)
//  Times are entered manually as HH:MM with an AM / PM dropdown.
//  Saving persists working days AND periods together, then refetches,
//  so the data is read back from the backend and survives a refresh.
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
      return data.periods.map(p => {
        const s = split24((p.start_time || '').slice(0, 5));
        const e = split24((p.end_time   || '').slice(0, 5));
        return {
          period_index: p.period_index,
          name: p.name,
          start12: s.t12, start_ap: s.ap,
          end12:   e.t12, end_ap:   e.ap,
          is_break: !!p.is_break
        };
      });
    }
    return [{ period_index: 1, name: 'Period 1', start12: '09:00', start_ap: 'AM', end12: '09:45', end_ap: 'AM', is_break: false }];
  });

  const [saving, setSaving] = useState(false);

  const toggleDay = (idx) => {
    if (!canEdit) return;
    setDays(prev => prev.map(d => d.day_index === idx ? { ...d, is_working: !d.is_working } : d));
  };

  const addPeriod = (isBreak = false) => {
    const last = periods[periods.length - 1];
    setPeriods([...periods, {
      period_index: periods.length + 1,
      name: isBreak ? 'Lunch Break' : `Period ${periods.length + 1}`,
      start12: last?.end12 || '09:00',
      start_ap: last?.end_ap || 'AM',
      end12: '',
      end_ap: last?.end_ap || 'AM',
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

  // --- ONE button: saves working days AND periods together ----------
  const saveAll = async () => {
    // Validate + build the periods payload in 24h form.
    const prepared = [];
    for (const p of periods) {
      if (!p.name?.trim()) return alert('Every period needs a name.');
      const start_time = join24(p.start12, p.start_ap);
      const end_time   = join24(p.end12, p.end_ap);

      if (!start_time || !end_time) return alert(`"${p.name}" needs a valid start and end time. Enter as HH:MM (e.g. 09:00) and pick AM/PM.`);
      if (start_time >= end_time)   return alert(`"${p.name}" end time must be after start time.`);

      prepared.push({ period_index: prepared.length + 1, name: p.name, start_time, end_time, is_break: p.is_break });
    }

    if (prepared.length === 0) return alert('Add at least one period.');
    if (!window.confirm('Saving will update the working days and the bell schedule. Any timetable entries that no longer match the period list will be cleared. Continue?')) return;

    setSaving(true);
    try {
      // 1) Working days
      const daysRes = await fetch(`${API_BASE_URL}/admin/timetable/days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institutionId, academic_year_id: data.academic_year_id, days })
      });
      if (!daysRes.ok) throw new Error('days');

      // 2) Periods / breaks
      const periodsRes = await fetch(`${API_BASE_URL}/admin/timetable/periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: user.institutionId, academic_year_id: data.academic_year_id, periods: prepared })
      });
      if (!periodsRes.ok) throw new Error('periods');

      alert('Days & periods saved.');
      fetchData();   // read back from backend -> survives refresh
    } catch (e) {
      alert('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-6">
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
          </div>
        </div>

        {/* Column 2: Periods */}
        <div className="lg:col-span-7 ring-1 ring-black/5 bg-white rounded-lg flex flex-col">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
            <Clock className="size-4 text-primary shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Periods & Breaks</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">The bell schedule — applied globally to all classes. Type the time as HH:MM and pick AM / PM.</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {periods.map((p, idx) => (
                <div key={idx} className={`flex flex-col gap-3 p-3 rounded-md ring-1 ${
                  p.is_break ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-zinc-200'
                }`}>
                  {/* Row 1: index/label + name + delete */}
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex items-center gap-2 shrink-0 text-zinc-400">
                      {p.is_break ? <Coffee className="size-4 text-amber-600" /> : <span className="text-sm font-semibold tabular-nums text-zinc-500 w-4 text-center">{idx + 1}</span>}
                      <span className="sm:hidden text-xs font-semibold uppercase text-zinc-500 tracking-wider">
                        {p.is_break ? 'Break' : 'Period'}
                      </span>
                    </div>
                    <input
                      placeholder="Name" disabled={!canEdit}
                      value={p.name}
                      onChange={e => updatePeriod(idx, 'name', e.target.value)}
                      className="h-9 flex-1 rounded border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-60"
                    />
                    {canEdit && (
                      <button onClick={() => removePeriod(idx)} className="text-zinc-400 hover:text-accent p-1 transition-colors shrink-0">
                        <Trash2 className="size-4 shrink-0" />
                      </button>
                    )}
                  </div>

                  {/* Row 2: manual time entry — start / end, each HH:MM + AM-PM */}
                  <div className="flex flex-wrap items-center gap-2 sm:pl-9">
                    {/* Start */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase text-zinc-400 tracking-wider w-8">From</span>
                      <input
                        type="text" inputMode="numeric" maxLength={5} disabled={!canEdit}
                        placeholder="HH:MM" value={p.start12}
                        onChange={e => updatePeriod(idx, 'start12', e.target.value)}
                        className="h-9 w-20 rounded border border-zinc-200 bg-white px-2 text-sm tabular-nums text-center text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-60"
                      />
                      <div className="relative">
                        <select
                          disabled={!canEdit} value={p.start_ap}
                          onChange={e => updatePeriod(idx, 'start_ap', e.target.value)}
                          className="h-9 rounded border border-zinc-200 bg-white pl-2 pr-6 text-sm text-zinc-900 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-60">
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                        <ChevronDown className="size-3 text-zinc-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* End */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase text-zinc-400 tracking-wider w-8 text-right sm:text-left">To</span>
                      <input
                        type="text" inputMode="numeric" maxLength={5} disabled={!canEdit}
                        placeholder="HH:MM" value={p.end12}
                        onChange={e => updatePeriod(idx, 'end12', e.target.value)}
                        className="h-9 w-20 rounded border border-zinc-200 bg-white px-2 text-sm tabular-nums text-center text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-60"
                      />
                      <div className="relative">
                        <select
                          disabled={!canEdit} value={p.end_ap}
                          onChange={e => updatePeriod(idx, 'end_ap', e.target.value)}
                          className="h-9 rounded border border-zinc-200 bg-white pl-2 pr-6 text-sm text-zinc-900 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-60">
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                        <ChevronDown className="size-3 text-zinc-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {canEdit && (
              <div className="flex gap-2 w-full pt-4 border-t border-zinc-100">
                <button onClick={() => addPeriod(false)}
                  className="flex-1 text-zinc-700 h-9 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 flex items-center justify-center gap-1.5 transition-colors">
                  <Plus className="size-3.5 shrink-0" /> Add Period
                </button>
                <button onClick={() => addPeriod(true)}
                  className="flex-1 text-amber-700 bg-amber-50 h-9 border border-amber-200 rounded-md text-xs font-medium hover:bg-amber-100 flex items-center justify-center gap-1.5 transition-colors">
                  <Coffee className="size-3.5 shrink-0" /> Add Break
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SINGLE save button for BOTH working days and periods */}
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={saveAll} disabled={saving}
            className="bg-primary text-white h-10 px-8 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm">
            <Save className="size-4 shrink-0" /> {saving ? 'Saving...' : 'Save Days & Periods'}
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================================
//  SUB-COMPONENT 2: GridTab — Class Timetable
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

  // Created/updated audit for the currently-selected class. "Updated by" is
  // shown only once a later save has moved updated_at past created_at.
  const classMeta = data.metaByClass?.[selectedClassId] || null;
  const metaWasUpdated = classMeta && classMeta.updated_at && classMeta.updated_by_name &&
    (!classMeta.created_at || new Date(classMeta.updated_at) - new Date(classMeta.created_at) > 1000);

  const teachersForSubject = useCallback((subjectId) => {
    if (!subjectId) return data.teachers;
    const sid = parseInt(subjectId, 10);
    return data.teachers.filter(t => {
      const subs = data.teacherSubjects?.[t.id] || [];
      return subs.includes(sid);
    });
  }, [data.teachers, data.teacherSubjects]);

  // Does this teacher already teach a DIFFERENT class at this day/period?
  const teacherClash = useCallback((dayId, periodId, teacherId) => {
    if (!teacherId) return null;
    const hit = data.entries.find(e =>
      String(e.day_id) === String(dayId) &&
      String(e.period_id) === String(periodId) &&
      String(e.teacher_id) === String(teacherId) &&
      String(e.class_id) !== String(selectedClassId)
    );
    if (!hit) return null;
    const cls = data.classes.find(c => String(c.id) === String(hit.class_id));
    return cls ? `${cls.className}${cls.section ? ' - ' + cls.section : ''}` : 'another class';
  }, [data.entries, data.classes, selectedClassId]);

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
      <div className="bg-blue-50/50 border border-blue-100 rounded-md p-4 flex gap-3 text-[11px] text-blue-700 leading-relaxed">
        <AlertCircle className="size-4 shrink-0 text-blue-500 mt-0.5" />
        <p>
          <strong className="font-semibold text-blue-900">Tip:</strong> Pick a subject first — the teacher dropdown then shows only teachers assigned to that subject. If a teacher is already teaching another class at the same time, a red note appears so you can resolve the clash. Manage subjects in <em>Manage Logins → Subjects</em>.
        </p>
      </div>

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

          {/* Per-class created / updated audit */}
          {classMeta && (classMeta.created_by_name || metaWasUpdated) ? (
            <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-zinc-500">
              {classMeta.created_by_name && (
                <span>
                  <span className="font-semibold text-zinc-600">Created by</span> {classMeta.created_by_name}
                  {classMeta.created_at && <span className="text-zinc-400"> · {fmtIST(classMeta.created_at)}</span>}
                </span>
              )}
              {metaWasUpdated && (
                <span>
                  <span className="font-semibold text-zinc-600">Updated by</span> {classMeta.updated_by_name}
                  {classMeta.updated_at && <span className="text-zinc-400"> · {fmtIST(classMeta.updated_at)}</span>}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-zinc-400 italic">Not saved yet for this class.</p>
          )}
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

                  // Teachers eligible for the chosen subject...
                  let teacherOptions = teachersForSubject(cell.subject_id);
                  // ...but ALWAYS keep the already-assigned teacher in the list.
                  if (cell.teacher_id && !teacherOptions.some(t => String(t.id) === String(cell.teacher_id))) {
                    const assigned = data.teachers.find(t => String(t.id) === String(cell.teacher_id));
                    if (assigned) teacherOptions = [assigned, ...teacherOptions];
                  }

                  const clashClass = teacherClash(d.id, p.id, cell.teacher_id);

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
                            className={`h-8 w-full rounded border bg-zinc-50 pl-2 pr-6 text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 disabled:opacity-60 appearance-none cursor-pointer ${
                              clashClass ? 'border-red-300 bg-red-50/40' : 'border-zinc-200'
                            }`}>
                            <option value="">
                              {cell.subject_id ? (teacherOptions.length ? 'Select Teacher' : 'No teacher') : 'Select Teacher'}
                            </option>
                            {teacherOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                          <ChevronDown className="size-3 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {clashClass && (
                          <p className="text-[10px] font-medium text-red-600 leading-snug flex items-start gap-1">
                            <AlertCircle className="size-3 shrink-0 mt-0.5" />
                            <span>This teacher is already assigned to <strong className="font-semibold">{clashClass}</strong> during this period. Pick a different teacher, or move that class to another slot.</span>
                          </p>
                        )}

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
    </div>
  );
}

// =====================================================================
//  SUB-COMPONENT 3: TeachersTimetableTab — managers only
// =====================================================================
function TeachersTimetableTab({ data, fetchData, user, canEdit }) {
  const workingDays = useMemo(
    () => data.days.filter(d => d.is_working).sort((a, b) => a.day_index - b.day_index),
    [data.days]
  );
  const sortedPeriods = useMemo(
    () => [...data.periods].sort((a, b) => a.period_index - b.period_index),
    [data.periods]
  );

  const teachers = data.teachers || [];
  const [search, setSearch] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState(teachers[0]?.id || '');
  const [saving, setSaving] = useState(false);

  const visibleTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q ? teachers : teachers.filter(t =>
      (t.name || '').toLowerCase().includes(q) || (t.email || '').toLowerCase().includes(q));
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [teachers, search]);

  // Prefill the grid from this teacher's existing entries.
  const initialCells = useMemo(() => {
    const map = {};
    data.entries
      .filter(e => String(e.teacher_id) === String(selectedTeacherId))
      .forEach(e => {
        map[`${e.day_id}-${e.period_id}`] = {
          class_id: e.class_id || '',
          subject_id: e.subject_id || '',
          room_no: e.room_no || ''
        };
      });
    return map;
  }, [data.entries, selectedTeacherId]);

  const [cells, setCells] = useState(initialCells);
  useEffect(() => { setCells(initialCells); }, [initialCells]);

  const classLabel = (c) => `${c.className}${c.section ? ' - ' + c.section : ''}`;

  // Subjects this teacher is qualified for (falls back to all if none set).
  const eligibleSubjects = useMemo(() => {
    const ids = (data.teacherSubjects?.[selectedTeacherId] || []).map(String);
    if (!ids.length) return data.subjects;
    return data.subjects.filter(s => ids.includes(String(s.id)));
  }, [data.subjects, data.teacherSubjects, selectedTeacherId]);

  const updateCell = (dayId, periodId, key, val) => {
    if (!canEdit) return;
    const k = `${dayId}-${periodId}`;
    setCells(prev => {
      const cur = prev[k] || { class_id: '', subject_id: '', room_no: '' };
      const next = { ...cur, [key]: val };

      // Clearing the class empties the whole cell.
      if (key === 'class_id' && !val) { next.subject_id = ''; next.room_no = ''; }
      return { ...prev, [k]: next };
    });
  };

  // Is the chosen class+period already taken by ANOTHER teacher?
  const classSlotClash = useCallback((dayId, periodId, classId) => {
    if (!classId) return null;
    const hit = data.entries.find(e =>
      String(e.day_id) === String(dayId) &&
      String(e.period_id) === String(periodId) &&
      String(e.class_id) === String(classId) &&
      e.teacher_id && String(e.teacher_id) !== String(selectedTeacherId)
    );
    if (!hit) return null;
    const t = data.teachers.find(x => String(x.id) === String(hit.teacher_id));
    const s = data.subjects.find(x => String(x.id) === String(hit.subject_id));
    return { teacher: t?.name || 'another teacher', subject: s?.name || '' };
  }, [data.entries, data.teachers, data.subjects, selectedTeacherId]);

  const handleSave = async () => {
    if (!selectedTeacherId) return;
    const entries = Object.entries(cells)
      .filter(([, v]) => v.class_id)
      .map(([k, v]) => {
        const [day_id, period_id] = k.split('-').map(Number);
        return {
          class_id: Number(v.class_id),
          day_id, period_id,
          subject_id: v.subject_id || null,
          room_no: v.room_no || null
        };
      });

    // Client-side pre-check so the admin sees clashes before the round-trip.
    const clashLines = [];
    for (const e of entries) {
      const c = classSlotClash(e.day_id, e.period_id, e.class_id);
      if (c) clashLines.push(`• ${c.teacher}${c.subject ? ` (teaching ${c.subject})` : ''}`);
    }
    if (clashLines.length) {
      return alert('This timetable cannot be saved yet. The following periods are already taken by another teacher:\n\n' + clashLines.join('\n') + '\n\nPlease choose a different period or class, then save again.');
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/timetable/teacher-entries/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          academic_year_id: data.academic_year_id,
          teacher_id: selectedTeacherId,
          entries
        })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { alert('Teacher timetable saved.'); fetchData(); }
      else if (res.status === 409 && Array.isArray(d.conflicts)) {
        const lines = d.conflicts.map(c => `• ${c.teacher_name || 'Another teacher'}${c.subject_name ? ` (teaching ${c.subject_name})` : ''}`);
        alert((d.error || 'Some periods are already taken by another teacher.') + '\n\n' + lines.join('\n') + '\n\nPlease choose a different period or class, then save again.');
      } else alert(d.error || 'Failed to save.');
    } catch (e) { alert('Network error.'); }
    setSaving(false);
  };

  if (workingDays.length === 0 || sortedPeriods.length === 0) {
    return (
      <div className="ring-1 ring-black/5 bg-white rounded-lg p-6 sm:p-10 text-center flex flex-col items-center">
        <AlertCircle className="text-accent mb-3 size-10 shrink-0" />
        <h2 className="text-sm font-semibold text-zinc-900">Set Up the Schedule First</h2>
        <p className="text-xs text-zinc-500 mt-1 max-w-[50ch]">
          Configure <strong>Days & Periods</strong> before assigning teacher timetables.
        </p>
      </div>
    );
  }

  if (teachers.length === 0) {
    return (
      <div className="ring-1 ring-black/5 bg-white rounded-lg p-6 sm:p-10 text-center flex flex-col items-center">
        <AlertCircle className="text-accent mb-3 size-10 shrink-0" />
        <h2 className="text-sm font-semibold text-zinc-900">No Teachers Found</h2>
        <p className="text-xs text-zinc-500 mt-1 max-w-[50ch]">
          Add teacher users in <strong>Manage Logins → Users</strong>, then return here.
        </p>
      </div>
    );
  }

  const selectedTeacher = teachers.find(t => String(t.id) === String(selectedTeacherId));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT — teacher list */}
      <div className="lg:col-span-3 ring-1 ring-black/5 rounded-lg bg-white flex flex-col">
        <div className="px-4 py-4 border-b border-zinc-100 flex items-center gap-2">
          <Users className="size-4 text-primary shrink-0" />
          <h2 className="text-sm font-semibold text-zinc-900">Teachers</h2>
        </div>
        <div className="p-3 border-b border-zinc-100">
          <div className="relative">
            <Search className="size-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              placeholder="Search name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[520px] p-2 space-y-1 custom-scrollbar">
          {visibleTeachers.length > 0 ? visibleTeachers.map(t => {
            const isOn = String(t.id) === String(selectedTeacherId);
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTeacherId(t.id)}
                className={`w-full text-left px-3 py-2.5 rounded-md ring-1 transition-colors ${
                  isOn
                    ? 'bg-primary/5 ring-primary/20'
                    : 'bg-white ring-transparent hover:bg-zinc-50 hover:ring-zinc-200'
                }`}>
                <div className={`text-sm font-semibold leading-tight ${isOn ? 'text-primary' : 'text-zinc-900'}`}>
                  {t.name}
                </div>
                <div className="text-[9px] text-zinc-400 mt-0.5 truncate">{t.email || '—'}</div>
              </button>
            );
          }) : (
            <p className="text-zinc-400 italic text-center py-10 text-xs">No teachers match this search.</p>
          )}
        </div>
      </div>

      {/* RIGHT — selected teacher's grid */}
      <div className="lg:col-span-9 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase text-zinc-500 tracking-wider">Assigning Timetable For</p>
            <p className="text-sm font-semibold text-zinc-900 mt-0.5">
              {selectedTeacher?.name || '—'}
              {selectedTeacher?.email && <span className="ml-2 text-[10px] font-normal text-zinc-400">{selectedTeacher.email}</span>}
            </p>
          </div>
          {canEdit && (
            <button onClick={handleSave} disabled={saving}
              className="bg-primary text-white h-9 px-6 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto shadow-sm shrink-0">
              <Save className="size-3.5 shrink-0" /> {saving ? 'Saving...' : 'Save Teacher Timetable'}
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
                  <th key={p.id} className="px-3 py-3 border-b border-r border-zinc-100 text-center min-w-[170px] bg-zinc-50/50">
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
                    const cell = cells[key] || { class_id: '', subject_id: '', room_no: '' };

                    if (p.is_break) {
                      return (
                        <td key={p.id} className="p-4 bg-amber-50/50 text-center border-r border-zinc-100">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 ring-1 ring-amber-600/10 whitespace-nowrap">
                            <Coffee className="size-3 shrink-0" /> Break
                          </span>
                        </td>
                      );
                    }

                    const clash = classSlotClash(d.id, p.id, cell.class_id);

                    return (
                      <td key={p.id} className="p-2 sm:p-3 border-r border-zinc-100 align-top">
                        <div className="flex flex-col gap-1.5">
                          <div className="relative">
                            <select
                              disabled={!canEdit}
                              value={cell.class_id}
                              onChange={e => updateCell(d.id, p.id, 'class_id', e.target.value)}
                              className={`h-8 w-full rounded border bg-zinc-50 pl-2 pr-6 text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 disabled:opacity-60 appearance-none cursor-pointer ${
                                clash ? 'border-red-300 bg-red-50/40' : 'border-zinc-200'
                              }`}>
                              <option value="">Free / No Class</option>
                              {data.classes.map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
                            </select>
                            <ChevronDown className="size-3 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          {cell.class_id && (
                            <div className="relative">
                              <select
                                disabled={!canEdit}
                                value={cell.subject_id}
                                onChange={e => updateCell(d.id, p.id, 'subject_id', e.target.value)}
                                className="h-8 w-full rounded border border-zinc-200 bg-zinc-50 pl-2 pr-6 text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 disabled:opacity-60 appearance-none cursor-pointer">
                                <option value="">Select Subject</option>
                                {eligibleSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <ChevronDown className="size-3 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          )}

                          {clash && (
                            <p className="text-[10px] font-medium text-red-600 leading-snug flex items-start gap-1">
                              <AlertCircle className="size-3 shrink-0 mt-0.5" />
                              <span>This period is already taken by <strong className="font-semibold">{clash.teacher}</strong>{clash.subject ? <> (teaching <strong className="font-semibold">{clash.subject}</strong>)</> : null}. Choose another period or class.</span>
                            </p>
                          )}

                          {cell.class_id && (
                            <input
                              disabled={!canEdit}
                              placeholder="Room (e.g. 101)"
                              value={cell.room_no}
                              onChange={e => updateCell(d.id, p.id, 'room_no', e.target.value)}
                              className="h-8 w-full rounded border border-zinc-200 bg-white px-2 text-[11px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 disabled:opacity-60"
                            />
                          )}
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
            <strong className="font-semibold text-blue-900">How this works:</strong> Pick the class (and subject) this teacher takes each period.
            If a class period is already taken by another teacher, a red note appears and the save is blocked until you resolve it.
            Saving here updates the same shared timetable used by the Class Timetable tab.
          </p>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
//  SUB-COMPONENT 4: PersonalTimetable — read-only "My Timetable"
// =====================================================================
function PersonalTimetable({ user, mode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const activeYearName = useActiveYearName(user);

  const fetchMine = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/my/${user.id}`);
      const json = await res.json();
      setData(json);
    } catch (e) { console.error('My timetable fetch error:', e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchMine(); }, [fetchMine]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || !data.academic_year_id) {
    return (
      <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="ring-1 ring-black/5 bg-white rounded-lg p-6 sm:p-10 text-center max-w-2xl mx-auto flex flex-col items-center">
          <AlertCircle className="text-accent mb-3 size-10 shrink-0" />
          <h2 className="text-lg font-semibold text-zinc-900">No Timetable Yet</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-[50ch]">
            Your timetable hasn't been published yet. Please check back once the school sets it up.
          </p>
        </div>
      </div>
    );
  }

  const workingDays = [...(data.days || [])].filter(d => d.is_working).sort((a, b) => a.day_index - b.day_index);
  const sortedPeriods = [...(data.periods || [])].sort((a, b) => a.period_index - b.period_index);

  const cellMap = {};
  (data.entries || []).forEach(e => { cellMap[`${e.day_id}-${e.period_id}`] = e; });

  // Created / updated audit for this timetable (student: their class; teacher:
  // aggregated across their classes). "Updated by" shows only once it's moved
  // meaningfully past creation.
  const ptMeta = data.meta || null;
  const ptMetaWasUpdated = ptMeta && ptMeta.updated_at && ptMeta.updated_by_name &&
    (!ptMeta.created_at || new Date(ptMeta.updated_at) - new Date(ptMeta.created_at) > 1000);

  if (workingDays.length === 0 || sortedPeriods.length === 0) {
    return (
      <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="ring-1 ring-black/5 bg-white rounded-lg p-6 sm:p-10 text-center max-w-2xl mx-auto flex flex-col items-center">
          <AlertCircle className="text-accent mb-3 size-10 shrink-0" />
          <h2 className="text-lg font-semibold text-zinc-900">No Timetable Yet</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-[50ch]">
            The weekly schedule hasn't been configured yet. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" /> My Timetable
          </h1>
          <p className="text-sm text-zinc-500">
            {mode === 'student'
              ? <>Your class schedule{data.class_label ? <> for <strong className="text-zinc-700">{data.class_label}</strong></> : ''}.</>
              : <>Your weekly teaching schedule across all your classes.</>}
          </p>
          {ptMeta && (ptMeta.created_by_name || ptMetaWasUpdated) && (
            <div className="flex flex-col gap-0.5 text-[11px] text-zinc-500">
              {ptMeta.created_by_name && (
                <span>
                  <span className="font-semibold text-zinc-600">Created by</span> {ptMeta.created_by_name}
                  {ptMeta.created_at && <span className="text-zinc-400"> · {fmtIST(ptMeta.created_at)}</span>}
                </span>
              )}
              {ptMetaWasUpdated && (
                <span>
                  <span className="font-semibold text-zinc-600">Updated by</span> {ptMeta.updated_by_name}
                  {ptMeta.updated_at && <span className="text-zinc-400"> · {fmtIST(ptMeta.updated_at)}</span>}
                </span>
              )}
            </div>
          )}
        </div>
        <YearBadge name={activeYearName} />
      </header>

      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-x-auto custom-scrollbar flex flex-col">
        <table className="w-full text-left border-collapse min-w-[880px]">
          <thead>
            <tr className="bg-white">
              <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-r border-zinc-100 sticky left-0 bg-white z-20 w-32 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                Day / Period
              </th>
              {sortedPeriods.map(p => (
                <th key={p.id} className="px-3 py-3 border-b border-r border-zinc-100 text-center min-w-[150px] bg-zinc-50/50">
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
                  if (p.is_break) {
                    return (
                      <td key={p.id} className="p-4 bg-amber-50/50 text-center border-r border-zinc-100">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 ring-1 ring-amber-600/10 whitespace-nowrap">
                          <Coffee className="size-3 shrink-0" /> Break
                        </span>
                      </td>
                    );
                  }
                  const cell = cellMap[`${d.id}-${p.id}`];
                  if (!cell) {
                    return (
                      <td key={p.id} className="p-3 border-r border-zinc-100 text-center text-[11px] text-zinc-300">—</td>
                    );
                  }
                  return (
                    <td key={p.id} className="p-3 border-r border-zinc-100 align-top">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-zinc-900 leading-tight">
                          {mode === 'student'
                            ? (cell.subject_name || '—')
                            : (cell.className ? `${cell.className}${cell.section ? ' - ' + cell.section : ''}` : '—')}
                        </span>
                        <span className="text-[10px] text-zinc-500 leading-tight">
                          {mode === 'student'
                            ? (cell.teacher_name || '')
                            : (cell.subject_name || '')}
                        </span>
                        {cell.room_no && (
                          <span className="text-[9px] font-medium text-zinc-400 mt-0.5">Room {cell.room_no}</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}