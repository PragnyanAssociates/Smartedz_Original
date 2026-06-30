import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Download, Loader2, Info, AlertTriangle, ShieldAlert, CheckCircle2,
  CalendarRange, ChevronDown, Archive, FileSpreadsheet, Users as UsersIcon, RefreshCw, BookOpen, BarChart3
} from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

const SELECT_CLS = "h-9 rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none cursor-pointer transition-colors";

const fmtWhen = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// =====================================================================
//  YearSelect / ScopeSelect — shared little controls
// =====================================================================
function YearSelect({ years, value, onChange, w = "w-full sm:w-48" }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Academic year</label>
      <div className="relative">
        <select value={value} onChange={onChange} className={`${SELECT_CLS} ${w}`}>
          {years.length === 0 && <option value="">No years</option>}
          {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (active)' : ''}</option>)}
        </select>
        <CalendarRange className="size-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

function ScopeSelect({ classes, value, onChange, studentsOnly, noOther }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Download</label>
      <div className="relative">
        <select value={value} onChange={onChange} className={`${SELECT_CLS} w-full sm:w-56`}>
          {studentsOnly ? (
            <>
              <option value="all">All classes</option>
              {classes.map(c => (
                <option key={c.id} value={`class:${c.id}`}>
                  {c.className}{c.section ? ` ${c.section}` : ''}
                </option>
              ))}
            </>
          ) : (
            <>
              <option value="all">Everything (students + {noOther ? 'teachers' : 'staff'})</option>
              <option value="students">Students — All classes</option>
              {classes.map(c => (
                <option key={c.id} value={`class:${c.id}`}>
                  Students — {c.className}{c.section ? ` ${c.section}` : ''}
                </option>
              ))}
              <option value="teachers">Teachers</option>
              {!noOther && <option value="other">Other staff</option>}
            </>
          )}
        </select>
        <ChevronDown className="size-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

function StatusLine({ done, err, okText }) {
  return (
    <>
      {done && !err && (
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
          <CheckCircle2 className="size-4" /> {okText}
        </p>
      )}
      {err && (
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600">
          <AlertTriangle className="size-4" /> {err}
        </p>
      )}
    </>
  );
}

// =====================================================================
//  FinalArchivePanel — the tracked, keep-safe download for one module.
//
//   States it shows:
//     • never downloaded -> plain "Download Final Archive" button
//     • downloaded & current -> green tick + "Saved on <when>" and a
//       "Download again" checkbox (button stays locked until ticked, so
//       it isn't re-downloaded by accident)
//     • new data since -> amber "New data added — download again" and the
//       button is enabled straight away
// =====================================================================
function FinalArchivePanel({ status, statusLoading, busy, err, again, setAgain, onDownload, note }) {
  const downloaded = status?.downloaded;
  const stale = status?.stale;
  const fresh = downloaded && !stale;
  const when = fmtWhen(status?.downloadedAt);
  const canDownload = !busy && (!fresh || again);

  return (
    <div className="rounded-md ring-1 ring-inset ring-amber-500/25 bg-amber-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="size-7 rounded-md bg-amber-100 text-amber-700 ring-1 ring-amber-600/20 flex items-center justify-center shrink-0">
          <Archive className="size-3.5" />
        </span>
        <h6 className="text-xs font-semibold text-zinc-900">Final archive — keep-safe copy</h6>
      </div>

      <div className="text-[11px] text-amber-800 leading-relaxed space-y-1">{note}</div>

      {/* freshness status */}
      {statusLoading ? (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Loader2 className="size-3.5 animate-spin" /> Checking…
        </p>
      ) : fresh ? (
        <div className="flex flex-col gap-2">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="size-4" /> Final archive saved{when ? ` on ${when}` : ''}.
          </p>
          <label className="inline-flex items-center gap-2 cursor-pointer w-fit">
            <input type="checkbox" checked={again} onChange={e => setAgain(e.target.checked)}
              className="size-3.5 rounded border-zinc-300 text-primary focus:ring-2 focus:ring-primary/30" />
            <span className="text-[11px] text-zinc-600">I want to download it again</span>
          </label>
        </div>
      ) : stale ? (
        <p className="inline-flex items-start gap-1.5 text-[11px] font-semibold text-amber-700">
          <AlertTriangle className="size-4 shrink-0 mt-px" />
          New data has been added to this module since your last archive{when ? ` (${when})` : ''}. Please download it again so your saved copy stays current.
        </p>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Info className="size-3.5" /> Not saved yet for this year.
        </p>
      )}

      <button onClick={onDownload} disabled={!canDownload}
        className="h-9 px-4 rounded-md bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors disabled:cursor-not-allowed whitespace-nowrap">
        {busy ? <Loader2 className="size-4 animate-spin" /> : (stale ? <RefreshCw className="size-4" /> : <Archive className="size-4" />)}
        {busy ? 'Preparing…' : (stale ? 'Download again' : 'Download Final Archive (.xlsx)')}
      </button>

      {err && (
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600">
          <AlertTriangle className="size-4" /> {err}
        </p>
      )}
    </div>
  );
}

// =====================================================================
//  DownloadsTab
// =====================================================================
export default function DownloadsTab({ data, user }) {
  const years   = useMemo(() => data.academicYears || [], [data.academicYears]);
  const classes = useMemo(() => data.classes || [], [data.classes]);
  const activeYear = useMemo(() => years.find(y => y.isActive) || years[0] || null, [years]);
  const yearName = (id) => (years.find(y => String(y.id) === String(id))?.name) || '';

  const [tab, setTab] = useState('users');
  const subTabs = [
    { id: 'users',      label: 'Users',      icon: UsersIcon },
    { id: 'attendance', label: 'Attendance', icon: FileSpreadsheet },
    { id: 'marks',      label: 'Marks',      icon: BookOpen },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
  ];

  // per-year archive status cache: { [yearId]: { users:{...}, attendance:{...} } }
  const [statusByYear, setStatusByYear] = useState({});
  const [statusLoading, setStatusLoading] = useState(false);

  const loadStatus = useCallback(async (yearId) => {
    if (!yearId) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/archive-status/${user.institutionId}/${yearId}`);
      const json = await res.json().catch(() => ({}));
      // Only update when we actually got modules back. MERGE (never replace),
      // so an optimistic tick set by recordArchive isn't wiped by a partial
      // or failed refresh.
      if (res.ok && json && json.modules) {
        setStatusByYear(prev => ({
          ...prev,
          [yearId]: { ...(prev[yearId] || {}), ...json.modules }
        }));
      } else {
        console.error('archive-status: no modules in response', json);
      }
    } catch (e) { console.error('archive-status:', e); }
    finally { setStatusLoading(false); }
  }, [user]);

  // ---------- shared blob downloader --------------------------------
  const triggerBlob = async (url, fallbackName) => {
    const res = await fetch(url);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Download failed. Please try again.');
    }
    const blob = await res.blob();
    if (!blob || blob.size < 200) throw new Error('The file came back empty. Please try again.');
    let filename = fallbackName;
    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/);
    if (m) filename = m[1];
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = obj; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(obj);
  };

  const recordArchive = async (yearId, module) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/archive-record/${user.institutionId}/${yearId}/${module}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json && json.downloaded) {
        // Optimistically reflect the saved state for THIS module straight
        // away, using the server's authoritative response. This makes the
        // tick appear immediately, independent of the status recompute.
        setStatusByYear(prev => ({
          ...prev,
          [yearId]: {
            ...(prev[yearId] || {}),
            [module]: { downloaded: true, stale: false, downloadedAt: json.downloadedAt }
          }
        }));
      } else {
        console.error('archive-record failed:', res.status, json);
        throw new Error(json.error || `Could not record the archive (status ${res.status}).`);
      }
    } catch (e) {
      console.error('archive-record:', e);
      throw e;   // surface to the caller so the error line shows
    }
    // Refresh from server too (keeps stale-detection accurate); merge-only.
    await loadStatus(yearId);
  };

  // ================= USERS =================
  const [usrYear, setUsrYear]   = useState(activeYear ? String(activeYear.id) : '');
  const [usrScope, setUsrScope] = useState('all');
  const [usrBusy, setUsrBusy]   = useState(false);
  const [usrErr, setUsrErr]     = useState(null);
  const [usrDone, setUsrDone]   = useState(false);
  const [usrFinBusy, setUsrFinBusy] = useState(false);
  const [usrFinErr, setUsrFinErr]   = useState(null);
  const [usrAgain, setUsrAgain]     = useState(false);

  const downloadUsers = async () => {
    if (!usrYear) { setUsrErr('Choose an academic year first.'); return; }
    setUsrBusy(true); setUsrErr(null); setUsrDone(false);
    try {
      await triggerBlob(`${API_BASE_URL}/admin/users-export/${user.institutionId}?yearId=${usrYear}&scope=${encodeURIComponent(usrScope)}`,
        `Users_${yearName(usrYear) || 'year'}.xlsx`);
      setUsrDone(true);
    } catch (e) { setUsrErr(e.message); } finally { setUsrBusy(false); }
  };

  const downloadUsersFinal = async () => {
    if (!usrYear) { setUsrFinErr('Choose an academic year first.'); return; }
    setUsrFinBusy(true); setUsrFinErr(null);
    try {
      await triggerBlob(`${API_BASE_URL}/admin/users-export/${user.institutionId}?yearId=${usrYear}&scope=all`,
        `Users_Final_${yearName(usrYear) || 'year'}.xlsx`);
      await recordArchive(usrYear, 'users');
      setUsrAgain(false);
    } catch (e) { setUsrFinErr(e.message); } finally { setUsrFinBusy(false); }
  };

  // ================= ATTENDANCE =================
  const [attYear, setAttYear]   = useState(activeYear ? String(activeYear.id) : '');
  const [attScope, setAttScope] = useState('all');
  const [attBusy, setAttBusy]   = useState(false);
  const [attErr, setAttErr]     = useState(null);
  const [attDone, setAttDone]   = useState(false);
  const [attFinBusy, setAttFinBusy] = useState(false);
  const [attFinErr, setAttFinErr]   = useState(null);
  const [attAgain, setAttAgain]     = useState(false);

  const downloadAttendance = async () => {
    if (!attYear) { setAttErr('Choose an academic year first.'); return; }
    setAttBusy(true); setAttErr(null); setAttDone(false);
    try {
      await triggerBlob(`${API_BASE_URL}/admin/attendance-export/${user.institutionId}?yearId=${attYear}&scope=${encodeURIComponent(attScope)}`,
        `Attendance_${yearName(attYear) || 'year'}.xlsx`);
      setAttDone(true);
    } catch (e) { setAttErr(e.message); } finally { setAttBusy(false); }
  };

  const downloadAttendanceFinal = async () => {
    if (!attYear) { setAttFinErr('Choose an academic year first.'); return; }
    setAttFinBusy(true); setAttFinErr(null);
    try {
      await triggerBlob(`${API_BASE_URL}/admin/attendance-export/${user.institutionId}?yearId=${attYear}&scope=all`,
        `Attendance_Final_${yearName(attYear) || 'year'}.xlsx`);
      await recordArchive(attYear, 'attendance');
      setAttAgain(false);
    } catch (e) { setAttFinErr(e.message); } finally { setAttFinBusy(false); }
  };

  // ================= MARKS =================
  const [mkYear, setMkYear]   = useState(activeYear ? String(activeYear.id) : '');
  const [mkScope, setMkScope] = useState('all');
  const [mkBusy, setMkBusy]   = useState(false);
  const [mkErr, setMkErr]     = useState(null);
  const [mkDone, setMkDone]   = useState(false);
  const [mkFinBusy, setMkFinBusy] = useState(false);
  const [mkFinErr, setMkFinErr]   = useState(null);
  const [mkAgain, setMkAgain]     = useState(false);

  const downloadMarks = async () => {
    if (!mkYear) { setMkErr('Choose an academic year first.'); return; }
    setMkBusy(true); setMkErr(null); setMkDone(false);
    try {
      await triggerBlob(`${API_BASE_URL}/admin/marks-export/${user.institutionId}?yearId=${mkYear}&scope=${encodeURIComponent(mkScope)}`,
        `Marks_${yearName(mkYear) || 'year'}.xlsx`);
      setMkDone(true);
    } catch (e) { setMkErr(e.message); } finally { setMkBusy(false); }
  };

  const downloadMarksFinal = async () => {
    if (!mkYear) { setMkFinErr('Choose an academic year first.'); return; }
    setMkFinBusy(true); setMkFinErr(null);
    try {
      await triggerBlob(`${API_BASE_URL}/admin/marks-export/${user.institutionId}?yearId=${mkYear}&scope=all`,
        `Marks_Final_${yearName(mkYear) || 'year'}.xlsx`);
      await recordArchive(mkYear, 'marks');
      setMkAgain(false);
    } catch (e) { setMkFinErr(e.message); } finally { setMkFinBusy(false); }
  };

  // ================= PERFORMANCE =================
  const [pfYear, setPfYear]   = useState(activeYear ? String(activeYear.id) : '');
  const [pfScope, setPfScope] = useState('all');
  const [pfBusy, setPfBusy]   = useState(false);
  const [pfErr, setPfErr]     = useState(null);
  const [pfDone, setPfDone]   = useState(false);
  const [pfFinBusy, setPfFinBusy] = useState(false);
  const [pfFinErr, setPfFinErr]   = useState(null);
  const [pfAgain, setPfAgain]     = useState(false);

  const downloadPerformance = async () => {
    if (!pfYear) { setPfErr('Choose an academic year first.'); return; }
    setPfBusy(true); setPfErr(null); setPfDone(false);
    try {
      await triggerBlob(`${API_BASE_URL}/admin/performance-export/${user.institutionId}?yearId=${pfYear}&scope=${encodeURIComponent(pfScope)}`,
        `Performance_${yearName(pfYear) || 'year'}.xlsx`);
      setPfDone(true);
    } catch (e) { setPfErr(e.message); } finally { setPfBusy(false); }
  };

  const downloadPerformanceFinal = async () => {
    if (!pfYear) { setPfFinErr('Choose an academic year first.'); return; }
    setPfFinBusy(true); setPfFinErr(null);
    try {
      await triggerBlob(`${API_BASE_URL}/admin/performance-export/${user.institutionId}?yearId=${pfYear}&scope=all`,
        `Performance_Final_${yearName(pfYear) || 'year'}.xlsx`);
      await recordArchive(pfYear, 'performance');
      setPfAgain(false);
    } catch (e) { setPfFinErr(e.message); } finally { setPfFinBusy(false); }
  };

  // load status for whichever year each module currently points at
  useEffect(() => { if (usrYear) loadStatus(usrYear); }, [usrYear, loadStatus]);
  useEffect(() => { if (attYear) loadStatus(attYear); }, [attYear, loadStatus]);
  useEffect(() => { if (mkYear) loadStatus(mkYear); }, [mkYear, loadStatus]);
  useEffect(() => { if (pfYear) loadStatus(pfYear); }, [pfYear, loadStatus]);

  const usrStatus = statusByYear[usrYear]?.users;
  const attStatus = statusByYear[attYear]?.attendance;
  const mkStatus  = statusByYear[mkYear]?.marks;
  const pfStatus  = statusByYear[pfYear]?.performance;

  return (
    <div className="space-y-5">

      {/* intro */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Downloads</h3>
        <p className="text-[11px] text-zinc-500 max-w-2xl mt-1 leading-relaxed">
          Export your school&rsquo;s records as Excel (.xlsx) files. Pick a section below. Each section has a
          <strong> normal download</strong> (take any time, filter by class / staff) and a <strong>final archive</strong> —
          the complete keep-safe copy you take before deleting a year. Read the note on each before you download.
        </p>
      </div>

      {/* section sub-tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3">
        {subTabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                active ? 'bg-primary text-white' : 'text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
              }`}>
              <Icon className="size-3.5 shrink-0" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ============================ USERS =========================== */}
      {tab === 'users' && (
        <div className="bg-white rounded-lg ring-1 ring-black/5 p-5 space-y-5 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 flex items-center justify-center shrink-0">
              <UsersIcon className="size-4" />
            </span>
            <div>
              <h5 className="text-sm font-semibold text-zinc-900">Users directory</h5>
              <p className="text-[11px] text-zinc-500">Every student, teacher &amp; staff member with full details.</p>
            </div>
          </div>

          <YearSelect years={years} value={usrYear}
            onChange={e => { setUsrYear(e.target.value); setUsrDone(false); setUsrAgain(false); }} />

          {/* normal */}
          <div className="space-y-3 border-t border-zinc-100 pt-4">
            <h6 className="text-xs font-semibold text-zinc-900">Normal download</h6>
            <div className="rounded-md ring-1 ring-inset ring-blue-500/15 bg-blue-50/60 px-4 py-3 flex items-start gap-2.5">
              <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-blue-800 leading-relaxed space-y-1">
                <p>The complete directory in one sheet — <strong>Students</strong> class-wise &amp; roll-wise, then <strong>Teachers</strong>, then <strong>Other staff</strong>, with every field from the Users tab (roll, admission no, Aadhaar, phone, address, class, parent, salaries, subjects, …).</p>
                <p><span className="font-semibold">Filter:</span> download everyone, a single class, only Teachers, or only Other staff. Read-only — take it any time. Alumni are not included.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <ScopeSelect classes={classes} value={usrScope} onChange={e => { setUsrScope(e.target.value); setUsrDone(false); }} />
              <button onClick={downloadUsers} disabled={usrBusy || !usrYear}
                className="h-9 px-4 rounded-md bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors disabled:cursor-not-allowed whitespace-nowrap">
                {usrBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {usrBusy ? 'Preparing…' : 'Download .xlsx'}
              </button>
            </div>
            <StatusLine done={usrDone} err={usrErr} okText="Downloaded. Check your browser's downloads folder." />
          </div>

          {/* final */}
          <div className="border-t border-zinc-100 pt-4">
            <FinalArchivePanel
              status={usrStatus} statusLoading={statusLoading && !usrStatus}
              busy={usrFinBusy} err={usrFinErr} again={usrAgain} setAgain={setUsrAgain}
              onDownload={downloadUsersFinal}
              note={<>
                <p>The <strong>whole Users directory</strong> for this year in one file (no filter — everyone). This is your keep-safe copy to store and print before deleting the year.</p>
                <p>Once saved it&rsquo;s ticked. If you later <strong>add or change any user</strong>, the tick clears and it asks you to download again, so your saved copy is never out of date.</p>
              </>}
            />
          </div>
        </div>
      )}

      {/* ========================= ATTENDANCE ======================== */}
      {tab === 'attendance' && (
        <div className="bg-white rounded-lg ring-1 ring-black/5 p-5 space-y-5 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/20 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="size-4" />
            </span>
            <div>
              <h5 className="text-sm font-semibold text-zinc-900">Attendance register</h5>
              <p className="text-[11px] text-zinc-500">Class-wise &amp; staff attendance for one academic year.</p>
            </div>
          </div>

          <YearSelect years={years} value={attYear}
            onChange={e => { setAttYear(e.target.value); setAttDone(false); setAttAgain(false); }} />

          {/* normal */}
          <div className="space-y-3 border-t border-zinc-100 pt-4">
            <h6 className="text-xs font-semibold text-zinc-900">Normal download</h6>
            <div className="rounded-md ring-1 ring-inset ring-blue-500/15 bg-blue-50/60 px-4 py-3 flex items-start gap-2.5">
              <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-blue-800 leading-relaxed space-y-1">
                <p>A register sheet — Students class-wise &amp; roll-wise, then Teachers, then Other staff. Each month column is <strong>present days / total days marked</strong>; the last column is the yearly <strong>%</strong> (green ≥ 80, blue 50–80, red &lt; 50).</p>
                <p><span className="font-semibold">Filter:</span> everything, a single class, only Teachers, or only Other staff. Read-only — take it any time.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <ScopeSelect classes={classes} value={attScope} onChange={e => { setAttScope(e.target.value); setAttDone(false); }} />
              <button onClick={downloadAttendance} disabled={attBusy || !attYear}
                className="h-9 px-4 rounded-md bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors disabled:cursor-not-allowed whitespace-nowrap">
                {attBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {attBusy ? 'Preparing…' : 'Download .xlsx'}
              </button>
            </div>
            <StatusLine done={attDone} err={attErr} okText="Downloaded. Check your browser's downloads folder." />
          </div>

          {/* final */}
          <div className="border-t border-zinc-100 pt-4">
            <FinalArchivePanel
              status={attStatus} statusLoading={statusLoading && !attStatus}
              busy={attFinBusy} err={attFinErr} again={attAgain} setAgain={setAttAgain}
              onDownload={downloadAttendanceFinal}
              note={<>
                <p>The <strong>whole attendance register</strong> for this year in one file (everyone — students, teachers, other staff). This is your keep-safe copy to store and print before deleting the year.</p>
                <p>Once saved it&rsquo;s ticked. If <strong>any new attendance is marked or edited</strong> afterwards, the tick clears and it asks you to download again, so your saved copy is never out of date.</p>
              </>}
            />
          </div>
        </div>
      )}

      {/* ============================ MARKS =========================== */}
      {tab === 'marks' && (
        <div className="bg-white rounded-lg ring-1 ring-black/5 p-5 space-y-5 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-md bg-violet-50 text-violet-600 ring-1 ring-violet-600/20 flex items-center justify-center shrink-0">
              <BookOpen className="size-4" />
            </span>
            <div>
              <h5 className="text-sm font-semibold text-zinc-900">Marks register</h5>
              <p className="text-[11px] text-zinc-500">Exam marks, class-wise &amp; roll-wise, for one academic year.</p>
            </div>
          </div>

          <YearSelect years={years} value={mkYear}
            onChange={e => { setMkYear(e.target.value); setMkDone(false); setMkAgain(false); }} />

          {/* normal */}
          <div className="space-y-3 border-t border-zinc-100 pt-4">
            <h6 className="text-xs font-semibold text-zinc-900">Normal download</h6>
            <div className="rounded-md ring-1 ring-inset ring-blue-500/15 bg-blue-50/60 px-4 py-3 flex items-start gap-2.5">
              <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-blue-800 leading-relaxed space-y-1">
                <p>A marks register grouped by <strong>class</strong>, students <strong>roll-wise</strong>. Subjects run across the columns; each <strong>exam type</strong> is a row under the student, and every cell is <strong>marks obtained / max</strong> (e.g. <code className="bg-white/70 px-1 rounded">18/20</code>).</p>
                <p>Each student ends with a bold <strong>Overall</strong> row and a colour-coded <strong>%</strong> (green ≥ 80, blue 50–80, red &lt; 50).</p>
                <p><span className="font-semibold">Filter:</span> all classes at once, or a single class. Read-only — take it any time. Alumni are not included.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <ScopeSelect classes={classes} studentsOnly value={mkScope} onChange={e => { setMkScope(e.target.value); setMkDone(false); }} />
              <button onClick={downloadMarks} disabled={mkBusy || !mkYear}
                className="h-9 px-4 rounded-md bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors disabled:cursor-not-allowed whitespace-nowrap">
                {mkBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {mkBusy ? 'Preparing…' : 'Download .xlsx'}
              </button>
            </div>
            <StatusLine done={mkDone} err={mkErr} okText="Downloaded. Check your browser's downloads folder." />
          </div>

          {/* final */}
          <div className="border-t border-zinc-100 pt-4">
            <FinalArchivePanel
              status={mkStatus} statusLoading={statusLoading && !mkStatus}
              busy={mkFinBusy} err={mkFinErr} again={mkAgain} setAgain={setMkAgain}
              onDownload={downloadMarksFinal}
              note={<>
                <p>The <strong>whole marks register</strong> for this year in one file (every class). This is your keep-safe copy to store and print before deleting the year.</p>
                <p>Once saved it&rsquo;s ticked. If <strong>any marks are entered or changed</strong> afterwards, the tick clears and it asks you to download again, so your saved copy is never out of date.</p>
              </>}
            />
          </div>
        </div>
      )}

      {/* ========================= PERFORMANCE ======================= */}
      {tab === 'performance' && (
        <div className="bg-white rounded-lg ring-1 ring-black/5 p-5 space-y-5 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-md bg-amber-50 text-amber-600 ring-1 ring-amber-600/20 flex items-center justify-center shrink-0">
              <BarChart3 className="size-4" />
            </span>
            <div>
              <h5 className="text-sm font-semibold text-zinc-900">Performance</h5>
              <p className="text-[11px] text-zinc-500">Student &amp; teacher performance percentages for one academic year.</p>
            </div>
          </div>

          <YearSelect years={years} value={pfYear}
            onChange={e => { setPfYear(e.target.value); setPfDone(false); setPfAgain(false); }} />

          {/* normal */}
          <div className="space-y-3 border-t border-zinc-100 pt-4">
            <h6 className="text-xs font-semibold text-zinc-900">Normal download</h6>
            <div className="rounded-md ring-1 ring-inset ring-blue-500/15 bg-blue-50/60 px-4 py-3 flex items-start gap-2.5">
              <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-blue-800 leading-relaxed space-y-1">
                <p>Same shape as the Marks register, but every cell is a <strong>%</strong>. <strong>Students</strong> — per class, roll-wise, each <strong>exam type</strong> a row, a % per <strong>subject</strong> across the columns, an <strong>Overall %</strong> column and a bold Overall row.</p>
                <p><strong>Teachers</strong> — one row per class &amp; subject with an exam-wise % in each column and a bold Overall row. Every % is <strong>marks obtained / possible</strong>, colour-coded (green ≥ 80, blue 50–80, red &lt; 50).</p>
                <p><span className="font-semibold">Filter:</span> everything, a single class, or only Teachers. Read-only — take it any time. Alumni are not included.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <ScopeSelect classes={classes} noOther value={pfScope} onChange={e => { setPfScope(e.target.value); setPfDone(false); }} />
              <button onClick={downloadPerformance} disabled={pfBusy || !pfYear}
                className="h-9 px-4 rounded-md bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors disabled:cursor-not-allowed whitespace-nowrap">
                {pfBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {pfBusy ? 'Preparing…' : 'Download .xlsx'}
              </button>
            </div>
            <StatusLine done={pfDone} err={pfErr} okText="Downloaded. Check your browser's downloads folder." />
          </div>

          {/* final */}
          <div className="border-t border-zinc-100 pt-4">
            <FinalArchivePanel
              status={pfStatus} statusLoading={statusLoading && !pfStatus}
              busy={pfFinBusy} err={pfFinErr} again={pfAgain} setAgain={setPfAgain}
              onDownload={downloadPerformanceFinal}
              note={<>
                <p>The <strong>whole performance report</strong> for this year in one file (all students &amp; all teachers). This is your keep-safe copy to store and print before deleting the year.</p>
                <p>Performance is built from marks, so if <strong>any marks change</strong> afterwards the tick clears and it asks you to download again — keeping your saved copy current.</p>
              </>}
            />
          </div>
        </div>
      )}

    </div>
  );
}