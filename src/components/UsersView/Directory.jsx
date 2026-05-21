import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { 
  Search, Users, GraduationCap, School, UserCheck, 
  ChevronLeft, LayoutGrid, ListFilter 
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Institution Directory</h1>
          <p className="text-slate-500 font-medium">Browse and view profiles of all members.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Role Tabs */}
      <div className="flex flex-wrap gap-2 bg-slate-100/50 p-1.5 rounded-2xl w-fit">
        {['All', ...data.roles.map(r => r.role_name)].map(role => (
          <button
            key={role}
            onClick={() => { setActiveRole(role); setActiveClass('all'); }}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeRole === role ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-white'
            }`}
          >
            {role}
          </button>
        ))}
      </div>

      {/* Conditional Class Filter for Students */}
      {activeRole === 'Student' && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setActiveClass('all')}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-[11px] font-bold border ${
              activeClass === 'all' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            All Classes
          </button>
          {data.classes.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveClass(c.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-[11px] font-bold border ${
                String(activeClass) === String(c.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              {c.className} {c.section ? `- ${c.section}` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {filteredUsers.map(u => (
            <div 
              key={u.id}
              onClick={() => setSelectedUserId(u.id)}
              className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group text-center"
            >
              <div className="relative inline-block mb-4">
                {u.profile_pic ? (
                  <img src={u.profile_pic} className="w-24 h-24 rounded-[1.5rem] object-cover ring-4 ring-white shadow-lg" alt={u.name} />
                ) : (
                  <div className="w-24 h-24 rounded-[1.5rem] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-400 group-hover:from-blue-500 group-hover:to-indigo-600 group-hover:text-white transition-all">
                    <Users size={32} />
                  </div>
                )}
              </div>
              <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{u.name}</h3>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter mt-1">{u.role}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredUsers.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <p className="text-slate-400 font-medium">No users found in this category.</p>
        </div>
      )}
    </div>
  );
}