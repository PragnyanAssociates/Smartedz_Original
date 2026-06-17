import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from './PermissionsContext';
import { API_BASE_URL } from '../apiConfig';
import {
  Check, ShieldCheck, Bell, GraduationCap, Users, Clock, CalendarClock,
  BookOpen, Settings, BarChart3, CalendarDays, Inbox, ArrowRight
} from 'lucide-react';
import { getPersona, PERSONA_DEFAULTS, cardById } from './overviewCards';
import OverviewSettingsModal from './OverviewSettingsModal';

// =====================================================================
//  Overview — persona layout + per-role configurable cards, plus a
//  school-wide Performance Analytics block and an Events / Notifications
//  row for the admin view.
//
//  • Persona (getPersona) decides the layout: admin = school-wide,
//    everyone else = personal.
//  • KPI cards are driven by the Super Admin's saved config for the
//    user's role (GET /overview-config/resolve), gated at render by the
//    user's module permissions (can(module,'view')). No config -> default.
//  • Performance Analytics reads GET /admin/performance/overview/:instId
//    (Top Performers = each class's topper, Top Classes = class overall).
//    Bands are 80 / 50 to match the Performance screens.
//  • The gear (Overview Settings) is Super-Admin-only.
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

// 80 / 50 bands, matching PerfUtils used by the Performance screens.
const barColor = (p) => (p >= 80 ? '#22c55e' : p >= 50 ? '#3b82f6' : '#ef4444');

