import React from "react";
import { useAuth } from "../../context/AuthContext";
import TeacherAdminMaterialsScreen from "./TeacherAdminMaterialsScreen";
import StudentMaterialsScreen from "./StudentMaterialsScreen";

const StudyMaterialsScreen = ({ navigation }) => {
  const { user } = useAuth();

  if (!user) return null;

  const userRole = (user.role || "").toLowerCase();

  if (userRole === "student") {
    return <StudentMaterialsScreen navigation={navigation} />;
  } 
  else if (userRole.includes("teacher") || userRole === "super admin" || userRole === "developer" || userRole === "admin") {
    return <TeacherAdminMaterialsScreen navigation={navigation} />;
  }

  return (
    <div className="py-20 text-center text-slate-500 font-medium">
      <p>Access Denied.</p>
    </div>
  );
};

export default StudyMaterialsScreen;