import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { 
  Search, Users, GraduationCap, School, UserCheck, 
  ChevronLeft, LayoutGrid, ListFilter, Loader2
} from 'lucide-react';
import UserProfileDetail from './UserProfileDetail';

export default function Directory() {
  const { user } = useAuth();
  const [data, setData] = useState({ users: [], roles: [], classes: [] });
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Filters
  const [activeRole, setActiveRole] = useState('All');
  const [activeClass, setActiveClass] = useState('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Directory fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Logic: Filter Users
  const filteredUsers = useMemo(() => {
    let list = data.users || [];
    if (activeRole !== 'All') list = list.filter(u => u.role === activeRole);
    if (activeRole === 'Student' && activeClass !== 'all') {
      list = list.filter(u => String(u.class_id) === String(activeClass));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || (u.username && u.username.toLowerCase().includes(q)));
    }
    return list;
  }, [data.users, activeRole, activeClass, search]);

  if (selectedUserId) {
    return <UserProfileDetail userId={selectedUserId} onBack={() => setSelectedUserId(null)} />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Institution Directory</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Browse and view profiles of all members.</p>
        </div>
        
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input 
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm"
          />
        </div>
      </header>

      {/* Role Tabs */}
      <div className="flex justify-start">
        <div className="inline-flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar max-w-full">
          {['All', ...data.roles.map(r => r.role_name)].map(role => (
            <button
              key={role}
              onClick={() => { setActiveRole(role); setActiveClass('all'); }}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                activeRole === role ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Conditional Class Filter for Students */}
      {activeRole === 'Student' && (
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar w-full pb-2 sm:pb-0 pt-1">
          <button
            onClick={() => setActiveClass('all')}
            className={`h-8 px-4 rounded-md text-[11px] font-semibold ring-1 transition-colors whitespace-nowrap ${
              activeClass === 'all' 
                ? 'bg-primary/10 text-primary ring-primary/20' 
                : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
            }`}
          >
            All Classes
          </button>
          {data.classes.map(c => {
            const isActive = String(activeClass) === String(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setActiveClass(c.id)}
                className={`h-8 px-4 rounded-md text-[11px] font-semibold ring-1 transition-colors whitespace-nowrap ${
                  isActive 
                    ? 'bg-primary/10 text-primary ring-primary/20' 
                    : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {c.className} {c.section ? `- ${c.section}` : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="animate-spin size-8 text-primary" />
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {filteredUsers.map(u => (
            <div 
              key={u.id}
              onClick={() => setSelectedUserId(u.id)}
              className="bg-white p-4 sm:p-5 rounded-lg ring-1 ring-black/5 shadow-sm hover:ring-zinc-300 transition-all cursor-pointer group flex flex-col items-center text-center"
            >
              <div className="relative mb-3 sm:mb-4">
                {u.profile_pic ? (
                  <img src={u.profile_pic} className="size-20 sm:size-24 rounded-full object-cover ring-1 ring-black/5 shadow-sm" alt={u.name} />
                ) : (
                  <div className="size-20 sm:size-24 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors ring-1 ring-black/5">
                    <Users className="size-8 sm:size-10" />
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-zinc-900 text-sm truncate w-full">{u.name}</h3>
              <p className="text-[10px] font-medium uppercase text-zinc-500 tracking-wider mt-1 truncate w-full">{u.role}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <Users className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No users found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}