// Event type colours (from AcademicCalendar's eventTypesConfig).
const EVENT_COLORS = {
  Meeting: '#3b82f6', Event: '#f59e0b', Festival: '#ef4444',
  Holiday: '#10b981', Exam: '#8b5cf6', Other: '#ec4899'
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// created_at is naive UTC (server runs UTC); tag as UTC for correct localisation.
const timeAgo = (s) => {
  if (!s) return '';
  let v = String(s);
  if (!(/[zZ]$/.test(v) || /[+-]\d\d:?\d\d$/.test(v))) v = v.replace(' ', 'T') + 'Z';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60); if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);  if (hr < 24)  return `${hr}h ago`;
  const day = Math.floor(hr / 24);  if (day < 7)  return `${day}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export default function Overview() {
  const { user } = useAuth();
  const persona = getPersona(user?.role);
  return persona === 'admin'
    ? <AdminOverview user={user} />
    : <SelfOverview user={user} persona={persona} />;
}

// ---- KPI tints (school) -------------------------------------------
const SCHOOL_TINT = {
  total_users: 'hero', students: 'accent', teachers_staff: 'emerald',
  classes: 'violet', roles: 'amber', active_year: 'sky'
};
const TINT_CLASS = {
  hero:    'bg-primary text-white shadow-sm ring-1 ring-primary/40',
  accent:  'ring-1 ring-accent/20 bg-accent/5 border-l-2 border-accent',
  emerald: 'ring-1 ring-emerald-200 bg-emerald-50 border-l-2 border-emerald-400',
  violet:  'ring-1 ring-violet-200 bg-violet-50 border-l-2 border-violet-400',
  amber:   'ring-1 ring-amber-200 bg-amber-50 border-l-2 border-amber-400',
  sky:     'ring-1 ring-sky-200 bg-sky-50 border-l-2 border-sky-400'
};
const LABEL_CLASS = {
  hero: 'text-white/80', accent: 'text-accent', emerald: 'text-emerald-700',
  violet: 'text-violet-700', amber: 'text-amber-700', sky: 'text-sky-700'
};
const SUB_CLASS = {
  hero: 'text-white/80', accent: 'text-accent', emerald: 'text-emerald-600',
  violet: 'text-violet-600', amber: 'text-amber-600', sky: 'text-sky-600'
};

function KpiBox({ tint, label, value, sub, isText }) {
  return (
    <div className={`p-4 rounded-md flex flex-col gap-1 ${TINT_CLASS[tint]}`}>
      <span className={`text-[10px] font-semibold uppercase tracking-wider truncate ${LABEL_CLASS[tint]}`}>{label}</span>
      <span className={`${isText ? 'text-xl' : 'text-2xl tabular-nums'} font-semibold truncate ${tint === 'hero' ? 'text-white' : 'text-zinc-900'}`} title={String(value)}>
        {value}
      </span>
      <span className={`text-[10px] font-medium uppercase tracking-wide truncate ${SUB_CLASS[tint]}`}>{sub}</span>
    </div>
  );
}

// =====================================================================
//  ADMIN / LEADERSHIP
// =====================================================================
function AdminOverview({ user }) {
  const { can } = usePermissions();
  const [data, setData]       = useState(null);
  const [cardIds, setCardIds] = useState(null);
  const [perf, setPerf]       = useState(null);
  const [events, setEvents]   = useState([]);
  const [notes, setNotes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isSuperAdmin = (user?.role || '') === 'Super Admin';

  useEffect(() => {
    if (!user?.institutionId) return;
    let alive = true;
    (async () => {
      const [adminRes, cards, perfRes, calRes, noteRes] = await Promise.all([
        safeJson(`${API_BASE_URL}/admin/data/${user.institutionId}`),
        fetchRoleCards(user.institutionId, user.role),
        safeJson(`${API_BASE_URL}/admin/performance/overview/${user.institutionId}`),
        safeJson(`${API_BASE_URL}/admin/calendar/${user.institutionId}`),
        safeJson(`${API_BASE_URL}/notifications/${user.id}?limit=8`)
      ]);
      if (!alive) return;
      setData(adminRes);
      setCardIds(cards);
      setPerf(perfRes);
      setEvents(Array.isArray(calRes) ? calRes : []);
      setNotes(Array.isArray(noteRes) ? noteRes : []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  if (loading) return <Spinner />;
  if (!data) return null;

  const totalStudents = data.users.filter(u => (u.role || '').toLowerCase().includes('student')).length;
  const totalStaff    = data.users.filter(u => !(u.role || '').toLowerCase().includes('student')).length;
  const activeYear    = data.academicYears.find(y => y.isActive);

  const VALUES = {
    total_users:    { value: data.users.length,   sub: 'System wide' },
    students:       { value: totalStudents,        sub: 'Enrolled' },
    teachers_staff: { value: totalStaff,           sub: 'Active members' },
    classes:        { value: data.classes.length,  sub: 'Configured' },
    roles:          { value: data.roles.length,    sub: 'RBAC' },
    active_year:    { value: activeYear?.name || 'None', sub: 'Current term', isText: true }
  };

  const wanted = gateByPermission(cardIds || PERSONA_DEFAULTS.admin, can);
  const orderedIds = Object.keys(SCHOOL_TINT).filter(id => wanted.includes(id));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">

      <header className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-zinc-500 max-w-[56ch]">
            Here is what is happening at {data.institution?.name || 'your institution'} today.
          </p>
        </div>

        {isSuperAdmin && (
          <button onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-white border border-zinc-200 text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition-colors self-start shrink-0">
            <Settings className="size-3.5" /> Overview Settings
          </button>
        )}
      </header>

      {/* KPI row */}
      {orderedIds.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 lg:mb-8">
          {orderedIds.map(id => (
            <KpiBox key={id} tint={SCHOOL_TINT[id]} label={cardById[id].label} {...VALUES[id]} />
          ))}
        </div>
      )}

      {/* Performance analytics */}
      <PerformanceAnalytics perf={perf} className="mb-6 lg:mb-8" />

      {/* Events | Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        <EventsPanel events={events} />
        <NotificationsPanel notes={notes} />
      </div>

      {settingsOpen && (
        <OverviewSettingsModal
          instId={user.institutionId}
          roles={data.roles}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

// =====================================================================
//  Performance Analytics — Top Performers / Top Classes toggle + bars.
// =====================================================================
function PerformanceAnalytics({ perf, className = '' }) {
  const [view, setView] = useState('performers'); // 'performers' | 'classes'

  const performers = perf?.top_performers || [];
  const classes    = perf?.top_classes || [];
  const examsLine  = (perf?.exams_completed || []).join(', ');

  const bars = view === 'performers'
    ? performers.map(p => ({
        key: `${p.class_id}-${p.roll_no}`,
        pct: p.pct,
        name: p.student_name,
        sub: `Roll: ${p.roll_no ?? '-'}`,
        badge: p.class_group,
        marks: `${p.obtained}/${p.possible}`
      }))
    : classes.map(c => ({
        key: c.class_id,
        pct: c.pct,
        name: (c.class_group || '').toUpperCase(),
        sub: 'Class Overall',
        marks: `${c.obtained}/${c.possible}`
      }));

  return (
    <div className={`ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6 ${className}`}>
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Performance Analytics</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Visual breakdown of top achievers and overall class performance</p>
          {examsLine && (
            <p className="text-xs font-semibold text-zinc-700 mt-2">{examsLine} Completed</p>
          )}
          <p className="text-[11px] italic text-primary mt-1">For more details view the “Performance Reports” screen.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="inline-flex items-center bg-zinc-100/80 p-1 rounded-md">
            {[
              { id: 'performers', label: 'Top Performers' },
              { id: 'classes',    label: 'Top Classes' }
            ].map(t => (
              <button key={t.id} onClick={() => setView(t.id)}
                className={`px-3 h-7 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  view === t.id ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 bg-zinc-50 ring-1 ring-black/5 rounded-md px-3 h-7">
            <Dot color="#22c55e" text="Above 80%" />
            <Dot color="#3b82f6" text="50-80%" />
            <Dot color="#ef4444" text="Below 50%" />
          </div>
        </div>
      </div>

      {bars.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-center">
          <BarChart3 className="size-9 text-zinc-300 mb-2" />
          <p className="text-sm text-zinc-500 font-medium">No performance data yet.</p>
          <p className="text-xs text-zinc-400 mt-0.5">Enter exam marks in Reports to populate this.</p>
        </div>
      ) : (
        <BarChart bars={bars} />
      )}
    </div>
  );
}

