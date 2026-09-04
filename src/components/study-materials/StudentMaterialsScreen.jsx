"use client"
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL, SERVER_URL } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { 
  FolderOpen, Download, ExternalLink, FlaskConical, Calculator, 
  BookOpen, Languages, Activity, Book, Search, Loader2, Eye, User, Clock,
  X, Info
} from 'lucide-react';

// Render a UTC timestamp (Railway stores UTC) as IST for display.
const fmtIST = (val) => {
  if (!val) return '';
  let d;
  if (typeof val === 'string' && !val.includes('T') && !val.endsWith('Z')) {
    d = new Date(val.replace(' ', 'T') + 'Z');
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const getSubjectIcon = (subject) => {
  const lower = (subject || '').toLowerCase();
  if (lower.includes('science')) return FlaskConical;
  if (lower.includes('math')) return Calculator;
  if (lower.includes('history')) return BookOpen;
  if (lower.includes('english')) return Languages;
  if (lower.includes('physical')) return Activity;
  return Book;
};
// Clean, subtle pastel aesthetics matching the Teacher layout
const getSubjectAesthetics = (subject) => {
  const lower = (subject || '').toLowerCase();
  if (lower.includes("science")) return { bg: "bg-emerald-50 text-emerald-600 ring-emerald-600/20" };
  if (lower.includes("math")) return { bg: "bg-sky-50 text-sky-600 ring-sky-600/20" };
  if (lower.includes("history")) return { bg: "bg-amber-50 text-amber-600 ring-amber-600/20" };
  if (lower.includes("english")) return { bg: "bg-rose-50 text-rose-600 ring-rose-600/20" };
  return { bg: "bg-indigo-50 text-indigo-600 ring-indigo-600/20" };
};

// =====================================================================
//  File helpers - shared by the card and the detail modal.
//
//  A material can carry a file, an external link, or BOTH, so the card
//  only opens the detail view and every action lives inside it.
// =====================================================================
const isDataUrl = (p) => !!p && String(p).startsWith('data:');

const dataMime = (p) => {
  const m = /^data:([^;,]+)/i.exec(String(p || ''));
  return m ? m[1].toLowerCase() : '';
};

// What kind of file is this? Drives whether a browser preview is possible.
const fileKind = (filePath) => {
  const p = String(filePath || '');
  if (!p) return 'none';
  if (isDataUrl(p)) {
    const mime = dataMime(p);
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('text/')) return 'text';
    if (/word|excel|spreadsheet|presentation|powerpoint|officedocument|msword|ms-excel|ms-powerpoint|opendocument/.test(mime)) return 'office';
    return 'other';
  }
  if (/\.pdf(\?|$)/i.test(p)) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(p)) return 'image';
  if (/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(p)) return 'video';
  if (/\.(mp3|wav|m4a|aac)(\?|$)/i.test(p)) return 'audio';
  if (/\.(docx?|xlsx?|pptx?|odt|ods|odp)(\?|$)/i.test(p)) return 'office';
  if (/\.(txt|csv|md|json)(\?|$)/i.test(p)) return 'text';
  return 'other';
};

const fileUrlOf = (item) =>
  isDataUrl(item.file_path) ? item.file_path : `${SERVER_URL.replace('/api', '')}${item.file_path}`;

// Absolute URL, so an online Office viewer has something it can fetch.
const absoluteUrl = (u) => {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (typeof window === 'undefined') return u;
  return `${window.location.origin}${u.startsWith('/') ? '' : '/'}${u}`;
};

// The Microsoft / Google viewers fetch the file from the internet, so a
// localhost or private-network address can never work.
const isReachableOnline = (u) =>
  /^https?:\/\//i.test(u) &&
  !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(u) &&
  !/^https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u);

// Office files can only be previewed when they sit on a public URL.
const canPreviewFile = (item) => {
  const kind = fileKind(item.file_path);
  if (kind === 'none') return false;
  if (kind === 'office') return !isDataUrl(item.file_path) && isReachableOnline(absoluteUrl(fileUrlOf(item)));
  return kind !== 'other';
};

