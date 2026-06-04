import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { GraduationCap, Users as UsersIcon, UserCog, ClipboardCheck, History, Search, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import RosterMarker from './RosterMarker';
import AttendanceHistory from './AttendanceHistory';
import { API_BASE_URL } from '../../apiConfig';

// =====================================================================
//  Attendance — Top-level container
//  Three category tabs (Students / Teachers / Other) × two action
//  sub-tabs (Mark / History).
//
//  Access rules:
//    • Super Admin           -> full access everywhere
//    • Student               -> only own history (Students tab -> History)
//    • Teacher               -> mark Students (their classes), view own history
//    • Custom role           -> only own history by default; mark only if
//                               Super Admin granted edit permission on
//                               the Attendance module.
// =====================================================================

export default function Attendance() {
  const { user } = useAuth();
  const { can, isAllAccess } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role === 'student';
  const isTeacher = role.includes('teacher');
  const isSuper   = isAllAccess; // covers Super Admin and Developer

  const canMark = isSuper || isTeacher || can('Attendance', 'edit');

  // Which category tabs are visible to this user?
  const categories = useMemo(() => {
    if (isSuper)   return ['students', 'teachers', 'other'];
    if (isTeacher) return ['students', 'teachers']; // teacher marks students, views own
    if (isStudent) return ['students'];             // sees only their history
    // Custom roles — show everything they have any kind of access to
    return ['students', 'teachers', 'other'];
  }, [isSuper, isTeacher, isStudent]);

  const [category, setCategory] = useState(categories[0]);
  const [mode, setMode] = useState('mark'); // 'mark' | 'history'

  // If the user can't mark at all, lock them to history view
  useEffect(() => {
    if (!canMark) setMode('history');
  }, [canMark]);

  // Students/custom-role users see only their own history; force category+mode
  const forceSelfHistory = isStudent || (!isSuper && !isTeacher && !can('Attendance', 'edit'));

  const categoryConfig = {
    students: { label: 'Students', icon: GraduationCap },
    teachers: { label: 'Teachers', icon: UsersIcon },
    other:    { label: 'Other',    icon: UserCog }
  };

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  if (forceSelfHistory) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-500">
        <Header subtitle="Your attendance history" />
        <AttendanceHistory userId={user.id} userName={user.name} selfOnly />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-3 sm:space-y-6 animate-in fade-in duration-500">
      <Header subtitle="Mark and review daily attendance" />

      {/* Navigation Controls Wrapper - Tighter spacing on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Category Tabs (Students / Teachers / Other) */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map(key => {
            const cfg = categoryConfig[key];
            const Icon = cfg.icon;
            const active = category === key;
            return (
              <button key={key}
                onClick={() => setCategory(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-50 border border-zinc-200 bg-white'
                }`}>
                <Icon className="size-3.5 shrink-0" /> {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Mode toggle (Mark / History) - Spans full width evenly on mobile */}
        <div className="flex sm:inline-flex bg-zinc-100/80 p-1 rounded-md shrink-0 w-full sm:w-auto">
          {canMark && (
            <button
              onClick={() => setMode('mark')}
              className={`flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                mode === 'mark' ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              <ClipboardCheck className="size-3.5" /> Mark
            </button>
          )}
          <button
            onClick={() => setMode('history')}
            className={`flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              mode === 'history' ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            <History className="size-3.5" /> History
          </button>
        </div>
      </div>

      {/* Body */}
      {mode === 'mark' ? (
        <RosterMarker category={category} />
      ) : (
        <HistoryPicker category={category} />
      )}
    </div>
  );
}

// Reduced bottom margin on mobile to save vertical space
function Header({ subtitle }) {
  return (
    <header className="flex flex-col mb-1 sm:mb-4">
      <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Attendance</h1>
      <p className="text-sm text-zinc-500 mt-0.5 max-w-[56ch]">{subtitle}</p>
    </header>
  );
}

// =====================================================================
//  HistoryPicker — for Super Admin/teacher/custom-role looking at
//  someone *else's* history. Lets them pick a user from a category.
// =====================================================================

function HistoryPicker({ category }) {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();
  const role = (user?.role || '').toLowerCase();
  const isTeacher = role.includes('teacher');

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState(null);
  const [loading, setLoading] = useState(true);

  // Teacher in "teachers" tab -> just shortcut to their own history
  const teacherViewingTeachers = !isAllAccess && isTeacher && category === 'teachers';

  const loadRoster = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const url = `${API_BASE_URL}/admin/attendance/roster/${user.institutionId}?category=${category}&date=${today}`;
      const res = await fetch(url);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user, category]);

  useEffect(() => {
    if (!teacherViewingTeachers) loadRoster();
    else setLoading(false);
  }, [loadRoster, teacherViewingTeachers]);

  if (teacherViewingTeachers) {
    return <AttendanceHistory userId={user.id} userName={user.name} selfOnly />;
  }

  if (picked) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <button onClick={() => setPicked(null)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
          <ChevronLeft className="size-4" /> Back to {category} list
        </button>
        <AttendanceHistory userId={picked.id} userName={picked.name} />
      </div>
    );
  }

  const filtered = users.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative w-full sm:w-80">
        <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          placeholder={`Search ${category}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm"
        />
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center">
          <p className="text-zinc-500 text-sm font-medium">No {category} found.</p>
        </div>
      ) : (
        <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap">Name</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 whitespace-nowrap">Role</th>
                <th className="px-5 py-3 border-b border-zinc-100"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-zinc-50/60 transition-colors cursor-pointer group" onClick={() => setPicked(u)}>
                  <td className="px-5 py-4 flex items-center gap-3">
                    {u.profile_pic ? (
                      <img src={u.profile_pic} alt="" className="size-8 rounded-full object-cover shrink-0 ring-1 ring-black/5" />
                    ) : (
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0 ring-1 ring-primary/20">
                        {(u.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-zinc-900 text-sm truncate">{u.name}</span>
                      {u.username && <span className="text-[10px] text-zinc-500 truncate">@{u.username}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 whitespace-nowrap">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      View Details
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}