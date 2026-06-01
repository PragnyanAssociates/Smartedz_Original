import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';

import TeacherHomework from './TeacherHomework';
import StudentHomework from './StudentHomework';

// =====================================================================
//  Homework - module entry point.
//
//   - Super Admin / Developer / full-access -> TeacherHomework
//       (create/edit/delete homework, view & grade submissions)
//   - Teacher (and other staff roles)       -> TeacherHomework
//       (sees only their own homework - enforced by the backend)
//   - Student                               -> StudentHomework
//       (view assigned homework, submit, see grades)
// =====================================================================

export default function Homework() {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role.includes('student');

  return (
    <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300">
      {isStudent ? <StudentHomework /> : <TeacherHomework canManage={!isStudent} />}
    </div>
  );
}