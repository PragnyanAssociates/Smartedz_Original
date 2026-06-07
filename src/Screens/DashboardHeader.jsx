import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Phone, Menu, Building2 } from 'lucide-react';
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

  // Use ONLY this institution's real data. No hardcoded school name /
  // email / phone fallbacks (those used to leak one school's identity
  // onto every school that hadn't filled in its details yet).
  const schoolName = inst?.name || '';
  const initial = (inst?.name || '?').charAt(0).toUpperCase();

  return (
    <header className="w-full bg-white z-20 border-b border-zinc-200 shadow-sm shrink-0">

      <div className="px-4 sm:px-8 py-3 flex items-center justify-between gap-4">

        {/* SECTION 1: School Logo + Mobile Hamburger */}
        <div className="flex-1 md:w-1/3 flex items-center justify-start gap-3">

          <button
            onClick={onMenuClick}
            className="md:hidden p-1.5 -ml-1.5 text-zinc-600 hover:text-primary hover:bg-zinc-50 rounded-md transition-colors shrink-0"
          >
            <Menu className="size-6" />
          </button>

          {inst?.logo ? (
            <img
              src={inst.logo}
              alt={schoolName || 'School Logo'}
              className="h-14 md:h-16 w-auto object-contain shrink-0"
            />
          ) : (
            // Neutral placeholder — shows this school's initial, never a
            // hardcoded name. Falls back to a generic icon if name is empty.
            <div className="size-12 sm:size-14 bg-primary/10 text-primary rounded flex items-center justify-center border border-primary/20 shrink-0 font-semibold text-lg">
              {schoolName ? initial : <Building2 className="size-6 text-zinc-400" />}
            </div>
          )}

          {/* On mobile the centre block is hidden, so show the name here */}
          {schoolName && (
            <span className="md:hidden text-sm font-semibold text-zinc-900 truncate max-w-[160px]">
              {schoolName}
            </span>
          )}
        </div>

        {/* SECTION 2: School Official Info (Middle) — real data only */}
        <div className="hidden md:flex w-1/3 flex-col items-center justify-center text-center">
          <h1 className="text-lg font-semibold text-zinc-900 uppercase tracking-tight leading-none mb-1.5 truncate w-full px-4">
            {schoolName}
          </h1>

          {(inst?.school_email || inst?.phone) && (
            <div className="flex items-center justify-center gap-6 text-zinc-500 font-medium text-[11px]">
              {inst?.school_email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5 text-primary shrink-0" />
                  <span className="truncate max-w-[150px] lg:max-w-full">{inst.school_email}</span>
                </span>
              )}
              {inst?.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5 text-primary shrink-0" />
                  <span className="tabular-nums whitespace-nowrap">{inst.phone}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* SECTION 3: Branding (Right) — SmartEdz product brand (kept) */}
        <div className="flex-1 md:w-1/3 flex items-center justify-end gap-3 sm:gap-4">
          <div className="flex flex-col text-right leading-none">
            <p className="text-[8px] sm:text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Powered By</p>
            <p className="text-sm sm:text-lg font-semibold italic tracking-tight">
              <span className="text-primary">Smart</span>
              <span className="text-accent">Edz</span>
            </p>
          </div>
          <img
            src={smartedzLogo}
            alt="SmartEdz"
            className="h-12 sm:h-16 w-auto object-contain shrink-0"
          />
        </div>

      </div>
    </header>
  );
}