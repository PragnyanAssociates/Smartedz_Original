import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';

import TeacherHomework from './TeacherHomework';
import StudentHomework from './StudentHomework';

// =====================================================================
//  Homework - module entry point.
//
//   - Student                               -> StudentHomework
//       (view assigned homework, submit, see grades)
//   - Super Admin / Developer / full-access -> TeacherHomework, canManage
//       (create/edit/delete homework, view & grade submissions)
//   - Teacher                               -> TeacherHomework, canManage
//       (manage only their own homework - enforced by the backend)
//   - Other custom staff roles              -> TeacherHomework
//       (canManage only if Super Admin granted edit on the Homework
//        module; otherwise view & grade-as-permitted, no create/delete)
// =====================================================================

export default function Homework() {
  const { user } = useAuth();
  const { isAllAccess, can } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role.includes('student');
  const isTeacher = role.includes('teacher');

  // Who may create/edit/delete homework. Mirrors the permission gating
  // used by the other modules (e.g. Attendance's canMark).
  const canManage = isAllAccess || isTeacher || can('Homework', 'edit');

  return (
    <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300">
      {isStudent ? <StudentHomework /> : <TeacherHomework canManage={canManage} />}
    </div>
  );
}