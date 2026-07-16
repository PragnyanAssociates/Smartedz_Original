import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from './PermissionsContext';
import { MODULES } from './Modules';
import { API_BASE_URL } from '../apiConfig';
import { Search, LogOut, X, Bell, Calendar } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, isMobileOpen, setIsMobileOpen }) {
  const { user, logout } = useAuth();
  const { isVisible, loading } = usePermissions();
  const [query, setQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [order, setOrder] = useState(null); // module_name -> position, set by the school

  // The school's own menu order (Manage Logins -> Menu Order). Until it
  // arrives — or if the school never set one — Modules.js order stands.
  useEffect(() => {
    if (!user?.institutionId) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/module-order/${user.institutionId}`);
        if (!res.ok) return;
        const rows = await res.json();
        if (!active || !Array.isArray(rows)) return;
        const map = {};
        rows.forEach(r => { map[r.module_name] = Number(r.sort_order); });
        setOrder(Object.keys(map).length ? map : null);
      } catch (e) { /* silent — fall back to the default order */ }
    })();
    return () => { active = false; };
  }, [user?.institutionId]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = MODULES.filter(m => {
      if (m.hideFromSidebar) return false;
      if (!m.alwaysVisible && !isVisible(m.module_name)) return false;
      if (q && !m.label.toLowerCase().includes(q)) return false;
      return true;
    });
    if (!order) return items;
    // Positioned modules first, in the school's order; anything the school
    // hasn't positioned yet keeps its Modules.js slot behind them.
    const fallback = MODULES.length;
    return [...items].sort((a, b) => {
      const ai = order[a.module_name] ?? (fallback + MODULES.indexOf(a));
      const bi = order[b.module_name] ?? (fallback + MODULES.indexOf(b));
      return ai - bi;
    });
  }, [query, isVisible, order]);

  // Poll the unread notification count for the bell badge. Re-fetches when
  // the active tab changes too, so opening Notifications updates it quickly.
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const loadCount = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/notifications/${user.id}/unread-count`);
        const d = await res.json();
        if (active) setUnreadCount(d.count || 0);
      } catch (e) { /* silent — badge just stays as-is */ }
    };
    loadCount();
    const t = setInterval(loadCount, 30000);
    return () => { active = false; clearInterval(t); };
  }, [user?.id]);

  // Intercept tab clicks to close the mobile menu automatically
  const handleTabClick = (id) => {
    setActiveTab(id);
    setIsMobileOpen(false);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
    }
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
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-zinc-900 tracking-tight leading-7 truncate pr-2">
              {user?.role || 'Super Admin'}
            </h2>

            {/* Quick Actions (Calendar & Notifications) */}
            <div className="flex items-center gap-1 shrink-0">

              {/* LINKED EXACTLY LIKE PROFILE: Passes 'academic-calendar' to DashboardShell */}
              <button
                onClick={() => handleTabClick('academic-calendar')}
                className={`p-1.5 rounded-md transition-colors ${activeTab === 'academic-calendar' ? 'bg-primary/10 text-primary' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'}`}
                title="Academic Calendar"
              >
                <Calendar className="size-4" />
              </button>

              <button
                onClick={() => handleTabClick('notifications')}
                className={`p-1.5 rounded-md transition-colors ${activeTab === 'notifications' ? 'bg-primary/10 text-primary' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'} relative`}
                title="Notifications"
              >
                <Bell className="size-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 bg-red-500 text-white text-[8px] font-bold rounded-full ring-2 ring-white flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Mobile Close Button */}
              <button
                onClick={() => setIsMobileOpen(false)}
                className="md:hidden p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors ml-1"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Administrative Control
          </p>
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

        {/* User Profile Card + separate Logout button */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50/50 shrink-0">

          <div className={`flex items-stretch rounded-lg ring-1 bg-white overflow-hidden transition-all ${
            activeTab === 'profile' ? 'ring-primary/40 shadow-sm' : 'ring-black/5'
          }`}>

            {/* Profile — unchanged behaviour */}
            <button
              onClick={() => handleTabClick('profile')}
              className={`flex-1 min-w-0 flex items-center gap-3 p-3 text-left transition-colors ${
                activeTab === 'profile' ? 'bg-white' : 'bg-white hover:bg-zinc-50/80'
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

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{user?.name || 'User'}</p>
                <p className={`text-[10px] font-medium uppercase tracking-wide ${activeTab === 'profile' ? 'text-primary' : 'text-zinc-500'}`}>
                  {user?.role || 'Admin'}
                </p>
              </div>
            </button>

            {/* Divider */}
            <div className="w-px bg-zinc-200 shrink-0" />

            {/* Logout — clearly its own control */}
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="shrink-0 w-16 flex flex-col items-center justify-center gap-0.5 px-2 py-2 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 active:bg-red-200/70 transition-colors group"
            >
              <LogOut className="size-4 shrink-0 transition-transform group-hover:scale-110" />
              <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}