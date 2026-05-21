import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { TrendingUp, Users, GraduationCap, User } from 'lucide-react';

import StudentPerformance from './StudentPerformance';
import TeacherPerformance from './TeacherPerformance';
import MyPerformance      from './MyPerformance';

// =====================================================================
//  Performance — offline-exam analytics module.
//
//  Tabs shown depend on role:
//   • Super Admin / Developer / full-access → Students + Teachers
//   • Teacher                               → My Performance + Students
//   • Student                               → My Performance only
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
    // Student (or anyone else) — own performance only
    return [{ id: 'mine', label: 'My Performance', icon: User }];
  }, [isAllAccess, isTeacher]);

  const [activeTab, setActiveTab] = useState(tabs[0].id);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <TrendingUp className="text-blue-600" size={28} />
          Performance &amp; Analytics
        </h2>
        <p className="text-slate-500 font-medium mt-1">
          Student and teacher performance from offline exam marks.
        </p>
      </div>

      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-bold text-sm transition-all ${
                activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
              }`}>
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-[400px]">
        {activeTab === 'students' && <StudentPerformance />}
        {activeTab === 'teachers' && <TeacherPerformance />}
        {activeTab === 'mine'     && <MyPerformance />}
      </div>
    </div>
  );
}