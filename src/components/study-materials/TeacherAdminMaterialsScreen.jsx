import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BASE_URL, SERVER_URL } from "../../apiConfig";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../Screens/PermissionsContext";
import {
  Folder, FolderOpen, Edit, Trash2, Download, ExternalLink, Plus,
  Search, X, FileText, Video, MonitorPlay, FileSpreadsheet, Link,
  Loader2, ChevronDown, BookOpen, Save, Eye, User, Clock,
  HelpCircle, ShieldCheck, Info
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

// Updated aesthetics to support smaller icons and crisp ring borders for the new layout
const getCardAesthetics = (type) => {
  switch(type) {
    case "Video Lecture": return { bg: "bg-rose-50 text-rose-600 ring-rose-600/20", icon: <Video className="size-5" /> };
    case "Presentation": return { bg: "bg-amber-50 text-amber-600 ring-amber-600/20", icon: <MonitorPlay className="size-5" /> };
    case "Link": return { bg: "bg-sky-50 text-sky-600 ring-sky-600/20", icon: <Link className="size-5" /> };
    case "Worksheet": return { bg: "bg-emerald-50 text-emerald-600 ring-emerald-600/20", icon: <FileSpreadsheet className="size-5" /> };
    default: return { bg: "bg-indigo-50 text-indigo-600 ring-indigo-600/20", icon: <FileText className="size-5" /> };
  }
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

export default function TeacherAdminMaterialsScreen() {
  const { user } = useAuth();

  const { can, isAllAccess } = usePermissions();
  const canEdit = can('StudyMaterials', 'edit');
  const canDelete = can('StudyMaterials', 'delete');
  const isAdmin = isAllAccess;
  const [query, setQuery] = useState("");
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [viewingMaterial, setViewingMaterial] = useState(null);
  
  // List filters (client-side, over the already-loaded materials). '' = All.
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  const [dbClasses, setDbClasses] = useState([]);
  const [dbSubjects, setDbSubjects] = useState([]);

  const fetchMaterialsAndData = useCallback(async () => {
    if (!user?.id || !user?.institutionId) return;
    setIsLoading(true);
    try {
      const matRes = await fetch(`${API_BASE_URL}/admin/study-materials/${user.institutionId}?userId=${user.id}`);
      const matData = await matRes.json();
      setMaterials(Array.isArray(matData) ? matData : []);
      const dbRes = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
      const dbData = await dbRes.json();
      setDbClasses(dbData.classes || []);
      setDbSubjects(dbData.subjects || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchMaterialsAndData(); }, [fetchMaterialsAndData]);

  const openModal = (material = null) => {
    setEditingMaterial(material);
    setIsModalVisible(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this study material?")) return;
    try {
      await fetch(`${API_BASE_URL}/admin/study-materials/${id}`, { method: 'DELETE' });
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      setViewingMaterial(prev => (prev && prev.id === id ? null : prev));
    } catch (error) { alert("Failed to delete."); }
  };

  const classLabel = (c) => `${c.className}${c.section ? ' - ' + c.section : ''}`;

  const filteredMaterials = useMemo(() => {
    let list = materials;
    if (classFilter)   list = list.filter(m => String(m.class_id) === String(classFilter));
    if (subjectFilter) list = list.filter(m => String(m.subject_id) === String(subjectFilter));
    const q = query.toLowerCase().trim();
    if (q) {
      list = list.filter(m =>
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.subject_name && m.subject_name.toLowerCase().includes(q)) ||
        (m.className && m.className.toLowerCase().includes(q)) ||
        (m.uploaded_by_name && m.uploaded_by_name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [materials, query, classFilter, subjectFilter]);

  const hasActiveFilter = Boolean(query.trim() || classFilter || subjectFilter);

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2 sm:mb-0">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <BookOpen className="text-primary size-5" />
            Study Materials
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Manage and share educational resources.</p>
        </div>
        <MaterialsHelp canEdit={canEdit || isAdmin} />
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search materials..."
            className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors placeholder:text-zinc-400" />
        </div>
        {/* Class + Subject filters */}
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-44">
            <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
              <option value="">All Classes</option>
              {dbClasses.map(c => <option key={c.id} value={String(c.id)}>{classLabel(c)}</option>)}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative w-full sm:w-44">
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
              className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
              <option value="">All Subjects</option>
              {dbSubjects.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
            <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {(canEdit || isAdmin) && (
          <button onClick={() => openModal()} className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto shrink-0 sm:ml-auto">
            <Plus className="size-3.5" /> Add Material
          </button>
        )}
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin size-8 text-primary" />
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
            <Folder className="size-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">{hasActiveFilter ? 'No materials match your filters.' : 'No materials uploaded yet.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredMaterials.map((item) => {
              const aesthetics = getCardAesthetics(item.material_type);
              const hasFile = !!item.file_path;
              const hasLink = !!item.external_link;

              return (
                <div key={item.id} className="group bg-white rounded-lg ring-1 ring-black/5 shadow-sm flex flex-col hover:ring-primary/30 hover:shadow-md transition-all overflow-hidden relative">

                  {/* Floating Action Buttons */}
                  <div className="absolute top-4 right-4 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                    {(canEdit || isAdmin) && (
                      <button onClick={() => openModal(item)} className="size-7 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-primary rounded-md shadow-sm ring-1 ring-black/5 flex items-center justify-center transition-colors" title="Edit">
                        <Edit className="size-3.5"/>
                      </button>
                    )}
                    {(canDelete || isAdmin) && (
                      <button onClick={() => handleDelete(item.id)} className="size-7 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-red-600 rounded-md shadow-sm ring-1 ring-black/5 flex items-center justify-center transition-colors" title="Delete">
                        <Trash2 className="size-3.5"/>
                      </button>
                    )}
                  </div>

                  <div className="p-4 sm:p-5 flex flex-col flex-grow">
                    {/* Header: Icon + Title inline */}
                    <div className="flex items-start gap-3 mb-3 pr-16">
                      <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-inset ${aesthetics.bg}`}>
                        {aesthetics.icon}
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

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-1 rounded">
                        {item.className} {item.section}
                      </span>
                      {item.subject_name && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-1 rounded">
                          {item.subject_name}
                        </span>
                      )}
                    </div>

                    {item.description && <p className="text-xs text-zinc-500 line-clamp-2 mb-4 leading-relaxed">{item.description}</p>}

                    {/* One Open button - everything this material carries is
                        listed inside, so a file AND a link both show up. */}
                    <div className="mt-auto pt-4 border-t border-zinc-100 space-y-2">
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewingMaterial && (
        <MaterialViewerModal item={viewingMaterial} onClose={() => setViewingMaterial(null)} />
      )}

      {isModalVisible && (
        <MaterialFormModal
          material={editingMaterial}
          onClose={() => setIsModalVisible(false)}
          onSave={fetchMaterialsAndData}
          dbClasses={dbClasses}
          dbSubjects={dbSubjects}
        />
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
  const aesthetics = getCardAesthetics(item.material_type);
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
              {aesthetics.icon}
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

          <div className="flex flex-wrap gap-1.5">
            {(item.className || item.section) && (
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-1 rounded">
                {item.className} {item.section}
              </span>
            )}
            {item.subject_name && (
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-1 rounded">
                {item.subject_name}
              </span>
            )}
          </div>

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

// -----------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------
const MaterialFormModal = ({ material, onClose, onSave, dbClasses, dbSubjects }) => {
  const { user } = useAuth();
  const isEditMode = !!material;
  const [formData, setFormData] = useState({
    title: isEditMode ? material.title : "",
    description: isEditMode ? material.description : "",
    subject_id: isEditMode ? material.subject_id || "" : "",
    class_id: isEditMode ? material.class_id : "",
    material_type: isEditMode ? material.material_type : "Notes",
    external_link: isEditMode ? material.external_link || "" : ""
  });

  const [file, setFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.class_id) return alert("Title and Class are required.");
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file && file.size > MAX_SIZE) {
        alert("This file is too large. Please select a file under 10MB.");
        return;
    }
    setIsSaving(true);
    const payload = {
        institutionId: user.institutionId,
        uploaded_by: user.id,
        ...formData
    };
    const sendRequest = async (finalPayload) => {
        try {
            const url = isEditMode ? `${API_BASE_URL}/admin/study-materials/${material.id}` : `${API_BASE_URL}/admin/study-materials`;

            const res = await fetch(url, {
                method: isEditMode ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(finalPayload)
            });
            if (!res.ok) throw new Error('Save failed');
            onSave();
            onClose();
        } catch (error) {
            alert("Save failed.");
        } finally {
            setIsSaving(false);
        }
    };
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            payload.materialFile = reader.result;
            sendRequest(payload);
        };
        reader.readAsDataURL(file);
    } else {
        sendRequest(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-2xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900">{isEditMode ? "Edit Material" : "Add Material"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
            <X className="size-4" />
          </button>
        </div>
        
        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <Field label="Title" value={formData.title} onChange={v => setFormData({...formData, title: v})} required />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">Class <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select value={formData.class_id} onChange={e => setFormData({...formData, class_id: e.target.value})} className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors" required>
                    <option value="" disabled>Select Class</option>
                    {dbClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.className} {c.section || ''}</option>
                    ))}
                  </select>
                  <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Subject</label>
                <div className="relative">
                  <select value={formData.subject_id} onChange={e => setFormData({...formData, subject_id: e.target.value})} className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                    <option value="">No Subject</option>
                    {dbSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">Type <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select value={formData.material_type} onChange={e => setFormData({...formData, material_type: e.target.value})} className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer appearance-none shadow-sm transition-colors">
                    {["Notes", "Presentation", "Video Lecture", "Worksheet", "Link", "Other"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Field label="External Link" type="url" value={formData.external_link} onChange={v => setFormData({...formData, external_link: v})} placeholder="https://..." />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">File Upload (Max 10MB)</label>
                <input type="file" onChange={e => setFile(e.target.files[0])}
                  className="block w-full text-sm text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer border border-zinc-200 rounded-md bg-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 h-9 leading-9" />
                <p className="text-[10px] font-medium text-zinc-400">A material can carry a file and a link together - both appear when it's opened.</p>
              </div>

              <div className="md:col-span-2">
                <Field type="textarea" label="Description" value={formData.description} onChange={v => setFormData({...formData, description: v})} placeholder="Optional details..." />
              </div>
            </div>
          </div>
          <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
            <button type="button" onClick={onClose} disabled={isSaving}
              className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
              Cancel
            </button>
            <button type="submit" disabled={isSaving}
              className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">
              {isSaving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Save className="size-3.5 shrink-0" />}
              {isSaving ? "Saving..." : "Save Material"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, placeholder }) {
  const base = "h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm";
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
          placeholder={placeholder} className={`${base} h-auto py-2.5 resize-none`} required={required} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={base} required={required} />
      )}
    </div>
  );
}

// =====================================================================
//  MaterialsHelp — "How to use" guide (same theme as ReportsHelp).
//  Editors/admins get the manage guide; read-only viewers get the view one.
// =====================================================================
const GUIDES = {
  manage: {
    title: 'Study Materials',
    steps: [
      ['1 \u00b7 What this is', 'A shared library of resources for your classes \u2014 notes, presentations, video lectures, worksheets and links, each tagged by class, subject and type.'],
      ['2 \u00b7 Add material', 'Add Material opens the form: give it a title, pick a class (required) and optional subject, choose a type, then attach a file (up to 10 MB), paste an external link, or both.'],
      ['3 \u00b7 Open a material', 'Open on a card shows the full description and everything attached \u2014 View file, Download file and Open link, whichever that material has.'],
      ['4 \u00b7 Find material', 'Search by title, subject, class or uploader, and narrow with the Class and Subject filters.'],
      ['5 \u00b7 Edit & delete', 'Hover a card for the edit and delete actions. Each card shows who uploaded it and when.'],
    ],
    note: 'PDFs, images and videos preview in the browser. Word, PowerPoint and Excel files download and open in Office. Uploads are capped at 10 MB per file.'
  },
  view: {
    title: 'Study Materials',
    steps: [
      ['1 \u00b7 Browse resources', 'Each card is a resource for your class \u2014 notes, presentations, videos, worksheets or links \u2014 tagged by class, subject and type.'],
      ['2 \u00b7 Open a material', 'Open shows the full description and everything attached: View file, Download file and Open link, whichever that material has.'],
      ['3 \u00b7 Find material', 'Search by title, subject or class, and use the Class and Subject filters to narrow the list.'],
    ],
    note: 'PDFs, images and videos preview in the browser. Word, PowerPoint and Excel files download and open in Office.'
  }
};

function MaterialsHelp({ canEdit = false, className = '' }) {
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