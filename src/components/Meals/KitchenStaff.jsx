import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  Loader2, Search, CalendarDays, Users, CheckCircle2, XCircle, MinusCircle,
  ChefHat, Warehouse, PackagePlus, RefreshCw, Pencil, Trash2, UtensilsCrossed, Clock
} from 'lucide-react';

// =====================================================================
//  KITCHEN STAFF — who worked in the Food module on a given day and what
//  they did. Staff = app users whose role has the Meals module. Their
//  actions (log usage, add/restock provisions, add/edit inventory) are
//  pulled from the activity log. "Present" comes from the Attendance
//  module (wired once that table is shared — shows "—" until then).
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

// Visual language for every tracked action.
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

function PresenceBadge({ present }) {
  if (present === true)  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><CheckCircle2 className="size-3" /> Present</span>;
  if (present === false) return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-red-100"><XCircle className="size-3" /> Absent</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-50 text-zinc-400 ring-1 ring-zinc-100" title="From the Attendance module"><MinusCircle className="size-3" /> —</span>;
}

export default function KitchenStaff({ user }) {
  const [date, setDate]       = useState(istToday());
  const [staff, setStaff]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(s =>
      (s.name || '').toLowerCase().includes(q) || (s.role || '').toLowerCase().includes(q));
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
        <div className="sm:ml-auto flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white ring-1 ring-zinc-200 rounded-md shadow-sm">
            <Users className="size-3.5 text-primary" /> {activeCount} active
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white ring-1 ring-zinc-200 rounded-md shadow-sm">
            {totalActions} action{totalActions === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Attendance note */}
      <p className="text-[11px] text-zinc-400 px-0.5">
        Presence is read from the Attendance module{isToday ? ' for today' : ''}. Activity below is tracked automatically as staff work in the Kitchen and Inventory tabs.
      </p>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="size-8 text-primary animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center max-w-xl mx-auto flex flex-col items-center">
          <Users className="text-zinc-300 mb-3 size-10" />
          <h3 className="text-base font-semibold text-zinc-900">No kitchen staff found</h3>
          <p className="text-zinc-500 mt-1 text-sm">
            {query ? 'No staff match your search.' : 'No app users have the Food module assigned to their role yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(s => (
            <div key={s.user_id} className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden">
              {/* Staff header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
                {s.profile_pic
                  ? <img src={s.profile_pic} alt="" className="size-9 rounded-full object-cover ring-1 ring-black/5" />
                  : <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold ring-1 ring-primary/20">{initials(s.name)}</div>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{s.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{s.role}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <PresenceBadge present={s.present} />
                  <span className="text-[10px] font-medium text-zinc-400">{s.activities.length} action{s.activities.length === 1 ? '' : 's'}</span>
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
    </div>
  );
}