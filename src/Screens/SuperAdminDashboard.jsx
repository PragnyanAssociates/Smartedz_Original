import React, { useState } from 'react';
import Sidebar from './Sidebar';
import DashboardHeader from './DashboardHeader';
import Overview from './Overview';
import ManageLogin from './ManageLogin';

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const renderContent = () => {
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