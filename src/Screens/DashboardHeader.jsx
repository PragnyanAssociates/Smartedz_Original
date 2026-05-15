import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Phone } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

export default function DashboardHeader() {
  const { user } = useAuth();
  const [inst, setInst] = useState(null);

  useEffect(() => {
    const fetchInst = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
        const data = await res.json();
        setInst(data.institution);
      } catch (err) {
        console.error('Header fetch error', err);
      }
    };
    if (user?.institutionId) fetchInst();
  }, [user]);

  return (
    <header className="w-full bg-white z-50 border-b border-slate-200">
      {/* Top Brown Border */}
      <div className="h-2 w-full bg-[#3d2b1f]"></div>

      <div className="px-10 py-4 grid grid-cols-12 items-center min-h-[110px]">

        {/* SECTION 1: School Logo (Left) */}
        <div className="col-span-3 flex items-center">
          {inst?.logo ? (
            <img src={inst.logo} alt="School Logo" className="h-20 w-auto object-contain" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400">LOGO</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-orange-500 uppercase leading-none">Knowledge is Light</span>
                <span className="text-sm font-black text-green-700 leading-tight">YOUR SCHOOL</span>
                <span className="text-[10px] font-bold text-slate-500 leading-none">Public School</span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: School Official Info (Center) */}
        <div className="col-span-6 flex flex-col items-center justify-center text-center">
          <h1 className="text-4xl font-black text-[#1e3a5f] uppercase tracking-tighter mb-2">
            {inst?.name || 'SCHOOL NAME'}
          </h1>
          <div className="flex items-center justify-center gap-8 text-slate-600 font-bold text-sm">
            <span className="flex items-center gap-2">
              <Mail size={18} className="text-[#1e3a5f]" />
              {inst?.school_email || 'school@example.com'}
            </span>
            <span className="flex items-center gap-2">
              <Phone size={18} className="text-[#1e3a5f]" />
              {inst?.phone || '+91 000-000-0000'}
            </span>
          </div>
        </div>

        {/* SECTION 3: Branding (Right) */}
        <div className="col-span-3 flex justify-end items-center">
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
            <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center shadow">
              <span className="text-white text-xl font-black italic">S</span>
            </div>
            <div className="flex flex-col leading-none">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Powered By</p>
              <p className="text-xl font-black text-[#0070c0] italic">
                Smart<span className="text-[#f7941d]">Edz</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}