import React, { useState, useEffect } from 'react';
import { Settings2, ClipboardList, FileText, CalendarRange, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import ExamSetup from './ExamSetup';
import ClassList from './ClassList';
import StudentReportCard from './StudentReportCard';
import ReportsHelp from './ReportsHelp';

// =====================================================================
//  Reports - offline exams, marks entry & report cards
//
//  Tabs (admin / teacher):
//   • Exam Setup   - define exam types, max marks, teacher assignments
//   • Marks Entry  - pick a class -> enter marks
//   • Report Cards - pick a class -> view/print student report cards
//
//  Students get a single read-only StudentReportCard.
//
//  A read-only "Academic Year" badge shows the active year. All marks,
//  summaries and report cards are scoped to it (set under Academics).
//
//  The How-to-use guide sits in the header beside the badge and follows
//  the active tab, so it stays put across the class list and every
//  sub-view without the child screens needing to know about it.
// =====================================================================

export default function Reports() {
  const { user } = useAuth();
  const { isAllAccess, can } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role === 'student';
  const isTeacher = role.includes('teacher');
  const canManage = isAllAccess || isTeacher || can('Reports', 'edit');

  const [tab, setTab] = useState('marks');
  const [yearName, setYearName] = useState('');
  const [yearKnown, setYearKnown] = useState(false);   // the fetch has answered

  // Fetch the ACTIVE academic year name for the header badge.
  // No fallback to years[0]: if nothing is active the badge must say so
  // rather than name a year the marks aren't actually being stamped with.
  useEffect(() => {
    if (!user?.institutionId) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`)
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
  }, [user]);

  const YearBadge = () => {
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
      <div className="inline-flex items-center gap-2 bg-primary/5 text-primary ring-1 ring-primary/20 rounded-md px-3 h-9 text-xs font-semibold shrink-0">
        <CalendarRange className="size-4" />
        <span>Academic Year: {yearName}</span>
      </div>
    );
  };

  if (isStudent) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">My Report Card</h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Your academic progress</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ReportsHelp topic="student" />
            <YearBadge />
          </div>
        </header>
        <StudentReportCard />
      </div>
    );
  }

  // Setup tab is admin-only. Teachers can do marks entry + report cards.
  const tabs = [
    ...(isAllAccess || can('Reports', 'edit')
      ? [{ id: 'setup', label: 'Exam Setup', icon: Settings2 }]
      : []),
    { id: 'marks',   label: 'Marks Entry',  icon: ClipboardList },
    { id: 'cards',   label: 'Report Cards', icon: FileText }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6 animate-in fade-in duration-500">

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Reports</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Offline exams, marks entry and report cards
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ReportsHelp topic={tab} />
          <YearBadge />
        </div>
      </header>

      {/* Tab Switcher */}
      <div className="flex justify-start">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar w-full sm:w-auto pb-2 sm:pb-0">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-primary text-white shadow-sm ring-1 ring-primary/20'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
                }`}>
                <Icon className="size-3.5 shrink-0" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {tab === 'setup' && <ExamSetup />}
        {tab === 'marks' && <ClassList mode="marks" canManage={canManage} />}
        {tab === 'cards' && <ClassList mode="cards" canManage={canManage} />}
      </div>

    </div>
  );
}