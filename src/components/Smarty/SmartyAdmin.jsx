import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { MODULES } from '../../Screens/Modules';
import {
  Bot, Plus, Trash2, Save, X, Megaphone, MessageSquareText, Loader2, Eye, EyeOff, Send,
  Sparkles, KeyRound, CheckCircle2, ShieldCheck, ExternalLink
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

// ------------------------------------------------------------------ Smarty AI (BYO key: Gemini / ChatGPT / Claude)
//  Each school pastes its OWN key from ANY of the three providers. It is
//  stored per institution in the database (never in the app code) and never
//  sent back to the browser — only a masked •••• preview. While no key is
//  saved + turned on, open-ended "ask me anything" answers stay OFF; the
//  built-in guided answers keep working regardless.
const AI_PROVIDERS = {
  gemini:    { label: 'Google Gemini',      short: 'Gemini',  keyName: 'Google AI Studio',  keyUrl: 'https://aistudio.google.com/app/apikey' },
  openai:    { label: 'ChatGPT (OpenAI)',   short: 'ChatGPT', keyName: 'OpenAI Platform',   keyUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Claude (Anthropic)', short: 'Claude',  keyName: 'Anthropic Console', keyUrl: 'https://console.anthropic.com/settings/keys' }
};

function AiSettingsTab({ instId }) {
  const [cfg, setCfg]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey]     = useState('');
  const [enabled, setEnabled]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const load = useCallback(async () => {
    if (!instId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/smarty/ai-config/${instId}`);
      const d = res.ok ? await res.json() : {};
      setCfg(d);
      setProvider(AI_PROVIDERS[d.provider] ? d.provider : 'gemini');
      setEnabled(!!d.enabled);
    } catch { setCfg({}); }
    setLoading(false);
  }, [instId]);
  useEffect(() => { load(); }, [load]);

  const changeProvider = (p) => setProvider(p);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const body = { provider, enabled };   // model is chosen on the server
      if (apiKey.trim()) body.api_key = apiKey.trim();   // only overwrite when a new key is typed
      const res = await fetch(`${API_BASE_URL}/smarty/ai-config`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setApiKey(''); setSaved(true); await load();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  if (loading) return <div className="h-40 grid place-items-center"><Loader2 className="animate-spin size-6 text-primary" /></div>;

  const configured = !!cfg?.configured;
  // The saved key belongs to the stored provider; show that name in the status.
  const savedProv = AI_PROVIDERS[cfg?.provider] ? cfg.provider : provider;
  const P = AI_PROVIDERS[provider];

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* left: the key form */}
      <div className="bg-white ring-1 ring-black/5 rounded-lg p-5 shadow-sm space-y-5 h-fit">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-violet-50 text-violet-600 grid place-items-center ring-1 ring-violet-200 shrink-0"><Sparkles className="size-5" /></div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Open-ended AI answers</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Bring your own key from any one provider to let Smarty answer general questions (e.g. “what is photosynthesis?”) beyond the built-in help.</p>
          </div>
        </div>

        {/* current status */}
        <div className={`rounded-md px-4 py-3 ring-1 flex items-center gap-2.5 text-xs font-semibold ${
          configured && enabled ? 'bg-emerald-50 ring-emerald-200 text-emerald-700'
          : configured ? 'bg-amber-50 ring-amber-200 text-amber-700'
          : 'bg-zinc-50 ring-zinc-200 text-zinc-500'}`}>
          {configured && enabled ? <><CheckCircle2 className="size-4" /> AI is active — {AI_PROVIDERS[savedProv].short} key saved ({cfg.masked})</>
            : configured ? <><KeyRound className="size-4" /> {AI_PROVIDERS[savedProv].short} key saved ({cfg.masked}) — turn it on below</>
            : <><KeyRound className="size-4" /> No key yet — AI answers are off</>}
        </div>

        {/* provider picker */}
        <Field label="AI provider">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(AI_PROVIDERS).map(([id, p]) => (
              <button key={id} type="button" onClick={() => changeProvider(id)}
                className={`h-9 rounded-md text-[11px] font-semibold ring-1 transition-colors ${
                  provider === id ? 'bg-primary text-white ring-primary' : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'}`}>
                {p.short}
              </button>
            ))}
          </div>
        </Field>

        <Field label={configured ? `Replace ${P.short} API key (blank = keep current)` : `${P.label} API key`}>
          {/* NOT type="password": a real password field makes the browser's
              password manager autofill the saved username into the sidebar's
              search box (emptying the menu). This is a normal field the
              manager ignores, masked via -webkit-text-security while typing. */}
          <input
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            type="text"
            name="smarty-ai-key"
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            data-lpignore="true" data-1p-ignore="true" data-form-type="other"
            placeholder={configured ? '•••• keep current ••••' : `Paste your ${P.short} key`}
            style={apiKey ? { WebkitTextSecurity: 'disc' } : undefined}
            className={inp} />
        </Field>

        <Field label="Status">
          <button type="button" onClick={() => setEnabled(v => !v)}
            className={`h-9 w-full rounded-md text-xs font-semibold ring-1 inline-flex items-center justify-center gap-1.5 transition-colors ${
              enabled ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'}`}>
            {enabled ? <><Eye className="size-3.5" /> On — answering questions</> : <><EyeOff className="size-3.5" /> Off</>}
          </button>
        </Field>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="h-9 px-4 rounded-md bg-primary text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:bg-zinc-300">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </button>
          {saved && <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Saved</span>}
        </div>
      </div>

      {/* right: how it works + privacy */}
      <div className="space-y-4">
        <div className="bg-white ring-1 ring-black/5 rounded-lg p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-zinc-800 mb-3 flex items-center gap-1.5"><KeyRound className="size-3.5 text-primary" /> Getting a {P.short} key</h4>
          <ol className="text-[11px] text-zinc-600 leading-relaxed space-y-1.5 list-decimal pl-4">
            <li>Open <strong>{P.keyName}</strong> and sign in with the school's account.</li>
            <li>Create an API key and copy it.</li>
            <li>Pick <strong>{P.short}</strong> above, paste the key, turn Status <strong>On</strong>, and Save.</li>
          </ol>
          <a href={P.keyUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline">
            Get a {P.short} key <ExternalLink className="size-3" />
          </a>
        </div>

        <div className="bg-white ring-1 ring-black/5 rounded-lg p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-zinc-800 mb-3 flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-emerald-600" /> How we keep it safe</h4>
          <ul className="text-[11px] text-zinc-600 leading-relaxed space-y-1.5 list-disc pl-4">
            <li>Only one provider is active at a time — the key you save is the one Smarty uses.</li>
            <li>The key is stored only on your school's server record — never in the app code, never shown in full again.</li>
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