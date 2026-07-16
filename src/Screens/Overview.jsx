import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from './PermissionsContext';
import { API_BASE_URL } from '../apiConfig';
import {
  Bell, GraduationCap, Users, Clock, CalendarClock, School, ShieldCheck,
  Settings, BarChart3, CalendarDays, Inbox, CircleDot, CheckCircle2, TrendingUp,
  HelpCircle, X
} from 'lucide-react';
import { ALL_CARD_IDS, KPI_CARDS, cardById, getPersona, normalizeIds } from './overviewCards';
import OverviewSettingsModal from './OverviewSettingsModal';
import { buildStudentTotals } from '../components/Performance/PerfUtils';

// =====================================================================
// Overview — one unified dashboard for every role.
//  • Stat boxes (incl. Live Class + Attendance/Performance gauges) in
//    the order the Super Admin set per role. Every box — stat, live or
//    gauge — shares one shell (Box) so they are all the same rectangle.
//  • Performance Analytics + Events | Notifications sections.
// Everything shows by default; trimmed/ordered per role in Settings.
// Module permissions stay the hard gate. Bands 80 / 50.
// =====================================================================

const Spinner = () => (
  <div className="h-96 flex items-center justify-center">
    <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
  </div>
);

const safeJson = async (url) => {
  try { const r = await fetch(url); return r.ok ? await r.json() : null; }
  catch { return null; }
};
async function fetchRoleCards(instId, role) {
  const d = await safeJson(`${API_BASE_URL}/overview-config/resolve?instId=${encodeURIComponent(instId)}&role=${encodeURIComponent(role)}`);
  return Array.isArray(d?.card_ids) ? d.card_ids : null;
}
function gateByPermission(ids, can) {
  return ids.filter(id => {
    const card = cardById[id];
    if (!card) return false;
    if (!card.requiresModule) return true;
    return can(card.requiresModule, 'view');
  });
}

// Large-screen column count = number of stat boxes (3–6), so they sit on a
// single row instead of wrapping. Literal classes so Tailwind keeps them.
const COLS_LG = {
  1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6'
};

