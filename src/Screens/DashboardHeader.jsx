import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Phone, Menu } from 'lucide-react';
import smartedzLogo from '../assets/smartedzlogo.png';

export default function DashboardHeader({ onMenuClick }) {
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
    <header className="w-full bg-white z-20 border-b border-zinc-200 shadow-sm shrink-0">
      
      {/* Changed px-8 to px-4 sm:px-8 for tighter mobile padding */}
      <div className="px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        
        {/* SECTION 1: School Logo + Mobile Hamburger */}
        <div className="flex-1 md:w-1/3 flex items-center justify-start gap-3">
          
          {/* HAMBURGER ICON: Visible only on mobile (< 768px) */}
          <button 
            onClick={onMenuClick} 
            className="md:hidden p-1.5 -ml-1.5 text-zinc-600 hover:text-primary hover:bg-zinc-50 rounded-md transition-colors shrink-0"
          >
            <Menu className="size-6" />
          </button>

          {inst?.logo ? (
            <img 
              src={inst.logo} 
              alt="School Logo" 
              className="h-8 md:h-10 w-auto object-contain shrink-0" 
            />
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
               <div className="size-8 sm:size-10 bg-zinc-50 rounded flex items-center justify-center border border-zinc-200 shrink-0">
                  <span className="text-[8px] sm:text-[9px] font-semibold text-zinc-400">LOGO</span>
               </div>
               <div className="flex flex-col">
                  <span className="text-[8px] sm:text-[9px] font-semibold text-accent uppercase leading-none mb-0.5">Knowledge is Light</span>
                  <span className="text-xs sm:text-sm font-semibold text-zinc-900 leading-none truncate max-w-[120px] sm:max-w-full">VIVEKANANDA</span>
                  <span className="hidden sm:block text-[9px] font-medium text-zinc-500 leading-none mt-0.5">Public School</span>
               </div>
            </div>
          )}
        </div>

        {/* SECTION 2: School Official Info (Hidden on Mobile) */}
        <div className="hidden md:flex w-1/3 flex-col items-center justify-center text-center">
          <h1 className="text-lg font-semibold text-zinc-900 uppercase tracking-tight leading-none mb-1.5 truncate w-full px-4">
            {inst?.name || "VIVEKANANDA PUBLIC SCHOOL"}
          </h1>
          
          <div className="flex items-center justify-center gap-6 text-zinc-500 font-medium text-[11px]">
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5 text-primary shrink-0" />
              <span className="truncate max-w-[150px] lg:max-w-full">{inst?.school_email || "vivekanandaschoolhyd@gmail.com"}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5 text-primary shrink-0" />
              <span className="tabular-nums whitespace-nowrap">{inst?.phone || "040-23355998"}</span>
            </span>
          </div>
        </div>

        {/* SECTION 3: Branding */}
        <div className="flex-1 md:w-1/3 flex items-center justify-end gap-2 sm:gap-2.5">
          <div className="flex flex-col text-right leading-none">
            <p className="text-[7px] sm:text-[8px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Powered By</p>
            <p className="text-sm sm:text-base font-semibold italic tracking-tight">
              <span className="text-primary">Smart</span>
              <span className="text-accent">Edz</span>
            </p>
          </div>
          <img src={smartedzLogo} alt="SmartEdz" className="h-6 sm:h-8 w-auto object-contain shrink-0" />
        </div>
        
      </div>
    </header>
  );
}