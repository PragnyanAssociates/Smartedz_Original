import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Phone, Menu, Building2 } from 'lucide-react';
import smartedzLogo from '../assets/smartedzlogo.png';

export default function DashboardHeader({ onMenuClick }) {
  const { user, API_URL } = useAuth();
  const [inst, setInst] = useState(null);
  const [parent, setParent] = useState(null); // the group, fetched only if needed

  useEffect(() => {
    let cancelled = false;
    const fetchInst = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/data/${user.institutionId}`);
        const data = await res.json();
        if (cancelled) return;
        const institution = data.institution;
        setInst(institution);

        // If this is a branch but the backend didn't include the group's
        // name, fetch the group directly so we can show the INSTITUTE name
        // on top (works even if Section 3 wasn't updated).
        if (institution?.parent_id && !institution?.parent_name) {
          try {
            const pr = await fetch(`${API_URL}/api/admin/data/${institution.parent_id}`);
            const pdata = await pr.json();
            if (!cancelled) setParent(pdata.institution || null);
          } catch (e) { /* ignore */ }
        } else {
          setParent(null);
        }
      } catch (err) {
        console.error("Header fetch error", err);
      }
    };
    if (user?.institutionId) fetchInst();
    return () => { cancelled = true; };
  }, [user, API_URL]);

  // INSTITUTE name (same for every branch) goes on top; the BRANCH name
  // (different per branch) goes underneath. Standalone schools / groups
  // just show their own name with no branch line.
  const isBranch = !!inst?.parent_id;
  const groupName = inst?.parent_name || parent?.name || '';

  const instituteName = isBranch ? (groupName || inst?.name || '') : (inst?.name || '');
  const branchName = isBranch ? (inst?.name || '') : '';
  const logoSrc = inst?.logo || ''; // each entity shows its OWN logo only
  const initial = (instituteName || '?').charAt(0).toUpperCase();

  return (
    <header className="w-full bg-white z-20 border-b border-zinc-200 shadow-sm shrink-0">
      <div className="px-4 sm:px-8 h-20 flex items-center justify-between gap-4">

        {/* SECTION 1: Institute logo */}
        <div className="flex-1 md:w-1/3 flex items-center justify-start gap-3 h-full">
          <button
            onClick={onMenuClick}
            className="md:hidden p-1.5 -ml-1.5 text-zinc-600 hover:text-primary hover:bg-zinc-50 rounded-md transition-colors shrink-0"
          >
            <Menu className="size-6" />
          </button>

          {logoSrc ? (
            <img
              src={logoSrc}
              alt={instituteName || 'Logo'}
              className="h-[76px] w-auto object-contain shrink-0"
            />
          ) : (
            <div className="size-14 bg-primary/10 text-primary rounded flex items-center justify-center border border-primary/20 shrink-0 font-semibold text-lg">
              {instituteName ? initial : <Building2 className="size-6 text-zinc-400" />}
            </div>
          )}

          {instituteName && (
            <span className="md:hidden text-sm font-semibold text-zinc-900 truncate max-w-[140px]">
              {instituteName}{branchName ? ` \u00b7 ${branchName}` : ''}
            </span>
          )}
        </div>

        {/* SECTION 2: Institute info (middle) */}
        <div className="hidden md:flex w-1/3 flex-col items-center justify-center text-center">
          <h1 className="text-lg font-semibold text-zinc-900 uppercase tracking-tight leading-none mb-1.5 truncate w-full px-4">
            {instituteName}
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

          {/* Branch line — right under the email / phone, only for branches */}
          {branchName && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/5 ring-1 ring-inset ring-primary/15 px-2.5 py-0.5 rounded-full">
              <Building2 className="size-3 shrink-0" /> {branchName} Branch
            </div>
          )}
        </div>

        {/* SECTION 3: Branding (right) */}
        <div className="flex-1 md:w-1/3 flex items-center justify-end gap-3 sm:gap-4 h-full">
          <div className="flex flex-col text-right leading-none">
            <p className="text-[8px] sm:text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Developed by</p>
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