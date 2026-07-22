import React, { useState, useEffect, useMemo } from 'react';
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

import { PermissionsProvider, usePermissions } from './PermissionsContext';
import { MODULES } from './Modules';
import { ShieldOff } from 'lucide-react';

function DashboardShell() {
  const { isVisible, can, loading } = usePermissions();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const firstAllowedTab = useMemo(() => {
    const first = MODULES.find(m => !m.hideFromSidebar && (m.alwaysVisible || isVisible(m.module_name)));
    return first?.id || 'overview';
  }, [isVisible]);

  // 1. Initialize state from localStorage, fallback to firstAllowedTab
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('dashboard_active_tab');
    return savedTab || firstAllowedTab;
  });

  // 2. Save to localStorage whenever the user changes the tab
  useEffect(() => {
    localStorage.setItem('dashboard_active_tab', activeTab);
  }, [activeTab]);

  // 3. Fallback security check (already in your code, works perfectly with localStorage)
  useEffect(() => {
    if (loading) return;
    const currentMod = MODULES.find(m => m.id === activeTab);
    if (!currentMod) return;
    if (currentMod.alwaysVisible) return;
    
    // If they saved a tab in localStorage but lost permission, kick them to default
    if (!isVisible(currentMod.module_name)) {
      setActiveTab(firstAllowedTab);
    }
  }, [activeTab, isVisible, loading, firstAllowedTab]);

  const renderContent = () => {
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