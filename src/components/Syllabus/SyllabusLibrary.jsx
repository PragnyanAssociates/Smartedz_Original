import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  ArrowLeft, Library as LibraryIcon, Folder, FolderPlus, Upload, Download, Eye, Trash2, Edit,
  X, Loader2, Save, ChevronDown, ChevronRight, FileText, FileSpreadsheet, File as FileIcon,
  Search, HelpCircle, ShieldCheck, Layers, RefreshCw
} from 'lucide-react';
import { fmtDate } from './SyllabusUtils';

// =====================================================================
//  Syllabus Library
//   One library per SYLLABUS TYPE. Inside it, folders - each tied to a
//   class + subject - hold textbooks and materials (PDF, Word, Excel).
//   Uses the same remembered class filter as Syllabus Management.
// =====================================================================

const MAX_MB = 50;
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx';
const ALLOWED = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];

const classLabel = (c) => `${c.className}${c.section ? ' - ' + c.section : ''}`;
const extOf = (name = '') => (name.includes('.') ? name.split('.').pop() : '').toLowerCase();
const fmtSize = (b) => {
  const n = Number(b) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};
const readAsDataURL = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error(`Could not read ${file.name}`));
  r.readAsDataURL(file);
});

function FileTypeIcon({ ext, className = 'size-4' }) {
  if (ext === 'pdf') return <FileText className={`${className} text-red-500`} />;
  if (ext === 'xls' || ext === 'xlsx') return <FileSpreadsheet className={`${className} text-emerald-600`} />;
  if (ext === 'doc' || ext === 'docx') return <FileText className={`${className} text-blue-600`} />;
  return <FileIcon className={`${className} text-zinc-400`} />;
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

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      <div className="flex items-center">
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors w-fit">
          <ArrowLeft className="size-4" /> Back to syllabuses
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
          <button onClick={load} disabled={loading}
            className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Refresh
          </button>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map(f => (
              <div key={f.id} role="button" tabIndex={0}
                onClick={() => setOpenFolderId(f.id)}
                onKeyDown={e => { if (e.key === 'Enter') setOpenFolderId(f.id); }}
                className="group bg-white rounded-lg ring-1 ring-black/5 shadow-sm hover:ring-primary/30 transition-colors cursor-pointer p-4 flex items-start gap-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                <div className="size-10 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                  <Folder className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-zinc-900 truncate group-hover:text-primary transition-colors" title={f.name}>{f.name}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{f.subject_name} - {f.class_group}</p>
                  <p className="text-[11px] text-zinc-400 mt-2">
                    {f.file_count} file{Number(f.file_count) === 1 ? '' : 's'}
                    {Number(f.total_size) > 0 ? `, ${fmtSize(f.total_size)}` : ''}
                    {f.updated_at ? ` - updated ${fmtDate(f.updated_at)}` : ''}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex flex-col gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); setFolderModal({ editing: f }); }} title="Edit folder"
                      className="p-1.5 text-zinc-400 hover:text-primary hover:bg-zinc-50 rounded-md transition-colors">
                      <Edit className="size-3.5" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteFolder(f); }} title="Delete folder"
                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-zinc-50 rounded-md transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
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
//  Create / edit a folder (class + subject + name)
// =====================================================================
function FolderModal({ editing, syllabusType, classes, subjects, subjectClasses, defaultClassId, onClose, onSaved }) {
  const [classId, setClassId]     = useState(editing ? String(editing.class_id) : String(defaultClassId || ''));
  const [subjectId, setSubjectId] = useState(editing ? String(editing.subject_id) : '');
  const [name, setName]           = useState(editing?.name || '');
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
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg">
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
            <FolderPlus className="size-4 text-primary" /> {editing ? 'Edit Folder' : 'New Folder'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md"><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col">
          <div className="p-5 sm:p-6 space-y-4">
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
          </div>
          <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg">
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
//  Inside a folder: upload / view / download / delete files
// =====================================================================
function FolderView({ folder, canEdit, onBack, onChanged }) {
  const [files, setFiles]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [progress, setProgress] = useState(null); // { done, total } | null
  const [busyId, setBusyId]     = useState(null);
  const [dragOver, setDragOver] = useState(false);
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

  const viewFile = async (file) => {
    // open the tab first (synchronously) so pop-up blockers allow it
    const win = window.open('', '_blank');
    setBusyId(file.id);
    try {
      const blob = await fetchBlob(file, true);
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      if (win) win.location.href = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { if (win) win.close(); alert(e.message); }
    setBusyId(null);
  };

  const downloadFile = async (file) => {
    setBusyId(file.id);
    try {
      const blob = await fetchBlob(file, false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = file.file_name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
    <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm flex flex-col overflow-hidden"
      onDragOver={canEdit ? (e => { e.preventDefault(); setDragOver(true); }) : undefined}
      onDragLeave={canEdit ? (() => setDragOver(false)) : undefined}
      onDrop={canEdit ? (e => { e.preventDefault(); setDragOver(false); if (!uploading) uploadFiles(e.dataTransfer.files); }) : undefined}>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center gap-1.5 min-w-0 text-sm">
          <button onClick={onBack} className="font-semibold text-zinc-500 hover:text-primary transition-colors shrink-0">All folders</button>
          <ChevronRight className="size-3.5 text-zinc-300 shrink-0" />
          <Folder className="size-4 text-amber-500 shrink-0" />
          <span className="font-semibold text-zinc-900 truncate">{folder.name}</span>
          <span className="text-[11px] text-zinc-400 truncate hidden md:inline">- {folder.subject_name}, {folder.class_group}</span>
        </div>
        {canEdit && (
          <>
            <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden"
              onChange={e => uploadFiles(e.target.files)} />
            <button onClick={() => inputRef.current?.click()} disabled={uploading}
              className="h-9 px-4 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0">
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {uploading ? `Uploading ${progress.done}/${progress.total}...` : 'Upload Files'}
            </button>
          </>
        )}
      </div>

      {canEdit && dragOver && (
        <div className="m-3 rounded-md border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center text-sm font-semibold text-primary">
          Drop PDF, Word or Excel files to upload
        </div>
      )}

      {loading ? (
        <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin size-7 text-primary" /></div>
      ) : files.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center">
          <FileText className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">This folder is empty.</p>
          {canEdit && <p className="text-zinc-400 text-xs mt-1.5">Upload PDF, Word or Excel files (up to {MAX_MB} MB each), or drag them here.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead className="bg-zinc-50/80">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">File</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-20">Type</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-24">Size</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 w-44">Uploaded</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {files.map(f => (
                <tr key={f.id} className="hover:bg-zinc-50/60 transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileTypeIcon ext={f.file_ext} />
                      <span className="text-sm font-medium text-zinc-900 truncate max-w-[380px]" title={f.file_name}>{f.file_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[11px] font-semibold text-zinc-500 uppercase">{f.file_ext}</td>
                  <td className="px-5 py-3 text-xs text-zinc-600 tabular-nums">{fmtSize(f.file_size)}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="text-xs font-semibold text-zinc-700">{f.uploaded_by_name || '-'}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">{fmtDate(f.created_at)}</div>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {f.file_ext === 'pdf' && (
                        <button onClick={() => viewFile(f)} disabled={busyId === f.id} title="View"
                          className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                          <Eye className="size-3.5" />
                        </button>
                      )}
                      <button onClick={() => downloadFile(f)} disabled={busyId === f.id} title="Download"
                        className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                        {busyId === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                      </button>
                      {canEdit && (
                        <button onClick={() => deleteFile(f)} title="Delete"
                          className="size-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-red-600 rounded-md flex items-center justify-center transition-colors shadow-sm ring-1 ring-black/5">
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
      ['2 - Create a folder', 'New Folder asks for the class and subject. Give it a name like "Textbooks" or "Worksheets", or leave it blank to use the subject name.'],
      ['3 - Add files', 'Open a folder and use Upload Files, or drag files onto it. PDF, Word (.doc, .docx) and Excel (.xls, .xlsx) up to 50 MB each.'],
      ['4 - Open and share', 'PDFs open in a new tab with the eye button; every file can be downloaded.'],
    ],
    note: 'Deleting a folder deletes every file inside it. The class you pick here is the same one used in Syllabus Management.'
  },
  view: {
    title: 'Library',
    steps: [
      ['1 - Browse', 'Pick a class to see its folders, then open a folder to see its files.'],
      ['2 - Open and download', 'PDFs open in a new tab with the eye button; any file can be downloaded.'],
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