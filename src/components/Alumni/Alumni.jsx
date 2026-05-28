import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  GraduationCap, Search, Loader2, Mail, Phone, CalendarDays,
  Briefcase, Plus
} from 'lucide-react';
import { initials, statusStyle } from './AlumniUtils';
import AlumniDetail from './AlumniDetail';

// =====================================================================
//  Alumni — card list of passed-out students.
//   • Academic-year filter + search bar.
//   • Each card: photo/initials, name, phone, email, current status,
//     passout year. Click → full detail (AlumniDetail).
//   • Edit access (can('Alumni','edit')) unlocks editing extra fields
//     and the manual "Add to Alumni" action.
// =====================================================================

export default function Alumni() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('Alumni', 'edit');

  const [list, setList]       = useState([]);
  const [years, setYears]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearId, setYearId]   = useState('');
  const [query, setQuery]     = useState('');
  const [openId, setOpenId]   = useState(null);    // alumni id in detail view

  // load distinct years for the filter
  const loadYears = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/alumni/years/${user.institutionId}`);
      const d = await res.json();
      setYears(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
  }, [user]);

  // load the card list (re-runs on year/search change)
  const loadList = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (yearId) params.set('yearId', yearId);
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(
        `${API_BASE_URL}/admin/alumni/${user.institutionId}?${params.toString()}`);
      const d = await res.json();
      setList(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user, yearId, query]);

  useEffect(() => { loadYears(); }, [loadYears]);

  // debounce the search a touch
  useEffect(() => {
    const t = setTimeout(() => loadList(), 250);
    return () => clearTimeout(t);
  }, [loadList]);

  const yearLabel = (y) => y.passout_year || y.year_name || '—';

  // detail view takes over the whole module
  if (openId) {
    return (
      <AlumniDetail
        alumniId={openId} canEdit={canEdit}
        onBack={() => { setOpenId(null); loadList(); loadYears(); }} />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <GraduationCap className="text-blue-600" size={30} />
          Alumni
        </h2>
        <p className="text-slate-500 font-medium mt-1">
          Past students of the institution and where they are now.
        </p>
      </div>

      {/* Filter + search bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Year</span>
          <select value={yearId} onChange={e => setYearId(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer">
            <option value="">All Years</option>
            {years.map(y => (
              <option key={y.academic_year_id || y.passout_year} value={y.academic_year_id || ''}>
                {yearLabel(y)}
              </option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, email, phone, status…"
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : list.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">
            {query || yearId ? 'No alumni match your filters.' : 'No alumni yet.'}
          </p>
          {!query && !yearId && (
            <p className="text-slate-400 text-sm mt-1">
              Students appear here when promoted to "Alumni (Passout)" in the Promotion tab.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(a => (
            <AlumniCard key={a.id} a={a} instId={user.institutionId}
              onClick={() => setOpenId(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}


// --- One alumni card -----------------------------------------------
function AlumniCard({ a, instId, onClick }) {
  const ss = statusStyle(a.current_status);
  const picUrl = a.has_pic
    ? `${API_BASE_URL}/admin/alumni/detail/${a.id}`   // detail carries the pic; cards use initials
    : null;

  return (
    <button onClick={onClick}
      className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 text-left hover:border-blue-200 hover:shadow-md transition-all">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg shrink-0">
          {initials(a.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-slate-800 truncate">{a.name}</h3>
          {a.passout_year && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 mt-0.5">
              <CalendarDays size={11} /> {a.passout_year}
              {a.final_class ? ` · ${a.final_class}` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {a.phone && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Phone size={13} className="text-slate-400 shrink-0" />
            <span className="truncate">{a.phone}</span>
          </p>
        )}
        {a.email && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Mail size={13} className="text-slate-400 shrink-0" />
            <span className="truncate">{a.email}</span>
          </p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-50">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${ss.bg} ${ss.text}`}>
          <Briefcase size={12} />
          {a.current_status || 'Status not set'}
        </span>
      </div>
    </button>
  );
}