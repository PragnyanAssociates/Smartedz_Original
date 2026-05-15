import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Layers, Calendar, ShieldCheck, GraduationCap, UserCheck } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

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
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!data) return null;

  const totalStudents = data.users.filter(u => (u.role || '').toLowerCase().includes('student')).length;
  const totalStaff    = data.users.filter(u => !(u.role || '').toLowerCase().includes('student')).length;
  const activeYear    = data.academicYears.find(y => y.isActive);

  const cards = [
    { label: 'Total Users',   value: data.users.length,        icon: Users,         color: 'blue' },
    { label: 'Students',      value: totalStudents,            icon: GraduationCap, color: 'emerald' },
    { label: 'Staff',         value: totalStaff,               icon: UserCheck,     color: 'amber' },
    { label: 'Classes',       value: data.classes.length,      icon: Layers,        color: 'purple' },
    { label: 'Roles Defined', value: data.roles.length,        icon: ShieldCheck,   color: 'rose' },
    { label: 'Active Year',   value: activeYear?.name || '—',  icon: Calendar,      color: 'slate' },
  ];

  const colorMap = {
    blue:    'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    purple:  'bg-purple-50 text-purple-600',
    rose:    'bg-rose-50 text-rose-600',
    slate:   'bg-slate-100 text-slate-600',
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-slate-500 font-medium mt-1">
          Here's what's happening at {data.institution?.name || 'your institution'} today.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorMap[c.color]} mb-4`}>
              <c.icon size={22} />
            </div>
            <p className="text-3xl font-black text-slate-800">{c.value}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Quick Start</h3>
        <p className="text-slate-500 text-sm font-medium mb-6">
          New here? Set things up in this order — each step unlocks the next.
        </p>
        <ol className="space-y-3 list-decimal list-inside text-sm text-slate-600 font-medium">
          <li>Go to <strong>Manage Logins → Roles</strong> and create the roles your school needs.</li>
          <li>Switch to <strong>Classes</strong> and create every class (with sections if applicable).</li>
          <li>Open <strong>Academics</strong> and create the current academic year, then click "Set as Active".</li>
          <li>Use <strong>Users</strong> to add Teachers, Students, Admins, etc.</li>
          <li>Configure <strong>Permissions</strong> per role for each module.</li>
          <li>At the end of the year, use <strong>Promotion</strong> to move students up.</li>
        </ol>
      </div>
    </div>
  );
}