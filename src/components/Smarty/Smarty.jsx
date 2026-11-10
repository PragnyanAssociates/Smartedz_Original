import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import { MODULES } from '../../Screens/Modules';
import { BUILTINS, LIVE_IDS, STARTERS_BY_ROLE } from './Smartyknowledge';

// =====================================================================
//  Smarty — the in-app assistant. Mount ONCE inside the dashboard shell:
//      <Smarty onNavigate={setActiveTab} />
//  so her "Open …" buttons switch modules just like Notifications do.
//
//  • Free-standing animated character (glasses, wavy hair, green top +
//    purple cardigan) with moods: wave / think / talk / happy.
//  • Built-in answers (smartyKnowledge.js) work with zero admin setup;
//    the Super Admin's extra Q&A + "What's new" come from the backend.
//  • Live answers (next class / homework / attendance) come from
//    GET /api/smarty/bootstrap/:userId — never made up.
// =====================================================================

const idToModule = {};
const idToLabel = {};
MODULES.forEach(m => { idToModule[m.id] = m.module_name; idToLabel[m.id] = m.label || m.title || m.id; });

const toneVar = { sky: '--sky', amber: '--amber', emerald: '--emerald', rose: '--rose', violet: '--violet', brand: '--brand' };

function roleBucket(role) {
  const r = (role || '').toLowerCase();
  if (r.includes('student')) return 'student';
  if (r.includes('teacher')) return 'teacher';
  if (r.includes('parent') || r.includes('guardian')) return 'parent';
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
  const [mood, setMood] = useState('idle');
  const [msgs, setMsgs] = useState([]);
  const [chips, setChips] = useState([]);
  const [input, setInput] = useState('');
  const [boot, setBoot] = useState(null);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState('');

  const scrollRef = useRef(null);
  const moodTimer = useRef(null);
  const keyRef = useRef(0);
  const nextKey = () => ++keyRef.current;

  const role = user?.role;
  const canSeeLink = useCallback((linkId) => !linkId || isVisible(idToModule[linkId] || linkId), [isVisible]);

  // ----- the answer pool for THIS user (role + module-visibility) -----
  const buildPool = useCallback((b) => {
    const pool = [];
    BUILTINS.forEach(e => {
      if (!roleMatch(e.roles, role)) return;
      const linkId = e.answer?.link || (e.id === 'next-class' ? 'timetable' : null);
      if (linkId && !canSeeLink(linkId)) return;
      pool.push(e);
    });
    (b?.questions || []).forEach(q => {
      if (q.link && !canSeeLink(q.link)) return;
      pool.push({
        id: 'c' + q.id, q: q.question, roles: q.roles, tone: 'brand', icon: '💬', custom: true,
        keywords: [String(q.question || '').toLowerCase(), ...String(q.keywords || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)],
        answer: { text: q.answer, link: q.link || null, linkLabel: q.link ? ('Open ' + (idToLabel[q.link] || q.link)) : null, tone: 'brand' }
      });
    });
    return pool;
  }, [role, canSeeLink]);

  // ----- live answers built from bootstrap data (never hard-coded) ----
  const liveAnswer = useCallback((id, b) => {
    if (id === 'next-class') {
      const n = b?.nextClass;
      if (!n) return { tone: 'sky', text: 'No more classes scheduled for today 🎉' };
      const s = [n.teacher ? `Teacher: ${n.teacher}` : null, n.class_label, n.room ? `Room ${n.room}` : null].filter(Boolean).join(' · ');
      return {
        tone: 'sky', text: n.ongoing ? 'Your class right now 📖' : 'Your next class is coming up 📖',
        card: { em: '🔔', t: `${n.subject} · ${n.start}${n.end ? '–' + n.end : ''}`, s: s || 'Scheduled' },
        link: 'timetable', linkLabel: 'Open Timetable',
        extra: n.next_after ? `After that: ${n.next_after}.` : null
      };
    }
    if (id === 'hw-today') {
      const h = b?.homework;
      if (!h) return { tone: 'amber', text: "I couldn't load your homework just now.", link: 'Homework', linkLabel: 'Open Homework' };
      if (h.due_today > 0) return { tone: 'amber', text: `Yes! You have ${h.due_today} homework due today 📚`,
        card: h.next ? { em: '📘', t: h.next.title, s: [h.next.subject, h.pending > 1 ? `${h.pending} pending in all` : null].filter(Boolean).join(' · ') } : null,
        link: 'Homework', linkLabel: 'Open Homework' };
      if (h.pending > 0) return { tone: 'amber', text: `Nothing due today 🎈 — but you have ${h.pending} pending this week.`,
        card: h.next ? { em: '📘', t: h.next.title, s: `${h.next.subject || ''} · due ${h.next.due}` } : null,
        link: 'Homework', linkLabel: 'Open Homework' };
      return { tone: 'emerald', text: "You're all caught up — no pending homework! 🎉", link: 'Homework', linkLabel: 'Open Homework' };
    }
    if (id === 'attendance') {
      const a = b?.attendance;
      if (!a || a.percentage == null) return { tone: 'emerald', text: 'No attendance recorded yet for this year.', link: 'attendance', linkLabel: 'Open Attendance' };
      return { tone: 'emerald', text: `You're at ${a.percentage}% attendance 📊`,
        card: { em: '✅', t: `${a.present} of ${a.total} days present`, s: 'This academic year' },
        link: 'attendance', linkLabel: 'Open Attendance' };
    }
    if (id === 'news') {
      const items = (b?.updates || []);
      if (!items.length) return { tone: 'violet', text: "No new updates right now — I'll let you know when there are! 📣" };
      return { tone: 'violet', text: "Here's what's new 📣",
        items: items.map(u => ({ ttl: u.title, bd: u.body, isNew: !!u.is_new, link: u.link })) };
    }
    return null;
  }, []);

  const starters = useCallback((b, pool) => {
    const ids = STARTERS_BY_ROLE[roleBucket(role)] || STARTERS_BY_ROLE.default;
    const out = [];
    ids.forEach(id => {
      if (id === 'hw-today' && !b?.homework) return;
      if (id === 'attendance' && !b?.attendance) return;
      const e = pool.find(x => x.id === id);
      if (e) out.push({ id: e.id, label: e.q, icon: e.icon || '💬', tone: e.tone || 'brand' });
    });
    out.push({ id: 'news', label: "What's new?", icon: '📣', tone: 'violet' });
    return out;
  }, [role]);

  // ----- open: load bootstrap, greet, show the day -----
  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/bootstrap/${user.id}`);
      const b = res.ok ? await res.json() : {};
      setBoot(b);
      setUnread(b.unread || 0);
      return b;
    } catch (e) { setBoot({}); return {}; }
  }, [user]);

  useEffect(() => { load(); /* preload the badge */ }, [load]);

  const toBottom = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };
  useEffect(() => { toBottom(); }, [msgs]);

  const flash = (m) => { if (m !== 'idle') { setMood(m); clearTimeout(moodTimer.current); moodTimer.current = setTimeout(() => setMood('idle'), m === 'happy' ? 1600 : 4000); } };

  const pushMe = (text) => setMsgs(m => [...m, { k: nextKey(), who: 'me', text }]);
  const pushBot = (answer) => setMsgs(m => [...m, { k: nextKey(), who: 'bot', answer }]);
  const pushTyping = () => { const k = nextKey(); setMsgs(m => [...m, { k, who: 'typing' }]); return k; };
  const dropTyping = (k) => setMsgs(m => m.filter(x => x.k !== k));

  const answerFor = (id, b) => {
    if (LIVE_IDS.includes(id) || id === 'news') return liveAnswer(id, b);
    const e = (b?._pool || buildPool(b)).find(x => x.id === id);
    return e?.answer || null;
  };

  const respond = (id) => {
    const b = boot || {};
    const a = answerFor(id, b);
    if (id === 'news') markRead();
    if (!a) return suggest();
    flash('thinking');
    setTimeout(() => {
      const tk = pushTyping();
      setTimeout(() => { dropTyping(tk); pushBot(a); flash('talking'); }, 650 + Math.random() * 300);
    }, 650);
  };

  const COMPLIMENTS = ['thank', 'thanks', 'thx', 'great', 'nice', 'awesome', 'love you', 'love u', 'well done', 'super', 'excellent', 'best', 'cool', 'amazing', 'good job'];
  const compliment = () => {
    flash('thinking');
    setTimeout(() => { const tk = pushTyping(); setTimeout(() => { dropTyping(tk); pushBot({ tone: 'rose', text: "Aww, thank you! 💖 I'm always here whenever you need me. 😊" }); flash('happy'); }, 600); }, 450);
  };
  const suggest = () => {
    flash('thinking');
    setTimeout(() => { const tk = pushTyping(); setTimeout(() => { dropTyping(tk); pushBot({ text: "Hmm, I'm still learning that one 🤔 Try one of the buttons below, or ask about homework, attendance, fees or your timetable." }); flash('talking'); }, 550); }, 500);
  };

  const match = (text) => {
    const t = text.toLowerCase();
    const pool = buildPool(boot);
    let best = null, score = 0;
    const scan = (id, kws) => (kws || []).forEach(k => { if (k && t.includes(k) && k.length > score) { score = k.length; best = id; } });
    pool.forEach(e => scan(e.id, e.keywords));
    // live + news keyword nets
    scan('news', ['whats new', 'what is new', 'updates', 'news', 'latest', 'announcement']);
    return best;
  };

  const onSend = (e) => {
    e.preventDefault();
    const v = input.trim(); if (!v) return;
    pushMe(v); setInput('');
    if (COMPLIMENTS.some(c => v.toLowerCase().includes(c))) return compliment();
    const id = match(v); id ? respond(id) : suggest();
  };

  const markRead = useCallback(async () => {
    if (!unread) return;
    setUnread(0);
    try { await fetch(`${API_BASE_URL}/smarty/updates/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch (_) {}
  }, [unread]);

  const openPanel = async () => {
    setOpen(true);
    const b = await load();
    const pool = buildPool(b);
    if (b) b._pool = pool;
    setChips(starters(b, pool));
    setMsgs([]);
    const name = b?.user?.name || user?.name || 'there';
    pushBot({ text: `Hi ${name}! 👋 I'm **Smarty**. Here's a quick look at your day 👇` });
    // proactively show the next class
    setTimeout(() => respondWith('next-class', b), 500);
  };
  const respondWith = (id, b) => {
    const a = answerFor(id, b);
    if (!a) return;
    flash('thinking');
    setTimeout(() => { const tk = pushTyping(); setTimeout(() => { dropTyping(tk); pushBot(a); flash('talking'); }, 650); }, 650);
  };

  const navTo = (linkId) => {
    if (!linkId) return;
    const modId = MODULES.find(m => m.id === linkId) ? linkId : null;
    if (modId && typeof onNavigate === 'function') { onNavigate(modId); setOpen(false); }
    else { setToast(`Opening “${idToLabel[linkId] || linkId}”…`); setTimeout(() => setToast(''), 2000); }
  };

  const nameMeta = () => {
    const u = boot?.user || {};
    return [u.role || role, u.class_label, u.roll_no ? `Roll ${u.roll_no}` : null].filter(Boolean);
  };

  if (!user) return null;

  return (
    <div className="smy">
      <style>{CSS}</style>
      <Defs />

      {!open && (
        <button className="smy-launcher" onClick={openPanel} aria-label="Open Smarty">
          {unread > 0 && <span className="smy-ping">{unread > 9 ? '9+' : unread}</span>}
          <svg className="smy-headpop" viewBox="12 4 76 86" aria-hidden="true"><use href="#smy-head" /></svg>
        </button>
      )}

      {open && (
        <section className="smy-panel smy-pop" aria-label="Smarty assistant">
          <div className="smy-head-bar">
            <div className={`smy-hero ${mood !== 'idle' ? 'smy-' + mood : ''}`}>
              <svg viewBox="0 0 150 170" aria-hidden="true"><use href="#smy-full" /></svg>
            </div>
            <div className="smy-who">
              <h2>Smarty <span style={{ fontSize: 15 }}>✨</span></h2>
              <div className="smy-meta">{nameMeta().map((m, i) => <span key={i}>{m}</span>)}</div>
              <div className="smy-status"><i />{MOODTEXT[mood] || MOODTEXT.idle}</div>
            </div>
            <button className="smy-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>

          <div className="smy-scroll" ref={scrollRef}>
            {msgs.map(m => <Message key={m.k} m={m} onNav={navTo} />)}
          </div>

          <div className="smy-chips">
            {chips.map(c => (
              <button key={c.id} className="smy-chip" onClick={() => { pushMe(c.label); respond(c.id); }}>
                <span className="smy-ic" style={{ background: `var(${toneVar[c.tone] || '--brand'})` }}>{c.icon}</span>{c.label}
              </button>
            ))}
          </div>

          <form className="smy-composer" onSubmit={onSend}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Smarty anything…" aria-label="Ask Smarty" />
            <button className="smy-send" type="submit" aria-label="Send">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </form>
          <div className="smy-foot">Built-in answers for every screen · your school can add more</div>
        </section>
      )}

      {toast && <div className="smy-toast">{toast}</div>}
    </div>
  );
}

