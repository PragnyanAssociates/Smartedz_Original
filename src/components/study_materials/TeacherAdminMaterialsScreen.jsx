import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BASE_URL, SERVER_URL } from "../../apiConfig";
import { useAuth } from "../../context/AuthContext";
import { 
  Folder, Edit, Trash2, Download, ExternalLink, Plus, 
  Search, X, FileText, Video, MonitorPlay, FileSpreadsheet, Link
} from 'lucide-react';

const getContainerClasses = () => "w-full max-w-7xl mx-auto px-4 lg:px-8";

const getCardAesthetics = (type) => {
  switch(type) {
    case "Video Lecture": return { bg: "bg-rose-50", icon: <Video size={48} className="text-rose-400" /> };
    case "Presentation": return { bg: "bg-amber-50", icon: <MonitorPlay size={48} className="text-amber-400" /> };
    case "Link": return { bg: "bg-sky-50", icon: <Link size={48} className="text-sky-400" /> };
    case "Worksheet": return { bg: "bg-emerald-50", icon: <FileSpreadsheet size={48} className="text-emerald-400" /> };
    default: return { bg: "bg-indigo-50", icon: <FileText size={48} className="text-indigo-400" /> };
  }
};

export default function TeacherAdminMaterialsScreen() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  
  // State for Dropdowns
  const [dbClasses, setDbClasses] = useState([]);
  const [dbSubjects, setDbSubjects] = useState([]);

  const fetchMaterialsAndData = useCallback(async () => {
    if (!user?.id || !user?.institutionId) return;
    setIsLoading(true);
    try {
      // 1. Fetch Materials
      const matRes = await fetch(`${API_BASE_URL}/admin/study-materials/${user.institutionId}/teacher/${user.id}`);
      const matData = await matRes.json();
      setMaterials(Array.isArray(matData) ? matData : []);

      // 2. Fetch Classes and Subjects for the Dropdowns
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
    } catch (error) { alert("Failed to delete."); }
  };

  const filteredMaterials = useMemo(() => {
    if (!query.trim()) return materials;
    const q = query.toLowerCase();
    return materials.filter(m => 
      (m.title && m.title.toLowerCase().includes(q)) ||
      (m.subject && m.subject.toLowerCase().includes(q)) ||
      (m.class_group && m.class_group.toLowerCase().includes(q))
    );
  }, [materials, query]);

  return (
    <div className="min-h-screen bg-slate-50 relative">
      <main className={`${getContainerClasses()} pt-0 pb-6 sm:pb-8 flex flex-col flex-1`}>
        
        <div className="mb-3 flex flex-col items-center justify-center text-center gap-1">
          <h1 className="text-xl lg:text-2xl font-black text-slate-800">Study Materials</h1>
          <p className="text-sm text-slate-500 font-medium">Manage and share educational resources</p>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search materials..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" />
          </div>
          <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg w-full sm:w-auto">
            <Plus size={18} /> Add Material
          </button>
        </div>

        <div className="flex-1">
          {isLoading ? <div className="py-20 text-center text-slate-500 font-medium animate-pulse">Loading...</div> : 
           filteredMaterials.length === 0 ? (
            <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
              <Folder className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No materials uploaded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredMaterials.map((item) => {
                const aesthetics = getCardAesthetics(item.material_type);
                return (
                  <div key={item.id} className="group bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition-all">
                    <div className={`h-36 ${aesthetics.bg} border-b border-slate-100 flex items-center justify-center relative`}>
                      {aesthetics.icon}
                      <span className="absolute bottom-3 left-3 bg-white/90 text-slate-700 text-[10px] uppercase font-black px-2.5 py-1 rounded-md">{item.material_type}</span>
                      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openModal(item)} className="p-2 bg-white/90 text-slate-600 rounded-lg hover:text-blue-600"><Edit size={14}/></button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 bg-white/90 text-slate-600 rounded-lg hover:text-red-600"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-grow">
                      <h3 className="font-black text-slate-800 text-lg leading-tight line-clamp-1 mb-2">{item.title}</h3>
                      <div className="flex gap-2 mb-3">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{item.class_group}</span>
                        <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{item.subject}</span>
                      </div>
                      {item.description && <p className="text-xs text-slate-500 line-clamp-2 mb-4">{item.description}</p>}
                      <div className="mt-auto pt-3 border-t border-slate-100">
                        {item.file_path ? (
                          <button onClick={() => window.open(`${SERVER_URL.replace('/api','')}${item.file_path}`, "_blank")} className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl flex justify-center gap-2 items-center"><Download size={14} /> Download</button>
                        ) : item.external_link ? (
                          <button onClick={() => window.open(item.external_link, "_blank")} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex justify-center gap-2 items-center"><ExternalLink size={14} /> Open Link</button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isModalVisible && (
          <MaterialFormModal 
            material={editingMaterial} 
            onClose={() => setIsModalVisible(false)} 
            onSave={fetchMaterialsAndData} 
            dbClasses={dbClasses} 
            dbSubjects={dbSubjects} 
          />
        )}
      </main>
    </div>
  );
}

const MaterialFormModal = ({ material, onClose, onSave, dbClasses, dbSubjects }) => {
  const { user } = useAuth();
  const isEditMode = !!material;

  const [formData, setFormData] = useState({
    title: isEditMode ? material.title : "",
    description: isEditMode ? material.description : "",
    subject: isEditMode ? material.subject : "",
   class_id: isEditMode ? String(material.class_id || '') : "",  // ← ID not string
    material_type: isEditMode ? material.material_type : "Notes",
    external_link: isEditMode ? material.external_link || "" : ""
  });
  const [file, setFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const classLabel = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;

  const handleSave = async (e) => {
    e.preventDefault();
if (!formData.title || !formData.class_id) return alert("Title and Class are required.");
    setIsSaving(true);

    const body = new FormData();
    body.append("institutionId", user.institutionId);
    body.append("uploaded_by", user.id);
    Object.keys(formData).forEach(key => body.append(key, formData[key]));
    
    if (file) body.append("materialFile", file);
    else if (isEditMode && material.file_path) body.append("existing_file_path", material.file_path);

    try {
      const url = isEditMode ? `${API_BASE_URL}/admin/study-materials/${material.id}` : `${API_BASE_URL}/admin/study-materials`;
      await fetch(url, { method: isEditMode ? 'PUT' : 'POST', body });
      onSave(); 
      onClose();
    } catch (error) { 
      alert("Save failed."); 
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-50 p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600"><X size={24} /></button>
        <h2 className="text-2xl font-black mb-6 text-slate-800">{isEditMode ? "Edit Material" : "Add Material"}</h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Title *" value={formData.title} onChange={v => setFormData({...formData, title: v})} />
            </div>
            
            {/* Populated Class Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Class Group *</label>
            <select
    value={formData.class_id}
    onChange={e => setFormData({...formData, class_id: e.target.value})}
    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
    required
>
    <option value="">All Classes</option>
    {dbClasses.map(c => (
        <option key={c.id} value={String(c.id)}>
            {`${c.className}${c.section ? ` - ${c.section}` : ''}`}
        </option>
    ))}
</select>
            </div>

            {/* Populated Subject Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Subject</label>
              <select 
                value={formData.subject} 
                onChange={e => setFormData({...formData, subject: e.target.value})} 
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
              >
                <option value="">General / No Subject</option>
                {dbSubjects.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Type *</label>
              <select 
                value={formData.material_type} 
                onChange={e => setFormData({...formData, material_type: e.target.value})} 
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
              >
                {["Notes", "Presentation", "Video Lecture", "Worksheet", "Link", "Other"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <Field label="External Link" type="url" value={formData.external_link} onChange={v => setFormData({...formData, external_link: v})} />
            
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">File Upload</label>
              <input type="file" onChange={e => setFile(e.target.files[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-100 rounded-xl bg-slate-50" />
            </div>
            
            <div className="md:col-span-2">
              <Field type="textarea" label="Description" value={formData.description} onChange={v => setFormData({...formData, description: v})} />
            </div>
          </div>

          <button type="submit" disabled={isSaving} className="w-full bg-slate-900 hover:bg-blue-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black uppercase tracking-widest mt-4 transition-all shadow-xl flex justify-center gap-2">
            {isSaving ? "Saving..." : "Save Material"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }) {
  const base = "w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/10 text-sm font-medium";
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</label>
      {type === 'textarea' ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={base + ' resize-none'} required={required} /> : <input type={type} value={value} onChange={e => onChange(e.target.value)} className={base} required={required} />}
    </div>
  );
}