import React, { useState, useMemo, useEffect } from 'react';
import { CalendarDays, PenLine, CalendarRange } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import SchedulesManager from './SchedulesManager';
import ExamsManager from './ExamsManager';
import StudentExamsView from './StudentExamsView';
import StudentSchedulesView from './StudentSchedulesView';

// =====================================================================
//  Exams — top-level container
//
//  Two tabs:
//   • Exam Schedules — printable exam timetables
//   • Online Exams   — actual quizzes students take
//
//  Role behaviour:
//   • Students see read-only views (their class's schedules + exams to take)
//   • Teachers/Super Admin/permitted custom roles get full CRUD
//
//  Academic year: exams & schedules are tied to the school's ACTIVE
//  academic year (the backend scopes every query by it). There's no year
//  picker — switching the active year under Academics switches the data.
//  We fetch the active year only to show its name as context.
// =====================================================================

export default function Exams() {
  const { user } = useAuth();
  const { isAllAccess, can } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role === 'student';
  const isTeacher = role.includes('teacher');
  const canManage = isAllAccess || isTeacher || can('Exams', 'edit');

  const [tab, setTab] = useState('schedules');
  const [activeYearName, setActiveYearName] = useState('');

  useEffect(() => {
    if (!user?.institutionId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
        const data = await res.json();
        const list = data.academicYears || [];
        const active = list.find(y => y.isActive) || list[0];
        if (active) setActiveYearName(active.name || '');
      } catch (e) { console.error('academic year load:', e); }
    })();
  }, [user]);

  const tabs = useMemo(() => ([
    { id: 'schedules', label: 'Exam Schedules', icon: CalendarDays },
    { id: 'exams',     label: 'Online Exams',   icon: PenLine }
  ]), []);

  const YearBadge = () => (
    activeYearName ? (
      <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary/5 ring-1 ring-primary/15 text-primary text-xs font-semibold whitespace-nowrap self-start sm:self-auto">
        <CalendarRange className="size-3.5" /> Academic Year: {activeYearName}
      </div>
    ) : null
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2 sm:mb-6">
        <div className="flex flex-col text-center sm:text-left">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Exams</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            {isStudent
              ? 'Your exam timetable and tests.'
              : 'Publish schedules and create online assessments.'}
          </p>
        </div>
        <YearBadge />
      </header>

      {/* Navigation Controls Wrapper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar w-full sm:w-auto pb-2 sm:pb-0">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-50 border border-zinc-200 bg-white'
                }`}>
                <Icon className="size-3.5 shrink-0" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="mt-6">
        {tab === 'schedules' ? (
          isStudent ? <StudentSchedulesView /> : <SchedulesManager canManage={canManage} activeYearName={activeYearName} />
        ) : (
          isStudent ? <StudentExamsView /> : <ExamsManager canManage={canManage} />
        )}
      </div>

    </div>
  );
}