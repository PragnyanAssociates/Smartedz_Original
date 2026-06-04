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
    navigateTo: '/AcademicCalendar',
    hideFromSidebar: true    // Hidden from the main list (accessed via top header icon)
  },
  {
    id: 'attendance',
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
    id: 'reports',
    module_name: 'Reports',
    label: 'Reports',
    title: 'Reports',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/3029/3029337.png',
    navigateTo: '/Reports'
  },
  {
    id: 'Performance',
    module_name: 'Performance',
    label: 'Performance',
    title: 'Performance',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/939/939354.png',
    navigateTo: '/Performance'
  },
  { 
    id: 'profile',   
    module_name: 'Profile',       
    label: 'Profile',       
    alwaysVisible: true,     // Everyone can access
    hideFromSidebar: true    // Hidden from the main list (accessed via bottom card)
  },
  { 
    id: 'notifications',   
    module_name: 'Notifications',       
    label: 'Notifications',       
    alwaysVisible: true,     // Everyone can access
    hideFromSidebar: true    // Hidden from the main list (accessed via top header icon)
  },
  {
    id: 'Directory',
    module_name: 'Directory',
    label: 'Directory',
    title: 'Directory',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/2245/2245320.png',
    navigateTo: '/Directory'
  },
  {
    id: 'Gallery',
    module_name: 'Gallery', // Must match backend exactly
    label: 'Gallery',
    title: 'School Gallery',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png',
    navigateTo: '/Gallery'
  },
  {
    id: 'Homework',
    module_name: 'Homework', // Must match backend exactly
    label: 'Homework',
    title: 'Homework',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/5027/5027360.png',
    navigateTo: '/Homework'
  },
  {
    id: 'Meals',
    module_name: 'Meals', // Must match backend exactly
    label: 'Meals',
    title: 'Meals',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/2515/2515189.png',
    navigateTo: '/Meals'
  },
  {
    id: 'PTM',
    module_name: 'PTM', // Must match the string in DEFAULT_MODULES
    label: 'PTM Schedule',
    title: 'PTM Schedule',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/4144/4144517.png', 
    navigateTo: '/PTM'
  },
  {
    id: 'OnlineClasses',
    module_name: 'OnlineClasses', // Must match the string in DEFAULT_MODULES
    label: 'Online Classes',
    title: 'Online Classes',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/8388/8388104.png', 
    navigateTo: '/OnlineClasses'
  },
  {
    id: 'DigitalLabs',
    module_name: 'DigitalLabs', // Must match the string in DEFAULT_MODULES
    label: 'Digital Labs',
    title: 'Digital Labs',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/19011/19011142.png', 
    navigateTo: '/DigitalLabs'
  },
  {
    id: 'PreAdmissions',
    module_name: 'PreAdmissions',
    label: 'Pre Admissions',
    title: 'Pre Admissions',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/10220/10220958.png',
    navigateTo: '/PreAdmissionsScreen'
  },
  {
    id: 'StudyMaterials',
    module_name: 'StudyMaterials',
    label: 'Study Materials',
    title: 'Study Materials',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/3273/3273259.png',
    navigateTo: '/StudyMaterialsScreen'
  },
  {
    id: 'Syllabus',
    module_name: 'Syllabus',
    label: 'Syllabus',
    title: 'Syllabus',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/1584/1584937.png',
    navigateTo: '/Syllabus'
  },
  {
    id: 'GroupChat',
    module_name: 'GroupChat',
    label: 'GroupChat',
    title: 'GroupChat',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/6576/6576146.png',
    navigateTo: '/WhatsAppLayout'
  },
  {
    id: 'Alumni',
    module_name: 'Alumni',
    label: 'Alumni',
    title: 'Alumni',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/4696/4696859.png',
    navigateTo: '/Alumni'
  },
  {
    id: 'LessonPlan',
    module_name: 'LessonPlan',
    label: 'LessonPlan',
    title: 'LessonPlan',
    imageSource: 'https://cdn-icons-png.flaticon.com/128/5341/5341025.png',
    navigateTo: '/LessonPlan'
  }
];

export const MODULE_NAMES = MODULES.map(m => m.module_name);

export const TAB_TO_MODULE = MODULES.reduce((acc, m) => {
  acc[m.id] = m.module_name;
  return acc;
}, {});