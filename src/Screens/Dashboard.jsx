import React, { useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { MdMenu, MdClose, MdLogout, MdSettings, MdPerson, MdDashboard } from "react-icons/md";

// Lazy Load Modules
const AdminLM = lazy(() => import("./AdminLM"));
const AcademicYearSettings = lazy(() => import("./AcademicYearSettings"));
// Add other modules here as you build them...

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeModule, setActiveModule] = useState("home");

  // Define Menu Items based on Role
  const menuConfig = {
    "Super Admin": [
      { id: "home", label: "Dashboard", icon: <MdDashboard /> },
      { id: "users", label: "User Management", icon: <MdPerson /> },
      { id: "academic_year", label: "Academic Year", icon: <MdSettings /> },
    ],
    "Teacher": [
      { id: "home", label: "Dashboard", icon: <MdDashboard /> },
      { id: "attendance", label: "Attendance", icon: <MdPerson /> },
    ],
    "Student": [
      { id: "home", label: "My Profile", icon: <MdPerson /> },
      { id: "fees", label: "Fee Status", icon: <MdSettings /> },
    ]
  };

  const currentMenu = menuConfig[user?.role] || menuConfig["Student"];

  const renderContent = () => {
    switch (activeModule) {
      case "users": return <AdminLM />;
      case "academic_year": return <AcademicYearSettings />;
      case "home":
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold">Welcome, {user?.full_name}</h1>
            <p className="text-gray-500">Role: {user?.role}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="bg-blue-500 p-6 rounded-xl text-white shadow-lg">
                <h3 className="text-lg">Academic Year</h3>
                <p className="text-2xl font-bold">2024-2025</p>
              </div>
            </div>
          </div>
        );
      default: return <div className="p-6 text-gray-400">Module coming soon...</div>;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-indigo-900 text-white transition-all duration-300 flex flex-col`}>
        <div className="p-4 flex items-center justify-between border-b border-indigo-800">
          {isSidebarOpen && <span className="font-bold text-xl tracking-wider">ERP SYSTEM</span>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-indigo-700 rounded">
            {isSidebarOpen ? <MdClose size={24}/> : <MdMenu size={24}/>}
          </button>
        </div>

        <nav className="flex-1 mt-4 px-2 space-y-2">
          {currentMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${activeModule === item.id ? 'bg-indigo-700 text-white' : 'text-indigo-200 hover:bg-indigo-800'}`}
            >
              <span className="text-2xl">{item.icon}</span>
              {isSidebarOpen && <span className="ml-4 font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <button onClick={logout} className="p-4 flex items-center text-red-300 hover:bg-red-900/30 transition-colors border-t border-indigo-800">
          <MdLogout size={24}/>
          {isSidebarOpen && <span className="ml-4 font-bold">Logout</span>}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shadow-sm">
           <h2 className="text-lg font-semibold text-gray-700 uppercase tracking-widest">
            {activeModule.replace('_', ' ')}
           </h2>
           <div className="flex items-center gap-4">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">ACTIVE: 2024-25</span>
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                {user?.full_name?.charAt(0)}
              </div>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <Suspense fallback={<div className="flex justify-center mt-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>}>
            {renderContent()}
          </Suspense>
        </div>
      </main>
    </div>
  );
}