import React, { useState, useEffect, useCallback } from 'react';
import { 
  Upload, Loader2, Image as ImageIcon, RefreshCw, 
  X, Maximize, Minimize, ZoomIn, ZoomOut 
} from 'lucide-react';
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

  // Viewing States
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleReset = () => setScale(1);

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
          // actor_id lets the backend skip notifying the uploader about
          // their own guideline update.
          actor_id: user?.id,
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
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary size-8" />
      </div>
    );
  }

  if (!isVisible('LessonPlan')) {
    return <div className="p-10 text-center text-zinc-500 font-medium italic">Access Denied.</div>;
  }

  return (
    <div className={`flex flex-col gap-4 sm:gap-6 animate-in fade-in duration-300 ${
      isFullscreen 
        ? 'fixed inset-0 z-[100] bg-zinc-950 p-4 sm:p-6' 
        : 'p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto h-[calc(100vh-64px)] lg:h-[calc(100vh-88px)]'
    }`}>
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div className="flex flex-col">
          <h1 className={`text-xl font-semibold tracking-tight ${isFullscreen ? 'text-white' : 'text-zinc-900'}`}>
            Lesson Plan Guidelines
          </h1>
          <p className={`text-sm mt-1 max-w-[56ch] ${isFullscreen ? 'text-zinc-400' : 'text-zinc-500'}`}>
            Standard template for all academic staff.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
            {/* View Controls */}
            {plan && (
                <div className={`flex items-center h-9 rounded-md ring-1 shrink-0 ${isFullscreen ? 'bg-zinc-800 ring-zinc-700' : 'bg-white ring-black/5 shadow-sm'}`}>
                    <button onClick={handleZoomOut} className={`h-full px-2.5 transition-colors rounded-l-md ${isFullscreen ? 'text-zinc-400 hover:text-white hover:bg-zinc-700' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`} title="Zoom Out">
                      <ZoomOut className="size-4" />
                    </button>
                    <button onClick={handleReset} className={`h-full px-3 text-xs font-semibold tabular-nums border-x transition-colors ${isFullscreen ? 'text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-700' : 'text-zinc-500 border-zinc-200 hover:text-zinc-900 hover:bg-zinc-50'}`} title="Reset Zoom">
                      {Math.round(scale * 100)}%
                    </button>
                    <button onClick={handleZoomIn} className={`h-full px-2.5 transition-colors border-r ${isFullscreen ? 'text-zinc-400 hover:text-white hover:bg-zinc-700 border-zinc-700' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 border-zinc-200'}`} title="Zoom In">
                      <ZoomIn className="size-4" />
                    </button>
                    <button onClick={() => setIsFullscreen(!isFullscreen)} className={`h-full px-2.5 transition-colors rounded-r-md ${isFullscreen ? 'text-zinc-400 hover:text-white hover:bg-zinc-700' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`} title="Toggle Fullscreen">
                        {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                    </button>
                </div>
            )}

            {can('LessonPlan', 'edit') && (
            <button 
                onClick={() => setIsModalOpen(true)}
                className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm shrink-0"
            >
                {plan ? <RefreshCw className="size-3.5" /> : <Upload className="size-3.5" />}
                {plan ? 'Update' : 'Upload'}
            </button>
            )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className={`flex-1 rounded-lg overflow-auto relative custom-scrollbar flex flex-col ${isFullscreen ? 'bg-zinc-900 ring-1 ring-white/10' : 'bg-white ring-1 ring-black/5 shadow-sm'}`}>
        {plan ? (
          <div 
            className={`min-w-full min-h-full flex items-start justify-center p-4 sm:p-8 ${isFullscreen ? 'bg-zinc-900' : 'bg-zinc-50/50'}`}
            style={{ cursor: scale > 1 ? 'grab' : 'default' }}
          >
            <img 
              src={plan.image_data} 
              alt="Lesson Plan Guidelines" 
              className="shadow-sm rounded-md transition-transform duration-200 ease-out origin-top ring-1 ring-black/5 bg-white"
              style={{ 
                transform: `scale(${scale})`,
                maxWidth: scale > 1 ? 'none' : '100%' 
              }}
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300">
            <ImageIcon className="size-16 mb-4" strokeWidth={1} />
            <p className="font-medium text-sm text-zinc-400">No guidelines uploaded yet.</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg p-6 sm:p-8 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors">
              <X className="size-5" />
            </button>
            <h2 className="text-lg font-semibold mb-1 text-zinc-900">Upload Guidelines</h2>
            <p className="text-zinc-500 text-[11px] font-medium mb-6">This will replace the current active guideline template.</p>
            
            <div className="space-y-6">
              <div className="relative">
                {!preview ? (
                  <label className="flex flex-col items-center justify-center w-full h-48 sm:h-64 bg-zinc-50/50 border-2 border-dashed border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-100/50 hover:border-zinc-300 transition-colors">
                    <Upload className="text-zinc-400 mb-3 size-8" />
                    <span className="text-sm font-semibold text-zinc-600">Select Template Image</span>
                    <span className="text-xs text-zinc-400 mt-1">PNG, JPG up to 5MB</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                ) : (
                  <div className="relative rounded-lg overflow-hidden h-48 sm:h-64 border border-zinc-200 bg-zinc-50 p-2 flex items-center justify-center group">
                    <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain rounded-md shadow-sm" />
                    <button 
                      onClick={() => setPreview(null)}
                      className="absolute top-3 right-3 bg-white/90 hover:bg-white text-zinc-700 hover:text-red-600 p-1.5 rounded-md shadow-sm ring-1 ring-black/5 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                      title="Remove image"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  disabled={uploading}
                  className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpload}
                  disabled={uploading || !preview}
                  className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {uploading ? <Loader2 className="animate-spin size-3.5" /> : <Upload className="size-3.5" />}
                  {uploading ? 'Publishing...' : 'Update Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}