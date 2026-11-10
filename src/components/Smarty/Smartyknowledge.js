// =====================================================================
//  Smarty — built-in knowledge pack
//
//  This ships WITH the app, so Smarty can help on day one with zero
//  Super-Admin setup. Each entry is role-aware and may carry a `link`
//  (a Modules.js id) that renders an "Open …" shortcut button.
//
//  Three answer kinds:
//    • guide  — steps (how-to)
//    • action — just navigates (text + link)
//    • live   — id in LIVE_IDS; the real answer is built in Smarty.jsx
//               from the bootstrap data (never hard-coded here)
//
//  roles: 'all' or an array of lowercased role fragments to match against
//  the user's role (e.g. ['student','parent']). Matching is "includes".
// =====================================================================

export const LIVE_IDS = ['next-class', 'hw-today', 'attendance'];

// tone tokens map to the accent colours used by the panel
export const BUILTINS = [
  // ---- LIVE (answers filled from bootstrap in Smarty.jsx) ----
  { id: 'next-class', q: 'My next class', roles: 'all', tone: 'sky', icon: '🔔',
    keywords: ['next class', 'my class', 'do i have class', 'what class', 'class now', 'timetable', 'period', 'schedule', 'upcoming class'] },
  { id: 'hw-today', q: 'Homework today?', roles: ['student', 'parent'], tone: 'amber', icon: '📚',
    keywords: ['homework today', 'any homework', 'hw today', 'homework for me', 'do i have homework', 'homework due', 'pending homework'] },
  { id: 'attendance', q: 'My attendance', roles: ['student', 'parent'], tone: 'emerald', icon: '🗓️',
    keywords: ['attendance', 'present', 'absent', 'my attendance', 'how many days'] },

  // ---- GUIDES (how-to) ----
  { id: 'how-hw', q: 'How to submit homework?', roles: ['student', 'parent'], tone: 'violet', icon: '❓',
    keywords: ['how homework', 'submit homework', 'how to submit', 'homework help', 'upload homework'],
    answer: { text: "Here's how to submit homework 📝", link: 'Homework', linkLabel: 'Open Homework',
      steps: ['Open the **Homework** tab.', 'Tap the subject card marked **“Pending”**.', 'Read the task, then tap **Submit / Mark done**.', 'Attach a photo or note if your teacher asked for one.'] } },

  { id: 'how-attend', q: 'How do I see attendance?', roles: 'all', tone: 'emerald', icon: '❓',
    keywords: ['how attendance', 'view attendance', 'check attendance', 'where attendance'],
    answer: { text: "Checking attendance is easy 📅", link: 'attendance', linkLabel: 'Open Attendance',
      steps: ['Open the **Attendance** tab.', 'Your day-by-day record and total % are shown.', 'Use the year filter to see a past academic year.'] } },

  { id: 'how-fees', q: 'How do I pay fees?', roles: ['student', 'parent'], tone: 'rose', icon: '❓',
    keywords: ['how fees', 'pay fees', 'fee payment', 'how to pay', 'online payment'],
    answer: { text: "Here's how fee payment works 💳", link: 'FeeManagement', linkLabel: 'Open My Fee',
      steps: ['Open the **Fee Management** tab.', 'Your instalments and due dates are listed.', 'Tap **Pay** on a due instalment to pay online.', 'A receipt is saved once payment succeeds.'] } },

  { id: 'how-report', q: 'Where is my report card?', roles: 'all', tone: 'brand', icon: '❓',
    keywords: ['report card', 'progress card', 'marks report', 'results', 'how marks report'],
    answer: { text: "Your progress report card lives in Reports 📄", link: 'reports', linkLabel: 'Open Reports',
      steps: ['Open the **Reports** tab.', 'Go to **Report Cards** and pick the student.', 'Download or print the progress card from there.'] } },

  { id: 'how-marks', q: 'How do I enter marks?', roles: ['teacher'], tone: 'violet', icon: '❓',
    keywords: ['enter marks', 'how marks', 'marks entry', 'add marks', 'exam marks', 'put marks'],
    answer: { text: "Entering marks takes 4 steps ✏️", link: 'reports', linkLabel: 'Open Reports',
      steps: ['Go to **Reports → Marks Entry**.', 'Pick the **class** and the **exam type** (UT-1, AT-1…).', 'Type each student’s marks — totals update live.', 'Tap **Save Marks**. It also feeds Performance.'] } },

  { id: 'how-timetable', q: 'How do I see my timetable?', roles: 'all', tone: 'sky', icon: '❓',
    keywords: ['how timetable', 'my timetable', 'see timetable', 'class schedule', 'periods'],
    answer: { text: "Your full week is in the Timetable 🗓️", link: 'timetable', linkLabel: 'Open Timetable',
      steps: ['Open the **Timetable** tab.', 'Your day-by-day periods, teachers and rooms are shown.'] } },

  { id: 'how-library', q: 'How does the Library work?', roles: 'all', tone: 'brand', icon: '❓',
    keywords: ['library', 'borrow book', 'return book', 'due book', 'issue book'],
    answer: { text: "Here's how the Library works 📚", link: 'Library', linkLabel: 'Open Library',
      steps: ['Open the **Library** tab to see issued books.', 'Each book shows its **due date**.', 'Smarty reminds you 3 days before a book is due.'] } },

  // ---- ACTION shortcuts ----
  { id: 'open-hw', q: 'Open Homework', roles: ['student', 'teacher', 'parent'], tone: 'brand', icon: '➡️',
    keywords: ['open homework', 'go to homework', 'homework tab', 'homework screen', 'show homework'],
    answer: { text: 'Sure — opening Homework for you 👇', link: 'Homework', linkLabel: 'Open Homework' } },
  { id: 'open-fees', q: 'Open My Fee', roles: ['student', 'parent'], tone: 'rose', icon: '💳',
    keywords: ['open fee', 'open fees', 'my fee', 'fee tab', 'go to fees', 'fees due', 'pending fee', 'fee balance'],
    answer: { text: 'Opening your fee details 👇', link: 'FeeManagement', linkLabel: 'Open My Fee' } },
  { id: 'open-attend', q: 'Open Attendance', roles: 'all', tone: 'emerald', icon: '➡️',
    keywords: ['open attendance', 'mark attendance', 'go to attendance', 'attendance screen'],
    answer: { text: 'Opening Attendance 👇', link: 'attendance', linkLabel: 'Open Attendance' } },
  { id: 'open-timetable', q: 'Open Timetable', roles: 'all', tone: 'sky', icon: '➡️',
    keywords: ['open timetable', 'go to timetable', 'timetable tab'],
    answer: { text: 'Opening your Timetable 👇', link: 'timetable', linkLabel: 'Open Timetable' } },
];

// Which starter chips to show first, by role (ids above). Smarty.jsx then
// drops any whose module the user can't see, and any live one with no data.
export const STARTERS_BY_ROLE = {
  student: ['next-class', 'hw-today', 'attendance', 'how-hw', 'open-fees'],
  parent:  ['next-class', 'hw-today', 'attendance', 'open-fees', 'how-report'],
  teacher: ['next-class', 'how-marks', 'open-attend', 'how-timetable'],
  default: ['next-class', 'how-timetable', 'how-attend', 'how-report'],
};