const barColor = (p) => (p >= 80 ? '#22c55e' : p >= 50 ? '#3b82f6' : '#ef4444');
const EVENT_COLORS = { Meeting: '#3b82f6', Event: '#f59e0b', Festival: '#ef4444', Holiday: '#10b981', Exam: '#8b5cf6', Other: '#ec4899' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const timeAgo = (s) => {
  if (!s) return '';
  let v = String(s);
  if (!(/[zZ]$/.test(v) || /[+-]\d\d:?\d\d$/.test(v))) v = v.replace(' ', 'T') + 'Z';
  const d = new Date(v); if (isNaN(d.getTime())) return '';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60); if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);  if (hr < 24)  return `${hr}h ago`;
  const day = Math.floor(hr / 24);  if (day < 7)  return `${day}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// ---- IST clock helpers for the Live Class card --------------------
const nowMinIST = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  let h = 0, m = 0;
  parts.forEach(p => { if (p.type === 'hour') h = +p.value; if (p.type === 'minute') m = +p.value; });
  return h * 60 + m;
};
const todayNameIST = () => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(new Date());
const parseHM = (t) => { if (!t) return null; const m = String(t).slice(0, 5).match(/^(\d{1,2}):(\d{2})$/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const fmt12 = (min) => { const h = Math.floor(min / 60), m = min % 60; const ap = h >= 12 ? 'PM' : 'AM'; const h12 = ((h + 11) % 12) + 1; return `${h12}:${String(m).padStart(2, '0')} ${ap}`; };
// Compact range for the narrow Live Class box: "10:45 – 11:30 AM" when both
// ends share a meridiem, "11:30 AM – 12:10 PM" only when they don't.
const fmtRange = (s, e) => {
  const ap = (m) => (Math.floor(m / 60) >= 12 ? 'PM' : 'AM');
  const hm = (m) => { const h = Math.floor(m / 60), mi = m % 60; return `${((h + 11) % 12) + 1}:${String(mi).padStart(2, '0')}`; };
  return ap(s) === ap(e) ? `${hm(s)} \u2013 ${hm(e)} ${ap(e)}` : `${hm(s)} ${ap(s)} \u2013 ${hm(e)} ${ap(e)}`;
};

// ---- small data helpers (reuse existing endpoints) ----------------
function attendancePctFromOverview(ov, userId) {
  if (!ov) return null;
  const wd = ov.working_days || 0;
  const row = (ov.per_user || []).find(r => String(r.user_id) === String(userId));
  if (wd <= 0) return null;
  const present = row ? (row.present || 0) : 0;
  return Math.round((present / wd) * 1000) / 10;
}
function teacherOverallPct(teachersPayload, userId) {
  const t = (teachersPayload?.teachers || []).find(x => String(x.teacher_id) === String(userId));
  if (!t) return null;
  let o = 0, p = 0; const examIds = new Set();
  (t.detail || []).forEach(d => (d.exams || []).forEach(e => { o += e.obtained; p += e.possible; if (e.possible > 0) examIds.add(e.exam_type_id); }));
  if (p <= 0) return { pct: null, exams: [] };
  const exams = (teachersPayload.examTypes || []).filter(x => examIds.has(x.id)).map(x => x.name);
  return { pct: Math.round((o / p) * 1000) / 10, exams };
}
function studentOverallPct(dataset, userId) {
  if (!dataset) return null;
  const rows = buildStudentTotals(dataset, { examTypeId: 'overall', subjectId: 'all' }) || [];
  const me = rows.find(r => String(r.id) === String(userId));
  const exams = (dataset.examTypes || []).map(t => t.name);
  return me ? { pct: me.percentage, exams } : { pct: null, exams };
}

export default function Overview() {
  const { user } = useAuth();
  const { can } = usePermissions();

  const [bundle, setBundle]   = useState(null);
  const [cardIds, setCardIds] = useState(null);
  const [stats, setStats]     = useState({ attendance: null, performance: null });
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const isSuperAdmin = (user?.role || '') === 'Super Admin';

  useEffect(() => {
    if (!user?.id || !user?.institutionId) return;
    let alive = true;
    (async () => {
      // Phase 1 — everything that doesn't need the user's class.
      const [admin, cards, perf, tt, uc, cal, notes, me] = await Promise.all([
        safeJson(`${API_BASE_URL}/admin/data/${user.institutionId}`),
        fetchRoleCards(user.institutionId, user.role),
        safeJson(`${API_BASE_URL}/admin/performance/overview/${user.institutionId}`),
        safeJson(`${API_BASE_URL}/timetable/my/${user.id}`),
        safeJson(`${API_BASE_URL}/notifications/${user.id}/unread-count`),
        safeJson(`${API_BASE_URL}/admin/calendar/${user.institutionId}`),
        safeJson(`${API_BASE_URL}/notifications/${user.id}?limit=8`),
        safeJson(`${API_BASE_URL}/overview/me/${user.institutionId}/${user.id}`)
      ]);
      if (!alive) return;
      setBundle({ admin, perf, tt, uc, events: Array.isArray(cal) ? cal : [], notes: Array.isArray(notes) ? notes : [] });
      setCardIds(cards);
      setLoading(false);

      // Phase 2 — personal attendance % and performance % (existing endpoints).
      const persona = getPersona(me?.role || user.role);
      const classId = me?.class_id;
      let attendance = null, performance = null;
      if (persona === 'student' && classId) {
        const [ov, ds] = await Promise.all([
          safeJson(`${API_BASE_URL}/admin/attendance/overview/${user.institutionId}?category=students&class_id=${classId}`),
          safeJson(`${API_BASE_URL}/admin/performance/class/${classId}`)
        ]);
        attendance = attendancePctFromOverview(ov, user.id);
        performance = studentOverallPct(ds, user.id);
      } else if (persona === 'teacher') {
        const [ov, tp] = await Promise.all([
          safeJson(`${API_BASE_URL}/admin/attendance/overview/${user.institutionId}?category=teachers`),
          safeJson(`${API_BASE_URL}/admin/performance/teachers/${user.institutionId}`)
        ]);
        attendance = attendancePctFromOverview(ov, user.id);
        performance = teacherOverallPct(tp, user.id);
      }
      if (alive) setStats({ attendance, performance });
    })();
    return () => { alive = false; };
  }, [user]);

  const persona = getPersona(user?.role);

  if (loading) return <Spinner />;
  if (!bundle) return null;

  const admin = bundle.admin || {};
  const users = admin.users || [];
  const isStudent = (u) => (u.role || '').toLowerCase().includes('student');
  const activeYear = (admin.academicYears || []).find(y => y.isActive);

  const entries = Array.isArray(bundle.tt?.entries) ? bundle.tt.entries : [];
  const days = Array.isArray(bundle.tt?.days) ? bundle.tt.days : [];
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayDay = days.find(d => (d.day_name || '').toLowerCase() === todayName.toLowerCase());
  const classesToday = todayDay ? entries.filter(e => e.day_id === todayDay.id).length : 0;
  const distinctClasses = new Set(entries.map(e => e.class_id).filter(Boolean)).size;

  const VALUES = {
    total_users:    { value: users.length, sub: 'System wide' },
    students:       { value: users.filter(isStudent).length, sub: 'Enrolled' },
    teachers_staff: { value: users.filter(u => !isStudent(u)).length, sub: 'Active members' },
    classes:        { value: (admin.classes || []).length, sub: 'Configured' },
    roles:          { value: (admin.roles || []).length, sub: 'RBAC' },
    active_year:    { value: activeYear?.name || 'None', sub: 'Current term', isText: true },
    my_class:       { value: bundle.tt?.class_label || '—', sub: 'Current class', isText: true },
    teaching_classes: { value: distinctClasses, sub: 'This week' },
    classes_today:  { value: classesToday, sub: todayName },
    weekly_periods: { value: entries.length, sub: 'On your timetable' }
  };

  // config (or default) -> permission gate -> normalized order
  const enabled    = normalizeIds(gateByPermission(cardIds || ALL_CARD_IDS, can));
  const kpiIds     = enabled.filter(id => cardById[id]?.kind === 'kpi');
  const showPerf   = enabled.includes('performance_analytics');
  const showEvents = enabled.includes('events_panel');
  const showNotes  = enabled.includes('notifications_panel');
  const cols       = Math.min(Math.max(kpiIds.length, 1), 6); // one row, 3–6 wide

  const renderKpi = (id) => {
    const c = cardById[id];
    if (c.render === 'live') return <LiveClassCard key={id} id={id} tt={bundle.tt} persona={persona} />;
    if (c.render === 'gauge') {
      if (id === 'attendance_pct') {
        const v = stats.attendance;
        return <GaugeCard key={id} id={id} value={v} display={v == null ? '—' : `${v.toFixed(1)}%`} sub="Up to date" />;
      }
      const p = stats.performance;
      const pct = p?.pct;
      return <GaugeCard key={id} id={id} value={pct} display={pct == null ? '—' : `${pct}%`}
               sub={p?.exams?.length ? `${p.exams.join(', ')} Completed` : 'No exams yet'} />;
    }
    return <KpiBox key={id} id={id} {...VALUES[id]} />;
  };

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">

      <header className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Welcome back, {user?.name?.split(' ')[0] || 'User'}</h1>
          <p className="text-sm text-zinc-500 max-w-[56ch]">Here is what is happening at {admin.institution?.name || 'your institution'} today.</p>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2 self-start shrink-0">
            <button onClick={() => setHelpOpen(true)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors">
              <HelpCircle className="size-3.5" /> How to use
            </button>
            <button onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-white border border-zinc-200 text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition-colors">
              <Settings className="size-3.5" /> Overview Settings
            </button>
          </div>
        )}
      </header>

      {kpiIds.length > 0 && (
        <div className={`grid grid-cols-2 md:grid-cols-3 ${COLS_LG[cols]} auto-rows-fr gap-3 sm:gap-4 mb-6 lg:mb-8 items-stretch`}>
          {kpiIds.map(renderKpi)}
        </div>
      )}

      {showPerf && <PerformanceAnalytics perf={bundle.perf} className="mb-6 lg:mb-8" />}

      <PanelRow showEvents={showEvents} showNotes={showNotes} events={bundle.events} notes={bundle.notes} />

      {settingsOpen && (
        <OverviewSettingsModal instId={user.institutionId} roles={admin.roles || []} onClose={() => setSettingsOpen(false)} />
      )}

      {helpOpen && isSuperAdmin && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

// =====================================================================
//  How-to-use notes — only for the Super Admin, who owns Overview
//  Settings. Same shell/style as the Transport guide.
// =====================================================================
const HELP_STEPS = [
  ['1 · What this screen is', 'One dashboard for every role. The row of boxes at the top is the "Above Section", followed by Performance Analytics and the Events / Notifications sections.'],
  ['2 · Everything is on by default', 'A role with no saved config sees every card it has permission for. You only ever trim from there — nothing is hidden until you say so.'],
  ['3 · Choose per role', 'Overview Settings → pick a role → remove the boxes it shouldn\'t see, or add them back from "Available to add". Each box notes who it is meant for (Admins, Students, Teachers).'],
  ['4 · Set the order', 'The position number next to each enabled box (or the up/down arrows) is the on-screen order, left to right. Push things like "Active Year" to the end.'],
  ['5 · Sections', 'Performance Analytics, Upcoming Events and Recent Notifications are simple on/off toggles per role.'],
  ['6 · Save per role', 'Save applies to the one role in the dropdown. Switch roles and save again — each role keeps its own layout.'],
];
const HELP_NOTE = 'Permissions always win: a box that needs a module (Timetable, Attendance, Performance, Academic Calendar) stays hidden for roles without view access to it, whatever is ticked here. This screen only narrows what a role sees — it never grants access.';

function HelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
          <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> Setting up the Overview</span>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="size-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {HELP_STEPS.map(([t, d], i) => (
            <div key={i} className="rounded-md ring-1 ring-zinc-100 bg-zinc-50/60 p-3">
              <p className="text-xs font-semibold text-zinc-800">{t}</p>
              <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
            </div>
          ))}
          <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex gap-2">
            <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-800 leading-relaxed">{HELP_NOTE}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- one shell for every box --------------------------------------
const KPI_META = {
  total_users:      { Icon: Users,          tint: 'primary' },
  students:         { Icon: GraduationCap,  tint: 'orange' },
  teachers_staff:   { Icon: Users,          tint: 'emerald' },
  classes:          { Icon: School,         tint: 'violet' },
  roles:            { Icon: ShieldCheck,    tint: 'amber' },
  active_year:      { Icon: CalendarDays,   tint: 'sky' },
  my_class:         { Icon: GraduationCap,  tint: 'orange' },
  teaching_classes: { Icon: Users,          tint: 'orange' },
  classes_today:    { Icon: Clock,          tint: 'emerald' },
  weekly_periods:   { Icon: CalendarClock,  tint: 'violet' },
  live_class:       { Icon: CircleDot,      tint: 'rose' },
  attendance_pct:   { Icon: CheckCircle2,   tint: 'teal' },
  performance_pct:  { Icon: TrendingUp,     tint: 'indigo' }
};
const TINT_CLASS = {
  primary: 'bg-white ring-1 ring-primary/40 shadow-sm',
  orange: 'bg-white ring-1 ring-orange-300 shadow-sm',
  emerald: 'bg-white ring-1 ring-emerald-300 shadow-sm',
  violet: 'bg-white ring-1 ring-violet-300 shadow-sm',
  amber: 'bg-white ring-1 ring-amber-300 shadow-sm',
  sky: 'bg-white ring-1 ring-sky-300 shadow-sm',
  rose: 'bg-white ring-1 ring-rose-300 shadow-sm',
  teal: 'bg-white ring-1 ring-teal-300 shadow-sm',
  indigo: 'bg-white ring-1 ring-indigo-300 shadow-sm',
  plain: 'bg-white ring-1 ring-black/5 shadow-sm'
};
const LABEL_CLASS = {
  primary: 'text-primary', orange: 'text-orange-600', emerald: 'text-emerald-600',
  violet: 'text-violet-600', amber: 'text-amber-600', sky: 'text-sky-600',
  rose: 'text-rose-600', teal: 'text-teal-600', indigo: 'text-indigo-600', plain: 'text-zinc-500'
};

// Every card — stat, live class and gauge — renders through this, so the
// whole row is one uniform rectangle: label pinned top, content pinned bottom.
function Box({ id, right, children }) {
  const meta = KPI_META[id] || { Icon: Bell, tint: 'sky' };
  const Icon = meta.Icon, tint = meta.tint;
  return (
    <div className={`h-full min-h-[124px] p-4 rounded-md flex flex-col justify-between ${TINT_CLASS[tint]}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wider truncate flex items-center gap-1.5 ${LABEL_CLASS[tint]}`}>
          <Icon className="size-3.5 shrink-0" /> {cardById[id]?.label || id}
        </span>
        {right}
      </div>
      <div className="mt-auto pt-2 min-w-0">{children}</div>
    </div>
  );
}

function KpiBox({ id, value, sub, isText }) {
  return (
    <Box id={id}>
      <div className="flex flex-col">
        <span className={`${isText ? 'text-xl' : 'text-2xl tabular-nums'} font-semibold text-zinc-900 truncate`} title={String(value)}>{value}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 truncate">{sub}</span>
      </div>
    </Box>
  );
}

// ---- gauge card (attendance / performance) ------------------------
// Same rectangle as a stat box: the ring sits centred in the body with the
// figure inside it, and the sub-line reads underneath.
function GaugeCard({ id, value, display, sub }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const color = value == null ? '#cbd5e1' : barColor(value);
  const R = 25, C = 2 * Math.PI * R, off = C * (1 - pct / 100);
  // "86.4%" needs a touch less room than "8%": shrink only when it's long.
  const big = String(display).length <= 3;
  return (
    <Box id={id}>
      <div className="flex flex-col items-center">
        <div className="relative size-[60px] shrink-0">
          <svg viewBox="0 0 60 60" className="size-[60px] -rotate-90">
            <circle cx="30" cy="30" r={R} fill="none" stroke="#f1f5f9" strokeWidth="5" />
            <circle cx="30" cy="30" r={R} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={off} className="transition-all duration-700 ease-out" />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center font-semibold text-zinc-900 tabular-nums ${big ? 'text-sm' : 'text-[13px]'}`}>
            {display}
          </span>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 truncate w-full text-center mt-1.5" title={sub}>{sub}</span>
      </div>
    </Box>
  );
}

