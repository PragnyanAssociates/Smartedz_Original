import React, { useState, useEffect, useCallback } from 'react';
import { Upload, LoaderCircle, Image as ImageIcon, RefreshCw, X, Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';

export default function LessonPlan() {
  const { user } = useAuth();
  const { can, isVisible, loading: permsLoading } = usePermissions();
  
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preview, setPreview] = useState(null);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/lesson-plans/${user.institutionId}`);
      const data = await res.json();
      setPlan(data);
    } catch (e) {
      console.error("Failed to fetch guideline", e);
    }
    setLoading(false);
  }, [user.institutionId]);

  useEffect(() => {
    if (isVisible('LessonPlan')) fetchPlan();
  }, [fetchPlan, isVisible]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!preview) return;
    setUploading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/lesson-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId,
          image_data: preview,
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setPreview(null);
        fetchPlan();
      }
    } catch (e) {
      alert("Upload failed");
    }
    setUploading(false);
  };

  if (permsLoading || loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoaderCircle className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!isVisible('LessonPlan')) {
    return <div className="p-10 text-center text-slate-500 italic">Access Denied.</div>;
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-4 animate-in fade-in duration-500">
      
      {/* Header with simple Update option for Admins */}
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Lesson Plan Guidelines</h2>
          <p className="text-slate-400 text-sm font-medium">Standard template for all academic staff.</p>
        </div>
        
        {can('LessonPlan', 'edit') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-900 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
          >
            {plan ? <RefreshCw size={18} /> : <Upload size={18} />}
            {plan ? 'Update Guidelines' : 'Upload Guidelines'}
          </button>
        )}
      </div>

      {/* Main Content: The Image occupies the full remaining space */}
      <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden relative group">
        {plan ? (
          <div className="w-full h-full p-2 bg-slate-50">
            <img 
              src={plan.image_data} 
              alt="Lesson Plan Guidelines" 
              className="w-full h-full object-contain rounded-2xl shadow-inner"
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
            <ImageIcon size={64} strokeWidth={1} className="mb-4" />
            <p className="font-bold text-lg">No guidelines uploaded yet.</p>
            {can('LessonPlan', 'edit') && (
              <button onClick={() => setIsModalOpen(true)} className="mt-4 text-blue-600 font-bold hover:underline">
                Upload now
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl p-10 shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-2 text-slate-800">Upload Guidelines</h2>
            <p className="text-slate-400 text-sm mb-8 font-medium">This image will be visible to all staff as the official template.</p>
            
            <div className="space-y-6">
              <div className="relative">
                {!preview ? (
                  <label className="flex flex-col items-center justify-center w-full h-64 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer hover:bg-slate-100 transition-all">
                    <Upload className="text-slate-300 mb-2" size={40} />
                    <span className="text-sm font-bold text-slate-400">Select Template Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                ) : (
                  <div className="relative rounded-[2rem] overflow-hidden h-80 border border-slate-100 bg-slate-50 p-2">
                    <img src={preview} alt="Preview" className="w-full h-full object-contain rounded-xl" />
                    <button 
                      onClick={() => setPreview(null)}
                      className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-all"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>

              <button 
                onClick={handleUpload}
                disabled={uploading || !preview}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2"
              >
                {uploading ? <LoaderCircle className="animate-spin" size={18} /> : <Upload size={18} />}
                {uploading ? 'Processing...' : 'Publish Guidelines'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}