function BarChart({ bars }) {
  const TRACK = 220; // px height of the tallest (100%) bar
  return (
    <div className="overflow-x-auto custom-scrollbar pb-2">
      <div className="flex items-end gap-5 sm:gap-8 min-w-min px-1" style={{ minHeight: TRACK + 90 }}>
        {bars.map(b => {
          const h = Math.max(6, (Math.min(b.pct, 100) / 100) * TRACK);
          const c = barColor(b.pct);
          return (
            <div key={b.key} className="flex flex-col items-center w-24 sm:w-28 shrink-0">
              <span className="text-sm font-semibold text-zinc-700 mb-1.5">{b.pct}%</span>
              <div className="w-14 sm:w-16 rounded-t-md relative flex items-end justify-center group"
                   style={{ height: h, background: c }} title={b.marks}>
                <span className="text-[9px] font-bold text-white/90 [writing-mode:vertical-rl] rotate-180 mb-2 px-1 py-1 rounded bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity">
                  {b.marks}
                </span>
              </div>
              <div className="mt-2.5 text-center w-full">
                <div className="text-xs font-semibold text-zinc-800 truncate w-full" title={b.name}>{b.name}</div>
                <div className="text-[10px] text-zinc-400 font-medium mt-0.5">{b.sub}</div>
                {b.badge && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                    {b.badge}
                  </span>
                )}
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

// =====================================================================
//  Events panel — upcoming events pulled from the calendar module.
// =====================================================================
function EventsPanel({ events }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = (events || [])
    .map(e => {
      const [y, m, d] = String(e.event_date).split('T')[0].split('-').map(Number);
      return { ...e, _date: new Date(y, m - 1, d) };
    })
    .filter(e => !isNaN(e._date.getTime()) && e._date >= today)
    .sort((a, b) => a._date - b._date)
    .slice(0, 6);

  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
        <CalendarDays className="size-4 text-primary shrink-0" />
        <h2 className="text-sm font-semibold text-zinc-800">Upcoming Events</h2>
      </div>
      {upcoming.length === 0 ? (
        <div className="p-8 text-center text-zinc-400 text-xs italic">No upcoming events scheduled.</div>
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

// =====================================================================
//  Notifications panel — recent notifications glance.
// =====================================================================
function NotificationsPanel({ notes }) {
  const recent = (notes || []).slice(0, 6);
  return (
    <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
        <Bell className="size-4 text-primary shrink-0" />
        <h2 className="text-sm font-semibold text-zinc-800">Recent Notifications</h2>
      </div>
      {recent.length === 0 ? (
        <div className="p-8 text-center flex flex-col items-center">
          <Inbox className="size-8 text-zinc-300 mb-2" />
          <p className="text-zinc-400 text-xs italic">No notifications yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {recent.map(n => (
            <div key={n.id} className={`p-4 flex items-start gap-3 ${n.is_read ? '' : 'bg-primary/[0.03]'}`}>
              <div className="size-8 rounded-md bg-primary/5 text-primary ring-1 ring-primary/15 flex items-center justify-center shrink-0">
                <Bell className="size-3.5" />
              </div>
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

// =====================================================================
//  STUDENT / TEACHER / OTHER STAFF — personal "my" view.
// =====================================================================
const SELF_META = {
  my_class:             { Icon: GraduationCap, tint: 'accent',  sub: 'Current class' },
  teaching_classes:     { Icon: Users,         tint: 'accent',  sub: 'This week' },
  classes_today:        { Icon: Clock,         tint: 'emerald', sub: 'today' },
  weekly_periods:       { Icon: CalendarClock, tint: 'violet',  sub: 'On your timetable' },
  unread_notifications: { Icon: Bell,          tint: 'sky',     sub: 'Unread' }
};
const SELF_TINT = {
  accent:  'ring-1 ring-accent/20 bg-accent/5 border-l-2 border-accent text-accent',
  emerald: 'ring-1 ring-emerald-200 bg-emerald-50 border-l-2 border-emerald-400 text-emerald-700',
  violet:  'ring-1 ring-violet-200 bg-violet-50 border-l-2 border-violet-400 text-violet-700',
  sky:     'ring-1 ring-sky-200 bg-sky-50 border-l-2 border-sky-400 text-sky-700'
};

function SelfOverview({ user, persona }) {
  const { can } = usePermissions();
  const [unread, setUnread] = useState(0);
  const [tt, setTt] = useState(null);
  const [cardIds, setCardIds] = useState(null);
  const [events, setEvents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const [uc, timetable, cards, calRes, noteRes] = await Promise.all([
        safeJson(`${API_BASE_URL}/notifications/${user.id}/unread-count`),
        persona === 'staff' ? Promise.resolve(null) : safeJson(`${API_BASE_URL}/timetable/my/${user.id}`),
        fetchRoleCards(user.institutionId, user.role),
        safeJson(`${API_BASE_URL}/admin/calendar/${user.institutionId}`),
        safeJson(`${API_BASE_URL}/notifications/${user.id}?limit=8`)
      ]);
      if (!alive) return;
      setUnread(typeof uc === 'number' ? uc : (uc?.count ?? uc?.unread ?? 0));
      setTt(timetable);
      setCardIds(cards);
      setEvents(Array.isArray(calRes) ? calRes : []);
      setNotes(Array.isArray(noteRes) ? noteRes : []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, persona]);

  if (loading) return <Spinner />;

  const entries = Array.isArray(tt?.entries) ? tt.entries : [];
  const days = Array.isArray(tt?.days) ? tt.days : [];
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayDay = days.find(d => (d.day_name || '').toLowerCase() === todayName.toLowerCase());
  const classesToday = todayDay ? entries.filter(e => e.day_id === todayDay.id).length : 0;
  const weeklyPeriods = entries.length;
  const distinctClasses = new Set(entries.map(e => e.class_id).filter(Boolean)).size;

  const VALUES = {
    my_class:             { value: tt?.class_label || '—', isText: true },
    teaching_classes:     { value: distinctClasses },
    classes_today:        { value: classesToday, sub: todayName },
    weekly_periods:       { value: weeklyPeriods },
    unread_notifications: { value: unread }
  };

  const base = (cardIds || PERSONA_DEFAULTS[persona] || []).filter(id => {
    const c = cardById[id];
    return c && c.scope === 'self' && (!c.personas || c.personas.includes(persona));
  });
  const ids = gateByPermission(base, can);

  const heading = persona === 'student' ? 'Your day at a glance'
                : persona === 'teacher' ? 'Your teaching snapshot'
                : 'Your dashboard';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">

      <header className="mb-6 lg:mb-8 flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-zinc-500 max-w-[56ch]">{heading}.</p>
      </header>

      {ids.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 lg:mb-8">
          {ids.map(id => {
            const meta = SELF_META[id] || SELF_META.unread_notifications;
            const v = VALUES[id] || {};
            const Icon = meta.Icon;
            return (
              <div key={id} className={`p-4 rounded-md flex flex-col gap-1 ${SELF_TINT[meta.tint]}`}>
                <span className="text-[10px] font-semibold uppercase tracking-wider truncate flex items-center gap-1.5">
                  <Icon className="size-3.5 shrink-0" /> {cardById[id]?.label || id}
                </span>
                <span className={`${v.isText ? 'text-xl' : 'text-2xl tabular-nums'} font-semibold text-zinc-900 truncate`} title={String(v.value)}>
                  {v.value}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 truncate">{v.sub ?? meta.sub}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Events | Notifications for everyone */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        <EventsPanel events={events} />
        <NotificationsPanel notes={notes} />
      </div>
    </div>
  );
}