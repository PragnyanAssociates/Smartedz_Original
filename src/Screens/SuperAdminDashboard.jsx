import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './Sidebar';
import DashboardHeader from './DashboardHeader';
import Overview from './Overview';
import ManageLogin from './ManageLogin';
import { PermissionsProvider, usePermissions } from './PermissionsContext';
import { TAB_TO_MODULE, MODULES } from './Modules';
import { ShieldOff } from 'lucide-react';

// ---- Inner component (after PermissionsProvider is mounted) ---------
function DashboardShell() {
  const { isVisible, can, loading } = usePermissions();

  // The first tab the user is allowed to see. Defaults to 'overview' since
  // Overview is alwaysVisible, but if you mark Overview as gated later this
  // will fall back to the first permitted item.
  const firstAllowedTab = useMemo(() => {
    const first = MODULES.find(m => m.alwaysVisible || isVisible(m.module_name));
    return first?.id || 'overview';
  }, [isVisible]);

  const [activeTab, setActiveTab] = useState(firstAllowedTab);

  // If the user lands on a tab they shouldn't see (stale state, deep link,
  // or admin just revoked access) bounce them to a permitted tab.
  useEffect(() => {
    if (loading) return;
    const moduleName = TAB_TO_MODULE[activeTab];
    const currentMod = MODULES.find(m => m.id === activeTab);
    if (currentMod?.alwaysVisible) return;             // e.g. Overview
    if (moduleName && !isVisible(moduleName)) {
      setActiveTab(firstAllowedTab);
    }
  }, [activeTab, isVisible, loading, firstAllowedTab]);

  const renderContent = () => {
    const moduleName = TAB_TO_MODULE[activeTab];
    const currentMod = MODULES.find(m => m.id === activeTab);

    // Permission gate. Overview is always allowed.
    if (moduleName && !currentMod?.alwaysVisible && !can(moduleName, 'view')) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6">
              <ShieldOff size={32} />
            </div>
            <h2 className="text-3xl font-black text-slate-900">Access Denied</h2>
            <p className="text-slate-500 mt-2 font-medium">
              You don't have permission to view <strong>{moduleName}</strong>.
              Ask your administrator to enable read access for your role.
            </p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <Overview />;
      case 'manage-login':
        return <ManageLogin />;
      default:
        return (
          <div className="h-full flex items-center justify-center flex-col text-center opacity-40">
            <h2 className="text-3xl font-black text-slate-900">Module Under Development</h2>
            <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest">This section is coming soon</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      <DashboardHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

// ---- Outer wrapper that provides the PermissionsContext --------------
export default function SuperAdminDashboard() {
  return (
    <PermissionsProvider>
      <DashboardShell />
    </PermissionsProvider>
  );
}