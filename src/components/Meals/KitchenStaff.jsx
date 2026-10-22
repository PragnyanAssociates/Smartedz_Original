import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  Loader2, Search, CalendarDays, Users, CheckCircle2, XCircle, MinusCircle,
  ChefHat, Warehouse, PackagePlus, RefreshCw, Pencil, Trash2, UtensilsCrossed,
  Clock, Plus, X, UserPlus, ChevronDown
} from 'lucide-react';

// =====================================================================
//  KITCHEN STAFF — a hand-picked roster. The Super Admin adds specific
//  app users as kitchen staff; only those people show here, with what
//  they did in the Kitchen and Inventory tabs on the chosen day.
//  "Present" comes from the Attendance module (shows "—" until wired).
// =====================================================================

const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const fmtTimeIST = (val) => {
  if (!val) return '';
  let d;
  if (typeof val === 'string' && !val.includes('T') && !val.endsWith('Z')) d = new Date(val.replace(' ', 'T') + 'Z');
  else d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
};

const ACTION_META = {
  usage_logged:        { icon: UtensilsCrossed, label: 'Logged usage',      tone: 'text-emerald-600 bg-emerald-50 ring-emerald-100' },
  provision_added:     { icon: PackagePlus,     label: 'Added provision',   tone: 'text-blue-600 bg-blue-50 ring-blue-100' },
  provision_restocked: { icon: RefreshCw,       label: 'Restocked',         tone: 'text-indigo-600 bg-indigo-50 ring-indigo-100' },
  provision_edited:    { icon: Pencil,          label: 'Edited provision',  tone: 'text-amber-600 bg-amber-50 ring-amber-100' },
  provision_deleted:   { icon: Trash2,          label: 'Deleted provision', tone: 'text-red-600 bg-red-50 ring-red-100' },
  asset_added:         { icon: PackagePlus,     label: 'Added asset',       tone: 'text-blue-600 bg-blue-50 ring-blue-100' },
  asset_updated:       { icon: Pencil,          label: 'Updated asset',     tone: 'text-amber-600 bg-amber-50 ring-amber-100' },
  asset_deleted:       { icon: Trash2,          label: 'Deleted asset',     tone: 'text-red-600 bg-red-50 ring-red-100' },
};
const metaFor = (a) => ACTION_META[a] || { icon: Clock, label: a, tone: 'text-zinc-600 bg-zinc-50 ring-zinc-100' };

const initials = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

function Avatar({ src, name, size = 'size-9' }) {
  return src
    ? <img src={src} alt="" className={`${size} rounded-full object-cover ring-1 ring-black/5`} />
    : <div className={`${size} rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold ring-1 ring-primary/20`}>{initials(name)}</div>;
}

function PresenceBadge({ present }) {
  if (present === true)  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><CheckCircle2 className="size-3" /> Present</span>;
  if (present === false) return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-red-100"><XCircle className="size-3" /> Absent</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-50 text-zinc-400 ring-1 ring-zinc-100" title="From the Attendance module"><MinusCircle className="size-3" /> —</span>;
}

