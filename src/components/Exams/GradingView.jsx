import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { ArrowLeft, Loader2, Save, CheckCircle2, XCircle } from 'lucide-react';

// =====================================================================
//  GradingView - load one attempt + its answers, allow teacher to
//  award marks per question, write overall feedback, then submit.
// =====================================================================

export default function GradingView({ attemptId, examTitle, totalMarks, onBack }) {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(null);
  const [items, setItems]     = useState([]);
  const [grades, setGrades]   = useState({});
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/admin/attempts/${attemptId}`);
        const data = await res.json();
        if (cancel) return;
        setAttempt(data.attempt);
        setItems(data.items || []);
        const seed = {};
        (data.items || []).forEach(it => {
          seed[it.question_id] = (it.marks_awarded ?? '').toString();
        });
        setGrades(seed);
        setFeedback(data.attempt?.teacher_feedback || '');
      } catch (e) { console.error(e); }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, [attemptId]);

  const setMark = (qid, value) => {
    if (!/^\d*\.?\d*$/.test(value)) return;
    setGrades(prev => ({ ...prev, [qid]: value }));
  };

  const totalAwarded = Object.values(grades).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const handleSubmit = async () => {
    if (!window.confirm(`Submit grade ${totalAwarded.toFixed(2)} / ${totalMarks}?`)) return;
    setSaving(true);
    try {
      const body = {
        graded_answers: items.map(it => ({
          question_id: it.question_id,
          marks_awarded: parseFloat(grades[it.question_id]) || 0
        })),
        teacher_feedback: feedback.trim() || null,
        graded_by: user.id
      };
      const res = await fetch(`${API_BASE_URL}/admin/attempts/${attemptId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Grading failed');
      alert(`Saved | final score ${data.final_score} / ${totalMarks}`);
      onBack();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  if (!attempt) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Navigation */}
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
        <ArrowLeft className="size-4" /> Back to submissions
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Grading</p>
          <h2 className="text-lg font-semibold text-zinc-900 mt-1">{examTitle}</h2>
          <p className="text-sm text-zinc-500 mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>Student: <span className="font-semibold text-zinc-700">{attempt.student_name}</span></span>
            {attempt.roll_no && <span className="text-zinc-400">| Roll {attempt.roll_no}</span>}
          </p>
        </div>
        <div className="bg-primary/5 text-primary px-5 py-3 rounded-lg text-center ring-1 ring-primary/20 shrink-0 w-full sm:w-auto">
          <div className="text-2xl font-bold tabular-nums leading-none">{totalAwarded.toFixed(2)}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80 mt-1">out of {totalMarks}</div>
        </div>
      </div>

      {/* Question-by-question grading */}
      <div className="space-y-4">
        {items.map((it, idx) => {
          const isMCQ = it.question_type === 'multiple_choice';
          const isCorrect = isMCQ && it.answer_text === it.correct_answer;
          return (
            <div key={it.question_id} className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 sm:p-5 border-b border-zinc-100 bg-zinc-50/50">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center flex-wrap gap-1.5">
                      <span>Question {idx + 1}</span>
                      <span className="text-zinc-300">|</span>
                      <span>Max {it.marks} marks</span>
                      <span className="text-zinc-300">|</span>
                      <span>{isMCQ ? 'MCQ' : 'Written'}</span>
                    </p>
                    <p className="font-medium text-zinc-900 text-sm leading-relaxed">{it.question_text}</p>
                  </div>
                  {isMCQ && (
                    <div className="shrink-0 self-start">
                      {isCorrect
                        ? <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md whitespace-nowrap inline-flex items-center gap-1.5 ring-1 ring-emerald-600/20"><CheckCircle2 className="size-3.5" /> Correct</span>
                        : <span className="text-[10px] font-semibold uppercase tracking-wider bg-red-50 text-red-700 px-2.5 py-1 rounded-md whitespace-nowrap inline-flex items-center gap-1.5 ring-1 ring-red-600/20"><XCircle className="size-3.5" /> Wrong</span>
                      }
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {/* Student answer */}
                <div>
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Student's Answer</p>
                  <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-sm text-zinc-800">
                    {isMCQ && it.options && it.answer_text
                      ? <><span className="font-semibold">{it.answer_text}</span> - {it.options[it.answer_text] || '-'}</>
                      : (it.answer_text || <span className="italic text-zinc-400">Not answered</span>)}
                  </div>
                </div>

                {/* Correct answer (MCQ only) */}
                {isMCQ && it.correct_answer && it.options && (
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">Correct Answer</p>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-sm text-emerald-800">
                      <span className="font-semibold">{it.correct_answer}</span> - {it.options[it.correct_answer]}
                    </div>
                  </div>
                )}

                {/* Marks input */}
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
                    Award Marks (max {it.marks})
                  </label>
                  <input type="text" inputMode="decimal"
                    value={grades[it.question_id] ?? ''}
                    onChange={e => setMark(it.question_id, e.target.value)}
                    placeholder={`0 - ${it.marks}`}
                    className="h-9 w-full sm:w-48 bg-white border border-zinc-200 rounded-md px-3 text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall feedback */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-5 sm:p-6 space-y-2">
        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
          Overall Feedback <span className="text-zinc-400 normal-case tracking-normal">(Optional)</span>
        </label>
        <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
          placeholder="Write feedback the student will see..."
          className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors min-h-[80px]" />
      </div>

      {/* Submit */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pb-8">
        <button onClick={onBack} disabled={saving}
          className="h-10 px-6 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="h-10 px-8 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto">
          {saving ? <Loader2 className="size-4 animate-spin shrink-0" /> : <Save className="size-4 shrink-0" />}
          {saving ? 'Saving...' : 'Submit Grades'}
        </button>
      </div>
    </div>
  );
}