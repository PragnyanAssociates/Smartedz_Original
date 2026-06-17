// =====================================================================
//  overviewCards.js — single source of truth for the Overview dashboard.
//
//  • OVERVIEW_CARDS: every card the dashboard can show. Add a card here
//    and it automatically appears in the Settings picker and renders in
//    the Overview. `requiresModule` ties a card to a module so the
//    Overview can hide it for users who can't access that module
//    (permissions stay the hard gate).
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

// scope: 'school' = institution-wide aggregate (admin only),
//        'self'   = the signed-in user's own data.
// personas: which self-personas a 'self' card is relevant to.
// requiresModule: module_name that must be accessible to see the card.
export const OVERVIEW_CARDS = [
  // ---- school-wide (admin persona) ----
  { id: 'total_users',     label: 'Total Users',      scope: 'school' },
  { id: 'students',        label: 'Students',         scope: 'school' },
  { id: 'teachers_staff',  label: 'Teachers / Staff', scope: 'school' },
  { id: 'classes',         label: 'Classes',          scope: 'school' },
  { id: 'roles',           label: 'Roles Defined',    scope: 'school' },
  { id: 'active_year',     label: 'Active Year',      scope: 'school' },

  // ---- personal (student / teacher / staff) ----
  { id: 'my_class',          label: 'My Class',            scope: 'self', personas: ['student'],            requiresModule: 'Timetable' },
  { id: 'teaching_classes',  label: 'Classes I Teach',     scope: 'self', personas: ['teacher'],            requiresModule: 'Timetable' },
  { id: 'classes_today',     label: 'Classes Today',       scope: 'self', personas: ['student', 'teacher'], requiresModule: 'Timetable' },
  { id: 'weekly_periods',    label: 'Weekly Periods',      scope: 'self', personas: ['student', 'teacher'], requiresModule: 'Timetable' },
  { id: 'unread_notifications', label: 'Unread Notifications', scope: 'self', personas: ['student', 'teacher', 'staff'] }
];

export const cardById = OVERVIEW_CARDS.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

export const PERSONA_DEFAULTS = {
  admin:   ['total_users', 'students', 'teachers_staff', 'classes', 'roles', 'active_year'],
  student: ['my_class', 'classes_today', 'weekly_periods', 'unread_notifications'],
  teacher: ['teaching_classes', 'classes_today', 'weekly_periods', 'unread_notifications'],
  staff:   ['unread_notifications']
};

// Cards a given role is ALLOWED to be configured with (before per-user
// permission gating). Admin roles get school cards; everyone else gets the
// self cards relevant to their persona.
export function cardsForPersona(persona) {
  if (persona === 'admin') return OVERVIEW_CARDS.filter(c => c.scope === 'school');
  return OVERVIEW_CARDS.filter(c => c.scope === 'self' && (!c.personas || c.personas.includes(persona)));
}