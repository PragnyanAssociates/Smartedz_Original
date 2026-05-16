import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Building2, Plus, LogOut, Trash2, Edit3, Image as ImageIcon, Shield,
  Mail, Lock, User, Globe, Phone, Calendar, AlertTriangle, CheckCircle2, Infinity as InfinityIcon
} from 'lucide-react';
import smartedzLogo from '../assets/smartedzlogo.png';

// =====================================================================
//  Plan options shown in the dropdown. Keep this list identical to
//  PLAN_DAYS in backend/index.js or saves will silently fall back to
//  "Full Time".
// =====================================================================
const PLAN_OPTIONS = ['7 days', '30 days', '90 days', '180 days', '1 year', '3 years', 'Full Time'];

// Today's date as YYYY-MM-DD for <input type="date" />
const todayISO = () => new Date().toISOString().slice(0, 10);

// Format a YYYY-MM-DD (or Date) as DD/MM/YYYY
const fmtDMY = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

// Pick chip styling based on plan status returned by the backend
const planBadgeStyle = (inst) => {
  if (inst.usage_plan === 'Full Time' || inst.daysLeft === null) {
    return {
      wrap: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
      icon: InfinityIcon,
      headline: 'Full Time',
      sub: 'No expiry'
    };
  }
  if (inst.expired) {
    return {
      wrap: 'bg-red-50 text-red-700 ring-1 ring-red-200',
      icon: AlertTriangle,
      headline: 'Plan Expired',
      sub: 'Renew to restore access'
    };
  }
  if (inst.daysLeft <= 7) {
    return {
      wrap: 'bg-red-50 text-red-700 ring-1 ring-red-200',
      icon: AlertTriangle,
      headline: `Only ${inst.daysLeft} day${inst.daysLeft === 1 ? '' : 's'} left`,
      sub: 'Plan ending soon'
    };
  }
  if (inst.daysLeft <= 30) {
    return {
      wrap: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
      icon: Calendar,
      headline: `${inst.daysLeft} days left`,
      sub: 'Active'
    };
  }
  return {
    wrap: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
    icon: CheckCircle2,
    headline: `${inst.daysLeft} days left`,
    sub: 'Active'
  };
};

