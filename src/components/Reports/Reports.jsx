import React, { useState } from 'react';
import { Settings2, ClipboardList, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import ExamSetup from './ExamSetup';
import ClassList from './ClassList';
import StudentReportCard from './StudentReportCard';

// =====================================================================
//  Reports - offline exams, marks entry & report cards
//
//  Tabs (admin / teacher):
//   • Exam Setup   - define exam types, max marks, teacher assignments
//   • Marks Entry  - pick a class -> enter marks
//   • Report Cards - pick a class -> view/print student report cards
//
//  Students get a single read-only StudentReportCard.
// =====================================================================

export default function Reports() {
  const { user } = useAuth();
  const { isAllAccess, can } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role === 'student';
  const isTeacher = role.includes('teacher');
  const canManage = isAllAccess || isTeacher || can('Reports', 'edit');

  const [tab, setTab] = useState('marks');

  if (isStudent) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        <header className="flex flex-col mb-4">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">My Report Card</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Your academic progress</p>
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
      
      <header className="flex flex-col mb-4">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Reports</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
          Offline exams, marks entry and report cards
        </p>
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