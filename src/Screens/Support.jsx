import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';
import { MODULES } from './Modules';
import {
  LifeBuoy, Plus, X, Send, Image as ImageIcon, Loader2, ArrowLeft,
  MessageSquare, CheckCircle2, RefreshCw, ShieldCheck, RotateCcw, Info, ChevronDown, Clock
} from 'lucide-react';

// =====================================================================
//  Support — a school's window to the SmartEdz developers.
// =====================================================================

const asUtcIso = (v) => {
  if (!v) return null;
  const s = String(v).replace(' ', 'T');
  return /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z';
};
const fmtWhen = (v) => {
  const iso = asUtcIso(v);
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
  });
};
// Relative "opened 2h ago" from a timestamp.
const ago = (v) => {
  const iso = asUtcIso(v);
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m ago` : `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const STATUS = {
  open:     { label: 'Waiting',     cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  assigned: { label: 'Assigned',    cls: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' },
  active:   { label: 'In progress', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  closed:   { label: 'Closed',      cls: 'bg-zinc-100 text-zinc-600 ring-black/5' }
};
const statusOf = (s) => STATUS[s] || STATUS.open;

// Friendly module label (e.g. "Fee Management" not "FeeManagement").
const moduleLabelOf = (name) => (MODULES.find(m => m.module_name === name)?.label) || name || 'General';

const MODULE_OPTIONS = [
  ...MODULES
    .filter(m => !m.hideFromSidebar && !m.alwaysVisible && m.module_name !== 'Support')
    .map(m => ({ value: m.module_name, label: m.label })),
  { value: 'General', label: 'General / Something else' }
];

export default function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/support/tickets`);
      const d = await res.json();
      setTickets(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);
  // Light polling so status changes (assigned / closed) show up.
  useEffect(() => { const iv = setInterval(loadTickets, 15000); return () => clearInterval(iv); }, [loadTickets]);

  if (openId) {
    return <TicketChat ticketId={openId} me={user} onBack={() => { setOpenId(null); loadTickets(); }} />;
  }

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <LifeBuoy className="text-primary size-5" /> Support
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[60ch]">
            Raise a ticket and chat with the SmartEdz team about any part of the app.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={loadTickets} title="Refresh"
            className="h-9 px-3 bg-white border border-zinc-200 text-zinc-600 hover:text-primary hover:bg-zinc-50 rounded-md flex items-center justify-center transition-colors shadow-sm">
            <RefreshCw className="size-4" />
          </button>
          <button onClick={() => setShowNew(true)}
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors">
            <Plus className="size-3.5" /> New Ticket
          </button>
        </div>
      </header>

      <div className="rounded-md bg-blue-50/60 ring-1 ring-inset ring-blue-500/15 px-4 py-3 flex items-start gap-2.5">
        <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-800 leading-relaxed">
          Pick the module your issue is about, describe it (add a screenshot if it helps), and send. Your ticket goes to the
          SmartEdz team, who assign a developer to chat it through with you. You can reopen a closed ticket any time.
        </p>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
      ) : tickets.length === 0 ? (
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <MessageSquare className="size-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No tickets yet.</p>
          <p className="text-zinc-400 text-xs mt-1">Raise one and the SmartEdz team will get back to you here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm divide-y divide-zinc-100 overflow-hidden">
          {tickets.map(t => {
            const st = statusOf(t.status);
            return (
              <button key={t.id} onClick={() => setOpenId(t.id)}
                className="w-full text-left px-5 py-4 hover:bg-zinc-50/60 transition-colors flex items-center gap-4">
                <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <MessageSquare className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 truncate">{t.subject || moduleLabelOf(t.module)}</span>
                    <span className="text-[10px] font-medium text-zinc-400">#{t.id}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                    <span className="font-medium text-zinc-600">{moduleLabelOf(t.module)}</span>
                    {t.assigned_name && <span> · with {t.assigned_name}</span>}
                    {t.last_activity_at && <span> · {ago(t.last_activity_at)}</span>}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset shrink-0 ${st.cls}`}>
                  {st.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewTicketModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); loadTickets(); if (id) setOpenId(id); }} />
      )}
    </div>
  );
}

