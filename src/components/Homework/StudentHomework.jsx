import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Loader2, Upload, FileText, Eye, Trash2, Edit, Paperclip,
  CheckCircle2, Clock, XCircle, BookOpen, X, ClipboardList, Send, User
} from 'lucide-react';
import { fmtDate, fileToBase64, statusStyle } from './HwUtils';
import FileViewer from './FileViewer';

// Compact date + time for when a homework was created, e.g. "15 Jul 2026,
// 9:30 am", always shown in IST. The backend (Railway) stores created_at in
// UTC and MySQL usually returns it as a plain string with no timezone marker,
// which new Date() would treat as local. So: if there's no zone marker, append
// 'Z' to force UTC parsing, then render in Asia/Kolkata so it's correct for
// every viewer.
const fmtCreatedAt = (val) => {
  if (!val) return '';
  let s = String(val).trim();
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
  if (!hasZone) s = s.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata'
  });
};

// =====================================================================
//  StudentHomework - list of assigned homework + detail panel.
//   • PDF type     -> upload files (base64)
//   • Written type -> in-app text answer screen
//  Students can delete their submission until it's graded.
//  (Homework is no longer scoped to an academic year.)
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
    return <div className="h-64 flex items-center justify-center animate-in fade-in duration-300"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2 sm:mb-0">
        <header className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="text-primary size-5" />
            My Homework
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">View and submit your class assignments.</p>
        </header>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 flex-1 items-start">
        
        {/* List panel */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden h-[60vh] lg:h-[calc(100vh-160px)] shrink-0">
          <div className="p-3 border-b border-zinc-100 bg-zinc-50/50">
            <div className="flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar">
              {['All', 'Pending', 'Completed'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    filter === f ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50/50'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-zinc-100">
            {filtered.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center h-full text-center">
                <p className="text-zinc-400 text-sm font-medium">No assignments here.</p>
              </div>
            ) : filtered.map(it => {
              const overdue = !it.submission_id && new Date(it.due_date) < new Date();
              const s = statusStyle(overdue ? 'Overdue' : it.status);
              return (
                <button key={it.id} onClick={() => setSelId(it.id)}
                  className={`w-full text-left p-4 transition-colors group ${
                    selectedId === it.id ? 'bg-primary/5' : 'hover:bg-zinc-50/80'
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold truncate text-sm ${selectedId === it.id ? 'text-primary' : 'text-zinc-900 group-hover:text-primary transition-colors'}`}>
                        {it.title}
                      </p>
                      <p className={`text-[11px] font-medium mt-1 ${overdue ? 'text-red-500' : 'text-zinc-500'}`}>
                        Due {fmtDate(it.due_date)}
                      </p>
                      {(it.created_by_name || it.created_at) && (
                        <p className="text-[10px] font-medium text-zinc-400 mt-1 truncate">
                          {it.created_by_name ? `By ${it.created_by_name}` : ''}
                          {it.created_by_name && it.created_at ? ' · ' : ''}
                          {it.created_at ? fmtCreatedAt(it.created_at) : ''}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 size-2 rounded-full mt-1.5 ${s.dot}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-8 xl:col-span-8">
          {selected ? (
            <AssignmentDetail
              hw={selected}
              busy={busy === selected.id}
              onSubmitFiles={() => submitFiles(selected.id)}
              onWrite={() => setWriting(selected)}
              onDelete={() => deleteSubmission(selected.submission_id, selected.id)} />
          ) : (
            <div className="bg-white rounded-lg ring-1 ring-black/5 border-dashed p-12 sm:p-16 text-center flex flex-col items-center">
              <ClipboardList className="size-12 text-zinc-300 mb-4" />
              <h3 className="text-base font-semibold text-zinc-400">No homework selected.</h3>
              <p className="text-zinc-400 font-medium text-sm mt-1">Choose an assignment from the list to view details.</p>
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
  const [viewFile, setViewFile] = useState(null);   // file shown in the in-screen viewer

  const StatusIcon = statusText === 'Graded' ? CheckCircle2
    : statusText === 'Submitted' ? CheckCircle2
    : statusText === 'Overdue' ? XCircle : Clock;

  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm flex flex-col animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-zinc-100 bg-zinc-50/50 rounded-t-lg">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <h3 className="text-lg sm:text-xl font-semibold text-zinc-900 tracking-tight leading-tight max-w-[80%]">{hw.title}</h3>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold tracking-wider uppercase ring-1 ring-inset w-fit ${s.bg} ${s.text} ring-${s.text.split('-')[1]}-600/20`}>
            <StatusIcon className="size-3.5" /> {statusText}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-5 mt-4 text-xs font-medium text-zinc-500">
          <span className="flex items-center gap-1.5"><BookOpen className="size-3.5 text-zinc-400" />
            {hw.subject_name || '-'}</span>
          <span className="flex items-center gap-1.5">Type: {hw.homework_type}</span>
          <span className={`flex items-center gap-1.5 ${overdue ? 'text-red-500 font-semibold' : ''}`}>
            <Clock className="size-3.5 text-zinc-400" /> Due {fmtDate(hw.due_date)}
          </span>
          {hw.created_by_name && (
            <span className="flex items-center gap-1.5">
              <User className="size-3.5 text-zinc-400" /> By {hw.created_by_name}
            </span>
          )}
          {hw.created_at && (
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-zinc-400" /> Created {fmtCreatedAt(hw.created_at)}
            </span>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Description */}
        {hw.description && (
          <Section title="Description">
            <div className="bg-zinc-50/50 p-4 rounded-md border border-zinc-100">
              <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{hw.description}</p>
            </div>
          </Section>
        )}

        {/* Questions */}
        {(hw.questions || []).length > 0 && (
          <Section title="Questions">
            <div className="bg-primary/5 p-4 rounded-md border border-primary/10">
              <ol className="list-decimal list-inside space-y-2">
                {hw.questions.map((q, i) => (
                  <li key={i} className="text-sm text-zinc-800 font-medium leading-relaxed">{q}</li>
                ))}
              </ol>
            </div>
          </Section>
        )}

        {/* Teacher attachments */}
        {(hw.attachments || []).length > 0 && (
          <Section title="Teacher's Attachments">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {hw.attachments.map((f, i) => (
                <button key={i} onClick={() => setViewFile(f)}
                  className="flex items-center gap-2.5 bg-white hover:bg-zinc-50 border border-zinc-200 p-3 rounded-md transition-colors text-left shadow-sm ring-1 ring-black/5 group w-full">
                  <Paperclip className="size-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-zinc-700 truncate group-hover:text-primary transition-colors flex-1">{f.name}</span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Grade & feedback */}
        {hw.status === 'Graded' && (
          <Section title="Grade & Feedback">
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4">
              <div className="text-sm font-semibold text-zinc-800">
                Grade: <span className="text-emerald-700 ml-1">{hw.grade}</span>
              </div>
              {hw.remarks && (
                <p className="text-sm text-emerald-800/80 italic mt-2.5 pt-2.5 border-t border-emerald-200/60 leading-relaxed">
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
              <div className="bg-zinc-50 border border-zinc-200 rounded-md p-4 mb-4 max-h-56 overflow-y-auto custom-scrollbar shadow-sm">
                <pre className="whitespace-pre-wrap text-sm text-zinc-800 font-sans leading-relaxed">{hw.written_answer}</pre>
              </div>
            )}
            {(hw.submission_files || []).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {hw.submission_files.map((f, i) => (
                  <button key={i} onClick={() => setViewFile(f)}
                    className="flex items-center gap-2.5 bg-white hover:bg-zinc-50 border border-zinc-200 p-3 rounded-md transition-colors text-left shadow-sm ring-1 ring-black/5 group w-full">
                    <FileText className="size-4 text-primary shrink-0" />
                    <div className="flex-1 overflow-hidden">
                      <span className="text-sm font-semibold text-zinc-800 truncate group-hover:text-primary transition-colors block">{f.name}</span>
                      <span className="text-[10px] text-zinc-500 font-medium flex items-center gap-1 mt-0.5 uppercase tracking-wider"><Eye className="size-3" /> View file</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mt-2">Submitted {fmtDate(hw.submitted_at)}</p>
          </Section>
        )}

        {/* Actions */}
        <div className="pt-6 border-t border-zinc-100">
          {hw.submission_id ? (
            hw.status !== 'Graded' ? (
              <div className="flex flex-col sm:flex-row gap-3">
                {hw.homework_type === 'Written' ? (
                  <button onClick={onWrite}
                    className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto">
                    <Edit className="size-3.5" /> Edit Answer
                  </button>
                ) : (
                  <button onClick={onSubmitFiles} disabled={busy}
                    className="h-9 px-4 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto">
                    {busy ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Upload className="size-3.5 shrink-0" />}
                    Resubmit Files
                  </button>
                )}
                <button onClick={onDelete} disabled={busy}
                  className="h-9 px-4 bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-200 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto">
                  {busy ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Trash2 className="size-3.5 shrink-0" />}
                  Delete Submission
                </button>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 font-medium italic bg-zinc-50 p-3 rounded-md border border-zinc-100 text-center sm:text-left">
                This submission has been graded and can no longer be changed.
              </p>
            )
          ) : (
            hw.homework_type === 'Written' ? (
              <button onClick={onWrite}
                className="h-9 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto">
                <Edit className="size-3.5" /> Start Answering
              </button>
            ) : (
              <button onClick={onSubmitFiles} disabled={busy}
                className="h-9 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto">
                {busy ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Upload className="size-3.5 shrink-0" />}
                Submit Homework
              </button>
            )
          )}
        </div>
      </div>

      {/* In-screen file viewer */}
      <FileViewer file={viewFile} onClose={() => setViewFile(null)} />
    </div>
  );
}


// =====================================================================
//  Written answer full-screen editor
// =====================================================================
function WrittenAnswerScreen({ hw, submitting, onSubmit, onCancel }) {
  const [answer, setAnswer] = useState(hw.written_answer || '');

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-50 flex flex-col animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="bg-primary text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="min-w-0 pr-4">
          <h2 className="text-lg font-semibold truncate leading-tight">{hw.title}</h2>
          <p className="text-primary-100 text-xs mt-1 opacity-90">{hw.subject_name || ''} - Due {fmtDate(hw.due_date)}</p>
        </div>
        <button onClick={onCancel} className="p-1.5 hover:bg-white/20 rounded-md transition-colors shrink-0">
          <X className="size-5" />
        </button>
      </div>

      {/* Body - question top/left, answer bottom/right */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        
        {/* Question Panel */}
        <div className="lg:w-[45%] border-b lg:border-b-0 lg:border-r border-zinc-200 overflow-y-auto custom-scrollbar p-5 sm:p-8 bg-zinc-50/50">
          <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BookOpen className="size-3.5" /> Instructions & Questions
          </h3>
          
          {hw.description && (
            <div className="bg-white p-4 rounded-md ring-1 ring-black/5 shadow-sm mb-6">
              <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 leading-relaxed">{hw.description}</pre>
            </div>
          )}
          
          {(hw.questions || []).length > 0 && (
            <div className="bg-primary/5 p-5 rounded-md border border-primary/10">
              <ol className="list-decimal list-inside space-y-3">
                {hw.questions.map((q, i) => (
                  <li key={i} className="text-sm text-zinc-800 font-medium leading-relaxed pl-1">{q}</li>
                ))}
              </ol>
            </div>
          )}
          
          {!hw.description && (hw.questions || []).length === 0 && (
            <p className="text-zinc-400 italic text-sm">No instructions provided.</p>
          )}
        </div>

        {/* Answer Panel */}
        <div className="lg:w-[55%] flex flex-col min-h-[40vh] lg:min-h-0 bg-white">
          <div className="px-5 sm:px-8 py-4 border-b border-zinc-100 bg-white flex items-center shrink-0">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Edit className="size-3.5" /> Your Answer
            </h3>
          </div>
          <textarea value={answer} onChange={e => setAnswer(e.target.value)}
            placeholder="Type your answer here..."
            className="flex-1 w-full p-5 sm:p-8 resize-none outline-none text-sm sm:text-base text-zinc-900 leading-relaxed custom-scrollbar placeholder:text-zinc-300" />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-200 bg-white px-5 sm:px-8 py-4 flex items-center justify-end gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-10">
        <button onClick={onCancel} disabled={submitting}
          className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
          Cancel
        </button>
        <button onClick={() => onSubmit(answer)} disabled={submitting || !answer.trim()}
          className="h-9 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[140px]">
          {submitting ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Send className="size-3.5 shrink-0" />}
          {submitting ? 'Submitting...' : 'Submit Answer'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">{title}</h4>
      {children}
    </div>
  );
}