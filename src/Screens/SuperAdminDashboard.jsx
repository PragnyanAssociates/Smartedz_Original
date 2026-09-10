import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from './Sidebar';
import DashboardHeader from './DashboardHeader';
import Overview from './Overview';
import ManageLogin from './ManageLogin';
import FeeManagement from '../components/Fee/FeeManagement';
import DailyExpenses from '../components/DailyExpenses/DailyExpenses';
import Transport from '../components/Transport/Transport';
import Timetable from '../components/Timetable/Timetable';
import AcademicCalendar from '../components/Calendar/AcademicCalendar';
import Attendance from '../components/Attendance/Attendance';
import Exams from '../components/Exams/Exams';
import Reports from '../components/Reports/Reports';
import Performance from '../components/Performance/Performance';
import Directory from '../components/UsersView/Directory';
import Gallery from '../components/Gallery/Gallery';
import Homework from '../components/Homework/Homework';
import DigitalLabs from '../components/Labs/DigitalLabs';
import Meals from '../components/Meals/Meals';
import PTM from '../components/PTM/PTM';
import PreAdmissions from '../components/preadmissions/PreAdmissions';
import StudyMaterialsScreen from '../components/study-materials/StudyMaterialsScreen';
import Syllabus from '../components/Syllabus/Syllabus';
import WhatsAppLayout from '../components/chat/WhatsAppLayout';
import Alumni from '../components/Alumni/Alumni';
import LessonPlan from '../components/LessonPlan/LessonPlan';
import NotificationsScreen from './NotificationsScreen';
import Profile from './Profile';
import OnlineClasses from '../components/OnlineClasses/OnlineClasses';
import InventoryAssets from '../components/Assets/InventoryAssets';
import Support from './Support';

import { PermissionsProvider, usePermissions } from './PermissionsContext';
import { useAuth } from '../context/AuthContext';
import { MODULES } from './Modules';
import { ShieldOff } from 'lucide-react';

// Active tab is remembered PER LOGIN SESSION, keyed by the login token:
//   • Refresh / reload -> same token -> you stay on the same module.
//   • Fresh login (new token / different user) -> land on the first module
//     that user is actually allowed to see (NOT forced to Overview).
const TAB_KEY = 'dashboard_active_tab';

function DashboardShell() {
  const { isVisible, can, loading } = usePermissions();
  const { token } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // First module this user may actually see (Overview only if permitted).
  // hideFromSidebar modules (Profile / Notifications) are never a landing tab.
  const firstAllowedTab = useMemo(() => {
    const first = MODULES.find(m => !m.hideFromSidebar && (m.alwaysVisible || isVisible(m.module_name)));
    return first?.id || 'profile';
  }, [isVisible]);

  const restoredRef  = useRef(false);   // did we restore a tab (i.e. a refresh)?
  const defaultedRef = useRef(false);   // have we set the fresh-login default yet?

  // On a refresh, restore the tab saved under THIS login token. On a fresh
  // login there's no match, so we set the real default once permissions load.
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(TAB_KEY) || 'null');
      if (saved && saved.token && saved.token === token && saved.tab) {
        restoredRef.current = true;
        return saved.tab;
      }
    } catch { /* ignore */ }
    return firstAllowedTab;   // provisional; corrected below after perms load
  });

  // One-time cleanup of the old shared localStorage key.
  useEffect(() => {
    try { localStorage.removeItem(TAB_KEY); } catch { /* ignore */ }
  }, []);

  // Fresh login (not a refresh): once permissions have loaded, land on the
  // first module this user can see — so a hidden Overview is skipped.
  useEffect(() => {
    if (loading || restoredRef.current || defaultedRef.current) return;
    defaultedRef.current = true;
    setActiveTab(firstAllowedTab);
  }, [loading, firstAllowedTab]);

  // Persist the current tab with the token (only a refresh restores it).
  useEffect(() => {
    try {
      if (token) sessionStorage.setItem(TAB_KEY, JSON.stringify({ token, tab: activeTab }));
    } catch { /* ignore */ }
  }, [activeTab, token]);

  // Safety: if the current tab isn't permitted for this user, bounce to default.
  useEffect(() => {
    if (loading) return;
    const currentMod = MODULES.find(m => m.id === activeTab);
    if (!currentMod) return;
    if (currentMod.alwaysVisible) return;
    if (!isVisible(currentMod.module_name)) {
      setActiveTab(firstAllowedTab);
    }
  }, [activeTab, isVisible, loading, firstAllowedTab]);

  const renderContent = () => {
    // Wait for permissions before deciding what to render — avoids briefly
    // flashing a module the user isn't allowed to see.
    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
        </div>
      );
    }

    const currentMod = MODULES.find(m => m.id === activeTab);
    const moduleName = currentMod?.module_name;

    if (moduleName && !currentMod?.alwaysVisible && !can(moduleName, 'view')) {
      return (
        <div className="h-full flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="size-16 mx-auto bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4 ring-1 ring-accent/20">
              <ShieldOff className="size-8 shrink-0" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">Access Denied</h2>
            <p className="text-sm text-zinc-500 mt-2">You do not have permission to view this module.</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':          return <Overview />;
      case 'manage-login':      return <ManageLogin />;
      case 'DailyExpenses':     return <DailyExpenses />;
      case 'FeeManagement':     return <FeeManagement />;
      case 'Transport':         return <Transport />;
      case 'timetable':         return <Timetable />;
      case 'academic-calendar': return <AcademicCalendar />;
      case 'attendance':        return <Attendance />;
      case 'Exams':             return <Exams />;
      case 'reports':           return <Reports />;
      case 'Performance':       return <Performance />;
      case 'Directory':         return <Directory />;
      case 'profile':           return <Profile />;
      case 'Gallery':           return <Gallery />;
      case 'Homework':          return <Homework />;
      case 'Meals':             return <Meals />;
      case 'PTM':               return <PTM />;
      case 'OnlineClasses':     return <OnlineClasses/>;
      case 'DigitalLabs':       return <DigitalLabs/>;
      case 'PreAdmissions':     return <PreAdmissions/>;
      case 'StudyMaterials':    return <StudyMaterialsScreen/>;
      case 'Syllabus':          return <Syllabus/>;
      case 'GroupChat':         return <WhatsAppLayout/>;
      case 'Alumni':            return <Alumni/>;
      case 'LessonPlan':        return <LessonPlan/>;
      case 'InventoryAssets':   return <InventoryAssets/>;
      case 'Support':           return <Support/>;
      case 'notifications':     return <NotificationsScreen onNavigate={setActiveTab} />;

      default:
        return (
          <div className="h-full flex items-center justify-center flex-col text-center opacity-60 p-6">
            <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">Module Under Development</h2>
            <p className="text-[10px] font-semibold text-zinc-500 mt-2 uppercase tracking-wider">This section is coming soon</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-50 overflow-hidden w-full font-sans">

      <div className="h-[2px] w-full bg-gradient-brand shrink-0 z-50" />

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isMobileOpen={isMobileMenuOpen}
          setIsMobileOpen={setIsMobileMenuOpen}
        />

        <div className="flex flex-col flex-1 min-w-0">
          <DashboardHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
          <main className="flex-1 overflow-y-auto custom-scrollbar relative">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  return (
    <PermissionsProvider>
      <DashboardShell />
    </PermissionsProvider>
  );
}