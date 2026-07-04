"use client"
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL, SERVER_URL } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { 
  FolderOpen, Download, ExternalLink, FlaskConical, Calculator, 
  BookOpen, Languages, Activity, Book, Search, Loader2, Eye, User, Clock
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
export default function StudentMaterialsScreen() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
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
              
              // Base64 Safe Handlers
              const isBase64 = item.file_path && String(item.file_path).startsWith('data:');
              const fileUrl = isBase64 ? item.file_path : `${SERVER_URL.replace('/api','')}${item.file_path}`;
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
                  
                  {/* Footer Area (Subtle Gray) */}
                  <div className="bg-zinc-50/80 border-t border-zinc-100 p-3 sm:p-4 flex gap-2 shrink-0 mt-auto">
                    {item.file_path ? (
                      <>
                        <button 
                          onClick={() => {
                            if (isBase64) {
                              const win = window.open('', '_blank');
                              if (win) {
                                win.document.body.innerHTML = '<div style="font-family: sans-serif; padding: 20px; text-align: center;">Loading document...</div>';
                                fetch(fileUrl)
                                  .then(res => res.blob())
                                  .then(blob => {
                                    const blobUrl = URL.createObjectURL(blob);
                                    win.location.href = blobUrl;
                                  })
                                  .catch(() => {
                                    win.document.body.innerHTML = '<div style="font-family: sans-serif; padding: 20px; color: red; text-align: center;">Failed to load document.</div>';
                                  });
                              }
                            } else {
                              const isOfficeFile = item.file_path.match(/\.(xlsx|xls|doc|docx|ppt|pptx)$/i);
                              const viewUrl = isOfficeFile 
                                ? `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true` 
                                : fileUrl;
                              window.open(viewUrl, "_blank");
                            }
                          }} 
                          className="flex-1 h-9 bg-white hover:bg-zinc-50 text-zinc-700 font-semibold text-xs rounded-md flex justify-center items-center gap-1.5 ring-1 ring-inset ring-zinc-200 shadow-sm transition-colors"
                        >
                          <Eye className="size-3.5" /> View
                        </button>
                        
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            if (isBase64) {
                              fetch(fileUrl)
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
                                .catch(() => alert("Failed to prepare file for download."));
                            } else {
                              const link = document.createElement('a');
                              link.href = fileUrl;
                              link.setAttribute('download', item.title || 'download');
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          }} 
                          className="flex-1 h-9 bg-primary hover:bg-primary/90 text-white font-semibold text-xs rounded-md flex justify-center items-center gap-1.5 shadow-sm transition-colors"
                        >
                          <Download className="size-3.5" /> Download
                        </button>
                      </>
                    ) : item.external_link ? (
                      <button onClick={() => window.open(item.external_link, "_blank")} 
                        className="w-full h-9 bg-white hover:bg-zinc-50 text-zinc-700 font-semibold text-xs rounded-md flex justify-center items-center gap-1.5 ring-1 ring-inset ring-zinc-200 shadow-sm transition-colors">
                        <ExternalLink className="size-3.5" /> Open Link
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}