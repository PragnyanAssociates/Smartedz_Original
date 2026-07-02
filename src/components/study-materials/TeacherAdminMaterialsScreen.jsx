import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BASE_URL, SERVER_URL } from "../../apiConfig";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../Screens/PermissionsContext";
import { 
  Folder, Edit, Trash2, Download, ExternalLink, Plus, 
  Search, X, FileText, Video, MonitorPlay, FileSpreadsheet, Link,
  Loader2, ChevronDown, BookOpen, Save, Eye
} from 'lucide-react';

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
        (m.className && m.className.toLowerCase().includes(q))
      );
    }
    return list;
  }, [materials, query, classFilter, subjectFilter]);

  const hasActiveFilter = Boolean(query.trim() || classFilter || subjectFilter);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      
      <header className="flex flex-col mb-2 sm:mb-0">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
          <BookOpen className="text-primary size-5" />
          Study Materials
        </h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Manage and share educational resources.</p>
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
              const isBase64 = item.file_path && String(item.file_path).startsWith('data:');
              const fileUrl = isBase64 ? item.file_path : `${SERVER_URL.replace('/api','')}${item.file_path}`;

              return (
                <div key={item.id} className="group bg-white rounded-lg ring-1 ring-black/5 shadow-sm flex flex-col hover:ring-primary/30 hover:shadow-md transition-all overflow-hidden relative">
                  
                  {/* Floating Action Buttons */}
                  <div className="absolute top-4 right-4 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                    {(canEdit || isAdmin) && (
                      <button onClick={() => openModal(item)} className="size-7 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-primary rounded-md shadow-sm ring-1 ring-black/5 flex items-center justify-center transition-colors">
                        <Edit className="size-3.5"/>
                      </button>
                    )}
                    {(canDelete || isAdmin) && (
                      <button onClick={() => handleDelete(item.id)} className="size-7 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-red-600 rounded-md shadow-sm ring-1 ring-black/5 flex items-center justify-center transition-colors">
                        <Trash2 className="size-3.5"/>
                      </button>
                    )}
                  </div>

                  <div className="p-4 sm:p-5 flex flex-col flex-grow">
                    {/* Header: Icon + Title inline */}
                    <div className="flex items-start gap-3 mb-4 pr-16">
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
                    
                    <div className="mt-auto pt-4 border-t border-zinc-100 flex gap-2">
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