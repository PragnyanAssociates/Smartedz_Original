import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardHeader from './DashboardHeader';
import {
  Building2, Plus, LogOut, Trash2, Edit3, Image as ImageIcon, Shield,
  Mail, Lock, User, Globe, Phone, Calendar, AlertTriangle, CheckCircle2,
  Infinity as InfinityIcon, ChevronDown, X, Loader2,
  Users, Search, School, GraduationCap, BookOpen, Network, ArrowLeft, KeyRound, Eye, EyeOff
} from 'lucide-react';

// A group owner can only ever create School / College / Tuition branches.
const BRANCH_TYPES = ['School', 'College', 'Tuition'];

const STAT_STYLES = {
  total:   { label: 'Total Branches', icon: Network,       box: 'bg-violet-50 ring-violet-600/20',  chip: 'bg-violet-100 text-violet-700' },
  School:  { label: 'Schools',        icon: School,        box: 'bg-emerald-50 ring-emerald-600/20', chip: 'bg-emerald-100 text-emerald-700' },
  College: { label: 'Colleges',       icon: GraduationCap, box: 'bg-amber-50 ring-amber-600/20',     chip: 'bg-amber-100 text-amber-700' },
  Tuition: { label: 'Tuitions',       icon: BookOpen,      box: 'bg-sky-50 ring-sky-600/20',         chip: 'bg-sky-100 text-sky-700' },
  users:   { label: 'Total Users',    icon: Users,         box: 'bg-primary/5 ring-primary/20',      chip: 'bg-primary/10 text-primary' }
};

const planLabel = (p) => (p === 'Full Time' ? 'Life Time' : p);

const fmtDMY = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '\u2014');

