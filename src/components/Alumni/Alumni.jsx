import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  GraduationCap, Search, Loader2, Mail, Phone, CalendarDays,
  Briefcase, Plus, ChevronDown, Download, HelpCircle, X, ShieldCheck
} from 'lucide-react';
import { initials, statusStyle } from './AlumniUtils';
import AlumniDetail from './AlumniDetail';
// =====================================================================
//  Alumni - card list of passed-out students.
//  • Plain calendar-year filter (auto, like Pre-Admissions): the year list
//    is built from the years that actually have alumni (YEAR(created_at)),
//    plus the current year, with an "All Years" option. Defaults to the
//    current year. + search bar.
//  • Each card: photo/initials, name, phone, email, current status,
//    occupation, passout year. Click -> full detail (AlumniDetail).
//  • Download to Excel follows the Year filter: a specific year exports
//    that year; "All Years" exports everyone grouped under year headings.
// =====================================================================
export default function Alumni() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('Alumni', 'edit');
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');
  const [openId, setOpenId]   = useState(null);    // alumni id in detail view
  const [downloading, setDownloading] = useState(false);
  // Calendar-year filter. Selectable years come from the data (plus the
  // current year); 'all' means every year. Defaults to the current year.
  const currentYear = new Date().getFullYear();
  const [availableYears, setAvailableYears] = useState([]); // years present in data
  const [filterYear, setFilterYear] = useState(String(currentYear)); // a year, or 'all'
  // Year filter options — distinct YEAR(created_at) present in the data.
  const loadYears = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/alumni/years/${user.institutionId}`);
      const d = await res.json();
      setAvailableYears(Array.isArray(d) ? d.map(Number).filter(Boolean) : []);
    } catch (e) { console.error(e); }
  }, [user]);
  // load the card list (re-runs on year/search change)
  const loadList = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterYear && filterYear !== 'all') params.set('year', filterYear);
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(
        `${API_BASE_URL}/admin/alumni/${user.institutionId}?${params.toString()}`);
      const d = await res.json();
      setList(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user, filterYear, query]);
  useEffect(() => { loadYears(); }, [loadYears]);
  // debounce the search a touch
  useEffect(() => {
    const t = setTimeout(() => loadList(), 250);
    return () => clearTimeout(t);
  }, [loadList]);
  // Year dropdown options: every year present in the data, plus the current
  // year (so you can always filter the year you're adding to), newest first.
  const yearOptions = useMemo(() => {
    const set = new Set(availableYears);
    set.add(currentYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [availableYears, currentYear]);
  // Whether any filter is narrowing the list (controls the empty-state copy).
  const hasFilter = query.trim() || filterYear !== 'all';
  // Download the alumni list as an Excel file. The export endpoint is behind
  // the /api gate, so a plain download link would 401 — fetch it as a blob
  // (token attached by the interceptor) and save that. Scope follows the Year
  // filter: a specific year, or 'all' (grouped by year in the sheet).
  const handleDownload = useCallback(async () => {
    if (!user?.institutionId) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      params.set('year', filterYear); // a year, or 'all'
      const res = await fetch(
        `${API_BASE_URL}/admin/alumni/export/${user.institutionId}?${params.toString()}`);
      if (!res.ok) throw new Error('Could not generate the Excel file.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filterYear === 'all' ? 'Alumni_AllYears.xlsx' : `Alumni_${filterYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { alert(e.message || 'Download failed.'); }
    setDownloading(false);
  }, [user, filterYear]);
  // detail view takes over the whole module
  if (openId) {
    return (
      <AlumniDetail
        alumniId={openId} canEdit={canEdit}
        onBack={() => { setOpenId(null); loadList(); loadYears(); }} />
    );
  }
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <header className="flex flex-col">
          <h2 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="text-primary size-5" />
            Alumni
          </h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Past students of the institution and where they are now.
          </p>
        </header>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <AlumniHelp canEdit={canEdit} />
          <button onClick={handleDownload} disabled={downloading}
            title={filterYear === 'all'
              ? 'Download every year, grouped by year'
              : `Download the ${filterYear} alumni list`}
            className="h-9 px-4 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0">
            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {downloading
              ? 'Preparing...'
              : (filterYear === 'all' ? 'Download All (Excel)' : `Download ${filterYear} (Excel)`)}
          </button>
        </div>
      </div>
      {/* Filter + search bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider shrink-0">Year</span>
          <div className="relative w-full sm:w-48">
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
              {yearOptions.map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
              <option value="all">All Years</option>
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, email, phone..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
        </div>
      </div>
      {/* Cards */}
      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
      ) : list.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <GraduationCap className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">
            {hasFilter ? 'No alumni match your filters.' : 'No alumni yet.'}
          </p>
          {!hasFilter && (
            <p className="text-zinc-400 text-xs mt-1.5">
              Students appear here when promoted to "Alumni (Passout)" in the Promotion tab.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {list.map(a => (
            <AlumniCard key={a.id} a={a} onClick={() => setOpenId(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
// --- Fetch a token-protected image as a blob object URL -------------
//   The /admin/alumni/pic/:id endpoint sits behind the /api auth gate,
//   so a raw <img src> gets no token and 401s. Fetching it (the app's
//   fetch interceptor attaches the token) and using the resulting blob
//   URL is what makes the card photos appear.
function useAuthedImage(url) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!url) { setSrc(null); setErr(false); return; }
    let revoked = false;
    let obj = null;
    setSrc(null); setErr(false);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then(blob => {
        if (revoked) return;
        obj = URL.createObjectURL(blob);
        setSrc(obj);
      })
      .catch(() => { if (!revoked) setErr(true); });
    return () => { revoked = true; if (obj) URL.revokeObjectURL(obj); };
  }, [url]);
  return { src, err };
}
// --- Avatar: shows the stored photo, falls back to initials ---------
function AlumniAvatar({ a }) {
  // a.has_pic comes back as 1/0 from MySQL
  const { src, err } = useAuthedImage(a.has_pic ? `${API_BASE_URL}/admin/alumni/pic/${a.id}` : null);
  if (a.has_pic && src && !err) {
    return (
      <img
        src={src}
        alt={a.name}
        className="size-12 rounded-md object-cover shrink-0 ring-1 ring-black/5"
      />
    );
  }
  return (
    <div className="size-12 rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg shrink-0 ring-1 ring-primary/20">
      {initials(a.name)}
    </div>
  );
}
// --- One alumni card -----------------------------------------------
function AlumniCard({ a, onClick }) {
  const ss = statusStyle(a.current_status);
  return (
    <button onClick={onClick}
      className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-4 sm:p-5 text-left hover:ring-primary/30 hover:shadow-md transition-all group flex flex-col h-full w-full">
      <div className="flex items-start gap-3 w-full">
        <AlumniAvatar a={a} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-zinc-900 truncate group-hover:text-primary transition-colors">{a.name}</h3>
          {a.passout_year && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 mt-0.5">
              <CalendarDays className="size-3" /> {a.passout_year}
              {a.final_class ? ` - ${a.final_class}` : ''}
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-2 w-full">
        {a.phone && (
          <p className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
            <Phone className="size-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{a.phone}</span>
          </p>
        )}
        {a.email && (
          <p className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
            <Mail className="size-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{a.email}</span>
          </p>
        )}
      </div>
      {/* Footer: current status chip (green/etc) + occupation chip (orange) */}
      <div className="mt-auto pt-4 border-t border-zinc-100 w-full flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold shrink-0 ${ss.bg} ${ss.text} ring-1 ring-inset ring-black/5`}>
          <Briefcase className="size-3" />
          {a.current_status || 'Status not set'}
        </span>
        {a.occupation && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold min-w-0 bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20"
            title={a.occupation}>
            <span className="truncate">{a.occupation}</span>
          </span>
        )}
      </div>
    </button>
  );
}

// =====================================================================
//  AlumniHelp — "How to use" guide (same theme as ReportsHelp).
//  Editors get the manage guide; everyone else gets the view one.
// =====================================================================
const GUIDES = {
  manage: {
    title: 'Alumni',
    steps: [
      ['1 \u00b7 Who appears here', 'Every passed-out student. They land here automatically when promoted to \u201cAlumni (Passout)\u201d in the Promotion tab \u2014 you don\u2019t add them by hand.'],
      ['2 \u00b7 The cards', 'Each card shows the photo (or initials), name, passout year and final class, phone and email, current status and occupation. Click one to open the full profile.'],
      ['3 \u00b7 Update a profile', 'Open an alumnus to record where they are now \u2014 current status, occupation and up-to-date contact details.'],
      ['4 \u00b7 Find people', 'Pick a Year (passout years present in the data, or All Years) and search by name, email or phone.'],
      ['5 \u00b7 Download', 'Download (Excel) exports the selected Year \u2014 or All Years grouped by year \u2014 as a spreadsheet.'],
    ],
    note: 'The Year filter is the alumni record\u2019s year, not an academic year. Editing alumni profiles depends on your Alumni permissions.'
  },
  view: {
    title: 'Alumni',
    steps: [
      ['1 \u00b7 Browse alumni', 'Each card is a past student \u2014 photo or initials, passout year and final class, contact details, current status and occupation. Click one for the full profile.'],
      ['2 \u00b7 Find people', 'Pick a Year (or All Years) and search by name, email or phone.'],
      ['3 \u00b7 Download', 'Download (Excel) exports the selected Year (or All Years) as a spreadsheet.'],
    ],
    note: 'Alumni appear automatically when students are promoted to \u201cAlumni (Passout)\u201d. This is a read-only view \u2014 profile edits need the right permissions.'
  }
};

function AlumniHelp({ canEdit = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const content = canEdit ? GUIDES.manage : GUIDES.view;

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 self-start ${className}`}>
        <HelpCircle className="size-3.5" /> How to use
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
              <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X className="size-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              {content.steps.map(([t, d], i) => (
                <div key={i} className="rounded-md ring-1 ring-zinc-100 bg-zinc-50/60 p-3">
                  <p className="text-xs font-semibold text-zinc-800">{t}</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
                </div>
              ))}
              <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex gap-2">
                <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">{content.note}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}