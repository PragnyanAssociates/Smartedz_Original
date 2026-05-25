import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL, SERVER_URL } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { 
  FolderOpen, Download, ExternalLink, FlaskConical, Calculator, 
  BookOpen, Languages, Activity, Book, FileText, MonitorPlay, 
  Video, FileSpreadsheet, Link as LinkIcon, Search, X 
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
  // Ensure user and necessary data exist
  if (!user?.class_group || !user?.institutionId || !user?.id) return;
  
  setIsLoading(true);
  try {
    // Call the updated route: .../student/:studentId/:classGroup
    const res = await fetch(`${API_BASE_URL}/admin/study-materials/${user.institutionId}/student/${user.id}/${user.class_group}`);
    const data = await res.json();
    setMaterials(Array.isArray(data) ? data : []);
  } catch (error) { 
    console.error("Fetch error:", error);
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
      (m.subject && m.subject.toLowerCase().includes(q))
    );
  }, [materials, query]);

  return (
    <div className="min-h-screen bg-slate-50 relative">
      <main className="w-full max-w-7xl mx-auto px-4 lg:px-8 pt-0 pb-8">
        <div className="mb-3 flex flex-col items-center justify-center text-center gap-1">
          <h1 className="text-xl lg:text-2xl font-black text-slate-800">Study Materials</h1>
          <p className="text-sm text-slate-500 font-medium">View and access your class resources</p>
        </div>

        <div className="mb-6 flex justify-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search materials..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" />
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center animate-pulse font-medium text-slate-500">Loading resources...</div>
        ) : filteredMaterials.length === 0 ? (
          <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
            <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No study materials available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMaterials.map((item) => {
              const Icon = getSubjectIcon(item.subject);
              const aesthetics = getSubjectAesthetics(item.subject);
              return (
                <div key={item.id} className="group bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition-all">
                  <div className={`h-32 ${aesthetics.bg} border-b border-slate-100 flex items-center justify-center relative`}>
                    <Icon size={40} className={aesthetics.text} />
                    <span className="absolute bottom-3 left-3 bg-white/90 text-slate-700 text-[10px] uppercase font-black px-2.5 py-1 rounded-md">{item.material_type}</span>
                  </div>
                  <div className="p-5 flex flex-col flex-grow">
                    <h3 className="font-black text-slate-800 text-lg leading-tight line-clamp-1 mb-1">{item.title}</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{item.subject}</p>
                    {item.description && <p className="text-xs text-slate-500 line-clamp-2 mb-4">{item.description}</p>}
                    
                    <div className="mt-auto pt-3 border-t border-slate-100">
                      {item.file_path ? (
                        <button onClick={() => window.open(`${SERVER_URL.replace('/api','')}${item.file_path}`, "_blank")} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex justify-center gap-2 items-center"><Download size={14} /> Download</button>
                      ) : item.external_link ? (
                        <button onClick={() => window.open(item.external_link, "_blank")} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex justify-center gap-2 items-center"><ExternalLink size={14} /> Open Link</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}