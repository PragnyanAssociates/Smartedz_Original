import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import apiClient from "../api/client";
import { MdSearch, MdClose, MdMenu, MdNotifications } from "react-icons/md";

// ----------------------------------------------------------------------
// 1. DYNAMIC IMPORTS (CODE-SPLITTING)
// ----------------------------------------------------------------------
const AdminLM = lazy(() => import("./AdminLM"));
const ProfileScreen = lazy(() => import("./Profile.jsx")); // Restored Profile Screen

// --- ICONS & UI HELPERS ---
function UserIcon() { return (<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4" strokeLinecap="round" /><path d="M5.5 21a6.5 6.5 0 0113 0" strokeLinecap="round" /></svg>) }
function BellIcon() { return (<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V4a1 1 0 10-2 0v1.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>) }
function LogoutIcon() { return (<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>) }
function ChevronDownIcon() { return (<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>) }

function ProfileAvatar({ className = "w-7 h-7 sm:w-8 sm:h-8" }) {
  const { getProfileImageUrl, isProfileLoading } = useAuth();
  const imageUrl = getProfileImageUrl ? getProfileImageUrl() : null;
  const hasImage = imageUrl && imageUrl !== "/assets/profile.png";

  if (isProfileLoading) {
    return (
      <div className={`relative ${className}`}>
        <div className="absolute inset-0 rounded-full bg-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`relative ${className} shrink-0`}>
      <div className={`absolute inset-0 rounded-full bg-slate-100 flex items-center justify-center border border-slate-300 transition-opacity ${hasImage ? "opacity-0" : "opacity-100"}`}>
        <UserIcon className="w-4 h-4 text-slate-400" />
      </div>
      {hasImage && (
        <img src={imageUrl || "/placeholder.svg"} alt="Profile" className="absolute inset-0 w-full h-full rounded-full object-cover" />
      )}
    </div>
  );
}

// STRICTLY PRESERVED NEW DB MAPPING, MAPPED TO OLD FLATICON IMAGES
const ALL_MODULES = [
  { id: "dashboard", title: "Overview", imageSource: "https://cdn-icons-png.flaticon.com/128/1828/1828859.png", alwaysShow: true },
  { id: "qa_acad_adm", title: "Admissions", imageSource: "https://cdn-icons-png.flaticon.com/128/10220/10220958.png", dbModuleName: "Admissions" },
  { id: "qa_admin_alumni", title: "Alumni", imageSource: "https://cdn-icons-png.flaticon.com/128/9517/9517272.png", dbModuleName: "Alumni" },
  { id: "qa_acad_fees", title: "Fees Management", imageSource: "https://cdn-icons-png.flaticon.com/128/18277/18277055.png", dbModuleName: "Fees Management" },
  { id: "qa_acad_tt", title: "Timetable", imageSource: "https://cdn-icons-png.flaticon.com/128/1254/1254275.png", dbModuleName: "Timetable" },
  { id: "qa_acad_sa", title: "Attendance", imageSource: "https://cdn-icons-png.flaticon.com/128/10293/10293877.png", dbModuleName: "Attendance" },
  { id: "qa_extra_SI", title: "Syllabus", imageSource: "https://cdn-icons-png.flaticon.com/128/4394/4394562.png", dbModuleName: "Syllabus" },
  { id: "qa_acad_lp", title: "Lesson Plan", imageSource: "https://cdn-icons-png.flaticon.com/128/5344/5344646.png", dbModuleName: "Lesson Plan" },
  { id: "qa_acad_exams1", title: "Exams & Schedules", imageSource: "https://cdn-icons-png.flaticon.com/128/9913/9913475.png", dbModuleName: "Exams & Schedules" },
  { id: "qa_teacher_marks", title: "Marks Entry", imageSource: "https://cdn-icons-png.flaticon.com/128/18479/18479099.png", dbModuleName: "Marks Entry" },
  { id: "qa_admin_chat", title: "Group Chat", imageSource: "https://cdn-icons-png.flaticon.com/128/6576/6576146.png", dbModuleName: "Group Chat" },
  { id: "qa_transport", title: "Transport", imageSource: "https://cdn-icons-png.flaticon.com/128/1068/1068580.png", dbModuleName: "Transport" },
  { id: "qa_admin_login", title: "Manage Login", imageSource: "https://cdn-icons-png.flaticon.com/128/15096/15096966.png", dbModuleName: "Manage Login" }
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // States from New Code & Old Code Combined
  const [activeModuleId, setActiveModuleId] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSubMenuOpen, setIsMobileSubMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [unreadCount, setUnreadCount] = useState(0);

  const [rolePermissions, setRolePermissions] = useState([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  // STRICTLY PRESERVED NEW PERMISSIONS LOGIC
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

  const sidebarMenu = useMemo(() => {
    if (!permissionsLoaded) return [];

    return ALL_MODULES.filter(m => {
      if (m.alwaysShow) return true;

      const perm = rolePermissions.find(p => p.module_name === m.dbModuleName);
      
      if (perm) {
        return perm.can_read === 1 || perm.can_edit === 1 || perm.can_delete === 1 || 
               perm.can_read === true || perm.can_edit === true || perm.can_delete === true;
      }
      
      if (user?.role === "Super Admin" || user?.role === "SUPER ADMIN") {
          return true;
      }

      return false;
    }).filter(m => m.title.toLowerCase().includes(query.toLowerCase()));
  }, [query, rolePermissions, permissionsLoaded, user]);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target) && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false); 
        setSelectedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      logout();
      navigate("/");
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setQuery(value); 
    setSelectedIndex(-1); 
    setShowDropdown(value.trim().length > 0);
  };

  const handleSearchFocus = () => { if (query.trim().length > 0) setShowDropdown(true); };

  const handleSelectItem = (item) => {
    setQuery(""); 
    setShowDropdown(false); 
    setSelectedIndex(-1); 
    setIsSearchExpanded(false);
    setActiveModuleId(item.id);
    setIsMobileMenuOpen(false);
    setIsMobileSubMenuOpen(false); 
  };

  const handleSearchKeyDown = (e) => {
    if (!showDropdown || sidebarMenu.length === 0) return;
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setSelectedIndex((prev) => (prev < sidebarMenu.length - 1 ? prev + 1 : 0)); break;
      case "ArrowUp": e.preventDefault(); setSelectedIndex((prev) => (prev > 0 ? prev - 1 : sidebarMenu.length - 1)); break;
      case "Enter": e.preventDefault(); setSelectedIndex(selectedIndex); if (selectedIndex >= 0 && selectedIndex < sidebarMenu.length) handleSelectItem(sidebarMenu[selectedIndex]); break;
      case "Escape": setShowDropdown(false); setSelectedIndex(-1); setIsSearchExpanded(false); searchRef.current?.blur(); break;
    }
  };

  const renderActiveModule = () => {
    switch (activeModuleId) {
      case "qa_admin_login": return <AdminLM />;
      case "profile": return <ProfileScreen />; // Restored Profile Route
      default: return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center text-slate-500">
          <div className="text-6xl mb-4">🛠️</div>
          <p className="text-lg font-semibold text-slate-700 mb-2">{activeModuleId.replace('_', ' ')} Module</p>
          <p className="text-sm mb-6 max-w-sm mx-auto">This module is currently under development for the {user?.role} role.</p>
        </div>
      );
    }
  };

  const activeModule = ALL_MODULES.find(m => m.id === activeModuleId) || ALL_MODULES[0];

  return (
    // EXACT OLD BACKGROUND (bg-slate-50)
    <div className="h-full overflow-hidden bg-slate-50 flex flex-col font-sans">
      <main className="w-full flex-1 flex flex-col min-h-0 overflow-hidden relative">
        
        {/* MOBILE HEADER (EXACT OLD CSS) */}
        <div className="md:hidden bg-slate-100 border-b border-slate-300 p-3 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
              <MdMenu className="text-2xl" />
            </button>
            <h1 
              className="text-lg font-bold text-slate-800 cursor-pointer"
              onClick={() => { handleSelectItem({ id: "dashboard", title: "Overview" }); setIsMobileMenuOpen(false); }}
            >
              {user?.role} Dashboard
            </h1>
          </div>
          <button
            onClick={() => setActiveModuleId("notifications")}
            className={`relative p-1.5 rounded-full transition-colors ${activeModuleId === "notifications" ? "bg-slate-200 text-blue-700 shadow-sm" : "text-slate-500 hover:bg-slate-200"}`}
          >
            <BellIcon />
            {unreadCount > 0 && <span className="absolute top-0 right-0 px-1 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full min-w-[16px] flex items-center justify-center translate-x-1/4 -translate-y-1/4">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>
        </div>

        {isMobileMenuOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />}

        <div className="border-y border-slate-200 shadow-sm flex flex-col md:flex-row overflow-hidden w-full flex-1 min-h-0 relative">
          
          {/* SIDEBAR (EXACT OLD CSS: bg-slate-100, border-slate-400) */}
          <aside className={`fixed inset-y-0 left-0 w-64 transform transition-transform duration-300 ease-in-out z-50 md:z-10 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 md:flex md:w-56 lg:w-64 shrink-0 border-r border-slate-400 bg-slate-100 flex-col h-full shadow-[4px_0_16px_rgba(0,0,0,0.04)]`}>
            
            {/* SIDEBAR HEADER (EXACT OLD CSS) */}
            <div className="px-4 h-[72px] border-b border-slate-200 bg-slate-100 flex items-center justify-between gap-4 shrink-0">
              <div 
                className="flex-1 min-w-0 text-left cursor-pointer group" 
                onClick={() => handleSelectItem({ id: "dashboard", title: "Overview" })}
                title="Go to Dashboard"
              >
                <h1 className="text-base lg:text-lg font-bold text-slate-800 leading-tight whitespace-nowrap group-hover:text-blue-600 transition-colors">{user?.role} Dashboard</h1>
                <p className="text-[9px] lg:text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1 whitespace-nowrap">Empowering Education</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-auto pl-2">
                <button onClick={() => setActiveModuleId("notifications")} className={`relative p-1.5 rounded-full transition-colors flex-shrink-0 hidden md:block ${activeModuleId === "notifications" ? "bg-slate-200 text-blue-700 shadow-sm" : "text-slate-500 hover:bg-slate-200"}`}>
                  <BellIcon />
                  {unreadCount > 0 && <span className="absolute top-0 right-0 px-1 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full min-w-[16px] flex items-center justify-center translate-x-1/4 -translate-y-1/4">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </button>
                <button className="md:hidden text-slate-500 hover:bg-slate-200 p-1 rounded ml-1" onClick={() => setIsMobileMenuOpen(false)}>
                  <MdClose className="text-xl" />
                </button>
              </div>
            </div>

            {/* SIDEBAR MODULES (EXACT OLD CSS & CUSTOM SCROLLBAR) */}
            <div className="flex-1 overflow-y-auto p-2 bg-slate-100 min-h-0 text-left 
              [&::-webkit-scrollbar]:w-1.5
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-slate-300
              [&::-webkit-scrollbar-thumb]:rounded-full
              hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
              
              <div className="px-3 py-1 mb-1 flex items-center justify-between border-b border-slate-300 pb-1.5 min-h-[28px] relative">
                {!isSearchExpanded ? (
                  <>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Menu</h2>
                    <button 
                      onClick={() => { setIsSearchExpanded(true); setTimeout(() => searchRef.current?.focus(), 50); }} 
                      className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 rounded-md"
                      title="Search Modules"
                    >
                      <MdSearch className="text-lg" />
                    </button>
                  </>
                ) : (
                  <div className="relative w-full flex items-center">
                    <MdSearch className="absolute left-1.5 text-slate-400 text-sm pointer-events-none" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={query}
                      onChange={handleSearchChange}
                      onFocus={handleSearchFocus}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Search modules..."
                      className="w-full rounded bg-white pl-6 pr-6 py-0.5 text-xs text-slate-900 border border-slate-300 focus:outline-none focus:border-blue-500 shadow-inner"
                      autoComplete="off"
                    />
                    <button onClick={() => { setQuery(""); setIsSearchExpanded(false); setShowDropdown(false); }} className="absolute right-1.5 text-slate-400 hover:text-slate-600">
                      <MdClose className="text-sm" />
                    </button>

                    {showDropdown && sidebarMenu.length > 0 && (
                      <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                        <div className="p-2 border-b border-slate-100 bg-slate-50">
                          <p className="text-[10px] text-slate-600 font-medium px-1">Results ({sidebarMenu.length})</p>
                        </div>
                        {sidebarMenu.map((item, index) => (
                          <button key={item.id} onClick={() => handleSelectItem(item)} className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0 ${index === selectedIndex ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}>
                            <img src={item.imageSource || "/placeholder.svg"} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                            <span className="text-xs text-slate-900 truncate">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-1">
                {sidebarMenu.map((module) => {
                  const isActive = activeModuleId === module.id;
                  return (
                    // EXACT OLD CSS FOR ACTIVE AND INACTIVE TABS
                    <button 
                      key={module.id} 
                      onClick={() => handleSelectItem(module)} 
                      className={`flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors whitespace-normal ${isActive ? "bg-blue-200/80 text-blue-800 font-semibold border border-blue-300 shadow-sm" : "text-slate-700 font-medium hover:bg-slate-200/50 hover:text-slate-900"}`}
                    >
                      <img src={module.imageSource || "/placeholder.svg"} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                      {module.title}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* SIDEBAR FOOTER & PROFILE (RESTORED EXACTLY FROM OLD CODE) */}
            <div className="p-3 border-t border-slate-300 bg-slate-100 shrink-0">
              <div className="flex items-center gap-2 w-full">
                <button 
                  onClick={() => handleSelectItem({ id: "profile", title: "My Profile" })}
                  className={`flex flex-1 items-center gap-3 p-2 rounded-xl transition-colors text-left overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 ${activeModuleId === "profile" ? "bg-blue-200/50 border border-blue-300" : "hover:bg-slate-200 border border-transparent"}`}
                  title="View Profile"
                >
                  <ProfileAvatar className="w-10 h-10 shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1 justify-center">
                    <span className="text-sm font-bold text-slate-800 truncate leading-tight">
                      {user?.full_name || user?.username || "Admin User"}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate mb-0.5">
                      {user?.role || "Administrator"}
                    </span>
                  </div>
                </button>
                <button 
                  onClick={handleLogout} 
                  className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                  title="Logout"
                >
                  <LogoutIcon />
                </button>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT AREA (EXACT OLD CSS: bg-slate-50) */}
          <div className="flex-1 flex flex-col overflow-hidden relative min-h-0 bg-slate-50 w-full">
            
            {/* DESKTOP HEADER (Styled with Tailwind to match your image reference and old aesthetic) */}
            <div className="hidden md:flex bg-slate-100 px-6 py-5 border-b border-slate-300 justify-between items-center shrink-0">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-slate-800">
                  Good Afternoon, {user?.full_name?.split(' ')[0] || user?.role} 👋
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Here is your school's overview for today.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center">
                  📅 {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* MOBILE ONLY: BOTTOM SHEET TRIGGER */}
            <div className="md:hidden w-full bg-white relative border-b border-slate-200 shadow-sm">
              <button 
                onClick={() => setIsMobileSubMenuOpen(true)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 active:bg-slate-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {activeModule?.imageSource && (
                    <img src={activeModule.imageSource} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-slate-800 truncate">
                    {activeModule?.title || "Select Module"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 flex-shrink-0 pl-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider">Change</span>
                  <ChevronDownIcon />
                </div>
              </button>
            </div>

            {/* MOBILE VIEW: BOTTOM SHEET OVERLAY */}
            {isMobileSubMenuOpen && (
              <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileSubMenuOpen(false)}></div>
                <div className="bg-white rounded-t-2xl w-full max-h-[75vh] flex flex-col relative animate-slide-up shadow-2xl">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <h3 className="text-sm font-bold text-slate-800">Select Module</h3>
                    <button onClick={() => setIsMobileSubMenuOpen(false)} className="p-1.5 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
                      <MdClose className="text-lg" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 pb-6 custom-scrollbar">
                    <div className="flex flex-col gap-1">
                      {sidebarMenu.map((item) => {
                        const isActive = activeModule && activeModule.id === item.id;
                        return (
                          <button 
                            key={item.id} 
                            onClick={() => handleSelectItem(item)} 
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-colors ${isActive ? "bg-blue-50 text-blue-700" : "bg-transparent text-slate-700 hover:bg-slate-50 active:bg-slate-100"}`}
                          >
                            <img src={item.imageSource || "/placeholder.svg"} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
                            <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>
                              {item.title}
                            </span>
                            {isActive && (
                              <svg className="w-5 h-5 ml-auto text-blue-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RENDER THE ACTIVE MODULE */}
            <div className="flex-1 overflow-y-auto relative bg-transparent w-full flex flex-col p-2 md:p-3 custom-scrollbar text-left" id="module-render-area">
              <Suspense fallback={
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                   <div className="w-8 h-8 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
                </div>
              }>
                {renderActiveModule()}
              </Suspense>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}