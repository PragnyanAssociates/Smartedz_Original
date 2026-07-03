import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Loader2, Play, ArrowLeft, ArrowRight, HelpCircle, CheckCircle2,
  Clock, ChevronRight, Send, BookOpen, User
} from 'lucide-react';

// =====================================================================
//  StudentExamsView - list of exams a student can attempt
//  Views: list | taking | result
// =====================================================================

// Render a UTC datetime (Railway stores UTC) as IST for display.
const fmtIST = (val) => {
  if (!val) return '';
  let d;
  if (typeof val === 'string' && !val.includes('T') && !val.endsWith('Z')) {
    d = new Date(val.replace(' ', 'T') + 'Z');
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

export default function StudentExamsView() {
  const [view, setView] = useState('list');
  const [picked, setPicked] = useState(null);     // {exam_id, attempt_id, ...}

  if (view === 'taking' && picked) {
    return <TakeExamView exam={picked} onFinish={() => setView('list')} />;
  }
  if (view === 'result' && picked) {
    return <ResultView attemptId={picked.attempt_id} onBack={() => setView('list')} />;
  }
  return <ExamList onTake={(e) => { setPicked(e); setView('taking'); }}
                   onResult={(e) => { setPicked(e); setView('result'); }} />;
}


// =====================================================================
//  List
// =====================================================================
function ExamList({ onTake, onResult }) {
  const { user } = useAuth();
  const [exams, setExams]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exams/student/${user.id}`);
      const data = await res.json();
      setExams(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }
  
  if (exams.length === 0) {
    return (
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
        <BookOpen className="size-10 text-zinc-300 mb-3" />
        <p className="text-zinc-500 text-sm font-medium">No exams available for you right now.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-x-auto custom-scrollbar animate-in fade-in duration-500">
      <table className="w-full text-left border-collapse min-w-[760px]">
        <thead className="bg-zinc-50/50">
          <tr>
            <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Exam</th>
            <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 whitespace-nowrap">Details</th>
            <th className="px-5 py-3 text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100 text-right whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {exams.map(e => (
            <tr key={e.exam_id} className="hover:bg-zinc-50/60 transition-colors">
              <td className="px-5 py-4 min-w-[220px]">
                <div className="font-medium text-zinc-900 text-sm truncate">{e.title}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                  {e.className}{e.section ? ` - ${e.section}` : ''}
                  {e.subject_name && ` | ${e.subject_name}`}
                </div>
                {(e.teacher_name || e.created_by_name || e.created_at) && (
                  <div className="text-[11px] text-zinc-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {(e.teacher_name || e.created_by_name) && (
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3" /> {e.teacher_name || e.created_by_name}
                      </span>
                    )}
                    {e.created_at && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> {fmtIST(e.created_at)}
                      </span>
                    )}
                  </div>
                )}
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
                  <span className="bg-primary/5 text-primary ring-1 ring-primary/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap">
                    <HelpCircle className="size-3" /> {e.question_count} Qs
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap">
                    <CheckCircle2 className="size-3" /> {e.total_marks} Marks
                  </span>
                  <span className="bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Clock className="size-3" /> {e.time_limit_mins > 0 ? `${e.time_limit_mins} min` : 'No limit'}
                  </span>
                </div>
              </td>
              <td className="px-5 py-4 text-right">
                <ActionForStatus exam={e} onTake={onTake} onResult={onResult} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionForStatus({ exam, onTake, onResult }) {
  if (exam.attempt_status === 'graded') {
    return (
      <button onClick={() => onResult(exam)}
        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20 text-xs font-semibold px-4 h-8 rounded-md inline-flex items-center justify-center gap-1.5 transition-colors w-full sm:w-auto">
        View Result <ArrowRight className="size-3.5" />
      </button>
    );
  }
  if (exam.attempt_status === 'submitted') {
    return (
      <span className="bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 text-xs font-semibold px-4 h-8 rounded-md inline-flex items-center justify-center gap-1.5 w-full sm:w-auto">
        <Clock className="size-3.5" /> Awaiting Grade
      </span>
    );
  }
  if (exam.attempt_status === 'in_progress') {
    return (
      <button onClick={() => onTake(exam)}
        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 h-8 rounded-md inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto">
        <Play className="size-3.5 fill-current" /> Resume
      </button>
    );
  }
  return (
    <button onClick={() => onTake(exam)}
      className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 h-8 rounded-md inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors w-full sm:w-auto">
      <Play className="size-3.5 fill-current" /> Start Now
    </button>
  );
}


// =====================================================================
//  Take exam
// =====================================================================
function TakeExamView({ exam, onFinish }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]     = useState({});
  const [attemptId, setAttemptId] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // -----------------------------------------------------------------
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        // Start (or resume) the attempt first - protects against double-tap
        const startRes = await fetch(`${API_BASE_URL}/admin/exams/${exam.exam_id}/start`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: user.id })
        });
        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData.error || 'Could not start');
        if (cancel) return;
        setAttemptId(startData.attempt_id);

        if (exam.time_limit_mins > 0) setTimeLeft(exam.time_limit_mins * 60);

        const qRes = await fetch(`${API_BASE_URL}/admin/exams/${exam.exam_id}/take`);
        const qData = await qRes.json();
        if (cancel) return;
        setQuestions(qData || []);
      } catch (e) {
        alert(e.message);
        onFinish();
      }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line
  }, [exam.exam_id, user.id]);

  // -----------------------------------------------------------------
  // Timer
  // -----------------------------------------------------------------
  useEffect(() => {
    if (timeLeft === null || submitting) return;
    if (timeLeft <= 0) { doSubmit(true); return; }
    const t = setInterval(() => setTimeLeft(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [timeLeft, submitting]);

  // -----------------------------------------------------------------
  const setAnswer = (qid, value) => setAnswers(prev => ({ ...prev, [qid]: value }));

  const doSubmit = async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/attempts/${attemptId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id, answers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      alert(auto
        ? 'Time up - your exam was submitted automatically.'
        : 'Exam submitted!');
      onFinish();
    } catch (e) {
      alert(e.message);
      setSubmitting(false);
    }
  };

  const handleManualSubmit = () => {
    const unans = questions.length - Object.keys(answers).filter(k => answers[k]).length;
    if (unans > 0 && !window.confirm(`${unans} question(s) are unanswered. Submit anyway?`)) return;
    if (!window.confirm('Submit your exam now? This cannot be undone.')) return;
    doSubmit(false);
  };

  const fmtTime = (s) => {
    if (s == null) return '';
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }
  if (questions.length === 0) {
    return (
      <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center">
        <p className="text-zinc-500 font-medium">No questions in this exam.</p>
      </div>
    );
  }

  const cq = questions[currentIdx];
  const lowOnTime = timeLeft !== null && timeLeft < 60;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      
      {/* Top bar */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-zinc-900 text-lg">{exam.title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Question {currentIdx + 1} of {questions.length}
          </p>
        </div>
        {timeLeft !== null && (
          <div className={`${lowOnTime ? 'bg-red-50 text-red-700 ring-red-600/20' : 'bg-primary/10 text-primary ring-primary/20'} ring-1 px-4 py-2 rounded-md inline-flex items-center justify-center gap-2 shrink-0`}>
            <Clock className="size-4" />
            <span className="font-semibold tabular-nums text-sm">{fmtTime(timeLeft)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 sm:gap-6 items-start">
        
        {/* Question palette - Reordered to bottom on mobile */}
        <div className="order-2 lg:order-1 lg:col-span-1 bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-5 w-full lg:sticky lg:top-4">
          <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-4">Questions</h3>
          <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2">
            {questions.map((q, i) => {
              const answered = !!answers[q.id];
              const current = i === currentIdx;
              return (
                <button key={q.id} onClick={() => setCurrentIdx(i)}
                  className={`h-9 rounded-md text-xs font-semibold transition-all ${
                    current ? 'bg-primary text-white ring-2 ring-primary/30 scale-105 shadow-sm'
                      : answered ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 hover:bg-emerald-100'
                      : 'bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100'
                  }`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button onClick={handleManualSubmit} disabled={submitting}
            className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 disabled:text-zinc-500 text-white font-semibold h-10 rounded-md text-sm flex items-center justify-center gap-2 shadow-sm transition-colors">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>

        {/* Question card - Reordered to top on mobile */}
        <div className="order-1 lg:order-2 lg:col-span-3 w-full flex flex-col gap-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-5 sm:p-6 sm:min-h-[400px] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
              <p className="font-semibold text-zinc-900 text-base leading-relaxed">{cq.question_text}</p>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary ring-1 ring-primary/20 px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 self-start">
                {cq.marks} mark{cq.marks === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex-1">
              {cq.question_type === 'multiple_choice' && cq.options ? (
                <div className="space-y-3">
                  {Object.entries(cq.options).map(([key, label]) => label.trim() && (
                    <button key={key}
                      onClick={() => setAnswer(cq.id, key)}
                      className={`w-full text-left p-3 sm:p-4 rounded-lg ring-1 transition-all ${
                        answers[cq.id] === key
                          ? 'ring-primary bg-primary/5 shadow-sm'
                          : 'ring-zinc-200 hover:ring-zinc-300 hover:bg-zinc-50'
                      }`}>
                      <div className="flex items-center gap-3">
                        <span className={`size-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                          answers[cq.id] === key ? 'bg-primary text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200'
                        }`}>{key}</span>
                        <span className={`text-sm leading-snug ${answers[cq.id] === key ? 'font-medium text-zinc-900' : 'text-zinc-700'}`}>
                          {label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <textarea value={answers[cq.id] || ''} onChange={e => setAnswer(cq.id, e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full bg-white border border-zinc-200 rounded-lg p-4 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none min-h-[200px]" />
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
            <button onClick={() => setCurrentIdx(p => Math.max(0, p - 1))}
              disabled={currentIdx === 0}
              className="h-10 px-5 bg-white border border-zinc-200 text-zinc-700 rounded-md text-sm font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors w-full sm:w-auto">
              <ArrowLeft className="size-4" /> Previous
            </button>
            <button onClick={() => setCurrentIdx(p => Math.min(questions.length - 1, p + 1))}
              disabled={currentIdx === questions.length - 1}
              className="h-10 px-5 bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-md text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto">
              Next <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// =====================================================================
//  Result view
// =====================================================================
function ResultView({ attemptId, onBack }) {
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE_URL}/admin/attempts/${attemptId}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }
  if (!data) return null;

  const { attempt, items } = data;
  const pct = attempt.total_marks > 0 ? (attempt.final_score / attempt.total_marks) * 100 : 0;
  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
        <ArrowLeft className="size-4" /> Back to exams
      </button>

      {/* Score card */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row gap-6 sm:gap-8 items-center">
        <div className="relative size-36 sm:size-40 shrink-0">
          <svg className="size-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" stroke="#f4f4f5" strokeWidth="8" fill="transparent" />
            <circle cx="50" cy="50" r="46" stroke="#2563EB" strokeWidth="8" fill="transparent"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl sm:text-3xl font-bold text-primary tabular-nums leading-none mb-1">{pct.toFixed(1)}%</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Score</div>
          </div>
        </div>
        <div className="text-center md:text-left w-full flex-1">
          <h2 className="font-semibold text-zinc-900 text-xl sm:text-2xl">{attempt.exam_title}</h2>
          <p className="text-zinc-500 font-medium mt-1">
            Final Score: <span className="font-bold text-zinc-900">{attempt.final_score}</span> / {attempt.total_marks}
          </p>
          {attempt.teacher_feedback && (
            <div className="mt-5 bg-primary/5 border-l-4 border-primary p-4 rounded-r-md text-sm text-zinc-800">
              <span className="italic">"{attempt.teacher_feedback}"</span>
              {attempt.graded_by_name && (
                <div className="not-italic text-[11px] font-semibold text-primary mt-2">
                  - {attempt.graded_by_name}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Question review */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-5 sm:p-6 overflow-hidden">
        <h3 className="font-semibold text-zinc-900 text-sm mb-4">Detailed Review</h3>
        <div className="space-y-3">
          {items.map((it, idx) => {
            const isCorrect = (it.marks_awarded ?? 0) === it.marks;
            const some = (it.marks_awarded ?? 0) > 0 && !isCorrect;
            return (
              <div key={it.question_id} className="ring-1 ring-zinc-200 rounded-lg overflow-hidden transition-colors hover:ring-zinc-300">
                <button onClick={() => setOpenId(openId === it.question_id ? null : it.question_id)}
                  className="w-full p-4 flex items-start sm:items-center justify-between gap-3 bg-zinc-50/50 hover:bg-zinc-100/50 transition-colors">
                  <span className="text-sm font-medium text-zinc-800 text-left pr-4 leading-relaxed">
                    <span className="text-zinc-500 font-semibold mr-1">{idx + 1}.</span> {it.question_text}
                  </span>
                  <div className="flex items-center gap-3 shrink-0 mt-0.5 sm:mt-0">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md ring-1 whitespace-nowrap ${
                      isCorrect ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                        : some ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                        : 'bg-red-50 text-red-700 ring-red-600/20'
                    }`}>
                      {it.marks_awarded ?? 0} / {it.marks}
                    </span>
                    <ChevronRight className={`size-4 text-zinc-400 transition-transform duration-200 ${openId === it.question_id ? 'rotate-90' : ''}`} />
                  </div>
                </button>
                
                {openId === it.question_id && (
                  <div className="p-4 sm:p-5 bg-white border-t border-zinc-100 space-y-4 text-sm animate-in slide-in-from-top-2 duration-200">
                    <div>
                      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Your Answer</p>
                      <div className="bg-zinc-50 ring-1 ring-zinc-200 rounded-md p-3 text-zinc-800">
                        {it.question_type === 'multiple_choice' && it.options && it.answer_text
                          ? <><span className="font-semibold">{it.answer_text}</span> - {it.options[it.answer_text] || '-'}</>
                          : (it.answer_text || <span className="italic text-zinc-400">Not answered</span>)}
                      </div>
                    </div>
                    {it.question_type === 'multiple_choice' && it.correct_answer && it.options && (
                      <div>
                        <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">Correct Answer</p>
                        <div className="bg-emerald-50 ring-1 ring-emerald-600/20 rounded-md p-3 text-emerald-800">
                          <span className="font-semibold">{it.correct_answer}</span> - {it.options[it.correct_answer]}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}