import React from "react";
import { useAuth } from "../../context/AuthContext";
import TeacherAdminMaterialsScreen from "./TeacherAdminMaterialsScreen";
import StudentMaterialsScreen from "./StudentMaterialsScreen";

const StudyMaterials = ({ navigation }) => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800"></div>
      </div>
    );
  }

  if (user.role === "Student") {
    return <StudentMaterialsScreen navigation={navigation} />;
  } else if (user.role === "Teacher" || user.role === "Super Admin" || user.role === "Developer") {
    return <TeacherAdminMaterialsScreen navigation={navigation} />;
  }
  return null; 
};

export default StudyMaterials;