// ---------------------------------------------------------------------
//  Add-staff picker modal
// ---------------------------------------------------------------------
function AddStaffModal({ user, onClose, onAdded }) {
  const [list, setList]       = useState([]);   // addable users (not yet staff)
  const [allRoles, setAllRoles] = useState([]); // every role defined in the system
  const [loading, setLoading] = useState(true);
  const [role, setRole]       = useState('');     // '' = no role picked yet
  const [query, setQuery]     = useState('');
  const [busyId, setBusyId]   = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, rRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/kitchen/${user.institutionId}/staff-candidates`),
        fetch(`${API_BASE_URL}/admin/kitchen/${user.institutionId}/roles`),
      ]);
      const cands = await cRes.json();
      const roleNames = await rRes.json();
      setList(Array.isArray(cands) ? cands : []);
      setAllRoles(Array.isArray(roleNames) ? roleNames : []);
    } catch (e) { console.error('add-staff fetch error:', e); setList([]); setAllRoles([]); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Every role from the system, each with a count of still-addable users.
  const roles = useMemo(() => {
    const counts = new Map();
    list.forEach(u => { const r = u.role || 'No role'; counts.set(r, (counts.get(r) || 0) + 1); });
    return allRoles.map(name => ({ name, count: counts.get(name) || 0 }));
  }, [allRoles, list]);

  // Users of the chosen role, narrowed by search.
  const usersInRole = useMemo(() => {
    if (!role) return [];
    const q = query.trim().toLowerCase();
    return list.filter(u => (u.role || 'No role') === role)
               .filter(u => !q || (u.name || '').toLowerCase().includes(q));
  }, [list, role, query]);

  const add = async (u) => {
    setBusyId(u.id);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/kitchen/staff`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id })
      });
      if (!res.ok) throw new Error('Could not add');
      setList(p => p.filter(x => x.id !== u.id));   // drop from picker
      onAdded();                                     // refresh the roster behind
    } catch (e) { alert(e.message); }
    setBusyId(null);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-5 py-3 flex items-center justify-between shrink-0">
          <span className="text-sm font-bold flex items-center gap-2"><UserPlus className="size-4" /> Add Kitchen Staff</span>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="size-5" /></button>
        </div>

        {/* Step 1 — pick a role */}
        <div className="p-4 border-b border-zinc-100 shrink-0 space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Step 1 · Role</label>
            <div className="relative mt-1">
              <select value={role} onChange={e => { setRole(e.target.value); setQuery(''); }}
                className="h-10 w-full pl-3 pr-9 bg-zinc-50 border border-zinc-200 rounded-md text-sm text-zinc-900 appearance-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer">
                <option value="">Select a role…</option>
                {roles.map(r => <option key={r.name} value={r.name}>{r.name} ({r.count})</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
            </div>
          </div>
          {/* Step 2 — search within the role */}
          {role && (
            <div>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Step 2 · Pick users</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
                <input autoFocus placeholder={`Search ${role}…`} value={query} onChange={e => setQuery(e.target.value)}
                  className="h-10 w-full pl-9 pr-3 bg-zinc-50 border border-zinc-200 rounded-md text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40" />
              </div>
            </div>
          )}
        </div>

        <div className="overflow-y-auto custom-scrollbar p-2 flex-1">
          {loading ? (
            <div className="h-40 flex items-center justify-center"><Loader2 className="size-6 text-primary animate-spin" /></div>
          ) : roles.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 py-10">No roles are defined in the system yet.</p>
          ) : !role ? (
            <p className="text-center text-sm text-zinc-400 py-10">Choose a role above to see its users.</p>
          ) : usersInRole.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 py-10">{query ? 'No matching users in this role.' : 'Everyone in this role is already added.'}</p>
          ) : usersInRole.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-50">
              <Avatar src={u.profile_pic} name={u.name} size="size-8" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 truncate">{u.name}</p>
                <p className="text-[11px] text-zinc-500 truncate">{u.role}</p>
              </div>
              <button onClick={() => add(u)} disabled={busyId === u.id}
                className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-md bg-primary hover:bg-primary/90 disabled:bg-zinc-300 text-white text-xs font-semibold transition-colors">
                {busyId === u.id ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Main
// ---------------------------------------------------------------------
export default function KitchenStaff({ user, canManage = false }) {
  const [date, setDate]       = useState(istToday());
  const [staff, setStaff]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/kitchen/${user.institutionId}/staff-activity?date=${date}`);
      const d = await res.json();
      setStaff(Array.isArray(d.staff) ? d.staff : []);
    } catch (e) { console.error('Kitchen staff fetch error:', e); setStaff([]); }
    setLoading(false);
  }, [user, date]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const removeStaff = async (s) => {
    if (!window.confirm(`Remove ${s.name} from kitchen staff? Their past activity stays recorded.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/kitchen/staff/${s.user_id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not remove');
      setStaff(p => p.filter(x => x.user_id !== s.user_id));
    } catch (e) { alert(e.message); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(s => (s.name || '').toLowerCase().includes(q) || (s.role || '').toLowerCase().includes(q));
  }, [staff, query]);

  const activeCount = useMemo(() => staff.filter(s => s.activities.length > 0).length, [staff]);
  const totalActions = useMemo(() => staff.reduce((n, s) => n + s.activities.length, 0), [staff]);
  const isToday = date === istToday();

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
          <input type="date" value={date} max={istToday()} onChange={e => setDate(e.target.value)}
            className="h-10 pl-9 pr-3 bg-white border border-zinc-200 rounded-md text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm" />
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
          <input placeholder="Search staff by name or role" value={query} onChange={e => setQuery(e.target.value)}
            className="h-10 w-full pl-9 pr-3 bg-white border border-zinc-200 rounded-md text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm" />
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white ring-1 ring-zinc-200 rounded-md shadow-sm text-[11px] font-semibold text-zinc-500">
            <Users className="size-3.5 text-primary" /> {staff.length} staff · {activeCount} active
          </span>
          {canManage && (
            <button onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold shadow-sm transition-colors shrink-0">
              <UserPlus className="size-3.5" /> Add Kitchen Staff
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-zinc-400 px-0.5">
        Only the users you add here are kitchen staff. Presence is read from the Attendance module{isToday ? ' for today' : ''}; activity is tracked automatically as they work in the Kitchen and Inventory tabs.
      </p>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="size-8 text-primary animate-spin" /></div>
      ) : staff.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center max-w-xl mx-auto flex flex-col items-center">
          <Users className="text-zinc-300 mb-3 size-10" />
          <h3 className="text-base font-semibold text-zinc-900">No kitchen staff added yet</h3>
          <p className="text-zinc-500 mt-1 text-sm max-w-sm">
            {canManage
              ? 'Add the app users who work in the kitchen. Only the people you add will appear here.'
              : 'No kitchen staff have been added yet.'}
          </p>
          {canManage && (
            <button onClick={() => setShowAdd(true)}
              className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold shadow-sm transition-colors">
              <UserPlus className="size-3.5" /> Add Kitchen Staff
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-zinc-400 py-10">No staff match your search.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(s => (
            <div key={s.user_id} className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden group">
              {/* Staff header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
                <Avatar src={s.profile_pic} name={s.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{s.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{s.role}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-end gap-1">
                    <PresenceBadge present={s.present} />
                    <span className="text-[10px] font-medium text-zinc-400">{s.activities.length} action{s.activities.length === 1 ? '' : 's'}</span>
                  </div>
                  {canManage && (
                    <button onClick={() => removeStaff(s)} title="Remove from kitchen staff"
                      className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Activity list */}
              {s.activities.length === 0 ? (
                <p className="px-4 py-5 text-xs text-zinc-400 italic text-center">No kitchen activity on this day.</p>
              ) : (
                <ul className="divide-y divide-zinc-50 max-h-64 overflow-y-auto custom-scrollbar">
                  {s.activities.map((a, i) => {
                    const m = metaFor(a.action);
                    return (
                      <li key={i} className="flex items-start gap-3 px-4 py-2.5">
                        <div className={`size-7 rounded-md flex items-center justify-center ring-1 shrink-0 ${m.tone}`}><m.icon className="size-3.5" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-zinc-800 leading-snug">{a.detail || m.label}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                              {a.area === 'store' ? <Warehouse className="size-3" /> : <ChefHat className="size-3" />}{a.area === 'store' ? 'Inventory' : 'Kitchen'}
                            </span>
                            <span className="text-[10px] text-zinc-400">{fmtTimeIST(a.created_at)}</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddStaffModal user={user} onClose={() => setShowAdd(false)} onAdded={fetchActivity} />}
    </div>
  );
}