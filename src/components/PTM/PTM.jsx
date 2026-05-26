import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';

import TeacherAdminPTM from './TeacherAdminPTM';
import StudentPTM from './StudentPTM';

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
    <div className="space-y-8 animate-in fade-in duration-700">
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