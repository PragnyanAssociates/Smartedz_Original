import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import { 
  Image as ImageIcon, Video, Plus, Trash2, Download, ChevronLeft, 
  Calendar, X, Play, Loader2, Search, Album as AlbumIcon
} from 'lucide-react';

// =====================================================================
//  MAIN GALLERY COMPONENT
// =====================================================================
export default function Gallery() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [viewingAlbum, setViewingAlbum] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Permission Check: Can this user add new albums/media?
  const canCreate = can('Gallery', 'edit');

  const fetchAlbums = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/gallery/${user.institutionId}`);
      const data = await res.json();
      setAlbums(Array.isArray(data) ? data : []);
    } catch (e) { 
      console.error('Fetch albums error:', e); 
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAlbums(); }, [fetchAlbums]);

  const filteredAlbums = useMemo(() => {
    return albums.filter(a => a.title.toLowerCase().includes(search.toLowerCase()));
  }, [albums, search]);

  // Render Detailed View if an album is selected
  if (viewingAlbum) {
    return (
      <AlbumDetail 
        albumTitle={viewingAlbum} 
        onBack={() => { setViewingAlbum(null); fetchAlbums(); }} 
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header Area */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Gallery</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Memories and events captured in time.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              placeholder="Search albums..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm"
            />
          </div>
          {canCreate && <CreateAlbumModal onCreated={fetchAlbums} />}
        </div>
      </header>

      {/* Album Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary size-8" />
        </div>
      ) : filteredAlbums.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredAlbums.map(album => (
            <div 
              key={album.title}
              onClick={() => setViewingAlbum(album.title)}
              className="group bg-white rounded-lg ring-1 ring-black/5 overflow-hidden shadow-sm hover:ring-zinc-300 transition-all cursor-pointer flex flex-col"
            >
              <div className="aspect-video relative overflow-hidden bg-zinc-100 border-b border-zinc-100">
                <img 
                  src={`${API_BASE_URL.replace('/api', '')}${album.cover_image}`} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                  alt={album.title} 
                  onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800"; }}
                />
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-semibold text-zinc-700 shadow-sm ring-1 ring-black/5">
                  {album.item_count} ITEMS
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <h3 className="font-semibold text-zinc-900 text-sm leading-tight truncate">{album.title}</h3>
                <div className="flex items-center gap-1.5 mt-1.5 text-zinc-500">
                  <Calendar className="size-3.5" />
                  <span className="text-[11px] font-medium">{new Date(album.event_date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <AlbumIcon className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No albums found. Create your first one!</p>
        </div>
      )}
    </div>
  );
}

// =====================================================================
//  ALBUM DETAIL COMPONENT (VIEWING ITEMS INSIDE AN ALBUM)
// =====================================================================
function AlbumDetail({ albumTitle, onBack }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); 
  const [selectedMedia, setSelectedMedia] = useState(null);

  const canEdit = can('Gallery', 'edit');
  const canDelete = can('Gallery', 'delete');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/gallery/album/${user.institutionId}/${encodeURIComponent(albumTitle)}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Fetch items error:', e); }
    setLoading(false);
  }, [user, albumTitle]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filteredItems = items.filter(i => filter === 'all' || i.file_type === filter);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this item permanently?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/gallery/${id}`, { method: 'DELETE' });
      if (res.ok) fetchItems();
    } catch (e) { alert('Delete failed'); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('media', file);
    formData.append('title', albumTitle);
    formData.append('event_date', items[0]?.event_date || new Date().toISOString().split('T')[0]);
    formData.append('institutionId', user.institutionId);
    formData.append('adminId', user.id);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/gallery/upload`, { method: 'POST', body: formData });
      if (res.ok) fetchItems();
      else alert('Upload failed. Size might be too large.');
    } catch (err) { alert('Network error'); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
        <ChevronLeft className="size-4" /> Back to Gallery
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">{albumTitle}</h2>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="inline-flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar w-full sm:w-auto">
            {['all', 'photo', 'video'].map(type => (
              <button 
                key={type}
                onClick={() => setFilter(type)}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  filter === type ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          
          {canEdit && (
            <label className="h-9 w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors shrink-0">
              <Plus className="size-4" /> Add Media
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
            </label>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary size-8" /></div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filteredItems.map(item => (
            <div 
              key={item.id}
              onClick={() => setSelectedMedia(item)}
              className="group relative aspect-square rounded-lg overflow-hidden bg-zinc-100 ring-1 ring-black/5 cursor-pointer hover:ring-zinc-300 transition-all"
            >
              {item.file_type === 'photo' ? (
                <img src={`${API_BASE_URL.replace('/api', '')}${item.file_path}`} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white">
                  <div className="bg-white/10 p-3 rounded-full backdrop-blur-sm ring-1 ring-white/20">
                    <Play className="size-6 fill-current" />
                  </div>
                </div>
              )}
              
              <div className="absolute inset-0 bg-zinc-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {canDelete && (
                  <button onClick={(e) => handleDelete(item.id, e)} className="p-2 bg-white/90 hover:bg-white text-zinc-700 hover:text-red-600 rounded-md shadow-sm transition-colors">
                    <Trash2 className="size-4" />
                  </button>
                )}
                <a href={`${API_BASE_URL.replace('/api', '')}${item.file_path}`} download target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="p-2 bg-white/90 hover:bg-white text-zinc-700 hover:text-primary rounded-md shadow-sm transition-colors">
                  <Download className="size-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <ImageIcon className="size-8 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No media found for this filter.</p>
        </div>
      )}

      {/* Lightbox Overlay */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 bg-zinc-900/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8" onClick={() => setSelectedMedia(null)}>
          <button className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-800/50 hover:bg-zinc-800 rounded-md">
            <X className="size-6" />
          </button>
          <div className="max-w-5xl w-full max-h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {selectedMedia.file_type === 'photo' ? (
              <img src={`${API_BASE_URL.replace('/api', '')}${selectedMedia.file_path}`} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain ring-1 ring-white/10" alt="" />
            ) : (
              <video controls autoPlay className="w-full rounded-lg shadow-2xl max-h-[85vh] ring-1 ring-white/10 outline-none">
                <source src={`${API_BASE_URL.replace('/api', '')}${selectedMedia.file_path}`} />
              </video>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
//  CREATE ALBUM MODAL
// =====================================================================
function CreateAlbumModal({ onCreated }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], file: null });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.file) return alert('Select a cover photo/video');
    setLoading(true);
    const formData = new FormData();
    formData.append('media', form.file);
    formData.append('title', form.title);
    formData.append('event_date', form.date);
    formData.append('institutionId', user.institutionId);
    formData.append('adminId', user.id);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/gallery/upload`, { method: 'POST', body: formData });
      if (res.ok) {
        setOpen(false);
        onCreated();
        setForm({ title: '', date: new Date().toISOString().split('T')[0], file: null });
      } else {
        alert('Upload failed');
      }
    } catch (err) { alert('Failed to create'); }
    setLoading(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="h-9 w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0">
        <Plus className="size-4" /> New Album
      </button>
      
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-md p-6 shadow-xl relative animate-in fade-in duration-200">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 transition-colors">
              <X className="size-5 shrink-0" />
            </button>
            
            <h2 className="text-lg font-semibold text-zinc-900 mb-6">Create Album</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Album Title <span className="text-accent">*</span></label>
                <input required placeholder="e.g. Annual Sports Day"
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" 
                  value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              </div>
              
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Event Date <span className="text-accent">*</span></label>
                <input type="date" required 
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" 
                  value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              </div>
              
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Cover Media <span className="text-accent">*</span></label>
                <input type="file" required accept="image/*,video/*" 
                  className="w-full text-sm text-zinc-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors cursor-pointer" 
                  onChange={e => setForm({...form, file: e.target.files[0]})} />
              </div>
              
              <div className="pt-2">
                <button disabled={loading} type="submit"
                  className="h-9 w-full bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors">
                  {loading ? <Loader2 className="size-4 animate-spin shrink-0" /> : null}
                  {loading ? 'Creating...' : 'Create Album'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}