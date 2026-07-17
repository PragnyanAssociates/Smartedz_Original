import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  GraduationCap, Users as UsersIcon, UserCog, ClipboardCheck, History,
  Search, ChevronLeft, ChevronDown, BarChart3, CalendarCheck, CalendarX,
  CalendarRange, List, PieChart, HelpCircle, X, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import RosterMarker from './RosterMarker';
import AttendanceHistory from './AttendanceHistory';
import { API_BASE_URL } from '../../apiConfig';

// =====================================================================
//  Attendance — Top-level container
//  (Downloads now live on the dedicated Downloads tab in System
//   Configuration, so there is no export control here.)
// =====================================================================

export default function Attendance() {
  const { user } = useAuth();
  const { can, isAllAccess } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role === 'student';
  const isTeacher = role.includes('teacher');
  const isSuper   = isAllAccess; // covers Super Admin and Developer

  const canMark = isSuper || isTeacher || can('Attendance', 'edit');

  // ---- Active academic year (for the badge only) ---------------------
  const [activeYearName, setActiveYearName] = useState('');
  const [help, setHelp] = useState(false);

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

  // Which category tabs are visible to this user?
  const categories = useMemo(() => {
    if (isSuper)   return ['students', 'teachers', 'other'];
    if (isTeacher) return ['students', 'teachers'];
    if (isStudent) return ['students'];
    return ['students', 'teachers', 'other'];
  }, [isSuper, isTeacher, isStudent]);

  const [category, setCategory] = useState(categories[0]);
  const [mode, setMode] = useState('mark'); // 'mark' | 'history'

  useEffect(() => {
    if (!canMark) setMode('history');
  }, [canMark]);

  const forceSelfHistory = isStudent || (!isSuper && !isTeacher && !can('Attendance', 'edit'));

  const categoryConfig = {
    students: { label: 'Students', icon: GraduationCap },
    teachers: { label: 'Teachers', icon: UsersIcon },
    other:    { label: 'Other',    icon: UserCog }
  };

  const YearBadge = () => (
    activeYearName ? (
      <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary/5 ring-1 ring-primary/15 text-primary text-xs font-semibold whitespace-nowrap self-start sm:self-auto">
        <CalendarRange className="size-3.5" /> Academic Year: {activeYearName}
      </div>
    ) : null
  );

  const HelpButton = () => (
    <button onClick={() => setHelp(true)}
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0">
      <HelpCircle className="size-3.5" /> How to use
    </button>
  );

  // -----------------------------------------------------------------
  if (forceSelfHistory) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <Header subtitle="Your attendance history" />
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <HelpButton />
            <YearBadge />
          </div>
        </div>
        <AttendanceHistory userId={user.id} userName={user.name} selfOnly yearName={activeYearName} />
        {help && <HelpModal topic="self" onClose={() => setHelp(false)} />}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-3 sm:space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <Header subtitle="Mark and review daily attendance" />
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <HelpButton />
          <YearBadge />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map(key => {
            const cfg = categoryConfig[key];
            const Icon = cfg.icon;
            const active = category === key;
            return (
              <button key={key}
                onClick={() => setCategory(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-50 border border-zinc-200 bg-white'
                }`}>
                <Icon className="size-3.5 shrink-0" /> {cfg.label}
              </button>
            );
          })}
        </div>

        <div className="flex sm:inline-flex bg-zinc-100/80 p-1 rounded-md shrink-0 w-full sm:w-auto">
          {canMark && (
            <button
              onClick={() => setMode('mark')}
              className={`flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                mode === 'mark' ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              <ClipboardCheck className="size-3.5" /> Mark
            </button>
          )}
          <button
            onClick={() => setMode('history')}
            className={`flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              mode === 'history' ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            <History className="size-3.5" /> History
          </button>
        </div>
      </div>

      {mode === 'mark' ? (
        <RosterMarker category={category} />
      ) : (
        <HistoryPicker category={category} yearName={activeYearName} />
      )}

      {help && <HelpModal topic={mode === 'mark' ? 'mark' : 'history'} onClose={() => setHelp(false)} />}
    </div>
  );
}

function Header({ subtitle }) {
  return (
    <header className="flex flex-col mb-1 sm:mb-4">
      <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Attendance</h1>
      <p className="text-sm text-zinc-500 mt-0.5 max-w-[56ch]">{subtitle}</p>
    </header>
  );
}

// =====================================================================
//  How-to-use notes — the guide follows what you're doing right now
//  (marking, reviewing, or reading your own record). Same shell as the
//  Transport module guide.
// =====================================================================
const GUIDES = {
  mark: {
    title: 'Marking attendance',
    steps: [
      ['1 \u00b7 Pick who', 'The tabs decide who you are marking \u2014 Students, Teachers, or Other staff. Teachers see Students and Teachers; a Super Admin sees all three.'],
      ['2 \u00b7 Then the class and the date', 'For students, choose the class. Teachers only ever see their own classes here. Check the date before you mark \u2014 it is the one thing people get wrong.'],
      ['3 \u00b7 Present or Absent', 'Those are the only two options \u2014 there is no Late. If your school used to mark Late, those days now count as Present.'],
      ['4 \u00b7 Mark and save', 'Set everyone, then save. Marking the same class and date again simply updates it, so a mistake is fixed by re-marking, not by deleting anything.'],
      ['5 \u00b7 Then check History', 'Switch to History to see what the marking adds up to \u2014 per person, per month, or across the whole year.'],
    ],
    note: 'Attendance is stamped with the ACTIVE academic year shown in the badge. Marking against the wrong active year puts the day in the wrong year\u2019s records \u2014 if the badge looks wrong, fix it in Manage Logins \u2192 Academics Year before you mark.'
  },
  history: {
    title: 'Reviewing attendance',
    steps: [
      ['1 \u00b7 Choose the period', 'Daily for one date, Monthly for a month, Yearly for the whole active academic year, or Custom for any two dates.'],
      ['2 \u00b7 Read the top bar', 'Working Days is how many days were actually marked \u2014 not calendar days, so an unmarked day never counts against anyone. On Daily, Present and Absent are head counts; on Monthly, Yearly and Custom they are percentages of everything marked.'],
      ['3 \u00b7 The list', 'Total / Present per person for the period. Click any row to open that person\u2019s full history \u2014 their calendar, their summary and their chart.'],
      ['4 \u00b7 Analysis', 'Flips the list into a bar per person, sorted High \u2192 Low, Low \u2192 High, or by roll number. Green is 80% and above, blue 50\u201380%, red below 50% \u2014 the same bands as the Performance screens.'],
      ['5 \u00b7 Finding someone', 'Search by name, username or roll number.'],
    ],
    note: 'Read-only \u2014 nothing here changes a mark; that\u2019s the Mark tab. To export attendance, use Manage Logins \u2192 Downloads, which pulls a full academic year to Excel.'
  },
  self: {
    title: 'Your attendance',
    steps: [
      ['Your record', 'Everything marked for you this academic year \u2014 your percentage, your days present and your days absent.'],
      ['The calendar', 'Green days are present, red are absent. A blank day means nothing was marked \u2014 a holiday, a weekend, or a day your school didn\u2019t take attendance.'],
      ['How the % works', 'It counts only the days that were actually marked, so days the school never took attendance can\u2019t count against you.'],
    ],
    note: 'This is your own record and is read-only. If a day looks wrong, ask your class teacher or the office to check it \u2014 they can re-mark the day and it updates here.'
  }
};

function HelpModal({ topic, onClose }) {
  const content = GUIDES[topic] || GUIDES.history;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
          <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="size-5" /></button>
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
  );
}

// =====================================================================
//  HistoryPicker — unchanged behaviour
// =====================================================================
function HistoryPicker({ category, yearName }) {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();
  const role = (user?.role || '').toLowerCase();
  const isTeacher = role.includes('teacher');

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState(null);
  const [loading, setLoading] = useState(true);

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [classesLoaded, setClassesLoaded] = useState(false);

  const [mode, setMode] = useState('monthly');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [day, setDay]     = useState(() => new Date().toISOString().slice(0, 10));
  const [from, setFrom]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo]       = useState(() => new Date().toISOString().slice(0, 10));

  const [overview, setOverview] = useState(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [view, setView] = useState('list');
  const [analysisSort, setAnalysisSort] = useState('high');

  const teacherViewingTeachers = !isAllAccess && isTeacher && category === 'teachers';

  useEffect(() => {
    if (category !== 'students') { setClasses([]); setClassId(''); setClassesLoaded(false); return; }
    setClassesLoaded(false);
    (async () => {
      try {
        if (isTeacher && !isAllAccess) {
          const res = await fetch(`${API_BASE_URL}/admin/attendance/teacher-classes/${user.id}`);
          const data = await res.json();
          setClasses(data || []);
        } else {
          const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
          const data = await res.json();
          setClasses(data.classes || []);
        }
      } catch (e) { console.error('classes load:', e); }
      finally { setClassesLoaded(true); }
    })();
  }, [category, user, isTeacher, isAllAccess]);

  useEffect(() => {
    if (category !== 'students' || classes.length === 0) return;
    const valid = classes.some(c => String(c.id) === String(classId));
    if (!valid) setClassId(String(classes[0].id));
  }, [classes, category, classId]);

  const awaitingClass = category === 'students' && !classId && (!classesLoaded || classes.length > 0);

  const resolveRange = useCallback(() => {
    if (mode === 'daily') return { from: day, to: day };
    if (mode === 'monthly') {
      const [y, m] = month.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
    }
    if (mode === 'yearly') return { from: null, to: null };
    return { from, to };
  }, [mode, day, month, from, to]);

  const loadRoster = useCallback(async () => {
    if (awaitingClass) { setLoading(true); return; }
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      let url = `${API_BASE_URL}/admin/attendance/roster/${user.institutionId}?category=${category}&date=${today}`;
      if (category === 'students' && classId) url += `&class_id=${classId}`;
      const res = await fetch(url);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user, category, classId, awaitingClass]);

  useEffect(() => {
    if (!teacherViewingTeachers) loadRoster();
    else setLoading(false);
  }, [loadRoster, teacherViewingTeachers]);

  const loadOverview = useCallback(async () => {
    if (teacherViewingTeachers) { setOvLoading(false); return; }
    if (awaitingClass) { setOvLoading(true); return; }
    setOvLoading(true);
    try {
      const r = resolveRange();
      let url = `${API_BASE_URL}/admin/attendance/overview/${user.institutionId}?category=${category}`;
      if (r.from && r.to) url += `&from=${r.from}&to=${r.to}`;
      if (category === 'students' && classId) url += `&class_id=${classId}`;
      const res = await fetch(url);
      const data = await res.json();
      setOverview(data);
    } catch (e) { console.error(e); setOverview(null); }
    setOvLoading(false);
  }, [user, category, classId, resolveRange, teacherViewingTeachers, awaitingClass]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const sortedAll = useMemo(() => {
    const arr = [...users];
    if (category === 'students') {
      arr.sort((a, b) => {
        const ra = parseInt(a.roll_no, 10), rb = parseInt(b.roll_no, 10);
        const na = isNaN(ra), nb = isNaN(rb);
        if (na && nb) return (a.name || '').localeCompare(b.name || '');
        if (na) return 1; if (nb) return -1;
        return ra - rb;
      });
    } else {
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return arr;
  }, [users, category]);

  const serialMap = useMemo(() => {
    if (category === 'students') return {};
    const map = {};
    sortedAll.forEach((u, i) => { map[u.id] = i + 1; });
    return map;
  }, [sortedAll, category]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sortedAll;
    const q = search.toLowerCase();
    return sortedAll.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.roll_no || '').toString().toLowerCase().includes(q)
    );
  }, [sortedAll, search]);

  const workingDays = overview?.working_days || 0;
  const statsById = useMemo(() => {
    const m = {};
    (overview?.per_user || []).forEach(s => {
      const attended = s.present || 0;
      m[s.user_id] = {
        present: attended,
        absent: s.absent || 0,
        total: workingDays,
        pct: workingDays > 0 ? Math.round((attended / workingDays) * 100) : 0
      };
    });
    return m;
  }, [overview, workingDays]);

  const analysisData = useMemo(() => {
    const arr = sortedAll.map(u => {
      const st = statsById[u.id] || { present: 0, absent: 0, late: 0, total: workingDays, pct: 0 };
      return {
        id: u.id, name: u.name, roll_no: u.roll_no, serial: serialMap[u.id],
        present: st.present, total: workingDays, pct: st.pct
      };
    });
    if (analysisSort === 'high') {
      arr.sort((a, b) => b.pct - a.pct || (a.name || '').localeCompare(b.name || ''));
    } else if (analysisSort === 'low') {
      arr.sort((a, b) => a.pct - b.pct || (a.name || '').localeCompare(b.name || ''));
    }
    return arr;
  }, [sortedAll, statsById, serialMap, workingDays, analysisSort]);

  const categoryLabel = category === 'students' ? 'Students' : (category === 'teachers' ? 'Teachers' : 'Other');

  if (teacherViewingTeachers) {
    return <AttendanceHistory userId={user.id} userName={user.name} selfOnly yearName={yearName} />;
  }

  if (picked) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <button onClick={() => setPicked(null)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
          <ChevronLeft className="size-4" /> Back to {category} list
        </button>
        <AttendanceHistory userId={picked.id} userName={picked.name} yearName={yearName} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar shrink-0 max-w-full">
          {['daily', 'monthly', 'yearly', 'custom'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                mode === m ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {category === 'students' && classes.length > 0 && (
            <div className="relative shrink-0">
              <select value={classId} onChange={e => setClassId(e.target.value)}
                title="Class"
                className="h-9 rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors">
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.className}{c.section ? ` - ${c.section}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {mode === 'daily' && (
            <input type="date" value={day} onChange={e => setDay(e.target.value)}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" />
          )}
          {mode === 'monthly' && (
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" />
          )}
          {mode === 'yearly' && (
            <span className="h-9 inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-600 whitespace-nowrap">
              {yearName || 'Active academic year'}
            </span>
          )}
          {mode === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" />
              <span className="text-[10px] font-semibold text-zinc-400 uppercase">to</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" />
            </div>
          )}

          <button onClick={() => setView(v => (v === 'analysis' ? 'list' : 'analysis'))}
            className={`h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0 ${
              view === 'analysis'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50'
            }`}>
            {view === 'analysis' ? <List className="size-3.5" /> : <PieChart className="size-3.5" />}
            {view === 'analysis' ? 'Show List' : 'Analysis'}
          </button>
        </div>
      </div>

      <div className="relative w-full sm:w-80">
        <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          placeholder={`Search ${category}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm"
        />
      </div>

      <OverviewBar overview={overview} loading={ovLoading} category={category} mode={mode} />

      {view === 'analysis' ? (
        ovLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                <BarChart3 className="size-3.5 text-primary" /> Attendance % per {category === 'students' ? 'student' : (category === 'teachers' ? 'teacher' : 'person')}
              </h3>
              <div className="inline-flex bg-zinc-100/80 p-1 rounded-md self-start sm:self-auto">
                {[
                  { key: 'high',  label: 'High → Low' },
                  { key: 'low',   label: 'Low → High' },
                  { key: 'order', label: category === 'students' ? 'Roll No.' : 'S.No' }
                ].map(o => (
                  <button key={o.key} onClick={() => setAnalysisSort(o.key)}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                      analysisSort === o.key ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <AnalysisBars data={analysisData} category={category} />
          </div>
        )
      ) : (
        loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center">
            <p className="text-zinc-500 text-sm font-medium">No {category} found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
              <List className="size-3.5 text-primary" /> {categoryLabel}
              <span className="text-zinc-400 font-medium tabular-nums">({filtered.length})</span>
            </h3>

            <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-zinc-50/50">
                    <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap">
                      {category === 'students' ? 'Roll' : 'S.No'} / Name
                    </th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap text-center">
                      Total / Present
                    </th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap">Role</th>
                    <th className="px-5 py-3 border-b border-zinc-100"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filtered.map(u => {
                    const idLabel = category === 'students'
                      ? (u.roll_no ? `Roll ${u.roll_no}` : '—')
                      : `S.No ${serialMap[u.id] || '—'}`;
                    const st = statsById[u.id];
                    const present = st ? st.present : 0;
                    return (
                      <tr key={u.id} className="hover:bg-zinc-50/60 transition-colors cursor-pointer group" onClick={() => setPicked(u)}>
                        <td className="px-5 py-4 flex items-center gap-3">
                          {u.profile_pic ? (
                            <img src={u.profile_pic} alt="" className="size-8 rounded-full object-cover shrink-0 ring-1 ring-black/5" />
                          ) : (
                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0 ring-1 ring-primary/20">
                              {(u.name || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-zinc-900 text-sm truncate">{u.name}</span>
                            <span className="text-[10px] text-zinc-500 truncate">{idLabel}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          {ovLoading ? (
                            <span className="text-zinc-300">…</span>
                          ) : (
                            <span className="text-sm tabular-nums">
                              <span className="font-semibold text-zinc-800">{workingDays}</span>
                              <span className="text-zinc-400"> / </span>
                              <span className="font-semibold text-emerald-600">{present}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 whitespace-nowrap">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            View Details
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// =====================================================================
//  OverviewBar
// =====================================================================
function OverviewBar({ overview, loading, category, mode }) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg ring-1 ring-black/5 p-4 flex items-center justify-center h-20">
        <div className="size-5 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!overview) return null;

  const isDaily = mode === 'daily';
  const present = overview.present ?? 0;
  const absent  = overview.absent ?? 0;
  const denom   = present + absent;
  const share   = (n) => (denom > 0 ? `${((n / denom) * 100).toFixed(1)}%` : '0.0%');

  const cards = [
    { icon: CalendarRange,  label: 'Working Days', value: overview.working_days ?? 0, color: 'blue' },
    { icon: BarChart3,      label: 'Avg %',        value: `${overview.avg_percentage ?? '0.0'}%`, color: 'blue' },
    { icon: CalendarCheck,  label: 'Present',      value: isDaily ? present : share(present), color: 'emerald' },
    { icon: CalendarX,      label: 'Absent',       value: isDaily ? absent  : share(absent),  color: 'red' },
    { icon: GraduationCap,  label: category === 'students' ? 'Students' : (category === 'teachers' ? 'Teachers' : 'People'), value: overview.user_count ?? 0, color: 'zinc' }
  ];

  const map = {
    blue:    'bg-primary/10 text-primary ring-primary/20',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-600/20',
    red:     'bg-red-50 text-red-600 ring-red-600/20',
    amber:   'bg-amber-50 text-amber-600 ring-amber-600/20',
    zinc:    'bg-zinc-100 text-zinc-600 ring-zinc-200'
  };

  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 p-3 sm:p-4">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="flex items-center gap-2 sm:gap-2.5 rounded-md bg-zinc-50/60 ring-1 ring-black/5 px-2.5 py-2">
              <div className={`size-7 sm:size-8 rounded-md ring-1 flex items-center justify-center shrink-0 ${map[c.color]}`}>
                <Icon className="size-3.5 sm:size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm sm:text-base font-semibold text-zinc-900 leading-none tabular-nums truncate">{c.value}</span>
                <span className="text-[9px] sm:text-[10px] font-semibold text-zinc-500 uppercase tracking-wider truncate mt-0.5">{c.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      {overview.total_marks === 0 && (
        <p className="text-[11px] text-zinc-400 italic mt-2">No attendance recorded for this range yet.</p>
      )}
    </div>
  );
}

// =====================================================================
//  AnalysisBars
// =====================================================================
function bandColor(pct) {
  if (pct >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-600' };
  if (pct >= 50) return { bar: 'bg-primary',     text: 'text-primary' };
  return { bar: 'bg-red-500', text: 'text-red-600' };
}

function AnalysisBars({ data, category }) {
  const CHART_H = 240;

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg ring-1 ring-black/5 border-dashed h-56 flex items-center justify-center">
        <p className="text-zinc-400 text-sm font-medium">No one to chart for this range.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-5 text-[10px] font-medium text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" /> ≥ 80%</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" /> 50–80%</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-red-500" /> &lt; 50%</span>
      </div>

      <div className="overflow-x-auto custom-scrollbar pb-1">
        <div className="flex items-end gap-3 sm:gap-4" style={{ minWidth: '100%' }}>
          {data.map(d => {
            const c = bandColor(d.pct);
            const barPx = Math.max(Math.round((d.pct / 100) * (CHART_H - 26)), d.pct > 0 ? 6 : 2);
            return (
              <div key={d.id} className="flex flex-col items-center shrink-0" style={{ width: 72 }}>
                <div className="flex flex-col justify-end items-center w-full" style={{ height: CHART_H }}>
                  <span className={`text-[11px] font-bold tabular-nums mb-1 ${c.text}`}>{d.pct}%</span>
                  <div className={`w-full ${c.bar} rounded-t transition-all`}
                    style={{ height: barPx }}
                    title={`${d.name} — ${d.present}/${d.total} present (${d.pct}%)`} />
                </div>
                <span className="text-[10px] font-semibold text-zinc-700 mt-2 text-center leading-tight w-full truncate" title={d.name}>
                  {d.name}
                </span>
                <span className="text-[9px] text-zinc-400 mt-0.5 whitespace-nowrap">
                  {category === 'students' ? `Roll: ${d.roll_no || '—'}` : `S.No: ${d.serial || '—'}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}