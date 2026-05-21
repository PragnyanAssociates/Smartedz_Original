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
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gallery</h1>
                    <p className="text-slate-500 font-medium">Memories and events captured in time.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            placeholder="Search albums..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm"
                        />
                    </div>
                    {/* Only show 'New Album' if user has edit permissions */}
                    {canCreate && <CreateAlbumModal onCreated={fetchAlbums} />}
                </div>
            </div>

            {/* Album Grid */}
            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
                </div>
            ) : filteredAlbums.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredAlbums.map(album => (
                        <div 
                            key={album.title}
                            onClick={() => setViewingAlbum(album.title)}
                            className="group bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer"
                        >
                            <div className="aspect-video relative overflow-hidden bg-slate-100">
                                <img 
                                    src={`${API_BASE_URL.replace('/api', '')}${album.cover_image}`} 
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                    alt={album.title} 
                                    onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800"; }}
                                />
                                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-slate-800 shadow-sm">
                                    {album.item_count} ITEMS
                                </div>
                            </div>
                            <div className="p-6">
                                <h3 className="font-black text-slate-800 text-lg leading-tight line-clamp-1">{album.title}</h3>
                                <div className="flex items-center gap-2 mt-2 text-slate-400">
                                    <Calendar size={14} />
                                    <span className="text-xs font-bold">{new Date(album.event_date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white p-20 rounded-[3rem] border border-dashed border-slate-200 text-center">
                    <AlbumIcon size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">No albums found. Create your first one!</p>
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
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm transition-colors">
                <ChevronLeft size={20} /> Back to Gallery
            </button>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-3xl font-black text-slate-900">{albumTitle}</h2>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
                        {['all', 'photo', 'video'].map(type => (
                            <button 
                                key={type}
                                onClick={() => setFilter(type)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${filter === type ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                    {canEdit && (
                        <label className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-2xl font-bold flex items-center gap-2 cursor-pointer transition-all shadow-lg">
                            <Plus size={18} /> Add Media
                            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
                        </label>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredItems.map(item => (
                        <div 
                            key={item.id}
                            onClick={() => setSelectedMedia(item)}
                            className="group relative aspect-square rounded-[2rem] overflow-hidden bg-slate-100 border border-slate-100 cursor-pointer"
                        >
                            {item.file_type === 'photo' ? (
                                <img src={`${API_BASE_URL.replace('/api', '')}${item.file_path}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                                    <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
                                        <Play size={32} fill="currentColor" />
                                    </div>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                {canDelete && (
                                    <button onClick={(e) => handleDelete(item.id, e)} className="p-3 bg-white/20 hover:bg-red-500 text-white rounded-2xl backdrop-blur-md transition-all">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                                <a href={`${API_BASE_URL.replace('/api', '')}${item.file_path}`} download target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="p-3 bg-white/20 hover:bg-blue-500 text-white rounded-2xl backdrop-blur-md transition-all">
                                    <Download size={18} />
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox Overlay */}
            {selectedMedia && (
                <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 md:p-10" onClick={() => setSelectedMedia(null)}>
                    <button className="absolute top-10 right-10 text-white/50 hover:text-white transition-colors">
                        <X size={32} />
                    </button>
                    <div className="max-w-5xl w-full max-h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        {selectedMedia.file_type === 'photo' ? (
                            <img src={`${API_BASE_URL.replace('/api', '')}${selectedMedia.file_path}`} className="max-w-full max-h-[85vh] rounded-3xl shadow-2xl object-contain border-4 border-white/10" alt="" />
                        ) : (
                            <video controls autoPlay className="w-full rounded-3xl shadow-2xl max-h-[85vh]">
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
            <button onClick={() => setOpen(true)} className="bg-slate-900 hover:bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg">
                <Plus size={18} /> New Album
            </button>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button type="button" onClick={() => setOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600"><X size={24} /></button>
                        <h2 className="text-2xl font-black text-slate-800 mb-6">Create Album</h2>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Album Title</label>
                                <input required className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Event Date</label>
                                <input type="date" required className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cover Media</label>
                                <input type="file" required accept="image/*,video/*" className="w-full text-xs text-slate-500" onChange={e => setForm({...form, file: e.target.files[0]})} />
                            </div>
                            <button disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl mt-4 flex items-center justify-center gap-2 disabled:opacity-50">
                                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create Album'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}