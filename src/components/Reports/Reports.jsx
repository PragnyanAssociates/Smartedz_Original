import React, { useState } from 'react';
import { Settings2, ClipboardList, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import ExamSetup from './ExamSetup';
import ClassList from './ClassList';
import StudentReportCard from './StudentReportCard';

// =====================================================================
//  Reports — offline exams, marks entry & report cards
//
//  Tabs (admin / teacher):
//   • Exam Setup   — define exam types, max marks, teacher assignments
//   • Marks Entry  — pick a class → enter marks
//   • Report Cards — pick a class → view/print student report cards
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Report Card</h1>
          <p className="text-slate-500 font-medium mt-1">Your academic progress</p>
        </div>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reports</h1>
        <p className="text-slate-500 font-medium mt-1">
          Offline exams, marks entry and report cards
        </p>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex bg-white border border-slate-100 rounded-2xl p-1.5 shadow-sm">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  active ? 'bg-blue-600 text-white shadow shadow-blue-200'
                         : 'text-slate-500 hover:text-slate-800'
                }`}>
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'setup' && <ExamSetup />}
      {tab === 'marks' && <ClassList mode="marks" canManage={canManage} />}
      {tab === 'cards' && <ClassList mode="cards" canManage={canManage} />}
    </div>
  );
}