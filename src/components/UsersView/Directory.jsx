import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { Search, Users, Loader2, HelpCircle, X, ShieldCheck } from 'lucide-react';
import UserProfileDetail from './UserProfileDetail';

// Numeric roll for ordering (non-numeric rolls sort last)
const rollNum = (s) => {
  const n = parseInt(s?.roll_no, 10);
  return isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

export default function Directory() {
  const { user } = useAuth();
  const [data, setData] = useState({ users: [], roles: [], classes: [] });
  const [loading, setLoading] = useState(true);
  // Store the full selected user record (not just the id) so the detail
  // screen has every column without an extra round-trip.
  const [selected, setSelected] = useState(null);

  // Filters
  const [activeRole, setActiveRole] = useState('All');
  const [activeClass, setActiveClass] = useState('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}?fullUsers=true`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Directory fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Active (non-alumni) members only — passed-out students are excluded.
  const activeUsers = useMemo(
    () => (data.users || []).filter(u => (u.status || '').toLowerCase() !== 'alumni'),
    [data.users]
  );

  // Logic: Filter + sort
  const filteredUsers = useMemo(() => {
    let list = activeUsers;
    if (activeRole !== 'All') list = list.filter(u => u.role === activeRole);
    if (activeRole === 'Student' && activeClass !== 'all') {
      list = list.filter(u => String(u.class_id) === String(activeClass));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)));
    }
    // Students are listed roll-wise; everyone else alphabetically.
    if (activeRole === 'Student') {
      list = [...list].sort((a, b) => {
        const r = rollNum(a) - rollNum(b);
        return r !== 0 ? r : (a.name || '').localeCompare(b.name || '');
      });
    } else {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return list;
  }, [activeUsers, activeRole, activeClass, search]);

  if (selected) {
    return (
      <UserProfileDetail
        userId={selected.id}
        seedProfile={selected}
        classes={data.classes || []}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Institution Directory</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Browse and view profiles of all members.</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <DirectoryHelp />
          <div className="relative flex-1 md:flex-none md:w-72 shrink-0">
            <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm"
            />
          </div>
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
              onClick={() => setSelected(u)}
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
              {u.role === 'Student' && u.roll_no != null && u.roll_no !== '' && (
                <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/5 text-primary ring-1 ring-primary/15">
                  Roll {u.roll_no}
                </span>
              )}
              {u.email && (
                <p className="text-[10px] text-zinc-400 truncate w-full mt-1.5" title={u.email}>{u.email}</p>
              )}
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


// =====================================================================
//  DirectoryHelp — "How to use" guide.
//  Same button + modal theme as the Reports module's ReportsHelp, so the
//  help stays consistent across the app. Single guide (no tabs, no year).
// =====================================================================
const DIRECTORY_GUIDE = {
  title: 'Institution Directory',
  steps: [
    ['1 \u00b7 Who you see', 'Every active member of the school \u2014 students, teachers and staff. Passed-out (alumni) students are left out, so this is always the current roll.'],
    ['2 \u00b7 Filter by role', 'The tabs across the top switch between All and each role (Student, Teacher, and any custom roles your school has set up).'],
    ['3 \u00b7 Narrow students by class', 'Pick the Student tab and a class filter appears \u2014 handy for finding one class quickly. Students are listed roll-number-wise; everyone else alphabetically.'],
    ['4 \u00b7 Search', 'Type a name, username or email to jump straight to someone across every role at once.'],
    ['5 \u00b7 Open a profile', 'Click any card for the full profile: Basic Info for everyone, plus Performance and Attendance for students and teachers.'],
  ],
  note: 'Inside a profile, the Performance and Attendance tabs are read-only views of the same live data as those modules (current academic year). To change a mark or a day, use the Reports or Attendance module \u2014 the profile updates on its own.'
};

function DirectoryHelp({ className = '' }) {
  const [open, setOpen] = useState(false);
  const content = DIRECTORY_GUIDE;

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 self-start ${className}`}>
        <HelpCircle className="size-3.5" /> How to use
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
              <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X className="size-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              {content.steps.map(([t, d], i) => (
                <div key={i} className="rounded-md ring-1 ring-zinc-100 bg-zinc-50/60 p-3">
                  <p className="text-xs font-semibold text-zinc-800">{t}</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
                </div>
              ))}
              <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex gap-2">
                <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">{content.note}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}