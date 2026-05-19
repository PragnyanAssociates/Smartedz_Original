import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import { Calendar, Search, Loader2, CheckCheck, Save, Info, AlertTriangle } from 'lucide-react';

// =====================================================================
//  RosterMarker — bulk attendance marker
// =====================================================================

const STATUS_OPTIONS = [
  { code: 'P', label: 'P', full: 'Present', cls: 'bg-emerald-600 border-emerald-600 text-white',  idle: 'border-emerald-300 text-emerald-600 hover:bg-emerald-50' },
  { code: 'A', label: 'A', full: 'Absent',  cls: 'bg-red-600 border-red-600 text-white',           idle: 'border-red-300 text-red-600 hover:bg-red-50' },
  { code: 'L', label: 'L', full: 'Late',    cls: 'bg-amber-500 border-amber-500 text-white',       idle: 'border-amber-300 text-amber-600 hover:bg-amber-50' }
];

const fmtDateTime = (s) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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

      setRoster(data.users || []);
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
  // Filter for search
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

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  if (teacherCantMark) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center max-w-2xl mx-auto">
        <Info className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="font-bold text-amber-800">Teachers can't mark teacher attendance.</p>
        <p className="text-sm text-amber-700 mt-1">Only Super Admin or a designated role can do that.</p>
      </div>
    );
  }

  const presentCount = Object.values(edits).filter(s => s === 'P').length;
  const absentCount  = Object.values(edits).filter(s => s === 'A').length;
  const lateCount    = Object.values(edits).filter(s => s === 'L').length;

  return (
    <div className="space-y-5">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-red-800 text-sm">Server error</div>
            <div className="text-xs text-red-700 mt-0.5 font-mono break-all">{error}</div>
            <div className="text-xs text-red-600 mt-2">
              Most common cause: the <code className="bg-red-100 px-1 rounded">attendance</code> table doesn't exist.
              Run the SQL migration in Railway MySQL.
            </div>
          </div>
        </div>
      )}

      {/* Warning banner */}
      {warning && !error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-amber-800 text-sm">Attendance lookup unavailable</div>
            <div className="text-xs text-amber-700 mt-0.5 font-mono break-all">{warning}</div>
            <div className="text-xs text-amber-600 mt-2">
              You can still mark today's attendance. Run the SQL migration to enable history.
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-end">
          <Field label="Date" icon={Calendar}>
            <input type="date" value={date} max={today}
              onChange={e => setDate(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500/10" />
          </Field>

          {category === 'students' && (
            <Field label="Class">
              <select value={classId} onChange={e => setClassId(e.target.value)}
                className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer">
                <option value="">All classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.className}{c.section ? ` - ${c.section}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Search">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="Name, username, roll no…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2.5 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500/10" />
            </div>
          </Field>

          <button onClick={markAllPresent}
            disabled={filtered.length === 0}
            className="bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-700 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shrink-0">
            <CheckCheck size={14} /> All Present
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold">
          <Stat color="emerald" label="Present"  value={presentCount} />
          <Stat color="red"     label="Absent"   value={absentCount} />
          <Stat color="amber"   label="Late"     value={lateCount} />
          <Stat color="slate"   label="Unmarked" value={filtered.length - presentCount - absentCount - lateCount} />
          <Stat color="slate"   label="Total"    value={roster.length} />
        </div>
      </div>

      {/* Roster */}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center space-y-2">
          <p className="text-slate-400 font-medium">No users to mark.</p>
          {roster.length === 0 && !error && (
            <p className="text-xs text-slate-400">
              {category === 'students' && classId
                ? 'No students assigned to this class.'
                : `No ${category} in this institution. Add some in Manage Logins → Users.`}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-4 text-left">Person</th>
                <th className="p-4 text-left">Marked By</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(u => {
                const status = edits[u.id];
                return (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {u.profile_pic ? (
                          <img src={u.profile_pic} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                            {(u.name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-700 text-sm">{u.name}</div>
                          <div className="text-xs text-slate-400">
                            {u.roll_no ? `Roll ${u.roll_no}` : (u.username ? `@${u.username}` : u.role)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-xs">
                      {u.marked_by_name ? (
                        <div className="space-y-0.5">
                          <div className="text-slate-600">
                            <span className="font-bold">{u.marked_by_name}</span>
                            <span className="text-slate-400"> ({u.marked_by_role})</span>
                          </div>
                          <div className="text-slate-400">{fmtDateTime(u.marked_at)}</div>
                          {u.updated_by_name && (
                            <div className="text-amber-600 mt-1">
                              Updated by <span className="font-bold">{u.updated_by_name}</span> · {fmtDateTime(u.updated_at)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 italic">Not yet marked</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        {STATUS_OPTIONS.map(opt => {
                          const active = status === opt.code;
                          return (
                            <button key={opt.code} type="button"
                              onClick={() => setStatus(u.id, opt.code)}
                              title={opt.full}
                              className={`w-10 h-10 rounded-full border-2 font-black text-sm transition-all hover:scale-105 ${
                                active ? opt.cls + ' shadow-md' : 'bg-white ' + opt.idle
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

      {filtered.length > 0 && (
        <div className="flex justify-center pt-2">
          <button onClick={handleSubmit} disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black uppercase tracking-widest px-8 py-3.5 rounded-2xl shadow-lg shadow-blue-100 flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving…' : 'Submit Attendance'}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <div className="flex-1 min-w-[140px]">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
        {Icon && <Icon size={11} />} {label}
      </div>
      {children}
    </div>
  );
}

function Stat({ color, label, value }) {
  const map = {
    emerald: 'bg-emerald-50 text-emerald-700',
    red:     'bg-red-50 text-red-700',
    amber:   'bg-amber-50 text-amber-700',
    slate:   'bg-slate-100 text-slate-600'
  };
  return (
    <div className={`${map[color]} rounded-full px-3 py-1.5`}>
      <span className="opacity-70">{label}:</span> {value}
    </div>
  );
}