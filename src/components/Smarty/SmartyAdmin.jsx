import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { MODULES } from '../../Screens/Modules';
import {
  Bot, Plus, Trash2, Save, X, Megaphone, MessageSquareText, Loader2, Eye, EyeOff, Send,
  Sparkles, KeyRound, CheckCircle2, ShieldCheck, ExternalLink, RefreshCw, BookOpen
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

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center ring-1 ring-primary/20"><Bot className="size-5" /></div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Smarty Assistant</h1>
          <p className="text-sm text-zinc-500">Add your own questions and post app updates. Built-in help works without any setup.</p>
        </div>
      </header>

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
  const [ragChunks, setRagChunks]   = useState(null);
  const [reindexing, setReindexing] = useState(false);
  const [ragMsg, setRagMsg]         = useState(null);
  const loadRag = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/rag/status`);
      const d = await res.json().catch(() => ({}));
      if (d && d.ok) setRagChunks(d.chunks);
    } catch (_) {}
  }, []);
  useEffect(() => { loadRag(); }, [loadRag]);
  const reindex = async () => {
    setReindexing(true); setRagMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/rag/reindex`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
      const d = await res.json().catch(() => ({}));
      if (d && d.ok) {
        setRagChunks(d.chunks);
        setRagMsg({ ok: true, text: `Indexed ${d.chunks} passages from ${d.chapters} chapter(s) and ${d.files} library file(s).` });
      } else if (d && d.reason === 'busy') {
        setRagMsg({ ok: false, text: 'A rebuild is already running — try again in a moment.' });
      } else {
        setRagMsg({ ok: false, text: (d && d.error) || 'Rebuild failed.' });
      }
    } catch (e) { setRagMsg({ ok: false, text: e.message }); }
    setReindexing(false);
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

  if (loading) return <div className="h-40 grid place-items-center"><Loader2 className="animate-spin size-6 text-primary" /></div>;

  const configured = !!cfg?.configured;
  const provName = AI_PROVIDER_NAME[cfg?.provider] || 'AI';

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* left: the single key form */}
      <div className="bg-white ring-1 ring-black/5 rounded-lg p-5 shadow-sm space-y-5 h-fit">
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

      {/* right: where to get a key + privacy */}
      <div className="space-y-4">
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

        <div className="bg-white ring-1 ring-black/5 rounded-lg p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-zinc-800 mb-2 flex items-center gap-1.5"><BookOpen className="size-3.5 text-violet-500" /> Answer from your textbooks</h4>
          <p className="text-[11px] text-zinc-600 leading-relaxed mb-3">
            Smarty can answer from the books, keywords and Library files you upload in <strong>Syllabus</strong>, scoped to each student's class. After adding or changing material, rebuild the index so Smarty can read it.
            {ragChunks != null && <> Currently <strong>{ragChunks}</strong> passage{ragChunks === 1 ? '' : 's'} indexed.</>}
          </p>
          <button onClick={reindex} disabled={reindexing}
            className="h-9 px-4 rounded-md ring-1 ring-zinc-200 text-zinc-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-zinc-50 disabled:text-zinc-300 disabled:ring-zinc-100">
            {reindexing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} {reindexing ? 'Rebuilding…' : 'Rebuild book index'}
          </button>
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

        <div className="bg-white ring-1 ring-black/5 rounded-lg p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-zinc-800 mb-3 flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-emerald-600" /> How we keep it safe</h4>
          <ul className="text-[11px] text-zinc-600 leading-relaxed space-y-1.5 list-disc pl-4">
            <li>One key, one AI — Smarty detects the provider from the key and uses only that one.</li>
            <li>The key is stored on your school's server record (not in the app code). Only the Super Admin here can view it — students and teachers never can.</li>
            <li>Smarty answers common questions from its built-in help first (free, instant); the key is used only when a question needs it.</li>
            <li>General answers are cached so the same question doesn't call the API twice. Answers about a student's own data are never cached or shared.</li>
          </ul>
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