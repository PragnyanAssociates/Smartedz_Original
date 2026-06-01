import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from './PermissionsContext';
import { MODULES } from './Modules';
import { Search, LogOut, X } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, isMobileOpen, setIsMobileOpen }) {
  const { user, logout } = useAuth();
  const { isVisible, loading } = usePermissions();
  const [query, setQuery] = useState('');

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MODULES.filter(m => {
      if (m.hideFromSidebar) return false; 
      if (!m.alwaysVisible && !isVisible(m.module_name)) return false;
      if (q && !m.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, isVisible]);

  // Intercept tab clicks to close the mobile menu automatically
  const handleTabClick = (id) => {
    setActiveTab(id);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* MOBILE OVERLAY: Dims the background when sidebar is open on small screens */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* SIDEBAR CONTAINER: Sliding on mobile, fixed static on desktop */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-zinc-200 flex flex-col h-[100dvh] shrink-0 transition-transform duration-300 ease-in-out md:static md:translate-x-0 shadow-2xl md:shadow-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 pb-2 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 tracking-tight leading-none">
              {user?.role || 'Super Admin'}
            </h2>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mt-2">
              Administrative Control
            </p>
          </div>
          
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-5 mt-4 mb-6">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 size-3.5 shrink-0" />
            <input
              type="text"
              placeholder="Search Modules..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-zinc-900 placeholder:text-zinc-400 transition-colors"
            />
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar pb-6">
          <div className="px-4 mb-3">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Main Menu</span>
          </div>

          {loading ? (
            <div className="px-4 py-3 text-xs text-zinc-500 italic">Loading menu...</div>
          ) : visibleItems.length === 0 ? (
            <div className="px-4 py-6 text-xs text-zinc-500 italic text-center">
              No modules available.
            </div>
          ) : (
            visibleItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors group ${
                  activeTab === item.id 
                    ? 'bg-primary text-white shadow-sm' 
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <div className={`p-1 rounded transition-colors ${activeTab === item.id ? 'bg-white/20' : 'bg-transparent group-hover:bg-zinc-200/50'}`}>
                  <img 
                    src={item.imageSource} 
                    alt={item.label} 
                    className="size-5 object-contain shrink-0"
                    style={{ filter: activeTab === item.id ? 'brightness(1.2)' : 'none' }}
                  />
                </div>
                <span className={`text-sm font-medium tracking-tight ${activeTab === item.id ? 'text-white' : 'text-zinc-700 group-hover:text-zinc-900'}`}>
                  {item.label}
                </span>
              </button>
            ))
          )}
        </nav>

        {/* User Profile Card */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50/50 shrink-0">
          <button 
            onClick={() => handleTabClick('profile')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg ring-1 transition-all ${
              activeTab === 'profile' 
              ? 'ring-primary/40 bg-white shadow-sm' 
              : 'ring-black/5 bg-white hover:ring-primary/20 hover:bg-zinc-50/80'
            }`}
          >
            <div className="size-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0 transition-colors overflow-hidden bg-primary shadow-sm">
              {user?.profile_pic ? (
                <img 
                  src={user.profile_pic} 
                  className="w-full h-full object-cover" 
                  alt="avatar" 
                  onError={(e) => { e.target.style.display = 'none'; }} 
                />
              ) : (
                user?.name?.charAt(0).toUpperCase() || 'A'
              )}
            </div>
            
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-zinc-900 truncate">{user?.name || 'User'}</p>
              <p className={`text-[10px] font-medium uppercase tracking-wide ${activeTab === 'profile' ? 'text-primary' : 'text-zinc-500'}`}>
                 {user?.role || 'Admin'}
              </p>
            </div>
            <div 
              onClick={(e) => { e.stopPropagation(); logout(); }} 
              className="p-1.5 text-zinc-400 hover:text-accent hover:bg-accent/10 rounded transition-colors group"
              title="Logout"
            >
              <LogOut className="size-4 shrink-0 transition-transform group-hover:scale-110" />
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}