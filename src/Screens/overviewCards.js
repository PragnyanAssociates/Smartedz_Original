// =====================================================================
//  overviewCards.js — single source of truth for the Overview dashboard.
//
//  • OVERVIEW_CARDS: every card AND section the dashboard can show. Add
//    an entry here and it automatically appears in the Settings picker
//    and renders in the Overview.
//      - kind: 'kpi'   -> a small stat box in the top grid
//      - kind: 'panel' -> a full section (Performance Analytics, Events,
//                         Notifications)
//    `personas` lists which personas may be offered/shown the entry.
//    `requiresModule` ties it to a module so the Overview hides it for
//    users who can't access that module (permissions stay the hard gate).
//  • getPersona(role): coarse bucket a role falls into.
//  • PERSONA_DEFAULTS: what each persona shows when a Super Admin hasn't
//    configured that role yet (so the feature works out of the box).
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
  // ---- KPI stat boxes: admin / leadership ----
  { id: 'total_users',    label: 'Total Users',      kind: 'kpi', personas: ['admin'] },
  { id: 'students',       label: 'Students',         kind: 'kpi', personas: ['admin'] },
  { id: 'teachers_staff', label: 'Teachers / Staff', kind: 'kpi', personas: ['admin'] },
  { id: 'classes',        label: 'Classes',          kind: 'kpi', personas: ['admin'] },
  { id: 'roles',          label: 'Roles Defined',    kind: 'kpi', personas: ['admin'] },
  { id: 'active_year',    label: 'Active Year',      kind: 'kpi', personas: ['admin'] },

  // ---- KPI stat boxes: student / teacher / staff ----
  { id: 'my_class',             label: 'My Class',             kind: 'kpi', personas: ['student'],                     requiresModule: 'Timetable' },
  { id: 'teaching_classes',     label: 'Classes I Teach',      kind: 'kpi', personas: ['teacher'],                     requiresModule: 'Timetable' },
  { id: 'classes_today',        label: 'Classes Today',        kind: 'kpi', personas: ['student', 'teacher'],          requiresModule: 'Timetable' },
  { id: 'weekly_periods',       label: 'Weekly Periods',       kind: 'kpi', personas: ['student', 'teacher'],          requiresModule: 'Timetable' },
  { id: 'unread_notifications', label: 'Unread Notifications', kind: 'kpi', personas: ['student', 'teacher', 'staff'] },

  // ---- Full sections ----
  { id: 'performance_analytics', label: 'Performance Analytics', kind: 'panel', personas: ['admin'],                              requiresModule: 'Performance' },
  { id: 'events_panel',          label: 'Upcoming Events',       kind: 'panel', personas: ['admin', 'student', 'teacher', 'staff'], requiresModule: 'Academic Calendar' },
  { id: 'notifications_panel',   label: 'Recent Notifications',  kind: 'panel', personas: ['admin', 'student', 'teacher', 'staff'] }
];

export const cardById = OVERVIEW_CARDS.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

export const PERSONA_DEFAULTS = {
  admin: [
    'total_users', 'students', 'teachers_staff', 'classes', 'roles', 'active_year',
    'performance_analytics', 'events_panel', 'notifications_panel'
  ],
  student: ['my_class', 'classes_today', 'weekly_periods', 'unread_notifications', 'events_panel', 'notifications_panel'],
  teacher: ['teaching_classes', 'classes_today', 'weekly_periods', 'unread_notifications', 'events_panel', 'notifications_panel'],
  staff:   ['unread_notifications', 'events_panel', 'notifications_panel']
};

// Everything a persona may be offered in Settings (before per-user
// permission gating, which the Overview applies at render).
export function cardsForPersona(persona) {
  return OVERVIEW_CARDS.filter(c => !c.personas || c.personas.includes(persona));
}