// =====================================================================
//  Smarty — built-in knowledge pack  (ships with the app, zero setup)
//
//  Each entry is role-aware. `roles` is 'all' or an array of lowercased
//  role fragments matched with "includes" against the user's role.
//  A `link` (a Modules.js id) renders an "Open …" shortcut button.
//
//  LIVE_IDS are answered from live bootstrap data in Smarty.jsx.
//  Student-only live cards (homework/attendance/next-class) are tagged so
//  staff/admins never see class-based questions.
// =====================================================================

export const LIVE_IDS = ['next-class', 'hw-today', 'attendance', 'cal-today', 'cal-next-holiday', 'cal-month', 'my-notifications'];

export const BUILTINS = [
  // ---- LIVE (filled from bootstrap) — only for people who HAVE a class ----
  { id: 'next-class', q: 'My next class', roles: ['student', 'teacher', 'parent'], tone: 'sky', icon: '🔔',
    keywords: ['next class', 'my class', 'do i have class', 'what class', 'class now', 'timetable', 'period', 'upcoming class'] },
  { id: 'hw-today', q: 'Homework today?', roles: ['student', 'parent'], tone: 'amber', icon: '📚',
    keywords: ['homework today', 'any homework', 'hw today', 'homework for me', 'do i have homework', 'homework due', 'pending homework'] },
  { id: 'attendance', q: 'My attendance', roles: ['student', 'parent'], tone: 'emerald', icon: '🗓️',
    keywords: ['attendance', 'present', 'absent', 'my attendance', 'how many days'] },
  { id: 'cal-today', q: "What's on today?", roles: 'all', tone: 'sky', icon: '🗓️',
    keywords: ['today', "what's on", 'whats on today', 'is there holiday today', 'any holiday today', 'event today', 'events today', 'anything today', 'school today', 'school event today', 'is today a holiday', 'do we have school'] },
  { id: 'cal-next-holiday', q: "Next holiday?", roles: 'all', tone: 'emerald', icon: '🏖️',
    keywords: ['next holiday', 'upcoming holiday', 'when holiday', 'coming holiday', 'next festival', 'upcoming festival', 'when is the next holiday', 'holidays coming', 'next day off', 'vacation'] },
  { id: 'cal-month', q: "Events this month", roles: 'all', tone: 'sky', icon: '📆',
    keywords: ['this month', 'events this month', 'calendar this month', 'month events', 'whats happening this month', 'upcoming events', 'coming events', 'schedule this month'] },
  { id: 'my-notifications', q: "My notifications", roles: 'all', tone: 'violet', icon: '🔔',
    keywords: ['notification', 'notifications', 'notices', 'notice', 'alerts', 'any notification', 'unread', 'do i have notifications', 'messages', 'announcements for me', 'any alerts'] },

  // ---- GUIDES (how-to) ----
  { id: 'how-calendar', q: 'How does the calendar work?', roles: 'all', tone: 'sky', icon: '❓',
    keywords: ['how calendar', 'academic calendar', 'add event', 'school events', 'mark holiday', 'where calendar'],
    answer: { text: "Here's how the Academic Calendar works 🗓️", link: 'academic-calendar', linkLabel: 'Open Calendar',
      steps: ['Open the **Academic Calendar** tab.', 'Browse month by month — today is circled, and every event is colour-coded by type.', 'Holidays, festivals, exams, meetings and events each have their own colour (see the legend).', 'Staff with edit access tap a day to add an event — and everyone gets a notification.'] } },
  { id: 'open-calendar', q: 'Open Academic Calendar', roles: 'all', tone: 'sky', icon: '📅',
    keywords: ['open calendar', 'calendar tab', 'go to calendar', 'school calendar', 'show calendar'],
    answer: { text: 'Opening the Academic Calendar 👇', link: 'academic-calendar', linkLabel: 'Open Calendar' } },
  { id: 'how-hw', q: 'How to submit homework?', roles: ['student', 'parent'], tone: 'violet', icon: '❓',
    keywords: ['how homework', 'submit homework', 'how to submit', 'homework help', 'upload homework'],
    answer: { text: "Here's how to submit homework 📝", link: 'Homework', linkLabel: 'Open Homework',
      steps: ['Open the **Homework** tab.', 'Tap the subject card marked **“Pending”**.', 'Read the task, then tap **Submit / Mark done**.', 'Attach a photo or note if your teacher asked for one.'] } },
  { id: 'how-attend', q: 'How do I see attendance?', roles: ['student', 'parent', 'teacher'], tone: 'emerald', icon: '❓',
    keywords: ['how attendance', 'view attendance', 'check attendance', 'where attendance'],
    answer: { text: "Checking attendance is easy 📅", link: 'attendance', linkLabel: 'Open Attendance',
      steps: ['Open the **Attendance** tab.', 'Your day-by-day record and total % are shown.', 'Use the year filter to see a past academic year.'] } },
  { id: 'how-fees', q: 'How do I pay fees?', roles: ['student', 'parent'], tone: 'rose', icon: '❓',
    keywords: ['how fees', 'pay fees', 'fee payment', 'how to pay', 'online payment'],
    answer: { text: "Here's how fee payment works 💳", link: 'FeeManagement', linkLabel: 'Open My Fee',
      steps: ['Open the **Fee Management** tab.', 'Your instalments and due dates are listed.', 'Tap **Pay** on a due instalment to pay online.', 'A receipt is saved once payment succeeds.'] } },
  { id: 'how-report', q: 'Where is my report card?', roles: ['student', 'parent', 'teacher'], tone: 'brand', icon: '❓',
    keywords: ['report card', 'progress card', 'marks report', 'results', 'how marks report'],
    answer: { text: "Your progress report card lives in Reports 📄", link: 'reports', linkLabel: 'Open Reports',
      steps: ['Open the **Reports** tab.', 'Go to **Report Cards** and pick the student.', 'Download or print the progress card from there.'] } },
  { id: 'how-marks', q: 'How do I enter marks?', roles: ['teacher'], tone: 'violet', icon: '✏️',
    keywords: ['enter marks', 'how marks', 'marks entry', 'add marks', 'exam marks', 'put marks'],
    answer: { text: "Entering marks takes 4 steps ✏️", link: 'reports', linkLabel: 'Open Reports',
      steps: ['Go to **Reports → Marks Entry**.', 'Pick the **class** and the **exam type** (UT-1, AT-1…).', 'Type each student’s marks — totals update live.', 'Tap **Save Marks**. It also feeds Performance.'] } },
  { id: 'how-timetable', q: 'How do I see the timetable?', roles: ['student', 'parent', 'teacher'], tone: 'sky', icon: '❓',
    keywords: ['how timetable', 'see timetable', 'class schedule', 'periods'],
    answer: { text: "The full week is in the Timetable 🗓️", link: 'timetable', linkLabel: 'Open Timetable',
      steps: ['Open the **Timetable** tab.', 'Day-by-day periods, teachers and rooms are shown.'] } },
  { id: 'how-library', q: 'How does the Library work?', roles: 'all', tone: 'brand', icon: '📚',
    keywords: ['library', 'borrow book', 'return book', 'due book', 'issue book'],
    answer: { text: "Here's how the Library works 📚", link: 'Library', linkLabel: 'Open Library',
      steps: ['Open the **Library** tab to see issued books.', 'Each book shows its **due date**.', 'Smarty reminds you 3 days before a book is due.'] } },

  // ---- STUDENT/PARENT action shortcuts ----
  { id: 'open-hw', q: 'Open Homework', roles: ['student', 'teacher', 'parent'], tone: 'brand', icon: '➡️',
    keywords: ['open homework', 'go to homework', 'homework tab', 'show homework'],
    answer: { text: 'Sure — opening Homework 👇', link: 'Homework', linkLabel: 'Open Homework' } },
  { id: 'open-fees', q: 'Open My Fee', roles: ['student', 'parent'], tone: 'rose', icon: '💳',
    keywords: ['open fee', 'my fee', 'fee tab', 'go to fees', 'fees due', 'pending fee', 'fee balance'],
    answer: { text: 'Opening your fee details 👇', link: 'FeeManagement', linkLabel: 'Open My Fee' } },

  // ---- STAFF / ADMIN shortcuts (no class / homework / attendance cards) ----
  { id: 'admin-reports', q: 'Open Reports', roles: 'all', tone: 'brand', icon: '📊',
    keywords: ['reports', 'report card', 'marks report', 'open reports', 'exam report'],
    answer: { text: 'Opening Reports 👇', link: 'reports', linkLabel: 'Open Reports' } },
  { id: 'admin-fees', q: 'Open Fee Management', roles: 'all', tone: 'rose', icon: '💰',
    keywords: ['fee management', 'collect fee', 'open fee management', 'fee report', 'student fees'],
    answer: { text: 'Opening Fee Management 👇', link: 'FeeManagement', linkLabel: 'Open Fee Management' } },
  { id: 'admin-directory', q: 'Find a student / staff', roles: 'all', tone: 'emerald', icon: '👥',
    keywords: ['directory', 'students list', 'staff list', 'find student', 'find staff', 'user list'],
    answer: { text: 'Opening the Directory 👇', link: 'Directory', linkLabel: 'Open Directory' } },
  { id: 'admin-attendance', q: 'Open Attendance', roles: 'all', tone: 'emerald', icon: '🗂️',
    keywords: ['mark attendance', 'attendance register', 'open attendance', 'take attendance'],
    answer: { text: 'Opening Attendance 👇', link: 'attendance', linkLabel: 'Open Attendance' } },
  { id: 'admin-smarty', q: 'Manage Smarty', roles: 'all', tone: 'violet', icon: '🤖',
    keywords: ['manage smarty', 'add question', 'post update', 'smarty admin', 'edit smarty', 'announcement'],
    answer: { text: 'Add questions & post app updates here 👇', link: 'SmartyAdmin', linkLabel: 'Open Smarty Assistant' } },

  // ---- EVERYONE: their own profile + the dashboard ----
  { id: 'my-profile', q: 'My profile', roles: 'all', tone: 'brand', icon: '🧑',
    keywords: ['my profile', 'profile', 'edit profile', 'change photo', 'change my picture', 'update phone', 'update my details', 'my account', 'my details', 'change number'],
    answer: { text: "Here's where your profile lives 🧑", link: 'profile', linkLabel: 'Open My Profile',
      steps: ['Open **Profile** (bottom of the menu / your avatar).', 'Tap **Edit Profile** to change your name, photo, phone, address or date of birth.', 'Your role and academic records are set by the school, so those stay read-only.'] } },
  { id: 'open-overview', q: 'Open Dashboard', roles: 'all', tone: 'sky', icon: '🏠',
    keywords: ['dashboard', 'overview', 'home', 'home screen', 'main screen', 'open dashboard'],
    answer: { text: 'Opening your Dashboard 👇', link: 'overview', linkLabel: 'Open Dashboard' } },

  // ---- SYSTEM CONFIGURATION (all tabs live inside Manage Logins; shown only
  //      to roles that can see it, so students/teachers never get these) ----
  { id: 'cfg-add-user', q: 'How do I add a user?', roles: 'all', tone: 'emerald', icon: '➕',
    keywords: ['add user', 'create user', 'new user', 'add student', 'add teacher', 'add staff', 'create login', 'new student', 'new teacher', 'register student', 'enroll student'],
    answer: { text: "Here's how to add a user 👤", link: 'manage-login', linkLabel: 'Open System Configuration',
      steps: ['Open **System Configuration → Users**.', 'Tap **New User**, fill name, login details and pick a **Role**.', 'For a student, also set the **class** and a **roll number**.', 'Save — the role alone decides what they can see.'] } },
  { id: 'cfg-roles', q: 'How do I create a role?', roles: 'all', tone: 'violet', icon: '🛡️',
    keywords: ['role', 'roles', 'add role', 'create role', 'new role', 'custom role', 'principal role', 'accountant role'],
    answer: { text: "Roles are set in System Configuration 🛡️", link: 'manage-login', linkLabel: 'Open System Configuration',
      steps: ['Open **System Configuration → Roles**.', 'Tap **Add Role** and name it (e.g. Principal, Accountant).', 'A new role sees nothing until you grant it modules.', 'Go to **Permissions** next to give it access.'] } },
  { id: 'cfg-permissions', q: 'How do I give module access?', roles: 'all', tone: 'brand', icon: '🔑',
    keywords: ['permission', 'permissions', 'give access', 'module access', 'grant access', 'hide module', 'who can see', 'access control', 'read edit delete'],
    answer: { text: "Set what each role can see in Permissions 🔑", link: 'manage-login', linkLabel: 'Open System Configuration',
      steps: ['Open **System Configuration → Permissions**.', 'Pick the **role** at the top right.', 'Tick **Read** to grant a module, then **Edit / Delete** for more.', '**Hide** removes it from their sidebar entirely. Save.'] } },
  { id: 'cfg-classes', q: 'How do I add a class?', roles: 'all', tone: 'sky', icon: '🏫',
    keywords: ['class', 'classes', 'add class', 'create class', 'section', 'sections', 'add section', 'new class'],
    answer: { text: "Classes & sections are in System Configuration 🏫", link: 'manage-login', linkLabel: 'Open System Configuration',
      steps: ['Open **System Configuration → Classes**.', 'Tap **Add Class**, type the name (e.g. Class 5).', 'Tick **has sections** and add A, B, C… in one go.', 'Attendance, timetable, fees and reports all hang off this.'] } },
  { id: 'cfg-subjects', q: 'How do I add a subject?', roles: 'all', tone: 'amber', icon: '📘',
    keywords: ['subject', 'subjects', 'add subject', 'assign subject', 'create subject', 'subject to class'],
    answer: { text: "Subjects are managed in System Configuration 📘", link: 'manage-login', linkLabel: 'Open System Configuration',
      steps: ['Open **System Configuration → Subjects**.', 'Tap **Add Subject** and name it.', 'Choose where it applies — **Timetable**, **Report Card**, or both.', 'Tick the classes that study it, then Save.'] } },
  { id: 'cfg-academics', q: 'How do I set the academic year?', roles: 'all', tone: 'sky', icon: '📅',
    keywords: ['academic year', 'new year', 'active year', 'set active year', 'change year', 'school year', 'session year'],
    answer: { text: "The academic year drives the whole app 📅", link: 'manage-login', linkLabel: 'Open System Configuration',
      steps: ['Open **System Configuration → Academics Year**.', 'Add the year (e.g. 2026-2027) and **Set as Active**.', 'New attendance, marks and fees stamp to the active year.', 'Switching years is safe — old data reappears when you switch back.'] } },
  { id: 'cfg-promotion', q: 'How do I promote students?', roles: 'all', tone: 'emerald', icon: '⬆️',
    keywords: ['promote', 'promotion', 'move students', 'pass out', 'passout', 'next class promotion', 'promote class', 'alumni promote'],
    answer: { text: "Promotion moves a class up a year ⬆️", link: 'manage-login', linkLabel: 'Open System Configuration',
      steps: ['First set the **new academic year active** (Academics Year).', 'Open **System Configuration → Promotion**.', 'Pick a class and promote its students to the next class.', 'Leaving students are **passed out to Alumni** from here.'] } },
  { id: 'cfg-inactive', q: 'How do I deactivate a user?', roles: 'all', tone: 'rose', icon: '🚫',
    keywords: ['inactive', 'deactivate', 'disable login', 'block login', 'reactivate', 'suspend user', 'remove login'],
    answer: { text: "Deactivate keeps the record but blocks login 🚫", link: 'manage-login', linkLabel: 'Open System Configuration',
      steps: ['In **Users**, edit the person and set status to **Inactive** (safer than Delete).', 'They move to the **Inactive** tab and drop out of live counts.', 'Use **Reactivate** there to restore them anytime.', 'Delete is permanent — prefer Inactive for people who may return.'] } },
  { id: 'cfg-downloads', q: 'How do I export data?', roles: 'all', tone: 'brand', icon: '⬇️',
    keywords: ['download', 'export', 'excel', 'backup', 'export users', 'download data', 'export excel', 'spreadsheet'],
    answer: { text: "Exports live in the Downloads tab ⬇️", link: 'manage-login', linkLabel: 'Open System Configuration',
      steps: ['Open **System Configuration → Downloads**.', 'Pull users and records out as Excel files.', 'Files download straight to your device — handle them carefully, they hold personal data.'] } },
  { id: 'cfg-subscription', q: 'Check our subscription', roles: 'all', tone: 'amber', icon: '💳',
    keywords: ['subscription', 'plan', 'renew', 'expiry', 'license', 'validity', 'plan expiry', 'renew plan'],
    answer: { text: "Your plan status is in System Configuration 💳", link: 'manage-login', linkLabel: 'Open System Configuration',
      steps: ['Open **System Configuration → Subscription**.', 'The banner shows your plan and days remaining.', 'Green = fine, amber = under a month, red = a week or less.', 'Plans are set by SmartEdz — contact your rep to renew.'] } },

  // ---- ADMISSIONS PIPELINE + DIRECTORY (gated by module visibility) ----
  { id: 'how-preadmissions', q: 'How do pre-admissions work?', roles: 'all', tone: 'sky', icon: '🆔',
    keywords: ['pre admission', 'preadmission', 'pre-admission', 'new application', 'admission enquiry', 'apply student', 'pending application', 'add application', 'approve application', 'reject application', 'new admission enquiry'],
    answer: { text: "Pre-Admissions is your pending applicant list 🆔", link: 'PreAdmissions', linkLabel: 'Open Pre-Admissions',
      steps: ['Open **Pre-Admissions**.', 'Tap **+** to add an applicant — Admission No, Name and Joining Grade are required.', 'Review an application, then **Approve** or **Reject**.', 'That decision moves the record into the **Admissions** module.'] } },
  { id: 'open-preadmissions', q: 'Open Pre-Admissions', roles: 'all', tone: 'sky', icon: '🆔',
    keywords: ['open pre admission', 'open preadmission', 'go to pre admissions', 'pre admissions tab'],
    answer: { text: 'Opening Pre-Admissions 👇', link: 'PreAdmissions', linkLabel: 'Open Pre-Admissions' } },
  { id: 'how-admissions', q: 'Where are approved admissions?', roles: 'all', tone: 'emerald', icon: '🎓',
    keywords: ['admission', 'admissions', 'approved admission', 'admitted students', 'rejected admission', 'admission list', 'admission by year', 'who got admitted'],
    answer: { text: "Decided applications live in Admissions 🎓", link: 'Admissions', linkLabel: 'Open Admissions',
      steps: ['Open **Admissions**.', 'Switch between **Approved / Rejected** and pick a year.', 'Open a record to edit it or flip the decision.', 'Export the list to Excel anytime.'] } },
  { id: 'open-admissions', q: 'Open Admissions', roles: 'all', tone: 'emerald', icon: '🎓',
    keywords: ['open admissions', 'go to admissions', 'admissions tab'],
    answer: { text: 'Opening Admissions 👇', link: 'Admissions', linkLabel: 'Open Admissions' } },
  { id: 'how-directory', q: 'How do I find a profile?', roles: 'all', tone: 'brand', icon: '👥',
    keywords: ['student profile', 'staff profile', 'view profile', 'look up student', 'member profile', 'someone details', 'find a person', 'whose profile', 'teacher details', 'student details'],
    answer: { text: "The Directory holds every member's profile 👥", link: 'Directory', linkLabel: 'Open Directory',
      steps: ['Open the **Directory**.', 'Filter by role, or pick the **Student** tab and a class.', 'Search by name, username or email.', 'Open a card for full details — plus Performance, Attendance and Report Card, with a year filter for past years.'] } },
];

// Starter chips per role bucket. Smarty.jsx then drops any whose module
// the user can't see, and any live one with no data. "What's new?" is
// always appended automatically, so it's not listed here.
export const STARTERS_BY_ROLE = {
  student: ['next-class', 'cal-today', 'my-notifications', 'hw-today', 'attendance', 'cal-next-holiday'],
  parent:  ['next-class', 'cal-today', 'my-notifications', 'hw-today', 'attendance', 'open-fees'],
  teacher: ['next-class', 'cal-today', 'my-notifications', 'admin-attendance', 'how-marks'],
  admin:   ['cal-today', 'my-notifications', 'admin-reports', 'admin-fees', 'admin-directory'],
  default: ['cal-today', 'my-notifications', 'admin-reports', 'admin-directory', 'how-library'],
};