import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  ArrowLeft, Library as LibraryIcon, Folder, FolderPlus, Upload, Download, Eye, Trash2, Edit,
  X, Loader2, Save, ChevronDown, ChevronRight, FileText, FileSpreadsheet, File as FileIcon,
  Search, HelpCircle, ShieldCheck, Layers, ImagePlus, ExternalLink
} from 'lucide-react';

// =====================================================================
//  Syllabus Library
//   One library per SYLLABUS TYPE. Folders (class + subject) hold
//   textbooks and materials (PDF, Word, Excel) shown as cover cards.
//   Folders and files can carry a cover image; files can be renamed.
// =====================================================================

const MAX_MB = 50;
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx';
const ALLOWED = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
const COVER_ACCEPT = 'image/png,image/jpeg,image/webp';

const classLabel = (c) => `${c.className}${c.section ? ' - ' + c.section : ''}`;
const extOf = (name = '') => (name.includes('.') ? name.split('.').pop() : '').toLowerCase();
const stripExt = (name = '') => name.replace(/\.(pdf|docx?|xlsx?)$/i, '');
const fmtSize = (b) => {
  const n = Number(b) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// "by vicky · 23 Sep 2026, 10:22 am"  (IST; Railway stores UTC)
const _toDate = (val) => {
  if (!val) return null;
  let d;
  if (typeof val === 'string' && !val.includes('T') && !val.endsWith('Z')) d = new Date(val.replace(' ', 'T') + 'Z');
  else d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};
const fmtWhen = (val) => {
  const d = _toDate(val);
  if (!d) return '';
  const date = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
};
const byLine = (name, val) => `by ${name || 'Unknown'}${val ? ' · ' + fmtWhen(val) : ''}`;

const readAsDataURL = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error(`Could not read ${file.name}`));
  r.readAsDataURL(file);
});

// Downscale a chosen image to a small JPEG data URI so covers stay light.
const imageToCover = (file, max = 640, quality = 0.82) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('That image could not be read.'));
    img.src = reader.result;
  };
  reader.onerror = () => reject(new Error('That image could not be read.'));
  reader.readAsDataURL(file);
});

const EXT_STYLE = {
  pdf:  { icon: FileText,        wrap: 'bg-red-50',     fg: 'text-red-500' },
  doc:  { icon: FileText,        wrap: 'bg-blue-50',    fg: 'text-blue-600' },
  docx: { icon: FileText,        wrap: 'bg-blue-50',    fg: 'text-blue-600' },
  xls:  { icon: FileSpreadsheet, wrap: 'bg-emerald-50', fg: 'text-emerald-600' },
  xlsx: { icon: FileSpreadsheet, wrap: 'bg-emerald-50', fg: 'text-emerald-600' },
};

// A cover thumbnail (portrait) - the image if there is one, else a tinted
// placeholder with the file-type icon. Used by both file and folder cards.
function CoverThumb({ cover, ext, folder, index }) {
  const style = EXT_STYLE[ext] || { icon: FileIcon, wrap: 'bg-zinc-100', fg: 'text-zinc-400' };
  const Icon = folder ? Folder : style.icon;
  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-t-lg bg-zinc-50">
      {cover ? (
        <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className={`absolute inset-0 flex flex-col items-center justify-center ${folder ? 'bg-amber-50' : style.wrap}`}>
          <Icon className={`size-10 ${folder ? 'text-amber-400' : style.fg}`} />
          {!folder && <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{ext}</span>}
        </div>
      )}
      {typeof index === 'number' && (
        <span className="absolute left-2 top-2 rounded bg-zinc-900/70 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          #{index + 1}
        </span>
      )}
    </div>
  );
}

