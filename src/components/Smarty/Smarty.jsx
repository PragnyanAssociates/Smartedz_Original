import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import { MODULES } from '../../Screens/Modules';
import { BUILTINS, LIVE_IDS, STARTERS_BY_ROLE } from './Smartyknowledge';
import katex from 'katex';               // renders LaTeX math/formulas like a textbook.
import 'katex/dist/katex.min.css';       // KaTeX stylesheet (required for correct layout).
import smartyGif from './smarty.gif';   // animated waving character on the launcher.
import smartyPic from './SmartyPic.png';  // static profile photo used in the header + chat avatars.

// =====================================================================
//  Smarty — in-app assistant. Mount ONCE in the dashboard shell:
//      <Smarty onNavigate={setActiveTab} />
//
//  • Free-standing animated lady (glasses, wavy hair, green top + purple
//    cardigan). Waves non-stop, thinks / types / smiles with the chat.
//  • Idle: every minute she waves and says “Hey <name>, need any help?”.
//  • Header shows the real user — name always; class + roll only for
//    students, name + role for everyone else.
//  • Role-aware questions: staff/admins never see class/homework cards.
//  • Chat history is kept across tabs and reopens (per-user, this session).
//  • Colourful replies tinted per topic. Live answers come from
//    GET /api/smarty/bootstrap/:userId — never made up.
// =====================================================================

const idToModule = {}, idToLabel = {};
MODULES.forEach(m => { idToModule[m.id] = m.module_name; idToLabel[m.id] = m.label || m.title || m.id; });
// Resolve a module name/label/id string to its Modules.js id (used to group
// "Browse by module" questions by the module they belong to).
const _modId = (s) => {
  if (!s) return null;
  const t = String(s).toLowerCase().trim();
  const m = MODULES.find(x => String(x.id).toLowerCase() === t || String(x.module_name || '').toLowerCase() === t || String(x.label || '').toLowerCase() === t);
  return m ? m.id : null;
};
// Modules everyone can open regardless of the permission matrix (home, profile,
// notifications are always reachable) — so Smarty never hides their shortcuts.
const ALWAYS_VISIBLE = new Set(['overview', ...MODULES.filter(m => m.alwaysVisible).map(m => m.id)]);
const toneVar = { sky: '--sky', amber: '--amber', emerald: '--emerald', rose: '--rose', violet: '--violet', brand: '--brand' };
// Browse-by-module cards: a relevant icon + a rotating accent colour per module.
const MOD_ICON = { overview: '🏠', 'manage-login': '🔑', DailyExpenses: '🧾', FeeManagement: '💰', Transport: '🚌', timetable: '📅', 'academic-calendar': '🗓️', attendance: '✅', Exams: '📝', reports: '📄', Performance: '📈', Directory: '👥', Gallery: '🖼️', Homework: '📚', Meals: '🍽️', PTM: '🧑‍🏫', OnlineClasses: '💻', DigitalLabs: '🔬', PreAdmissions: '🗂️', Admissions: '🎓', StudyMaterials: '📖', Syllabus: '📘', GroupChat: '💬', Alumni: '🎓', InventoryAssets: '📦', Support: '🛟', Library: '📚', notifications: '🔔', profile: '👤' };
const MOD_TONES = ['violet', 'sky', 'amber', 'emerald', 'rose', 'brand'];
const modIcon = (id) => MOD_ICON[id] || '📂';

// contextual follow-up chips shown after an answer (ids are filtered by role/visibility)
const FOLLOW = {
  'next-class': ['cal-today', 'hw-today', 'attendance', 'how-timetable'],
  'hw-today': ['how-hw', 'attendance', 'next-class'],
  'attendance': ['next-class', 'hw-today', 'how-report'],
  'cal-today': ['next-class', 'hw-today', 'news'],
  'news': ['cal-today', 'next-class', 'admin-reports', 'admin-directory'],
  'admin-reports': ['admin-fees', 'admin-directory', 'admin-smarty'],
  'admin-fees': ['admin-reports', 'admin-directory', 'admin-smarty'],
  'admin-directory': ['admin-reports', 'admin-fees', 'admin-smarty'],
};
const CONFETTI = Array.from({ length: 26 }).map((_, i) => ({
  e: ['🎉', '✨', '⭐', '🎊', '💫', '🌟'][i % 6],
  left: Math.round(Math.random() * 94) + 3,
  d: +(Math.random() * 0.5).toFixed(2),
  s: 14 + Math.round(Math.random() * 12),
}));

// ---- Academic Calendar: event type → Smarty tone + emoji ----
const CAL_TONE = { Holiday: 'emerald', Festival: 'rose', Exam: 'violet', Meeting: 'sky', Event: 'amber', Other: 'brand' };
const CAL_EMOJI = { Holiday: '🏖️', Festival: '🎉', Exam: '📝', Meeting: '👥', Event: '🎪', Other: '📌' };
const CAL_CELEBRATE = { Holiday: true, Festival: true };   // these pop confetti on login
// live question id -> the module it should open (for visibility + the Open button)
const LIVE_LINK = {
  'next-class': 'timetable', 'hw-today': 'Homework', 'attendance': 'attendance',
  'cal-today': 'academic-calendar', 'cal-next-holiday': 'academic-calendar', 'cal-month': 'academic-calendar',
  'my-notifications': 'notifications',
};
const calKey = (s) => String(s || '').slice(0, 10);        // '2026-11-11T..' -> '2026-11-11'
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function calWhen(key) {
  const tk = todayKey();
  if (key === tk) return 'Today';
  const a = new Date(tk + 'T00:00:00'), b = new Date(key + 'T00:00:00');
  const diff = Math.round((b - a) / 86400000);
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff <= 7) return `in ${diff} days`;
  return b.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
// Split the calendar feed into today / upcoming / this-month / next holiday.
function computeCalendar(events) {
  const tk = todayKey();
  const ym = tk.slice(0, 7);
  const norm = (Array.isArray(events) ? events : []).map(e => ({
    id: e.id, name: e.name, type: e.type || 'Other',
    time: e.time || '', description: e.description || '', key: calKey(e.event_date),
  })).filter(e => e.key);
  const today = norm.filter(e => e.key === tk).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const future = norm.filter(e => e.key > tk).sort((a, b) => a.key.localeCompare(b.key));
  const upcoming = future.slice(0, 4);
  const month = norm.filter(e => e.key.slice(0, 7) === ym).sort((a, b) => a.key.localeCompare(b.key));
  const nextHoliday = future.find(e => e.type === 'Holiday' || e.type === 'Festival') || null;
  const nextExam = future.find(e => e.type === 'Exam') || null;
  return { today, upcoming, month, nextHoliday, nextExam };
}

// ---- on-device "learning": remember which questions this user asks most ----
function freqLoad(uid) { try { return JSON.parse(localStorage.getItem('smy_freq_' + uid) || '{}') || {}; } catch { return {}; } }
function freqBump(uid, id) { if (!uid || !id) return; try { const f = freqLoad(uid); f[id] = (f[id] || 0) + 1; localStorage.setItem('smy_freq_' + uid, JSON.stringify(f)); } catch (_) {} }
function freqTop(uid, n) { const f = freqLoad(uid); return Object.keys(f).sort((a, b) => f[b] - f[a]).slice(0, n || 3); }

// tiny stopword set so free-text matching scores on meaningful words only
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'do', 'i', 'my', 'me', 'to', 'of', 'for', 'in', 'on', 'any', 'have', 'has', 'can', 'you', 'what', 'when', 'where', 'how', 'and', 'please', 'show', 'tell', 'get', 'there', 'this', 'that']);
const tokenize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && w.length > 2 && !STOP.has(w));

