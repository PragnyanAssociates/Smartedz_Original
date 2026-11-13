import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { MODULES } from '../../Screens/Modules';
import {
  Bot, Plus, Trash2, Save, X, Megaphone, MessageSquareText, Loader2, Eye, EyeOff, Send,
  Sparkles, KeyRound, CheckCircle2, ShieldCheck, ExternalLink, RefreshCw, BookOpen, HelpCircle
} from 'lucide-react';

// =====================================================================
//  SmartyAdmin — Super Admin console for the Smarty assistant.
//   • Questions tab: extra Q&A added on top of the built-in pack.
//   • Updates tab:   "What's new" posts that also fan out to everyone's
//                    Notifications.
//  Built-in how-to answers are shipped in the app, so this is optional —
//  the school only adds what's specific to them.
// =====================================================================

const ROLE_OPTIONS = ['all', 'Student', 'Teacher', 'Parent', 'Accountant', 'Admin'];
const LINKABLE = MODULES.filter(m => !m.hideFromSidebar).map(m => ({ id: m.id, label: m.label || m.title || m.id }));

export default function SmartyAdmin() {
  const { user } = useAuth();
  const instId = user?.institutionId;
  const [tab, setTab] = useState('questions');
  const [help, setHelp] = useState(false);

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <header className="flex items-start gap-3">
        <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center ring-1 ring-primary/20 shrink-0"><Bot className="size-5" /></div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Smarty Assistant</h1>
          <p className="text-sm text-zinc-500">Add your own questions and post app updates. Built-in help works without any setup.</p>
        </div>
        <button onClick={() => setHelp(true)}
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors self-start">
          <HelpCircle className="size-3.5" /> User Guide
        </button>
      </header>

      {help && <SmartyHelpModal tab={tab} onClose={() => setHelp(false)} />}

      <div className="flex bg-zinc-100/80 p-1 rounded-md w-full sm:w-fit">
        {[['questions', 'Questions', MessageSquareText], ['updates', "What's New", Megaphone], ['ai', 'Smarty AI', Sparkles]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${tab === id ? 'bg-primary text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'questions' ? <QuestionsTab instId={instId} />
        : tab === 'updates' ? <UpdatesTab instId={instId} />
        : <AiSettingsTab instId={instId} />}
    </div>
  );
}

// ------------------------------------------------------------------ User Guide
//  A how-to manual for the Smarty Assistant console. Same primary-header +
//  numbered-step look as every other module's guide, and it follows the tab
//  you're standing on.
const SMARTY_GUIDES = {
  questions: {
    title: 'Custom Questions',
    steps: [
      ['1 · What this is', 'Smarty already answers common how-to questions on its own. Here you add extra Q&A that is specific to your school — your rules, your fees, your timings — so Smarty replies in your own words.'],
      ['2 · Add a question', 'Fill in the question, the answer, and (optionally) a category. Write the answer the way you’d tell a parent — short and clear.'],
      ['3 · Who sees it', 'Set the roles the answer is for (everyone, or just Students, Teachers, Parents…). It only ever shows to those roles.'],
      ['4 · Keywords & link', 'Keywords are the other ways people might ask the same thing, so Smarty still matches it. An optional link opens the right screen from the reply.'],
      ['5 · Turn on / off & edit', 'Use the toggle to switch an answer on or off without deleting it, and edit or remove any row later.'],
    ],
    note: 'These answers are checked before the AI, so they’re instant and free. Keep them accurate — if a rule changes, update the answer here.'
  },
  updates: {
    title: "What's New",
    steps: [
      ['1 · What this is', 'Post a short “What’s new” update — a new feature, a holiday, an exam notice. It shows inside Smarty and also goes to everyone’s Notifications.'],
      ['2 · Write the update', 'Give it a title and a message. Keep it brief — people read it on a phone.'],
      ['3 · Choose who gets it', 'Target everyone or specific roles, so only the right people are notified.'],
      ['4 · Post it', 'Posting fans the update out to the chosen roles right away and lists it here.'],
      ['5 · Remove one', 'Delete an update when it’s no longer relevant — it stops showing in Smarty.'],
    ],
    note: 'Updates are announcements, not saved answers. Use Custom Questions for things people will keep asking, and What’s New for one-off news.'
  },
  ai: {
    title: 'Smarty AI',
    steps: [
      ['1 · Open-ended answers (optional)', 'Paste ONE API key from Gemini, ChatGPT or Claude, turn Status On, and Save. Smarty detects the provider automatically and uses it only for open questions it can’t answer from your books or custom Q&A.'],
      ['2 · Where to get a key', 'Use the links on the left to create a key, copy it, and paste it in. Without a key, Smarty still answers from built-in help, your custom questions and your textbooks.'],
      ['3 · Answer from your textbooks', 'Smarty reads the books, keywords and Library files you upload in Syllabus, scoped to each student’s class. After adding or changing material, press Rebuild book index. Scanned (image) books are read with OCR the first time.'],
      ['4 · Saved answers', 'To stay fast, Smarty reuses answers it has already worked out. If one came out wrong, type that exact question under “Forget one answer”. “Clear all” wipes every saved answer (ticks a confirm box first) — your key, books and settings are untouched.'],
      ['5 · Test it', 'Use Test on the key to check it works, and Test book search to see what a question pulls from your books.'],
    ],
    note: 'The key is stored on your school’s server record — only the Super Admin here can view it; students and teachers never can. Answers about a student’s own data are never cached or shared.'
  }
};

function SmartyHelpModal({ tab, onClose }) {
  const content = SMARTY_GUIDES[tab] || SMARTY_GUIDES.questions;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
          <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="size-5" /></button>
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
  );
}

