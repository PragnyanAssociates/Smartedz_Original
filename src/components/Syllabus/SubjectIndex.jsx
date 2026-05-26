import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  FolderOpen, FileText, Loader2, Plus, Trash2, Edit, X, Upload,
  Maximize2, Tag, Search, BookMarked, ArrowLeft, Clock
} from 'lucide-react';
import { pageLabel, fileToBase64 } from './SyllabusUtils';

// =====================================================================
//  Subject Index — three-panel screen for ONE syllabus (image 1).
//    LEFT   — Chapters list (select, add, edit, delete)
//    MIDDLE — PDF viewer for the selected chapter (upload / re-upload)
//    RIGHT  — Keywords for the selected chapter (search, add, delete)
//
//  Top bar:  "Back" → Syllabus Management
//            "Periods" button → Lesson Periods screen for this syllabus
// =====================================================================

export default function SubjectIndex({ syllabus, canEdit, activeYear, onBack, onOpenPeriods }) {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selectedId, setSelId]  = useState(null);

  const loadChapters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/${syllabus.id}/chapters`);
      const d = await res.json();
      setChapters(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [syllabus]);

  useEffect(() => { loadChapters(); }, [loadChapters]);

  useEffect(() => {
    if (chapters.length > 0 && !chapters.some(c => c.id === selectedId)) {
      setSelId(chapters[0].id);
    }
    if (chapters.length === 0) setSelId(null);
  }, [chapters, selectedId]);

  const selected = useMemo(
    () => chapters.find(c => c.id === selectedId) || null,
    [chapters, selectedId]
  );

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="relative flex flex-col items-center text-center">
        <button onClick={onBack}
          className="sm:absolute sm:left-0 sm:top-0 inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600 mb-3 sm:mb-0">
          <ArrowLeft size={15} /> Back
        </button>
        <button onClick={onOpenPeriods}
          className="sm:absolute sm:right-0 sm:top-0 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 mb-3 sm:mb-0">
          <Clock size={16} /> Periods
        </button>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Subject Index</h2>
        {activeYear && (
          <span className="mt-1 inline-block bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1 rounded-lg">
            {activeYear.year_name || activeYear.name || ''}
          </span>
        )}
        <p className="text-slate-500 font-medium mt-1">Browse chapters and manage key vocabulary</p>
        <p className="text-sm font-bold text-slate-400 mt-1">
          {syllabus.class_group} · {syllabus.subject_name}
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-3">
            <ChaptersPanel
              chapters={chapters} selectedId={selectedId} canEdit={canEdit}
              onSelect={setSelId} reload={loadChapters} syllabusId={syllabus.id} />
          </div>
          <div className="lg:col-span-6">
            <DocumentPanel chapter={selected} canEdit={canEdit} reload={loadChapters} />
          </div>
          <div className="lg:col-span-3">
            <KeywordsPanel chapter={selected} canEdit={canEdit} />
          </div>
        </div>
      )}
    </div>
  );
}


// =====================================================================
//  LEFT — Chapters
// =====================================================================
function ChaptersPanel({ chapters, selectedId, canEdit, onSelect, reload, syllabusId }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm] = useState({ title: '', page_from: '', page_to: '' });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', page_from: '', page_to: '' });
    setModalOpen(true);
  };
  const openEdit = (ch) => {
    setEditing(ch);
    setForm({
      title: ch.title || '',
      page_from: ch.page_from || '',
      page_to: ch.page_to || ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
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
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } else {
        res = await fetch(`${API_BASE_URL}/admin/syllabus/chapters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    if (!window.confirm(`Delete chapter "${ch.title}"? Its keywords and PDF will be removed.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/chapters/${ch.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      reload();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between p-5 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <FolderOpen size={18} className="text-blue-600" />
          <h3 className="font-black text-slate-800">Chapters</h3>
        </div>
        <span className="text-xs font-bold text-slate-400">{chapters.length} ch</span>
      </div>

      <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
        {chapters.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400 italic">No chapters yet.</p>
        ) : chapters.map(ch => (
          <div key={ch.id}
            className={`group rounded-2xl border transition-all cursor-pointer ${
              selectedId === ch.id
                ? 'border-blue-200 bg-blue-50'
                : 'border-slate-100 hover:bg-slate-50'
            }`}
            onClick={() => onSelect(ch.id)}>
            <div className="p-3.5 flex items-start gap-2.5">
              <BookMarked size={16}
                className={selectedId === ch.id ? 'text-blue-600 mt-0.5' : 'text-slate-300 mt-0.5'} />
              <div className="min-w-0 flex-1">
                <p className={`font-bold text-sm leading-snug ${
                  selectedId === ch.id ? 'text-blue-700' : 'text-slate-700'
                }`}>{ch.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  {pageLabel(ch.page_from, ch.page_to) && (
                    <span className="text-[11px] font-medium text-slate-400">
                      {pageLabel(ch.page_from, ch.page_to)}
                    </span>
                  )}
                  {ch.keyword_count > 0 && (
                    <span className="text-[10px] font-bold text-blue-500 inline-flex items-center gap-0.5">
                      <Tag size={9} /> {ch.keyword_count}
                    </span>
                  )}
                </div>
              </div>
              {canEdit && (
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); openEdit(ch); }}
                    className="p-1 text-slate-300 hover:text-blue-500">
                    <Edit size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(ch); }}
                    className="p-1 text-slate-300 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="p-3 border-t border-slate-50">
          <button onClick={openCreate}
            className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
            <Plus size={14} /> Add Chapter
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative">
            <button onClick={() => setModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">
              <X size={22} />
            </button>
            <h3 className="text-xl font-black mb-5 text-slate-800">
              {editing ? 'Edit Chapter' : 'Add Chapter'}
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Chapter Title <span className="text-red-500">*</span>
                </label>
                <input value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. 1 relief features"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Page From</label>
                  <input type="number" value={form.page_from}
                    onChange={e => setForm({ ...form, page_from: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Page To</label>
                  <input type="number" value={form.page_to}
                    onChange={e => setForm({ ...form, page_to: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
                </div>
              </div>
              <button onClick={handleSave} disabled={saving}
                className="w-full bg-slate-900 hover:bg-blue-600 disabled:bg-slate-300 text-white py-3 rounded-xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add Chapter')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// =====================================================================
//  MIDDLE — PDF document viewer
// =====================================================================
function DocumentPanel({ chapter, canEdit, reload }) {
  const [doc, setDoc]         = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUp]    = useState(false);

  const loadDoc = useCallback(async () => {
    if (!chapter || !chapter.has_doc) { setDoc(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/chapter/${chapter.id}/doc`);
      const d = await res.json();
      setDoc(d && d.doc_data ? d : null);
    } catch (e) { console.error(e); setDoc(null); }
    setLoading(false);
  }, [chapter]);

  useEffect(() => { loadDoc(); }, [loadDoc]);

  const handleUpload = () => {
    if (!chapter) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUp(true);
      try {
        const obj = await fileToBase64(file, 15);
        const pages = window.prompt('How many pages does this document have? (optional)');
        const res = await fetch(`${API_BASE_URL}/admin/syllabus/chapter/${chapter.id}/doc`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doc_name: obj.name,
            doc_data: obj.data,
            doc_pages: pages ? parseInt(pages, 10) : null
          })
        });
        if (!res.ok) throw new Error('Upload failed');
        await reload();
        await loadDoc();
      } catch (err) { alert(err.message); }
      setUp(false);
    };
    input.click();
  };

  const openFull = () => {
    if (!doc?.doc_data) return;
    const w = window.open();
    if (w) w.document.write(
      `<iframe src="${doc.doc_data}" style="width:100%;height:100%;border:0"></iframe>`);
  };

  if (!chapter) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm h-full flex items-center justify-center min-h-[400px]">
        <p className="text-slate-400 font-medium italic">Select a chapter.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={18} className="text-blue-600 shrink-0" />
          <h3 className="font-bold text-slate-800 truncate">{chapter.title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <button onClick={handleUpload} disabled={uploading}
              className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {chapter.has_doc ? 'Re-upload' : 'Upload PDF'}
            </button>
          )}
          {doc && (
            <button onClick={openFull}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg">
              <Maximize2 size={15} />
            </button>
          )}
          {chapter.doc_pages ? (
            <span className="text-xs font-bold text-slate-400">{chapter.doc_pages} pages</span>
          ) : null}
        </div>
      </div>

      <div className="bg-slate-100 h-[560px] flex items-center justify-center">
        {loading ? (
          <Loader2 className="animate-spin w-7 h-7 text-blue-600" />
        ) : doc?.doc_data ? (
          <iframe src={doc.doc_data} title={chapter.title}
            className="w-full h-full border-0" />
        ) : (
          <div className="text-center px-8">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 font-medium text-sm">
              {canEdit
                ? 'No document uploaded. Click "Upload PDF" above.'
                : 'No document available for this chapter.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


// =====================================================================
//  RIGHT — Keywords
// =====================================================================
function KeywordsPanel({ chapter, canEdit }) {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [query, setQuery]       = useState('');
  const [adding, setAdding]     = useState(false);
  const [newTerm, setNewTerm]   = useState('');
  const [newDef, setNewDef]     = useState('');

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
      (k.definition || '').toLowerCase().includes(q));
  }, [keywords, query]);

  const handleAdd = async () => {
    if (!newTerm.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/syllabus/chapter/${chapter.id}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: newTerm.trim(), definition: newDef.trim() || null })
      });
      if (!res.ok) throw new Error('Could not add keyword');
      setNewTerm(''); setNewDef(''); setAdding(false);
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
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between p-5 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <Tag size={18} className="text-blue-600" />
          <h3 className="font-black text-slate-800">Keywords</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-black text-slate-500">
            {keywords.length}
          </span>
          {canEdit && chapter && (
            <button onClick={() => setAdding(a => !a)}
              className="w-7 h-7 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full flex items-center justify-center transition-all">
              {adding ? <X size={14} /> : <Plus size={14} />}
            </button>
          )}
        </div>
      </div>

      {!chapter ? (
        <p className="p-8 text-center text-sm text-slate-400 italic">Select a chapter.</p>
      ) : (
        <div className="p-4">
          <p className="text-xs font-bold text-slate-400 mb-3 truncate">{chapter.title}</p>

          {canEdit && adding && (
            <div className="bg-slate-50 rounded-2xl p-3 mb-3 space-y-2">
              <input value={newTerm} onChange={e => setNewTerm(e.target.value)}
                placeholder="Keyword / term"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
              <input value={newDef} onChange={e => setNewDef(e.target.value)}
                placeholder="Meaning (optional)"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
              <button onClick={handleAdd}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider">
                Add Keyword
              </button>
            </div>
          )}

          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search keywords…"
              className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
          </div>

          <div className="space-y-2 max-h-[42vh] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center"><Loader2 className="animate-spin w-5 h-5 text-blue-600 mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-300 italic">
                {keywords.length === 0 ? 'No keywords yet' : 'No matches'}
              </p>
            ) : filtered.map(k => (
              <div key={k.id} className="group bg-slate-50 rounded-xl p-3 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-700">{k.term}</p>
                  {k.definition && (
                    <p className="text-xs text-slate-500 mt-0.5">{k.definition}</p>
                  )}
                </div>
                {canEdit && (
                  <button onClick={() => handleDelete(k.id)}
                    className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={13} />
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