const MOODTEXT = { idle: 'Online · here to help', thinking: 'Thinking…', talking: 'Typing…', happy: '😊 Glad to help!' };

function Message({ m, onNav }) {
  if (m.who === 'me') return <div className="smy-msg smy-me"><div className="smy-bubble">{m.text}</div></div>;
  if (m.who === 'typing') return (
    <div className="smy-msg smy-bot"><Mini /><div className="smy-bubble smy-typing"><span /><span /><span /></div></div>
  );
  const a = m.answer || {};
  const tone = toneVar[a.tone] || '--brand';
  return (
    <div className="smy-msg smy-bot">
      <Mini />
      <div className="smy-bubble" style={{ '--tone': `var(${tone})` }}>
        <span dangerouslySetInnerHTML={{ __html: fmt(a.text) }} />
        {a.steps && <ul className="smy-steps">{a.steps.map((s, i) => <li key={i}><span className="smy-n">✓</span><span dangerouslySetInnerHTML={{ __html: fmt(s) }} /></li>)}</ul>}
        {a.card && <div className="smy-card"><span className="smy-em">{a.card.em}</span><div><div className="smy-t">{a.card.t}</div><div className="smy-s">{a.card.s}</div></div></div>}
        {a.extra && <div className="smy-extra">{a.extra}</div>}
        {a.items && <div className="smy-feed">{a.items.map((it, i) => (
          <div key={i} className={`smy-item ${it.isNew ? 'smy-new' : ''}`} onClick={() => it.link && onNav(it.link)} style={{ cursor: it.link ? 'pointer' : 'default' }}>
            <div className="smy-ttl">{it.ttl}{it.isNew && <span className="smy-tag">New</span>}</div>
            <div className="smy-bd">{it.bd}</div>
          </div>))}
        </div>}
        {a.link && <><br /><button className="smy-act" onClick={() => onNav(a.link)}>{a.linkLabel || 'Open'} <span className="smy-arw">▸</span></button></>}
      </div>
    </div>
  );
}
const Mini = () => <span className="smy-mini"><svg viewBox="14 4 74 84"><use href="#smy-head" /></svg></span>;

