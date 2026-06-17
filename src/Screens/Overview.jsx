import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from './PermissionsContext';
import { API_BASE_URL } from '../apiConfig';
import {
  Check, ShieldCheck, Bell, GraduationCap, Users, Clock, CalendarClock,
  BookOpen, Settings
} from 'lucide-react';
import { getPersona, PERSONA_DEFAULTS, cardById } from './overviewCards';
import OverviewSettingsModal from './OverviewSettingsModal';

// =====================================================================
//  Overview — persona layout + per-role configurable cards.
//
//  • Persona (getPersona) decides the layout: admin = school-wide,
//    everyone else = personal.
//  • Which cards show is driven by the Super Admin's saved config for the
//    user's role (GET /overview-config/resolve). No config -> persona
//    default. The render ALSO gates each card by the current user's module
//    permissions (can(module,'view')), so permissions remain the hard rule.
//  • The gear (Overview Settings) is Super-Admin-only.
// =====================================================================

const Spinner = () => (
  <div className="h-96 flex items-center justify-center">
    <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
  </div>
);

// Resolve the saved card list for a role, or null if unset.
async function fetchRoleCards(instId, role) {
  try {
    const res = await fetch(`${API_BASE_URL}/overview-config/resolve?instId=${encodeURIComponent(instId)}&role=${encodeURIComponent(role)}`);
    if (!res.ok) return null;
    const d = await res.json();
    return Array.isArray(d?.card_ids) ? d.card_ids : null;
  } catch { return null; }
}

// Keep only cards the current user is actually allowed to see.
function gateByPermission(ids, can) {
  return ids.filter(id => {
    const card = cardById[id];
    if (!card) return false;
    if (!card.requiresModule) return true;
    return can(card.requiresModule, 'view');
  });
}

export default function Overview() {
  const { user } = useAuth();
  const persona = getPersona(user?.role);
  return persona === 'admin'
    ? <AdminOverview user={user} />
    : <SelfOverview user={user} persona={persona} />;
}

// School-wide tints/values, keyed by card id.
const SCHOOL_TINT = {
  total_users:    'hero',
  students:       'accent',
  teachers_staff: 'emerald',
  classes:        'violet',
  roles:          'amber',
  active_year:    'sky'
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
  const [data, setData] = useState(null);
  const [cardIds, setCardIds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isSuperAdmin = (user?.role || '') === 'Super Admin';

  useEffect(() => {
    if (!user?.institutionId) return;
    let alive = true;
    (async () => {
      const [adminRes, cards] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`).then(r => r.json()).catch(() => null),
        fetchRoleCards(user.institutionId, user.role)
      ]);
      if (!alive) return;
      setData(adminRes);
      setCardIds(cards);
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

  // config (or default) -> permission gate -> catalog order
  const wanted = gateByPermission(cardIds || PERSONA_DEFAULTS.admin, can);
  const orderedIds = Object.keys(SCHOOL_TINT).filter(id => wanted.includes(id));

  const steps = [
    { id: 1, title: "Manage Logins", desc: "Create the roles your school needs.", done: data.roles.length > 0 },
    { id: 2, title: "Classes", desc: "Create every class with applicable sections.", done: data.classes.length > 0 },
    { id: 3, title: "Academics", desc: "Create the current academic year and set as active.", done: !!activeYear },
    { id: 4, title: "Users", desc: "Add Teachers, Students, Admins, etc.", done: data.users.length > 1 },
    { id: 5, title: "Permissions", desc: "Configure module access per role.", done: false },
    { id: 6, title: "Promotion", desc: "Move students up at the end of the year.", done: false }
  ];

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

      {orderedIds.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 lg:mb-8">
          {orderedIds.map(id => (
            <KpiBox key={id} tint={SCHOOL_TINT[id]} label={cardById[id].label} {...VALUES[id]} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-zinc-900 mb-1">Quick Start Checklist</h2>
            <p className="text-[11px] text-zinc-500 mb-6">
              New here? Set things up in this order. Steps will automatically check off as you complete them.
            </p>
            <div className="space-y-4">
              {steps.map(s => (
                <div key={s.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 size-4 rounded flex items-center justify-center shrink-0 ${s.done ? "bg-primary border-primary" : "border border-zinc-300 bg-zinc-50"}`}>
                    {s.done && <Check className="size-2.5 text-white shrink-0" strokeWidth={3} />}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-xs font-semibold ${s.done ? "text-zinc-400 line-through" : "text-zinc-900"}`}>{s.title}</span>
                    <span className="text-[10px] text-zinc-500 leading-relaxed">{s.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">System Status</h2>
            <div className="flex items-center gap-3 p-3 bg-green-50/50 border border-green-100 rounded-md">
              <div className="size-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="size-4 text-green-600 shrink-0" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-900">All Systems Operational</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Database connection stable</p>
              </div>
            </div>
          </div>
        </div>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const safe = async (url) => {
        try { const r = await fetch(url); return r.ok ? await r.json() : null; }
        catch { return null; }
      };
      const [uc, timetable, cards] = await Promise.all([
        safe(`${API_BASE_URL}/notifications/${user.id}/unread-count`),
        persona === 'staff' ? Promise.resolve(null) : safe(`${API_BASE_URL}/timetable/my/${user.id}`),
        fetchRoleCards(user.institutionId, user.role)
      ]);
      if (!alive) return;
      setUnread(typeof uc === 'number' ? uc : (uc?.count ?? uc?.unread ?? 0));
      setTt(timetable);
      setCardIds(cards);
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

  // config (or persona default) -> keep cards valid for this persona -> permission gate
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

      <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6 flex items-start gap-3">
        <div className="size-9 rounded-md bg-primary/5 ring-1 ring-primary/15 text-primary flex items-center justify-center shrink-0">
          <BookOpen className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {persona === 'student' ? 'Everything you need is in the menu'
             : persona === 'teacher' ? 'Your classes and tools are in the menu'
             : 'Your modules are in the menu'}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Open Timetable, Homework, Attendance and more from the sidebar. New activity shows up in Notifications.
          </p>
        </div>
      </div>
    </div>
  );
}