const downloadMaterialFile = (item) => {
  const url = fileUrlOf(item);
  if (isDataUrl(item.file_path)) {
    fetch(url)
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', item.title || 'download');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => alert('Failed to prepare file for download.'));
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', item.title || 'download');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const viewMaterialFile = (item) => {
  const kind = fileKind(item.file_path);
  const raw = fileUrlOf(item);

  // Word / PowerPoint / Excel need an online viewer, which needs a public
  // URL. Anything else we can open directly.
  if (kind === 'office') {
    const abs = absoluteUrl(raw);
    if (!isDataUrl(item.file_path) && isReachableOnline(abs)) {
      window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(abs)}`, '_blank');
      return;
    }
    downloadMaterialFile(item);
    return;
  }

  if (isDataUrl(item.file_path)) {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.body.innerHTML = '<div style="font-family: sans-serif; padding: 20px; text-align: center;">Loading document...</div>';
    fetch(raw)
      .then(res => res.blob())
      .then(blob => { win.location.href = URL.createObjectURL(blob); })
      .catch(() => {
        win.document.body.innerHTML = '<div style="font-family: sans-serif; padding: 20px; color: red; text-align: center;">Failed to load document.</div>';
      });
    return;
  }

  window.open(absoluteUrl(raw), '_blank');
};

export default function StudentMaterialsScreen() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [viewingMaterial, setViewingMaterial] = useState(null);

  const fetchMaterials = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/study-materials/student/${user.id}`);
      const data = await res.json();
      setMaterials(Array.isArray(data) ? data : []);
    } catch (error) { 
      console.error(error); 
    } finally { 
      setIsLoading(false); 
    }
  }, [user]);
  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);
  const filteredMaterials = useMemo(() => {
    if (!query) return materials;
    const q = query.toLowerCase();
    return materials.filter(m =>
      (m.title && m.title.toLowerCase().includes(q)) ||
      (m.subject_name && m.subject_name.toLowerCase().includes(q)) ||
      (m.uploaded_by_name && m.uploaded_by_name.toLowerCase().includes(q))
    );
  }, [materials, query]);
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      
      <header className="flex flex-col mb-2 sm:mb-0">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
          <BookOpen className="text-primary size-5" />
          Study Materials
        </h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">View and access your class resources.</p>
      </header>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search materials..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
        </div>
      </div>
      <div className="flex-1">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin size-8 text-primary" />
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <FolderOpen className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">No study materials available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredMaterials.map((item) => {
              const Icon = getSubjectIcon(item.subject_name);
              const aesthetics = getSubjectAesthetics(item.subject_name);
              const hasFile = !!item.file_path;
              const hasLink = !!item.external_link;

              return (
                <div key={item.id} className="group bg-white rounded-lg ring-1 ring-black/5 shadow-sm flex flex-col hover:ring-primary/30 hover:shadow-md transition-all overflow-hidden relative">
                  
                  {/* Main Content Area */}
                  <div className="p-4 sm:p-5 flex flex-col flex-grow">
                    {/* Header: Icon + Title inline */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-inset ${aesthetics.bg}`}>
                        <Icon className="size-5" />
                      </div>
                      <div className="flex flex-col min-w-0 pt-0.5">
                        <h3 className="font-semibold text-zinc-900 text-[15px] leading-tight line-clamp-2">{item.title}</h3>
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mt-1">
                          {item.material_type}
                        </span>
                      </div>
                    </div>

                    {/* Uploaded-by + date/time (IST) */}
                    {(item.uploaded_by_name || item.created_at) && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400 mb-3">
                        {item.uploaded_by_name && (
                          <span className="inline-flex items-center gap-1">
                            <User className="size-3 shrink-0" /> {item.uploaded_by_name}
                          </span>
                        )}
                        {item.created_at && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3 shrink-0" /> {fmtIST(item.created_at)}
                          </span>
                        )}
                      </div>
                    )}

                    {item.subject_name && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-1 rounded">
                          {item.subject_name}
                        </span>
                      </div>
                    )}
                    {item.description && <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{item.description}</p>}
                  </div>
                  
                  {/* Footer Area - one Open button; everything this material
                      carries is listed inside it. */}
                  <div className="bg-zinc-50/80 border-t border-zinc-100 p-3 sm:p-4 shrink-0 mt-auto space-y-2">
                    <button onClick={() => setViewingMaterial(item)}
                      className="w-full h-9 bg-primary hover:bg-primary/90 text-white font-semibold text-xs rounded-md flex justify-center items-center gap-1.5 shadow-sm transition-colors">
                      <FolderOpen className="size-3.5" /> Open
                    </button>
                    <p className="text-[10px] font-medium text-zinc-400 text-center">
                      {hasFile && hasLink ? 'File and link attached'
                        : hasFile ? 'File attached'
                        : hasLink ? 'Link attached'
                        : 'Details only'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewingMaterial && (
        <MaterialViewerModal item={viewingMaterial} onClose={() => setViewingMaterial(null)} />
      )}
    </div>
  );
}

// =====================================================================
//  MaterialViewerModal - the "Open" view.
//  Shows the full details (no clamped description) and every action the
//  material actually has: View, Download, Open Link.
// =====================================================================
function MaterialViewerModal({ item, onClose }) {
  const Icon = getSubjectIcon(item.subject_name);
  const aesthetics = getSubjectAesthetics(item.subject_name);
  const hasFile = !!item.file_path;
  const hasLink = !!item.external_link;
  const kind = fileKind(item.file_path);
  const previewable = hasFile && canPreviewFile(item);
  const isOffice = kind === 'office';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar shadow-xl animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}>

        <div className="p-5 border-b border-zinc-100 flex items-start justify-between gap-3 bg-zinc-50/50 rounded-t-lg sticky top-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-inset ${aesthetics.bg}`}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-900 leading-tight">{item.title}</h2>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{item.material_type}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md shrink-0">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {(item.uploaded_by_name || item.created_at) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
              {item.uploaded_by_name && (
                <span className="inline-flex items-center gap-1"><User className="size-3 shrink-0" /> {item.uploaded_by_name}</span>
              )}
              {item.created_at && (
                <span className="inline-flex items-center gap-1"><Clock className="size-3 shrink-0" /> {fmtIST(item.created_at)}</span>
              )}
            </div>
          )}

          {item.subject_name && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-1 rounded">
                {item.subject_name}
              </span>
            </div>
          )}

          {item.description && (
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Description</p>
              <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{item.description}</p>
            </div>
          )}

          <div className="border-t border-zinc-100 pt-4 space-y-2">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Open this material</p>

            {!hasFile && !hasLink && (
              <p className="text-xs text-zinc-400 italic">No file or link was attached to this material.</p>
            )}

            {hasFile && previewable && (
              <button onClick={() => viewMaterialFile(item)}
                className="w-full h-10 bg-white hover:bg-zinc-50 text-zinc-700 font-semibold text-xs rounded-md flex justify-center items-center gap-1.5 ring-1 ring-inset ring-zinc-200 shadow-sm transition-colors">
                <Eye className="size-3.5" /> View file
              </button>
            )}

            {hasFile && (
              <button onClick={() => downloadMaterialFile(item)}
                className="w-full h-10 bg-primary hover:bg-primary/90 text-white font-semibold text-xs rounded-md flex justify-center items-center gap-1.5 shadow-sm transition-colors">
                <Download className="size-3.5" /> Download file
              </button>
            )}

            {hasLink && (
              <button onClick={() => window.open(item.external_link, '_blank', 'noopener')}
                className="w-full h-10 bg-white hover:bg-zinc-50 text-sky-700 font-semibold text-xs rounded-md flex justify-center items-center gap-1.5 ring-1 ring-inset ring-sky-200 shadow-sm transition-colors">
                <ExternalLink className="size-3.5" /> Open link
              </button>
            )}

            {hasLink && (
              <p className="text-[10px] text-zinc-400 break-all px-1">{item.external_link}</p>
            )}

            {hasFile && isOffice && !previewable && (
              <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex gap-2">
                <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Word, PowerPoint and Excel files can't be previewed in the browser from here. Download it and it will open in Office on your device.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}