// ---- intent detection: greetings / small talk, caught BEFORE keyword match
//      so "hello smarty, how are you?" never hits the "Manage Smarty" button.
const RE_HOWRU  = /(how\s*(are|r)\s*(you|u|ya)|how'?s it going|how is it going|how do you do|what'?s up|wassup|\bsup\b|are you (ok|there|fine)|you there)/i;
const RE_GREET  = /^\s*(hi+|hey+|hello+|heya|hiya|yo|hola|namaste|namaskaram|greetings|good\s*(morning|afternoon|evening|night))\b/i;
const RE_WHORU  = /(who\s*are\s*you|what('?s| is)\s*your\s*name|your\s*name|what\s*(can|do)\s*you\s*(do|help)|what are you|are you (a )?(bot|ai|robot)|introduce yourself)/i;
const RE_BYE    = /^\s*(bye+|goodbye|see\s*you|good\s*night|cya|tata|ok bye|thank you bye)\b/i;

// The two "important" quick chips shown by default per role (next to Suggest
// questions + What's new). Role-aware so an admin never sees student cards.
const IMPORTANT_BY_ROLE = {
  student: ['next-class', 'hw-today'],
  parent:  ['next-class', 'hw-today'],
  teacher: ['next-class', 'admin-attendance'],
  admin:   ['admin-reports', 'admin-directory'],
  default: ['admin-reports', 'admin-directory'],
};
// What small talk points each role toward.
const HELP_HINT = {
  student: 'your next class, homework, attendance, or fees',
  parent:  'your child’s classes, homework, attendance, or fees',
  teacher: 'your next class, attendance, marks, or the timetable',
  admin:   'reports, fees, the directory, or managing the app',
  default: 'reports, the directory, or anything on screen',
};

function roleBucket(role) {
  const r = (role || '').toLowerCase();
  if (r.includes('student')) return 'student';
  if (r.includes('teacher')) return 'teacher';
  if (r.includes('parent') || r.includes('guardian')) return 'parent';
  if (r.includes('admin') || r.includes('principal') || r.includes('account') || r.includes('developer') || r.includes('office') || r.includes('staff') || r.includes('clerk')) return 'admin';
  return 'default';
}
function roleMatch(roles, role) {
  if (!roles || roles === 'all') return true;
  const r = (role || '').toLowerCase();
  const list = Array.isArray(roles) ? roles : String(roles).split(',');
  return list.map(x => x.trim().toLowerCase()).filter(Boolean).some(frag => r.includes(frag));
}

export default function Smarty({ onNavigate }) {
  const { user } = useAuth();
  const { isVisible } = usePermissions();

  const [open, setOpen] = useState(false);
  const [big, setBig] = useState(false);     // enlarge / full-size panel
  const [mood, setMood] = useState('idle');
  const [msgs, setMsgs] = useState([]);
  const [chips, setChips] = useState([]);
  const [modAll, setModAll] = useState(false);     // module card grid: View all / View less
  const [activeMod, setActiveMod] = useState(null); // drilled-in module id (question list), or null
  const [aliases, setAliases] = useState({});   // module_name -> alias (Menu Settings)
  const [input, setInput] = useState('');
  const [boot, setBoot] = useState(null);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState('');
  const [nudge, setNudge] = useState(false);
  const [nudgeMsg, setNudgeMsg] = useState('');
  const lastNotif = useRef(null);

  const scrollRef = useRef(null);
  const moodTimer = useRef(null);
  const keyRef = useRef(0);
  const greeted = useRef(false);
  const nextKey = () => ++keyRef.current;

  // ---- draggable launcher (remembers its spot) ----
  const [fabPos, setFabPos] = useState(null);     // {left, top} in px, or null = default corner
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ moved: false });
  const posRef = useRef(null);
  const moveFn = useRef(null);
  const upFn = useRef(null);

  // Where the launcher sits is a PER-USER, per-device preference. The storage
  // key is scoped by institution + user id, so on a shared computer (or after a
  // logout/login) one person's position never leaks to another, and schools on
  // this multi-tenant app stay isolated. It lives in localStorage, so each
  // device a user signs in on keeps its own spot.
  const fabKey = user?.id ? `smy_fab_pos_${user?.institutionId || '0'}_${user.id}` : null;
  useEffect(() => {
    // Retire the old shared key that made every user on a device inherit the
    // same position.
    try { localStorage.removeItem('smy_fab_pos'); } catch (_) {}
    // Place the launcher — and KEEP it on-screen on every resize / rotation /
    // device-mode change, so it can never end up off a small viewport (which is
    // why Smarty appeared to vanish on mobile and tablet).
    const place = () => {
      // Phones: always pin to the default bottom-right corner. Dragging is a
      // desktop affordance, and a saved desktop spot can land off a narrow screen.
      if (typeof window === 'undefined' || window.innerWidth < 640) {
        setFabPos(null); posRef.current = null; return;
      }
      try {
        const s = fabKey ? localStorage.getItem(fabKey) : null;
        if (s) {
          const p = JSON.parse(s);
          if (p && typeof p.left === 'number') {
            // clamp so the whole 132x152 launcher stays inside the viewport
            const left = Math.max(4, Math.min(window.innerWidth - 136, p.left));
            const top = Math.max(4, Math.min(window.innerHeight - 160, p.top));
            setFabPos({ left, top }); posRef.current = { left, top };
            return;
          }
        }
      } catch (_) {}
      // No saved spot → default corner.
      setFabPos(null); posRef.current = null;
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('orientationchange', place);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('orientationchange', place);
    };
  }, [fabKey]);

  const onFabDown = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const offX = e.clientX - r.left, offY = e.clientY - r.top;
    const startX = e.clientX, startY = e.clientY;
    const W = r.width, H = r.height;
    dragRef.current.moved = false;
    setDragging(true);
    moveFn.current = (ev) => {
      const left = Math.max(4, Math.min(window.innerWidth - W - 4, ev.clientX - offX));
      const top = Math.max(4, Math.min(window.innerHeight - H - 4, ev.clientY - offY));
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) dragRef.current.moved = true;
      posRef.current = { left, top };
      setFabPos({ left, top });
    };
    upFn.current = () => {
      window.removeEventListener('pointermove', moveFn.current);
      window.removeEventListener('pointerup', upFn.current);
      setDragging(false);
      if (fabKey && posRef.current) { try { localStorage.setItem(fabKey, JSON.stringify(posRef.current)); } catch (_) {} }
    };
    window.addEventListener('pointermove', moveFn.current);
    window.addEventListener('pointerup', upFn.current);
  };
  const onFabClick = () => { if (dragRef.current.moved) { dragRef.current.moved = false; return; } openPanel(); };

  const role = user?.role;
  const firstName = ((boot?.user?.name || user?.name || 'there').split(' ')[0]);
  const canSeeLink = useCallback((linkId) => !linkId || ALWAYS_VISIBLE.has(linkId) || isVisible(idToModule[linkId] || linkId), [isVisible]);

  // ---- memory: chat history persists ACROSS logins (localStorage), but the
  //      daily greeting/digest still fires once per browser session. ----
  const storeKey = user?.id ? `smy_msgs_${user.id}` : null;
  const greetKey = user?.id ? `smy_greeted_${user.id}` : null;
  useEffect(() => {
    if (!storeKey) return;
    try { const s = localStorage.getItem(storeKey); if (s) { const a = JSON.parse(s); if (Array.isArray(a) && a.length) setMsgs(a.slice(-40)); } } catch (_) {}
    try { if (greetKey && sessionStorage.getItem(greetKey) === '1') greeted.current = true; } catch (_) {}
  }, [storeKey, greetKey]);
  useEffect(() => { if (storeKey) { try { localStorage.setItem(storeKey, JSON.stringify(msgs.slice(-40))); } catch (_) {} } }, [msgs, storeKey]);

  // ---- answer pool for THIS user (role + module visibility) ----
  const buildPool = useCallback((b) => {
    const pool = [];
    BUILTINS.forEach(e => {
      if (!roleMatch(e.roles, role)) return;
      const linkId = e.answer?.link || LIVE_LINK[e.id] || null;
      if (linkId && !canSeeLink(linkId)) return;
      pool.push(e);
    });
    (b?.questions || []).forEach(q => {
      if (q.link && !canSeeLink(q.link)) return;
      pool.push({
        id: 'c' + q.id, q: q.question, roles: q.roles, tone: 'brand', icon: '💬',
        module: _modId(q.category) || (q.link || null),
        send: q.live_query || undefined,
        keywords: [String(q.question || '').toLowerCase(), ...String(q.keywords || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)],
        answer: { text: q.answer, link: q.link || null, linkLabel: q.link ? ('Open ' + (idToLabel[q.link] || q.link)) : null, tone: 'brand' }
      });
    });
    return pool;
  }, [role, canSeeLink]);

  // ---- live answers from bootstrap (never hard-coded) ----
  const liveAnswer = useCallback((id, b) => {
    if (id === 'next-class') {
      const n = b?.nextClass;
      if (!n) return { tone: 'sky', text: 'No more classes scheduled for today 🎉' };
      const s = [n.teacher ? `👩‍🏫 ${n.teacher}` : null, n.class_label, n.room ? `Room ${n.room}` : null].filter(Boolean).join(' · ');
      return { tone: 'sky', text: n.ongoing ? 'Your class right now 📖' : 'Your next class is coming up 📖',
        card: { em: '🔔', t: `${n.subject} · ${n.start}${n.end ? '–' + n.end : ''}`, s: s || 'Scheduled' },
        link: 'timetable', linkLabel: 'Open Timetable', extra: n.next_after ? `After that: ${n.next_after}.` : null };
    }
    if (id === 'hw-today') {
      const h = b?.homework;
      if (!h) return { tone: 'amber', text: "I couldn't load your homework just now.", link: 'Homework', linkLabel: 'Open Homework' };
      if (h.due_today > 0) return { tone: 'amber', text: `Yes! You have ${h.due_today} homework due today 📚`,
        card: h.next ? { em: '📘', t: h.next.title, s: [h.next.subject, h.pending > 1 ? `${h.pending} pending in all` : null].filter(Boolean).join(' · ') } : null,
        link: 'Homework', linkLabel: 'Open Homework' };
      if (h.pending > 0) return { tone: 'amber', text: `Nothing due today 🎈 — but you have ${h.pending} pending this week.`,
        card: h.next ? { em: '📘', t: h.next.title, s: `${h.next.subject || ''} · due ${h.next.due}` } : null, link: 'Homework', linkLabel: 'Open Homework' };
      return { tone: 'emerald', text: "You're all caught up — no pending homework! 🎉", link: 'Homework', linkLabel: 'Open Homework', celebrate: true };
    }
    if (id === 'attendance') {
      const a = b?.attendance;
      if (!a || a.percentage == null) return { tone: 'emerald', text: 'No attendance recorded yet for this year.', link: 'attendance', linkLabel: 'Open Attendance' };
      return { tone: 'emerald', text: `You're at ${a.percentage}% attendance 📊`,
        card: { em: '✅', t: `${a.present} of ${a.total} days present`, s: 'This academic year' }, link: 'attendance', linkLabel: 'Open Attendance',
        celebrate: Number(a.percentage) >= 100 };
    }
    if (id === 'cal-today') {
      const c = b?.calendar || { today: [], upcoming: [] };
      const fmtType = (e) => `${CAL_EMOJI[e.type] || '📌'} ${e.type}`;
      if (!c.today.length && !c.upcoming.length)
        return { tone: 'sky', text: 'Nothing on the calendar today, and the days ahead look clear 🗓️', link: 'academic-calendar', linkLabel: 'Open Calendar' };
      if (c.today.length) {
        const lead = c.today[0];
        return {
          tone: CAL_TONE[lead.type] || 'sky',
          text: c.today.length === 1 ? `📅 Today: ${lead.name} (${lead.type})` : `📅 You have ${c.today.length} things on today`,
          items: c.today.concat(c.upcoming).map((e, i) => ({
            ttl: `${e.name}${e.time ? ' · ' + e.time : ''}`,
            bd: `${i < c.today.length ? 'Today' : calWhen(e.key)} · ${fmtType(e)}${e.description ? ' — ' + e.description : ''}`,
            isNew: i < c.today.length, link: 'academic-calendar',
          })),
          link: 'academic-calendar', linkLabel: 'Open Calendar',
          celebrate: !!CAL_CELEBRATE[lead.type],
        };
      }
      return {
        tone: 'sky', text: "Nothing today — here's what's coming up 🗓️",
        items: c.upcoming.map(e => ({ ttl: `${e.name}${e.time ? ' · ' + e.time : ''}`, bd: `${calWhen(e.key)} · ${CAL_EMOJI[e.type] || '📌'} ${e.type}`, link: 'academic-calendar' })),
        link: 'academic-calendar', linkLabel: 'Open Calendar',
      };
    }
    if (id === 'cal-next-holiday') {
      const h = b?.calendar?.nextHoliday;
      if (!h) return { tone: 'emerald', text: 'No holidays or festivals coming up on the calendar yet 🗓️', link: 'academic-calendar', linkLabel: 'Open Calendar' };
      return { tone: CAL_TONE[h.type] || 'emerald', text: `${CAL_EMOJI[h.type] || '🎉'} Next ${h.type.toLowerCase()}: ${h.name}`,
        card: { em: CAL_EMOJI[h.type] || '🎉', t: h.name, s: `${calWhen(h.key)}${h.description ? ' · ' + h.description : ''}` },
        link: 'academic-calendar', linkLabel: 'Open Calendar' };
    }
    if (id === 'cal-month') {
      const m = b?.calendar?.month || [];
      if (!m.length) return { tone: 'sky', text: 'Nothing scheduled on the calendar this month 🗓️', link: 'academic-calendar', linkLabel: 'Open Calendar' };
      return { tone: 'sky', text: `🗓️ ${m.length} thing${m.length > 1 ? 's' : ''} on the calendar this month`,
        items: m.map(e => ({ ttl: `${e.name}${e.time ? ' · ' + e.time : ''}`, bd: `${calWhen(e.key)} · ${CAL_EMOJI[e.type] || '📌'} ${e.type}`, link: 'academic-calendar' })),
        link: 'academic-calendar', linkLabel: 'Open Calendar' };
    }
    if (id === 'my-notifications') {
      const nf = b?.notif || { unread: 0, items: [] };
      if (!nf.items.length) return { tone: 'violet', text: "You have no notifications right now — all caught up! 🎉", link: 'notifications', linkLabel: 'Open Notifications' };
      return { tone: 'violet',
        text: nf.unread > 0 ? `🔔 You have ${nf.unread} unread notification${nf.unread > 1 ? 's' : ''}` : "Here are your latest notifications 🔔",
        items: nf.items.slice(0, 5).map(n => ({ ttl: n.title, bd: n.body || '', isNew: !n.is_read, link: n.link || 'notifications' })),
        link: 'notifications', linkLabel: 'Open Notifications' };
    }
    if (id === 'news') {
      const items = (b?.updates || []);
      if (!items.length) return { tone: 'violet', text: "No new updates right now — I'll tell you the moment there are! 📣" };
      return { tone: 'violet', text: "Here's what's new 📣", items: items.map(u => ({ ttl: u.title, bd: u.body, isNew: !!u.is_new, link: u.link })) };
    }
    return null;
  }, []);

  // The default quick-chip row is intentionally empty now: "Browse by module"
  // is rendered as a PERMANENT button in the composer area (always visible,
  // even after answering a question), and everything else is asked by typing.
  const starters = useCallback(() => [], []);

  // expanded, personalised list shown when the user taps "Suggest questions"
  const fullSuggestions = (b) => {
    const pool = (b && b._pool) || buildPool(b || boot);
    const roleIds = STARTERS_BY_ROLE[roleBucket(role)] || STARTERS_BY_ROLE.default;
    const ordered = [...freqTop(user?.id, 3), ...roleIds];
    const seen = new Set(); const out = [];
    ordered.forEach(id => {
      if (seen.has(id) || id === 'news') return;
      if (id === 'hw-today' && !b?.homework) return;
      if (id === 'attendance' && !b?.attendance) return;
      const e = pool.find(x => x.id === id);
      if (e) { seen.add(id); out.push({ id: e.id, label: e.q, icon: e.icon || '💬', tone: e.tone || 'brand' }); }
    });
    out.push({ id: 'news', label: "What's new?", icon: '📣', tone: 'violet' });
    return out.slice(0, 8);
  };

  // ---- data load ----
  const load = useCallback(async () => {
    if (!user?.id) return {};
    try {
      // bootstrap + academic calendar + notifications in parallel (each reuses its own module's endpoint)
      const [bRes, cRes, nRes] = await Promise.all([
        fetch(`${API_BASE_URL}/smarty/bootstrap/${user.id}`),
        user?.institutionId ? fetch(`${API_BASE_URL}/admin/calendar/${user.institutionId}`).catch(() => null) : Promise.resolve(null),
        fetch(`${API_BASE_URL}/notifications/${user.id}?limit=20`).catch(() => null),
      ]);
      const b = bRes.ok ? await bRes.json() : {};
      try { b.calendar = computeCalendar(cRes && cRes.ok ? await cRes.json() : []); }
      catch (_) { b.calendar = { today: [], upcoming: [], month: [], nextHoliday: null, nextExam: null }; }
      try {
        const nItems = nRes && nRes.ok ? await nRes.json() : [];
        const items = Array.isArray(nItems) ? nItems : [];
        b.notif = { items, unread: items.filter(n => !n.is_read).length };
      } catch (_) { b.notif = { items: [], unread: 0 }; }
      setBoot(b); setUnread(b.unread || 0); return b;
    } catch (e) { setBoot({}); return {}; }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  // Module aliases (school's renamed sidebar labels) for the module browser.
  useEffect(() => {
    if (!user?.institutionId) return;
    fetch(`${API_BASE_URL}/admin/module-order/${user.institutionId}`)
      .then(r => r.ok ? r.json() : [])
      .then(rows => { const a = {}; (Array.isArray(rows) ? rows : []).forEach(r => { if (r.alias) a[r.module_name] = r.alias; }); setAliases(a); })
      .catch(() => {});
  }, [user?.institutionId]);

  const toBottom = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };
  useEffect(() => { toBottom(); }, [msgs, open]);

  // ---- idle nudge: wave + "need help?" every minute while closed ----
  useEffect(() => {
    if (open) { setNudge(false); return; }
    const show = () => { setNudgeMsg(''); setNudge(true); window.clearTimeout(show._t); show._t = window.setTimeout(() => setNudge(false), 5500); };
    const first = window.setTimeout(show, 8000);
    const iv = window.setInterval(show, 30000);
    return () => { window.clearTimeout(first); window.clearInterval(iv); window.clearTimeout(show._t); };
  }, [open]);

  // proactive: quietly poll notifications while closed; nudge when a new one lands
  useEffect(() => {
    if (open || !user?.id) return;
    if (lastNotif.current == null && boot?.notif) lastNotif.current = boot.notif.unread || 0;
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/notifications/${user.id}?limit=20`);
        if (!r.ok || !alive) return;
        const items = await r.json();
        const now = Array.isArray(items) ? items.filter(n => !n.is_read).length : 0;
        if (lastNotif.current != null && now > lastNotif.current) {
          setUnread((u) => u); setNudgeMsg('🔔 You have a new notification — tap me!');
          setNudge(true); window.setTimeout(() => setNudge(false), 6500);
        }
        lastNotif.current = now;
      } catch (_) {}
    };
    const iv = window.setInterval(check, 120000);
    return () => { alive = false; window.clearInterval(iv); };
  }, [open, user, boot]);

  const flash = (m) => { if (m !== 'idle') { setMood(m); clearTimeout(moodTimer.current); moodTimer.current = setTimeout(() => setMood('idle'), m === 'happy' ? 1700 : 4000); } };
  const pushMe = (text) => setMsgs(m => [...m, { k: nextKey(), who: 'me', text }]);
  const pushBot = (answer) => setMsgs(m => [...m, { k: nextKey(), who: 'bot', answer }]);
  const pushTyping = () => { const k = nextKey(); setMsgs(m => [...m, { k, who: 'typing' }]); return k; };
  const dropTyping = (k) => setMsgs(m => m.filter(x => x.k !== k));

  const answerFor = (id, b) => {
    if (LIVE_IDS.includes(id) || id === 'news') return liveAnswer(id, b);
    const e = (b?._pool || buildPool(b)).find(x => x.id === id);
    return e?.answer || null;
  };
  const deliver = (a) => { flash('thinking'); setTimeout(() => { const tk = pushTyping(); setTimeout(() => { dropTyping(tk); pushBot(a); flash(a.happy ? 'happy' : 'talking'); if (a.celebrate) celebrate(); }, 650 + Math.random() * 300); }, 650); };

  const respond = (id) => {
    const b = boot || {};
    if (id === 'suggest-q') {               // expand into the role-based question list
      deliver({ tone: 'brand', text: `Here are some things you can ask me, ${firstName} 👇` });
      setChips(fullSuggestions(b));
      return;
    }
    if (id === 'news') markRead();
    const a = answerFor(id, b);
    if (!a) return suggest();
    freqBump(user?.id, id);                 // learn what this user asks most
    deliver(a);
    // No follow-up question chips: after answering, the current module's
    // question list (if browsing) stays put so another can be picked, and the
    // permanent "Browse by module" button is always there to start over.
  };
  const respondWith = (id, b) => { const a = answerFor(id, b); if (a) deliver(a); };

  const COMPLIMENTS = ['thank', 'thanks', 'thx', 'great', 'nice', 'awesome', 'love you', 'love u', 'well done', 'super', 'excellent', 'best', 'cool', 'amazing', 'good job'];
  const compliment = () => deliver({ tone: 'rose', text: "Aww, thank you! 💖 I'm always here whenever you need me. 😊", happy: true, celebrate: true });
  const suggest = () => deliver({ text: "Hmm, I'm still learning that one 🤔 Try a button below, or ask about " + (roleBucket(role) === 'student' ? 'homework, attendance, fees or your timetable.' : 'reports, fees or the directory.') });

  // ---- voice input: off by default; tap the mic to turn it ON. It then
  //      keeps listening and live-writes your words into the box until you
  //      tap it again or press send. ----
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const [listening, setListening] = useState(false);
  const [burst, setBurst] = useState(false);
  const recRef = useRef(null);
  const wantListen = useRef(false);   // true while the mic should stay on
  const finalRef = useRef('');        // transcript committed so far

  const stopListen = () => {
    wantListen.current = false;
    try { recRef.current && recRef.current.stop(); } catch (_) {}
    setListening(false);
  };
  const startListen = () => {
    if (!SR) { setToast('Voice input isn’t supported on this browser — try Chrome.'); setTimeout(() => setToast(''), 2600); return; }
    try {
      const rec = new SR();
      rec.lang = 'en-IN';
      rec.continuous = true;        // keep listening, don't stop after one phrase
      rec.interimResults = true;    // live words as you speak
      finalRef.current = (input ? input + ' ' : '');   // keep whatever is already typed
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const tr = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalRef.current += tr + ' ';
          else interim += tr;
        }
        setInput((finalRef.current + interim).replace(/\s+/g, ' ').trim());
      };
      rec.onerror = (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          setToast('Please allow microphone access.'); setTimeout(() => setToast(''), 2600);
          stopListen();
        }
        // 'no-speech' / 'aborted' → ignore; onend will restart if still wanted
      };
      rec.onend = () => {
        // The browser stops after a pause; if the user hasn't turned it off,
        // restart so it stays on until they send or tap the mic again.
        if (wantListen.current) { try { rec.start(); } catch (_) {} }
        else setListening(false);
      };
      recRef.current = rec;
      wantListen.current = true;
      setListening(true);
      rec.start();
    } catch (_) { stopListen(); }
  };
  const celebrate = () => { setBurst(false); requestAnimationFrame(() => { setBurst(true); setTimeout(() => setBurst(false), 1700); }); };

  // stop the mic whenever the panel is closed, so it never keeps listening in the background
  useEffect(() => { if (!open) stopListen(); }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps

  // contextual chips after an answer
  const chipFromId = (id, b) => {
    if (id === 'news') return { id: 'news', label: "What's new?", icon: '📣', tone: 'violet' };
    const pool = (b && b._pool) || buildPool(b || boot);
    const e = pool.find(x => x.id === id);
    return e ? { id: e.id, label: e.q, icon: e.icon || '💬', tone: e.tone || 'brand' } : null;
  };
  const followChips = (ids, b) => {
    const out = [];
    ids.forEach(id => { const c = chipFromId(id, b); if (c && !out.find(x => x.id === c.id)) out.push(c); });
    if (!out.find(x => x.id === 'news')) out.push({ id: 'news', label: "What's new?", icon: '📣', tone: 'violet' });
    return out;
  };

  // open-ended fallback → the school's own AI provider (only if a key is on).
  // Returns to the plain "still learning" message when AI is off/unconfigured.
  const askAI = async (q) => {
    // PHASE 1 — "Thinking…": held (no auto-reset) while Smarty searches the
    // books/library and, if needed, the AI. Stays until the answer is ready,
    // however long that takes.
    clearTimeout(moodTimer.current); setMood('thinking');
    const tk = pushTyping();
    let d = null;
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, userId: user?.id })
      });
      d = res.ok ? await res.json() : null;
    } catch (_) {}
    // PHASE 2 — "Typing…": a short, natural beat before the answer appears
    // (near-instant for a stored/cached answer, so repeats feel fast).
    flash('talking');
    await new Promise(r => setTimeout(r, d && d.cached ? 140 : 480 + Math.random() * 260));
    dropTyping(tk);
    if (d && d.ok && d.answer) {
      // Badge: a fresh AI answer shows "✨ AI"; book/library/stored answers show
      // "✨ Smarty". Grounded answers also show which chapter/term they came from.
      const fromAI = d.source === 'ai';
      const src = d.grounded ? (d.sources ? `\n\n📖 _From your book: ${d.sources}_` : '\n\n📖 _From your textbook_') : '';
            pushBot({ tone: 'violet', text: d.answer + src, ai: fromAI, smarty: !fromAI, link: d.link || null, linkLabel: d.linkLabel || null });
      // Interactive follow-ups (e.g. pick a student / pick an exam): each chip
      // carries a prepared query that is re-sent straight to the resolver.
      if (Array.isArray(d.options) && d.options.length) {
                setChips(d.options.slice(0, 20)
          .filter(o => o && o.label && o.send)
          .map((o, i) => ({ id: 'opt-' + i, label: o.label, send: o.send, tone: 'violet', icon: '▸' })));
      }
      flash('talking'); return;
    }
    if (d && d.reason === 'no_match') {
      // AI is off and nothing matched in the books/library.
      pushBot({ tone: 'sky', text: "I couldn't find that in the textbooks or library yet. Your school can add it in **Syllabus**, or turn on **Smarty AI** for general answers.", smarty: true });
      return;
    }
    const admin = /admin|developer|principal/i.test(role || '');
    if (d && d.reason === 'network') {
      // Server can't reach the internet — keys are irrelevant here.
      pushBot({ tone: 'amber', text: admin
        ? "⚠️ The AI couldn't be reached — the **server can't connect to the internet** for the AI provider (firewall / egress block / proxy). This isn't the key. Run **/api/smarty/ai-selftest** and ask your host to allow outbound HTTPS."
        : "⚠️ The AI service is temporarily unavailable. Please try again later." });
      return;
    }
    if (d && (d.reason === 'provider_error' || d.reason === 'empty_answer')) {
      // Admins see the real reason (e.g. "quota exceeded"); everyone else sees a simple note.
      pushBot({ tone: 'amber', text: admin
        ? `⚠️ The AI couldn't answer right now.${d.error ? ` **Reason:** ${d.error}` : ''}\n\nIf this is a free key it's usually the quota limit — enable billing on the key, or paste a different provider's key in **Smarty AI**, then **Test**.`
        : "⚠️ I couldn't reach the AI service just now. Please ask your admin to check the AI key." });
      return;
    }
    suggest();   // AI off / not configured → normal built-in fallback
  };

  // greetings / small talk → a warm, ROLE-AWARE canned reply (no AI needed)
  const smalltalk = (t) => {
    const hint = HELP_HINT[roleBucket(role)] || HELP_HINT.default;
    if (RE_BYE.test(t))   return { tone: 'violet', text: `Bye ${firstName}! 👋 I'm always here whenever you need me.`, happy: true };
    if (RE_HOWRU.test(t)) return { tone: 'brand', text: `I'm doing great, thanks ${firstName}! 😊 Ready to help — ask me about ${hint}, or anything else.`, happy: true };
    if (RE_WHORU.test(t)) return { tone: 'brand', text: `I'm **Smarty** 🤖 — your in-app assistant. I can open any screen for you, show live info, share school updates, and answer general questions too. Tap **Suggest questions** below, or just ask about ${hint}.` };
    if (RE_GREET.test(t)) return { tone: 'brand', text: `Hi ${firstName}! 👋 I'm **Smarty**, here to help. Tap **Suggest questions** below, or ask me about ${hint}.`, happy: true };
    return null;
  };

  const submitText = (v) => {
    v = (v || '').trim(); if (!v) return;
    if (wantListen.current) stopListen();   // sending turns the mic off
    pushMe(v); setInput('');
    const t = v.toLowerCase();
    if (COMPLIMENTS.some(c => t.includes(c))) return compliment();  // thanks / praise
    const chit = smalltalk(t);                                      // greetings / small talk
    if (chit) return deliver(chit);
    // Live-data questions (counts / lists about a module) go STRAIGHT to the
    // backend resolver, so a stray module keyword (e.g. "periods", "subjects")
    // doesn't open a screen instead of answering. The backend is role-scoped.
    // A leading navigation verb ("open …", "go to …") is left for the opener.
    const NAV       = /^(open|go to|goto|show me|take me|navigate)\b/;
    const LIVE_Q    = /\b(how many|how much|number of|count|total|list|name the|which|what are|what subjects)\b/;
    const LIVE_NOUN = /\b(chapters?|lessons?|periods?|subjects?|students?|teachers?|staff|admissions?|applications?|admitted|enrol|enroll|study material|study materials|materials?|worksheets?|homework|assignments?|online class|online classes|live class|recorded|recordings?|lectures?|digital labs?|labs?|exams?|timetables?|datesheet|results?|marks?|ptm|meetings?|menu|meals?|report cards?|performance|topper|rank|fees?|balance|dues?|unpaid|collection|bus(?:es)?|vehicles?|routes?|drivers?|assistants?|transport|gallery|albums?|photos?|pictures?|images?|group ?chats?|groups?|alumni|alumnus|passout|graduates?|tickets?)\b/;
    // Exams, PTM, food menu, report cards and performance are always answered
    // with live, role-scoped data — any non-navigation question about them goes
    // straight to the resolver (otherwise a stray keyword like "exam"/"ptm"/
    // "lunch"/"topper" opens the screen instead of answering).
    const LIVE_ALWAYS = /\b(exams?|datesheet|date sheet|exam schedule|exam timetable|ptm|parent[- ]?teacher|food menu|weekly menu|meals?|lunch|breakfast|dinner|dining|report cards?|progress card|marks card|performance|topper|top \d+ students?|top students?|best student|who topped|my rank|class rank|my fee|fees?|balance|how much do i owe|outstanding|dues?|unpaid|fee collection|how (?:do|can) i pay|my bus|my route|bus route|bus driver|which bus|is my bus|where is (?:my|the) bus|buses running|live buses|gallery|albums?|photos?|pictures?|group ?chats?|chat groups?|my groups?|unread|alumni|alumnus|passout|passed out|graduates?|class of \d{4}|support tickets?|my tickets?|help ?desk|how many tickets|marks?|scores?|grades?)\b/;
    if (!NAV.test(t)) {
      if (LIVE_ALWAYS.test(t)) return askAI(v);
      if (LIVE_Q.test(t) && LIVE_NOUN.test(t)) return askAI(v);
      // Module data about a specific class (staff-scoped on the backend). The
      // "class" requirement keeps a student's own "my attendance/homework" on
      // its live card instead.
      if (/\b(attendance|present|absent|homework|assignments?|online class|live class|recorded|labs?|lectures?)\b/.test(t) && /\bclass\b/.test(t)) return askAI(v);
    }
    const id = match(v);                                            // built-in rule answers
    if (id) return respond(id);
    askAI(v);                                                       // everything else → AI
  };

  // greeting digest shown on every open
  const buildDigest = (b) => {
    const hr = new Date().getHours();
    const part = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    const nm = b?.user?.name || user?.name || 'there';
    const pills = [];
    const cday = (b?.calendar?.today) || [];
    if (cday.length) {
      const lead = cday[0];
      pills.push({ icon: CAL_EMOJI[lead.type] || '📅', label: cday.length === 1 ? `${lead.name} (${lead.type})` : `${cday.length} events today`, tone: CAL_TONE[lead.type] || 'sky' });
    }
    if (b?.nextClass) pills.push({ icon: '🔔', label: `${b.nextClass.subject} at ${b.nextClass.start}`, tone: 'sky' });
    if (b?.homework?.due_today) pills.push({ icon: '📚', label: `${b.homework.due_today} homework due today`, tone: 'amber' });
    else if (b?.homework?.pending) pills.push({ icon: '📚', label: `${b.homework.pending} homework pending`, tone: 'amber' });
    if (b?.attendance && b.attendance.percentage != null) pills.push({ icon: '📊', label: `${b.attendance.percentage}% attendance`, tone: 'emerald' });
    if (b?.unread) pills.push({ icon: '📣', label: `${b.unread} new update${b.unread > 1 ? 's' : ''}`, tone: 'violet' });
    if (b?.notif?.unread) pills.push({ icon: '🔔', label: `${b.notif.unread} notification${b.notif.unread > 1 ? 's' : ''}`, tone: 'violet' });
    const greet = {
      text: `${part}, ${nm}! 👋 ${pills.length ? "Here's your quick look 👇" : "I'm **Smarty** — tap a button or just ask me anything 👇"}`,
      digest: pills.length ? pills : null
    };
    const bk = roleBucket(role);
    const firstId = cday.length ? 'cal-today'
      : (bk === 'student' || bk === 'teacher' || bk === 'parent') ? 'next-class' : 'news';
    return { greet, firstId };
  };

  const match = (text) => {
    const t = text.toLowerCase();
    const pool = buildPool(boot);
    const newsKw = ['whats new', 'what is new', 'updates', 'news', 'latest', 'announcement'];
    // 1) strongest exact phrase match (longest matching keyword wins)
    let best = null, score = 0;
    const scan = (id, kws) => (kws || []).forEach(k => { if (k && t.includes(k) && k.length > score) { score = k.length; best = id; } });
    pool.forEach(e => scan(e.id, e.keywords));
    scan('news', newsKw);
    if (best) return best;
    // 2) fuzzy fallback: overlap of meaningful words, so free-text still lands
    const toks = tokenize(t); if (!toks.length) return null;
    let fid = null, fscore = 0;
    const consider = (id, words) => { const set = new Set(words); let s = 0; toks.forEach(w => { if (set.has(w)) s += 1; }); if (s > fscore) { fscore = s; fid = id; } };
    pool.forEach(e => consider(e.id, tokenize([e.q || '', ...(e.keywords || [])].join(' '))));
    consider('news', tokenize(newsKw.join(' ')));
    return fscore >= 1 ? fid : null;
  };

  const onSend = (e) => { e.preventDefault(); submitText(input); };

  const markRead = useCallback(async () => {
    if (!unread) return;
    setUnread(0);
    try { await fetch(`${API_BASE_URL}/smarty/updates/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch (_) {}
  }, [unread]);

  const openPanel = async () => {
    setOpen(true); setNudge(false); setNudgeMsg('');
    const b = await load();
    const pool = buildPool(b); if (b) b._pool = pool;
    setChips(starters(b, pool));
    if (!greeted.current) {
      greeted.current = true;
      try { if (greetKey) sessionStorage.setItem(greetKey, '1'); } catch (_) {}
      const dg = buildDigest(b);
      pushBot(dg.greet);
      setTimeout(() => {
        if ((b?.calendar?.today || []).length) respondWith('cal-today', b);   // holiday/event today wins
        else if ((b?.unread || 0) > 0) respondWith('news', b);
        else respondWith(dg.firstId, b);
      }, 700);
    }
  };

  const navTo = (linkId) => {
    if (!linkId) return;
    const modId = MODULES.find(m => m.id === linkId) ? linkId : null;
    if (modId && typeof onNavigate === 'function') { onNavigate(modId); setOpen(false); }
    else { setToast(`Opening “${idToLabel[linkId] || linkId}”…`); setTimeout(() => setToast(''), 2000); }
  };

  // ---- Browse-by-module navigator: module list -> that module's questions ----
  const aliasLabel = (id) => aliases[idToModule[id]] || idToLabel[id] || String(id);
  // Browse-by-module shows only entries explicitly tagged to a module (curated
  // built-ins + admin questions whose Category maps to a module), never the
  // generic openers/how-tos, so each module's list stays clean and intentional.
  const moduleOf = (e) => e.module ? (_modId(e.module) || e.module) : null;

  // Ordered, permission-filtered list of module ids for the browser.
  const moduleIdList = () => {
    const b = boot || {};
    const pool = b._pool || buildPool(b);
    const ids = [], seen = new Set();
    pool.forEach(e => { const mid = moduleOf(e); if (mid && canSeeLink(mid) && !seen.has(mid)) { seen.add(mid); ids.push(mid); } });
    ids.sort((a, c) => MODULES.findIndex(m => m.id === a) - MODULES.findIndex(m => m.id === c));
    return ids;
  };
  // Browse-by-module cards show the first few, then View all / View less.
  const MOD_PREVIEW = 3;
  // Questions tagged to one module (for the drill-in list).
  const moduleQuestions = (mid) => {
    const b = boot || {};
    const pool = b._pool || buildPool(b);
    return pool.filter(e => moduleOf(e) === mid);
  };

  const navMenu = (target) => {
    const b = boot || {};
    const pool = b._pool || buildPool(b);
    if (target === 'modules') {           // back to the module card grid
      setChips([]);
      return;
    }
    if (target.startsWith('mod:')) {
      const mid = target.slice(4);
      const qs = pool.filter(e => moduleOf(e) === mid);
      deliver({ tone: 'brand', text: `Here’s what I can tell you about **${aliasLabel(mid)}** 👇` });
      const list = qs.slice(0, 40).map(e => e.send ? { id: e.id, label: e.q, send: e.send, icon: e.icon || '💬', tone: e.tone || 'brand' }
        : e.ref ? { id: e.id, label: e.q, ref: e.ref, icon: e.icon || '💬', tone: e.tone || 'brand' }
          : { id: e.id, label: e.q, icon: e.icon || '💬', tone: e.tone || 'brand' });
      list.push({ id: 'nav-back', nav: 'modules', label: '⟵ All modules', icon: '📚', tone: 'violet' });
      setChips(list);
      return;
    }
  };

  // header identity: name line + role/class/roll pills
  const u = boot?.user || {};
  const uName = u.name || user?.name || '';
  const uRole = u.role || role || '';
  const isStudent = uRole.toLowerCase().includes('student');
  const pills = isStudent ? [uRole, u.class_label, u.roll_no ? `Roll ${u.roll_no}` : null].filter(Boolean) : [uRole].filter(Boolean);

  if (!user) return null;

  return (
    <div className="smy">
      <style>{CSS}</style>
      <Defs />

      {!open && (
        <button className={`smy-launcher ${nudge ? 'smy-call' : ''} ${dragging ? 'smy-dragging' : ''}`}
          onPointerDown={onFabDown} onClick={onFabClick}
          style={fabPos ? { left: fabPos.left, top: fabPos.top, right: 'auto', bottom: 'auto' } : undefined}
          aria-label="Open Smarty">
          {unread > 0 && <span className="smy-ping">{unread > 9 ? '9+' : unread}</span>}
          {nudge && <span className="smy-nudge">{nudgeMsg || `Hey ${firstName}! 👋 Need any help?`}</span>}
          <img src={smartyGif} className="smy-fab-img" alt="" aria-hidden="true" draggable="false" />
          <span className="smy-fab-label">Smarty✨</span>
        </button>
      )}

      {open && (
        <section className={`smy-panel smy-pop ${big ? 'smy-big' : ''}`} aria-label="Smarty assistant">
          <div className="smy-head-bar">
            <div className="smy-idbox">
              <div className="smy-hero"><img src={smartyPic} className="smy-hero-img" alt="Smarty" /></div>
              <div className="smy-brand">Smarty <span style={{ fontSize: 12 }}>✨</span></div>
            </div>
            <div className="smy-who">
              <div className="smy-user">{uName}</div>
              <div className="smy-meta">{pills.map((m, i) => <span key={i}>{m}</span>)}</div>
              <div className="smy-status"><i />{MOODTEXT[mood] || MOODTEXT.idle}</div>
            </div>
            <div className="smy-headbtns">
              <button className="smy-xbtn smy-expand" onClick={() => setBig(v => !v)} aria-label={big ? 'Shrink' : 'Enlarge'} title={big ? 'Shrink' : 'Enlarge'}>{big ? '⤡' : '⤢'}</button>
              <button className="smy-xbtn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
          </div>

          <div className="smy-scroll" ref={scrollRef}>
            {msgs.map(m => <Message key={m.k} m={m} onNav={navTo} />)}
          </div>

          {/* Drill-down picker (role / class / status chips) OR Browse by Module.
              Only ONE shows at a time, each capped + scrollable, so the chat
              stays visible. The picker clears on back / another question. */}
          <div className="smy-browse-wrap">
            {chips.length > 0 ? (
              <>
                <div className="smy-mod-head">
                  <button className="smy-mod-back" onClick={() => setChips([])} aria-label="Back">←</button>
                  <span className="smy-mod-ic">✨</span>
                  <span className="smy-mod-title">Choose an option</span>
                </div>
                <div className="smy-picker">
                  {chips.map(c => (
                    <button key={c.id} className="smy-chip" style={{ '--ct': `var(${toneVar[c.tone] || '--brand'})` }}
                      onClick={() => { if (c.nav) { pushMe(c.label); navMenu(c.nav); } else if (c.send) { pushMe(c.label); askAI(c.send); } else if (c.ref) { pushMe(c.label); respond(c.ref); } else { pushMe(c.label); respond(c.id); } }}>
                      <span className="smy-ic" style={{ background: `var(${toneVar[c.tone] || '--brand'})` }}>{c.icon}</span>{c.label}
                    </button>
                  ))}
                </div>
              </>
            ) : activeMod ? (
              <>
                <div className="smy-mod-head">
                  <button className="smy-mod-back" onClick={() => { setActiveMod(null); setChips([]); }} aria-label="Back to modules">←</button>
                  <span className="smy-mod-ic">{modIcon(activeMod)}</span>
                  <span className="smy-mod-title">{aliasLabel(activeMod)}</span>
                </div>
                <div className="smy-mod-qs">
                  {moduleQuestions(activeMod).map(e => (
                    <button key={e.id} className="smy-qbtn"
                      onClick={() => { setChips([]); pushMe(e.q); if (e.send) { askAI(e.send); } else if (e.ref) { respond(e.ref); } else { respond(e.id); } }}>
                      <span className="smy-qic">{e.icon || '💬'}</span><span className="smy-qtxt">{e.q}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="smy-browse-head">
                  <span className="smy-browse-title"><span className="smy-browse-ic">📂</span>Browse by Module</span>
                  {moduleIdList().length > MOD_PREVIEW && (
                    <button className="smy-browse-all" onClick={() => setModAll(v => !v)}>{modAll ? 'View less ▴' : 'View all →'}</button>
                  )}
                </div>
                <div className={`smy-modgrid ${modAll ? 'smy-modgrid-all' : ''}`}>
                  {(modAll ? moduleIdList() : moduleIdList().slice(0, MOD_PREVIEW)).map((id, i) => (
                    <button key={id} className="smy-modcard" style={{ '--ct': `var(${toneVar[MOD_TONES[i % MOD_TONES.length]]})` }}
                      onClick={() => { setChips([]); setActiveMod(id); }}>
                      <span className="smy-modcard-ic">{modIcon(id)}</span>
                      <span className="smy-modcard-label">{aliasLabel(id)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="smy-guide">
            <span className="smy-guide-row"><span className="smy-star">✦</span><span><b>Tap a module</b> &mdash; for anything about your school data.</span></span>
            <span className="smy-guide-row"><span className="smy-star">✦</span><span><b>Textbook &amp; general questions</b> &mdash; just ask directly below.</span></span>
          </div>

          <form className="smy-composer" onSubmit={onSend}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder={listening ? 'Listening… speak now' : 'Ask Smarty anything…'} aria-label="Ask Smarty" />
            {SR && (
              <button type="button" className={`smy-mic ${listening ? 'live' : ''}`} onClick={() => (listening ? stopListen() : startListen())} title={listening ? 'Stop listening' : 'Speak your question'} aria-label="Voice input">
                {listening
                  ? <span className="smy-wave" aria-hidden="true"><i /><i /><i /><i /></span>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3.5" /><path d="M8.5 21.5h7" /></svg>}
              </button>
            )}
            <button className="smy-send" type="submit" aria-label="Send">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </form>
          <div className="smy-foot">Built-in answers for every screen · your school can add more</div>
          {burst && <div className="smy-confetti" aria-hidden="true">{CONFETTI.map((c, i) => <span key={i} style={{ left: c.left + '%', animationDelay: c.d + 's', fontSize: c.s + 'px' }}>{c.e}</span>)}</div>}
        </section>
      )}

      {toast && <div className="smy-toast">{toast}</div>}
    </div>
  );
}

const MOODTEXT = { idle: 'Online · here to help', thinking: 'Thinking…', talking: 'Typing…', happy: '😊 Glad to help!' };

function Message({ m, onNav }) {
  if (m.who === 'me') return <div className="smy-msg smy-me"><div className="smy-bubble">{m.text}</div></div>;
  if (m.who === 'typing') return <div className="smy-msg smy-bot"><Mini /><div className="smy-bubble smy-plain smy-typing"><span /><span /><span /></div></div>;
  const a = m.answer || {};
  const tone = toneVar[a.tone] || '--brand';
  return (
    <div className="smy-msg smy-bot">
      <Mini />
      <div className="smy-bubble" style={{ '--tone': `var(${tone})` }}>
        <span dangerouslySetInnerHTML={{ __html: fmt(a.text) }} />
        {a.ai && <span className="smy-aibadge">✨ AI</span>}
        {a.smarty && <span className="smy-smbadge">✨ Smarty</span>}
        {a.digest && <div className="smy-digest">{a.digest.map((d, i) => <span key={i} className="smy-dpill" style={{ '--ct': `var(${toneVar[d.tone] || '--brand'})` }}>{d.icon} {d.label}</span>)}</div>}
        {a.steps && <ul className="smy-steps">{a.steps.map((s, i) => <li key={i}><span className="smy-n">✓</span><span dangerouslySetInnerHTML={{ __html: fmt(s) }} /></li>)}</ul>}
        {a.card && <div className="smy-card"><span className="smy-em">{a.card.em}</span><div><div className="smy-t">{a.card.t}</div><div className="smy-s">{a.card.s}</div></div></div>}
        {a.extra && <div className="smy-extra">{a.extra}</div>}
        {a.items && <div className="smy-feed">{a.items.map((it, i) => (
          <div key={i} className={`smy-item ${it.isNew ? 'smy-new' : ''}`} onClick={() => it.link && onNav(it.link)} style={{ cursor: it.link ? 'pointer' : 'default' }}>
            <div className="smy-ttl">{it.ttl}{it.isNew && <span className="smy-tag">New</span>}</div><div className="smy-bd">{it.bd}</div>
          </div>))}</div>}
        {a.link && <><br /><button className="smy-act" onClick={() => onNav(a.link)}>{a.linkLabel || 'Open'} <span className="smy-arw">▸</span></button></>}
      </div>
    </div>
  );
}
const Mini = () => <span className="smy-mini"><img src={smartyPic} alt="Smarty" /></span>;
// Math + chemistry rendering.
//   • Formulas the model wraps in LaTeX delimiters — $…$ / \(…\) (inline) and
//     $$…$$ / \[…\] (block) — are rendered with KaTeX, so fractions, roots,
//     exponents and equations look exactly like a textbook/PDF.
//   • Any bare LaTeX left outside delimiters (e.g. "CO_2", "\rightarrow") is
//     cleaned up to plain Unicode by smyMath() as a safety net, so nothing ever
//     shows raw backslashes. Digits-only subscripts keep it from touching the
//     "_italic_" underscores used elsewhere in answers.
const _SUB = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' };
const _SUP = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻' };
const _subs = (t) => t.replace(/[0-9]/g, c => _SUB[c] || c);
const _sups = (t) => t.replace(/[0-9+\-]/g, c => _SUP[c] || c);
function smyMath(s) {
  let t = String(s || '');
  // commands → symbols (xrightarrow, longrightarrow, Rightarrow, ...)
  t = t.replace(/\\[a-zA-Z]*rightarrow\b/g, ' → ')
       .replace(/\\[a-zA-Z]*leftarrow\b/g, ' ← ')
       .replace(/\\rightleftharpoons\b/g, ' ⇌ ')
       .replace(/\\times\b/g, '×').replace(/\\cdot\b/g, '·')
       .replace(/\\pm\b/g, '±').replace(/\\Delta\b/g, 'Δ');
  // \text{...} / \mathrm{...} → their contents (run twice for simple nesting)
  t = t.replace(/\\(?:text|mathrm|mathbf|mathit|mathsf)\s*\{([^{}]*)\}/g, '$1')
       .replace(/\\(?:text|mathrm|mathbf|mathit|mathsf)\s*\{([^{}]*)\}/g, '$1');
  // subscripts (digits only) and superscripts (digits + charge signs)
  t = t.replace(/_\{([0-9]+)\}/g, (_, g) => _subs(g)).replace(/_([0-9])/g, (_, g) => _subs(g));
  t = t.replace(/\^\{([0-9+\-]+)\}/g, (_, g) => _sups(g)).replace(/\^([0-9+\-])/g, (_, g) => _sups(g));
  // drop LaTeX spacing commands and any leftover braces
  t = t.replace(/\\[,;:!> ]/g, ' ').replace(/\{([^{}]*)\}/g, '$1');
  return t;
}
// Escape → unicode-cleanup → bold, for the prose BETWEEN math spans.
function _esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _safeUrl(u) { return /^(https?:|mailto:|data:image\/)/i.test(u) ? u.replace(/"/g, '%22') : ''; }
// Inline formatting on ONE raw fragment: escape, math-cleanup, then inline
// Markdown (code, images, links, bold, italic, strikethrough).
function _fmtText(s) {
  let str = smyMath(_esc(String(s || '')));
  const code = [];
  str = str.replace(/`([^`]+?)`/g, (_m, c) => { code.push(c); return '\u0001' + (code.length - 1) + '\u0001'; });
  str = str
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (m, alt, url) => { const u = _safeUrl(url); return u ? '<img class="smy-img" src="' + u + '" alt="' + alt + '" loading="lazy" />' : m; })
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (m, txt, url) => { const u = _safeUrl(url); return u ? '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>' : m; })
    .replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>')
    .replace(/__([^_]+?)__/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<i>$2</i>')
    .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<i>$2</i>')
    .replace(/~~([^~]+?)~~/g, '<s>$1</s>');
  str = str.replace(/\u0001(\d+)\u0001/g, (_m, i) => '<code>' + code[+i] + '</code>');
  return str;
}
// Render one LaTeX span with KaTeX; fall back to the plain-text cleanup if it
// can't parse (so a stray formula degrades gracefully instead of throwing).
function _tex(src, display) {
  try {
    return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore' });
  } catch (_) {
    return _fmtText(src);
  }
}
// Split the answer into math spans ($$…$$, \[…\], $…$, \(…\)) and prose, then
// render each part appropriately and stitch the HTML back together.
const _MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
// Block-level Markdown: headings, bullet/numbered lists, tables (GFM),
// blockquotes, code fences, horizontal rules, and paragraphs with line breaks.
function _mdBlocks(text) {
  const lines = String(text).split('\n');
  let html = '', i = 0, para = [];
  const flush = () => { if (para.length) { html += '<p>' + para.map(_fmtText).join('<br>') + '</p>'; para = []; } };
  const cells = (r) => r.replace(/^\s*\|?/, '').replace(/\|?\s*$/, '').split('|').map(c => c.trim());
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if (/^\s*```/.test(line)) {
      flush(); const buf = []; i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; html += '<pre class="smy-pre"><code>' + _esc(buf.join('\n')) + '</code></pre>'; continue;
    }
    if (/^\s*$/.test(line)) { flush(); i++; continue; }
    if ((m = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/))) { flush(); const l = m[1].length; html += '<h' + l + '>' + _fmtText(m[2]) + '</h' + l + '>'; i++; continue; }
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) { flush(); html += '<hr class="smy-hr" />'; i++; continue; }
    if (/\|/.test(line) && i + 1 < lines.length && /-{2,}/.test(lines[i + 1]) && /^\s*\|?[\s:|-]+$/.test(lines[i + 1])) {
      flush(); const heads = cells(line); i += 2;
      let t = '<div class="smy-tablewrap"><table class="smy-table"><thead><tr>' + heads.map(c => '<th>' + _fmtText(c) + '</th>').join('') + '</tr></thead><tbody>';
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) { t += '<tr>' + cells(lines[i]).map(c => '<td>' + _fmtText(c) + '</td>').join('') + '</tr>'; i++; }
      html += t + '</tbody></table></div>'; continue;
    }
    if (/^\s*>\s?/.test(line)) { flush(); const q = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; } html += '<blockquote class="smy-quote">' + q.map(_fmtText).join('<br>') + '</blockquote>'; continue; }
    if (/^\s*[-*+]\s+/.test(line)) { flush(); let it = ''; while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { it += '<li>' + _fmtText(lines[i].replace(/^\s*[-*+]\s+/, '')) + '</li>'; i++; } html += '<ul class="smy-ul">' + it + '</ul>'; continue; }
    if (/^\s*\d+[.)]\s+/.test(line)) { flush(); let it = ''; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { it += '<li>' + _fmtText(lines[i].replace(/^\s*\d+[.)]\s+/, '')) + '</li>'; i++; } html += '<ol class="smy-ol">' + it + '</ol>'; continue; }
    para.push(line); i++;
  }
  flush();
  return html;
}

// Entry point: pull math spans out (rendered via KaTeX), run Markdown on the
// rest, then drop the math back in.
function fmt(s) {
  const math = [];
  const text = String(s || '').replace(_MATH_RE, (mm, a, b, c, d) => {
    math.push(_tex(a != null ? a : b != null ? b : c != null ? c : d, a != null || b != null));
    return '\u0000MATH' + (math.length - 1) + '\u0000';
  });
  return _mdBlocks(text).replace(/\u0000MATH(\d+)\u0000/g, (_m, i) => math[+i]);
}

function Defs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <g id="smy-head">
        <path d="M50 7C27 7 15 26 15 48c0 16 4 28 8 36l6-13c-4-12-2-30 4-39 6-10 17-13 17-13s11 3 17 13c6 9 8 27 4 39l6 13c4-8 8-20 8-36C85 26 73 7 50 7Z" fill="#5a3722" />
        <path d="M41 69h18v16H41z" fill="#f6c49a" />
        <ellipse cx="50" cy="47" rx="22" ry="25" fill="#ffd2ac" />
        <circle cx="28" cy="49" r="4" fill="#fcc79a" /><circle cx="72" cy="49" r="4" fill="#fcc79a" />
        <ellipse cx="34" cy="55" rx="4" ry="2.6" fill="#f6a088" opacity=".55" /><ellipse cx="66" cy="55" rx="4" ry="2.6" fill="#f6a088" opacity=".55" />
        <path d="M50 15c-13 0-24 9-26 24 3-10 10-16 19-18-5 4-8 9-9 16 3-9 9-14 16-15 7 1 13 6 16 15-1-7-4-12-9-16 9 2 16 8 19 18C74 24 63 15 50 15Z" fill="#6d4330" />
        <path d="M24 40c-3 14-1 29 4 40l5-13c-3-9-4-20-3-27Z" fill="#6d4330" /><path d="M76 40c3 14 1 29-4 40l-5-13c3-9 4-20 3-27Z" fill="#6d4330" />
        <path d="M32 39q6-4 13-1" stroke="#4a2c1c" strokeWidth="2.8" fill="none" strokeLinecap="round" /><path d="M55 38q7-3 13 1" stroke="#4a2c1c" strokeWidth="2.8" fill="none" strokeLinecap="round" />
        <ellipse cx="40" cy="46" rx="4.6" ry="5.2" fill="#fff" /><ellipse cx="60" cy="46" rx="4.6" ry="5.2" fill="#fff" />
        <g className="smy-eye"><circle cx="40.5" cy="46" r="3" fill="#5a3a24" /><circle cx="40.5" cy="46" r="1.5" fill="#2a1a12" /><circle cx="41.4" cy="44.8" r=".8" fill="#fff" /></g>
        <g className="smy-eye"><circle cx="59.5" cy="46" r="3" fill="#5a3a24" /><circle cx="59.5" cy="46" r="1.5" fill="#2a1a12" /><circle cx="60.4" cy="44.8" r=".8" fill="#fff" /></g>
        <circle cx="40" cy="46" r="9.2" fill="#fff" fillOpacity=".10" stroke="#2f2a33" strokeWidth="2.3" /><circle cx="60" cy="46" r="9.2" fill="#fff" fillOpacity=".10" stroke="#2f2a33" strokeWidth="2.3" />
        <path d="M49 45h2" stroke="#2f2a33" strokeWidth="2.3" strokeLinecap="round" /><path d="M30.9 45.5 26 47" stroke="#2f2a33" strokeWidth="2.2" strokeLinecap="round" /><path d="M69.1 45.5 74 47" stroke="#2f2a33" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M50 47q-1.5 6-2.5 8q2 1.4 4.5 0" stroke="#e0a07a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path className="smy-mouth smy-smile" d="M43 60q7 5 14 0" stroke="#c0566e" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path className="smy-mouth smy-grin" d="M43 59q7 8 14 0q-7 3.5-14 0z" fill="#b23a57" />
      </g>
      <g id="smy-full" className="smy-rig">
        {/* hair back */}
        <path d="M75 10C44 10 27 36 27 70c0 19 3 35 7 49l10-7c-4-13-4-29 0-43 5-18 19-27 31-27s26 9 31 27c4 14 4 30 0 43l10 7c4-14 7-30 7-49 0-34-17-60-48-60Z" fill="#5f3d2a" />
        {/* blue sweater / shoulders — raised to meet the neck (no gap) */}
        <path d="M43 150C43 106 57 86 75 86s32 20 32 64Z" fill="#3390e0" />
        {/* collar hugging the neck */}
        <path d="M63 88q12 12 24 0l-2 7q-10 9 -20 0Z" fill="#2275c4" />
        <g transform="translate(25,2)"><use href="#smy-head" /></g>
        {/* HER RIGHT arm (viewer's left): upper arm + forearm stay raised; only the hand waves at the wrist */}
        <g className="smy-armwrap">
          <path d="M50 120C46 108 36 100 27 94L19 102C28 108 36 118 40 131Z" fill="#3390e0" />
          <path d="M31 101C32 85 31 72 29 60L18 62C17 73 18 88 19 101Z" fill="#ffd2ac" />
          <path d="M33 100q-8.5 6 -16 1l1 -9q7.5 4 14 0Z" fill="#2275c4" />
          <g className="smy-hand">
            {/* palm */}
            <path d="M15 56C15 46 19 42 24 42C29 42 33 46 33 56C33 61 29 63 24 63C19 63 15 61 15 56Z" fill="#ffd2ac" />
            {/* four fingers (middle tallest) */}
            <rect x="16.3" y="31" width="3.6" height="16" rx="1.8" fill="#ffd2ac" />
            <rect x="20.4" y="27" width="3.6" height="20" rx="1.8" fill="#ffd2ac" />
            <rect x="24.5" y="28" width="3.6" height="19" rx="1.8" fill="#ffd2ac" />
            <rect x="28.5" y="31" width="3.4" height="16" rx="1.7" fill="#ffd2ac" />
            {/* thumb on the left */}
            <path d="M15 54C10 52 9 47 11 44C13 41 16 43 17 47L18 53Z" fill="#ffd2ac" />
            {/* palm creases */}
            <path d="M18 49q4 3 5 9" fill="none" stroke="#e8a487" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        </g>
        <g className="smy-think">
          <path d="M46 150c-6-10-14-20-20-26l-6 6c7 7 13 17 17 26Z" fill="#3390e0" /><circle cx="54" cy="96" r="7" fill="#ffd2ac" />
        </g>
        <g className="smy-thought"><circle cx="30" cy="22" r="11" fill="#fff" /><circle cx="42" cy="34" r="4" fill="#fff" /><circle cx="49" cy="42" r="2.4" fill="#fff" />
          <circle className="smy-td" cx="25" cy="22" r="2" fill="#8b5cf6" /><circle className="smy-td" cx="30" cy="22" r="2" fill="#8b5cf6" /><circle className="smy-td" cx="35" cy="22" r="2" fill="#8b5cf6" /></g>
      </g>
    </defs></svg>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
.smy{--brand:#5b57e6;--brand-2:#7a76ff;--amber:#f59e0b;--emerald:#10b981;--rose:#fb6f92;--violet:#8b5cf6;--sky:#2bb3e8;
  --panel:#ffffff;--app:#f4f6fb;--ink:#262636;--muted:#8186a0;--line:#eceef6;--me:#5b57e6;
  --ga:#5a46ea;--g2:#7a57f2;--gb:#9061f5;--sh:0 16px 44px -14px rgba(60,54,170,.4);
  --fh:'Plus Jakarta Sans','Fredoka',system-ui,sans-serif;--fb:'Plus Jakarta Sans','Nunito','Segoe UI',system-ui,sans-serif;font-family:var(--fb);letter-spacing:-.01em;color-scheme:light}
.smy *{box-sizing:border-box}
.smy button{font-family:inherit}
.smy-launcher{position:fixed;z-index:9998;right:16px;bottom:14px;width:132px;height:152px;border:none;cursor:grab;touch-action:none;padding:0;overflow:visible;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:0;animation:smyFloat 3s ease-in-out infinite}
.smy-launcher.smy-dragging{animation:none;cursor:grabbing}
.smy-fab-label{font-family:var(--fh);font-weight:800;font-size:12px;color:var(--brand);margin-left: 11px;margin-top:-35px}
.smy-launcher.smy-call{animation:smyBounce .6s ease}
@keyframes smyBounce{0%,100%{transform:translateY(0)}30%{transform:translateY(-10px)}60%{transform:translateY(-3px)}}
.smy-fab{width:56px;height:68px;overflow:visible;filter:drop-shadow(0 5px 5px rgba(0,0,0,.3))}
.smy-fab-img{width:128px;height:128px;object-fit:contain;pointer-events:none;filter:drop-shadow(1.3px 0 0 #1f2430) drop-shadow(-1.3px 0 0 #1f2430) drop-shadow(0 1.3px 0 #1f2430) drop-shadow(0 -1.3px 0 #1f2430)}
.smy-ping{position:absolute;top:-2px;right:-2px;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:var(--rose);color:#fff;font-family:var(--fh);font-weight:700;font-size:12px;display:grid;place-items:center;border:2px solid var(--panel);z-index:3}
.smy-nudge{position:absolute;bottom:78px;right:0;z-index:3;background:var(--panel);color:var(--ink);font-weight:800;font-size:12.5px;padding:10px 13px;border-radius:11px;box-shadow:var(--sh);width:max-content;max-width:182px;text-align:left;border:1.5px solid var(--line);animation:smyNudge .35s ease both}
.smy-nudge:after{content:"";position:absolute;bottom:-7px;right:24px;width:14px;height:14px;background:var(--panel);border-right:1.5px solid var(--line);border-bottom:1.5px solid var(--line);transform:rotate(45deg)}
@keyframes smyNudge{from{opacity:0;transform:translateY(8px) scale(.9)}to{opacity:1;transform:none}}
@keyframes smyFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.smy-panel{position:fixed;z-index:9999;display:flex;flex-direction:column;overflow:hidden;right:20px;bottom:20px;width:400px;max-width:calc(100vw - 32px);height:min(660px,calc(100vh - 40px));background:var(--panel);border-radius:16px;box-shadow:var(--sh);border:1px solid var(--line);transition:width .28s cubic-bezier(.22,1,.36,1),height .28s cubic-bezier(.22,1,.36,1)}
.smy-big{width:min(860px,calc(100vw - 32px));height:min(900px,calc(100vh - 40px))}
.smy-pop{animation:smyPop .34s cubic-bezier(.22,1.2,.36,1)}
@keyframes smyPop{from{transform:scale(.6) translateY(30px);opacity:0}to{transform:none;opacity:1}}
.smy-head-bar{background:linear-gradient(130deg,var(--ga),var(--g2) 50%,var(--gb));color:#fff;padding:12px 14px;position:relative;flex:0 0 auto;min-height:98px;display:flex;align-items:center;gap:10px;overflow:hidden}
.smy-idbox{display:flex;flex-direction:column;align-items:center;gap:1px;flex:0 0 auto;z-index:1}
.smy-brand{font-family:var(--fh);font-weight:600;font-size:13px;line-height:1;display:flex;align-items:center;gap:3px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.25)}
.smy-head-bar:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 80% -10%,rgba(255,255,255,.25),transparent 55%)}
.smy-hero{position:relative;width:60px;height:60px;flex:0 0 auto;z-index:1}
.smy-hero-img{width:60px;height:60px;object-fit:contain}
.smy-who{flex:1;min-width:0;padding-left:4px;z-index:1}
.smy-who h2{font-family:var(--fh);font-weight:600;font-size:20px;margin:0;display:flex;align-items:center;gap:6px;line-height:1}
.smy-user{font-family:var(--fh);font-weight:600;font-size:15px;opacity:.98;text-transform:capitalize;line-height:1.1}
.smy-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.smy-meta span{font-size:9px;font-weight:800;background:rgba(255,255,255,.22);padding:3px 9px;border-radius:7px;font-family:var(--fh)}
.smy-status{font-size:10px;font-weight:800;opacity:.92;display:flex;align-items:center;gap:6px;margin-top:8px}
.smy-status i{width:8px;height:8px;border-radius:50%;background:#7CFFB2;animation:smyLive 2s infinite}
@keyframes smyLive{0%{box-shadow:0 0 0 0 rgba(124,255,178,.7)}70%{box-shadow:0 0 0 7px rgba(124,255,178,0)}100%{box-shadow:0 0 0 0 rgba(124,255,178,0)}}
.smy-headbtns{position:absolute;top:10px;right:12px;z-index:2;display:flex;gap:6px}
.smy-xbtn{appearance:none;border:none;background:rgba(255,255,255,.2);color:#fff;width:30px;height:30px;border-radius:9px;cursor:pointer;font-size:15px;display:grid;place-items:center;line-height:1}
.smy-xbtn:hover{background:rgba(255,255,255,.34)}
.smy-expand{font-size:16px}
.smy-scroll{flex:1;overflow-y:auto;padding:12px 14px 6px;display:flex;flex-direction:column;gap:10px;background:var(--app);scrollbar-width:thin;scrollbar-color:rgba(140,140,170,.3) transparent}
.smy-scroll::-webkit-scrollbar{width:5px}
.smy-scroll::-webkit-scrollbar-track{background:transparent}
.smy-scroll::-webkit-scrollbar-thumb{background:rgba(140,140,170,.28);border-radius:999px}
.smy-scroll::-webkit-scrollbar-thumb:hover{background:rgba(140,140,170,.45)}
.smy-msg{display:flex;gap:8px;align-items:flex-end;max-width:100%;animation:smyRise .34s ease both}
@keyframes smyRise{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
.smy-mini{width:40px;height:40px;flex:0 0 auto;align-self:flex-end}
.smy-mini img{width:40px;height:40px;object-fit:contain}
.smy-bubble{padding:9px 12px;border-radius:12px;font-size:12px;font-weight:600;max-width:85%;color:var(--ink);line-height:1.4}
.smy-bot .smy-bubble{background:color-mix(in srgb,var(--tone,var(--brand)) 9%,var(--panel));border:1.5px solid color-mix(in srgb,var(--tone,var(--brand)) 22%,transparent);border-bottom-left-radius:4px;box-shadow:0 6px 18px -10px color-mix(in srgb,var(--tone,var(--brand)) 70%,transparent)}
.smy-bot .smy-plain{background:var(--panel);border-color:var(--line)}
.smy-me{flex-direction:row-reverse}.smy-me .smy-bubble{background:linear-gradient(135deg,var(--ga),var(--me));color:#fff;border-bottom-right-radius:4px;box-shadow:0 5px 14px -7px rgba(91,87,230,.7)}
.smy-bubble b{font-weight:800}
.smy-bubble i{font-style:italic}.smy-bubble s{opacity:.7}
.smy-bubble p{margin:0 0 7px}.smy-bubble p:last-child{margin-bottom:0}
.smy-bubble h1,.smy-bubble h2,.smy-bubble h3,.smy-bubble h4,.smy-bubble h5,.smy-bubble h6{margin:10px 0 5px;font-family:var(--fh);font-weight:800;line-height:1.25;color:var(--ink)}
.smy-bubble>h1:first-child,.smy-bubble>h2:first-child,.smy-bubble>h3:first-child{margin-top:0}
.smy-bubble h1{font-size:15px}.smy-bubble h2{font-size:14px}.smy-bubble h3{font-size:13px}.smy-bubble h4,.smy-bubble h5,.smy-bubble h6{font-size:12px}
.smy-bubble ul,.smy-bubble ol{margin:5px 0 7px;padding-left:18px}.smy-bubble li{margin:2px 0}
.smy-bubble li::marker{color:var(--tone,var(--brand))}
.smy-bubble a{color:var(--ga);font-weight:700;text-decoration:underline;text-underline-offset:2px;word-break:break-word}
.smy-bubble code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92em;background:color-mix(in srgb,var(--ink) 8%,transparent);padding:1px 5px;border-radius:5px}
.smy-pre{margin:7px 0;background:#1f2430;color:#e7e9ee;border-radius:9px;padding:10px 12px;overflow-x:auto}
.smy-pre code{background:none;padding:0;color:inherit;font-size:11px;line-height:1.5;white-space:pre}
.smy-hr{border:none;border-top:1.5px solid color-mix(in srgb,var(--ink) 14%,transparent);margin:9px 0}
.smy-quote{margin:7px 0;padding:4px 0 4px 11px;border-left:3px solid color-mix(in srgb,var(--tone,var(--brand)) 45%,transparent);color:var(--muted)}
.smy-tablewrap{overflow-x:auto;margin:8px 0;border-radius:8px;border:1px solid var(--line)}
.smy-table{border-collapse:collapse;width:100%;font-size:11px}
.smy-table th,.smy-table td{border:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}
.smy-table th{background:color-mix(in srgb,var(--tone,var(--brand)) 12%,var(--panel));font-weight:800}
.smy-table tr:nth-child(even) td{background:color-mix(in srgb,var(--ink) 3%,transparent)}
.smy-img{max-width:100%;height:auto;border-radius:9px;margin:6px 0;display:block}
.smy-steps{margin:9px 0 0;padding:0;list-style:none;display:grid;gap:7px}
.smy-steps li{display:flex;gap:9px;align-items:flex-start;font-weight:700;font-size:12.5px}
.smy-n{width:20px;height:20px;border-radius:50%;background:var(--tone,var(--brand));color:#fff;font-family:var(--fh);font-size:11px;display:grid;place-items:center;flex:0 0 auto;margin-top:1px}
.smy-card{margin-top:8px;border-radius:9px;padding:9px 11px;display:flex;align-items:center;gap:10px;background:color-mix(in srgb,var(--tone,var(--brand)) 16%,var(--panel));border:1.5px solid color-mix(in srgb,var(--tone,var(--brand)) 40%,transparent)}
.smy-em{font-size:20px}.smy-t{font-weight:800;font-size:13px}.smy-s{font-size:11px;color:var(--muted);font-weight:700;margin-top:1px}
.smy-extra{margin-top:8px;font-size:11.5px;color:var(--muted);font-weight:700}
.smy-act{margin-top:11px;display:inline-flex;align-items:center;gap:7px;border:none;cursor:pointer;color:#fff;font-family:var(--fh);font-weight:600;font-size:12px;padding:9px 14px;border-radius:9px;background:linear-gradient(135deg,var(--tone,var(--brand)),color-mix(in srgb,var(--tone,var(--brand)) 50%,var(--gb)));box-shadow:0 7px 16px -8px color-mix(in srgb,var(--tone,var(--brand)) 85%,transparent)}
.smy-act:hover{filter:brightness(1.07)}.smy-arw{font-size:15px}
.smy-feed{display:grid;gap:8px;margin-top:9px}
.smy-item{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--ga);border-radius:8px;padding:9px 12px}
.smy-item.smy-new{border-left-color:var(--rose)}
.smy-ttl{font-weight:800;font-size:12px;display:flex;gap:7px;align-items:center}
.smy-bd{font-size:11.5px;color:var(--muted);font-weight:700;margin-top:2px}
.smy-tag{font-size:10px;font-family:var(--fh);font-weight:700;color:#fff;background:var(--rose);padding:1px 7px;border-radius:6px}
.smy-typing{display:flex;gap:4px;padding:14px}
.smy-typing span{width:7px;height:7px;border-radius:50%;background:var(--muted);opacity:.6;animation:smyTb 1.1s infinite}
.smy-typing span:nth-child(2){animation-delay:.18s}.smy-typing span:nth-child(3){animation-delay:.36s}
@keyframes smyTb{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}
.smy-chips{display:flex;flex-wrap:wrap;gap:8px;padding:8px 14px 4px;background:var(--panel)}
.smy-chip{border:1.5px solid color-mix(in srgb,var(--ct,var(--brand)) 32%,var(--line));background:color-mix(in srgb,var(--ct,var(--brand)) 9%,var(--panel));cursor:pointer;font-weight:700;font-size:11.5px;color:var(--ink);padding:8px 12px;border-radius:9px;display:inline-flex;align-items:center;gap:7px;transition:transform .12s,box-shadow .12s}
.smy-chip:hover{transform:translateY(-2px)}
/* drill-down picker: capped + scrollable so the chat always stays visible */
.smy-picker{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;max-height:132px;overflow-y:auto;overscroll-behavior:contain;padding:2px 4px 2px 2px;scrollbar-width:thin;scrollbar-color:rgba(140,140,170,.3) transparent}
.smy-picker::-webkit-scrollbar{width:5px}
.smy-picker::-webkit-scrollbar-thumb{background:rgba(140,140,170,.28);border-radius:999px}
.smy-picker .smy-chip{font-size:11px;padding:6px 10px;gap:6px}
.smy-picker .smy-ic{width:17px;height:17px}
/* permanent Browse-by-module button — solid so it reads as the primary action */
.smy-browse{background:linear-gradient(135deg,var(--ga),var(--gb));border-color:transparent;color:#fff;box-shadow:0 7px 16px -8px color-mix(in srgb,var(--ga) 80%,transparent)}
.smy-browse .smy-ic{background:rgba(255,255,255,.22)!important}
.smy-browse:hover{transform:translateY(-2px);filter:brightness(1.04)}
.smy-ic{width:19px;height:19px;border-radius:7px;display:grid;place-items:center;font-size:11px;color:#fff}
/* ===== Browse-by-Module card grid (replaces the old Browse button) ===== */
.smy-browse-wrap{background:var(--panel);padding:8px 14px 5px;display:flex;flex-direction:column;gap:7px}
.smy-browse-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.smy-browse-title{display:inline-flex;align-items:center;gap:7px;font-family:var(--fh);font-weight:800;font-size:12.5px;color:var(--ink);letter-spacing:-.01em}
.smy-browse-ic{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;font-size:12px;background:linear-gradient(135deg,var(--ga),var(--gb));color:#fff}
.smy-browse-all{border:none;background:none;cursor:pointer;font-family:var(--fh);font-weight:700;font-size:11px;color:var(--ga);display:inline-flex;align-items:center;gap:3px;padding:3px 7px;border-radius:7px}
.smy-browse-all:hover{background:color-mix(in srgb,var(--ga) 10%,transparent)}
.smy-modgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.smy-modgrid-all{max-height:250px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;padding:2px 4px 2px 2px;scrollbar-width:thin;scrollbar-color:rgba(140,140,170,.5) transparent}
.smy-modgrid-all::-webkit-scrollbar{width:6px}
.smy-modgrid-all::-webkit-scrollbar-thumb{background:rgba(140,140,170,.45);border-radius:999px}
.smy-modcard{border:1.5px solid color-mix(in srgb,var(--ct,var(--brand)) 26%,var(--line));background:color-mix(in srgb,var(--ct,var(--brand)) 8%,var(--panel));border-radius:7px;padding:7px 8px;cursor:pointer;display:flex;flex-direction:row;align-items:center;gap:6px;min-height:44px;transition:transform .12s,box-shadow .12s}
.smy-modcard:hover{transform:translateY(-2px);box-shadow:0 7px 16px -10px color-mix(in srgb,var(--ct,var(--brand)) 80%,transparent)}
.smy-modcard-ic{width:24px;height:24px;flex:0 0 auto;border-radius:7px;display:grid;place-items:center;font-size:13px;background:color-mix(in srgb,var(--ct,var(--brand)) 20%,var(--panel));box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--ct,var(--brand)) 32%,transparent)}
.smy-modgrid-all .smy-modcard-ic{background:transparent;box-shadow:none}
.smy-modcard-label{flex:1;min-width:0;font-family:var(--fh);font-weight:700;font-size:9.5px;line-height:1.25;color:var(--ink);text-align:left;word-break:normal;overflow-wrap:normal;hyphens:none;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.smy-viewless{align-self:center;margin-top:1px;border:1.5px solid var(--line);background:var(--panel);cursor:pointer;font-family:var(--fh);font-weight:700;font-size:11px;color:var(--muted);padding:6px 16px;border-radius:999px;transition:color .12s,border-color .12s}
.smy-viewless:hover{color:var(--ga);border-color:color-mix(in srgb,var(--ga) 40%,var(--line))}
/* module drill-in: heading with back button + scrollable question list */
.smy-mod-head{display:flex;align-items:center;gap:8px}
.smy-mod-back{flex:0 0 auto;width:26px;height:26px;border-radius:8px;border:1.5px solid var(--line);background:var(--panel);cursor:pointer;color:var(--muted);font-size:15px;font-weight:800;line-height:1;display:grid;place-items:center;transition:color .12s,border-color .12s,background .12s}
.smy-mod-back:hover{color:var(--ga);border-color:color-mix(in srgb,var(--ga) 40%,var(--line));background:color-mix(in srgb,var(--ga) 7%,var(--panel))}
.smy-mod-ic{flex:0 0 auto;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:14px;background:color-mix(in srgb,var(--brand) 14%,var(--panel));box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--brand) 28%,transparent)}
.smy-mod-title{font-family:var(--fh);font-weight:800;font-size:13px;color:var(--ink);letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smy-mod-qs{margin-top:8px;display:flex;flex-direction:column;gap:6px;max-height:188px;overflow-y:auto;padding-right:3px;scrollbar-width:thin;scrollbar-color:rgba(140,140,170,.3) transparent}
.smy-mod-qs::-webkit-scrollbar{width:5px}
.smy-mod-qs::-webkit-scrollbar-thumb{background:rgba(140,140,170,.28);border-radius:999px}
.smy-qbtn{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:1.5px solid var(--line);background:var(--panel);border-radius:9px;padding:7px 9px;cursor:pointer;color:var(--ink);font-family:var(--fb);font-weight:700;font-size:11px;line-height:1.25;transition:border-color .12s,background .12s,transform .12s}
.smy-qbtn:hover{border-color:color-mix(in srgb,var(--brand) 38%,var(--line));background:color-mix(in srgb,var(--brand) 6%,var(--panel));transform:translateX(2px)}
.smy-qic{flex:0 0 auto;width:20px;height:20px;border-radius:6px;display:grid;place-items:center;font-size:11px;background:color-mix(in srgb,var(--brand) 12%,var(--panel))}
.smy-qtxt{flex:1;min-width:0}
.smy-composer{flex:0 0 auto;padding:7px 12px;background:var(--panel);border-top:1px solid var(--line);display:flex;gap:8px;align-items:center}
.smy-composer input{flex:1;min-width:0;border:1.5px solid var(--line);background:var(--app);color:var(--ink);border-radius:10px;padding:8px 14px;font-weight:700;font-size:13px;outline:none}
.smy-composer input:focus{border-color:var(--brand)}
.smy-send{border:none;cursor:pointer;width:38px;height:38px;border-radius:11px;flex:0 0 auto;background:linear-gradient(135deg,var(--ga),var(--gb));color:#fff;display:grid;place-items:center}
.smy-send svg{width:20px;height:20px}
.smy-foot{font-size:9.5px;color:var(--muted);text-align:center;font-weight:700;padding:0 14px 10px;background:var(--panel)}
.smy-iconbtn{border:1.5px solid var(--line);background:var(--panel);cursor:pointer;width:40px;height:40px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;font-size:16px;line-height:1}
.smy-iconbtn.on{background:color-mix(in srgb,var(--brand) 12%,var(--panel));border-color:var(--brand)}
.smy-iconbtn.live{background:#ffe4e4;border-color:#ff6b6b;animation:smyPulse 1s infinite}
@keyframes smyPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,107,107,.5)}60%{box-shadow:0 0 0 7px rgba(255,107,107,0)}}
/* small "how to use" guide that lives with the Browse-by-module button */
.smy-guide{display:flex;flex-direction:column;gap:3px;padding:3px 14px 7px;background:var(--panel)}
.smy-guide-row{font-size:10px;line-height:1.5;color:var(--muted);font-weight:500;letter-spacing:-.005em;display:flex;gap:7px;align-items:baseline}
.smy-guide-row b{color:var(--ink);font-weight:700}
.smy-star{color:var(--ga);font-size:10px;flex:0 0 auto;transform:translateY(1px)}
.smy-big .smy-guide{flex-direction:row;flex-wrap:wrap;gap:5px 26px}
.smy-big .smy-guide-row{white-space:nowrap}
/* dynamic voice button: clean mic at rest, animated sound bars while listening */
.smy-mic{border:1.5px solid var(--line);background:var(--panel);cursor:pointer;width:38px;height:38px;border-radius:11px;flex:0 0 auto;display:grid;place-items:center;color:var(--muted);transition:color .15s,border-color .15s,background .15s}
.smy-mic:hover{color:var(--ga);border-color:color-mix(in srgb,var(--ga) 45%,var(--line))}
.smy-mic svg{width:19px;height:19px}
.smy-mic.live{background:linear-gradient(135deg,var(--ga),var(--gb));border-color:transparent;color:#fff;animation:smyMicPulse 1.4s ease-in-out infinite}
@keyframes smyMicPulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ga) 55%,transparent)}50%{box-shadow:0 0 0 8px transparent}}
.smy-wave{display:flex;align-items:center;gap:2.5px;height:16px}
.smy-wave i{width:2.5px;height:5px;background:#fff;border-radius:2px;animation:smyWave .9s ease-in-out infinite}
.smy-wave i:nth-child(2){animation-delay:.15s}.smy-wave i:nth-child(3){animation-delay:.3s}.smy-wave i:nth-child(4){animation-delay:.45s}
@keyframes smyWave{0%,100%{height:4px}50%{height:15px}}
.smy-digest{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.smy-dpill{font-size:10.5px;font-weight:800;color:var(--ink);background:color-mix(in srgb,var(--ct,var(--brand)) 14%,var(--panel));border:1px solid color-mix(in srgb,var(--ct,var(--brand)) 36%,transparent);padding:4px 9px;border-radius:7px;display:inline-flex;align-items:center;gap:5px}
.smy-aibadge{display:inline-block;margin-left:6px;font-family:var(--fh);font-size:9px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--ga),var(--gb));padding:1px 7px;border-radius:999px;vertical-align:middle;letter-spacing:.3px}
.smy-smbadge{display:inline-block;margin-left:6px;font-family:var(--fh);font-size:9px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--brand),var(--violet));padding:1px 7px;border-radius:999px;vertical-align:middle;letter-spacing:.3px}
.smy-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:60}
.smy-confetti span{position:absolute;top:-24px;animation:smyFall 1.6s ease-in forwards}
@keyframes smyFall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(680px) rotate(360deg);opacity:0}}
.smy-toast{position:fixed;z-index:10000;left:50%;transform:translateX(-50%);bottom:26px;background:var(--ink);color:var(--app);font-family:var(--fh);font-weight:600;font-size:12.5px;padding:11px 18px;border-radius:11px;box-shadow:var(--sh)}
.smy-rig{animation:smyBob 3.6s ease-in-out infinite;transform-origin:50% 95%}
@keyframes smyBob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2px) rotate(-1.2deg)}}
.smy-eye{animation:smyWink 4.8s infinite;transform-origin:center;transform-box:fill-box}
@keyframes smyWink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.12)}}
.smy-hand{transform-origin:24px 60px;transform-box:view-box;animation:smyHand 1s ease-in-out infinite}
@keyframes smyHand{0%{transform:rotate(-5deg)}12%{transform:rotate(22deg)}25%{transform:rotate(-17deg)}38%{transform:rotate(22deg)}50%{transform:rotate(-17deg)}62%{transform:rotate(18deg)}75%{transform:rotate(-9deg)}100%{transform:rotate(-5deg)}}
.smy-think,.smy-thought,.smy-grin{opacity:0}
.smy-thinking .smy-rig{animation:smyTilt 2s ease-in-out infinite}
@keyframes smyTilt{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(-7deg)}}
.smy-thinking .smy-armwrap{opacity:0}.smy-thinking .smy-think{opacity:1}.smy-thinking .smy-thought{opacity:1}
.smy-td{animation:smyTd 1.4s infinite}.smy-td:nth-child(2){animation-delay:.2s}.smy-td:nth-child(3){animation-delay:.4s}
@keyframes smyTd{0%,100%{opacity:.3}50%{opacity:1}}
.smy-talking .smy-mouth{animation:smyTalk .26s steps(2) 6;transform-origin:center;transform-box:fill-box}
@keyframes smyTalk{0%{transform:scaleY(1)}50%{transform:scaleY(1.7)}100%{transform:scaleY(1)}}
.smy-happy .smy-rig{animation:smyHop .5s ease 2}@keyframes smyHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
.smy-happy .smy-smile{opacity:0}.smy-happy .smy-grin{opacity:1}
@media (max-width:440px){.smy-panel{right:10px;left:10px;bottom:10px;width:auto;max-width:none;height:calc(100vh - 20px);border-radius:14px}}
@media (prefers-reduced-motion:reduce){.smy *{animation:none!important}}
`;