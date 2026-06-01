import React from "react";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../Screens/PermissionsContext";
import { ShieldAlert } from "lucide-react";
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto animate-in fade-in duration-300">
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
        <ShieldAlert className="size-10 text-red-400 mb-3" />
        <h2 className="text-lg font-semibold text-zinc-900 mb-1">Access Denied</h2>
        <p className="text-sm font-medium text-zinc-500">
          You do not have permission to view Study Materials.
        </p>
      </div>
    </div>
  );
};

export default StudyMaterialsScreen;