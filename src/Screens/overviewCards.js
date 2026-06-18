// =====================================================================
//  overviewCards.js — single source of truth for the Overview dashboard.
//
//  Each entry: { id, label, kind, render?, requiresModule?, desc, audience }
//    kind:   'kpi'  -> a box in the "Above Section" grid
//            'panel'-> a full section (Performance / Events / Notifications)
//    render: 'stat' (default number box) | 'live' (live-class card)
//            | 'gauge' (circular % card)
//    requiresModule -> hidden for roles without that module's view access
//    desc / audience -> shown in Settings so it's clear which box is for whom
//
//  Default for every role = ALL_CARD_IDS (everything on). The Super Admin
//  trims and ORDERS per role in Overview Settings. The saved order of the
//  KPI ids is the on-screen order of the boxes.
//
//  Place this in the same folder as Overview.jsx (Screens/).
// =====================================================================

export function getPersona(role) {
  const r = (role || '').toLowerCase();
  if (r.includes('student')) return 'student';
  if (r.includes('teacher')) return 'teacher';
  const adminKeys = [
    'super admin', 'developer', 'admin', 'principal', 'headmaster',
    'headmistress', 'director', 'vice principal', 'coordinator', 'management'
  ];
  if (adminKeys.some(k => r.includes(k))) return 'admin';
  return 'staff';
}

export const OVERVIEW_CARDS = [
  // ---- ABOVE SECTION: stat boxes ----
  { id: 'total_users',     label: 'Total Users',      kind: 'kpi', render: 'stat', audience: 'Admins',              desc: 'School-wide count of all user accounts.' },
  { id: 'students',        label: 'Students',         kind: 'kpi', render: 'stat', audience: 'Admins',              desc: 'School-wide count of enrolled students.' },
  { id: 'teachers_staff',  label: 'Teachers / Staff', kind: 'kpi', render: 'stat', audience: 'Admins',              desc: 'School-wide count of teachers and staff.' },
  { id: 'classes',         label: 'Classes',          kind: 'kpi', render: 'stat', audience: 'Admins',              desc: 'Number of classes configured.' },
  { id: 'roles',           label: 'Roles Defined',    kind: 'kpi', render: 'stat', audience: 'Admins',              desc: 'Number of roles defined for the school.' },
  { id: 'active_year',     label: 'Active Year',      kind: 'kpi', render: 'stat', audience: 'Admins',              desc: 'The current active academic year.' },

  { id: 'my_class',        label: 'My Class',         kind: 'kpi', render: 'stat', requiresModule: 'Timetable', audience: 'Students', desc: "The signed-in student's own class." },
  { id: 'teaching_classes',label: 'Classes I Teach',  kind: 'kpi', render: 'stat', requiresModule: 'Timetable', audience: 'Teachers', desc: 'How many classes the teacher takes this week.' },
  { id: 'classes_today',   label: 'Classes Today',    kind: 'kpi', render: 'stat', requiresModule: 'Timetable', audience: 'Students & Teachers', desc: "Count of the user's classes scheduled today." },
  { id: 'weekly_periods',  label: 'Weekly Periods',   kind: 'kpi', render: 'stat', requiresModule: 'Timetable', audience: 'Students & Teachers', desc: "Total periods on the user's weekly timetable." },

  { id: 'live_class',      label: 'Live Class',       kind: 'kpi', render: 'live',  requiresModule: 'Timetable',   audience: 'Students & Teachers', desc: 'The class happening right now with a live countdown; shows “no class” when free.' },
  { id: 'attendance_pct',  label: 'My Attendance %',  kind: 'kpi', render: 'gauge', requiresModule: 'Attendance',  audience: 'Students & Teachers', desc: "The user's own attendance % for the academic year." },
  { id: 'performance_pct', label: 'My Performance %', kind: 'kpi', render: 'gauge', requiresModule: 'Performance', audience: 'Students & Teachers', desc: 'Students: own overall result. Teachers: their assigned classes’ result.' },

  // ---- DASHBOARD SECTIONS ----
  { id: 'performance_analytics', label: 'Performance Analytics', kind: 'panel', requiresModule: 'Performance',       audience: 'Admins',   desc: 'School-wide Top Performers / Top Classes charts.' },
  { id: 'events_panel',          label: 'Upcoming Events',       kind: 'panel', requiresModule: 'Academic Calendar', audience: 'Everyone', desc: 'Upcoming events pulled from the calendar.' },
  { id: 'notifications_panel',   label: 'Recent Notifications',  kind: 'panel',                                      audience: 'Everyone', desc: 'The latest notifications for this user.' }
];

export const cardById    = OVERVIEW_CARDS.reduce((a, c) => { a[c.id] = c; return a; }, {});
export const KPI_CARDS   = OVERVIEW_CARDS.filter(c => c.kind === 'kpi');
export const PANEL_CARDS = OVERVIEW_CARDS.filter(c => c.kind === 'panel');
export const ALL_CARD_IDS = OVERVIEW_CARDS.map(c => c.id);

// Keep saved ids in a stable shape: KPI ids first (their chosen order),
// then panel ids. KPI order = on-screen box order.
export function normalizeIds(ids) {
  const set = new Set(ids);
  const kp = ids.filter(i => cardById[i]?.kind === 'kpi');
  const pn = ids.filter(i => cardById[i]?.kind === 'panel');
  return [...kp, ...pn].filter(i => set.has(i) && cardById[i]);
}