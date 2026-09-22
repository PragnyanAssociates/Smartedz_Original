import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import {
  BookOpen, Library as LibraryIcon, Globe, Plus, Edit, Trash2, X, Loader2, Search,
  Download, Eye, Upload, FileText, RefreshCw, ChevronDown, Save, User,
  ArrowLeftRight, CheckCircle2, AlertTriangle, HelpCircle, ShieldCheck, ArrowLeft,
  Image as ImageIcon, Tag, Users, Clock, Calendar
} from 'lucide-react';

// ---- helpers --------------------------------------------------------
const asUtcIso = (v) => {
  if (!v) return null;
  const s = String(v).replace(' ', 'T');
  return /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z';
};
const fmtWhen = (v) => {
  const iso = asUtcIso(v);
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
};
const istDate = (v) => {
  const iso = asUtcIso(v);
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD (IST)
};
const fmtDMY = (v) => {
  if (!v) return '-';
  const d = new Date(String(v).length <= 10 ? v + 'T00:00:00' : v);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const isOverdue = (row) => row.status === 'issued' && row.due_date && row.due_date < todayISO();

const fileToDataUrl = (file, maxMB) => new Promise((resolve, reject) => {
  if (file.size > maxMB * 1024 * 1024) { reject(new Error(`"${file.name}" is over ${maxMB} MB.`)); return; }
  const r = new FileReader();
  r.onloadend = () => resolve({ name: file.name, data: r.result });
  r.onerror = () => reject(new Error(`Could not read "${file.name}".`));
  r.readAsDataURL(file);
});

// Fetches a book's cover as a blob (token via fetch interceptor) and shows it.
function CoverThumb({ src, hasCover, className }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    setUrl(null);                       // drop the old image while the new one loads
    if (!hasCover || !src) return;
    let cancelled = false, obj = null;
    fetch(src)
      .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
      .then(b => { if (cancelled) return; obj = URL.createObjectURL(b); setUrl(obj); })
      .catch(() => {});
    return () => { cancelled = true; if (obj) URL.revokeObjectURL(obj); };
  }, [src, hasCover]);
  // object-contain -> the whole cover fits, never cropped, whatever its size.
  if (url) return <img src={url} alt="cover" className={`${className} object-contain`} />;
  return <div className={`${className} flex items-center justify-center bg-zinc-100`}><FileText className="size-8 text-primary/50" /></div>;
}

