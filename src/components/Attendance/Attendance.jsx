import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  GraduationCap, Users as UsersIcon, UserCog, ClipboardCheck, History,
  Search, ChevronLeft, ChevronDown, BarChart3, CalendarCheck, CalendarX,
  Clock, CalendarRange, List, PieChart
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import RosterMarker from './RosterMarker';
import AttendanceHistory from './AttendanceHistory';
import { API_BASE_URL } from '../../apiConfig';

// =====================================================================
//  Attendance — Top-level container
//  Three category tabs (Students / Teachers / Other) × two action
//  sub-tabs (Mark / History), plus an Academic Year filter on top.
//
//  Access rules:
//    • Super Admin           -> full access everywhere
//    • Student               -> only own history (Students tab -> History)
//    • Teacher               -> mark Students (their classes), view own history
//    • Custom role           -> only own history by default; mark only if
//                               Super Admin granted edit permission on
//                               the Attendance module.
// =====================================================================

export default function Attendance() {
  const { user } = useAuth();
  const { can, isAllAccess } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role === 'student';
  const isTeacher = role.includes('teacher');
  const isSuper   = isAllAccess; // covers Super Admin and Developer

  const canMark = isSuper || isTeacher || can('Attendance', 'edit');

  // ---- Active academic year (read-only context) -------------------
  // Attendance data is tied to the school's ACTIVE academic year (the
  // backend scopes every query by it). There is no year picker — when the
  // admin switches the active year under Academics, the attendance data
  // switches with it automatically. We fetch the active year only to show
  // its name as context.
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

  // Which category tabs are visible to this user?
  const categories = useMemo(() => {
    if (isSuper)   return ['students', 'teachers', 'other'];
    if (isTeacher) return ['students', 'teachers']; // teacher marks students, views own
    if (isStudent) return ['students'];             // sees only their history
    return ['students', 'teachers', 'other'];
  }, [isSuper, isTeacher, isStudent]);

  const [category, setCategory] = useState(categories[0]);
  const [mode, setMode] = useState('mark'); // 'mark' | 'history'

  // If the user can't mark at all, lock them to history view
  useEffect(() => {
    if (!canMark) setMode('history');
  }, [canMark]);

  // Students/custom-role users see only their own history; force category+mode
  const forceSelfHistory = isStudent || (!isSuper && !isTeacher && !can('Attendance', 'edit'));

  const categoryConfig = {
    students: { label: 'Students', icon: GraduationCap },
    teachers: { label: 'Teachers', icon: UsersIcon },
    other:    { label: 'Other',    icon: UserCog }
  };

  // Read-only badge showing which academic year the attendance belongs to.
  const YearBadge = () => (
    activeYearName ? (
      <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary/5 ring-1 ring-primary/15 text-primary text-xs font-semibold whitespace-nowrap self-start sm:self-auto">
        <CalendarRange className="size-3.5" /> Academic Year: {activeYearName}
      </div>
    ) : null
  );

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  if (forceSelfHistory) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <Header subtitle="Your attendance history" />
          <YearBadge />
        </div>
        <AttendanceHistory userId={user.id} userName={user.name} selfOnly yearName={activeYearName} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-3 sm:space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <Header subtitle="Mark and review daily attendance" />
        <YearBadge />
      </div>

      {/* Navigation Controls Wrapper - Tighter spacing on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Category Tabs (Students / Teachers / Other) */}
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

        {/* Mode toggle (Mark / History) - Spans full width evenly on mobile */}
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

      {/* Body */}
      {mode === 'mark' ? (
        <RosterMarker category={category} />
      ) : (
        <HistoryPicker category={category} yearName={activeYearName} />
      )}
    </div>
  );
}

// Reduced bottom margin on mobile to save vertical space
function Header({ subtitle }) {
  return (
    <header className="flex flex-col mb-1 sm:mb-4">
      <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Attendance</h1>
      <p className="text-sm text-zinc-500 mt-0.5 max-w-[56ch]">{subtitle}</p>
    </header>
  );
}

