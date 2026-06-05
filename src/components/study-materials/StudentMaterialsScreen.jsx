import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL, SERVER_URL } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { 
  FolderOpen, Download, ExternalLink, FlaskConical, Calculator, 
  BookOpen, Languages, Activity, Book, Search, Loader2, Eye
} from 'lucide-react';

const getSubjectIcon = (subject) => {
  const lower = (subject || '').toLowerCase();
  if (lower.includes('science')) return FlaskConical;
  if (lower.includes('math')) return Calculator;
  if (lower.includes('history')) return BookOpen;
  if (lower.includes('english')) return Languages;
  if (lower.includes('physical')) return Activity;
  return Book;
};

const getSubjectAesthetics = (subject) => {
  const lower = (subject || '').toLowerCase();
  if (lower.includes("science")) return { bg: "bg-emerald-50", text: "text-emerald-500" };
  if (lower.includes("math")) return { bg: "bg-sky-50", text: "text-sky-500" };
  if (lower.includes("history")) return { bg: "bg-amber-50", text: "text-amber-500" };
  if (lower.includes("english")) return { bg: "bg-rose-50", text: "text-rose-500" };
  return { bg: "bg-indigo-50", text: "text-indigo-500" };
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
      (m.subject_name && m.subject_name.toLowerCase().includes(q))
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
                <div key={item.id} className="group bg-white rounded-lg ring-1 ring-black/5 shadow-sm flex flex-col hover:ring-primary/30 hover:shadow-md transition-all overflow-hidden">
                  <div className={`h-32 ${aesthetics.bg} border-b border-zinc-100 flex items-center justify-center relative`}>
                    <Icon className={`size-10 ${aesthetics.text}`} />
                    <span className="absolute bottom-3 left-3 bg-white/90 text-zinc-700 text-[10px] uppercase font-semibold px-2 py-1 rounded shadow-sm tracking-wider">
                      {item.material_type}
                    </span>
                  </div>
                  
                  <div className="p-4 sm:p-5 flex flex-col flex-grow bg-white">
                    <h3 className="font-semibold text-zinc-900 text-base leading-tight line-clamp-1 mb-1">{item.title}</h3>
                    {item.subject_name && (
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                        {item.subject_name}
                      </p>
                    )}
                    {item.description && <p className="text-xs text-zinc-500 line-clamp-2 mb-4 leading-relaxed">{item.description}</p>}
                    
                    <div className="mt-auto pt-4 border-t border-zinc-100 flex gap-2">
                      {item.file_path ? (
                        <>
                          <button 
                            onClick={() => {
                              if (isBase64) {
                                // 1. Open the new tab immediately to bypass popup blockers
                                const win = window.open('', '_blank');
                                if (win) {
                                  win.document.body.innerHTML = '<div style="font-family: sans-serif; padding: 20px; text-align: center;">Loading document...</div>';
                                  
                                  // 2. Safely convert the massive Base64 string into a Browser Blob
                                  fetch(fileUrl)
                                    .then(res => res.blob())
                                    .then(blob => {
                                      // 3. Create a temporary URL and redirect the new tab to it
                                      const blobUrl = URL.createObjectURL(blob);
                                      win.location.href = blobUrl;
                                    })
                                    .catch(() => {
                                      win.document.body.innerHTML = '<div style="font-family: sans-serif; padding: 20px; color: red; text-align: center;">Failed to load document.</div>';
                                    });
                                }
                              } else {
                                // Old file system logic
                                const isOfficeFile = item.file_path.match(/\.(xlsx|xls|doc|docx|ppt|pptx)$/i);
                                const viewUrl = isOfficeFile 
                                  ? `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true` 
                                  : fileUrl;
                                window.open(viewUrl, "_blank");
                              }
                            }} 
                            className="flex-1 h-9 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-semibold text-xs rounded-md flex justify-center items-center gap-1.5 ring-1 ring-inset ring-zinc-200 transition-colors"
                          >
                            <Eye className="size-3.5" /> View
                          </button>
                          
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              if (isBase64) {
                                // 1. Convert massive Base64 string to a physical Blob file first
                                fetch(fileUrl)
                                  .then(res => res.blob())
                                  .then(blob => {
                                    // 2. Create a tiny, safe temporary URL for the download
                                    const blobUrl = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = blobUrl;
                                    link.setAttribute('download', item.title || 'download');
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    // 3. Clean up browser memory
                                    URL.revokeObjectURL(blobUrl); 
                                  })
                                  .catch(() => alert("Failed to prepare file for download."));
                              } else {
                                // Standard download logic for old/normal files
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
                          className="w-full h-9 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-semibold text-xs rounded-md flex justify-center items-center gap-1.5 ring-1 ring-inset ring-zinc-200 transition-colors">
                          <ExternalLink className="size-3.5" /> Open Link
                        </button>
                      ) : null}
                    </div>
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