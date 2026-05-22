import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';

import TeacherAdminPTM from './TeacherAdminPTM';
import StudentPTM from './StudentPTM';

// =====================================================================
//  PTM — module entry point.
//
//   • Super Admin / Developer / Teacher → TeacherAdminPTM
//       (schedule, edit, delete, and view all relevant meetings)
//   • Student                           → StudentPTM
//       (view assigned meetings, join links)
// =====================================================================

export default function PTM() {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role.includes('student');

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {isStudent ? <StudentPTM /> : <TeacherAdminPTM canManage={!isStudent} />}
    </div>
  );
}