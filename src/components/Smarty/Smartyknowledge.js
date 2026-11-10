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

export const LIVE_IDS = ['next-class', 'hw-today', 'attendance'];

export const BUILTINS = [
  // ---- LIVE (filled from bootstrap) — only for people who HAVE a class ----
  { id: 'next-class', q: 'My next class', roles: ['student', 'teacher', 'parent'], tone: 'sky', icon: '🔔',
    keywords: ['next class', 'my class', 'do i have class', 'what class', 'class now', 'timetable', 'period', 'upcoming class'] },
  { id: 'hw-today', q: 'Homework today?', roles: ['student', 'parent'], tone: 'amber', icon: '📚',
    keywords: ['homework today', 'any homework', 'hw today', 'homework for me', 'do i have homework', 'homework due', 'pending homework'] },
  { id: 'attendance', q: 'My attendance', roles: ['student', 'parent'], tone: 'emerald', icon: '🗓️',
    keywords: ['attendance', 'present', 'absent', 'my attendance', 'how many days'] },

  // ---- GUIDES (how-to) ----
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
];

// Starter chips per role bucket. Smarty.jsx then drops any whose module
// the user can't see, and any live one with no data. "What's new?" is
// always appended automatically, so it's not listed here.
export const STARTERS_BY_ROLE = {
  student: ['next-class', 'hw-today', 'attendance', 'how-hw', 'open-fees'],
  parent:  ['next-class', 'hw-today', 'attendance', 'open-fees', 'how-report'],
  teacher: ['next-class', 'admin-attendance', 'how-marks', 'how-timetable'],
  admin:   ['admin-reports', 'admin-fees', 'admin-directory', 'admin-smarty'],
  default: ['admin-reports', 'admin-directory', 'how-library'],
};