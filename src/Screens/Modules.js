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
    id: 'Attendance',
    module_name: 'Attendance',
    label: 'Attendance',
    title: 'Attendance',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/17163/17163937.png',
    navigateTo: '/Attendance'
  },
  {
    id: 'Exams',
    module_name: 'Exams',
    label: 'Exams',
    title: 'Exams',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/207/207190.png',
    navigateTo: '/Exams'
  },
  { 
    id: 'profile',   
    module_name: 'Profile',       
    label: 'Profile',       
    alwaysVisible: true,     // Everyone can access
    hideFromSidebar: true    // Hidden from the main list
  },
];

export const MODULE_NAMES = MODULES.map(m => m.module_name);

export const TAB_TO_MODULE = MODULES.reduce((acc, m) => {
  acc[m.id] = m.module_name;
  return acc;
}, {});