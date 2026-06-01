import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';

import TeacherAdminPTM from './TeacherAdminPTM';
import StudentPTM from './StudentPTM';

// =====================================================================
//  PTM - module entry point.
// =====================================================================

export default function PTM() {
  const { user } = useAuth();
  
  // Connect to the permission matrix
  const { can } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role.includes('student');

  // Check matrix for specific rights
  const canEdit = can('PTM', 'edit');
  const canDelete = can('PTM', 'delete');

  return (
    <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300">
      {isStudent ? (
        <StudentPTM />
      ) : (
        <TeacherAdminPTM 
          canEdit={canEdit} 
          canDelete={canDelete} 
        />
      )}
    </div>
  );
}