export default function DeveloperDashboard() {
  const { institutions, usersList, logout, refreshData, API_URL } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode]   = useState(false);
  const [selectedId, setSelectedId]   = useState(null);

  const blank = {
    name: '', type: 'School', logo: '', school_email: '', phone: '',
    usage_plan: 'Full Time', plan_start_date: todayISO(),
    superAdminName: '', superAdminEmail: '', superAdminPassword: ''
  };
  const [formData, setFormData] = useState(blank);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, logo: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const openEditModal = (inst) => {
    const admin = usersList.find(u => u.institutionId === inst.id && u.role === 'Super Admin');
    setIsEditMode(true);
    setSelectedId(inst.id);
    setFormData({
      name: inst.name,
      type: inst.type,
      logo: inst.logo || '',
      school_email: inst.school_email || '',
      phone: inst.phone || '',
      usage_plan: inst.usage_plan || 'Full Time',
      plan_start_date: inst.plan_start_date
        ? new Date(inst.plan_start_date).toISOString().slice(0, 10)
        : todayISO(),
      superAdminName: admin?.name || '',
      superAdminEmail: admin?.email || '',
      superAdminPassword: admin?.password || ''
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setFormData(blank);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = isEditMode
      ? `${API_URL}/api/developer/institution/${selectedId}`
      : `${API_URL}/api/developer/onboard`;
    const res = await fetch(url, {
      method: isEditMode ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        schoolKey: isEditMode ? undefined : `SK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      })
    });
    if (res.ok) {
      refreshData();
      setIsModalOpen(false);
    } else {
      alert('Failed to save institution.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <header className="bg-white/80 backdrop-blur-md border-b px-8 py-4 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <img src={smartedzLogo} alt="SmartEdz" className="h-12 w-auto drop-shadow-sm" />
          <div className="h-8 w-[1px] bg-slate-200"></div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">DEV<span className="text-blue-600">CONSOLE</span></h1>
        </div>
        <button onClick={logout} className="rounded-full hover:bg-red-50 hover:text-red-600 px-4 py-2 flex items-center transition-all text-slate-500">
          <LogOut size={18} className="mr-2" /> Sign Out
        </button>
      </header>

      <main className="p-8 max-w-[1400px] mx-auto w-full">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Institutions</h2>
            <p className="text-slate-500 font-medium">Control and monitor your system tenants.</p>
          </div>
          <button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200 px-8 py-4 rounded-2xl transition-all hover:scale-105 active:scale-95 font-bold flex items-center">
            <Plus className="w-5 h-5 mr-2" /> Onboard School
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {institutions.map(inst => {
            const badge = planBadgeStyle(inst);
            const BadgeIcon = badge.icon;
            const isFullTime = inst.usage_plan === 'Full Time' || inst.daysLeft === null;
            return (
              <div key={inst.id} className="group border-none shadow-sm hover:shadow-2xl transition-all duration-500 rounded-[2rem] overflow-hidden bg-white ring-1 ring-slate-100 flex flex-col">
                <div className="flex flex-row justify-between items-center bg-slate-50/50 p-6 border-none">
                  <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md shadow-blue-100 uppercase">{inst.type}</span>
                  <div className="flex gap-2">
                    <button onClick={() => openEditModal(inst)} className="p-3 bg-white hover:bg-blue-600 hover:text-white text-slate-400 rounded-2xl shadow-sm transition-all duration-300">
                      <Edit3 size={18} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this institution?'))
                          fetch(`${API_URL}/api/developer/institution/${inst.id}`, { method: 'DELETE' }).then(refreshData);
                      }}
                      className="p-3 bg-white hover:bg-red-600 hover:text-white text-slate-400 rounded-2xl shadow-sm transition-all duration-300">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="p-10 flex flex-col items-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-blue-400 blur-2xl opacity-10 rounded-full"></div>
                    {inst.logo ? (
                      <img src={inst.logo} className="w-28 h-28 object-contain rounded-3xl p-4 bg-white shadow-inner relative z-10 border border-slate-50" alt="logo" />
                    ) : (
                      <div className="w-28 h-28 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 relative z-10"><Building2 size={40} /></div>
                    )}
                  </div>
                  <h3 className="font-black text-2xl text-slate-800 tracking-tight">{inst.name}</h3>
                  <div className="flex items-center gap-2 mt-3 bg-slate-100 px-4 py-1.5 rounded-full">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Key: {inst.schoolKey}</span>
                  </div>

                  {/* ---- Plan badge ---- */}
                  <div className={`mt-6 w-full rounded-2xl px-4 py-3 flex items-center gap-3 ${badge.wrap}`}>
                    <BadgeIcon size={20} className="shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] opacity-70">
                        {inst.usage_plan || 'Full Time'} Plan
                      </span>
                      <span className="text-sm font-black leading-tight truncate">{badge.headline}</span>
                      {!isFullTime && (
                        <span className="text-[11px] font-bold mt-0.5 opacity-80 tabular-nums">
                          {fmtDMY(inst.plan_start_date)} → {fmtDMY(inst.planEndDate)}
                        </span>
                      )}
                      {isFullTime && (
                        <span className="text-[11px] font-bold mt-0.5 opacity-80">
                          Since {fmtDMY(inst.plan_start_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {institutions.length === 0 && (
            <div className="col-span-full bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
              <Building2 className="mx-auto text-slate-300 mb-3" size={42} />
              <p className="text-slate-400 font-bold">No institutions onboarded yet.</p>
            </div>
          )}
        </div>
      </main>

      {/* ============================== MODAL ============================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-lg text-slate-800">{isEditMode ? 'Update Institution Profile' : 'Onboard New Client'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              {/* Logo */}
              <div className="flex justify-center">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                  <div className="relative w-32 h-32 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500 transition-all shadow-inner">
                    {formData.logo ? (
                      <img src={formData.logo} className="w-full h-full object-contain p-4" alt="Preview" />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="mx-auto text-slate-300 mb-1" size={32} />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Institution Logo</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                </div>
              </div>

              {/* General */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Globe size={14} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">General Information</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 ml-1">Official Name</label>
                    <input required placeholder="Lincoln High" value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 ml-1">Category</label>
                    <select value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50 cursor-pointer appearance-none">
                      <option value="School">School</option>
                      <option value="College">College</option>
                      <option value="University">University</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 ml-1">School Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 text-slate-400" size={14} />
                      <input required type="email" placeholder="info@school.com"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50 pl-10"
                        value={formData.school_email}
                        onChange={e => setFormData({ ...formData, school_email: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 ml-1">Contact Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3.5 text-slate-400" size={14} />
                      <input required placeholder="+91 000-000-0000"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50 pl-10"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ============== Subscription block ============== */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Calendar size={14} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Subscription Plan</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 ml-1">Plan</label>
                    <select
                      value={formData.usage_plan}
                      onChange={e => setFormData({ ...formData, usage_plan: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50 cursor-pointer">
                      {PLAN_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 ml-1">Start Date</label>
                    <input
                      type="date"
                      value={formData.plan_start_date}
                      onChange={e => setFormData({ ...formData, plan_start_date: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50" />
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 font-medium ml-1">
                  Tip: "Full Time" never expires. Other plans count from the start date you pick.
                </p>
              </div>

              {/* Super admin */}
              <div className="bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03]"><Shield size={80} /></div>
                <div className="flex items-center gap-2 text-blue-600 mb-4">
                  <Shield size={14} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Master Admin Access</span>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <User className="absolute left-4 top-4 text-slate-400" size={16} />
                    <input required placeholder="Full Name"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white pl-12"
                      value={formData.superAdminName}
                      onChange={e => setFormData({ ...formData, superAdminName: e.target.value })} />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-4 top-4 text-slate-400" size={16} />
                    <input type="email" required placeholder="Admin Login Email"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white pl-12"
                      value={formData.superAdminEmail}
                      onChange={e => setFormData({ ...formData, superAdminEmail: e.target.value })} />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-4 text-slate-400" size={16} />
                    <input required placeholder="Login Password"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white pl-12"
                      value={formData.superAdminPassword}
                      onChange={e => setFormData({ ...formData, superAdminPassword: e.target.value })} />
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full py-6 text-lg font-black rounded-3xl bg-slate-900 text-white hover:bg-blue-600 shadow-2xl shadow-blue-100 transition-all duration-500 uppercase tracking-widest">
                {isEditMode ? 'Save All Changes' : 'Deploy System'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}