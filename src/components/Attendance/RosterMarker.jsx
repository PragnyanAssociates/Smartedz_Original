import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import { Calendar, Search, Loader2, CheckCheck, Save, Info, AlertTriangle, ChevronDown } from 'lucide-react';

// =====================================================================
//  RosterMarker — bulk attendance marker
// =====================================================================

const STATUS_OPTIONS = [
  { code: 'P', label: 'P', full: 'Present', cls: 'bg-emerald-600 border-emerald-600 text-white shadow-sm',  idle: 'bg-white border-zinc-200 text-zinc-400 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50' },
  { code: 'A', label: 'A', full: 'Absent',  cls: 'bg-red-600 border-red-600 text-white shadow-sm',          idle: 'bg-white border-zinc-200 text-zinc-400 hover:border-red-300 hover:text-red-600 hover:bg-red-50' },
  { code: 'L', label: 'L', full: 'Late',    cls: 'bg-amber-500 border-amber-500 text-white shadow-sm',      idle: 'bg-white border-zinc-200 text-zinc-400 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50' }
];

// Backend (e.g. Railway) stores marked_at / updated_at in UTC as a naive
// string. Tag it as UTC so the browser localises it correctly.
const fmtDateTime = (s) => {
  if (!s) return '';
  let v = String(s);
  const hasTz = /[zZ]$/.test(v) || /[+-]\d\d:?\d\d$/.test(v);
  if (!hasTz) v = v.replace(' ', 'T') + 'Z';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// Students sort by roll number (1, 2, 3 …). Non-numeric rolls fall to the
// end, then alphabetical. Everyone else sorts alphabetically by name.
const sortRoster = (list, category) => {
  const arr = [...list];
  if (category === 'students') {
    arr.sort((a, b) => {
      const ra = parseInt(a.roll_no, 10);
      const rb = parseInt(b.roll_no, 10);
      const na = isNaN(ra), nb = isNaN(rb);
      if (na && nb) return (a.name || '').localeCompare(b.name || '');
      if (na) return 1;
      if (nb) return -1;
      return ra - rb;
    });
  } else {
    arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }
  return arr;
};

export default function RosterMarker({ category }) {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();
  const role = (user?.role || '').toLowerCase();
  const isTeacher = role.includes('teacher');

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [roster, setRoster] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Error/warning surface
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);

  // Class filter for students
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');

  const teacherCantMark = isTeacher && !isAllAccess && category === 'teachers';

  // -----------------------------------------------------------------
  // Load classes
  // -----------------------------------------------------------------
  useEffect(() => {
    if (category !== 'students') { setClasses([]); setClassId(''); return; }
    (async () => {
      try {
        if (isTeacher && !isAllAccess) {
          const res = await fetch(`${API_BASE_URL}/admin/attendance/teacher-classes/${user.id}`);
          const data = await res.json();
          setClasses(data || []);
          if (data?.[0]) setClassId(String(data[0].id));
        } else {
          const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
          const data = await res.json();
          setClasses(data.classes || []);
        }
      } catch (e) { console.error('classes load:', e); }
    })();
  }, [category, user, isTeacher, isAllAccess]);

  // -----------------------------------------------------------------
  // Load roster
  // -----------------------------------------------------------------
  const loadRoster = useCallback(async () => {
    if (teacherCantMark) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      let url = `${API_BASE_URL}/admin/attendance/roster/${user.institutionId}?category=${category}&date=${date}`;
      if (category === 'students' && classId) url += `&class_id=${classId}`;

      const res = await fetch(url);
      const data = await res.json();

      // Surface backend errors and warnings
      if (!res.ok || data.error) {
        setError(data.error || `Server returned ${res.status}`);
        setRoster([]);
        setEdits({});
        return;
      }
      if (data.warning) setWarning(data.warning);

      setRoster(sortRoster(data.users || [], category));
      const initial = {};
      (data.users || []).forEach(u => { if (u.status) initial[u.id] = u.status; });
      setEdits(initial);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Network error');
    }
    setLoading(false);
  }, [user, category, date, classId, teacherCantMark]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  // -----------------------------------------------------------------
  // Status setting & submit
  // -----------------------------------------------------------------
  const setStatus = (uid, code) => setEdits(prev => ({ ...prev, [uid]: code }));

  const markAllPresent = () => {
    const next = {};
    filtered.forEach(u => { next[u.id] = 'P'; });
    setEdits(prev => ({ ...prev, ...next }));
  };

  const handleSubmit = async () => {
    const entries = Object.entries(edits)
      .filter(([_, code]) => ['P', 'A', 'L'].includes(code))
      .map(([uid, code]) => ({ user_id: parseInt(uid, 10), status: code }));

    if (entries.length === 0) return alert('Mark at least one user before submitting.');
    if (!window.confirm(`Save attendance for ${entries.length} ${category} on ${date}?`)) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/attendance/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          date,
          actor_id: user.id,
          entries
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      alert('Attendance saved.');
      loadRoster();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  // -----------------------------------------------------------------
  // Filter for search (roster is already sorted)
  // -----------------------------------------------------------------
  const filtered = useMemo(() => {
    if (!search.trim()) return roster;
    const q = search.toLowerCase();
    return roster.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.roll_no || '').toString().toLowerCase().includes(q)
    );
  }, [roster, search]);

  // Running serial numbers for non-student categories (1 … N by sorted order)
  const serialMap = useMemo(() => {
    if (category === 'students') return {};
    const map = {};
    roster.forEach((u, i) => { map[u.id] = i + 1; });
    return map;
  }, [roster, category]);

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  if (teacherCantMark) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 sm:p-8 text-center max-w-2xl mx-auto flex flex-col items-center">
        <Info className="w-8 h-8 text-amber-500 mb-3" />
        <p className="font-semibold text-amber-800">Teachers cannot mark teacher attendance.</p>
        <p className="text-sm text-amber-700 mt-1">Only Super Admin or a designated role can do that.</p>
      </div>
    );
  }

  const presentCount = Object.values(edits).filter(s => s === 'P').length;
  const absentCount  = Object.values(edits).filter(s => s === 'A').length;
  const lateCount    = Object.values(edits).filter(s => s === 'L').length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 sm:p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-red-800 text-sm">Server Error</div>
            <div className="text-[11px] text-red-700 mt-0.5 font-mono break-all">{error}</div>
            <div className="text-[11px] text-red-600 mt-2 bg-red-100/50 p-2 rounded">
              Most common cause: the <code className="bg-red-100 px-1 rounded font-semibold">attendance</code> table doesn't exist.
              Run the SQL migration in your database.
            </div>
          </div>
        </div>
      )}

      {/* Warning banner */}
      {warning && !error && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 sm:p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-amber-800 text-sm">History Unavailable</div>
            <div className="text-[11px] text-amber-700 mt-0.5 font-mono break-all">{warning}</div>
            <div className="text-[11px] text-amber-600 mt-2">
              You can still mark today's attendance. Run the SQL migration to enable history features.
            </div>
          </div>
        </div>
      )}

      {/* Filter bar - Optimized for Mobile Grid */}
      <div className="bg-white border border-zinc-200 rounded-lg p-3 sm:p-5 shadow-sm">
        <div className="grid grid-cols-2 sm:flex sm:flex-row lg:flex-nowrap gap-3 sm:gap-4 items-end">
          
          <Field label="Date" icon={Calendar} className={category === 'students' ? 'col-span-1' : 'col-span-2 sm:col-span-1'}>
            <input type="date" value={date} max={today}
              onChange={e => setDate(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 sm:px-3 text-xs sm:text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" />
          </Field>

          {category === 'students' && (
            <Field label="Class" className="col-span-1">
              <div className="relative w-full">
                <select value={classId} onChange={e => setClassId(e.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-2 sm:pl-3 pr-6 text-xs sm:text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none transition-colors">
                  <option value="">All classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.className}{c.section ? ` - ${c.section}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="size-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </Field>
          )}

          {/* Search and Action Button share a row on mobile */}
          <div className="col-span-2 sm:flex-1 flex gap-2 items-end">
            <Field label="Search" className="flex-1">
              <div className="relative w-full">
                <Search className="size-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input placeholder="Search..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" />
              </div>
            </Field>

            <button onClick={markAllPresent}
              disabled={filtered.length === 0}
              className="h-9 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-700 px-3 sm:px-4 rounded-md text-[10px] sm:text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 shrink-0 transition-colors">
              <CheckCheck className="size-3.5 sm:size-4" />
              <span className="hidden sm:inline">All Present</span>
              <span className="sm:hidden">All</span>
            </button>
          </div>
        </div>

        {/* Tighter Stats Bar */}
        <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-wrap gap-1.5 sm:gap-3 text-[10px] sm:text-xs font-medium">
          <Stat color="emerald" label="Present"  value={presentCount} />
          <Stat color="red"     label="Absent"   value={absentCount} />
          <Stat color="amber"   label="Late"     value={lateCount} />
          <Stat color="zinc"    label="Unmarked" value={filtered.length - presentCount - absentCount - lateCount} />
          <Stat color="zinc"    label="Total"    value={roster.length} />
        </div>
      </div>

      {/* Roster Table - Reduced padding on mobile */}
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <Loader2 className="animate-spin size-6 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-8 sm:p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <p className="text-zinc-500 text-sm font-medium">No users to mark.</p>
          {roster.length === 0 && !error && (
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">
              {category === 'students' && classId
                ? 'No students assigned to this class.'
                : `No ${category} in this institution. Add some in Manage Logins → Users.`}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-zinc-50/50">
              <tr>
                <th className="px-3 sm:px-5 py-2 sm:py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap">Person</th>
                <th className="px-3 sm:px-5 py-2 sm:py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap">Marked By</th>
                <th className="px-3 sm:px-5 py-2 sm:py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 text-center whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(u => {
                const status = edits[u.id];
                // Students show their roll number; everyone else shows a serial number.
                const idLabel = category === 'students'
                  ? (u.roll_no ? `Roll ${u.roll_no}` : (u.username ? `@${u.username}` : u.role))
                  : `S.No ${serialMap[u.id] || '—'}`;
                return (
                  <tr key={u.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {u.profile_pic ? (
                          <img src={u.profile_pic} alt="" className="size-7 sm:size-8 rounded-full object-cover shrink-0 ring-1 ring-black/5" />
                        ) : (
                          <div className="size-7 sm:size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-[10px] sm:text-xs shrink-0 ring-1 ring-primary/20">
                            {(u.name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <div className="font-medium text-zinc-900 text-[13px] sm:text-sm truncate">{u.name}</div>
                          <div className="text-[10px] text-zinc-500 truncate">{idLabel}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3 text-[10px] sm:text-[11px]">
                      {u.marked_by_name ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="text-zinc-600 truncate">
                            <span className="font-medium text-zinc-800">{u.marked_by_name}</span>
                            <span className="text-zinc-400"> ({u.marked_by_role})</span>
                          </div>
                          <div className="text-zinc-400 whitespace-nowrap">{fmtDateTime(u.marked_at)}</div>
                          {u.updated_by_name && (
                            <div className="text-amber-600/90 truncate mt-0.5 sm:mt-1">
                              Updated by <span className="font-medium">{u.updated_by_name}</span>
                              <span className="whitespace-nowrap"> · {fmtDateTime(u.updated_at)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-300 italic">Not yet marked</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3">
                      <div className="flex justify-center gap-1.5 sm:gap-2">
                        {STATUS_OPTIONS.map(opt => {
                          const active = status === opt.code;
                          return (
                            <button key={opt.code} type="button"
                              onClick={() => setStatus(u.id, opt.code)}
                              title={opt.full}
                              className={`size-7 sm:size-8 rounded border flex items-center justify-center font-semibold text-[10px] sm:text-xs transition-all ${
                                active ? opt.cls : opt.idle
                              }`}>
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Submit Button */}
      {filtered.length > 0 && (
        <div className="flex justify-end pt-2 pb-6">
          <button onClick={handleSubmit} disabled={saving}
            className="w-full sm:w-auto h-10 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-md text-[11px] sm:text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm">
            {saving ? <Loader2 className="size-4 animate-spin shrink-0" /> : <Save className="size-4 shrink-0" />}
            {saving ? 'Saving...' : 'Submit Attendance'}
          </button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------

function Field({ label, icon: Icon, children, className = '' }) {
  return (
    <div className={`flex flex-col w-full lg:w-auto lg:min-w-[160px] ${className}`}>
      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5" />} {label}
      </div>
      {children}
    </div>
  );
}

function Stat({ color, label, value }) {
  const map = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    red:     'bg-red-50 text-red-700 ring-red-600/20',
    amber:   'bg-amber-50 text-amber-700 ring-amber-600/20',
    zinc:    'bg-zinc-50 text-zinc-600 ring-zinc-200'
  };
  return (
    <div className={`ring-1 rounded px-1.5 sm:px-2.5 py-0.5 sm:py-1 ${map[color]}`}>
      <span className="opacity-80">{label}:</span> <span className="font-semibold ml-0.5">{value}</span>
    </div>
  );
}