function NewTicketModal({ onClose, onCreated }) {
  const [module, setModule] = useState(MODULE_OPTIONS[0]?.value || 'General');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState('');
  const [saving, setSaving] = useState(false);

  const onPic = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return alert('Image must be under 3 MB.');
    const r = new FileReader();
    r.onloadend = () => setImage(r.result);
    r.readAsDataURL(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!module) return alert('Pick the module your issue is about.');
    if (!body.trim() && !image) return alert('Describe the problem or attach an image.');
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/support/tickets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, subject: subject.trim(), body: body.trim(), image: image || null })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not create ticket.');
      onCreated(d.id);
    } catch (e2) { alert(e2.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg shadow-xl flex flex-col max-h-[92vh]">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg">
          <h2 className="font-semibold text-lg text-zinc-900 tracking-tight">New Support Ticket</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1.5 hover:bg-zinc-100 rounded-md"><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Which module? <span className="text-red-500">*</span></label>
              <div className="relative">
                <select value={module} onChange={e => setModule(e.target.value)}
                  className="h-9 w-full bg-white border border-zinc-200 rounded-md pl-3 pr-8 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 appearance-none shadow-sm transition-colors cursor-pointer">
                  {MODULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Short summary (optional)"
                className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Describe the problem <span className="text-red-500">*</span></label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="What went wrong? What did you expect to happen?"
                className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors resize-none" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Screenshot (optional)</label>
              {image ? (
                <div className="relative inline-block">
                  <img src={image} alt="attachment" className="max-h-40 rounded-md ring-1 ring-black/5" />
                  <button type="button" onClick={() => setImage('')}
                    className="absolute -top-2 -right-2 size-6 bg-white ring-1 ring-black/10 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-600 shadow-sm">
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer inline-flex items-center gap-1.5 text-zinc-700 px-3 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50 transition-colors">
                  <ImageIcon className="size-3.5" /> Attach image
                  <input type="file" accept="image/*" onChange={onPic} className="hidden" />
                </label>
              )}
            </div>
          </div>
          <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg">
            <button type="button" onClick={onClose} disabled={saving}
              className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors">
              {saving && <Loader2 className="size-3.5 animate-spin" />} {saving ? 'Sending...' : 'Raise Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TicketChat({ ticketId, me, onBack }) {
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [sending, setSending] = useState(false);
  const [reopening, setReopening] = useState(false);
  const scrollRef = useRef(null);

  const loadAll = useCallback(async (scroll = false) => {
    try {
      const [tRes, mRes] = await Promise.all([
        fetch(`${API_BASE_URL}/support/tickets/${ticketId}`),
        fetch(`${API_BASE_URL}/support/tickets/${ticketId}/messages`)
      ]);
      const t = await tRes.json();
      const m = await mRes.json();
      if (tRes.ok) setTicket(t);
      if (mRes.ok) setMessages(Array.isArray(m) ? m : []);
      if (scroll) setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 60);
    } catch (e) { console.error(e); }
  }, [ticketId]);

  useEffect(() => { loadAll(true); }, [loadAll]);
  useEffect(() => { const iv = setInterval(() => loadAll(false), 4000); return () => clearInterval(iv); }, [loadAll]);

  const closed = ticket?.status === 'closed';
  const st = statusOf(ticket?.status);

  const onPic = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return alert('Image must be under 3 MB.');
    const r = new FileReader();
    r.onloadend = () => setImage(r.result);
    r.readAsDataURL(f);
  };

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() && !image) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text.trim(), image: image || null })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not send.');
      setText(''); setImage('');
      await loadAll(true);
    } catch (e2) { alert(e2.message); }
    setSending(false);
  };

  const reopen = async () => {
    setReopening(true);
    try {
      const res = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/reopen`, { method: 'POST' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Could not reopen.'); }
      await loadAll(false);
    } catch (e2) { alert(e2.message); }
    setReopening(false);
  };

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 flex flex-col h-full min-h-0 animate-in fade-in duration-300">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors mb-4 w-fit">
        <ArrowLeft className="size-4" /> Back to tickets
      </button>

      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 truncate">{ticket?.subject || moduleLabelOf(ticket?.module)}</h2>
              <span className="text-[10px] font-medium text-zinc-400">#{ticketId}</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-zinc-600">{moduleLabelOf(ticket?.module)}</span>
              {ticket?.assigned_developer?.name && <span>· with {ticket.assigned_developer.name}</span>}
              {ticket?.created_at && <span className="inline-flex items-center gap-1"><Clock className="size-3" /> opened {ago(ticket.created_at)}</span>}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset shrink-0 ${st.cls}`}>{st.label}</span>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-3 bg-zinc-50/40">
          {messages.length === 0 && (<p className="text-center text-xs text-zinc-400 italic py-8">No messages yet.</p>)}
          {messages.map(m => {
            if (m.sender_side === 'system') {
              return (
                <div key={m.id} className="flex justify-center">
                  <span className="text-[10px] text-zinc-500 bg-zinc-100 rounded-full px-3 py-1 ring-1 ring-inset ring-black/5 text-center">
                    {m.body} · {fmtWhen(m.created_at)}
                  </span>
                </div>
              );
            }
            const mine = String(m.sender_id) === String(me?.id) && m.sender_side === 'school';
            const isDev = m.sender_side === 'developer';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ring-1 ${mine ? 'bg-primary text-white ring-primary/20' : 'bg-white text-zinc-800 ring-black/5'}`}>
                  {!mine && (
                    <div className={`text-[10px] font-semibold mb-0.5 flex items-center gap-1 ${isDev ? 'text-primary' : 'text-zinc-500'}`}>
                      {isDev && <ShieldCheck className="size-3" />}{m.sender_name || (isDev ? 'SmartEdz' : 'You')}
                    </div>
                  )}
                  {m.image && <img src={m.image} alt="attachment" className="rounded-md mb-1.5 max-h-56 ring-1 ring-black/10" />}
                  {m.body && <p className="whitespace-pre-wrap leading-relaxed break-words">{m.body}</p>}
                  <div className={`text-[9px] mt-1 ${mine ? 'text-white/70' : 'text-zinc-400'}`}>{fmtWhen(m.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {closed ? (
          <div className="p-4 border-t border-zinc-100 bg-zinc-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <CheckCircle2 className="size-4 text-emerald-500" /> This ticket is closed.
            </span>
            <button onClick={reopen} disabled={reopening}
              className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 flex items-center gap-1.5 transition-colors">
              {reopening ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Reopen ticket
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="p-3 border-t border-zinc-100 bg-white shrink-0">
            {image && (
              <div className="relative inline-block mb-2">
                <img src={image} alt="attachment" className="max-h-24 rounded-md ring-1 ring-black/5" />
                <button type="button" onClick={() => setImage('')}
                  className="absolute -top-2 -right-2 size-5 bg-white ring-1 ring-black/10 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-600 shadow-sm">
                  <X className="size-3" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <label className="size-9 shrink-0 rounded-md border border-zinc-200 bg-white flex items-center justify-center text-zinc-500 hover:text-primary hover:bg-zinc-50 cursor-pointer transition-colors" title="Attach image">
                <ImageIcon className="size-4" />
                <input type="file" accept="image/*" onChange={onPic} className="hidden" />
              </label>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={1}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }}
                placeholder="Type a message..."
                className="flex-1 resize-none bg-white border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors max-h-32" />
              <button type="submit" disabled={sending || (!text.trim() && !image)}
                className="size-9 shrink-0 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 text-white rounded-md flex items-center justify-center shadow-sm transition-colors">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}