const planBadgeStyle = (g) => {
  if (!g) return { wrap: 'bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-black/5', icon: InfinityIcon, headline: '—' };
  if (g.usage_plan === 'Full Time' || g.daysLeft === null) {
    return { wrap: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20', icon: InfinityIcon, headline: 'Life Time' };
  }
  if (g.expired) {
    return { wrap: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20', icon: AlertTriangle, headline: 'Plan Expired' };
  }
  if (g.daysLeft <= 7) {
    return { wrap: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20', icon: AlertTriangle, headline: `Only ${g.daysLeft} day${g.daysLeft === 1 ? '' : 's'} left` };
  }
  if (g.daysLeft <= 30) {
    return { wrap: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20', icon: Calendar, headline: `${g.daysLeft} days left` };
  }
  return { wrap: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20', icon: CheckCircle2, headline: `${g.daysLeft} days left` };
};

export default function GroupDashboard() {
  const { user, logout, API_URL } = useAuth();
  const groupId = user?.institutionId;

  const [group, setGroup]       = useState(null);
  const [branches, setBranches] = useState([]);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode]   = useState(false);
  const [selectedId, setSelectedId]   = useState(null);
  const [isSaving, setIsSaving]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [search, setSearch]                 = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // 'list' = branch grid, 'detail' = one branch's full details
  const [view, setView] = useState({ mode: 'list' });

  const blank = {
    name: '', type: 'School', logo: '', school_email: '', phone: '',
    superAdminName: '', superAdminEmail: '', superAdminPassword: ''
  };
  const [formData, setFormData] = useState(blank);

  const loadData = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await fetch(`${API_URL}/api/group/data/${groupId}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setLoadError(d.error || 'Could not load this group.');
        return;
      }
      const data = await res.json();
      setGroup(data.group || null);
      setBranches(data.branches || []);
      setUsers(data.users || []);
      setLoadError('');
    } catch (err) {
      setLoadError('Network error while loading the group.');
    } finally {
      setLoading(false);
    }
  }, [API_URL, groupId]);

  useEffect(() => { loadData(); }, [loadData]);

  const userCountByBranch = useMemo(() => {
    const map = {};
    (users || []).forEach(u => {
      if (String(u.status || '').toLowerCase() === 'alumni') return;
      map[u.institutionId] = (map[u.institutionId] || 0) + 1;
    });
    return map;
  }, [users]);

  const totalUsers = useMemo(
    () => (users || []).filter(u => String(u.status || '').toLowerCase() !== 'alumni').length,
    [users]
  );

  const counts = useMemo(() => {
    const c = { total: branches.length, School: 0, College: 0, Tuition: 0 };
    branches.forEach(b => { if (Object.prototype.hasOwnProperty.call(c, b.type)) c[b.type] += 1; });
    return c;
  }, [branches]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return branches.filter(b => {
      if (q && !String(b.name || '').toLowerCase().includes(q)) return false;
      if (categoryFilter !== 'all' && b.type !== categoryFilter) return false;
      return true;
    });
  }, [branches, search, categoryFilter]);

  const filtersDirty = search.trim() !== '' || categoryFilter !== 'all';
  const clearFilters = () => { setSearch(''); setCategoryFilter('all'); };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, logo: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setFormData(blank);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (b) => {
    const admin = users.find(u => u.institutionId === b.id && u.role === 'Super Admin');
    setIsEditMode(true);
    setSelectedId(b.id);
    setFormData({
      name: b.name,
      type: BRANCH_TYPES.includes(b.type) ? b.type : 'School',
      logo: b.logo || '',
      school_email: b.school_email || '',
      phone: b.phone || '',
      superAdminName: admin?.name || '',
      superAdminEmail: admin?.email || '',
      superAdminPassword: admin?.password || ''
    });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const url = isEditMode
      ? `${API_URL}/api/group/${groupId}/branch/${selectedId}`
      : `${API_URL}/api/group/${groupId}/branch`;
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
        await loadData();
        setIsModalOpen(false);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to save branch.');
      }
    } catch (err) {
      alert('Network error while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (b) => {
    if (!window.confirm(`Delete the "${b.name}" branch and its data? This cannot be undone.`)) return;
    fetch(`${API_URL}/api/group/${groupId}/branch/${b.id}`, { method: 'DELETE' })
      .then(async r => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Delete failed.'); }
        loadData();
      });
  };

  const badge = planBadgeStyle(group);
  const BadgeIcon = badge.icon;

  // Detail view for a single branch (opened by clicking a card).
  const renderDetail = () => {
    const b = branches.find(x => x.id === view.id);
    if (!b) return null;
    const admin = users.find(u => u.institutionId === b.id && u.role === 'Super Admin');
    const userCount = userCountByBranch[b.id] || 0;
    const bBadge = planBadgeStyle(b);
    const BBadgeIcon = bBadge.icon;
    return (
      <div className="max-w-3xl mx-auto w-full">
        <button onClick={() => setView({ mode: 'list' })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-primary mb-4 transition-colors">
          <ArrowLeft className="size-3.5" /> Back to branches
        </button>

        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-center sm:items-start border-b border-zinc-100">
            <div className="size-24 bg-zinc-50 ring-1 ring-inset ring-black/5 rounded-lg flex items-center justify-center overflow-hidden shadow-sm shrink-0">
              {b.logo ? <img src={b.logo} className="w-full h-full object-contain p-2" alt="logo" /> : <Building2 className="size-10 text-zinc-300" />}
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1.5 flex-wrap">
                <span className="bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-black/5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">{b.type}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700"><Network className="size-3" /> Part of {group?.name}</span>
              </div>
              <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">{b.name}</h2>
              <div className="mt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded"><KeyRound className="size-3" /> {b.schoolKey}</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded"><Users className="size-3" /> {userCount} {userCount === 1 ? 'user' : 'users'}</span>
              </div>
            </div>
            <button onClick={() => openEditModal(b)} className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors shrink-0">
              <Edit3 className="size-3.5" /> Edit
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-zinc-100">
            <div className="bg-white p-5">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Contact</p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 text-sm text-zinc-700"><Mail className="size-4 text-primary shrink-0" /> <span className="truncate">{b.school_email || '\u2014'}</span></div>
                <div className="flex items-center gap-2.5 text-sm text-zinc-700"><Phone className="size-4 text-primary shrink-0" /> <span className="tabular-nums">{b.phone || '\u2014'}</span></div>
              </div>
            </div>
            <div className="bg-white p-5">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Branch Admin</p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 text-sm text-zinc-700"><User className="size-4 text-primary shrink-0" /> <span className="truncate">{admin?.name || '\u2014'}</span></div>
                <div className="flex items-center gap-2.5 text-sm text-zinc-700"><Mail className="size-4 text-primary shrink-0" /> <span className="truncate">{admin?.email || '\u2014'}</span></div>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-zinc-100">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Subscription</p>
            <div className={`rounded-md px-4 py-3 flex items-center gap-3 ${bBadge.wrap}`}>
              <BBadgeIcon className="size-5 shrink-0" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{planLabel(b.usage_plan || 'Full Time')} Plan &middot; inherited from {group?.name}</span>
                <span className="text-sm font-semibold">{bBadge.headline}</span>
                <span className="text-[10px] font-medium opacity-80 mt-0.5 tabular-nums">Since {fmtDMY(b.plan_start_date)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-50 overflow-hidden w-full font-sans">
      {/* Same header as the school dashboard (shows the group's name / logo / contact) */}
      <DashboardHeader onMenuClick={() => {}} />

      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">

          {loadError && (
            <div className="bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 rounded-md px-4 py-3 text-sm font-medium mb-6">
              {loadError}
            </div>
          )}

          {view.mode === 'detail' ? renderDetail() : (
          <>
          {/* UPDATED STRUCTURE: Toolbar (Transparent background) */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            
            {/* Information Group (Left) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full md:w-auto">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">Branches</h2>
                <p className="text-sm text-zinc-500 mt-0.5">Manage every branch under your group.</p>
              </div>
              {/* Divider visible on medium screens and up */}
              <div className="hidden sm:block h-8 w-px bg-zinc-200"></div>
              {/* Plan Badge aligned with title */}
              <div className={`rounded-md px-3 py-1.5 flex items-center gap-2.5 shadow-sm border border-transparent ${badge.wrap}`}>
                <BadgeIcon className="size-4 shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[9px] font-semibold uppercase tracking-wider opacity-80">{planLabel(group?.usage_plan || 'Full Time')} Plan</span>
                  <span className="text-xs font-semibold">{badge.headline}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons Group (Right) */}
            <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto pt-4 md:pt-0 border-t border-zinc-200 md:border-none">
              <button onClick={openAddModal} className="h-9 px-4 bg-primary hover:bg-primary/90 text-white shadow-sm rounded-md text-xs font-semibold flex items-center transition-colors justify-center flex-1 md:flex-none">
                <Plus className="size-3.5 mr-1.5" /> Add Branch
              </button>
              <button onClick={() => { if (window.confirm('Are you sure you want to sign out?')) logout(); }} className="h-9 px-4 rounded-md bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 hover:text-zinc-900 flex items-center transition-colors text-xs font-semibold shadow-sm justify-center flex-1 md:flex-none">
                <LogOut className="size-3.5 mr-2" /> Sign Out
              </button>
            </div>

          </div>

          {/* Overview tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-5">
            {['total', 'School', 'College', 'Tuition', 'users'].map(key => {
              const s = STAT_STYLES[key];
              const Icon = s.icon;
              const value = key === 'total' ? counts.total : key === 'users' ? totalUsers : counts[key];
              return (
                <div key={key} className={`rounded-lg ring-1 p-3 sm:p-4 flex items-center gap-3 bg-white shadow-sm ring-black/5`}>
                  <div className={`size-9 sm:size-10 rounded-md flex items-center justify-center shrink-0 ${s.chip}`}>
                    <Icon className="size-4 sm:size-5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-lg sm:text-2xl font-semibold text-zinc-900 leading-none tabular-nums">{value}</span>
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider truncate mt-1">{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-6">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                placeholder="Search branches..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm"
              />
            </div>
            <div className="relative w-full sm:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                title="Filter by category"
                className="h-9 w-full sm:w-44 rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm transition-colors cursor-pointer">
                <option value="all">All Categories</option>
                {BRANCH_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {filtersDirty && (
              <button onClick={clearFilters}
                className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors shrink-0 shadow-sm">
                Clear
              </button>
            )}
          </div>

          {/* Branch grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map((b, idx) => {
              const userCount = userCountByBranch[b.id] || 0;
              return (
                <div key={b.id} onClick={() => setView({ mode: 'detail', id: b.id })}
                  className="group bg-white rounded-lg ring-1 ring-black/5 shadow-sm hover:ring-primary/30 hover:shadow-md transition-all overflow-hidden flex flex-col cursor-pointer">
                  <div className="flex flex-row justify-between items-center bg-zinc-50/50 p-4 border-b border-zinc-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-semibold text-zinc-400 tabular-nums shrink-0">#{idx + 1}</span>
                      <span className="bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-black/5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider truncate">
                        {b.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span title="Total users" className="inline-flex items-center gap-1 bg-white text-zinc-600 ring-1 ring-inset ring-black/5 px-2 py-0.5 rounded text-[10px] font-semibold tabular-nums shadow-sm">
                        <Users className="size-3" /> {userCount}
                      </span>
                      <div className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); openEditModal(b); }} title="Edit"
                          className="size-7 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-primary rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                          <Edit3 className="size-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(b); }} title="Delete"
                          className="size-7 bg-white hover:bg-red-50 text-zinc-500 hover:text-red-600 rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 flex flex-col items-center flex-1">
                    <div className="size-20 bg-zinc-50 ring-1 ring-inset ring-black/5 rounded-md flex items-center justify-center mb-4 overflow-hidden shadow-sm">
                      {b.logo ? (
                        <img src={b.logo} className="w-full h-full object-contain p-2" alt="logo" />
                      ) : (
                        <Building2 className="size-8 text-zinc-300" />
                      )}
                    </div>

                    <h3 className="font-semibold text-lg text-zinc-900 tracking-tight text-center line-clamp-1 w-full">{b.name}</h3>
                    <div className="mt-1.5">
                      <span className="text-[10px] font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                        Key: <span className="font-semibold">{b.schoolKey}</span>
                      </span>
                    </div>

                    {(b.school_email || b.phone) && (
                      <div className="mt-auto pt-6 w-full space-y-1.5">
                        {b.school_email && (
                          <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-medium">
                            <Mail className="size-3.5 text-primary shrink-0" />
                            <span className="truncate">{b.school_email}</span>
                          </div>
                        )}
                        {b.phone && (
                          <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-medium">
                            <Phone className="size-3.5 text-primary shrink-0" />
                            <span className="tabular-nums">{b.phone}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {!loading && branches.length === 0 && (
              <div className="col-span-full bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center">
                <Network className="size-10 text-zinc-300 mb-3" />
                <p className="text-zinc-500 font-medium text-sm">No branches yet. Add your first branch to get started.</p>
                <button onClick={openAddModal} className="mt-3 h-8 px-3 rounded-md bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors">
                  Add Branch
                </button>
              </div>
            )}

            {!loading && branches.length > 0 && filtered.length === 0 && (
              <div className="col-span-full bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center">
                <Search className="size-10 text-zinc-300 mb-3" />
                <p className="text-zinc-500 font-medium text-sm">No branches match your filters.</p>
                <button onClick={clearFilters} className="mt-3 h-8 px-3 rounded-md border border-zinc-200 bg-white text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors shadow-sm">
                  Clear filters
                </button>
              </div>
            )}

            {loading && (
              <div className="col-span-full flex items-center justify-center py-16 text-zinc-400">
                <Loader2 className="size-5 animate-spin mr-2" /> Loading branches...
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </main>

      {/* Add / Edit branch modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-2xl shadow-xl relative flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">

            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="font-semibold text-lg text-zinc-900 tracking-tight">
                {isEditMode ? 'Update Branch' : 'Add New Branch'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">

                <div className="flex justify-center">
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

                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 text-zinc-500 mb-3 border-b border-zinc-100 pb-2">
                    <Globe className="size-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Branch Information</span>
                  </div>

                  {/* Institute name is fixed — the branch always belongs to this group. */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Institute</label>
                    <input value={group?.name || ''} disabled readOnly
                      className="h-9 w-full bg-zinc-100 border border-zinc-200 rounded-md px-3 text-sm text-zinc-600 font-medium cursor-not-allowed outline-none" />
                    <p className="text-[10px] text-zinc-400 font-medium">Every branch belongs to this institute. You only name the branch below.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Branch Name <span className="text-red-500">*</span></label>
                      <input required placeholder="Hyderabad" value={formData.name}
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
                          {BRANCH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Branch Email <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                        <input required type="email" placeholder="hyderabad@school.com"
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

                  <p className="text-[11px] text-violet-700 font-medium">
                    This branch runs on your group plan ({planLabel(group?.usage_plan || 'Full Time')}) — no separate subscription needed.
                  </p>
                </div>

                <div className="bg-zinc-50 p-5 rounded-md ring-1 ring-inset ring-black/5 space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Shield className="size-24" /></div>
                  <div className="flex items-center gap-1.5 text-primary mb-2">
                    <Shield className="size-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Branch Admin Access</span>
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
                        <input required type={showPassword ? 'text' : 'password'} placeholder="Login Password"
                          disabled={isSaving}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                          value={formData.superAdminPassword}
                          onChange={e => setFormData({ ...formData, superAdminPassword: e.target.value })} />
                        <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                          title={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors p-0.5">
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
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
                  {isSaving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Add Branch')}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}