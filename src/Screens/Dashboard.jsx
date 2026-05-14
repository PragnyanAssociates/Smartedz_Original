import React, { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import apiClient from "../api/client";
import { MdSearch, MdMenu, MdNotifications, MdLogout, MdMail, MdPhone } from "react-icons/md";

// Assets
import vspngoLogo from "../assets/vpsnewlogo.png";

// --- LAZY LOAD MODULES ---
const AdminLM = lazy(() => import("./AdminLM"));
const AcademicYearSettings = lazy(() => import("./AcademicYearSettings"));

// --- DYNAMIC DBOBJECT MODULE MAP ---
// Note: I have removed the hardcoded "roles" array. The application now uses
// the database exactly as configured in the 'Role Permissions' screen.
const ALL_MODULES = [
  { id: "dashboard", title: "Overview", icon: "📊", alwaysShow: true },
  { id: "qa_acad_adm", title: "Admissions", icon: "🎒", dbModuleName: "Admissions" },
  { id: "qa_admin_alumni", title: "Alumni", icon: "🎓", dbModuleName: "Alumni" },
  { id: "qa_acad_fees", title: "Fees Management", icon: "💸", dbModuleName: "Finance" },
  { id: "qa_acad_tt", title: "Timetable", icon: "📅", dbModuleName: "Timetable" },
  { id: "qa_acad_sa", title: "Attendance", icon: "📝", dbModuleName: "Attendance" },
  { id: "qa_extra_SI", title: "Syllabus", icon: "📖", dbModuleName: "Syllabus" },
  { id: "qa_acad_lp", title: "Lesson Plan", icon: "📋", dbModuleName: "Homework" },
  { id: "qa_acad_exams1", title: "Exams & Schedules", icon: "✍️", dbModuleName: "Examinations" },
  { id: "qa_teacher_marks", title: "Marks Entry", icon: "📊", dbModuleName: "Marks Entry" },
  { id: "qa_admin_chat", title: "Group Chat", icon: "💬", dbModuleName: "Group Chat" },
  { id: "qa_transport", title: "Transport", icon: "🚌", dbModuleName: "Transport" },
  { id: "qa_admin_login", title: "Manage Login", icon: "🔐", dbModuleName: "Users" },
  { id: "academic_year", title: "Academic Year", icon: "⚙️", dbModuleName: "Settings" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const [activeModuleId, setActiveModuleId] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // --- PERMISSIONS STATE ---
  const [rolePermissions, setRolePermissions] = useState([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // --- FETCH DYNAMIC ROLE PERMISSIONS FROM DATABASE ---
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user?.role) return;
      try {
        const rolesRes = await apiClient.get("/roles");
        const currentRole = rolesRes.data.find(r => r.role_name === user.role);
        
        if (currentRole) {
          const permsRes = await apiClient.get(`/roles/${currentRole.id}/permissions`);
          setRolePermissions(permsRes.data);
        }
      } catch (e) {
        console.error("Error fetching dynamic permissions:", e);
      } finally {
        setPermissionsLoaded(true);
      }
    };
    fetchPermissions();
  }, [user]);

  // --- STRICT PERMISSION BASED MENU FILTERING ---
  const sidebarMenu = useMemo(() => {
    if (!permissionsLoaded) return [];

    return ALL_MODULES.filter(m => {
      // Always show the overview dashboard to everyone
      if (m.alwaysShow) return true;

      // Check database to see if module is permitted
      const perm = rolePermissions.find(p => p.module_name === m.dbModuleName);
      if (perm) {
        // If they have ANY permission (read, edit, or delete), it is NOT hidden.
        // It completely disappears if all are false/0.
        return perm.can_read === 1 || perm.can_edit === 1 || perm.can_delete === 1 || 
               perm.can_read === true || perm.can_edit === true || perm.can_delete === true;
      }
      
      // If there is no DB record for this module yet, it remains hidden for safety.
      return false;
    }).filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, rolePermissions, permissionsLoaded]);

  // --- FETCH NOTIFICATIONS (Real-time logic) ---
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await apiClient.get("/notifications");
        setUnreadCount(res.data.filter(n => !n.is_read).length);
      } catch (e) { console.error(e); }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      logout();
      navigate("/");
    }
  };

  const renderActiveModule = () => {
    switch (activeModuleId) {
      case "qa_admin_login": return <AdminLM />;
      case "academic_year": return <AcademicYearSettings />;
      default: return (
        <div className="empty-state">
          <div className="icon">🛠️</div>
          <h2>{activeModuleId.replace('_', ' ')} Module</h2>
          <p>This module is currently under development for the {user?.role} role.</p>
        </div>
      );
    }
  };

  return (
    <div className="erp-container">
      <style>{`
        .erp-container { display: flex; flex-direction: column; height: 100vh; width: 100vw; background: #f4f7fa; font-family: 'Inter', sans-serif; overflow: hidden; }
        
        .top-brand-header {
          height: 80px; background: white; border-bottom: 1px solid #e2e8f0;
          display: flex; align-items: center; justify-content: space-between; padding: 0 20px; z-index: 100;
        }
        .school-info { display: flex; align-items: center; gap: 15px; }
        .school-logo { height: 60px; }
        .school-details { text-align: center; }
        .school-name { font-weight: 800; color: #1e293b; font-size: 18px; margin: 0; letter-spacing: 0.5px; }
        .school-contact { display: flex; gap: 20px; font-size: 12px; color: #64748b; margin-top: 5px; }
        .contact-item { display: flex; align-items: center; gap: 5px; }
        .powered-by { display: flex; flex-direction: column; align-items: flex-end; }
        .powered-text { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .brand-logo { font-weight: 900; font-size: 20px; color: #4f46e5; }

        .main-wrapper { display: flex; flex: 1; overflow: hidden; }

        .sidebar {
          width: ${isSidebarOpen ? '280px' : '0px'};
          background: white; border-right: 1px solid #e2e8f0;
          display: flex; flex-direction: column; transition: 0.3s ease; overflow: hidden;
        }
        .sidebar-title-area { padding: 20px; border-bottom: 1px solid #f1f5f9; }
        .sidebar-title-area h3 { margin: 0; font-size: 16px; color: #1e293b; font-weight: 800; white-space: nowrap;}
        .sidebar-title-area p { margin: 2px 0 0 0; font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; }

        .search-box { padding: 15px 20px; position: relative; }
        .search-box input { 
          width: 100%; padding: 10px 35px 10px 15px; background: #f8fafc; border: 1px solid #e2e8f0; 
          border-radius: 10px; font-size: 13px; outline: none; box-sizing: border-box;
        }
        .search-icon { position: absolute; right: 30px; top: 27px; color: #94a3b8; }

        .menu-list { flex: 1; overflow-y: auto; padding: 10px; }
        .menu-item {
          display: flex; align-items: center; gap: 12px; padding: 12px 15px; margin-bottom: 4px;
          border-radius: 12px; cursor: pointer; transition: 0.2s; border: none; background: transparent;
          width: 100%; text-align: left; color: #475569; font-weight: 600; font-size: 14px; white-space: nowrap;
        }
        .menu-item:hover { background: #f1f5f9; color: #4f46e5; }
        .menu-item.active { background: #eff6ff; color: #1d4ed8; border: 1px solid #dbeafe; }
        .menu-icon { font-size: 18px; }

        .user-footer { padding: 15px; border-top: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px; }
        .user-avatar { width: 40px; height: 40px; border-radius: 50%; background: #4f46e5; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; }
        .user-meta { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-meta .name { font-size: 13px; font-weight: 700; color: #1e293b; display: block; }
        .user-meta .role { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }

        .render-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
        
        .dashboard-header {
           background: white; padding: 20px 30px; border-bottom: 1px solid #e2e8f0;
           display: flex; align-items: center; justify-content: space-between;
        }
        .greeting h2 { margin: 0; font-size: 24px; color: #1e293b; }
        .greeting p { margin: 5px 0 0 0; color: #64748b; font-size: 14px; }
        
        .header-actions { display: flex; align-items: center; gap: 15px; }
        .date-chip { background: #f1f5f9; padding: 8px 15px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #475569; display: flex; align-items: center; gap: 8px; }
        .notif-btn { position: relative; width: 40px; height: 40px; border-radius: 10px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; color: #64748b; background: white; cursor: pointer; }
        .badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 10px; padding: 2px 6px; border-radius: 20px; font-weight: 800; }

        .module-body { flex: 1; overflow-y: auto; padding: 30px; }

        .empty-state { text-align: center; margin-top: 100px; color: #94a3b8; }
        .empty-state .icon { font-size: 60px; margin-bottom: 20px; }
      `}</style>

      <header className="top-brand-header">
        <div className="school-info">
          <img src={vspngoLogo} className="school-logo" alt="School Logo" />
          <div className="school-details">
            <h1 className="school-name">VIVEKANANDA PUBLIC SCHOOL</h1>
            <div className="school-contact">
              <span className="contact-item"><MdMail/> vivekanandaschoolhyd@gmail.com</span>
              <span className="contact-item"><MdPhone/> 040-23355998 / +91 9394073325</span>
            </div>
          </div>
        </div>
        
        <div className="powered-by">
          <span className="powered-text">Powered by</span>
          <span className="brand-logo">SmartEdz</span>
        </div>
      </header>

      <div className="main-wrapper">
        <aside className="sidebar">
          <div className="sidebar-title-area">
            <h3>{user?.role} Dashboard</h3>
            <p>Empowering Education</p>
          </div>

          <div className="search-box">
            <input 
              placeholder="Search Menu..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <MdSearch className="search-icon" size={18}/>
          </div>

          <div className="menu-list">
            {sidebarMenu.map((m) => (
              <button 
                key={m.id} 
                className={`menu-item ${activeModuleId === m.id ? 'active' : ''}`}
                onClick={() => setActiveModuleId(m.id)}
              >
                <span className="menu-icon">{m.icon}</span>
                {m.title}
              </button>
            ))}
          </div>

          <div className="user-footer">
            <div className="user-avatar">{user?.full_name?.charAt(0) || user?.role?.charAt(0)}</div>
            <div className="user-meta">
              <span className="name">{user?.full_name}</span>
              <span className="role">{user?.role}</span>
            </div>
            <button onClick={handleLogout} style={{background:'none', border:'none', color:'#94a3b8', cursor:'pointer'}}>
              <MdLogout size={20}/>
            </button>
          </div>
        </aside>

        <div className="render-pane">
          <header className="dashboard-header">
            <div className="greeting">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{background:'none', border:'none', cursor:'pointer', marginBottom:'10px'}}>
                <MdMenu size={24} color="#64748b"/>
              </button>
              <h2>Good Afternoon, {user?.full_name?.split(' ')[0] || user?.role} 👋</h2>
              <p>Here is your school's overview for today.</p>
            </div>

            <div className="header-actions">
              <div className="date-chip">
                📅 {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <button className="notif-btn">
                <MdNotifications size={22}/>
                {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
              </button>
            </div>
          </header>

          <div className="module-body" id="module-render-area">
            <Suspense fallback={
              <div style={{display:'flex', justifyContent:'center', marginTop:'50px'}}>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
              </div>
            }>
              {renderActiveModule()}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}