// ------------------------------------------------------------------ Questions
const BLANK_Q = { id: null, category: '', question: '', answer: '', roles: 'all', link: '', keywords: '', is_active: 1 };

function QuestionsTab({ instId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK_Q);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!instId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/questions/${instId}`);
      setRows(res.ok ? await res.json() : []);
    } catch { setRows([]); }
    setLoading(false);
  }, [instId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim()) { alert('Question and answer are required.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setForm(BLANK_Q); await load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };
  const remove = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try { await fetch(`${API_BASE_URL}/smarty/questions/${id}`, { method: 'DELETE' }); await load(); } catch (e) { alert(e.message); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* editor */}
      <div className="bg-white ring-1 ring-black/5 rounded-lg p-5 shadow-sm space-y-4 h-fit">
        <h3 className="text-sm font-semibold text-zinc-900">{form.id ? 'Edit question' : 'Add a question'}</h3>
        <Field label="Question (shown as a button)">
          <input value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} placeholder="e.g. When is the next PTM?" className={inp} />
        </Field>
        <Field label="Answer">
          <textarea value={form.answer} onChange={e => setForm({ ...form, answer: e.target.value })} rows={3} placeholder="Use **bold** for emphasis." className={inp} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Who sees it">
            <select value={form.roles} onChange={e => setForm({ ...form, roles: e.target.value })} className={inp}>
              {ROLE_OPTIONS.map(r => <option key={r} value={r === 'all' ? 'all' : r}>{r === 'all' ? 'Everyone' : r}</option>)}
            </select>
          </Field>
          <Field label="Open button (optional)">
            <select value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} className={inp}>
              <option value="">No button</option>
              {LINKABLE.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category (optional)"><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inp} /></Field>
          <Field label="Extra match words (comma)"><input value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} placeholder="ptm, meeting" className={inp} /></Field>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={save} disabled={saving} className="h-9 px-4 rounded-md bg-primary text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:bg-zinc-300">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} {form.id ? 'Update' : 'Add'}
          </button>
          {form.id && <button onClick={() => setForm(BLANK_Q)} className="h-9 px-3 rounded-md ring-1 ring-zinc-200 text-xs font-semibold text-zinc-600 inline-flex items-center gap-1.5"><X className="size-3.5" /> Cancel</button>}
        </div>
      </div>

      {/* list */}
      <div className="bg-white ring-1 ring-black/5 rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Your questions ({rows.length})</div>
        {loading ? <div className="h-40 grid place-items-center"><Loader2 className="animate-spin size-6 text-primary" /></div>
          : rows.length === 0 ? <div className="p-8 text-center text-sm text-zinc-400">No custom questions yet. The built-in help still works.</div>
          : <ul className="divide-y divide-zinc-100 max-h-[520px] overflow-y-auto">
              {rows.map(r => (
                <li key={r.id} className="px-5 py-3 flex items-start gap-3 hover:bg-zinc-50/60">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                      {r.question}
                      {!r.is_active && <span className="text-[9px] uppercase font-bold text-zinc-400 flex items-center gap-1"><EyeOff className="size-3" /> off</span>}
                    </div>
                    <div className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{r.answer}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Pill>{r.roles === 'all' ? 'Everyone' : r.roles}</Pill>
                      {r.link && <Pill>↳ {r.link}</Pill>}
                      {r.category && <Pill>{r.category}</Pill>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => setForm({ id: r.id, category: r.category || '', question: r.question, answer: r.answer, roles: r.roles || 'all', link: r.link || '', keywords: r.keywords || '', is_active: r.is_active })}
                      className="size-8 grid place-items-center rounded-md ring-1 ring-zinc-200 text-zinc-500 hover:text-primary"><MessageSquareText className="size-3.5" /></button>
                    <button onClick={() => remove(r.id)} className="size-8 grid place-items-center rounded-md ring-1 ring-zinc-200 text-zinc-400 hover:text-red-500"><Trash2 className="size-3.5" /></button>
                  </div>
                </li>
              ))}
            </ul>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Updates
const BLANK_U = { id: null, title: '', body: '', link: '', roles: 'all', is_active: 1 };

function UpdatesTab({ instId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK_U);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!instId) return;
    setLoading(true);
    try { const res = await fetch(`${API_BASE_URL}/smarty/updates-admin/${instId}`); setRows(res.ok ? await res.json() : []); }
    catch { setRows([]); }
    setLoading(false);
  }, [instId]);
  useEffect(() => { load(); }, [load]);

  const post = async () => {
    if (!form.title.trim() || !form.body.trim()) { alert('Title and message are required.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/updates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error || 'Post failed');
      setForm(BLANK_U); await load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };
  const remove = async (id) => { if (!window.confirm('Delete this update?')) return; try { await fetch(`${API_BASE_URL}/smarty/updates/${id}`, { method: 'DELETE' }); await load(); } catch (e) { alert(e.message); } };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white ring-1 ring-black/5 rounded-lg p-5 shadow-sm space-y-4 h-fit">
        <h3 className="text-sm font-semibold text-zinc-900">{form.id ? 'Edit update' : 'Post an update'}</h3>
        <p className="text-[11px] text-zinc-500 -mt-2">New updates appear in Smarty’s “What’s new” and go to everyone’s Notifications.</p>
        <Field label="Title"><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="🆕 New report cards" className={inp} /></Field>
        <Field label="Message"><textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={3} className={inp} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Who sees it">
            <select value={form.roles} onChange={e => setForm({ ...form, roles: e.target.value })} className={inp}>
              {ROLE_OPTIONS.map(r => <option key={r} value={r === 'all' ? 'all' : r}>{r === 'all' ? 'Everyone' : r}</option>)}
            </select>
          </Field>
          <Field label="Open button (optional)">
            <select value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} className={inp}>
              <option value="">No button</option>
              {LINKABLE.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={post} disabled={saving} className="h-9 px-4 rounded-md bg-primary text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:bg-zinc-300">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} {form.id ? 'Update' : 'Post'}
          </button>
          {form.id && <button onClick={() => setForm(BLANK_U)} className="h-9 px-3 rounded-md ring-1 ring-zinc-200 text-xs font-semibold text-zinc-600 inline-flex items-center gap-1.5"><X className="size-3.5" /> Cancel</button>}
        </div>
      </div>

      <div className="bg-white ring-1 ring-black/5 rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Posted updates ({rows.length})</div>
        {loading ? <div className="h-40 grid place-items-center"><Loader2 className="animate-spin size-6 text-primary" /></div>
          : rows.length === 0 ? <div className="p-8 text-center text-sm text-zinc-400">No updates posted yet.</div>
          : <ul className="divide-y divide-zinc-100 max-h-[520px] overflow-y-auto">
              {rows.map(r => (
                <li key={r.id} className="px-5 py-3 flex items-start gap-3 hover:bg-zinc-50/60">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-zinc-900">{r.title}</div>
                    <div className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{r.body}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Pill>{r.roles === 'all' ? 'Everyone' : r.roles}</Pill>
                      {r.link && <Pill>↳ {r.link}</Pill>}
                      <Pill>{new Date(r.created_at).toLocaleDateString()}</Pill>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => setForm({ id: r.id, title: r.title, body: r.body, link: r.link || '', roles: r.roles || 'all', is_active: r.is_active })}
                      className="size-8 grid place-items-center rounded-md ring-1 ring-zinc-200 text-zinc-500 hover:text-primary"><Megaphone className="size-3.5" /></button>
                    <button onClick={() => remove(r.id)} className="size-8 grid place-items-center rounded-md ring-1 ring-zinc-200 text-zinc-400 hover:text-red-500"><Trash2 className="size-3.5" /></button>
                  </div>
                </li>
              ))}
            </ul>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Smarty AI (ONE key, any provider)
//  The admin pastes a SINGLE API key from whichever AI they have — Gemini,
//  ChatGPT or Claude. Smarty detects which one from the key's prefix, so
//  there's nothing to choose. It's stored per institution in the database
//  (never in the app code) and never shown in full again. While no key is
//  saved + turned on, open-ended answers stay OFF; the built-in help works.
const AI_PROVIDER_NAME = { gemini: 'Google Gemini', openai: 'ChatGPT (OpenAI)', anthropic: 'Claude (Anthropic)' };

function AiSettingsTab({ instId }) {
  const [cfg, setCfg]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey]   = useState('');
  const [enabled, setEnabled] = useState(false);
  const [show, setShow]       = useState(false);           // eye toggle
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);            // { ok, text }
  const initial = useRef({ key: '', enabled: false });     // to detect changes

  const load = useCallback(async () => {
    if (!instId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/ai-config/${instId}`);
      const d = res.ok ? await res.json() : {};
      setCfg(d);
      const k = d.api_key || '';
      setApiKey(k); setEnabled(!!d.enabled);
      initial.current = { key: k, enabled: !!d.enabled };
    } catch { setCfg({}); }
    setLoading(false);
  }, [instId]);
  useEffect(() => { load(); }, [load]);

  // Save only lights up when the key or the On/Off has actually changed.
  const dirty = apiKey.trim() !== (initial.current.key || '').trim() || enabled !== initial.current.enabled;

  const save = async () => {
    if (!apiKey.trim()) { alert('Paste an API key first.'); return; }
    setSaving(true); setSaved(false); setTestMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/ai-config`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim(), enabled })   // provider auto-detected server-side
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setSaved(true); await load();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  // Test asks the AI a trivial question and shows the exact result/error.
  const test = async () => {
    setTesting(true); setTestMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'In one short sentence, say hello as a connection test.', fresh: true })
      });
      const d = await res.json().catch(() => ({}));
      if (d && d.ok) setTestMsg({ ok: true, text: d.answer });
      else if (d && d.reason === 'disabled') setTestMsg({ ok: false, text: 'AI is off or no key saved. Turn Status On and Save first.' });
      else setTestMsg({ ok: false, text: (d && d.error) ? d.error : 'The AI service did not respond — check the key.' });
    } catch (e) { setTestMsg({ ok: false, text: e.message }); }
    setTesting(false);
  };

  // ---- Textbook knowledge (RAG): rebuild the searchable book index ----
  //  Rebuild now runs in the BACKGROUND on the server (OCR of a scanned book
  //  takes minutes). We start it, then poll /rag/status for live progress.
  const [ragChunks, setRagChunks]   = useState(null);
  const [ragOcr, setRagOcr]         = useState(null);     // 'on' | 'off' (OCR available?)
  const [ragEngine, setRagEngine]   = useState(null);     // 'native' | 'wasm' | 'none'
  const [reindexing, setReindexing] = useState(false);
  const [ragJob, setRagJob]         = useState(null);     // live progress while running
  const [ragMsg, setRagMsg]         = useState(null);
  const [ocrTest, setOcrTest]       = useState(null);     // self-test result
  const [ocrTesting, setOcrTesting] = useState(false);
  const ragPoll = useRef(null);

  const loadRag = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/rag/status`);
      const d = await res.json().catch(() => ({}));
      if (d && d.ok) {
        setRagChunks(d.chunks);
        setRagOcr(d.ocr || null);
        setRagEngine(d.ocrEngine || null);
        if (d.job && d.job.running) { setReindexing(true); setRagJob(d.job); startRagPoll(); }
      }
    } catch (_) {}
  }, []);

  const runOcrTest = async () => {
    setOcrTesting(true); setOcrTest(null);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/rag/ocrtest`);
      const d = await res.json().catch(() => ({}));
      setOcrTest(d || { ok: false, reason: 'No response.' });
    } catch (e) { setOcrTest({ ok: false, reason: e.message }); }
    setOcrTesting(false);
  };

  const finishRag = (job) => {
    setReindexing(false); setRagJob(null);
    if (ragPoll.current) { clearInterval(ragPoll.current); ragPoll.current = null; }
    loadRag();
    if (job && job.error) { setRagMsg({ ok: false, text: `Rebuild failed: ${job.error}` }); return; }
    const r = (job && job.result) || {};
    if (r.ocr === 'off' && r.scanned) {
      setRagMsg({ ok: false, text: `Indexed ${r.chunks} passages, but your textbooks are scanned images and OCR is not installed. Run  npm install mupdf tesseract.js --save  on the server and rebuild, so Smarty can read scanned books.` });
    } else if (r.scanned) {
      setRagMsg({ ok: false, text: `Indexed ${r.chunks} passages, but no text could be read from ${r.chapters} chapter(s) even after OCR. Check the PDFs, or add keywords per chapter.` });
    } else {
      const ocrNote = r.ocrChapters ? ` (${r.ocrChapters} scanned via OCR)` : '';
      setRagMsg({ ok: true, text: `Indexed ${r.chunks} passages — ${(r.chars || 0).toLocaleString()} chars from ${r.chapters} chapter(s)${ocrNote} and ${r.files} library file(s).` });
    }
  };

  const startRagPoll = useCallback(() => {
    if (ragPoll.current) return;
    ragPoll.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/smarty/rag/status`);
        const d = await res.json().catch(() => ({}));
        if (!d || !d.ok) return;
        setRagChunks(d.chunks);
        if (d.job && d.job.running) { setRagJob(d.job); }
        else { finishRag(d.job); }
      } catch (_) {}
    }, 2000);
  }, []);

  useEffect(() => { loadRag(); return () => { if (ragPoll.current) clearInterval(ragPoll.current); }; }, [loadRag]);

  const reindex = async (force = false) => {
    setReindexing(true); setRagMsg(null); setRagJob(null);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/rag/reindex${force ? '?force=1' : ''}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
      const d = await res.json().catch(() => ({}));
      if (d && d.ok && d.started) {
        setRagOcr(d.ocr || ragOcr);
        startRagPoll();                 // watch progress
      } else if (d && d.reason === 'busy') {
        startRagPoll();                 // already running — just watch it
      } else {
        setReindexing(false);
        setRagMsg({ ok: false, text: (d && d.error) || 'Could not start the rebuild.' });
      }
    } catch (e) { setReindexing(false); setRagMsg({ ok: false, text: e.message }); }
  };

  // ---- Test what the book search finds for a query ----
  const [ragQ, setRagQ]           = useState('');
  const [searching, setSearching] = useState(false);
  const [ragHits, setRagHits]     = useState(null);
  const bookSearch = async () => {
    if (!ragQ.trim()) return;
    setSearching(true); setRagHits(null);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/rag/search?q=${encodeURIComponent(ragQ.trim())}`);
      const d = await res.json().catch(() => ({}));
      setRagHits(d && d.ok ? (d.matches || []) : []);
    } catch (_) { setRagHits([]); }
    setSearching(false);
  };

  // ---- Saved-answers (cache) controls ----
  //  Smarty stores book/AI answers for speed. A wrong one (e.g. a vague
  //  one-word question that matched the wrong passage) can be forgotten here so
  //  the next ask is answered fresh. "Forget" clears one typed question;
  //  "Clear all" wipes every saved answer for the school.
  const [forgetQ, setForgetQ] = useState('');
  const [cacheMsg, setCacheMsg] = useState(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);   // extra guard for "Clear all"
  const forgetOne = async () => {
    if (!forgetQ.trim()) return;
    setCacheBusy(true); setCacheMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/forget`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: forgetQ.trim() })
      });
      const d = await res.json().catch(() => ({}));
      setCacheMsg(d.ok ? { ok: true, text: d.removed ? `Forgotten — removed ${d.removed} saved answer(s). It'll be answered fresh next time.` : 'No saved answer matched that exact question.' }
                       : { ok: false, text: d.error || 'Could not clear it.' });
      if (d.ok && d.removed) setForgetQ('');
    } catch (e) { setCacheMsg({ ok: false, text: e.message }); }
    setCacheBusy(false);
  };
  const clearAll = async () => {
    if (!clearConfirm) return;   // the checkbox must be ticked first
    if (!window.confirm('Delete every saved answer for this school? This cannot be undone. Smarty will keep working and rebuild answers as questions come in.')) return;
    setCacheBusy(true); setCacheMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/cache/clear`, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      setCacheMsg(d.ok ? { ok: true, text: `Cleared ${d.removed || 0} saved answer(s).` } : { ok: false, text: d.error || 'Could not clear.' });
      if (d.ok) setClearConfirm(false);
    } catch (e) { setCacheMsg({ ok: false, text: e.message }); }
    setCacheBusy(false);
  };

  if (loading) return <div className="h-40 grid place-items-center"><Loader2 className="animate-spin size-6 text-primary" /></div>;

  const configured = !!cfg?.configured;
  const provName = AI_PROVIDER_NAME[cfg?.provider] || 'AI';

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      {/* left: the key form + where-to-get-a-key (fills the space under the form) */}
      <div className="space-y-4">
      <div className="bg-white ring-1 ring-black/5 rounded-lg p-5 shadow-sm space-y-5">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-violet-50 text-violet-600 grid place-items-center ring-1 ring-violet-200 shrink-0"><Sparkles className="size-5" /></div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Open-ended AI answers</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Paste one API key from <strong>Gemini</strong>, <strong>ChatGPT</strong> or <strong>Claude</strong> — Smarty detects which one automatically and uses it for general questions (e.g. “what is photosynthesis?”).</p>
          </div>
        </div>

        {/* current status (shows WHICH AI is answering) */}
        <div className={`rounded-md px-4 py-3 ring-1 flex items-center gap-2.5 text-xs font-semibold ${
          configured && enabled ? 'bg-emerald-50 ring-emerald-200 text-emerald-700'
          : configured ? 'bg-amber-50 ring-amber-200 text-amber-700'
          : 'bg-zinc-50 ring-zinc-200 text-zinc-500'}`}>
          {configured && enabled ? <><CheckCircle2 className="size-4" /> AI is active — answering with {provName} ({cfg.masked})</>
            : configured ? <><KeyRound className="size-4" /> {provName} key saved ({cfg.masked}) — turn it on below</>
            : <><KeyRound className="size-4" /> No key yet — AI answers are off</>}
        </div>

        <Field label="API key (Gemini, ChatGPT or Claude)">
          <div className="relative">
            {/* text + -webkit-text-security masking (not a password field, so the
                browser never autofills it into the sidebar search). Eye reveals it. */}
            <input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              type="text"
              name="smarty-ai-key"
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
              data-lpignore="true" data-1p-ignore="true" data-form-type="other"
              placeholder="Paste any one AI key (AIza… / sk-… / sk-ant-…)"
              style={!show && apiKey ? { WebkitTextSecurity: 'disc' } : undefined}
              className={`${inp} pr-10`} />
            <button type="button" onClick={() => setShow(v => !v)} tabIndex={-1}
              title={show ? 'Hide key' : 'Show key'}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-1">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <Field label="Status">
          <button type="button" onClick={() => setEnabled(v => !v)}
            className={`h-9 w-full rounded-md text-xs font-semibold ring-1 inline-flex items-center justify-center gap-1.5 transition-colors ${
              enabled ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'}`}>
            {enabled ? <><Eye className="size-3.5" /> On — answering questions</> : <><EyeOff className="size-3.5" /> Off</>}
          </button>
        </Field>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving || !dirty}
            className="h-9 px-4 rounded-md bg-primary text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:bg-zinc-200 disabled:text-zinc-400">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </button>
          <button onClick={test} disabled={testing || !configured}
            className="h-9 px-4 rounded-md ring-1 ring-zinc-200 text-zinc-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-zinc-50 disabled:text-zinc-300 disabled:ring-zinc-100">
            {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Test
          </button>
          {saved && <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Saved</span>}
          {!dirty && !saved && configured && <span className="text-[11px] text-zinc-400 font-medium">No changes</span>}
        </div>

        {testMsg && (
          <div className={`rounded-md px-3 py-2.5 ring-1 text-[11px] leading-relaxed ${
            testMsg.ok ? 'bg-emerald-50 ring-emerald-200 text-emerald-800' : 'bg-red-50 ring-red-200 text-red-700'}`}>
            <span className="font-semibold">{testMsg.ok ? '✓ Working — ' : '✕ Failed — '}</span>{testMsg.text}
          </div>
        )}
        </div>

        {/* Where to get a key — moved here to fill the empty space under the form */}
        <div className="bg-white ring-1 ring-black/5 rounded-lg p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-zinc-800 mb-3 flex items-center gap-1.5"><KeyRound className="size-3.5 text-primary" /> Where to get a key</h4>
          <p className="text-[11px] text-zinc-600 leading-relaxed mb-3">Create a key with any <strong>one</strong> of these, copy it, paste it above, turn Status <strong>On</strong>, and Save:</p>
          <ul className="space-y-2">
            {[
              ['Google Gemini', 'https://aistudio.google.com/app/apikey', 'starts with AIza…'],
              ['ChatGPT (OpenAI)', 'https://platform.openai.com/api-keys', 'starts with sk-…'],
              ['Claude (Anthropic)', 'https://console.anthropic.com/settings/keys', 'starts with sk-ant-…']
            ].map(([name, url, hint]) => (
              <li key={name} className="flex items-center justify-between gap-2">
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline">
                  {name} <ExternalLink className="size-3" />
                </a>
                <span className="text-[10px] text-zinc-400 font-medium">{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* right: saved answers + textbooks + privacy */}
      <div className="space-y-4">

        {/* Saved answers — its own card, up top, so it's easy to find */}
        <div className="bg-white ring-1 ring-black/5 rounded-lg p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-zinc-800 mb-1 flex items-center gap-1.5"><Sparkles className="size-3.5 text-violet-500" /> Saved answers</h4>
          <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">
            To stay fast, Smarty saves the answers it has already worked out and reuses them. If one came out wrong, remove it here and Smarty will answer it fresh next time.
          </p>

          {/* Forget ONE answer */}
          <div className="rounded-md ring-1 ring-zinc-200 bg-zinc-50/60 p-3">
            <p className="text-[11px] font-semibold text-zinc-700">Forget one answer</p>
            <p className="text-[10px] text-zinc-500 leading-relaxed mt-0.5 mb-2">
              Type the <strong>exact</strong> question that got a wrong reply (for example <span className="font-semibold text-zinc-700">Sunlight?</span>). Only that one saved answer is removed — every other saved answer stays.
            </p>
            <div className="flex items-center gap-2">
              <input value={forgetQ} onChange={e => setForgetQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') forgetOne(); }}
                placeholder="e.g. Sunlight?"
                className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20" />
              <button onClick={forgetOne} disabled={cacheBusy || !forgetQ.trim()}
                className="h-8 px-4 rounded-md bg-primary text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400">
                {cacheBusy ? <Loader2 className="size-3.5 animate-spin" /> : 'Forget'}
              </button>
            </div>
          </div>

          {/* Clear ALL — danger zone, needs the checkbox ticked first */}
          <div className="mt-3 rounded-md ring-1 ring-red-200 bg-red-50/50 p-3">
            <p className="text-[11px] font-semibold text-red-700">Clear all saved answers</p>
            <p className="text-[10px] text-zinc-600 leading-relaxed mt-0.5">
              Deletes <strong>every</strong> saved answer for the whole school at once. Smarty keeps working — it just recomputes answers as questions come in, so replies are a little slower until they build up again. Your textbooks, API key and settings are <strong>not</strong> touched. This can’t be undone.
            </p>
            <label className="flex items-start gap-2 mt-2 cursor-pointer select-none">
              <input type="checkbox" checked={clearConfirm} onChange={e => setClearConfirm(e.target.checked)}
                className="mt-0.5 size-3.5 rounded border-zinc-300 text-red-600 focus:ring-red-500" />
              <span className="text-[10px] font-medium text-zinc-700 leading-relaxed">Yes, I really want to delete all the stored answers for this school.</span>
            </label>
            <button onClick={clearAll} disabled={cacheBusy || !clearConfirm}
              className="mt-2 h-8 px-4 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors bg-red-600 text-white hover:bg-red-700 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed">
              {cacheBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Clear all saved answers
            </button>
          </div>

          {cacheMsg && (
            <p className={`mt-3 text-[11px] font-medium ${cacheMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{cacheMsg.text}</p>
          )}
        </div>

        <div className="bg-white ring-1 ring-black/5 rounded-lg p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-zinc-800 mb-2 flex items-center gap-1.5"><BookOpen className="size-3.5 text-violet-500" /> Answer from your textbooks</h4>
          <p className="text-[11px] text-zinc-600 leading-relaxed mb-3">
            Smarty can answer from the books, keywords and Library files you upload in <strong>Syllabus</strong>, scoped to each student's class — <strong>with or without AI</strong>. After adding or changing material, rebuild the index so Smarty can read it. Scanned (image) textbooks are read with on-device OCR the first time, then cached.
            {ragChunks != null && <> Currently <strong>{ragChunks}</strong> passage{ragChunks === 1 ? '' : 's'} indexed.</>}
          </p>

          {/* OCR engine state (scanned books need it) */}
          {ragOcr === 'off' && (
            <div className="mb-3 rounded-md bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
              <strong>Scanned-book reading (OCR) is not installed.</strong> Text books still work. Best fix: add <code className="bg-amber-100 px-1 rounded">tesseract-ocr</code> + <code className="bg-amber-100 px-1 rounded">poppler-utils</code> on the server (fast, reliable). Then rebuild.
            </div>
          )}
          {ragOcr === 'on' && (
            <div className={`mb-3 rounded-md px-3 py-2 text-[11px] leading-relaxed ring-1 ${ragEngine === 'native' ? 'bg-emerald-50 ring-emerald-200 text-emerald-800' : 'bg-sky-50 ring-sky-200 text-sky-800'}`}>
              OCR engine: <strong>{ragEngine === 'native' ? 'Native Tesseract (fast & reliable)' : 'WASM fallback (slower — consider installing native Tesseract + poppler)'}</strong>.
              <button onClick={runOcrTest} disabled={ocrTesting}
                className="ml-2 underline font-semibold disabled:opacity-50">
                {ocrTesting ? 'Testing…' : 'Run OCR self-test'}
              </button>
            </div>
          )}
          {ocrTest && (
            <div className={`mb-3 rounded-md px-3 py-2 text-[11px] leading-relaxed ring-1 ${ocrTest.ok ? 'bg-emerald-50 ring-emerald-200 text-emerald-800' : 'bg-red-50 ring-red-200 text-red-700'}`}>
              {ocrTest.ok
                ? <><strong>✓ OCR is reading pages.</strong> Engine {ocrTest.engine}, {ocrTest.chars} chars from page 1 of “{ocrTest.title}” in {ocrTest.ms}ms.<br /><span className="text-emerald-700">Sample: “{ocrTest.sample}”</span></>
                : <><strong>✕ OCR check:</strong> {ocrTest.reason || ocrTest.note || ocrTest.error || 'could not read the page.'}</>}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => reindex(false)} disabled={reindexing}
              className="h-9 px-4 rounded-md ring-1 ring-zinc-200 text-zinc-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-zinc-50 disabled:text-zinc-300 disabled:ring-zinc-100">
              {reindexing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} {reindexing ? 'Rebuilding…' : 'Rebuild book index'}
            </button>
            {!reindexing && ragOcr === 'on' && (
              <button onClick={() => reindex(true)} title="Ignore the OCR cache and read every scanned page again"
                className="h-9 px-3 rounded-md ring-1 ring-zinc-200 text-zinc-500 text-[11px] font-semibold inline-flex items-center gap-1.5 hover:bg-zinc-50">
                Re-OCR from scratch
              </button>
            )}
          </div>

          {/* live progress while the background job runs */}
          {reindexing && ragJob && (
            <div className="mt-2 text-[11px] text-zinc-500 font-medium">
              {ragJob.phase === 'chapters' && <>Reading chapter {ragJob.chapter} of {ragJob.totalChapters}
                {ragJob.ocrPages > 0 && <> · OCR page {ragJob.ocrPage}/{ragJob.ocrPages}</>}…</>}
              {ragJob.phase === 'library' && <>Reading library files ({ragJob.files})
                {ragJob.ocrPages > 0 && <> · OCR page {ragJob.ocrPage}/{ragJob.ocrPages}</>}…</>}
              {(ragJob.phase === 'starting' || !ragJob.phase) && <>Starting…</>}
            </div>
          )}
          {ragMsg && <p className={`mt-2 text-[11px] font-medium ${ragMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{ragMsg.text}</p>}

          {/* Test what the book search returns for a question */}
          <div className="mt-3 pt-3 border-t border-zinc-100">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Test book search</p>
            <div className="flex items-center gap-2">
              <input value={ragQ} onChange={e => setRagQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') bookSearch(); }}
                placeholder="e.g. respiration versus combustion"
                className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20" />
              <button onClick={bookSearch} disabled={searching || !ragQ.trim()}
                className="h-8 px-3 rounded-md ring-1 ring-zinc-200 text-zinc-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-zinc-50 disabled:text-zinc-300">
                {searching ? <Loader2 className="size-3.5 animate-spin" /> : 'Search'}
              </button>
            </div>
            {ragHits != null && (
              ragHits.length === 0
                ? <p className="mt-2 text-[11px] text-red-600 font-medium">No book passages matched — the index is empty or doesn't contain this. Rebuild after uploading the book.</p>
                : <ul className="mt-2 space-y-1.5">
                    {ragHits.map((h, i) => (
                      <li key={i} className="text-[11px] text-zinc-600 bg-zinc-50 ring-1 ring-black/5 rounded px-2 py-1.5">
                        <span className="font-semibold text-zinc-800">{h.title}</span>
                        <span className="text-zinc-400"> · {h.source_type} · score {h.score}</span>
                        <div className="text-zinc-500 line-clamp-2 mt-0.5">{h.preview}…</div>
                      </li>
                    ))}
                  </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inp = 'h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40';
function Field({ label, children }) {
  return (<label className="block space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>{children}</label>);
}
function Pill({ children }) { return <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">{children}</span>; }