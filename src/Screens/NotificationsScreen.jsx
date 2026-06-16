import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';
import {
  Bell, BookOpen, CalendarDays, Award, CheckCheck, Trash2, Loader2, Inbox,
  FlaskConical, BookMarked, Video, MessagesSquare, BookText, FileText,
  Users, Images, Utensils
} from 'lucide-react';

// =====================================================================
//  NotificationsScreen
//  • Lists the logged-in user's notifications with All / Unread / Read
//    tabs (filtered client-side from a single fetch).
//  • Clicking a row marks it read and jumps to the source module via
//    onNavigate(tabId) — the `link` field holds the dashboard tab id
//    (the module `id` from Screens/Modules.js, e.g. 'Homework',
//    'DigitalLabs', 'LessonPlan', 'OnlineClasses', 'GroupChat',
//    'Syllabus', 'StudyMaterials', 'PTM', 'Gallery', 'Meals').
//  • Mark-all-read and delete one are supported.
//
//  Props: onNavigate(tabId) — switches the dashboard's active tab.
// =====================================================================

// Per-type icon + colour. Unknown types fall back to a generic bell.
const TYPE_META = {
  homework:       { icon: BookOpen,      bg: 'bg-indigo-50',  text: 'text-indigo-600',  ring: 'ring-indigo-600/20',  label: 'Homework' },
  event:          { icon: CalendarDays,  bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-600/20', label: 'Event' },
  result:         { icon: Award,         bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-600/20',   label: 'Result' },
  lab:            { icon: FlaskConical,  bg: 'bg-sky-50',     text: 'text-sky-600',     ring: 'ring-sky-600/20',     label: 'Lab' },
  lesson_plan:    { icon: BookMarked,    bg: 'bg-violet-50',  text: 'text-violet-600',  ring: 'ring-violet-600/20',  label: 'Lesson Plan' },
  online_class:   { icon: Video,         bg: 'bg-rose-50',    text: 'text-rose-600',    ring: 'ring-rose-600/20',    label: 'Online Class' },
  group_chat:     { icon: MessagesSquare,bg: 'bg-teal-50',    text: 'text-teal-600',    ring: 'ring-teal-600/20',    label: 'Group' },
  syllabus:       { icon: BookText,      bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-600/20',    label: 'Syllabus' },
  study_material: { icon: FileText,      bg: 'bg-cyan-50',    text: 'text-cyan-600',    ring: 'ring-cyan-600/20',    label: 'Study Material' },
  ptm:            { icon: Users,         bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', ring: 'ring-fuchsia-600/20', label: 'PTM' },
  gallery:        { icon: Images,        bg: 'bg-pink-50',    text: 'text-pink-600',    ring: 'ring-pink-600/20',    label: 'Gallery' },
  meals:          { icon: Utensils,      bg: 'bg-orange-50',  text: 'text-orange-600',  ring: 'ring-orange-600/20',  label: 'Food Menu' }
};
const FALLBACK_META = { icon: Bell, bg: 'bg-zinc-100', text: 'text-zinc-600', ring: 'ring-zinc-200', label: 'Notification' };

// created_at comes back as a naive UTC string (server runs UTC). Tag it as
// UTC so the browser localises the relative time correctly.
const timeAgo = (s) => {
  if (!s) return '';
  let v = String(s);
  const hasTz = /[zZ]$/.test(v) || /[+-]\d\d:?\d\d$/.test(v);
  if (!hasTz) v = v.replace(' ', 'T') + 'Z';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60); if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);  if (hr < 24)  return `${hr}h ago`;
  const day = Math.floor(hr / 24);  if (day < 7)  return `${day}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export default function NotificationsScreen({ onNavigate }) {
  const { user } = useAuth();
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [busy, setBusy]     = useState(false);

  // Fetch the user's notifications once; the three tabs filter in-memory.
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/${user.id}?limit=100`);
      const d = await res.json();
      setItems(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); setItems([]); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const unreadCount = items.filter(n => !n.is_read).length;

  // Visible list for the active tab.
  const visible = items.filter(n =>
    filter === 'unread' ? !n.is_read :
    filter === 'read'   ? !!n.is_read :
    true
  );

  const markRead = async (id) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    try { await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: 'PUT' }); }
    catch (e) { console.error(e); }
  };

  const handleClick = async (n) => {
    if (!n.is_read) await markRead(n.id);
    if (n.link && typeof onNavigate === 'function') onNavigate(n.link);
  };

  const markAll = async () => {
    if (!user?.id) return;
    setBusy(true);
    setItems(prev => prev.map(n => ({ ...n, is_read: 1 })));
    try { await fetch(`${API_BASE_URL}/notifications/${user.id}/read-all`, { method: 'PUT' }); }
    catch (e) { console.error(e); }
    setBusy(false);
  };

  const remove = async (e, id) => {
    e.stopPropagation();
    setItems(prev => prev.filter(n => n.id !== id));
    try { await fetch(`${API_BASE_URL}/notifications/${id}`, { method: 'DELETE' }); }
    catch (err) { console.error(err); }
  };

  const emptyText = filter === 'unread'
    ? 'No unread notifications.'
    : filter === 'read'
      ? 'No read notifications.'
      : 'No notifications yet.';

  const TABS = [
    { k: 'all',    label: 'All' },
    { k: 'unread', label: 'Unread' },
    { k: 'read',   label: 'Read' }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300">

      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <Bell className="text-primary size-5" /> Notifications
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'}
          </p>
        </div>

        {items.some(n => !n.is_read) && (
          <button onClick={markAll} disabled={busy}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-white border border-zinc-200 text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition-colors self-start sm:self-auto disabled:opacity-50">
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        )}
      </header>

      {/* Filter tabs */}
      <div className="inline-flex bg-zinc-100/80 p-1 rounded-md">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)}
            className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              filter === t.k ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="animate-spin size-8 text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <Inbox className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">{emptyText}</p>
          <p className="text-zinc-400 text-xs mt-1.5">
            You'll be notified here about homework, labs, classes, results and more.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 overflow-hidden divide-y divide-zinc-100">
          {visible.map(n => {
            const meta = TYPE_META[n.type] || FALLBACK_META;
            const Icon = meta.icon;
            return (
              <div key={n.id} onClick={() => handleClick(n)}
                className={`group flex items-start gap-3 p-4 cursor-pointer transition-colors ${
                  n.is_read ? 'hover:bg-zinc-50/60' : 'bg-primary/[0.03] hover:bg-primary/[0.06]'
                }`}>
                <div className={`size-9 rounded-md ${meta.bg} ${meta.text} ring-1 ${meta.ring} flex items-center justify-center shrink-0`}>
                  <Icon className="size-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${n.is_read ? 'font-medium text-zinc-700' : 'font-semibold text-zinc-900'}`}>
                      {n.title}
                    </p>
                    {!n.is_read && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
                  </div>
                  {n.body && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{n.body}</p>}
                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mt-1 inline-block">
                    {meta.label} · {timeAgo(n.created_at)}
                  </span>
                </div>

                <button onClick={(e) => remove(e, n.id)} title="Remove"
                  className="p-1.5 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}