import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Phone, Bell } from 'lucide-react';
import smartedzLogo from '../assets/smartedzlogo.png';

export default function DashboardHeader() {
  const { user, API_URL } = useAuth();
  const [inst, setInst] = useState(null);

  useEffect(() => {
    const fetchInst = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/data/${user.institutionId}`);
        const data = await res.json();
        setInst(data.institution);
      } catch (err) {
        console.error("Header fetch error", err);
      }
    };
    if (user?.institutionId) fetchInst();
  }, [user, API_URL]);

  return (
    <header className="bg-[#F1F5F9]/80 backdrop-blur-md border-b border-slate-200 px-10 py-5 grid grid-cols-3 items-center sticky top-0 z-30">
      
      {/* SECTION 1: School Logo (Left) */}
      <div className="flex items-center">
        {inst?.logo ? (
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
            <img src={inst.logo} alt="School Logo" className="h-14 w-auto object-contain" />
          </div>
        ) : (
          <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200">
            <span className="text-[10px] font-black text-slate-300 uppercase">Logo</span>
          </div>
        )}
      </div>

      {/* SECTION 2: School Official Info (Center) */}
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">
          {inst?.name || "Institution Name"}
        </h1>
        <div className="flex items-center justify-center gap-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">
          <span className="flex items-center gap-2 hover:text-blue-600 transition-colors cursor-pointer">
            <Mail size={14} className="text-blue-400" /> {inst?.school_email || "Not Set"}
          </span>
          <span className="flex items-center gap-2 hover:text-blue-600 transition-colors cursor-pointer">
            <Phone size={14} className="text-blue-400" /> {inst?.phone || "Not Set"}
          </span>
        </div>
      </div>

      {/* SECTION 3: Branding & Notifications (Right) */}
      <div className="flex justify-end items-center gap-8">
        {/* Notification Bell */}
        <div className="relative group cursor-pointer">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all">
            <Bell size={22} className="text-slate-400 group-hover:text-white" />
          </div>
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-4 border-[#F1F5F9]">
            99+
          </span>
        </div>

        {/* Vertical Divider */}
        <div className="h-12 w-[1px] bg-slate-300/50"></div>

        {/* Powered By Box */}
        <div className="flex items-center gap-4 bg-white px-5 py-2.5 rounded-[1.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-default">
          <div className="text-right">
            <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] leading-none mb-1">Powered By</p>
            <p className="text-[14px] font-black text-slate-800 leading-none tracking-tighter">SmartEdz</p>
          </div>
          <img src={smartedzLogo} alt="SmartEdz Branding" className="h-9 w-auto object-contain" />
        </div>
      </div>
    </header>
  );
}