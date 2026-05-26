import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';

import TeacherOnlineClasses from './TeacherOnlineClasses';
import StudentOnlineClasses from './StudentOnlineClasses';

export default function OnlineClasses() {
  const { user } = useAuth();
  
  // 1. Hook into your permission matrix
  const { can } = usePermissions(); 

  const role = (user?.role || '').toLowerCase();
  const isStudent = role.includes('student');

  // 2. Check the matrix! (Super Admin automatically returns true here)
  const canEdit = can('OnlineClasses', 'edit');
  const canDelete = can('OnlineClasses', 'delete');
  const canManage = canEdit || canDelete; // If they can do either, they are managing

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {isStudent ? (
        <StudentOnlineClasses />
      ) : (
        <TeacherOnlineClasses 
            canManage={canManage} 
            canEdit={canEdit} 
            canDelete={canDelete} 
        />
      )}
    </div>
  );
}