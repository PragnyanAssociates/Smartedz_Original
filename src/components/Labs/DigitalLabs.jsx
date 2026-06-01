import React from 'react';
import { useAuth } from '../../context/AuthContext';

import TeacherLabs from './TeacherLabs';
import StudentLabs from './StudentLabs';

// =====================================================================
//  Digital Labs - module entry point.
//
//   - Super Admin / Developer / staff roles -> TeacherLabs
//       (create/edit/delete labs with video, link & live-class resources)
//   - Teacher -> TeacherLabs (sees only their own labs - backend-enforced)
//   - Student -> StudentLabs (browse labs for their class, watch & join)
// =====================================================================

export default function DigitalLabs() {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const isStudent = role.includes('student');

  return (
    <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300">
      {isStudent ? <StudentLabs /> : <TeacherLabs canManage={!isStudent} />}
    </div>
  );
}