// ---- live class card ----------------------------------------------
function computeLive(tt, now, persona) {
  const days = tt?.days || [], periods = tt?.periods || [], entries = tt?.entries || [];
  const tName = todayNameIST();
  const day = days.find(d => (d.day_name || '').toLowerCase() === tName.toLowerCase() && d.is_working);
  if (!day) return { state: 'none' };
  const map = {};
  entries.forEach(e => { if (String(e.day_id) === String(day.id)) map[e.period_id] = e; });
  const sorted = [...periods].sort((a, b) => a.period_index - b.period_index);
  for (const p of sorted) {
    const s = parseHM(p.start_time), en = parseHM(p.end_time);
    if (s == null || en == null) continue;
    if (now >= s && now < en) {
      if (p.is_break) return { state: 'break', name: p.name, start: s, end: en, now };
      const e = map[p.id];
      if (!e || (!e.subject_name && !e.className)) return { state: 'free', start: s, end: en, now };
      return { state: 'live', e, start: s, end: en, now };
    }
  }
  const next = sorted.find(p => { const s = parseHM(p.start_time); return s != null && s > now && !p.is_break && map[p.id]; });
  if (next) return { state: 'upcoming', e: map[next.id], start: parseHM(next.start_time) };
  return { state: 'none' };
}

