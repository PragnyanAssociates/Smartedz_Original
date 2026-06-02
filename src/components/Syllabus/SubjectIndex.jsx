import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  FolderOpen, FileText, Loader2, Plus, Trash2, Edit, X, Upload,
  Maximize2, Tag, Search, BookMarked, ArrowLeft, Clock, Save, BookOpen, RefreshCw
} from 'lucide-react';
import { pageLabel, fileToBase64 } from './SyllabusUtils';

// =====================================================================
//  Subject Index — textbook-first, auto-detected chapters.
//    LEFT   - Chapters (auto from the book's index; edit/delete to fix)
//    MIDDLE - PDF viewer showing ONLY the selected chapter's pages
//    RIGHT  - Keywords for the selected chapter
// =====================================================================

export default function SubjectIndex({ syllabus, canEdit, activeYear, onBack, onOpenPeriods }) {
  const [chapters, setChapters] = useState([]);
  const [book, setBook]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUp]      = useState(false);
  const [selectedId, setSelId]  = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, bRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/syllabus/${syllabus.id}/chapters`),
        fetch(`${API_BASE_URL}/admin/syllabus/${syllabus.id}/book`)
      ]);
      const c = await cRes.json();
      const b = await bRes.json();
      setChapters(Array.isArray(c) ? c : []);
      setBook(b || null);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [syllabus]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (chapters.length > 0 && !chapters.some(c => c.id === selectedId)) setSelId(chapters[0].id);
    if (chapters.length === 0) setSelId(null);
  }, [chapters, selectedId]);

  const selected = useMemo(
    () => chapters.find(c => c.id === selectedId) || null,
    [chapters, selectedId]
  );

  const hasBook = !!book && (book.has_book === 1 || book.has_book === true);

  const uploadTextbook = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (chapters.length > 0 && !window.confirm(
        'Re-reading the textbook rebuilds the chapter list from its index. ' +
        'Existing chapters and their keywords will be replaced. Continue?'
      )) return;

      setUp(true);
      try {
        const obj = await fileToBase64(file, 80);
        const res = await fetch(`${API_BASE_URL}/admin/syllabus/${syllabus.id}/book`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_name: obj.name, doc_data: obj.data })
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Upload failed');
        await loadAll();
      } catch (err) { alert(err.message); }
      setUp(false);
    };
    input.click();
  }, [syllabus, chapters, loadAll]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">

      <div className="flex items-center">
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors w-fit">
          <ArrowLeft className="size-4" /> Back to syllabuses
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2">
        <header className="flex flex-col">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
              <BookOpen className="text-primary size-5" />
              Subject Index
            </h1>
            {activeYear && (
              <span className="bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ring-1 ring-inset ring-primary/20">
                {activeYear.year_name || activeYear.name || ''}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Upload the textbook and the chapters are detected from its index.
          </p>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mt-1.5">
            {syllabus.class_group} - {syllabus.subject_name}
          </p>
        </header>

        <button onClick={onOpenPeriods}
          className="h-9 px-4 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-md font-semibold text-xs shadow-sm transition-colors w-full sm:w-auto shrink-0">
          <Clock className="size-3.5" /> Lesson Periods
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin size-8 text-primary" />
        </div>
      ) : !hasBook ? (
        <div className="bg-white rounded-lg ring-1 ring-black/5 border-dashed shadow-sm flex-1 flex items-center justify-center min-h-[440px]">
          <div className="text-center p-8 max-w-md">
            <div className="size-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <BookOpen className="size-7" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Upload the textbook to begin</h3>
            <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">
              Upload the subject PDF and the chapters will be detected from its
              index automatically — an Index entry, then each chapter with its pages.
            </p>
            {canEdit ? (
              <button onClick={uploadTextbook} disabled={uploading}
                className="mt-5 h-10 px-5 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-sm shadow-sm transition-colors">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {uploading ? 'Reading textbook…' : 'Upload Textbook PDF'}
              </button>
            ) : (
              <p className="mt-4 text-xs text-zinc-400">No textbook uploaded yet.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 flex-1 items-start">
          <div className="lg:col-span-4 xl:col-span-3">
            <ChaptersPanel
              chapters={chapters} selectedId={selectedId} canEdit={canEdit}
              onSelect={setSelId} reload={loadAll} syllabusId={syllabus.id}
              book={book} onReplace={uploadTextbook} uploading={uploading} />
          </div>
          <div className="lg:col-span-8 xl:col-span-6 h-full flex flex-col">
            <DocumentPanel chapter={selected} />
          </div>
          <div className="lg:col-span-12 xl:col-span-3">
            <KeywordsPanel chapter={selected} canEdit={canEdit} />
          </div>
        </div>
      )}
    </div>
  );
}


// =====================================================================
//  LEFT - Chapters
// =====================================================================
function ChaptersPanel({ chapters, selectedId, canEdit, onSelect, reload, syllabusId, book, onReplace, uploading }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm] = useState({ title: '', page_from: '', page_to: '' });
  const [saving, setSaving] = useState(false);

  const [offset, setOffset]    = useState(book?.page_offset ?? 0);
  const [savingOff, setSavOff] = useState(false);
  useEffect(() => { setOffset(book?.page_offset ?? 0); }, [book]);

  const saveOffset = async () => {
    setSavOff(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/${syllabusId}/book/offset`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_offset: parseInt(offset, 10) || 0 })
      });
      if (!res.ok) throw new Error('Could not save offset');
      reload();
    } catch (e) { alert(e.message); }
    setSavOff(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', page_from: '', page_to: '' });
    setModalOpen(true);
  };
  const openEdit = (ch) => {
    setEditing(ch);
    setForm({ title: ch.title || '', page_from: ch.page_from || '', page_to: ch.page_to || '' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return alert('Chapter title is required.');
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        page_from: form.page_from ? parseInt(form.page_from, 10) : null,
        page_to: form.page_to ? parseInt(form.page_to, 10) : null
      };
      let res;
      if (editing) {
        res = await fetch(`${API_BASE_URL}/admin/syllabus/chapters/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } else {
        res = await fetch(`${API_BASE_URL}/admin/syllabus/chapters`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, syllabus_id: syllabusId })
        });
      }
      if (!res.ok) throw new Error('Save failed');
      setModalOpen(false);
      reload();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleDelete = async (ch) => {
    if (!window.confirm(`Delete chapter "${ch.title}"? Its keywords will be removed.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/chapters/${ch.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      reload();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm flex flex-col overflow-hidden max-h-[800px]">
      <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
        <div className="flex items-center gap-2">
          <FolderOpen className="size-4 text-primary" />
          <h3 className="font-semibold text-sm text-zinc-900">Chapters</h3>
        </div>
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
          {chapters.length} items{book?.doc_pages ? ` · ${book.doc_pages}p` : ''}
        </span>
      </div>

      <div className="overflow-y-auto custom-scrollbar flex-1 p-2 space-y-1">
        {chapters.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-400 font-medium">No chapters detected.</p>
        ) : chapters.map((ch) => (
          <div key={ch.id}
            className={`group rounded-md transition-all cursor-pointer ring-1 ring-inset ${
              selectedId === ch.id
                ? 'bg-primary/5 ring-primary/20 shadow-sm'
                : 'bg-white ring-transparent hover:ring-black/5 hover:bg-zinc-50'
            }`}
            onClick={() => onSelect(ch.id)}>
            <div className="p-3 flex items-start gap-3">
              <BookMarked className={`size-4 mt-0.5 shrink-0 transition-colors ${selectedId === ch.id ? 'text-primary' : 'text-zinc-400'}`} />
              <div className="min-w-0 flex-1">
                <p className={`font-semibold text-sm leading-tight transition-colors truncate ${
                  selectedId === ch.id ? 'text-primary' : 'text-zinc-900 group-hover:text-primary'
                }`}>
                  {ch.title}
                </p>
                {pageLabel(ch.page_from, ch.page_to) && (
                  <span className="inline-block text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded mt-1.5">
                    {pageLabel(ch.page_from, ch.page_to)}
                  </span>
                )}
              </div>
              {canEdit && (
                <div className="flex flex-col gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); openEdit(ch); }}
                    className="p-1.5 text-zinc-400 hover:text-primary hover:bg-white rounded-md transition-colors shadow-sm ring-1 ring-transparent hover:ring-black/5">
                    <Edit className="size-3.5" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(ch); }}
                    className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-white rounded-md transition-colors shadow-sm ring-1 ring-transparent hover:ring-black/5">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="p-3 border-t border-zinc-100 bg-zinc-50/50 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider shrink-0" title="If the book's printed page 1 is not the PDF's first page, set the difference here.">
              Page offset
            </label>
            <input type="number" value={offset}
              onChange={e => setOffset(e.target.value)}
              className="h-8 w-16 bg-white border border-zinc-200 rounded-md px-2 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm" />
            <button onClick={saveOffset} disabled={savingOff}
              className="h-8 px-3 bg-white ring-1 ring-black/5 shadow-sm hover:bg-zinc-50 text-zinc-700 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-all">
              {savingOff ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Apply
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={openCreate}
              className="h-9 flex-1 bg-white ring-1 ring-black/5 shadow-sm hover:bg-zinc-50 hover:ring-black/10 text-zinc-700 rounded-md font-semibold text-xs flex items-center justify-center gap-1.5 transition-all">
              <Plus className="size-3.5" /> Add Chapter
            </button>
            <button onClick={onReplace} disabled={uploading} title="Re-upload the textbook and re-detect chapters"
              className="h-9 px-3 bg-white ring-1 ring-black/5 shadow-sm hover:bg-zinc-50 hover:ring-black/10 text-zinc-700 rounded-md font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shrink-0">
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Replace
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md shadow-xl relative flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h3 className="text-lg font-semibold text-zinc-900">{editing ? 'Edit Chapter' : 'Add Chapter'}</h3>
              <button onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    Chapter Title <span className="text-red-500">*</span>
                  </label>
                  <input value={form.title} required
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Relief Features"
                    className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Page From</label>
                    <input type="number" value={form.page_from}
                      onChange={e => setForm({ ...form, page_from: e.target.value })}
                      className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Page To</label>
                    <input type="number" value={form.page_to}
                      onChange={e => setForm({ ...form, page_to: e.target.value })}
                      className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
                <button type="button" onClick={() => setModalOpen(false)} disabled={saving}
                  className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">
                  {saving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
                  {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Add Chapter')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


// =====================================================================
//  MIDDLE - PDF viewer (iframe points straight at the chapter PDF URL)
// =====================================================================
function DocumentPanel({ chapter }) {
  if (!chapter) {
    return (
      <div className="bg-white rounded-lg ring-1 ring-black/5 border-dashed shadow-sm flex items-center justify-center min-h-[500px] xl:min-h-[600px] w-full flex-1">
        <p className="text-zinc-400 font-medium text-sm">Select a chapter from the list.</p>
      </div>
    );
  }

  const url = `${API_BASE_URL}/admin/syllabus/chapter/${chapter.id}/pdf`;
  const openFull = () => window.open(url, '_blank');

  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm flex flex-col min-h-[500px] xl:min-h-[600px] flex-1 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50/50 gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-4 text-primary shrink-0" />
          <h3 className="font-semibold text-sm text-zinc-900 truncate">{chapter.title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {pageLabel(chapter.page_from, chapter.page_to) && (
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mr-1">
              {pageLabel(chapter.page_from, chapter.page_to)}
            </span>
          )}
          <button onClick={openFull} title="Open full screen"
            className="size-8 inline-flex items-center justify-center text-zinc-500 hover:text-primary hover:bg-primary/10 rounded-md transition-colors bg-white ring-1 ring-black/5 shadow-sm">
            <Maximize2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="bg-zinc-100/50 flex-1 flex flex-col w-full">
        <iframe key={chapter.id} src={url} title={chapter.title}
          className="w-full h-full border-0 min-h-[500px]" />
      </div>
    </div>
  );
}


// =====================================================================
//  RIGHT - Keywords  (now: Term + Definition + Example)
// =====================================================================
function KeywordsPanel({ chapter, canEdit }) {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [query, setQuery]       = useState('');
  const [adding, setAdding]     = useState(false);
  const [newTerm, setNewTerm]   = useState('');
  const [newDef, setNewDef]     = useState('');
  const [newExample, setNewEx]  = useState('');

  const load = useCallback(async () => {
    if (!chapter) { setKeywords([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/chapter/${chapter.id}/keywords`);
      const d = await res.json();
      setKeywords(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [chapter]);

  useEffect(() => { load(); setAdding(false); setQuery(''); }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return keywords;
    const q = query.toLowerCase();
    return keywords.filter(k =>
      (k.term || '').toLowerCase().includes(q) ||
      (k.definition || '').toLowerCase().includes(q) ||
      (k.example || '').toLowerCase().includes(q));
  }, [keywords, query]);

  const resetForm = () => { setNewTerm(''); setNewDef(''); setNewEx(''); };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTerm.trim() || !newDef.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/chapter/${chapter.id}/keywords`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: newTerm.trim(),
          definition: newDef.trim(),
          example: newExample.trim() || null
        })
      });
      if (!res.ok) throw new Error('Could not add keyword');
      resetForm(); setAdding(false);
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/keywords/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm flex flex-col h-full max-h-[800px] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="size-4 text-primary shrink-0" />
          <h3 className="font-semibold text-sm text-zinc-900 truncate">Keywords</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider bg-white ring-1 ring-black/5 px-2 py-0.5 rounded">
            {keywords.length} items
          </span>
          {canEdit && chapter && (
            <button onClick={() => { setAdding(a => !a); if (adding) resetForm(); }}
              className="size-7 bg-primary/10 text-primary hover:bg-primary/20 rounded-md flex items-center justify-center transition-colors">
              {adding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            </button>
          )}
        </div>
      </div>

      {!chapter ? (
        <div className="p-8 text-center h-full flex flex-col justify-center">
          <p className="text-sm text-zinc-400 font-medium">Select a chapter.</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 p-3 overflow-hidden">
          {canEdit && adding && (
            <form onSubmit={handleAdd} className="bg-zinc-50 ring-1 ring-inset ring-black/5 rounded-md p-3 mb-4 space-y-2.5 shrink-0">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  Keyword / Term <span className="text-red-500">*</span>
                </label>
                <input value={newTerm} onChange={e => setNewTerm(e.target.value)} required
                  placeholder="e.g. Photosynthesis"
                  className="h-8 w-full bg-white border border-zinc-200 rounded-md px-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  Definition <span className="text-red-500">*</span>
                </label>
                <textarea value={newDef} onChange={e => setNewDef(e.target.value)} required rows={2}
                  placeholder="What the term means"
                  className="w-full bg-white border border-zinc-200 rounded-md px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors resize-y leading-relaxed" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Example
                </label>
                <textarea value={newExample} onChange={e => setNewEx(e.target.value)} rows={2}
                  placeholder="A sentence or case that illustrates it"
                  className="w-full bg-white border border-zinc-200 rounded-md px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors resize-y leading-relaxed" />
              </div>

              <button type="submit" disabled={!newTerm.trim() || !newDef.trim()}
                className="h-8 w-full bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs transition-colors shadow-sm mt-1">
                Add Keyword
              </button>
            </form>
          )}

          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-3.5" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search keywords..."
              className="h-8 w-full bg-white border border-zinc-200 rounded-md pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
          </div>

          <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2 pb-2">
            {loading ? (
              <div className="py-10 text-center"><Loader2 className="animate-spin size-6 text-primary mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-400 font-medium">
                {keywords.length === 0 ? 'No keywords yet.' : 'No matches found.'}
              </p>
            ) : filtered.map(k => (
              <div key={k.id} className="group bg-white ring-1 ring-black/5 rounded-md p-3 flex items-start gap-3 hover:ring-black/10 transition-shadow">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-zinc-900 leading-tight">{k.term}</p>
                  {k.definition && (
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{k.definition}</p>
                  )}
                  {k.example && (
                    <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed bg-zinc-50 ring-1 ring-inset ring-black/5 rounded px-2 py-1">
                      <span className="font-semibold text-zinc-600">Example: </span>
                      <span className="text-zinc-500 italic">{k.example}</span>
                    </p>
                  )}
                </div>
                {canEdit && (
                  <button onClick={() => handleDelete(k.id)}
                    className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}