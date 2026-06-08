import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Building2, Plus, LogOut, Trash2, Edit3, Image as ImageIcon, Shield,
  Mail, Lock, User, Globe, Phone, Calendar, AlertTriangle, CheckCircle2, Infinity as InfinityIcon, ChevronDown, X, Loader2
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
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

// Pick chip styling based on plan status returned by the backend
const planBadgeStyle = (inst) => {
  if (inst.usage_plan === 'Full Time' || inst.daysLeft === null) {
    return {
      wrap: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
      icon: InfinityIcon,
      headline: 'Full Time',
      sub: 'No expiry'
    };
  }
  if (inst.expired) {
    return {
      wrap: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
      icon: AlertTriangle,
      headline: 'Plan Expired',
      sub: 'Renew to restore access'
    };
  }
  if (inst.daysLeft <= 7) {
    return {
      wrap: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
      icon: AlertTriangle,
      headline: `Only ${inst.daysLeft} day${inst.daysLeft === 1 ? '' : 's'} left`,
      sub: 'Plan ending soon'
    };
  }
  if (inst.daysLeft <= 30) {
    return {
      wrap: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
      icon: Calendar,
      headline: `${inst.daysLeft} days left`,
      sub: 'Active'
    };
  }
  return {
    wrap: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20',
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
  const [isSaving, setIsSaving]       = useState(false);

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
    setIsSaving(true);
    const url = isEditMode
      ? `${API_URL}/api/developer/institution/${selectedId}`
      : `${API_URL}/api/developer/onboard`;
      
    try {
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
    } catch (error) {
      alert('Network error while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans">
      <header className="bg-white border-b border-zinc-200 px-6 py-3 flex justify-between items-center sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-4">
          <img src={smartedzLogo} alt="SmartEdz" className="h-8 w-auto" />
          <div className="h-6 w-[1px] bg-zinc-200"></div>
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-primary">SMART</span>
            <span className="text-accent">EDZ </span>
            <span className="text-zinc-900">  BOARD</span>
          </h1>
        </div>
        <button onClick={logout} className="h-9 px-4 rounded-md hover:bg-zinc-50 border border-zinc-200 text-zinc-600 hover:text-zinc-900 flex items-center transition-colors text-xs font-semibold shadow-sm">
          <LogOut className="size-3.5 mr-2" /> Sign Out
        </button>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">List of Clients</h2>
            <p className="text-sm text-zinc-500 mt-1">Control and monitor your system tenants.</p>
          </div>
          <button onClick={openAddModal} className="h-9 px-4 bg-primary hover:bg-primary/90 text-white shadow-sm rounded-md text-xs font-semibold flex items-center transition-colors w-full sm:w-auto justify-center shrink-0">
            <Plus className="size-3.5 mr-1.5" /> Onboard School
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {institutions.map(inst => {
            const badge = planBadgeStyle(inst);
            const BadgeIcon = badge.icon;
            const isFullTime = inst.usage_plan === 'Full Time' || inst.daysLeft === null;
            return (
              <div key={inst.id} className="group bg-white rounded-lg ring-1 ring-black/5 shadow-sm hover:ring-black/10 transition-shadow overflow-hidden flex flex-col">
                <div className="flex flex-row justify-between items-center bg-zinc-50/50 p-4 border-b border-zinc-100">
                  <span className="bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-black/5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">
                    {inst.type}
                  </span>
                  <div className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditModal(inst)} title="Edit"
                      className="size-7 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-primary rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                      <Edit3 className="size-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this institution?'))
                          fetch(`${API_URL}/api/developer/institution/${inst.id}`, { method: 'DELETE' }).then(refreshData);
                      }}
                      title="Delete"
                      className="size-7 bg-white hover:bg-red-50 text-zinc-500 hover:text-red-600 rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                
                <div className="p-6 flex flex-col items-center flex-1">
                  <div className="size-20 bg-zinc-50 ring-1 ring-inset ring-black/5 rounded-md flex items-center justify-center mb-4 overflow-hidden shadow-sm">
                    {inst.logo ? (
                      <img src={inst.logo} className="w-full h-full object-contain p-2" alt="logo" />
                    ) : (
                      <Building2 className="size-8 text-zinc-300" />
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-lg text-zinc-900 tracking-tight text-center line-clamp-1 w-full">{inst.name}</h3>
                  <div className="mt-1.5">
                    <span className="text-[10px] font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                      Key: <span className="font-semibold">{inst.schoolKey}</span>
                    </span>
                  </div>

                  <div className="mt-auto pt-6 w-full">
                    <div className={`w-full rounded-md px-3 py-2.5 flex items-center gap-3 ${badge.wrap}`}>
                      <BadgeIcon className="size-5 shrink-0" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80 mb-0.5">
                          {inst.usage_plan || 'Full Time'} Plan
                        </span>
                        <span className="text-sm font-semibold leading-tight truncate">{badge.headline}</span>
                        {!isFullTime && (
                          <span className="text-[10px] font-medium mt-0.5 opacity-80 tabular-nums">
                            {fmtDMY(inst.plan_start_date)} - {fmtDMY(inst.planEndDate)}
                          </span>
                        )}
                        {isFullTime && (
                          <span className="text-[10px] font-medium mt-0.5 opacity-80">
                            Since {fmtDMY(inst.plan_start_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {institutions.length === 0 && (
            <div className="col-span-full bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center">
              <Building2 className="size-10 text-zinc-300 mb-3" />
              <p className="text-zinc-500 font-medium text-sm">No institutions onboarded yet.</p>
            </div>
          )}
        </div>
      </main>

      {/* ============================== MODAL ============================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-2xl shadow-xl relative flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="font-semibold text-lg text-zinc-900 tracking-tight">
                {isEditMode ? 'Update Institution Profile' : 'Onboard New Client'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                
                {/* Logo */}
                <div className="flex justify-center">
                  <div className="relative group">
                    <div className="relative size-24 bg-zinc-50 rounded-md border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors shadow-sm">
                      {formData.logo ? (
                        <img src={formData.logo} className="w-full h-full object-contain p-2" alt="Preview" />
                      ) : (
                        <div className="text-center flex flex-col items-center">
                          <ImageIcon className="text-zinc-400 mb-1 size-6" />
                          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Logo</p>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isSaving} />
                    </div>
                  </div>
                </div>

                {/* General */}
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 text-zinc-500 mb-3 border-b border-zinc-100 pb-2">
                    <Globe className="size-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">General Information</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Official Name <span className="text-red-500">*</span></label>
                      <input required placeholder="Lincoln High" value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        disabled={isSaving}
                        className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Category</label>
                      <div className="relative">
                        <select value={formData.type}
                          onChange={e => setFormData({ ...formData, type: e.target.value })}
                          disabled={isSaving}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm transition-colors cursor-pointer">
                          <option value="School">School</option>
                          <option value="College">College</option>
                          <option value="University">University</option>
                        </select>
                        <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">School Email <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                        <input required type="email" placeholder="info@school.com"
                          disabled={isSaving}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                          value={formData.school_email}
                          onChange={e => setFormData({ ...formData, school_email: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Contact Phone <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                        <input required placeholder="+91 000-000-0000"
                          disabled={isSaving}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscription block */}
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 text-zinc-500 mb-3 border-b border-zinc-100 pb-2 mt-6">
                    <Calendar className="size-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Subscription Plan</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Plan</label>
                      <div className="relative">
                        <select
                          value={formData.usage_plan}
                          disabled={isSaving}
                          onChange={e => setFormData({ ...formData, usage_plan: e.target.value })}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm transition-colors cursor-pointer">
                          {PLAN_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Start Date</label>
                      <input
                        type="date"
                        disabled={isSaving}
                        value={formData.plan_start_date}
                        onChange={e => setFormData({ ...formData, plan_start_date: e.target.value })}
                        className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    Tip: "Full Time" never expires. Other plans count from the start date you pick.
                  </p>
                </div>

                {/* Super admin */}
                <div className="bg-zinc-50 p-5 rounded-md ring-1 ring-inset ring-black/5 space-y-4 relative overflow-hidden mt-6">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Shield className="size-24" /></div>
                  
                  <div className="flex items-center gap-1.5 text-primary mb-2">
                    <Shield className="size-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Master Admin Access</span>
                  </div>

                  <div className="space-y-4 relative z-10">
                    <div className="relative">
                      <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                      <input required placeholder="Full Name"
                        disabled={isSaving}
                        className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                        value={formData.superAdminName}
                        onChange={e => setFormData({ ...formData, superAdminName: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                        <input type="email" required placeholder="Login Email"
                          disabled={isSaving}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                          value={formData.superAdminEmail}
                          onChange={e => setFormData({ ...formData, superAdminEmail: e.target.value })} />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                        <input required placeholder="Login Password"
                          disabled={isSaving}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                          value={formData.superAdminPassword}
                          onChange={e => setFormData({ ...formData, superAdminPassword: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving}
                  className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}
                  className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">
                  {isSaving && <Loader2 className="size-3.5 animate-spin shrink-0" />}
                  {isSaving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Deploy System')}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}