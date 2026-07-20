import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  TrendingUp, Users, GraduationCap, User, CalendarRange, AlertTriangle,
  HelpCircle, X, ShieldCheck
} from 'lucide-react';

import StudentPerformance from './StudentPerformance';
import TeacherPerformance from './TeacherPerformance';
import MyPerformance      from './MyPerformance';

// =====================================================================
//  Performance - offline-exam analytics module.
//
//  Tabs shown depend on role:
//   * Super Admin / Developer / full-access -> Students + Teachers
//   * Teacher                               -> My Performance + Students
//   * Student                               -> My Performance only
//
//  All data comes from the Reports module's student_marks table and is
//  scoped to the ACTIVE academic year (the backend resolves it; the
//  YearBadge here surfaces which year that is). Percentages count ONLY
//  exams that have actually been marked — the same rule the report cards
//  use — so a student measured on 2 of 10 planned exams is scored on
//  those 2, not dragged down by exams that never happened.
//
//  The "How to use" guide matches the Reports module's ReportsHelp theme
//  (same button + primary-header modal) and follows the active tab.
// =====================================================================

export default function Performance() {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isTeacher = role.includes('teacher');
  const isStudent = role.includes('student');

  // Decide which tabs this user gets
  const tabs = useMemo(() => {
    if (isAllAccess) {
      return [
        { id: 'students', label: 'Student Performance', icon: GraduationCap },
        { id: 'teachers', label: 'Teacher Performance', icon: Users }
      ];
    }
    if (isTeacher) {
      return [
        { id: 'mine',     label: 'My Performance',      icon: User },
        { id: 'students', label: 'Student Performance', icon: GraduationCap }
      ];
    }
    // Student (or anyone else) - own performance only
    return [{ id: 'mine', label: 'My Performance', icon: User }];
  }, [isAllAccess, isTeacher]);

  const [activeTab, setActiveTab] = useState(tabs[0].id);

  // The help guide follows the active tab; "My Performance" differs for
  // a teacher vs a student, so resolve that here.
  const helpTopic = activeTab === 'mine'
    ? (isStudent ? 'mineStudent' : 'mineTeacher')
    : activeTab;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2 sm:mb-0 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="text-primary size-5" />
            Performance &amp; Analytics
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Student and teacher performance from offline exam marks.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PerformanceHelp topic={helpTopic} />
          <YearBadge institutionId={user?.institutionId} />
        </div>
      </header>

      {tabs.length > 1 && (
        <div className="flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar w-full sm:w-fit shrink-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                activeTab === t.id ? 'bg-primary text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50/50'
              }`}>
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col">
        {activeTab === 'students' && <StudentPerformance />}
        {activeTab === 'teachers' && <TeacherPerformance />}
        {activeTab === 'mine'     && <MyPerformance />}
      </div>
    </div>
  );
}


// =====================================================================
//  YearBadge — the active academic year this screen is reporting on.
//  Same source/behaviour as the Reports screen.
// =====================================================================
function YearBadge({ institutionId }) {
  const [yearName, setYearName] = useState('');
  const [yearKnown, setYearKnown] = useState(false);

  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/admin/data/${institutionId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const years = d.academicYears || [];
        const active = years.find(y => y.isActive);
        setYearName(active ? active.name : '');
        setYearKnown(true);
      })
      .catch(() => { if (!cancelled) setYearKnown(true); });
    return () => { cancelled = true; };
  }, [institutionId]);

  if (!yearKnown) return null;

  if (!yearName) {
    return (
      <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 ring-1 ring-red-500/20 rounded-md px-3 h-9 text-xs font-semibold shrink-0"
        title="Set a year active under Manage Logins → Academics Year">
        <AlertTriangle className="size-4" />
        <span>No active academic year</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 bg-primary/5 text-primary ring-1 ring-primary/20 rounded-md px-3 h-9 text-xs font-semibold shrink-0"
      title="All performance is scoped to this year (set under Manage Logins → Academics Year)">
      <CalendarRange className="size-4" />
      <span>Academic Year: {yearName}</span>
    </div>
  );
}


// =====================================================================
//  PerformanceHelp — "How to use" guide.
//  Same button + modal theme as the Reports module's ReportsHelp, so the
//  help is consistent across the app. The guide follows the active tab.
//
//  Topics: students | teachers | mineTeacher | mineStudent
// =====================================================================
const GUIDES = {
  students: {
    title: 'Student Performance',
    steps: [
      ['1 \u00b7 Ranked by result', 'Pick a class and it lists every student best-to-worst for the active academic year, with the class topper called out on top.'],
      ['2 \u00b7 Filter to focus', 'Class, Exam and Subject filters narrow what the ranking is based on \u2014 e.g. just SA-1, or just Maths. Search finds a student by name or roll, and the sort control flips between roll order and high/low.'],
      ['3 \u00b7 Open a student', 'Click any row to see their exam-by-exam breakdown, or hit Graph for a chart of it.'],
      ['4 \u00b7 Analysis', 'The Analysis button opens a full class comparison chart with its own Class / Criterion / Subject / Sort filters \u2014 and the subject teacher\u2019s details when a single subject is chosen.'],
      ['5 \u00b7 Only marked exams count', 'A percentage is marks obtained \u00f7 maximum of the exams actually marked \u2014 the same rule as the report cards. Exams not yet conducted don\u2019t drag anyone down.'],
    ],
    note: 'Everything is scoped to the academic year in the badge above (set under Manage Logins \u2192 Academics Year). A blank or low figure usually means those marks aren\u2019t entered in Reports yet \u2014 not a real zero.'
  },
  teachers: {
    title: 'Teacher Performance',
    steps: [
      ['1 \u00b7 How the score works', 'A teacher\u2019s percentage is the average result of their students in the class-subjects they\u2019re assigned \u2014 it reflects the marks entered in Reports, nothing typed here.'],
      ['2 \u00b7 Filter to focus', 'Class, Subject and Exam-type filters plus High\u2192Low / Low\u2192High sort let you compare like-for-like.'],
      ['3 \u00b7 Open a teacher', 'Click a row to expand their result per class-and-subject.'],
      ['4 \u00b7 Table', 'The Table button gives a clean, printable class-and-subject sheet for the current selection.'],
      ['5 \u00b7 Analysis', 'The Analysis button charts teachers exam-by-exam with its own Exam / Class / Sort filters.'],
    ],
    note: 'Scoped to the academic year in the badge above. If a teacher looks empty, their class-subject either has no marks entered yet, or they aren\u2019t mapped to it in Reports \u2192 Exam Setup \u2192 Teacher Assignment.'
  },
  mineTeacher: {
    title: 'My Performance',
    steps: [
      ['1 \u00b7 Your teaching, at a glance', 'Your overall percentage across every class and subject assigned to you for the active academic year.'],
      ['2 \u00b7 Per class & subject', 'The table breaks your result down by each class-subject you teach, so you can see where results are strong or slipping.'],
      ['3 \u00b7 Filter by exam', 'Switch the Exam filter to judge a single exam (say SA-1) instead of everything combined.'],
      ['4 \u00b7 Analysis', 'The Analysis button charts the same breakdown so it\u2019s easy to compare at a glance.'],
      ['5 \u00b7 The bands', 'Green is 80%+, blue 50\u201380%, red below 50% \u2014 the same thresholds used on report cards, so the two always agree.'],
    ],
    note: 'Built from the marks entered in Reports for the year in the badge above. Nothing here is editable \u2014 correct a mark in Reports \u2192 Marks Entry and this updates on its own.'
  },
  mineStudent: {
    title: 'My Performance',
    steps: [
      ['1 \u00b7 Topper vs You', 'A side-by-side of the class topper and you, so you can see the gap at a glance.'],
      ['2 \u00b7 Your numbers', 'Below the bars: your rank in class, your marks out of the total, and the class size.'],
      ['3 \u00b7 Filter it', 'Use the Exam and Subject filters to focus \u2014 for example your standing in Maths, or just in SA-1.'],
      ['4 \u00b7 Analysis', 'The Analysis button charts your marks exam-by-exam so you can spot your strong and weak papers.'],
      ['5 \u00b7 The colours', 'Green is 80%+, blue is 50\u201380%, red is below 50%.'],
    ],
    note: 'This is read-only and scoped to the academic year shown above. A blank or low figure usually means those marks haven\u2019t been entered yet \u2014 if something looks wrong, tell your class teacher.'
  }
};

function PerformanceHelp({ topic = 'students', className = '' }) {
  const [open, setOpen] = useState(false);
  const content = GUIDES[topic] || GUIDES.students;

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 self-start ${className}`}>
        <HelpCircle className="size-3.5" /> How to use
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
              <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X className="size-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              {content.steps.map(([t, d], i) => (
                <div key={i} className="rounded-md ring-1 ring-zinc-100 bg-zinc-50/60 p-3">
                  <p className="text-xs font-semibold text-zinc-800">{t}</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
                </div>
              ))}
              <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex gap-2">
                <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">{content.note}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}