import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BellRing, Zap, Send, Plus, Trash2, Save, Info, ChevronDown, GraduationCap, Users, Clock } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';

const AUTO_DEFAULT   = 'Dear Parent, the school fee for {class} is due on {due_date}. Kindly pay before the due date to avoid a late reminder.';
const MANUAL_DEFAULT = 'Dear Parent, this is a reminder regarding the pending school fee. Kindly clear the balance at the earliest.';

const TRIGGERS = [
  { v: 'before_due', l: 'Before due date' },
  { v: 'on_due',     l: 'On the due date' },
  { v: 'after_due',  l: 'After due date' },
];

export default function Alerts({ data, user, canEdit = true }) {
  const classes = data.classes || [];
  const students = data.students || [];
  const [sub, setSub] = useState('auto');

  const [rules, setRules] = useState([]);
  const [log, setLog]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/alerts/config/${user.institutionId}`);
      const json = await res.json();
      setRules(json?.rules || []);
      setLog(json?.log || []);
    } catch (e) {
      console.error('Alerts config fetch error:', e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const classLabel = (cid) => {
    if (cid == null || cid === '') return 'All classes';
    const c = classes.find(c => String(c.id) === String(cid));
    return c ? `${c.className}${c.section ? ` - ${c.section}` : ''}` : `Class ${cid}`;
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="inline-flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
        <button onClick={() => setSub('auto')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${sub === 'auto' ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
          <Zap className="size-3.5" /> Auto
        </button>
        <button onClick={() => setSub('manual')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${sub === 'manual' ? 'bg-white text-primary shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
          <Send className="size-3.5" /> Manual
        </button>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="size-7 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : sub === 'auto' ? (
        <AutoTab user={user} classes={classes} rules={rules} reload={load} canEdit={canEdit}
                 academic_year_id={data.academic_year_id} classLabel={classLabel} />
      ) : (
        <ManualTab user={user} classes={classes} students={students} log={log} reload={load} canEdit={canEdit}
                   academic_year_id={data.academic_year_id} classLabel={classLabel} />
      )}
    </div>
  );
}

// =================================================================
//  AUTO
// =================================================================
function AutoTab({ user, classes, rules, reload, canEdit, academic_year_id, classLabel }) {
  const blank = { id: null, class_id: '', trigger_type: 'before_due', days_offset: 3, message: AUTO_DEFAULT, is_active: true };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const edit = (r) => setForm({
    id: r.id, class_id: r.class_id ?? '', trigger_type: r.trigger_type,
    days_offset: r.days_offset ?? 0, message: r.message || '', is_active: !!r.is_active
  });

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/alerts/auto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id, institutionId: user.institutionId, academic_year_id: academic_year_id ?? null,
          class_id: form.class_id === '' ? null : Number(form.class_id),
          trigger_type: form.trigger_type, days_offset: Number(form.days_offset) || 0,
          message: form.message, is_active: form.is_active,
          userId: user?.id ?? null, userName: user?.name ?? null
        })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed to save rule.'); }
      else { setForm(blank); await reload(); }
    } finally { setSaving(false); }
  };

  const toggle = async (r) => {
    if (!canEdit) return;
    setBusyId(r.id);
    try {
      await fetch(`${API_BASE_URL}/fees/alerts/auto/toggle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, institutionId: user.institutionId, is_active: !r.is_active })
      });
      await reload();
    } finally { setBusyId(null); }
  };

  const remove = async (r) => {
    if (!canEdit) return;
    if (!window.confirm('Delete this auto alert rule?')) return;
    setBusyId(r.id);
    try {
      await fetch(`${API_BASE_URL}/fees/alerts/auto/${r.id}`, { method: 'DELETE' });
      if (form.id === r.id) setForm(blank);
      await reload();
    } finally { setBusyId(null); }
  };

  const describe = (r) => {
    if (r.trigger_type === 'on_due') return 'On the due date';
    const d = r.days_offset || 0;
    return `${d} day${d === 1 ? '' : 's'} ${r.trigger_type === 'before_due' ? 'before' : 'after'} due date`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50/60 border border-blue-100 rounded-md p-4 flex gap-3 text-[11px] text-blue-800 leading-relaxed">
        <Info className="size-4 shrink-0 text-blue-500 mt-0.5" />
        <p>
          Auto alerts fire on their own based on each fee's due date. Set a rule (e.g. <em>3 days before due date</em>) for
          <strong> all classes</strong> or one class. Use tokens <code className="bg-white/60 px-1 rounded">{'{class}'}</code>,
          <code className="bg-white/60 px-1 rounded">{'{amount}'}</code>, <code className="bg-white/60 px-1 rounded">{'{due_date}'}</code>,
          <code className="bg-white/60 px-1 rounded">{'{student}'}</code> in the message.
        </p>
      </div>

      {/* Rule editor */}
      {canEdit && (
        <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Zap className="size-4 text-primary" /> {form.id ? 'Edit Rule' : 'New Auto Rule'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <LabeledSelect label="Applies to" value={String(form.class_id)} onChange={v => set('class_id', v)}
              options={[{ v: '', l: 'All classes' }, ...classes.map(c => ({ v: String(c.id), l: `${c.className}${c.section ? ` - ${c.section}` : ''}` }))]} />
            <LabeledSelect label="When" value={form.trigger_type} onChange={v => set('trigger_type', v)}
              options={TRIGGERS.map(t => ({ v: t.v, l: t.l }))} />
            {form.trigger_type !== 'on_due' && (
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-600 mb-1.5">Days {form.trigger_type === 'before_due' ? 'before' : 'after'}</label>
                <input type="number" min="0" value={form.days_offset}
                  onChange={e => set('days_offset', e.target.value)}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 h-9 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40" />
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-zinc-600 mb-1.5">Message</label>
            <textarea rows={3} value={form.message} onChange={e => set('message', e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none" />
          </div>
          <div className="flex items-center justify-between">
            <Toggle checked={form.is_active} onChange={v => set('is_active', v)} label="Active" />
            <div className="flex items-center gap-2">
              {form.id && (
                <button onClick={() => setForm(blank)}
                  className="text-zinc-600 px-3 py-2 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-50">Cancel</button>
              )}
              <button onClick={save} disabled={saving}
                className="bg-primary text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-60">
                {form.id ? <Save className="size-3.5" /> : <Plus className="size-3.5" />} {saving ? 'Saving…' : form.id ? 'Update Rule' : 'Add Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-900">Rules <span className="text-zinc-400 font-normal">({rules.length})</span></h3>
        </div>
        <div className="divide-y divide-zinc-100">
          {rules.length > 0 ? rules.map(r => (
            <div key={r.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary ring-1 ring-primary/20">
                    <GraduationCap className="size-3" /> {classLabel(r.class_id)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600">
                    <Clock className="size-3 text-zinc-400" /> {describe(r)}
                  </span>
                  {!r.is_active && <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Paused</span>}
                </div>
                {r.message && <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2 max-w-xl">{r.message}</p>}
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <Toggle checked={!!r.is_active} disabled={busyId === r.id} onChange={() => toggle(r)} />
                  <button onClick={() => edit(r)} className="p-1.5 text-zinc-400 hover:text-primary rounded transition-colors"><Save className="size-4" /></button>
                  <button onClick={() => remove(r)} disabled={busyId === r.id} className="p-1.5 text-zinc-400 hover:text-accent rounded transition-colors"><Trash2 className="size-4" /></button>
                </div>
              )}
            </div>
          )) : (
            <p className="px-5 py-8 text-center text-xs text-zinc-500 italic">No auto rules yet. Add one above.</p>
          )}
        </div>
      </div>

      <p className="text-[11px] text-zinc-400">
        Auto rules are evaluated by a scheduled daily job that hits <code className="bg-zinc-100 px-1 rounded">POST /api/fees/alerts/run</code>.
      </p>
    </div>
  );
}

// =================================================================
//  MANUAL
// =================================================================
function ManualTab({ user, classes, students, log, reload, canEdit, academic_year_id, classLabel }) {
  const [classId, setClassId] = useState('');   // '' = all classes
  const [message, setMessage] = useState(MANUAL_DEFAULT);
  const [sending, setSending] = useState(false);

  const recipients = useMemo(() => {
    if (classId === '') return students.length;
    return students.filter(s => String(s.class_id) === String(classId)).length;
  }, [students, classId]);

  const send = async () => {
    if (!canEdit) return;
    if (!message.trim()) return alert('Please enter a message.');
    if (recipients === 0) return alert('No students in the selected scope.');
    if (!window.confirm(`Send this alert to ${recipients} student(s)?`)) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fees/alerts/manual/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: user.institutionId, academic_year_id: academic_year_id ?? null,
          class_id: classId === '' ? null : Number(classId), message,
          userId: user?.id ?? null, userName: user?.name ?? null
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) alert(j.error || 'Failed to send alert.');
      else { alert(`Alert sent to ${j.recipient_count ?? recipients} student(s).`); await reload(); }
    } finally { setSending(false); }
  };

  const fmtDate = (v) => {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50/60 border border-blue-100 rounded-md p-4 flex gap-3 text-[11px] text-blue-800 leading-relaxed">
        <Info className="size-4 shrink-0 text-blue-500 mt-0.5" />
        <p>Send a fee reminder right now to <strong>all classes</strong> or a specific class. Same idea as an auto alert, but you control exactly when it goes out.</p>
      </div>

      <div className="ring-1 ring-black/5 rounded-lg bg-white p-5 sm:p-6 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2"><Send className="size-4 text-primary" /> Send Manual Alert</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LabeledSelect label="Filter" value={classId} onChange={setClassId}
            options={[{ v: '', l: 'All classes' }, ...classes.map(c => ({ v: String(c.id), l: `${c.className}${c.section ? ` - ${c.section}` : ''}` }))]} />
          <div className="flex flex-col justify-end">
            <div className="inline-flex items-center gap-2 text-xs text-zinc-600 bg-zinc-50 ring-1 ring-black/5 rounded-md px-3 h-9">
              <Users className="size-4 text-primary" />
              Recipients: <strong className="text-zinc-900 tabular-nums">{recipients}</strong>
              <span className="text-zinc-400">· {classLabel(classId)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-zinc-600 mb-1.5">Message</label>
          <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} disabled={!canEdit}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none disabled:bg-zinc-50 disabled:text-zinc-400" />
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <button onClick={send} disabled={sending || recipients === 0}
              className="bg-primary text-white px-5 py-2 rounded-md text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50">
              <Send className="size-3.5" /> {sending ? 'Sending…' : `Send to ${recipients}`}
            </button>
          </div>
        )}
      </div>

      {/* Recent sends */}
      <div className="ring-1 ring-black/5 rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-900">Recent Alerts</h3>
        </div>
        <div className="divide-y divide-zinc-100">
          {log.length > 0 ? log.map(l => (
            <div key={l.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ring-1 ${l.alert_type === 'auto' ? 'bg-primary/10 text-primary ring-primary/20' : 'bg-accent/10 text-accent ring-accent/20'}`}>
                    {l.alert_type === 'auto' ? <Zap className="size-3" /> : <Send className="size-3" />} {l.alert_type}
                  </span>
                  <span className="text-[11px] font-medium text-zinc-600">{classLabel(l.class_id)}</span>
                  <span className="text-[11px] text-zinc-400">· {l.recipient_count} recipient{l.recipient_count === 1 ? '' : 's'}</span>
                </div>
                {l.message && <p className="text-[11px] text-zinc-500 mt-1 line-clamp-1 max-w-xl">{l.message}</p>}
              </div>
              <span className="text-[11px] text-zinc-400 shrink-0">{fmtDate(l.created_at)}</span>
            </div>
          )) : (
            <p className="px-5 py-8 text-center text-xs text-zinc-500 italic">No alerts sent yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- shared bits ----
function LabeledSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium text-zinc-600 mb-1.5">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="h-9 w-full appearance-none rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer">
          {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}
function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      className="inline-flex items-center gap-2 disabled:opacity-60">
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-zinc-300'}`}>
        <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      {label && <span className="text-xs font-medium text-zinc-600">{label}</span>}
    </button>
  );
}