// =====================================================================
//  Library — Online (book PDFs) + Offline (physical issue/return)
// =====================================================================
export default function Library() {
  const { user } = useAuth();
  const { can, isSuperAdmin } = usePermissions();
  const canEdit = can('Library', 'edit');
  const [tab, setTab] = useState('online');

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <LibraryIcon className="text-primary size-5" /> Library
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[60ch]">
            Read book PDFs online, and manage the physical library — issues and returns.
          </p>
        </div>
        <LibraryHelp isSuperAdmin={isSuperAdmin} canEdit={canEdit} />
      </header>

      <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 overflow-x-auto custom-scrollbar">
        {[['online', 'Online Library', Globe], ['offline', 'Offline Library', LibraryIcon]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              tab === id ? 'bg-primary text-white shadow-sm' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
            }`}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'online'
        ? <OnlineLibrary user={user} isSuperAdmin={isSuperAdmin} />
        : <OfflineLibrary user={user} canEdit={canEdit} />}
    </div>
  );
}

// =====================================================================
//  ONLINE LIBRARY
// =====================================================================
function OnlineLibrary({ user, isSuperAdmin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [fAuthor, setFAuthor] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/library/online/${user.institutionId}`);
      const d = await res.json();
      setRows(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const numbered = useMemo(() => rows.map((r, i) => ({ ...r, _num: i + 1 })), [rows]);
  const authors = useMemo(() => [...new Set(rows.map(r => (r.author || '').trim()).filter(Boolean))].sort(), [rows]);
  const categories = useMemo(() => [...new Set(rows.map(r => (r.category || '').trim()).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return numbered.filter(r => {
      if (q && ![r.title, r.author, r.category].some(v => (v || '').toLowerCase().includes(q))) return false;
      if (fAuthor && (r.author || '') !== fAuthor) return false;
      if (fCategory && (r.category || '') !== fCategory) return false;
      const day = istDate(r.created_at);
      if (fFrom && day && day < fFrom) return false;
      if (fTo && day && day > fTo) return false;
      return true;
    });
  }, [numbered, query, fAuthor, fCategory, fFrom, fTo]);

  const stats = useMemo(() => ({ total: rows.length, authors: authors.length, categories: categories.length }), [rows, authors, categories]);
  const selectedBook = useMemo(() => numbered.find(b => b.id === selected) || null, [numbered, selected]);
  const anyFilter = query || fAuthor || fCategory || fFrom || fTo;

  return (
    <>
      {selectedBook ? (
        <OnlineBookDetail book={selectedBook} isSuperAdmin={isSuperAdmin}
          onBack={() => setSelected(null)} onEdit={() => setModal({ editing: selectedBook })}
          onDeleted={() => { setSelected(null); load(); }} />
      ) : (
        <>
          {/* compact stats */}
          <div className="flex flex-wrap gap-3">
            <StatCard icon={BookOpen} label="Total Books" value={stats.total} tint="primary" />
            <StatCard icon={Users} label="Authors" value={stats.authors} tint="amber" />
            <StatCard icon={Tag} label="Categories" value={stats.categories} tint="violet" />
          </div>

          {/* search + separate filters (author / category / date range) */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
              <div className="relative w-full sm:w-56">
                <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search books..."
                  className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
              </div>
              <FilterSelect value={fAuthor} onChange={setFAuthor} allLabel="All Authors" options={authors} />
              <FilterSelect value={fCategory} onChange={setFCategory} allLabel="All Categories" options={categories} />
              <div className="flex items-center gap-1.5">
                <Calendar className="size-4 text-zinc-400 shrink-0" />
                <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} title="Added from"
                  className="h-9 w-[9.5rem] bg-white border border-zinc-200 rounded-md px-2.5 text-xs text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                <span className="text-zinc-300 text-xs">–</span>
                <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} title="Added to"
                  className="h-9 w-[9.5rem] bg-white border border-zinc-200 rounded-md px-2.5 text-xs text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
              </div>
              {anyFilter && (
                <button onClick={() => { setQuery(''); setFAuthor(''); setFCategory(''); setFFrom(''); setFTo(''); }}
                  className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors shrink-0">Clear</button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full xl:w-auto">
              <button onClick={load} className="h-9 px-3 bg-white border border-zinc-200 text-zinc-600 hover:text-primary hover:bg-zinc-50 rounded-md flex items-center justify-center transition-colors shadow-sm shrink-0"><RefreshCw className="size-4" /></button>
              {isSuperAdmin && (
                <button onClick={() => setModal({})} className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full xl:w-auto shrink-0"><Plus className="size-3.5" /> Add Book</button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
              <BookOpen className="size-10 text-zinc-300 mb-3" />
              <p className="text-zinc-500 text-sm font-medium">{rows.length === 0 ? 'No online books yet.' : 'No books match your filters.'}</p>
              {isSuperAdmin && rows.length === 0 && <p className="text-zinc-400 text-xs mt-1.5">Click "Add Book" to upload a PDF.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map(b => (
                <div key={b.id} onClick={() => setSelected(b.id)}
                  className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col cursor-pointer group hover:ring-primary/30 hover:shadow-md transition-all">
                  <div className="relative aspect-[4/3] bg-zinc-50">
                    <span className="absolute top-2 left-2 z-10 text-[10px] font-bold text-white bg-zinc-900/70 rounded px-1.5 py-0.5 tabular-nums">#{b._num}</span>
                    <CoverThumb src={`${API_BASE_URL}/admin/library/online/${b.id}/cover?v=${encodeURIComponent(b.updated_at || '')}`} hasCover={b.has_cover} className="w-full h-full" />
                  </div>
                  <div className="p-3.5">
                    <h3 className="text-sm font-semibold text-zinc-900 leading-tight line-clamp-2 group-hover:text-primary transition-colors">{b.title}</h3>
                    {b.author && <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{b.author}</p>}
                    <p className="text-[10px] text-zinc-400 mt-2 leading-relaxed">
                      Added by <span className="font-semibold text-zinc-500">{b.created_by_name || 'Unknown'}</span>
                      {b.created_at && <> · {fmtWhen(b.created_at)}</>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* modal is rendered in BOTH the grid and the detail view, so Edit works from either */}
      {modal && <OnlineBookModal editing={modal.editing} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </>
  );
}

function FilterSelect({ value, onChange, allLabel, options }) {
  return (
    <div className="relative w-full sm:w-40 shrink-0">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm transition-colors cursor-pointer">
        <option value="">{allLabel}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tint }) {
  const tints = {
    primary: 'bg-primary/5 ring-primary/20 text-primary',
    amber: 'bg-amber-50 ring-amber-600/20 text-amber-600',
    violet: 'bg-violet-50 ring-violet-600/20 text-violet-600',
    emerald: 'bg-emerald-50 ring-emerald-600/20 text-emerald-600'
  };
  return (
    <div className={`flex items-center gap-2.5 rounded-lg ring-1 px-3 py-2 ${tints[tint] || tints.primary}`}>
      <div className="size-8 rounded-md bg-white/70 flex items-center justify-center shrink-0"><Icon className="size-4" /></div>
      <div className="flex flex-col leading-none">
        <span className="text-lg font-bold text-zinc-900 tabular-nums">{value}</span>
        <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mt-0.5">{label}</span>
      </div>
    </div>
  );
}

// View + Download buttons (fetch blob so the token is attached).
function PdfButtons({ bookId, title, hasDoc, compact }) {
  const [busy, setBusy] = useState(null);
  const open = async (download) => {
    setBusy(download ? 'd' : 'v');
    try {
      const res = await fetch(`${API_BASE_URL}/admin/library/online/${bookId}/pdf${download ? '?download=1' : ''}`);
      if (!res.ok) throw new Error('Could not load the PDF.');
      const url = URL.createObjectURL(await res.blob());
      if (download) {
        const a = document.createElement('a');
        a.href = url; a.download = (title || 'book').replace(/[^a-z0-9._-]+/gi, '_') + '.pdf';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } else { window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    } catch (e) { alert(e.message); }
    setBusy(null);
  };
  return (
    <>
      <button onClick={() => open(false)} disabled={!hasDoc || busy === 'v'}
        className={`${compact ? 'h-8 flex-1' : 'h-9 px-4'} bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors`}>
        {busy === 'v' ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />} View
      </button>
      <button onClick={() => open(true)} disabled={!hasDoc || busy === 'd'} title="Download"
        className="h-8 px-3 bg-white ring-1 ring-black/5 shadow-sm hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md text-xs font-semibold inline-flex items-center justify-center transition-colors">
        {busy === 'd' ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      </button>
    </>
  );
}

function DeleteBookButton({ book, onDeleted }) {
  const del = async () => {
    if (!window.confirm(`Delete "${book.title}" from the online library?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/library/online/${book.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Delete failed');
      onDeleted();
    } catch (e) { alert(e.message); }
  };
  return (
    <button onClick={del} title="Delete" className="size-8 bg-white ring-1 ring-black/5 shadow-sm hover:bg-zinc-50 text-zinc-500 hover:text-red-600 rounded-md flex items-center justify-center transition-colors"><Trash2 className="size-3.5" /></button>
  );
}

// ---- detail view ----
function OnlineBookDetail({ book, isSuperAdmin, onBack, onEdit, onDeleted }) {
  const del = async () => {
    if (!window.confirm(`Delete "${book.title}" from the online library?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/library/online/${book.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Delete failed');
      onDeleted();
    } catch (e) { alert(e.message); }
  };
  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
        <ArrowLeft className="size-4" /> Back to books
      </button>

      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-6 p-5 sm:p-6 border-b border-zinc-100">
          <div className="w-full sm:w-48 shrink-0">
            <div className="aspect-[3/4] rounded-md ring-1 ring-black/5 overflow-hidden bg-zinc-100">
              <CoverThumb src={`${API_BASE_URL}/admin/library/online/${book.id}/cover?v=${encodeURIComponent(book.updated_at || '')}`} hasCover={book.has_cover} className="w-full h-full" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-zinc-500 tabular-nums">#{book._num}</span>
            <h2 className="text-xl font-semibold text-zinc-900 tracking-tight leading-tight mt-0.5">{book.title}</h2>
            {book.author && <p className="text-sm text-zinc-500 mt-1">{book.author}</p>}
            {book.category && <span className="inline-block mt-2 text-[10px] font-semibold text-zinc-600 bg-zinc-100 ring-1 ring-inset ring-black/5 px-2 py-0.5 rounded uppercase tracking-wider">{book.category}</span>}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <PdfButtons bookId={book.id} title={book.title} hasDoc={book.has_doc} />
              {isSuperAdmin && (
                <>
                  <button onClick={onEdit} className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"><Edit className="size-3.5" /> Edit</button>
                  <button onClick={del} className="h-9 px-4 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"><Trash2 className="size-3.5" /> Delete</button>
                </>
              )}
            </div>
          </div>
        </div>

        {book.description && (
          <div className="p-5 sm:p-6 border-b border-zinc-100">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Description</p>
            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{book.description}</p>
          </div>
        )}

        <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px]">
          <div className="flex items-center gap-2 text-zinc-500">
            <User className="size-3.5 text-primary shrink-0" />
            Added by <span className="font-semibold text-zinc-700">{book.created_by_name || 'Unknown'}</span>
            {book.created_at && <span className="text-zinc-400">· {fmtWhen(book.created_at)}</span>}
          </div>
          {book.updated_by_name && (
            <div className="flex items-center gap-2 text-zinc-500">
              <Clock className="size-3.5 text-primary shrink-0" />
              Updated by <span className="font-semibold text-zinc-700">{book.updated_by_name}</span>
              {book.updated_at && <span className="text-zinc-400">· {fmtWhen(book.updated_at)}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OnlineBookModal({ editing, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: editing?.title || '', author: editing?.author || '',
    category: editing?.category || '', description: editing?.description || ''
  });
  const [doc, setDoc] = useState(null);       // { name, data }
  const [cover, setCover] = useState(null);   // { name, data }
  const [replacePdf, setReplacePdf] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickPdf = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (f.type !== 'application/pdf') return alert('Please choose a PDF file.');
    try { setDoc(await fileToDataUrl(f, 30)); } catch (err) { alert(err.message); }
  };
  const pickCover = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return alert('Please choose an image file.');
    try { setCover(await fileToDataUrl(f, 2)); setRemoveCover(false); } catch (err) { alert(err.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return alert('A title is required.');
    if (!editing && !doc) return alert('Please attach the book PDF.');
    setSaving(true);
    try {
      const payload = { ...form, title: form.title.trim() };
      if (doc) { payload.doc_name = doc.name; payload.doc_data = doc.data; }
      if (cover) payload.cover_data = cover.data;
      else if (removeCover) payload.remove_cover = true;
      const url = editing ? `${API_BASE_URL}/admin/library/online/${editing.id}` : `${API_BASE_URL}/admin/library/online`;
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      onSaved();
    } catch (e2) { alert(e2.message); }
    setSaving(false);
  };

  const pdfCurrent = editing && editing.has_doc && !replacePdf ? (editing.doc_name || 'Current PDF') : null;
  const coverCurrent = editing && editing.has_cover && !removeCover ? 'Current cover image' : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md shadow-xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900">{editing ? 'Edit Online Book' : 'Add Online Book'}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1.5 hover:bg-zinc-100 rounded-md"><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">
            <LabeledInput label="Title" required value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder="e.g. Mathematics — Class 10" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <LabeledInput label="Author" value={form.author} onChange={v => setForm({ ...form, author: v })} />
              <LabeledInput label="Category" value={form.category} onChange={v => setForm({ ...form, category: v })} placeholder="e.g. Textbook" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
                className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors resize-y" />
            </div>

            <FilePicker label="Cover Image" optional Icon={ImageIcon}
              picked={cover} onPick={pickCover} onClear={() => setCover(null)}
              chooseLabel="Choose cover image (max 2 MB)"
              currentName={coverCurrent} onCurrentX={() => setRemoveCover(true)}
              note={removeCover && !cover ? 'Cover will be removed on save' : null}
              onUndoNote={removeCover ? () => setRemoveCover(false) : null} />

            <FilePicker label="Book PDF" required={!editing} Icon={Upload}
              picked={doc} onPick={pickPdf} onClear={() => setDoc(null)}
              chooseLabel={editing ? 'Upload replacement PDF (max 30 MB)' : 'Choose PDF (max 30 MB)'}
              currentName={pdfCurrent} onCurrentX={() => setReplacePdf(true)} />
          </div>
          <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
            <button type="button" onClick={onClose} disabled={saving} className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 text-white rounded-md font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors min-w-[110px]">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} {saving ? 'Saving...' : (editing ? 'Save' : 'Add Book')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// A file input: shows the chosen (or current) file as a chip with a ✕ to remove / replace.
function FilePicker({ label, optional, required, Icon, picked, onPick, onClear, chooseLabel, currentName, onCurrentX, note, onUndoNote }) {
  const accept = Icon === ImageIcon ? 'image/*' : 'application/pdf';
  const chip = picked ? { name: picked.name, x: onClear } : (currentName ? { name: currentName, x: onCurrentX } : null);
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
        {label} {required ? <span className="text-red-500">*</span> : optional ? <span className="text-zinc-400 normal-case font-medium">(optional)</span> : null}
      </label>
      {chip ? (
        <div className="flex items-center gap-2 px-3 py-2 border border-zinc-200 rounded-md bg-zinc-50">
          <Icon className="size-4 text-primary shrink-0" />
          <span className="text-xs font-medium text-zinc-700 truncate flex-1">{chip.name}</span>
          {chip.x && (
            <button type="button" onClick={chip.x} title="Remove / replace"
              className="size-6 rounded-full bg-white ring-1 ring-black/10 text-zinc-500 hover:text-red-600 flex items-center justify-center shrink-0 shadow-sm"><X className="size-3.5" /></button>
          )}
        </div>
      ) : (
        <label className="cursor-pointer flex items-center gap-2 text-zinc-700 px-3 py-2.5 border border-dashed border-zinc-300 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors">
          <Icon className="size-4 text-primary" /> {chooseLabel}
          <input type="file" accept={accept} onChange={onPick} className="hidden" />
        </label>
      )}
      {note && !chip && (
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-red-500 font-medium">{note}</span>
          {onUndoNote && <button type="button" onClick={onUndoNote} className="font-semibold text-primary hover:underline">Undo</button>}
        </div>
      )}
    </div>
  );
}

// =====================================================================
//  OFFLINE LIBRARY — Catalogue + Issued  (unchanged)
// =====================================================================
function OfflineLibrary({ user, canEdit }) {
  const [sub, setSub] = useState('catalog');
  return (
    <>
      <div className="flex items-center gap-2">
        {[['catalog', 'Catalogue'], ['issued', 'Issued Books']].map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              sub === id ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
            }`}>{label}</button>
        ))}
      </div>
      {sub === 'catalog' ? <Catalogue user={user} canEdit={canEdit} /> : <IssuedBooks user={user} canEdit={canEdit} />}
    </>
  );
}

function Catalogue({ user, canEdit }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [fAuthor, setFAuthor] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [modal, setModal] = useState(null);
  const [issueFor, setIssueFor] = useState(null);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/library/books/${user.institutionId}`);
      const d = await res.json();
      setRows(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const numbered = useMemo(() => rows.map((r, i) => ({ ...r, _num: i + 1 })), [rows]);
  const authors = useMemo(() => [...new Set(rows.map(r => (r.author || '').trim()).filter(Boolean))].sort(), [rows]);
  const categories = useMemo(() => [...new Set(rows.map(r => (r.category || '').trim()).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return numbered.filter(r => {
      if (q && ![r.title, r.author, r.isbn, r.category].some(v => (v || '').toLowerCase().includes(q))) return false;
      if (fAuthor && (r.author || '') !== fAuthor) return false;
      if (fCategory && (r.category || '') !== fCategory) return false;
      const day = istDate(r.created_at);
      if (fFrom && day && day < fFrom) return false;
      if (fTo && day && day > fTo) return false;
      return true;
    });
  }, [numbered, query, fAuthor, fCategory, fFrom, fTo]);

  const stats = useMemo(() => ({
    total: rows.length,
    available: rows.reduce((s, r) => s + Number(r.available_copies || 0), 0),
    onloan: rows.reduce((s, r) => s + (Number(r.total_copies || 0) - Number(r.available_copies || 0)), 0),
    categories: categories.length
  }), [rows, categories]);
  const anyFilter = query || fAuthor || fCategory || fFrom || fTo;

  const remove = async (row) => {
    if (!window.confirm(`Delete "${row.title}" and its issue history?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/library/books/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      {/* compact stats */}
      <div className="flex flex-wrap gap-3">
        <StatCard icon={LibraryIcon} label="Total Books" value={stats.total} tint="primary" />
        <StatCard icon={CheckCircle2} label="Available" value={stats.available} tint="emerald" />
        <StatCard icon={ArrowLeftRight} label="On Loan" value={stats.onloan} tint="amber" />
        <StatCard icon={Tag} label="Categories" value={stats.categories} tint="violet" />
      </div>

      {/* search + filters */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <div className="relative w-full sm:w-56">
            <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search catalogue..."
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
          </div>
          <FilterSelect value={fAuthor} onChange={setFAuthor} allLabel="All Authors" options={authors} />
          <FilterSelect value={fCategory} onChange={setFCategory} allLabel="All Categories" options={categories} />
          <div className="flex items-center gap-1.5">
            <Calendar className="size-4 text-zinc-400 shrink-0" />
            <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} title="Added from"
              className="h-9 w-[9.5rem] bg-white border border-zinc-200 rounded-md px-2.5 text-xs text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
            <span className="text-zinc-300 text-xs">–</span>
            <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} title="Added to"
              className="h-9 w-[9.5rem] bg-white border border-zinc-200 rounded-md px-2.5 text-xs text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
          </div>
          {anyFilter && (
            <button onClick={() => { setQuery(''); setFAuthor(''); setFCategory(''); setFFrom(''); setFTo(''); }}
              className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors shrink-0">Clear</button>
          )}
        </div>
        <div className="flex items-center gap-2 w-full xl:w-auto">
          <button onClick={load} className="h-9 px-3 bg-white border border-zinc-200 text-zinc-600 hover:text-primary hover:bg-zinc-50 rounded-md flex items-center justify-center transition-colors shadow-sm shrink-0"><RefreshCw className="size-4" /></button>
          {canEdit && (
            <button onClick={() => setModal({})} className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full xl:w-auto shrink-0"><Plus className="size-3.5" /> Add Book</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <LibraryIcon className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">{rows.length === 0 ? 'No books in the catalogue yet.' : 'No matches for your filters.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1080px]">
            <thead className="bg-zinc-50/80">
              <tr>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-12 text-center">#</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-16">Cover</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Title</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Author</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Category</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Shelf</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-center">Available</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Added</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(b => {
                const avail = Number(b.available_copies);
                return (
                  <tr key={b.id} className="hover:bg-zinc-50/60 transition-colors group">
                    <td className="px-4 py-3 text-center font-semibold text-primary tabular-nums">{b._num}</td>
                    <td className="px-4 py-3">
                      <CoverThumb src={`${API_BASE_URL}/admin/library/books/${b.id}/cover?v=${encodeURIComponent(b.updated_at || '')}`} hasCover={b.has_cover} className="w-10 h-14 rounded ring-1 ring-black/5" />
                    </td>
                    <td className="px-4 py-3 font-semibold text-zinc-900 text-sm">
                      {b.title}{b.isbn && <span className="block text-[10px] font-medium text-zinc-400 mt-0.5">ISBN {b.isbn}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{b.author || <span className="text-zinc-400 italic">-</span>}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{b.category || '-'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{b.location || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tabular-nums ring-1 ring-inset ${avail > 0 ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-red-50 text-red-700 ring-red-600/20'}`}>{avail} / {b.total_copies}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-[11px] font-semibold text-zinc-700">{b.created_by_name || '-'}</div>
                      {b.created_at && <div className="text-[10px] text-zinc-400">{fmtWhen(b.created_at)}</div>}
                      {b.updated_by_name && <div className="text-[10px] text-zinc-400 mt-0.5">upd: {b.updated_by_name}{b.updated_at ? ` · ${fmtWhen(b.updated_at)}` : ''}</div>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <button onClick={() => setIssueFor(b)} disabled={avail <= 0} title={avail > 0 ? 'Issue a copy' : 'No copies available'}
                            className="h-8 px-3 rounded-md font-semibold text-xs text-primary bg-primary/10 hover:bg-primary/20 disabled:bg-zinc-100 disabled:text-zinc-400 transition-colors inline-flex items-center gap-1.5"><ArrowLeftRight className="size-3.5" /> Issue</button>
                        )}
                        {canEdit && (
                          <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-1">
                            <button onClick={() => setModal({ editing: b })} title="Edit" className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5"><Edit className="size-3.5" /></button>
                            <button onClick={() => remove(b)} title="Delete" className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-red-600 rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5"><Trash2 className="size-3.5" /></button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && <BookModal editing={modal.editing} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {issueFor && <IssueModal book={issueFor} instId={user.institutionId} onClose={() => setIssueFor(null)} onSaved={() => { setIssueFor(null); load(); }} />}
    </>
  );
}

function BookModal({ editing, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: editing?.title || '', author: editing?.author || '', isbn: editing?.isbn || '',
    category: editing?.category || '', location: editing?.location || '',
    total_copies: editing?.total_copies ? String(editing.total_copies) : '1'
  });
  const [cover, setCover] = useState(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickCover = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return alert('Please choose an image file.');
    try { setCover(await fileToDataUrl(f, 2)); setRemoveCover(false); } catch (err) { alert(err.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return alert('A title is required.');
    setSaving(true);
    try {
      const payload = { ...form, title: form.title.trim(), total_copies: Math.max(1, parseInt(form.total_copies, 10) || 1) };
      if (cover) payload.cover_data = cover.data;
      else if (removeCover) payload.remove_cover = true;
      const url = editing ? `${API_BASE_URL}/admin/library/books/${editing.id}` : `${API_BASE_URL}/admin/library/books`;
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      onSaved();
    } catch (e2) { alert(e2.message); }
    setSaving(false);
  };

  const coverCurrent = editing && editing.has_cover && !removeCover ? 'Current cover image' : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md shadow-xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900">{editing ? 'Edit Book' : 'Add Book'}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1.5 hover:bg-zinc-100 rounded-md"><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">
            <LabeledInput label="Title" required value={form.title} onChange={v => setForm({ ...form, title: v })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <LabeledInput label="Author" value={form.author} onChange={v => setForm({ ...form, author: v })} />
              <LabeledInput label="ISBN" value={form.isbn} onChange={v => setForm({ ...form, isbn: v })} />
              <LabeledInput label="Category" value={form.category} onChange={v => setForm({ ...form, category: v })} />
              <LabeledInput label="Shelf / Location" value={form.location} onChange={v => setForm({ ...form, location: v })} />
            </div>
            <FilePicker label="Cover Image" optional Icon={ImageIcon}
              picked={cover} onPick={pickCover} onClear={() => setCover(null)}
              chooseLabel="Choose cover image (max 2 MB)"
              currentName={coverCurrent} onCurrentX={() => setRemoveCover(true)}
              note={removeCover && !cover ? 'Cover will be removed on save' : null}
              onUndoNote={removeCover ? () => setRemoveCover(false) : null} />
            <LabeledInput label="Total Copies" type="number" value={form.total_copies} onChange={v => setForm({ ...form, total_copies: v })}
              hint={editing ? 'Available copies re-balance automatically.' : undefined} />
          </div>
          <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
            <button type="button" onClick={onClose} disabled={saving} className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 text-white rounded-md font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors min-w-[110px]">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} {saving ? 'Saving...' : (editing ? 'Save' : 'Add Book')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IssueModal({ book, instId, onClose, onSaved }) {
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ member_user_id: '', borrower_name: '', issue_date: todayISO(), due_date: '', notes: '' });
  const [useCustom, setUseCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    (async () => {
      try { const res = await fetch(`${API_BASE_URL}/admin/library/members/${instId}`); const d = await res.json(); if (res.ok) setMembers(Array.isArray(d) ? d : []); }
      catch (e) { console.error(e); }
    })();
  }, [instId]);
  const submit = async (e) => {
    e.preventDefault();
    if (!useCustom && !form.member_user_id) return alert('Choose a borrower (or switch to a custom name).');
    if (useCustom && !form.borrower_name.trim()) return alert('Type the borrower name.');
    if (!form.issue_date) return alert('Pick an issue date.');
    setSaving(true);
    try {
      const payload = {
        book_id: book.id,
        member_user_id: useCustom ? null : (form.member_user_id ? parseInt(form.member_user_id, 10) : null),
        borrower_name: useCustom ? form.borrower_name.trim() : null,
        issue_date: form.issue_date, due_date: form.due_date || null, notes: form.notes.trim() || null
      };
      const res = await fetch(`${API_BASE_URL}/admin/library/issues`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not issue the book.');
      onSaved();
    } catch (e2) { alert(e2.message); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md shadow-xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
          <div><h2 className="text-lg font-semibold text-zinc-900">Issue Book</h2><p className="text-[11px] text-zinc-500 mt-0.5 truncate">{book.title}</p></div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1.5 hover:bg-zinc-100 rounded-md"><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <button type="button" onClick={() => setUseCustom(false)} className={`px-2.5 py-1 rounded ${!useCustom ? 'bg-primary text-white' : 'bg-zinc-100 text-zinc-600'}`}>System member</button>
              <button type="button" onClick={() => setUseCustom(true)} className={`px-2.5 py-1 rounded ${useCustom ? 'bg-primary text-white' : 'bg-zinc-100 text-zinc-600'}`}>Other name</button>
            </div>
            {useCustom ? (
              <LabeledInput label="Borrower name" required value={form.borrower_name} onChange={v => setForm({ ...form, borrower_name: v })} placeholder="e.g. Visiting teacher" />
            ) : (
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Borrower <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select value={form.member_user_id} onChange={e => setForm({ ...form, member_user_id: e.target.value })}
                    className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm transition-colors cursor-pointer">
                    <option value="">Select a member…</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.role ? ` — ${m.role}` : ''}</option>)}
                  </select>
                  <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <LabeledInput label="Issue date" type="date" required value={form.issue_date} onChange={v => setForm({ ...form, issue_date: v })} />
              <LabeledInput label="Due date" type="date" value={form.due_date} onChange={v => setForm({ ...form, due_date: v })} />
            </div>
            <LabeledInput label="Notes" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Optional" />
          </div>
          <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
            <button type="button" onClick={onClose} disabled={saving} className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 text-white rounded-md font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors min-w-[110px]">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowLeftRight className="size-3.5" />} {saving ? 'Issuing...' : 'Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IssuedBooks({ user, canEdit }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('issued');
  const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/admin/library/issues/${user.institutionId}?status=${status}`;
      if (query.trim()) url += `&q=${encodeURIComponent(query.trim())}`;
      const res = await fetch(url);
      const d = await res.json();
      setRows(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user, status, query]);
  useEffect(() => { load(); }, [load]);
  const doReturn = async (row) => {
    if (!window.confirm(`Mark "${row.book_title}" returned by ${row.borrower}?`)) return;
    try { const res = await fetch(`${API_BASE_URL}/admin/library/issues/${row.id}/return`, { method: 'POST' }); if (!res.ok) throw new Error('Return failed'); load(); }
    catch (e) { alert(e.message); }
  };
  const remove = async (row) => {
    if (!window.confirm('Delete this issue record?')) return;
    try { const res = await fetch(`${API_BASE_URL}/admin/library/issues/${row.id}`, { method: 'DELETE' }); if (!res.ok) throw new Error('Delete failed'); load(); }
    catch (e) { alert(e.message); }
  };
  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          {[['issued', 'Issued'], ['returned', 'Returned']].map(([id, label]) => (
            <button key={id} onClick={() => setStatus(id)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${status === id ? 'bg-primary text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'}`}>{label}</button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search book or borrower..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm" />
        </div>
      </div>
      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <ArrowLeftRight className="size-10 text-zinc-300 mb-3" /><p className="text-zinc-500 text-sm font-medium">No {status} records.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[880px]">
            <thead className="bg-zinc-50/80">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Book</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Borrower</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Issue Date</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Due Date</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">{status === 'returned' ? 'Returned' : 'Status'}</th>
                {canEdit && <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map(r => {
                const overdue = isOverdue(r);
                return (
                  <tr key={r.id} className="hover:bg-zinc-50/60 transition-colors group">
                    <td className="px-5 py-4 font-semibold text-zinc-900 text-sm">{r.book_title || '-'}{r.book_author && <span className="block text-[10px] font-medium text-zinc-400 mt-0.5">{r.book_author}</span>}</td>
                    <td className="px-5 py-4 text-sm text-zinc-700"><span className="inline-flex items-center gap-1.5"><User className="size-3.5 text-zinc-400" /> {r.borrower}</span></td>
                    <td className="px-5 py-4 text-sm text-zinc-600 tabular-nums">{fmtDMY(r.issue_date)}</td>
                    <td className="px-5 py-4 text-sm tabular-nums"><span className={overdue ? 'text-red-600 font-semibold' : 'text-zinc-600'}>{fmtDMY(r.due_date)}</span></td>
                    <td className="px-5 py-4">
                      {r.status === 'returned'
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600"><CheckCircle2 className="size-3.5 text-emerald-500" /> {fmtDMY(r.return_date)}</span>
                        : overdue
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"><AlertTriangle className="size-3" /> Overdue</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">Issued</span>}
                    </td>
                    {canEdit && (
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {r.status !== 'returned' && (
                            <button onClick={() => doReturn(r)} className="h-8 px-3 rounded-md font-semibold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5" /> Return</button>
                          )}
                          <button onClick={() => remove(r)} title="Delete record" className="size-8 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-red-600 rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5 sm:opacity-0 sm:group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// --- shared field ---
function LabeledInput({ label, value, onChange, type = 'text', required, placeholder, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder}
        className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
      {hint && <p className="text-[10px] text-zinc-400">{hint}</p>}
    </div>
  );
}

// --- How to use ---
function LibraryHelp({ isSuperAdmin, canEdit }) {
  const [open, setOpen] = useState(false);
  const steps = [
    ['Online Library', 'Cards show a cover, an auto number and who added it. Click a card to open its full detail (handy for long descriptions), then View or Download the PDF.'],
    ['Manage online (Super Admin)', 'Only a Super Admin can Add / Edit / Delete online books, and set a cover image.'],
    ['Offline — Catalogue & Issue', 'The physical books with copy counts. Use Issue on an available book; availability updates automatically.'],
    ['Offline — Return', 'On the Issued tab, hit Return when a book comes back. Overdue books are flagged in red.'],
  ];
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 self-start">
        <HelpCircle className="size-3.5" /> How to use
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
              <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> Library</span>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X className="size-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              {steps.map(([t, d], i) => (
                <div key={i} className="rounded-md ring-1 ring-zinc-100 bg-zinc-50/60 p-3">
                  <p className="text-xs font-semibold text-zinc-800">{t}</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
                </div>
              ))}
              <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex gap-2">
                <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  {isSuperAdmin ? 'You are a Super Admin — you can manage online books.' : 'Only a Super Admin can add or change online books.'}
                  {canEdit ? ' You can manage the offline catalogue and issues.' : ' Offline management needs edit access.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}