function LiveClassCard({ id, tt, persona }) {
  const [now, setNow] = useState(() => nowMinIST());
  useEffect(() => { const t = setInterval(() => setNow(nowMinIST()), 30000); return () => clearInterval(t); }, []);
  const info = useMemo(() => computeLive(tt, now, persona), [tt, now, persona]);

  if (info.state === 'live') {
    const subject = info.e.subject_name || 'Class';
    const classText = persona === 'student'
      ? (tt?.class_label || (info.e.className ? `${info.e.className}${info.e.section ? ' - ' + info.e.section : ''}` : ''))
      : (info.e.className ? `${info.e.className}${info.e.section ? ' - ' + info.e.section : ''}` : '');
    const remaining = Math.max(0, info.end - info.now);
    const pct = Math.max(0, Math.min(100, ((info.now - info.start) / (info.end - info.start)) * 100));
    const badge = (
      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-rose-600 bg-rose-50 ring-1 ring-rose-200 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
        <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" /> Live
      </span>
    );
    return (
      <Box id={id} right={badge}>
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider truncate" title={subject}>{subject}</span>
          <span className="text-lg font-semibold text-zinc-900 leading-tight truncate" title={classText}>{classText || '—'}</span>
          <div className="flex items-baseline justify-between gap-2 mt-1.5">
            <span className="text-[10px] font-semibold text-zinc-700 whitespace-nowrap shrink-0">
              <span className="tabular-nums">{remaining}</span> min left
            </span>
            <span className="text-[9px] text-zinc-400 font-medium tabular-nums truncate text-right" title={`${fmt12(info.start)} – ${fmt12(info.end)}`}>
              {fmtRange(info.start, info.end)}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden mt-1">
            <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Box>
    );
  }

  if (info.state === 'upcoming') {
    const subject = info.e.subject_name || 'Class';
    const classText = persona === 'student'
      ? (tt?.class_label || '')
      : (info.e.className ? `${info.e.className}${info.e.section ? ' - ' + info.e.section : ''}` : '');
    return (
      <Box id={id}>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-zinc-900 truncate">You're free right now.</span>
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide truncate mt-1"
            title={`Next: ${subject}${classText ? ' · ' + classText : ''} at ${fmt12(info.start)}`}>
            Next: {subject} · {fmt12(info.start)}
          </span>
        </div>
      </Box>
    );
  }

  // break / free / none
  return (
    <Box id={id}>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-zinc-900 truncate">
          {info.state === 'break' ? (info.name || 'Break time') : "You're free right now."}
        </span>
        <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide truncate mt-1">
          {info.state === 'break' ? fmtRange(info.start, info.end) : 'No class scheduled'}
        </span>
      </div>
    </Box>
  );
}

