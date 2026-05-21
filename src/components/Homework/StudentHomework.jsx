import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Loader2, Upload, FileText, Eye, Trash2, Edit, Paperclip,
  CheckCircle2, Clock, XCircle, BookOpen, X, ClipboardList, Send
} from 'lucide-react';
import { fmtDate, fileToBase64, openFile, statusStyle } from './HwUtils';

// =====================================================================
//  StudentHomework — list of assigned homework + detail panel.
//   • PDF type     → upload files (base64)
//   • Written type → in-app text answer screen
//  Students can delete their submission until it's graded.
// =====================================================================

export default function StudentHomework() {
  const { user } = useAuth();

  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selectedId, setSelId]  = useState(null);
  const [filter, setFilter]     = useState('All');
  const [busy, setBusy]         = useState(null);   // homework id being acted on
  const [writingFor, setWriting] = useState(null);  // homework obj for written screen

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/homework/student/${user.id}`);
      const d = await res.json();
      const list = Array.isArray(d) ? d : [];
      // Pending first, then by due date desc
      list.sort((a, b) => {
        if (a.status === 'Pending' && b.status !== 'Pending') return -1;
        if (a.status !== 'Pending' && b.status === 'Pending') return 1;
        return new Date(b.due_date) - new Date(a.due_date);
      });
      setItems(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (items.length > 0 && !selectedId) setSelId(items[0].id);
  }, [items, selectedId]);

  const filtered = useMemo(() => {
    if (filter === 'All') return items;
    if (filter === 'Pending') return items.filter(i => !i.submission_id);
    return items.filter(i => i.submission_id);   // Completed
  }, [items, filter]);

  const selected = useMemo(
    () => items.find(i => i.id === selectedId) || null,
    [items, selectedId]
  );

  // --- PDF / file submission -------------------------------------
  const submitFiles = async (homeworkId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const fileList = Array.from(e.target.files || []);
      if (fileList.length === 0) return;
      setBusy(homeworkId);
      try {
        const files = [];
        for (const f of fileList) files.push(await fileToBase64(f, 5));
        const res = await fetch(`${API_BASE_URL}/admin/homework/${homeworkId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: user.id, files })
        });
        if (!res.ok) throw new Error('Submission failed');
        await load();
      } catch (err) { alert(err.message); }
      setBusy(null);
    };
    input.click();
  };

  // --- Written answer submission ---------------------------------
  const submitWritten = async (homeworkId, answer) => {
    setBusy(homeworkId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/homework/${homeworkId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id, written_answer: answer })
      });
      if (!res.ok) throw new Error('Submission failed');
      setWriting(null);
      await load();
    } catch (err) { alert(err.message); }
    setBusy(null);
  };

  // --- Delete own submission -------------------------------------
  const deleteSubmission = async (submissionId, homeworkId) => {
    if (!window.confirm('Delete your submission? This cannot be undone.')) return;
    setBusy(homeworkId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/homework/submission/${submissionId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Could not delete');
      await load();
    } catch (err) { alert(err.message); }
    setBusy(null);
  };

  if (loading) {
    return <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ClipboardList className="text-blue-600" size={28} />
          My Homework
        </h2>
        <p className="text-slate-500 font-medium mt-1">View and submit your class assignments.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List panel */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="flex gap-2">
              {['All', 'Pending', 'Completed'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    filter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <p className="p-8 text-center text-slate-400 text-sm italic">No assignments here.</p>
            ) : filtered.map(it => {
              const overdue = !it.submission_id && new Date(it.due_date) < new Date();
              const s = statusStyle(overdue ? 'Overdue' : it.status);
              return (
                <button key={it.id} onClick={() => setSelId(it.id)}
                  className={`w-full text-left p-4 transition-colors ${
                    selectedId === it.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`font-bold truncate ${selectedId === it.id ? 'text-blue-700' : 'text-slate-700'}`}>
                        {it.title}
                      </p>
                      <p className={`text-xs mt-0.5 ${overdue ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                        Due {fmtDate(it.due_date)}
                      </p>
                    </div>
                    <span className={`shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 ${s.dot}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {selected ? (
            <AssignmentDetail
              hw={selected}
              busy={busy === selected.id}
              onSubmitFiles={() => submitFiles(selected.id)}
              onWrite={() => setWriting(selected)}
              onDelete={() => deleteSubmission(selected.submission_id, selected.id)} />
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-16 text-center">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No homework selected.</p>
            </div>
          )}
        </div>
      </div>

      {/* Written answer full-screen */}
      {writingFor && (
        <WrittenAnswerScreen
          hw={writingFor}
          submitting={busy === writingFor.id}
          onSubmit={(answer) => submitWritten(writingFor.id, answer)}
          onCancel={() => setWriting(null)} />
      )}
    </div>
  );
}


// =====================================================================
//  Detail panel for one homework
// =====================================================================
function AssignmentDetail({ hw, busy, onSubmitFiles, onWrite, onDelete }) {
  const overdue = !hw.submission_id && new Date(hw.due_date) < new Date();
  const statusText = hw.submission_id ? hw.status : (overdue ? 'Overdue' : 'Pending');
  const s = statusStyle(statusText);

  const StatusIcon = statusText === 'Graded' ? CheckCircle2
    : statusText === 'Submitted' ? CheckCircle2
    : statusText === 'Overdue' ? XCircle : Clock;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-2xl font-black text-slate-800">{hw.title}</h3>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${s.bg} ${s.text}`}>
            <StatusIcon size={14} /> {statusText}
          </span>
        </div>
        <div className="flex flex-wrap gap-5 mt-3 text-sm text-slate-500 font-medium">
          <span className="flex items-center gap-1.5"><BookOpen size={14} className="text-slate-400" />
            {hw.subject_name || '—'}</span>
          <span className="flex items-center gap-1.5">Type: {hw.homework_type}</span>
          <span className={`flex items-center gap-1.5 ${overdue ? 'text-red-600 font-bold' : ''}`}>
            <Clock size={14} className="text-slate-400" /> Due {fmtDate(hw.due_date)}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Description */}
        {hw.description && (
          <Section title="Description">
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
              {hw.description}
            </p>
          </Section>
        )}

        {/* Questions */}
        {(hw.questions || []).length > 0 && (
          <Section title="Questions">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <ol className="list-decimal list-inside space-y-1.5">
                {hw.questions.map((q, i) => (
                  <li key={i} className="text-sm text-slate-700">{q}</li>
                ))}
              </ol>
            </div>
          </Section>
        )}

        {/* Teacher attachments */}
        {(hw.attachments || []).length > 0 && (
          <Section title="Teacher's Attachments">
            <div className="flex flex-wrap gap-2">
              {hw.attachments.map((f, i) => (
                <button key={i} onClick={() => openFile(f)}
                  className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-xl text-sm font-bold transition-all">
                  <Paperclip size={14} /> {f.name}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Grade & feedback */}
        {hw.status === 'Graded' && (
          <Section title="Grade & Feedback">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-sm font-bold text-slate-700">
                Grade: <span className="text-blue-700">{hw.grade}</span>
              </div>
              {hw.remarks && (
                <p className="text-sm text-slate-600 italic mt-2 pt-2 border-t border-blue-200/60">
                  "{hw.remarks}"
                </p>
              )}
            </div>
          </Section>
        )}

        {/* Submission content */}
        {hw.submission_id && (
          <Section title="Your Submission">
            {hw.written_answer && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-3 max-h-48 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-emerald-800 font-sans">{hw.written_answer}</pre>
              </div>
            )}
            {(hw.submission_files || []).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {hw.submission_files.map((f, i) => (
                  <button key={i} onClick={() => openFile(f)}
                    className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 p-3 rounded-xl text-sm text-emerald-800 font-medium transition-all">
                    <FileText size={16} className="shrink-0" />
                    <span className="truncate flex-1 text-left">{f.name}</span>
                    <Eye size={14} />
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-2">Submitted {fmtDate(hw.submitted_at)}</p>
          </Section>
        )}

        {/* Actions */}
        <Section title="Actions">
          {hw.submission_id ? (
            hw.status !== 'Graded' ? (
              <div className="flex flex-wrap gap-3">
                {hw.homework_type === 'Written' ? (
                  <button onClick={onWrite}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm">
                    <Edit size={15} /> Edit Answer
                  </button>
                ) : (
                  <button onClick={onSubmitFiles} disabled={busy}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl font-bold text-sm">
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    Resubmit Files
                  </button>
                )}
                <button onClick={onDelete} disabled={busy}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl font-bold text-sm">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  Delete Submission
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">
                This submission has been graded and can no longer be changed.
              </p>
            )
          ) : (
            hw.homework_type === 'Written' ? (
              <button onClick={onWrite}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm">
                <Edit size={15} /> Start Answering
              </button>
            ) : (
              <button onClick={onSubmitFiles} disabled={busy}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl font-bold text-sm">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                Submit Homework
              </button>
            )
          )}
        </Section>
      </div>
    </div>
  );
}


// =====================================================================
//  Written answer full-screen editor
// =====================================================================
function WrittenAnswerScreen({ hw, submitting, onSubmit, onCancel }) {
  const [answer, setAnswer] = useState(hw.written_answer || '');

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white px-5 py-3 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <h2 className="text-lg font-black truncate">{hw.title}</h2>
          <p className="text-blue-100 text-xs">{hw.subject_name || ''} · Due {fmtDate(hw.due_date)}</p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-blue-500 rounded-full">
          <X size={22} />
        </button>
      </div>

      {/* Body — question left, answer right */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <div className="lg:w-1/2 border-r border-slate-200 overflow-y-auto p-6 bg-slate-50">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-3">Question</h3>
          {hw.description && (
            <pre className="whitespace-pre-wrap font-sans text-slate-700 mb-4">{hw.description}</pre>
          )}
          {(hw.questions || []).length > 0 && (
            <ol className="list-decimal list-inside space-y-2">
              {hw.questions.map((q, i) => (
                <li key={i} className="text-slate-700">{q}</li>
              ))}
            </ol>
          )}
          {!hw.description && (hw.questions || []).length === 0 && (
            <p className="text-slate-400 italic">No instructions provided.</p>
          )}
        </div>
        <div className="lg:w-1/2 flex flex-col min-h-0">
          <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Your Answer</h3>
          </div>
          <textarea value={answer} onChange={e => setAnswer(e.target.value)}
            placeholder="Type your answer here…"
            className="flex-1 w-full p-5 resize-none outline-none text-base leading-relaxed" />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <button onClick={onCancel} disabled={submitting}
          className="px-5 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100">
          Cancel
        </button>
        <button onClick={() => onSubmit(answer)} disabled={submitting || !answer.trim()}
          className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {submitting ? 'Submitting…' : 'Submit Answer'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{title}</h4>
      {children}
    </div>
  );
}