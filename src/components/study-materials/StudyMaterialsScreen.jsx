import React from "react";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../Screens/PermissionsContext";
import TeacherAdminMaterialsScreen from "./TeacherAdminMaterialsScreen";
import StudentMaterialsScreen from "./StudentMaterialsScreen";

const StudyMaterialsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { can, isAllAccess } = usePermissions();

  if (!user) return null;

  const userRole = (user.role || "").toLowerCase();

  // Students have a completely separate view
  if (userRole === "student") {
    return <StudentMaterialsScreen navigation={navigation} />;
  } 

  // Permission Matrix Check for Staff
  const canRead = can('StudyMaterials', 'read');
  
  if (isAllAccess || canRead) {
    return <TeacherAdminMaterialsScreen navigation={navigation} />;
  }

  return (
    <div className="py-20 text-center text-slate-500 font-medium">
      <p>Access Denied. You do not have permission to view Study Materials.</p>
    </div>
  );
};

export default StudyMaterialsScreen;