// very small formatter: **bold** only (answers are trusted admin/built-in text)
function fmt(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

// ---- Smarty character (reused defs) ----
function Defs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <g id="smy-head">
        <path d="M50 7C27 7 15 26 15 48c0 16 4 28 8 36l6-13c-4-12-2-30 4-39 6-10 17-13 17-13s11 3 17 13c6 9 8 27 4 39l6 13c4-8 8-20 8-36C85 26 73 7 50 7Z" fill="#5a3722" />
        <path d="M42 70h16v12H42z" fill="#eab38c" />
        <ellipse cx="50" cy="47" rx="22" ry="25" fill="#f3c6a0" />
        <circle cx="28" cy="49" r="4" fill="#f0bd93" /><circle cx="72" cy="49" r="4" fill="#f0bd93" />
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
        <path d="M75 12C40 12 23 40 23 74c0 30-1 60 3 86l17-12c-7-28-5-66 3-90 8-24 29-30 29-30s21 6 29 30c8 24 10 62 3 90l17 12c4-26 3-56 3-86 0-34-17-62-52-62Z" fill="#5a3722" />
        <path d="M28 170C28 134 48 116 75 116s47 18 47 54Z" fill="#6f6bb0" />
        <path d="M57 118 75 150 72 117Z" fill="#595491" /><path d="M93 118 75 150 78 117Z" fill="#595491" />
        <path d="M62 118 75 150 88 118c-8-3-18-3-26 0Z" fill="#8fb36a" /><path d="M70 118 75 134 80 118Z" fill="#f3ead2" />
        <g transform="translate(25,2)"><use href="#smy-head" /></g>
        <g className="smy-wave">
          <path d="M104 126c10-2 20-12 24-26l-11-4c-4 12-12 20-22 24Z" fill="#6f6bb0" />
          <rect x="116" y="58" width="13" height="40" rx="6.5" fill="#f3c6a0" />
          <path d="M116 64c0-5 13-5 13 0" fill="none" stroke="#595491" strokeWidth="3" />
          <circle cx="122.5" cy="52" r="8" fill="#f3c6a0" />
          <rect x="114" y="38" width="3.4" height="13" rx="1.7" fill="#f3c6a0" /><rect x="119" y="35" width="3.4" height="16" rx="1.7" fill="#f3c6a0" />
          <rect x="124" y="36" width="3.4" height="15" rx="1.7" fill="#f3c6a0" /><rect x="128.5" y="39" width="3.4" height="12" rx="1.7" fill="#f3c6a0" />
          <rect x="130" y="50" width="3.2" height="9" rx="1.6" fill="#f3c6a0" transform="rotate(42 131 52)" />
        </g>
        <g className="smy-think">
          <path d="M104 150c6-10 14-20 20-26l6 6c-7 7-13 17-17 26Z" fill="#6f6bb0" /><circle cx="96" cy="96" r="7" fill="#f3c6a0" />
        </g>
        <g className="smy-thought"><circle cx="120" cy="22" r="11" fill="#fff" /><circle cx="108" cy="34" r="4" fill="#fff" /><circle cx="101" cy="42" r="2.4" fill="#fff" />
          <circle className="smy-td" cx="115" cy="22" r="2" fill="#8b5cf6" /><circle className="smy-td" cx="120" cy="22" r="2" fill="#8b5cf6" /><circle className="smy-td" cx="125" cy="22" r="2" fill="#8b5cf6" /></g>
      </g>
    </defs></svg>
  );
}

