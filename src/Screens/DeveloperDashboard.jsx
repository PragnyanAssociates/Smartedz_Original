import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Building2, Plus, LogOut, Trash2, Edit3, Image as ImageIcon, Shield,
  Mail, Lock, User, Globe, Phone, Calendar, AlertTriangle, CheckCircle2,
  Infinity as InfinityIcon, ChevronDown, X, Loader2, ArrowLeft, KeyRound,
  Users, Search, School, GraduationCap, BookOpen, Network, CornerDownRight
} from 'lucide-react';
import smartedzLogo from '../assets/smartedzlogo.png';

const PLAN_OPTIONS = ['7 days', '30 days', '90 days', '180 days', '1 year', '3 years', 'Full Time'];
const CATEGORIES = ['School', 'College', 'Tuition', 'Group'];
const BRANCH_TYPES = ['School', 'College', 'Tuition'];

const STAT_STYLES = {
  total:   { label: 'Total Institutions', icon: Building2,     box: 'bg-primary/5 ring-primary/20',      chip: 'bg-primary/10 text-primary' },
  School:  { label: 'Schools',            icon: School,        box: 'bg-emerald-50 ring-emerald-600/20', chip: 'bg-emerald-100 text-emerald-700' },
  College: { label: 'Colleges',           icon: GraduationCap, box: 'bg-amber-50 ring-amber-600/20',     chip: 'bg-amber-100 text-amber-700' },
  Tuition: { label: 'Tuitions',           icon: BookOpen,      box: 'bg-sky-50 ring-sky-600/20',         chip: 'bg-sky-100 text-sky-700' },
  Group:   { label: 'Groups',             icon: Network,       box: 'bg-violet-50 ring-violet-600/20',   chip: 'bg-violet-100 text-violet-700' }
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtDMY = (val) => {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

const planLabel = (p) => (p === 'Full Time' ? 'Life Time' : p);

const planBadgeStyle = (inst) => {
  if (inst.usage_plan === 'Full Time' || inst.daysLeft === null) {
    return { wrap: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20', icon: InfinityIcon, headline: 'Life Time' };
  }
  if (inst.expired) {
    return { wrap: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20', icon: AlertTriangle, headline: 'Plan Expired' };
  }
  if (inst.daysLeft <= 7) {
    return { wrap: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20', icon: AlertTriangle, headline: `Only ${inst.daysLeft} day${inst.daysLeft === 1 ? '' : 's'} left` };
  }
  if (inst.daysLeft <= 30) {
    return { wrap: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20', icon: Calendar, headline: `${inst.daysLeft} days left` };
  }
  return { wrap: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20', icon: CheckCircle2, headline: `${inst.daysLeft} days left` };
};

export default function DeveloperDashboard() {
  const { institutions, usersList, logout, refreshData, API_URL } = useAuth();

  // Navigation: 'list' (groups + standalone) -> 'group' (a group's branches) -> 'detail' (one school/branch)
  const [view, setView] = useState({ mode: 'list' });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode]   = useState(false);
  const [selectedId, setSelectedId]   = useState(null);
  const [isSaving, setIsSaving]       = useState(false);
  // When adding a branch from inside a group, this holds {id, name}; the
  // modal then locks the parent and hides plan/group options.
  const [branchParent, setBranchParent] = useState(null);

  const [search, setSearch]                 = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [planFilter, setPlanFilter]         = useState('all');

  const blank = {
    name: '', type: 'School', parent_id: '', logo: '', school_email: '', phone: '',
    usage_plan: 'Full Time', plan_start_date: todayISO(),
    superAdminName: '', superAdminEmail: '', superAdminPassword: ''
  };
  const [formData, setFormData] = useState(blank);

  // ---- Lookups ------------------------------------------------------
  const instById = useMemo(() => {
    const m = {};
    (institutions || []).forEach(i => { m[i.id] = i; });
    return m;
  }, [institutions]);

  const userCountByInst = useMemo(() => {
    const map = {};
    (usersList || []).forEach(u => {
      if (String(u.status || '').toLowerCase() === 'alumni') return;
      map[u.institutionId] = (map[u.institutionId] || 0) + 1;
    });
    return map;
  }, [usersList]);

  const groups = useMemo(() => (institutions || []).filter(i => i.type === 'Group'), [institutions]);
  const branchesOf = (gid) => (institutions || []).filter(i => i.parent_id === gid);
  const branchCountByGroup = useMemo(() => {
    const m = {};
    (institutions || []).forEach(i => { if (i.parent_id) m[i.parent_id] = (m[i.parent_id] || 0) + 1; });
    return m;
  }, [institutions]);

  // Top-level rows only (groups + standalone) — branches live inside groups.
  const topLevel = useMemo(() => (institutions || []).filter(i => !i.parent_id), [institutions]);

  const counts = useMemo(() => {
    const c = { total: (institutions || []).length, School: 0, College: 0, Tuition: 0, Group: 0 };
    (institutions || []).forEach(i => { if (Object.prototype.hasOwnProperty.call(c, i.type)) c[i.type] += 1; });
    return c;
  }, [institutions]);

  const filteredTop = useMemo(() => {
    const q = search.trim().toLowerCase();
    return topLevel.filter(i => {
      if (q && !String(i.name || '').toLowerCase().includes(q)) return false;
      if (categoryFilter !== 'all' && i.type !== categoryFilter) return false;
      if (planFilter !== 'all' && (i.usage_plan || 'Full Time') !== planFilter) return false;
      return true;
    });
  }, [topLevel, search, categoryFilter, planFilter]);

  const filtersDirty = search.trim() !== '' || categoryFilter !== 'all' || planFilter !== 'all';
  const clearFilters = () => { setSearch(''); setCategoryFilter('all'); setPlanFilter('all'); };

  // ---- Navigation helpers ------------------------------------------
  const drillInto = (inst) => {
    if (inst.type === 'Group') setView({ mode: 'group', id: inst.id });
    else setView({ mode: 'detail', id: inst.id });
  };

  const currentGroup = view.mode === 'group' ? instById[view.id] : null;
  const detailInst   = view.mode === 'detail' ? instById[view.id] : null;

  // ---- Modal openers -----------------------------------------------
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, logo: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleTypeChange = (val) => {
    setFormData(prev => ({ ...prev, type: val, parent_id: val === 'Group' ? '' : prev.parent_id }));
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setBranchParent(null);
    setFormData(blank);
    setIsModalOpen(true);
  };

  // Developer adds a branch from inside a group page.
  const openAddBranch = (group) => {
    setIsEditMode(false);
    setBranchParent({ id: group.id, name: group.name });
    setFormData({ ...blank, type: 'School', parent_id: group.id });
    setIsModalOpen(true);
  };

  const openEditModal = (inst) => {
    const admin = (usersList || []).find(
      u => u.institutionId === inst.id && (u.role === 'Super Admin' || u.role === 'Group Admin')
    );
    setIsEditMode(true);
    setBranchParent(null);
    setSelectedId(inst.id);
    setFormData({
      name: inst.name,
      type: inst.type,
      parent_id: inst.parent_id || '',
      logo: inst.logo || '',
      school_email: inst.school_email || '',
      phone: inst.phone || '',
      usage_plan: inst.usage_plan || 'Full Time',
      plan_start_date: inst.plan_start_date ? new Date(inst.plan_start_date).toISOString().slice(0, 10) : todayISO(),
      superAdminName: admin?.name || '',
      superAdminEmail: admin?.email || '',
      superAdminPassword: admin?.password || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setBranchParent(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const url = isEditMode
      ? `${API_URL}/api/developer/institution/${selectedId}`
      : `${API_URL}/api/developer/onboard`;
    const isGroup = formData.type === 'Group';
    try {
      const res = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          parent_id: isGroup ? null : (formData.parent_id || null),
          schoolKey: isEditMode ? undefined : `SK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        })
      });
      if (res.ok) { refreshData(); closeModal(); }
      else { const d = await res.json().catch(() => ({})); alert(d.error || 'Failed to save institution.'); }
    } catch (error) {
      alert('Network error while saving.');
    } finally { setIsSaving(false); }
  };

  const deleteInst = (inst, after) => {
    const msg = inst.type === 'Group'
      ? 'Delete this group? (You must move or delete its branches first.)'
      : 'Are you sure you want to delete this institution?';
    if (!window.confirm(msg)) return;
    fetch(`${API_URL}/api/developer/institution/${inst.id}`, { method: 'DELETE' })
      .then(async r => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Delete failed.'); }
        refreshData();
        if (after) after();
      });
  };

  // ---- Modal flags --------------------------------------------------
  const branchAddMode = !isEditMode && !!branchParent;
  const isGroupType = !branchAddMode && formData.type === 'Group';
  const isBranch = branchAddMode || (!isGroupType && !!formData.parent_id);

  // ===================================================================
  //  Reusable institution card (used in list + group views)
  // ===================================================================
  const InstitutionCard = ({ inst, idx }) => {
    const badge = planBadgeStyle(inst);
    const BadgeIcon = badge.icon;
    const isFullTime = inst.usage_plan === 'Full Time' || inst.daysLeft === null;
    const isGroupRow = inst.type === 'Group';
    const userCount = userCountByInst[inst.id] || 0;
    const branchCount = branchCountByGroup[inst.id] || 0;
    const parentName = inst.parent_id ? instById[inst.parent_id]?.name : null;
    return (
      <div
        onClick={() => drillInto(inst)}
        className="group bg-white rounded-lg ring-1 ring-black/5 shadow-sm hover:ring-primary/30 hover:shadow-md transition-all overflow-hidden flex flex-col cursor-pointer">
        <div className="flex flex-row justify-between items-center bg-zinc-50/50 p-4 border-b border-zinc-100">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-bold text-zinc-400 tabular-nums shrink-0">#{idx + 1}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider truncate ring-1 ring-inset
              ${isGroupRow ? 'bg-violet-100 text-violet-700 ring-violet-600/20' : 'bg-zinc-100 text-zinc-700 ring-black/5'}`}>
              {isGroupRow ? 'Group' : inst.type}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isGroupRow ? (
              <span title="Branches in this group" className="inline-flex items-center gap-1 bg-white text-violet-700 ring-1 ring-inset ring-violet-600/20 px-2 py-0.5 rounded text-[10px] font-semibold tabular-nums shadow-sm">
                <Network className="size-3" /> {branchCount} {branchCount === 1 ? 'branch' : 'branches'}
              </span>
            ) : (
              <span title="Total users" className="inline-flex items-center gap-1 bg-white text-zinc-600 ring-1 ring-inset ring-black/5 px-2 py-0.5 rounded text-[10px] font-semibold tabular-nums shadow-sm">
                <Users className="size-3" /> {userCount}
              </span>
            )}
            <div className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); openEditModal(inst); }} title="Edit"
                className="size-7 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-primary rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                <Edit3 className="size-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); deleteInst(inst); }} title="Delete"
                className="size-7 bg-white hover:bg-red-50 text-zinc-500 hover:text-red-600 rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col items-center flex-1">
          <div className="size-20 bg-zinc-50 ring-1 ring-inset ring-black/5 rounded-md flex items-center justify-center mb-4 overflow-hidden shadow-sm">
            {inst.logo ? (
              <img src={inst.logo} className="w-full h-full object-contain p-2" alt="logo" />
            ) : isGroupRow ? (
              <Network className="size-8 text-violet-300" />
            ) : (
              <Building2 className="size-8 text-zinc-300" />
            )}
          </div>

          <h3 className="font-semibold text-lg text-zinc-900 tracking-tight text-center line-clamp-1 w-full">{inst.name}</h3>

          {parentName && (
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-violet-700">
              <CornerDownRight className="size-3" /> Part of {parentName}
            </div>
          )}

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
                  {planLabel(inst.usage_plan || 'Full Time')} Plan{parentName ? ' · inherited' : ''}
                </span>
                <span className="text-sm font-semibold leading-tight truncate">{badge.headline}</span>
                {!isFullTime && (
                  <span className="text-[10px] font-medium mt-0.5 opacity-80 tabular-nums">
                    {fmtDMY(inst.plan_start_date)} - {fmtDMY(inst.planEndDate)}
                  </span>
                )}
                {isFullTime && (
                  <span className="text-[10px] font-medium mt-0.5 opacity-80">Since {fmtDMY(inst.plan_start_date)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 w-full flex items-center justify-center text-[11px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            {isGroupRow ? 'Open branches →' : 'View details →'}
          </div>
        </div>
      </div>
    );
  };

  // ===================================================================
  //  VIEW: detail (one school / branch)
  // ===================================================================
  const renderDetail = () => {
    const inst = detailInst;
    if (!inst) return null;
    const badge = planBadgeStyle(inst);
    const BadgeIcon = badge.icon;
    const admin = (usersList || []).find(u => u.institutionId === inst.id && u.role === 'Super Admin');
    const userCount = userCountByInst[inst.id] || 0;
    const parentName = inst.parent_id ? instById[inst.parent_id]?.name : null;
    const isFullTime = inst.usage_plan === 'Full Time' || inst.daysLeft === null;
    const back = () => setView(parentName ? { mode: 'group', id: inst.parent_id } : { mode: 'list' });
    return (
      <div className="max-w-3xl mx-auto w-full">
        <button onClick={back} className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-primary mb-4 transition-colors">
          <ArrowLeft className="size-3.5" /> Back
        </button>

        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-center sm:items-start border-b border-zinc-100">
            <div className="size-24 bg-zinc-50 ring-1 ring-inset ring-black/5 rounded-lg flex items-center justify-center overflow-hidden shadow-sm shrink-0">
              {inst.logo ? <img src={inst.logo} className="w-full h-full object-contain p-2" alt="logo" /> : <Building2 className="size-10 text-zinc-300" />}
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1.5">
                <span className="bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-black/5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">{inst.type}</span>
                {parentName && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-700">
                    <CornerDownRight className="size-3" /> {parentName}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">{inst.name}</h2>
              <div className="mt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded"><KeyRound className="size-3" /> {inst.schoolKey}</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded"><Users className="size-3" /> {userCount} users</span>
              </div>
            </div>
            <button onClick={() => openEditModal(inst)} className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors shrink-0">
              <Edit3 className="size-3.5" /> Edit
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-zinc-100">
            <div className="bg-white p-5">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Contact</p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 text-sm text-zinc-700"><Mail className="size-4 text-primary shrink-0" /> <span className="truncate">{inst.school_email || '—'}</span></div>
                <div className="flex items-center gap-2.5 text-sm text-zinc-700"><Phone className="size-4 text-primary shrink-0" /> <span className="tabular-nums">{inst.phone || '—'}</span></div>
              </div>
            </div>
            <div className="bg-white p-5">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">{parentName ? 'Branch Admin' : 'Master Admin'}</p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 text-sm text-zinc-700"><User className="size-4 text-primary shrink-0" /> <span className="truncate">{admin?.name || '—'}</span></div>
                <div className="flex items-center gap-2.5 text-sm text-zinc-700"><Mail className="size-4 text-primary shrink-0" /> <span className="truncate">{admin?.email || '—'}</span></div>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-zinc-100">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Subscription</p>
            <div className={`rounded-md px-4 py-3 flex items-center gap-3 ${badge.wrap}`}>
              <BadgeIcon className="size-5 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{planLabel(inst.usage_plan || 'Full Time')} Plan{parentName ? ' · inherited from group' : ''}</span>
                <span className="text-sm font-semibold">{badge.headline}</span>
                <span className="text-[10px] font-medium opacity-80 mt-0.5 tabular-nums">
                  {isFullTime ? `Since ${fmtDMY(inst.plan_start_date)}` : `${fmtDMY(inst.plan_start_date)} - ${fmtDMY(inst.planEndDate)}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===================================================================
  //  VIEW: group (a group's branches + Add Branch)
  // ===================================================================
  const renderGroup = () => {
    const g = currentGroup;
    if (!g) return null;
    const list = branchesOf(g.id);
    const gCounts = { total: list.length, School: 0, College: 0, Tuition: 0 };
    list.forEach(b => { if (Object.prototype.hasOwnProperty.call(gCounts, b.type)) gCounts[b.type] += 1; });
    const gUsers = list.reduce((sum, b) => sum + (userCountByInst[b.id] || 0), 0);
    const badge = planBadgeStyle(g);
    const BadgeIcon = badge.icon;
    return (
      <>
        <button onClick={() => setView({ mode: 'list' })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-primary mb-4 transition-colors">
          <ArrowLeft className="size-3.5" /> Back to clients
        </button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-12 bg-white ring-1 ring-inset ring-black/5 rounded-md flex items-center justify-center overflow-hidden shadow-sm shrink-0">
              {g.logo ? <img src={g.logo} className="w-full h-full object-contain p-1.5" alt="logo" /> : <Network className="size-6 text-violet-300" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-zinc-900 tracking-tight truncate">{g.name}</h2>
                <span className="bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-600/20 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">Group</span>
              </div>
              <p className="text-sm text-zinc-500 mt-0.5">Branches under this group.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className={`rounded-md px-3 py-2 flex items-center gap-2.5 ${badge.wrap}`}>
              <BadgeIcon className="size-4 shrink-0" />
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-semibold uppercase tracking-wider opacity-80">{planLabel(g.usage_plan || 'Full Time')} Plan</span>
                <span className="text-xs font-semibold">{badge.headline}</span>
              </div>
            </div>
            <button onClick={() => openAddBranch(g)} className="h-9 px-4 bg-primary hover:bg-primary/90 text-white shadow-sm rounded-md text-xs font-semibold flex items-center transition-colors justify-center shrink-0">
              <Plus className="size-3.5 mr-1.5" /> Add Branch
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[['total', 'Total Branches', Network], ['School', 'Schools', School], ['College', 'Colleges', GraduationCap], ['Tuition', 'Tuitions', BookOpen]].map(([key, label, Icon]) => (
            <div key={key} className="rounded-lg ring-1 ring-black/5 bg-white p-3 sm:p-4 flex items-center gap-3">
              <div className="size-9 sm:size-10 rounded-md bg-zinc-100 text-zinc-600 flex items-center justify-center shrink-0"><Icon className="size-4 sm:size-5" /></div>
              <div className="flex flex-col min-w-0">
                <span className="text-lg sm:text-2xl font-bold text-zinc-900 leading-none tabular-nums">{gCounts[key]}</span>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider truncate mt-1">{label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {list.map((b, idx) => <InstitutionCard key={b.id} inst={b} idx={idx} />)}
          {list.length === 0 && (
            <div className="col-span-full bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center">
              <Network className="size-10 text-zinc-300 mb-3" />
              <p className="text-zinc-500 font-medium text-sm">No branches in this group yet.</p>
              <button onClick={() => openAddBranch(g)} className="mt-3 h-8 px-3 rounded-md bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors">Add Branch</button>
            </div>
          )}
        </div>
      </>
    );
  };

  // ===================================================================
  //  VIEW: list (groups + standalone)
  // ===================================================================
  const renderList = () => (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">List of Clients</h2>
          <p className="text-sm text-zinc-500 mt-1">Open a group to see its branches, or a school to see its details.</p>
        </div>
        <button onClick={openAddModal} className="h-9 px-4 bg-primary hover:bg-primary/90 text-white shadow-sm rounded-md text-xs font-semibold flex items-center transition-colors w-full sm:w-auto justify-center shrink-0">
          <Plus className="size-3.5 mr-1.5" /> Onboard Client
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-5">
        {['total', ...CATEGORIES].map(key => {
          const s = STAT_STYLES[key];
          const Icon = s.icon;
          const value = key === 'total' ? counts.total : counts[key];
          return (
            <div key={key} className={`rounded-lg ring-1 p-3 sm:p-4 flex items-center gap-3 ${s.box}`}>
              <div className={`size-9 sm:size-10 rounded-md flex items-center justify-center shrink-0 ${s.chip}`}><Icon className="size-4 sm:size-5" /></div>
              <div className="flex flex-col min-w-0">
                <span className="text-lg sm:text-2xl font-bold text-zinc-900 leading-none tabular-nums">{value}</span>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider truncate mt-1">{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-6">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} title="Filter by category"
              className="h-9 w-full sm:w-44 rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm transition-colors cursor-pointer">
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} title="Filter by plan"
              className="h-9 w-full sm:w-44 rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm transition-colors cursor-pointer">
              <option value="all">All Plans</option>
              {PLAN_OPTIONS.map(p => <option key={p} value={p}>{planLabel(p)}</option>)}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {filtersDirty && (
            <button onClick={clearFilters} className="col-span-2 sm:col-span-1 h-9 px-3 rounded-md border border-zinc-200 bg-white text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors shrink-0">Clear</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {filteredTop.map((inst, idx) => <InstitutionCard key={inst.id} inst={inst} idx={idx} />)}

        {topLevel.length === 0 && (
          <div className="col-span-full bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center">
            <Building2 className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 font-medium text-sm">No institutions onboarded yet.</p>
          </div>
        )}
        {topLevel.length > 0 && filteredTop.length === 0 && (
          <div className="col-span-full bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center justify-center">
            <Search className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 font-medium text-sm">No clients match your filters.</p>
            <button onClick={clearFilters} className="mt-3 h-8 px-3 rounded-md border border-zinc-200 bg-white text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">Clear filters</button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans">
      <header className="bg-white border-b border-zinc-200 px-6 py-3 flex justify-between items-center sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <img src={smartedzLogo} alt="SmartEdz" className="h-8 w-auto" />
          <div className="h-6 w-[1px] bg-zinc-200"></div>
          <h1 className="text-lg font-semibold tracking-tight"><span className="text-primary">SMART</span><span className="text-accent">EDZ</span></h1>
          <div className="h-6 w-[1px] bg-zinc-200"></div>
          <span className="text-base sm:text-lg font-semibold text-zinc-900 tracking-tight">Admin Board</span>
        </div>
        <button onClick={logout} className="h-9 px-4 rounded-md hover:bg-zinc-50 border border-zinc-200 text-zinc-600 hover:text-zinc-900 flex items-center transition-colors text-xs font-semibold shadow-sm">
          <LogOut className="size-3.5 mr-2" /> Sign Out
        </button>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto flex-1 flex flex-col">
        {view.mode === 'list' && renderList()}
        {view.mode === 'group' && renderGroup()}
        {view.mode === 'detail' && renderDetail()}
      </main>

      {/* ============================== MODAL ============================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-2xl shadow-xl relative flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">

            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="font-semibold text-lg text-zinc-900 tracking-tight">
                {isEditMode ? 'Update Institution Profile' : branchAddMode ? `Add Branch to ${branchParent.name}` : 'Onboard New Client'}
              </h2>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md"><X className="size-4" /></button>
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
                    <span className="text-[11px] font-semibold uppercase tracking-wider">{branchAddMode ? 'Branch Information' : 'General Information'}</span>
                  </div>

                  {branchAddMode && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Institute</label>
                      <input value={branchParent.name} disabled readOnly
                        className="h-9 w-full bg-zinc-100 border border-zinc-200 rounded-md px-3 text-sm text-zinc-600 font-medium cursor-not-allowed outline-none" />
                      <p className="text-[10px] text-zinc-400 font-medium">Fixed — you only name the branch below.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{branchAddMode ? 'Branch Name' : 'Official Name'} <span className="text-red-500">*</span></label>
                      <input required placeholder={branchAddMode ? 'Hyderabad' : isGroupType ? 'Sri Chaithanya' : 'Lincoln High'} value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })} disabled={isSaving}
                        className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Category</label>
                      <div className="relative">
                        <select value={formData.type} onChange={e => handleTypeChange(e.target.value)} disabled={isSaving}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm transition-colors cursor-pointer">
                          {(branchAddMode ? BRANCH_TYPES : ['School', 'College', 'Tuition', 'Group']).map(t => (
                            <option key={t} value={t}>{t === 'Group' ? 'Group of Institutes' : t}</option>
                          ))}
                        </select>
                        <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {!isGroupType && !branchAddMode && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Belongs to Group</label>
                      <div className="relative">
                        <Network className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                        <select value={formData.parent_id} onChange={e => setFormData({ ...formData, parent_id: e.target.value })} disabled={isSaving}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm transition-colors cursor-pointer">
                          <option value="">Standalone (no group)</option>
                          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      {isBranch && (
                        <p className="text-[11px] text-violet-700 font-medium">This branch inherits its plan from {instById[formData.parent_id]?.name || 'the group'}.</p>
                      )}
                    </div>
                  )}

                  {branchAddMode && (
                    <p className="text-[11px] text-violet-700 font-medium">Adding under <span className="font-semibold">{branchParent.name}</span> — runs on the group plan, no separate subscription.</p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{isGroupType ? 'Group' : branchAddMode ? 'Branch' : 'School'} Email <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                        <input required type="email" placeholder="info@school.com" disabled={isSaving}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                          value={formData.school_email} onChange={e => setFormData({ ...formData, school_email: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Contact Phone <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                        <input required placeholder="+91 000-000-0000" disabled={isSaving}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                          value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </div>

                {!isBranch && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-1.5 text-zinc-500 mb-3 border-b border-zinc-100 pb-2 mt-6">
                      <Calendar className="size-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Subscription Plan</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Plan</label>
                        <div className="relative">
                          <select value={formData.usage_plan} disabled={isSaving} onChange={e => setFormData({ ...formData, usage_plan: e.target.value })}
                            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm transition-colors cursor-pointer">
                            {PLAN_OPTIONS.map(opt => <option key={opt} value={opt}>{planLabel(opt)}</option>)}
                          </select>
                          <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Start Date</label>
                        <input type="date" disabled={isSaving} value={formData.plan_start_date} onChange={e => setFormData({ ...formData, plan_start_date: e.target.value })}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      {isGroupType ? 'Tip: A group\u2019s plan covers all its branches. "Life Time" never expires.' : 'Tip: "Life Time" never expires. Other plans count from the start date you pick.'}
                    </p>
                  </div>
                )}

                <div className="bg-zinc-50 p-5 rounded-md ring-1 ring-inset ring-black/5 space-y-4 relative overflow-hidden mt-6">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Shield className="size-24" /></div>
                  <div className="flex items-center gap-1.5 text-primary mb-2">
                    <Shield className="size-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">{branchAddMode ? 'Branch Admin Access' : isGroupType ? 'Group Owner Access' : 'Master Admin Access'}</span>
                  </div>
                  <div className="space-y-4 relative z-10">
                    <div className="relative">
                      <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                      <input required placeholder="Full Name" disabled={isSaving}
                        className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                        value={formData.superAdminName} onChange={e => setFormData({ ...formData, superAdminName: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                        <input type="email" required placeholder="Login Email" disabled={isSaving}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                          value={formData.superAdminEmail} onChange={e => setFormData({ ...formData, superAdminEmail: e.target.value })} />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                        <input required placeholder="Login Password" disabled={isSaving}
                          className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                          value={formData.superAdminPassword} onChange={e => setFormData({ ...formData, superAdminPassword: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
                <button type="button" onClick={closeModal} disabled={isSaving}
                  className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">Cancel</button>
                <button type="submit" disabled={isSaving}
                  className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">
                  {isSaving && <Loader2 className="size-3.5 animate-spin shrink-0" />}
                  {isSaving ? 'Saving...' : (isEditMode ? 'Save Changes' : branchAddMode ? 'Add Branch' : 'Deploy System')}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}