// =====================================================================
//  HistoryPicker — category overview + Analysis + person list.
//  • For STUDENTS, a class filter scopes the roster + overview to one
//    class (mirrors the marking screen). Without it the list mixed every
//    class together — showing all students and colliding roll numbers.
//  • Overview bar (below search): working days + present/absent/late for
//    the chosen Daily/Monthly/Yearly/Custom range, across the (scoped)
//    category.
//  • "Analysis" button toggles a bar graph of the same data.
//  • Picking a person opens their individual history (with its own graph).
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

  // Class filter (students only) — scopes roster + overview to one class.
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');

  // Overview filter state
  const [mode, setMode] = useState('monthly'); // daily | monthly | yearly | custom
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [day, setDay]     = useState(() => new Date().toISOString().slice(0, 10));
  const [from, setFrom]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo]       = useState(() => new Date().toISOString().slice(0, 10));

  const [overview, setOverview] = useState(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'analysis'
  const [analysisSort, setAnalysisSort] = useState('high'); // 'high' | 'low' | 'order'

  // Teacher in "teachers" tab -> just shortcut to their own history
  const teacherViewingTeachers = !isAllAccess && isTeacher && category === 'teachers';

  // ---- Load the class list for the student class filter ------------
  //   Super Admin -> all classes; Teacher -> only their timetabled classes
  //   (and default to the first one). Non-student categories clear it.
  useEffect(() => {
    if (category !== 'students') { setClasses([]); setClassId(''); return; }
    (async () => {
      try {
        if (isTeacher && !isAllAccess) {
          const res = await fetch(`${API_BASE_URL}/admin/attendance/teacher-classes/${user.id}`);
          const data = await res.json();
          setClasses(data || []);
          if (data?.[0]) setClassId(String(data[0].id));
        } else {
          const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
          const data = await res.json();
          setClasses(data.classes || []);
        }
      } catch (e) { console.error('classes load:', e); }
    })();
  }, [category, user, isTeacher, isAllAccess]);

  // ---- Range resolution. "Yearly" returns no date bound — the backend
  //      scopes to the whole active academic year. ------------------
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

  // ---- Load the roster of people to pick from ----------------------
  const loadRoster = useCallback(async () => {
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
  }, [user, category, classId]);

  useEffect(() => {
    if (!teacherViewingTeachers) loadRoster();
    else setLoading(false);
  }, [loadRoster, teacherViewingTeachers]);

  // ---- Load the category overview / analysis series ----------------
  const loadOverview = useCallback(async () => {
    if (teacherViewingTeachers) { setOvLoading(false); return; }
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
  }, [user, category, classId, resolveRange, teacherViewingTeachers]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  // ---- Sorting: students by roll, others alphabetical + S.No -------
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

  // ---- Per-user stats (for the "total / present" figure + Analysis) -
  // "present" counts days attended (Present + Late); the denominator is
  // the category's working days in the selected range.
  const workingDays = overview?.working_days || 0;
  const statsById = useMemo(() => {
    const m = {};
    (overview?.per_user || []).forEach(s => {
      const attended = (s.present || 0) + (s.late || 0);
      m[s.user_id] = {
        present: attended,
        absent: s.absent || 0,
        late: s.late || 0,
        total: workingDays,
        pct: workingDays > 0 ? Math.round((attended / workingDays) * 100) : 0
      };
    });
    return m;
  }, [overview, workingDays]);

  // Per-student data for the Analysis bar chart, sorted per the chosen order.
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
    // 'order' keeps sortedAll order (roll-wise for students, S.No/alpha otherwise)
    return arr;
  }, [sortedAll, statsById, serialMap, workingDays, analysisSort]);

  const categoryLabel = category === 'students' ? 'Students' : (category === 'teachers' ? 'Teachers' : 'Other');

  // ---- Early outs --------------------------------------------------
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

      {/* Filter row: Daily/Monthly/Yearly/Custom + class (students) + pickers + Analysis toggle */}
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
          {/* Class filter — students only. Scopes the roster + overview. */}
          {category === 'students' && classes.length > 0 && (
            <div className="relative shrink-0">
              <select value={classId} onChange={e => setClassId(e.target.value)}
                title="Class"
                className="h-9 rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors">
                <option value="">All classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.className}{c.section ? ` - ${c.section}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Range pickers */}
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

          {/* Analysis toggle */}
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

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          placeholder={`Search ${category}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm"
        />
      </div>

      {/* Overview bar (below the search) */}
      <OverviewBar overview={overview} loading={ovLoading} category={category} />

      {/* Body: Analysis graph OR person list */}
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
              {/* Bar-graph sort filter */}
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
            {/* Heading above the people list */}
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
//  OverviewBar — aggregate summary for the whole category
// =====================================================================
function OverviewBar({ overview, loading, category }) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg ring-1 ring-black/5 p-4 flex items-center justify-center h-20">
        <div className="size-5 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!overview) return null;

  const cards = [
    { icon: CalendarRange,  label: 'Working Days', value: overview.working_days ?? 0, color: 'blue' },
    { icon: BarChart3,      label: 'Avg %',        value: `${overview.avg_percentage ?? '0.0'}%`, color: 'blue' },
    { icon: CalendarCheck,  label: 'Present',      value: overview.present ?? 0, color: 'emerald' },
    { icon: CalendarX,      label: 'Absent',       value: overview.absent ?? 0, color: 'red' },
    { icon: Clock,          label: 'Late',         value: overview.late ?? 0, color: 'amber' },
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
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
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
//  AnalysisBars — one vertical bar per person, height = attendance %.
//  Colour bands:  ≥ 80% green · 50–80% blue · < 50% red.
//  Horizontally scrollable; people are shown line-wise.
// =====================================================================
function bandColor(pct) {
  if (pct >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-600' };
  if (pct >= 50) return { bar: 'bg-primary',     text: 'text-primary' };
  return { bar: 'bg-red-500', text: 'text-red-600' };
}

function AnalysisBars({ data, category }) {
  const CHART_H = 240; // px track height for the bars

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg ring-1 ring-black/5 border-dashed h-56 flex items-center justify-center">
        <p className="text-zinc-400 text-sm font-medium">No one to chart for this range.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 p-4 sm:p-5">
      {/* Band legend */}
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
                {/* Bar + % label (bottom-aligned so the label sits above the bar) */}
                <div className="flex flex-col justify-end items-center w-full" style={{ height: CHART_H }}>
                  <span className={`text-[11px] font-bold tabular-nums mb-1 ${c.text}`}>{d.pct}%</span>
                  <div className={`w-full ${c.bar} rounded-t transition-all`}
                    style={{ height: barPx }}
                    title={`${d.name} — ${d.present}/${d.total} present (${d.pct}%)`} />
                </div>
                {/* Name + roll / serial */}
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