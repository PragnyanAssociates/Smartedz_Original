import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';
import { Check, ShieldCheck } from 'lucide-react';

export default function Overview() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.institutionId) return;
    fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`)
      .then(r => r.json())
      .then(j => { setData(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!data) return null;

  const totalStudents = data.users.filter(u => (u.role || '').toLowerCase().includes('student')).length;
  const totalStaff    = data.users.filter(u => !(u.role || '').toLowerCase().includes('student')).length;
  const activeYear    = data.academicYears.find(y => y.isActive);

  // Dynamic setup steps based on actual fetched data
  const steps = [
    { id: 1, title: "Manage Logins", desc: "Create the roles your school needs.", done: data.roles.length > 0 },
    { id: 2, title: "Classes", desc: "Create every class with applicable sections.", done: data.classes.length > 0 },
    { id: 3, title: "Academics", desc: "Create the current academic year and set as active.", done: !!activeYear },
    { id: 4, title: "Users", desc: "Add Teachers, Students, Admins, etc.", done: data.users.length > 1 },
    { id: 5, title: "Permissions", desc: "Configure module access per role.", done: false },
    { id: 6, title: "Promotion", desc: "Move students up at the end of the year.", done: false }
  ];

  return (
  <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
      
      {/* 1. Page Header */}
      <header className="mb-6 lg:mb-8 flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-zinc-500 max-w-[56ch]">
          Here is what is happening at {data.institution?.name || 'your institution'} today.
        </p>
      </header>

      {/* 2. KPI Row - Mobile Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 lg:mb-8">
        
        {/* Primary-Hero: Students */}
        <div className="p-4 rounded-md flex flex-col gap-1 bg-primary text-white shadow-sm ring-1 ring-primary/40">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/80 truncate">Students</span>
          <span className="text-2xl font-semibold tabular-nums text-white">{totalStudents}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/80 truncate">Enrolled</span>
        </div>

        {/* Accent-Tint: Staff */}
        <div className="p-4 ring-1 ring-accent/20 bg-accent/5 rounded-md flex flex-col gap-1 border-l-2 border-accent">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent truncate">Staff</span>
          <span className="text-2xl font-semibold tabular-nums text-zinc-900">{totalStaff}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-accent truncate">Active members</span>
        </div>

        {/* Neutral: Total Users */}
        <div className="p-4 ring-1 ring-black/5 bg-white rounded-md flex flex-col gap-1 hover:ring-zinc-200 transition-all">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 truncate">Total Users</span>
          <span className="text-2xl font-semibold tabular-nums text-zinc-900">{data.users.length}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 truncate">System wide</span>
        </div>

        {/* Neutral: Classes */}
        <div className="p-4 ring-1 ring-black/5 bg-white rounded-md flex flex-col gap-1 hover:ring-zinc-200 transition-all">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 truncate">Classes</span>
          <span className="text-2xl font-semibold tabular-nums text-zinc-900">{data.classes.length}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 truncate">Configured</span>
        </div>

        {/* Neutral: Roles */}
        <div className="p-4 ring-1 ring-black/5 bg-white rounded-md flex flex-col gap-1 hover:ring-zinc-200 transition-all">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 truncate">Roles Defined</span>
          <span className="text-2xl font-semibold tabular-nums text-zinc-900">{data.roles.length}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 truncate">RBAC</span>
        </div>

        {/* Neutral: Active Year */}
        <div className="p-4 ring-1 ring-black/5 bg-white rounded-md flex flex-col gap-1 hover:ring-zinc-200 transition-all">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 truncate">Active Year</span>
          <span className="text-xl font-semibold text-zinc-900 truncate" title={activeYear?.name || 'None'}>
            {activeYear?.name || 'None'}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 truncate">Current term</span>
        </div>
      </div>

      {/* 3. Body Layout - Stacks on mobile, side-by-side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* Main Column */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-zinc-900 mb-1">Quick Start Checklist</h2>
            <p className="text-[11px] text-zinc-500 mb-6">
              New here? Set things up in this order. Steps will automatically check off as you complete them.
            </p>
            
            <div className="space-y-4">
              {steps.map(s => (
                <div key={s.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 size-4 rounded flex items-center justify-center shrink-0 ${s.done ? "bg-primary border-primary" : "border border-zinc-300 bg-zinc-50"}`}>
                    {s.done && <Check className="size-2.5 text-white shrink-0" strokeWidth={3} />}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-xs font-semibold ${s.done ? "text-zinc-400 line-through" : "text-zinc-900"}`}>{s.title}</span>
                    <span className="text-[10px] text-zinc-500 leading-relaxed">{s.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side Column */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">System Status</h2>
            <div className="flex items-center gap-3 p-3 bg-green-50/50 border border-green-100 rounded-md">
              <div className="size-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="size-4 text-green-600 shrink-0" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-900">All Systems Operational</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Database connection stable</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}