const CSS = `
.smy{--brand:#18469a;--brand-2:#3f6fd6;--amber:#f59e0b;--emerald:#10b981;--rose:#fb6f92;--violet:#8b5cf6;--sky:#2bb3e8;
  --panel:#fff;--app:#f4f7fe;--ink:#1e2535;--muted:#6a7488;--line:#e6eaf3;--bot:#f1f4fd;--me:#18469a;
  --ga:#2f6df6;--gb:#8b5cf6;--sh:0 18px 50px -12px rgba(24,70,154,.35);
  --fh:'Fredoka',system-ui,sans-serif;--fb:'Nunito','Segoe UI',system-ui,sans-serif;font-family:var(--fb)}
@media (prefers-color-scheme:dark){.smy{--panel:#171e2d;--app:#121826;--ink:#e9edf7;--muted:#97a2b8;--line:#273146;--bot:#1f2838;--me:#3f6fd6;--brand-2:#6f93e6}}
.smy *{box-sizing:border-box}
.smy button{font-family:inherit}
.smy-launcher{position:fixed;z-index:9998;right:20px;bottom:20px;width:68px;height:68px;border:none;border-radius:50%;cursor:pointer;padding:0;overflow:visible;background:linear-gradient(145deg,var(--ga),var(--gb));box-shadow:var(--sh);display:grid;place-items:center;animation:smyFloat 3.2s ease-in-out infinite}
.smy-headpop{position:absolute;bottom:4px;width:62px;height:72px;filter:drop-shadow(0 4px 5px rgba(0,0,0,.25))}
.smy-ping{position:absolute;top:-2px;right:-2px;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:var(--rose);color:#fff;font-family:var(--fh);font-weight:700;font-size:12px;display:grid;place-items:center;border:2px solid var(--panel);z-index:2}
@keyframes smyFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.smy-panel{position:fixed;z-index:9999;display:flex;flex-direction:column;overflow:hidden;right:20px;bottom:20px;width:392px;max-width:calc(100vw - 32px);height:min(650px,calc(100vh - 40px));background:var(--panel);border-radius:26px;box-shadow:var(--sh);border:1px solid var(--line)}
.smy-pop{animation:smyPop .34s cubic-bezier(.22,1.2,.36,1)}
@keyframes smyPop{from{transform:scale(.6) translateY(30px);opacity:0}to{transform:none;opacity:1}}
.smy-head-bar{background:linear-gradient(130deg,var(--ga),var(--gb));color:#fff;padding:12px 14px;position:relative;flex:0 0 auto;min-height:118px;display:flex;align-items:center}
.smy-hero{position:relative;width:104px;height:118px;flex:0 0 auto;margin-top:6px}
.smy-hero svg{width:104px;height:132px;position:absolute;left:0;bottom:-6px;overflow:visible;filter:drop-shadow(0 6px 7px rgba(0,0,0,.28))}
.smy-who{flex:1;min-width:0;padding-left:6px;align-self:flex-start;padding-top:6px}
.smy-who h2{font-family:var(--fh);font-weight:600;font-size:21px;margin:0;display:flex;align-items:center;gap:6px}
.smy-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.smy-meta span{font-size:10.5px;font-weight:800;background:rgba(255,255,255,.2);padding:3px 8px;border-radius:999px;font-family:var(--fh)}
.smy-status{font-size:11.5px;font-weight:800;opacity:.92;display:flex;align-items:center;gap:6px;margin-top:8px}
.smy-status i{width:8px;height:8px;border-radius:50%;background:#7CFFB2;animation:smyLive 2s infinite}
@keyframes smyLive{0%{box-shadow:0 0 0 0 rgba(124,255,178,.7)}70%{box-shadow:0 0 0 7px rgba(124,255,178,0)}100%{box-shadow:0 0 0 0 rgba(124,255,178,0)}}
.smy-x{appearance:none;border:none;background:rgba(255,255,255,.2);color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:17px;display:grid;place-items:center;position:absolute;top:10px;right:12px}
.smy-x:hover{background:rgba(255,255,255,.32)}
.smy-scroll{flex:1;overflow-y:auto;padding:16px 14px 6px;display:flex;flex-direction:column;gap:12px;background:var(--app)}
.smy-msg{display:flex;gap:8px;align-items:flex-end;max-width:100%;animation:smyRise .34s ease both}
@keyframes smyRise{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
.smy-mini{width:30px;height:34px;flex:0 0 auto;overflow:visible}
.smy-mini svg{width:30px;height:34px;overflow:visible;filter:drop-shadow(0 2px 2px rgba(0,0,0,.18))}
.smy-bubble{padding:11px 14px;border-radius:18px;font-size:14px;font-weight:600;max-width:80%;box-shadow:0 3px 12px -7px rgba(24,70,154,.4);color:var(--ink)}
.smy-bot .smy-bubble{background:var(--bot);border-bottom-left-radius:6px}
.smy-me{flex-direction:row-reverse}.smy-me .smy-bubble{background:var(--me);color:#fff;border-bottom-right-radius:6px}
.smy-bubble b{font-weight:800}
.smy-steps{margin:9px 0 0;padding:0;list-style:none;display:grid;gap:7px}
.smy-steps li{display:flex;gap:9px;align-items:flex-start;font-weight:700;font-size:13.5px}
.smy-n{width:20px;height:20px;border-radius:50%;background:var(--tone,var(--brand));color:#fff;font-family:var(--fh);font-size:11px;display:grid;place-items:center;flex:0 0 auto;margin-top:1px}
.smy-card{margin-top:10px;border-radius:15px;padding:11px 13px;display:flex;align-items:center;gap:11px;background:color-mix(in srgb,var(--tone,var(--brand)) 12%,var(--panel));border:1.5px solid color-mix(in srgb,var(--tone,var(--brand)) 45%,transparent)}
.smy-em{font-size:24px}.smy-t{font-weight:800;font-size:14px}.smy-s{font-size:12px;color:var(--muted);font-weight:700;margin-top:1px}
.smy-extra{margin-top:8px;font-size:12.5px;color:var(--muted);font-weight:700}
.smy-act{margin-top:11px;display:inline-flex;align-items:center;gap:7px;border:none;cursor:pointer;color:#fff;font-family:var(--fh);font-weight:600;font-size:13px;padding:9px 14px;border-radius:11px;background:linear-gradient(135deg,var(--tone,var(--brand)),color-mix(in srgb,var(--tone,var(--brand)) 55%,var(--violet)));box-shadow:0 7px 16px -8px color-mix(in srgb,var(--tone,var(--brand)) 80%,transparent)}
.smy-feed{display:grid;gap:8px;margin-top:9px}
.smy-item{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--amber);border-radius:12px;padding:9px 12px}
.smy-item.smy-new{border-left-color:var(--rose)}
.smy-ttl{font-weight:800;font-size:13px;display:flex;gap:7px;align-items:center}
.smy-bd{font-size:12.5px;color:var(--muted);font-weight:700;margin-top:2px}
.smy-tag{font-size:10px;font-family:var(--fh);font-weight:700;color:#fff;background:var(--rose);padding:1px 7px;border-radius:999px}
.smy-typing{display:flex;gap:4px;padding:14px}
.smy-typing span{width:7px;height:7px;border-radius:50%;background:var(--muted);opacity:.6;animation:smyTb 1.1s infinite}
.smy-typing span:nth-child(2){animation-delay:.18s}.smy-typing span:nth-child(3){animation-delay:.36s}
@keyframes smyTb{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}
.smy-chips{display:flex;flex-wrap:wrap;gap:8px;padding:5px 14px 2px;background:var(--panel)}
.smy-chip{border:1.5px solid var(--line);background:var(--panel);cursor:pointer;font-weight:800;font-size:12.5px;color:var(--ink);padding:9px 13px;border-radius:999px;display:inline-flex;align-items:center;gap:7px;transition:transform .12s,border-color .12s}
.smy-chip:hover{transform:translateY(-2px);border-color:var(--brand-2)}
.smy-ic{width:19px;height:19px;border-radius:7px;display:grid;place-items:center;font-size:11px;color:#fff}
.smy-composer{flex:0 0 auto;padding:10px 12px;background:var(--panel);border-top:1px solid var(--line);display:flex;gap:9px;align-items:center}
.smy-composer input{flex:1;min-width:0;border:1.5px solid var(--line);background:var(--app);color:var(--ink);border-radius:999px;padding:11px 15px;font-weight:700;font-size:14px;outline:none}
.smy-composer input:focus{border-color:var(--brand-2)}
.smy-send{border:none;cursor:pointer;width:44px;height:44px;border-radius:50%;flex:0 0 auto;background:linear-gradient(135deg,var(--ga),var(--gb));color:#fff;display:grid;place-items:center}
.smy-send svg{width:20px;height:20px}
.smy-foot{font-size:10.5px;color:var(--muted);text-align:center;font-weight:700;padding:0 14px 10px;background:var(--panel)}
.smy-toast{position:fixed;z-index:10000;left:50%;transform:translateX(-50%);bottom:26px;background:var(--ink);color:var(--app);font-family:var(--fh);font-weight:600;font-size:13.5px;padding:11px 18px;border-radius:999px;box-shadow:var(--sh)}
.smy-rig{animation:smyBob 3.6s ease-in-out infinite;transform-origin:50% 95%}
@keyframes smyBob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2px) rotate(-1.2deg)}}
.smy-eye{animation:smyWink 4.8s infinite;transform-origin:center;transform-box:fill-box}
@keyframes smyWink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.12)}}
.smy-wave{animation:smyWave 1.9s ease-in-out infinite;transform-origin:120px 98px;transform-box:view-box}
@keyframes smyWave{0%,100%{transform:rotate(7deg)}50%{transform:rotate(-16deg)}}
.smy-think,.smy-thought,.smy-grin{opacity:0}
.smy-thinking .smy-rig{animation:smyTilt 2s ease-in-out infinite}
@keyframes smyTilt{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(-7deg)}}
.smy-thinking .smy-wave{opacity:0}.smy-thinking .smy-think{opacity:1}.smy-thinking .smy-thought{opacity:1}
.smy-td{animation:smyTd 1.4s infinite}.smy-td:nth-child(2){animation-delay:.2s}.smy-td:nth-child(3){animation-delay:.4s}
@keyframes smyTd{0%,100%{opacity:.3}50%{opacity:1}}
.smy-talking .smy-mouth{animation:smyTalk .26s steps(2) 6;transform-origin:center;transform-box:fill-box}
@keyframes smyTalk{0%{transform:scaleY(1)}50%{transform:scaleY(1.7)}100%{transform:scaleY(1)}}
.smy-happy .smy-rig{animation:smyHop .5s ease 2}@keyframes smyHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
.smy-happy .smy-smile{opacity:0}.smy-happy .smy-grin{opacity:1}
@media (max-width:440px){.smy-panel{right:10px;left:10px;bottom:10px;width:auto;max-width:none;height:calc(100vh - 20px);border-radius:22px}}
@media (prefers-reduced-motion:reduce){.smy *{animation:none!important}}
`;