function PanelRow({ showEvents, showNotes, events, notes }) {
  if (!showEvents && !showNotes) return null;
  return (
    <div className={`grid grid-cols-1 ${showEvents && showNotes ? 'lg:grid-cols-2' : ''} gap-6 lg:gap-8 items-start`}>
      {showEvents && <EventsPanel events={events} />}
      {showNotes && <NotificationsPanel notes={notes} />}
    </div>
  );
}

// ---- Performance Analytics (admin school-wide) --------------------
function PerformanceAnalytics({ perf, className = '' }) {
  const [view, setView] = useState('performers');
  const performers = perf?.top_performers || [];
  const classes = perf?.top_classes || [];
  const examsLine = (perf?.exams_completed || []).join(', ');
  const bars = view === 'performers'
    ? performers.map(p => ({ key: `${p.class_id}-${p.roll_no}`, pct: p.pct, name: p.student_name, sub: `Roll: ${p.roll_no ?? '-'}`, badge: p.class_group, marks: `${p.obtained}/${p.possible}` }))
    : classes.map(c => ({ key: c.class_id, pct: c.pct, name: (c.class_group || '').toUpperCase(), sub: 'Class Overall', marks: `${c.obtained}/${c.possible}` }));
  return (
    <div className={`ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6 ${className}`}>
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Performance Analytics</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Visual breakdown of top achievers and overall Exam based class performance</p>
          {examsLine && <p className="text-xs font-semibold text-zinc-700 mt-2">{examsLine} Completed</p>}
          <p className="text-[11px] italic text-primary mt-1">For more details view the "Performance Reports" screen.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="inline-flex items-center bg-zinc-100/80 p-1 rounded-md">
            {[{ id: 'performers', label: 'Top Performers' }, { id: 'classes', label: 'Class wise' }].map(t => (
              <button key={t.id} onClick={() => setView(t.id)}
                className={`px-3 h-7 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${view === t.id ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'}`}>{t.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-3 bg-zinc-50 ring-1 ring-black/5 rounded-md px-3 h-7">
            <Dot color="#22c55e" text="Above 80%" /><Dot color="#3b82f6" text="50-80%" /><Dot color="#ef4444" text="Below 50%" />
          </div>
        </div>
      </div>
      {bars.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-center">
          <BarChart3 className="size-9 text-zinc-300 mb-2" />
          <p className="text-sm text-zinc-500 font-medium">No performance data yet.</p>
          <p className="text-xs text-zinc-400 mt-0.5">Enter exam marks in Reports to populate this.</p>
        </div>
      ) : <BarChart bars={bars} />}
    </div>
  );
}

// FULLY MATCHED TO PerfBar.jsx STRUCTURE
function BarChart({ bars }) {
  const TRACK = 220;
  return (
    <div className="overflow-x-auto custom-scrollbar pb-2">
      <div className="flex items-end gap-5 sm:gap-8 min-w-min px-1" style={{ minHeight: TRACK + 90 }}>
        {bars.map(b => {
          const h = Math.max(6, (Math.min(b.pct, 100) / 100) * TRACK);
          const c = barColor(b.pct);
          return (
            <div key={b.key} className="flex flex-col items-center w-24 sm:w-28 shrink-0">
              <span className="text-sm font-semibold text-zinc-700 mb-1.5">{b.pct}%</span>

              {/* Outer Track Match: bg-zinc-100 and inset ring */}
              <div className="w-14 sm:w-16 bg-zinc-100 rounded-t-md flex flex-col justify-end overflow-hidden ring-1 ring-inset ring-black/5 group" style={{ height: TRACK }}>
                {/* Inner Colored Bar */}
                <div className="w-full rounded-t-md transition-all duration-700 ease-out relative flex items-end justify-center" style={{ height: h, background: c }} title={b.marks}>
                  <span className="text-[9px] font-semibold text-white/90 [writing-mode:vertical-rl] rotate-180 mb-2 px-1 py-1 rounded bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity">{b.marks}</span>
                </div>
              </div>

              {/* Baseline Match: Clean grey separator line */}
              <div className="w-full h-px bg-zinc-200 mt-1" />

              <div className="mt-1.5 text-center w-full">
                <div className="text-xs font-semibold text-zinc-800 truncate w-full" title={b.name}>{b.name}</div>
                <div className="text-[10px] text-zinc-400 font-medium mt-0.5">{b.sub}</div>
                {b.badge && <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">{b.badge}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Dot({ color, text }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ background: color }} />
      <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider whitespace-nowrap">{text}</span>
    </span>
  );
}

// ---- Events panel --------------------------------------------------
function EventsPanel({ events }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = (events || [])
    .map(e => { const [y, m, d] = String(e.event_date).split('T')[0].split('-').map(Number); return { ...e, _date: new Date(y, m - 1, d) }; })
    .filter(e => !isNaN(e._date.getTime()) && e._date >= today)
    .sort((a, b) => a._date - b._date).slice(0, 6);
  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
        <CalendarDays className="size-4 text-primary shrink-0" /><h2 className="text-sm font-semibold text-zinc-800">Upcoming Events</h2>
      </div>
      {upcoming.length === 0 ? (
        <div className="p-8 text-center text-zinc-400 text-xs italic font-medium">No upcoming events scheduled.</div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {upcoming.map(e => {
            const color = EVENT_COLORS[e.type] || EVENT_COLORS.Other;
            return (
              <div key={e.id} className="p-4 flex gap-3 hover:bg-zinc-50/50 transition-colors">
                <div className="text-center shrink-0 w-11 flex flex-col items-center justify-center">
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase">{MONTHS[e._date.getMonth()]}</div>
                  <div className="text-lg font-semibold text-zinc-800 tabular-nums leading-none mt-0.5">{e._date.getDate()}</div>
                </div>
                <div className="flex-1 border-l-[3px] pl-3 flex flex-col justify-center min-w-0" style={{ borderColor: color }}>
                  <p className="text-sm font-semibold text-zinc-900 leading-tight truncate">{e.name}</p>
                  <p className="text-[10px] font-medium text-zinc-500 mt-1 uppercase truncate">{e.time || e.type}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Notifications panel ------------------------------------------
function NotificationsPanel({ notes }) {
  const recent = (notes || []).slice(0, 6);
  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
        <Bell className="size-4 text-primary shrink-0" /><h2 className="text-sm font-semibold text-zinc-800">Recent Notifications</h2>
      </div>
      {recent.length === 0 ? (
        <div className="p-8 text-center flex flex-col items-center"><Inbox className="size-8 text-zinc-300 mb-2" /><p className="text-zinc-400 text-xs italic font-medium">No notifications yet.</p></div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {recent.map(n => (
            <div key={n.id} className={`p-4 flex items-start gap-3 ${n.is_read ? '' : 'bg-primary/[0.03]'}`}>
              <div className="size-8 rounded-md bg-primary/5 text-primary ring-1 ring-primary/15 flex items-center justify-center shrink-0"><Bell className="size-3.5" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm truncate ${n.is_read ? 'font-medium text-zinc-700' : 'font-semibold text-zinc-900'}`}>{n.title}</p>
                  {!n.is_read && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
                </div>
                {n.body && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{n.body}</p>}
                <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mt-1 inline-block">{timeAgo(n.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}