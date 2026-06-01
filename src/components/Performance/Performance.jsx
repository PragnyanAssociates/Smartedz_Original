import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { TrendingUp, Users, GraduationCap, User } from 'lucide-react';

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
//  All data comes from the Reports module's student_marks table.
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      
      <header className="flex flex-col mb-2 sm:mb-0 shrink-0">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
          <TrendingUp className="text-primary size-5" />
          Performance & Analytics
        </h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
          Student and teacher performance from offline exam marks.
        </p>
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