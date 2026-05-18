// =====================================================================
//  SmartEdz ERP - Module Registry (single source of truth)
//
//  Every dashboard module is defined HERE once. The sidebar reads from
//  it, the Permissions matrix reads from it, and the access guard reads
//  from it.
//
//  IMPORTANT: `module_name` is what gets stored in the `permissions`
//  table AND what the backend's DEFAULT_MODULES list contains. The
//  two must match byte-for-byte or saved permissions become invisible.
// =====================================================================

export const MODULES = [
  {
    id: 'overview',
    module_name: 'Overview',
    label: 'Overview',
    title: 'Overview',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/8899/8899687.png',
    navigateTo: '/Dashboard',
    alwaysVisible: true
  },
  {
    id: 'manage-login',
    module_name: 'Manage Logins',
    label: 'Manage Logins',
    title: 'Manage Logins',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/15096/15096966.png',
    navigateTo: '/ManageLogins'
  },
  {
    id: 'timetable',
    module_name: 'Timetable',
    label: 'Timetable',
    title: 'Timetable',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/8576/8576510.png',
    navigateTo: '/Timetable'
  },
  {
    id: 'academic-calendar',
    module_name: 'Academic Calendar',
    label: 'Academic Calendar',
    title: 'Academic Calendar',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/668/668278.png',
    navigateTo: '/AcademicCalendar'
  },
  {
    // Profile is reachable via the sidebar avatar tile, not the main menu.
    // alwaysVisible: true → no permission check (every user can view their own).
    // hideFromSidebar: true → the main sidebar navigation skips this entry.
    id: 'profile',
    module_name: 'Profile',
    label: 'Profile',
    title: 'Profile',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/1077/1077063.png',
    navigateTo: '/Profile',
    alwaysVisible: true,
    hideFromSidebar: true
  }
];

export const MODULE_NAMES = MODULES.map(m => m.module_name);

export const TAB_TO_MODULE = MODULES.reduce((acc, m) => {
  acc[m.id] = m.module_name;
  return acc;
}, {});