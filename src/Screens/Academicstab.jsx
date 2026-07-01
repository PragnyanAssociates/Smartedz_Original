import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, X, Calendar, CheckCircle2, Circle, AlertTriangle, Clock, Info, Download, Loader2, ShieldAlert } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

// --- Date helpers ----------------------------------------------------
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

// DD/MM/YYYY
const fmtDMY = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '—';
  const dd = String(x.getDate()).padStart(2, '0');
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${x.getFullYear()}`;
};

// "Jun 2026" style for the card range
const fmtMonth = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—';

// Status of a year relative to today. The SAME logic the backend uses,
// so banners here match notifications/dashboard later.
const yearStatus = (y) => {
  const MS = 24 * 60 * 60 * 1000;
  const today = startOfDay(new Date());
  const end = y.endDate ? startOfDay(y.endDate) : null;
  const start = y.startDate ? startOfDay(y.startDate) : null;

  let daysLeft = null, expired = false, daysSinceEnd = 0, notStarted = false;
  if (end && !isNaN(end.getTime())) {
    daysLeft = Math.ceil((end - today) / MS);
    expired = daysLeft < 0;
    if (expired) daysSinceEnd = Math.abs(daysLeft);
  }
  if (start && !isNaN(start.getTime()) && today < start) notStarted = true;
  return { daysLeft, expired, daysSinceEnd, notStarted };
};

export default function AcademicsTab({ data, fetchData, user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing]         = useState(null);
  const [deletingYear, setDeletingYear] = useState(null);   // year object pending deletion
  const emptyForm = { name: '', startDate: '', endDate: '' };
  const [form, setForm] = useState(emptyForm);

  // The active year + its status drive the warning banner.
  const activeYear = useMemo(
    () => (data.academicYears || []).find(y => y.isActive) || null,
    [data.academicYears]
  );
  const activeStatus = useMemo(
    () => (activeYear ? yearStatus(activeYear) : null),
    [activeYear]
  );

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (y) => {
    setEditing(y);
    setForm({
      name: y.name || '',
      startDate: y.startDate ? y.startDate.slice(0, 10) : '',
      endDate:   y.endDate   ? y.endDate.slice(0, 10)   : ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic client-side guard: end must be after start
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
      return alert('End date must be after the start date.');
    }
    const url = editing
      ? `${API_BASE_URL}/admin/academics/${editing.id}`
      : `${API_BASE_URL}/admin/academics`;
    const res = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, institutionId: user.institutionId })
    });
    if (res.ok) {
      setIsModalOpen(false);
      fetchData();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to save academic year.');
    }
  };

  const handleSetActive = async (y) => {
    const res = await fetch(`${API_BASE_URL}/admin/academics/set-active/${y.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ institutionId: user.institutionId })
    });
    if (res.ok) fetchData();
  };

  // Deleting is no longer a one-click action: it opens a guarded modal that
  // makes the user download the year's archive first, then explicitly
  // acknowledge, before the permanent delete is allowed.
  const openDelete = (y) => {
    if (y.isActive) return alert('Set another year active before deleting this one.');
    setDeletingYear(y);
  };

  return (
    <div className="space-y-6">

      {/* Header - Fixed Mobile Flex and Button Width */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-start mb-6">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">Academic Years</h3>
          <p className="text-[11px] text-zinc-500 max-w-2xl mt-1">
            One year is always <strong>active</strong>; modules like Attendance and Marks / Reports anchor to whichever is currently flagged.
          </p>
        </div>
        <button onClick={openAdd}
          className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-sm shrink-0 w-fit self-start sm:self-auto">
          <Plus className="size-3.5 shrink-0" /> Add Year
        </button>
      </div>

      {/* ---- How the active year affects your data (always shown) -----
           Explains that data (attendance, marks…) is anchored to the active
           year, that switching is non-destructive, and that deleting a year
           wipes its data permanently. */}
      <div className="rounded-lg ring-1 ring-inset ring-blue-500/15 bg-blue-50/60 px-4 py-3 flex items-start gap-3">
        <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-800 leading-relaxed">
          <span className="font-semibold">Note — how academic years work:</span> The year-linked modules (<strong>Attendance,Timetable, Performance</strong> and <strong>Marks / Reports</strong>) always run on the <strong>active</strong> academic year.
          When you switch the active year, those screens start <strong>empty</strong> for the new year. If you switch back to a previous year, its earlier data reappears exactly as you left it — nothing is lost by simply changing the active year.
          <span className="block mt-1 font-semibold text-red-700">However, if you DELETE an academic year, every record linked to it (Attendance,Timetable,Reports and Performance) is gone forever and cannot be recovered.</span>
          <span className="block mt-1">So if you want to delete a whole academic year, first download the files linked to that year to keep your data safe as copy, for that use <strong>Downloads</strong> tab. Once downloaded, that data stays safe in the downloaded file or in your local file even after the academic year is deleted.</span>
        </div>
      </div>

      {/* ---- Active-year warning banner -------------------------------
           Red    = no active year, or active year already ended
           Amber  = active year ends within 30 days
           (Nothing shown when the active year is comfortably in range.) */}
      {!activeYear ? (
        <div className="rounded-lg ring-1 ring-inset ring-red-500/20 bg-red-50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-700 leading-relaxed">
            <span className="font-semibold">No academic year is currently active.</span> Set one active so new records are saved to the right year.
          </div>
        </div>
      ) : activeStatus?.expired ? (
        <div className="rounded-lg ring-1 ring-inset ring-red-500/20 bg-red-50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-700 leading-relaxed">
            <span className="font-semibold">"{activeYear.name}" ended {activeStatus.daysSinceEnd} day{activeStatus.daysSinceEnd !== 1 ? 's' : ''} ago</span> (on {fmtDMY(activeYear.endDate)}).
            It is still the active year. Please set the next academic year as active to keep new data in the correct year.
          </div>
        </div>
      ) : (activeStatus?.daysLeft != null && activeStatus.daysLeft <= 30) ? (
        <div className="rounded-lg ring-1 ring-inset ring-amber-500/20 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <Clock className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 leading-relaxed">
            <span className="font-semibold">"{activeYear.name}" ends in {activeStatus.daysLeft} day{activeStatus.daysLeft !== 1 ? 's' : ''}</span> (on {fmtDMY(activeYear.endDate)}).
            Create and set the next academic year active before it ends.
          </div>
        </div>
      ) : null}

      {/* Cards Grid - Progressive Breakpoints */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.academicYears.map(y => {
          const st = yearStatus(y);
          return (
            <div key={y.id} className={`group relative bg-white rounded-lg p-5 transition-all flex flex-col ${
              y.isActive
                ? (st.expired ? 'ring-2 ring-red-500/30 bg-red-50/30' : 'ring-2 ring-green-500/20 bg-green-50/30')
                : 'ring-1 ring-black/5 hover:ring-zinc-200 hover:shadow-sm'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`size-10 rounded-md flex items-center justify-center shrink-0 ${
                  y.isActive
                    ? (st.expired ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600')
                    : 'bg-zinc-50 text-zinc-500 ring-1 ring-black/5'
                }`}>
                  <Calendar className="size-4" />
                </div>

                {/* Actions — visible on touch screens, hover on desktop */}
                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(y)} className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors" title="Edit">
                    <Edit className="size-4 shrink-0" />
                  </button>
                  <button onClick={() => openDelete(y)} className="p-1.5 rounded text-zinc-400 hover:text-accent hover:bg-accent/10 transition-colors" title="Delete">
                    <Trash2 className="size-4 shrink-0" />
                  </button>
                </div>
              </div>

              <h4 className="text-sm font-semibold text-zinc-900 leading-tight">{y.name}</h4>
              <p className="text-[10px] font-medium text-zinc-500 mt-1 uppercase tracking-wider whitespace-nowrap">
                {fmtMonth(y.startDate)} &mdash; {fmtMonth(y.endDate)}
              </p>

              {/* Footer Row */}
              <div className="mt-5 pt-4 border-t border-zinc-100/60 flex items-center justify-between gap-2">
                {y.isActive ? (
                  st.expired ? (
                    <span className="inline-flex items-center gap-1.5 text-red-600 font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">
                      <AlertTriangle className="size-3.5" /> Ended {st.daysSinceEnd}d ago
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">
                      <CheckCircle2 className="size-3.5" /> Active
                      {st.daysLeft != null && <span className="text-green-600/80 normal-case font-medium">· {st.daysLeft}d left</span>}
                    </span>
                  )
                ) : (
                  <button onClick={() => handleSetActive(y)}
                    className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-primary font-semibold text-[10px] uppercase tracking-wider transition-colors whitespace-nowrap">
                    <Circle className="size-3.5" /> Set as Active
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {data.academicYears.length === 0 && (
          <div className="col-span-full bg-white p-8 rounded-lg ring-1 ring-black/5 border-dashed text-center">
            <p className="text-xs text-zinc-500 italic">No academic years yet. Create one to get started.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-sm p-6 shadow-xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors">
              <X className="size-5 shrink-0" />
            </button>

            <div className="mb-5">
              <h2 className="text-lg font-semibold text-zinc-900 mb-1">
                {editing ? 'Edit Academic Year' : 'Create Academic Year'}
              </h2>
              <p className="text-[11px] text-zinc-500">
                Pick the start and end dates (e.g. June 2026 - April 2027).
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1.5 block">
                  Name <span className="text-accent">*</span>
                </label>
                <input required placeholder="e.g. 2026 - 2027"
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-600 mb-1.5 block">Start Date <span className="text-accent">*</span></label>
                  <input type="date" required
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                    value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 mb-1.5 block">End Date <span className="text-accent">*</span></label>
                  <input type="date" required
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                    value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-zinc-700 px-4 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="bg-primary text-white px-6 py-2 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                  {editing ? 'Save Changes' : 'Create Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guarded delete flow */}
      {deletingYear && (
        <DeleteYearModal
          year={deletingYear}
          instId={user.institutionId}
          onClose={() => setDeletingYear(null)}
          onDeleted={() => { setDeletingYear(null); fetchData(); }}
        />
      )}
    </div>
  );
}

// =====================================================================
//  DeleteYearModal — the two-step guarded deletion.
//    Step 1: download the year's archive (.xlsx). Delete stays locked
//            until the file has actually downloaded in this session.
//    Step 2: tick the acknowledgement.
//  Only with BOTH done does the permanent delete arm.
// =====================================================================
function DeleteYearModal({ year, instId, onClose, onDeleted }) {
  const [downloaded, setDownloaded]     = useState(false);
  const [downloading, setDownloading]   = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [error, setError]               = useState(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/year-export/${instId}/${year.id}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Download failed. Please try again.');
      }
      const blob = await res.blob();
      if (!blob || blob.size < 200) throw new Error('The archive came back empty. Please try again.');

      let filename = `${year.name || 'year'}.xlsx`;
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      if (m) filename = m[1];

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setDownloaded(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!downloaded || !acknowledged) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/academics/${year.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete the academic year.');
      }
      onDeleted();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  };

  const canDelete = downloaded && acknowledged && !deleting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-md bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <Trash2 className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Delete &ldquo;{year.name}&rdquo;</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">This permanently removes the year&rsquo;s data.</p>
            </div>
          </div>
          <button onClick={onClose} disabled={deleting} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1 disabled:opacity-50">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Warning */}
          <div className="rounded-md bg-red-50 ring-1 ring-inset ring-red-500/20 px-4 py-3 flex items-start gap-2.5">
            <ShieldAlert className="size-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 leading-relaxed">
              Deleting <strong>{year.name}</strong> permanently erases its <strong>Attendance</strong> and <strong>Marks / Report-card</strong> records to free storage.
              <strong> This cannot be undone</strong>, and the data will not come back from this app. Download the archive first and keep a printed copy in your school records.
            </p>
          </div>

          {/* Step 1 — download */}
          <div className="rounded-md ring-1 ring-black/5 p-4">
            <div className="flex items-start gap-2.5">
              <span className={`size-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${downloaded ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>1</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-zinc-800">Download the year archive</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Students, Staff, Attendance and class-wise Marks in one Excel file.</p>

                <div className="mt-3">
                  {downloaded ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="size-4" /> Archive downloaded
                      </span>
                      <button onClick={handleDownload} disabled={downloading}
                        className="text-[11px] font-semibold text-zinc-500 hover:text-primary underline underline-offset-2 disabled:opacity-50">
                        Download again
                      </button>
                    </div>
                  ) : (
                    <button onClick={handleDownload} disabled={downloading}
                      className="h-9 px-4 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors">
                      {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                      {downloading ? 'Preparing…' : `Download ${year.name} (.xlsx)`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 — acknowledge (locked until downloaded) */}
          <div className={`rounded-md ring-1 ring-black/5 p-4 transition-opacity ${downloaded ? '' : 'opacity-50 pointer-events-none'}`}>
            <div className="flex items-start gap-2.5">
              <span className={`size-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${acknowledged ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>2</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-zinc-800">Confirm you&rsquo;ve saved it</p>
                <label className="flex items-start gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={acknowledged} disabled={!downloaded}
                    onChange={e => setAcknowledged(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-zinc-300 text-primary focus:ring-2 focus:ring-primary/30" />
                  <span className="text-[11px] text-zinc-600 leading-relaxed">
                    I have downloaded, saved and printed this data, and I understand the academic year&rsquo;s attendance and marks will be <strong>permanently deleted</strong> and cannot be recovered from the app.
                  </span>
                </label>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 ring-1 ring-inset ring-red-500/20 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-px" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-zinc-100">
          <button onClick={onClose} disabled={deleting}
            className="text-zinc-700 px-4 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={!canDelete}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-md text-xs font-semibold inline-flex items-center gap-2 transition-colors disabled:cursor-not-allowed">
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {deleting ? 'Deleting…' : 'Delete Year Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}