// Cover picker used inside the folder / file modals.
function CoverPicker({ value, onChange }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (ref.current) ref.current.value = '';
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return alert('Pick an image under 8 MB.');
    setBusy(true);
    try { onChange(await imageToCover(f)); }
    catch (err) { alert(err.message); }
    setBusy(false);
  };
  return (
    <div className="flex items-center gap-3">
      <div className="size-20 shrink-0 overflow-hidden rounded-md ring-1 ring-black/10 bg-zinc-50 flex items-center justify-center">
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="size-6 text-zinc-300" />}
      </div>
      <div className="flex flex-col gap-1.5">
        <input ref={ref} type="file" accept={COVER_ACCEPT} className="hidden" onChange={pick} />
        <button type="button" onClick={() => ref.current?.click()} disabled={busy}
          className="h-8 px-3 bg-white ring-1 ring-black/10 shadow-sm hover:bg-zinc-50 text-zinc-700 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors w-fit">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
          {value ? 'Change cover' : 'Add cover'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)}
            className="h-8 px-3 text-red-600 hover:bg-red-50 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors w-fit">
            <Trash2 className="size-3.5" /> Remove cover
          </button>
        )}
      </div>
    </div>
  );
}

export default function SyllabusLibrary({
  user, canEdit, classes, subjects, subjectClasses,
  syllabusType, filterClass, onClassChange, onBack
}) {
  const [folders, setFolders]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');
  const [folderModal, setFolderModal] = useState(null); // { editing? } | null
  const [openFolderId, setOpenFolderId] = useState(null);
  const reqSeq = useRef(0);

  const activeClass = useMemo(() => classes.find(c => String(c.id) === String(filterClass)) || null, [classes, filterClass]);
  const openFolder  = useMemo(() => folders.find(f => f.id === openFolderId) || null, [folders, openFolderId]);

  useEffect(() => {
    if (classes.length === 0) return;
    if (!classes.some(c => String(c.id) === String(filterClass))) onClassChange(String(classes[0].id));
  }, [classes, filterClass, onClassChange]);

  const load = useCallback(async () => {
    const seq = ++reqSeq.current;
    if (!user?.institutionId || !syllabusType?.id || !filterClass) { setFolders([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/syllabus/library/${user.institutionId}/folders?typeId=${syllabusType.id}&classId=${filterClass}`);
      const d = await res.json();
      if (seq === reqSeq.current) setFolders(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    if (seq === reqSeq.current) setLoading(false);
  }, [user, syllabusType, filterClass]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setOpenFolderId(null); setQuery(''); }, [filterClass]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter(f =>
      (f.name || '').toLowerCase().includes(q) || (f.subject_name || '').toLowerCase().includes(q));
  }, [folders, query]);

  const deleteFolder = async (f) => {
    const msg = f.file_count > 0
      ? `Delete folder "${f.name}" and its ${f.file_count} file(s)? This cannot be undone.`
      : `Delete folder "${f.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/library/folders/${f.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Delete failed');
      if (openFolderId === f.id) setOpenFolderId(null);
      load();
    } catch (e) { alert(e.message); }
  };

  // Top-of-page back: inside a folder -> back to the folder list; else -> syllabuses.
  const backAction = openFolder ? () => setOpenFolderId(null) : onBack;
  const backLabel  = openFolder ? 'Back to library' : 'Back to syllabuses';

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      <div className="flex items-center">
        <button onClick={backAction}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors w-fit">
          <ArrowLeft className="size-4" /> {backLabel}
        </button>
      </div>

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <LibraryIcon className="text-primary size-5" />
            Library
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[60ch]">
            Textbooks, notes and worksheets, kept in folders by class and subject.
          </p>
          <span className="mt-2 inline-flex items-center gap-1.5 w-fit text-[11px] font-semibold text-primary bg-primary/5 ring-1 ring-primary/15 px-2 py-1 rounded">
            <Layers className="size-3.5" /> {syllabusType.name}
          </span>
        </div>
        <LibraryHelp canEdit={canEdit} />
      </header>

      {/* Filter / actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider shrink-0">Class:</span>
            <div className="relative w-full sm:w-48">
              <select value={filterClass} onChange={e => onClassChange(e.target.value)} disabled={classes.length === 0}
                className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                {classes.length === 0 && <option value="">No classes</option>}
                {classes.map(c => (<option key={c.id} value={String(c.id)}>{classLabel(c)}</option>))}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          {!openFolder && (
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-3.5" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search folders..."
                className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-8 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
            </div>
          )}
        </div>
        {canEdit && !openFolder && (
          <button onClick={() => setFolderModal({})}
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full md:w-auto shrink-0">
            <FolderPlus className="size-3.5" /> New Folder
          </button>
        )}
      </div>

      <div className="flex-1">
        {openFolder ? (
          <FolderView folder={openFolder} canEdit={canEdit}
            onBack={() => setOpenFolderId(null)} onChanged={load} />
        ) : loading ? (
          <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <Folder className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">
              {folders.length === 0
                ? `No folders for ${activeClass ? classLabel(activeClass) : 'this class'} yet.`
                : 'No folders match your search.'}
            </p>
            {canEdit && folders.length === 0 && (
              <button onClick={() => setFolderModal({})}
                className="mt-3 h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors">
                <FolderPlus className="size-3.5" /> Create a folder
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
            {filtered.map((f, i) => (
              <div key={f.id}
                className="group bg-white rounded-lg ring-1 ring-black/5 shadow-sm hover:ring-primary/30 hover:shadow-md transition-all flex flex-col overflow-hidden">
                <button onClick={() => setOpenFolderId(f.id)} className="text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <CoverThumb cover={f.cover_data} folder index={i} />
                </button>
                <div className="p-3 flex flex-col flex-1">
                  <button onClick={() => setOpenFolderId(f.id)}
                    className="text-left font-semibold text-sm text-zinc-900 truncate hover:text-primary transition-colors" title={f.name}>
                    {f.name}
                  </button>
                  <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{f.subject_name} · {f.class_group}</p>
                  <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">
                    {f.file_count} file{Number(f.file_count) === 1 ? '' : 's'}{Number(f.total_size) > 0 ? ` · ${fmtSize(f.total_size)}` : ''}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5 truncate" title={byLine(f.updated_by_name, f.updated_at)}>
                    {byLine(f.updated_by_name, f.updated_at)}
                  </p>
                  {canEdit && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-zinc-100">
                      <button onClick={() => setFolderModal({ editing: f })} title="Edit folder"
                        className="flex-1 h-7 rounded-md text-zinc-500 hover:text-primary hover:bg-zinc-50 flex items-center justify-center transition-colors">
                        <Edit className="size-3.5" />
                      </button>
                      <button onClick={() => deleteFolder(f)} title="Delete folder"
                        className="flex-1 h-7 rounded-md text-zinc-500 hover:text-red-600 hover:bg-zinc-50 flex items-center justify-center transition-colors">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {folderModal && (
        <FolderModal
          editing={folderModal.editing}
          syllabusType={syllabusType}
          classes={classes} subjects={subjects} subjectClasses={subjectClasses}
          defaultClassId={filterClass}
          onClose={() => setFolderModal(null)}
          onSaved={(savedClassId) => {
            setFolderModal(null);
            if (savedClassId && String(savedClassId) !== String(filterClass)) onClassChange(String(savedClassId));
            else load();
          }} />
      )}
    </div>
  );
}

// =====================================================================
//  Create / edit a folder (class + subject + name + cover)
// =====================================================================
function FolderModal({ editing, syllabusType, classes, subjects, subjectClasses, defaultClassId, onClose, onSaved }) {
  const [classId, setClassId]     = useState(editing ? String(editing.class_id) : String(defaultClassId || ''));
  const [subjectId, setSubjectId] = useState(editing ? String(editing.subject_id) : '');
  const [name, setName]           = useState(editing?.name || '');
  const [cover, setCover]         = useState(editing?.cover_data || null);
  const [coverTouched, setCT]     = useState(false);
  const [saving, setSaving]       = useState(false);

  const subjectsForClass = useMemo(() => {
    if (!classId) return subjects;
    const cid = parseInt(classId, 10);
    return subjects.filter(s => {
      const links = subjectClasses[s.id];
      if (!links || links.length === 0) return true;
      return links.includes(cid);
    });
  }, [subjects, subjectClasses, classId]);

  const subjectName = subjects.find(s => String(s.id) === String(subjectId))?.name || '';

  const submit = async (e) => {
    e.preventDefault();
    if (!classId || !subjectId) return alert('Select a class and a subject.');
    setSaving(true);
    try {
      const body = {
        syllabus_type_id: syllabusType.id,
        class_id: parseInt(classId, 10),
        subject_id: parseInt(subjectId, 10),
        name: name.trim() || subjectName
      };
      // On create always send the cover; on edit only if the user touched it.
      if (!editing || coverTouched) body.cover_data = cover;
      const res = await fetch(
        editing ? `${API_BASE_URL}/admin/syllabus/library/folders/${editing.id}` : `${API_BASE_URL}/admin/syllabus/library/folders`,
        { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      onSaved(body.class_id);
    } catch (e2) { alert(e2.message); }
    setSaving(false);
  };

  const inputCls = "h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
            <FolderPlus className="size-4 text-primary" /> {editing ? 'Edit Folder' : 'New Folder'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md"><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col overflow-hidden">
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Syllabus Type</label>
              <div className="h-9 w-full bg-zinc-50 border border-zinc-200 rounded-md px-3 text-sm text-zinc-700 font-medium flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" /> {syllabusType.name}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">Class <span className="text-red-500">*</span></label>
              <div className="relative">
                <select value={classId} required onChange={e => { setClassId(e.target.value); setSubjectId(''); }}
                  className={`${inputCls} cursor-pointer appearance-none pr-8`}>
                  <option value="">Select class</option>
                  {classes.map(c => <option key={c.id} value={String(c.id)}>{classLabel(c)}</option>)}
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">Subject <span className="text-red-500">*</span></label>
              <div className="relative">
                <select value={subjectId} required onChange={e => setSubjectId(e.target.value)}
                  className={`${inputCls} cursor-pointer appearance-none pr-8`}>
                  <option value="">{classId ? 'Select subject' : 'Select a class first'}</option>
                  {subjectsForClass.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Folder Name</label>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={150}
                placeholder={subjectName ? `${subjectName} (default)` : 'e.g. Textbooks, Worksheets, Unit Tests'}
                className={inputCls} />
              <p className="text-[11px] text-zinc-400">Leave blank to name it after the subject.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Cover Image</label>
              <CoverPicker value={cover} onChange={v => { setCover(v); setCT(true); }} />
            </div>
          </div>
          <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
            <button type="button" onClick={onClose} disabled={saving}
              className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors min-w-[120px]">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Folder')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =====================================================================
//  Inside a folder: file cover cards + upload / preview / rename / delete
// =====================================================================
function FolderView({ folder, canEdit, onBack, onChanged }) {
  const [files, setFiles]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [progress, setProgress] = useState(null); // { done, total } | null
  const [busyId, setBusyId]     = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileModal, setFileModal] = useState(null); // { file } | null
  const [preview, setPreview]   = useState(null);    // { name, url } | null
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/library/folders/${folder.id}/files`);
      const d = await res.json();
      setFiles(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [folder.id]);

  useEffect(() => { load(); }, [load]);

  const uploadFiles = async (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;
    const problems = [];
    const valid = list.filter(f => {
      if (!ALLOWED.includes(extOf(f.name))) { problems.push(`${f.name}: only PDF, Word and Excel files are allowed.`); return false; }
      if (f.size > MAX_MB * 1024 * 1024) { problems.push(`${f.name}: larger than ${MAX_MB} MB.`); return false; }
      return true;
    });
    setProgress({ done: 0, total: valid.length });
    for (let i = 0; i < valid.length; i++) {
      const f = valid[i];
      try {
        const data = await readAsDataURL(f);
        const res = await fetch(`${API_BASE_URL}/admin/syllabus/library/folders/${folder.id}/files`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_name: f.name, file_data: data })
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Upload failed');
      } catch (e) { problems.push(`${f.name}: ${e.message}`); }
      setProgress({ done: i + 1, total: valid.length });
    }
    setProgress(null);
    if (inputRef.current) inputRef.current.value = '';
    await load();
    onChanged();
    if (problems.length) alert(`Some files were not uploaded:\n\n${problems.join('\n')}`);
  };

  const fetchBlob = async (file, inline) => {
    const res = await fetch(`${API_BASE_URL}/admin/syllabus/library/files/${file.id}/download${inline ? '?inline=1' : ''}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not open this file.');
    return res.blob();
  };

  // View in an in-app modal (reliable - avoids the blank pop-up tab).
  const viewFile = async (file) => {
    setBusyId(file.id);
    try {
      const blob = await fetchBlob(file, true);
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setPreview({ name: file.file_name, url });
    } catch (e) { alert(e.message); }
    setBusyId(null);
  };
  const closePreview = () => {
    setPreview(p => { if (p?.url) URL.revokeObjectURL(p.url); return null; });
  };
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

  const downloadFile = async (file) => {
    setBusyId(file.id);
    try {
      const blob = await fetchBlob(file, false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = file.file_name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { alert(e.message); }
    setBusyId(null);
  };

  const deleteFile = async (file) => {
    if (!window.confirm(`Delete "${file.file_name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/library/files/${file.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await load();
      onChanged();
    } catch (e) { alert(e.message); }
  };

  const uploading = !!progress;

  return (
    <div className="space-y-4"
      onDragOver={canEdit ? (e => { e.preventDefault(); setDragOver(true); }) : undefined}
      onDragLeave={canEdit ? (() => setDragOver(false)) : undefined}
      onDrop={canEdit ? (e => { e.preventDefault(); setDragOver(false); if (!uploading) uploadFiles(e.dataTransfer.files); }) : undefined}>

      {/* Folder header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-4">
        <div className="flex items-center gap-1.5 min-w-0 text-sm">
          <button onClick={onBack} className="font-semibold text-zinc-500 hover:text-primary transition-colors shrink-0">All folders</button>
          <ChevronRight className="size-3.5 text-zinc-300 shrink-0" />
          <Folder className="size-4 text-amber-500 shrink-0" />
          <span className="font-semibold text-zinc-900 truncate">{folder.name}</span>
          <span className="text-[11px] text-zinc-400 truncate hidden md:inline">· {folder.subject_name}, {folder.class_group}</span>
        </div>
        {canEdit && (
          <>
            <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={e => uploadFiles(e.target.files)} />
            <button onClick={() => inputRef.current?.click()} disabled={uploading}
              className="h-9 px-4 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0">
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {uploading ? `Uploading ${progress.done}/${progress.total}...` : 'Upload Files'}
            </button>
          </>
        )}
      </div>

      {canEdit && dragOver && (
        <div className="rounded-md border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center text-sm font-semibold text-primary">
          Drop PDF, Word or Excel files to upload
        </div>
      )}

      {loading ? (
        <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin size-7 text-primary" /></div>
      ) : files.length === 0 ? (
        <div className="bg-white rounded-lg ring-1 ring-black/5 p-12 text-center flex flex-col items-center">
          <FileText className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">This folder is empty.</p>
          {canEdit && <p className="text-zinc-400 text-xs mt-1.5">Upload PDF, Word or Excel files (up to {MAX_MB} MB each), or drag them here.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
          {files.map((f, i) => (
            <div key={f.id} className="group bg-white rounded-lg ring-1 ring-black/5 shadow-sm hover:ring-primary/30 hover:shadow-md transition-all flex flex-col overflow-hidden">
              <button onClick={() => (f.file_ext === 'pdf' ? viewFile(f) : downloadFile(f))}
                title={f.file_ext === 'pdf' ? 'View' : 'Download'}
                className="text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                <CoverThumb cover={f.cover_data} ext={f.file_ext} index={i} />
              </button>
              <div className="p-3 flex flex-col flex-1">
                <p className="font-semibold text-sm text-zinc-900 truncate" title={f.file_name}>{stripExt(f.file_name)}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">{f.file_ext.toUpperCase()} · {fmtSize(f.file_size)}</p>
                <p className="text-[10px] text-zinc-400 mt-1.5 truncate" title={byLine(f.uploaded_by_name, f.created_at)}>
                  {byLine(f.uploaded_by_name, f.created_at)}
                </p>
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-zinc-100">
                  {f.file_ext === 'pdf' && (
                    <button onClick={() => viewFile(f)} disabled={busyId === f.id} title="View"
                      className="flex-1 h-7 rounded-md text-zinc-500 hover:text-primary hover:bg-zinc-50 flex items-center justify-center transition-colors">
                      {busyId === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
                    </button>
                  )}
                  <button onClick={() => downloadFile(f)} disabled={busyId === f.id} title="Download"
                    className="flex-1 h-7 rounded-md text-zinc-500 hover:text-primary hover:bg-zinc-50 flex items-center justify-center transition-colors">
                    {busyId === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                  </button>
                  {canEdit && (
                    <button onClick={() => setFileModal({ file: f })} title="Rename / cover"
                      className="flex-1 h-7 rounded-md text-zinc-500 hover:text-primary hover:bg-zinc-50 flex items-center justify-center transition-colors">
                      <Edit className="size-3.5" />
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => deleteFile(f)} title="Delete"
                      className="flex-1 h-7 rounded-md text-zinc-500 hover:text-red-600 hover:bg-zinc-50 flex items-center justify-center transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {fileModal && (
        <FileModal file={fileModal.file}
          onClose={() => setFileModal(null)}
          onSaved={() => { setFileModal(null); load(); onChanged(); }} />
      )}

      {preview && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-900/80 backdrop-blur-sm p-3 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-3 text-white shrink-0">
            <span className="font-semibold text-sm truncate">{preview.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              <a href={preview.url} target="_blank" rel="noreferrer"
                className="h-8 px-3 bg-white/10 hover:bg-white/20 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors">
                <ExternalLink className="size-3.5" /> New tab
              </a>
              <button onClick={closePreview}
                className="h-8 px-3 bg-white/10 hover:bg-white/20 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors">
                <X className="size-4" /> Close
              </button>
            </div>
          </div>
          <iframe src={preview.url} title={preview.name} className="flex-1 w-full rounded-lg bg-white border-0" />
        </div>
      )}
    </div>
  );
}

// =====================================================================
//  Rename a file / set its cover
// =====================================================================
function FileModal({ file, onClose, onSaved }) {
  const [name, setName]       = useState(stripExt(file.file_name));
  const [cover, setCover]     = useState(file.cover_data || null);
  const [coverTouched, setCT] = useState(false);
  const [saving, setSaving]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('A file name is required.');
    setSaving(true);
    try {
      const body = { file_name: name.trim() };
      if (coverTouched) body.cover_data = cover;
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/library/files/${file.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      onSaved();
    } catch (e2) { alert(e2.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
            <Edit className="size-4 text-primary" /> Edit File
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md"><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col overflow-hidden">
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                File Name <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input value={name} onChange={e => setName(e.target.value)} required autoFocus maxLength={240}
                  className="h-9 flex-1 bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                <span className="text-xs font-semibold text-zinc-400 uppercase shrink-0">.{file.file_ext}</span>
              </div>
              <p className="text-[11px] text-zinc-400">The .{file.file_ext} extension stays the same.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Cover Image</label>
              <CoverPicker value={cover} onChange={v => { setCover(v); setCT(true); }} />
            </div>
          </div>
          <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
            <button type="button" onClick={onClose} disabled={saving}
              className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors min-w-[120px]">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =====================================================================
//  LibraryHelp
// =====================================================================
const GUIDES = {
  manage: {
    title: 'Library',
    steps: [
      ['1 - One library per type', 'Each syllabus type (State Board, CBSE...) has its own library. You are in the library of the tab you came from.'],
      ['2 - Create a folder', 'New Folder asks for the class and subject, and lets you add a cover image. Name it like "Textbooks" or "Worksheets", or leave it blank to use the subject name.'],
      ['3 - Add files', 'Open a folder and use Upload Files, or drag files onto it. PDF, Word (.doc, .docx) and Excel (.xls, .xlsx) up to 50 MB each.'],
      ['4 - Rename & cover a file', 'Each file card has an edit button to rename it and set a cover image. The card shows who uploaded it, with the date and time.'],
      ['5 - View & download', 'Tap a PDF card to preview it in place; use New tab for full screen. Any file can be downloaded.'],
    ],
    note: 'Deleting a folder deletes every file inside it. The class you pick here is the same one used in Syllabus Management.'
  },
  view: {
    title: 'Library',
    steps: [
      ['1 - Browse', 'Pick a class to see its folders, then open a folder to see its files as cards.'],
      ['2 - View & download', 'Tap a PDF card to preview it; any file can be downloaded.'],
    ],
    note: 'This is a read-only view - folders and files are added by teachers.'
  }
};

function LibraryHelp({ canEdit = false }) {
  const [open, setOpen] = useState(false);
  const content = canEdit ? GUIDES.manage : GUIDES.view;
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 self-start">
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