import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  ArrowLeft, Save, Loader2, Plus, X, AlertTriangle, BookOpen, Info, ChevronDown
} from 'lucide-react';

// =====================================================================
//  ExamEditor - create or edit an online exam
//
//  Top-level exam fields: title, description, class, section, subject,
//  teacher, time_limit_mins. Then a question editor underneath.
//
//  Teacher field mirrors the Homework pattern: picking a subject
//  auto-selects the teacher who teaches it (from the teacherSubjects map
//  /admin/data provides). It stays editable so you can override, and
//  changing the class clears the subject + teacher.
// =====================================================================

const newQuestion = () => ({
  id: Date.now() + Math.random(),
  question_text: '',
  question_type: 'multiple_choice',
  options: { A: '', B: '', C: '', D: '' },
  correct_answer: '',
  marks: 1
});

export default function ExamEditor({ examToEdit, onFinish }) {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();
  const role = (user?.role || '').toLowerCase();
  const isTeacher = role.includes('teacher');
  const isEditMode = !!examToEdit;

  const [details, setDetails] = useState({
    title: '', description: '',
    class_id: '', section: '', subject_id: '', teacher_id: '',
    time_limit_mins: 0, status: 'published'
  });
  const [questions, setQuestions] = useState([newQuestion()]);

  const [classes, setClasses]   = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);                     // all teacher users
  const [teacherSubjects, setTeacherSubjects] = useState({});       // { teacherId: [subjectId,...] }
  const [allTeacherSubjects, setAllTeacherSubjects] = useState([]); // teacher's own subjects
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  // -----------------------------------------------------------------
  // Bootstrap: classes (scoped if teacher), subjects, teachers, and
  // (if edit) the exam itself
  // -----------------------------------------------------------------
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const [aggRes, classesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`),
          isTeacher && !isAllAccess
            ? fetch(`${API_BASE_URL}/admin/attendance/teacher-classes/${user.id}`)
            : Promise.resolve(null)
        ]);
        const agg = await aggRes.json();
        if (cancel) return;
        setSubjects(agg.subjects || []);
        setTeacherSubjects(agg.teacherSubjects || {});

        // All teacher users (for the Teacher dropdown)
        const allUsers = agg.users || [];
        setTeachers(allUsers.filter(u => (u.role || '').toLowerCase().includes('teacher')));

        // Teacher's own subjects (so subject dropdown is scoped to what they teach)
        if (isTeacher && !isAllAccess) {
          const mySubs = (agg.teacherSubjects || {})[user.id] || [];
          setAllTeacherSubjects(mySubs);
        }

        // Classes: teacher gets their timetable classes; admin gets all
        if (isTeacher && !isAllAccess && classesRes) {
          const teacherClasses = await classesRes.json();
          setClasses(Array.isArray(teacherClasses) ? teacherClasses : []);
        } else {
          setClasses(agg.classes || []);
        }

        if (isEditMode) {
          const examRes = await fetch(`${API_BASE_URL}/admin/exams/${examToEdit.id}`);
          const examData = await examRes.json();
          if (cancel) return;
          setDetails({
            title: examData.title || '',
            description: examData.description || '',
            class_id: examData.class_id ? String(examData.class_id) : '',
            section: examData.section || '',
            subject_id: examData.subject_id ? String(examData.subject_id) : '',
            teacher_id: examData.teacher_id ? String(examData.teacher_id) : '',
            time_limit_mins: examData.time_limit_mins || 0,
            status: examData.status || 'published'
          });
          const qs = (examData.questions || []).map((q, idx) => ({
            id: q.id || idx,
            question_text: q.question_text || '',
            question_type: q.question_type || 'multiple_choice',
            options: q.options || { A: '', B: '', C: '', D: '' },
            correct_answer: q.correct_answer || '',
            marks: q.marks || 1
          }));
          setQuestions(qs.length ? qs : [newQuestion()]);
        }
      } catch (e) { console.error('bootstrap:', e); }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, [examToEdit, isEditMode, user, isTeacher, isAllAccess]);

  // Filtered subjects when teacher (only their assigned subjects)
  const availableSubjects = useMemo(() => {
    if (isAllAccess || !isTeacher) return subjects;
    if (allTeacherSubjects.length === 0) return subjects;
    return subjects.filter(s => allTeacherSubjects.includes(s.id));
  }, [subjects, isAllAccess, isTeacher, allTeacherSubjects]);

  // Reverse lookup: which teacher teaches this subject (first match wins)
  const teacherForSubject = (subjectId) => {
    if (!subjectId) return '';
    const sid = parseInt(subjectId, 10);
    for (const [tid, subs] of Object.entries(teacherSubjects)) {
      if ((subs || []).map(Number).includes(sid)) return String(tid);
    }
    return '';
  };

  // Subject change -> auto-select teacher (still editable afterwards)
  const handleSubjectChange = (val) => {
    setDetails(d => ({ ...d, subject_id: val, teacher_id: teacherForSubject(val) || d.teacher_id }));
  };

  // Class change -> clear subject + teacher (Homework behaviour)
  const handleClassChange = (val) => {
    setDetails(d => ({ ...d, class_id: val, subject_id: '', teacher_id: '' }));
  };

  // -----------------------------------------------------------------
  // Question manipulation
  // -----------------------------------------------------------------
  const addQuestion = () => setQuestions(prev => [...prev, newQuestion()]);
  const removeQuestion = (id) => setQuestions(prev => prev.filter(q => q.id !== id));

  const updateQuestion = (id, field, value) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== id) return q;
      const next = { ...q, [field]: value };
      if (field === 'question_type') {
        if (value === 'multiple_choice') {
          next.options = q.options || { A: '', B: '', C: '', D: '' };
          next.correct_answer = q.correct_answer || '';
        } else {
          next.options = null;
          next.correct_answer = null;
        }
      }
      return next;
    }));
  };

  const updateOption = (id, key, value) =>
    setQuestions(prev => prev.map(q =>
      q.id === id ? { ...q, options: { ...q.options, [key]: value } } : q
    ));

  // -----------------------------------------------------------------
  // Save
  // -----------------------------------------------------------------
  const handleSave = async () => {
    if (!details.title.trim()) return alert('Title is required.');
    if (!details.class_id) return alert('Pick a class.');
    if (questions.length === 0) return alert('Add at least one question.');

    for (const q of questions) {
      if (!q.question_text.trim()) return alert('Every question needs text.');
      if (q.question_type === 'multiple_choice') {
        const filled = Object.values(q.options || {}).filter(v => v.trim()).length;
        if (filled < 2) return alert('MCQ needs at least 2 options.');
        if (!q.correct_answer) return alert('MCQ needs a correct answer.');
      }
    }

    setSaving(true);
    try {
      const sanitized = questions.map(q => ({
        question_text: q.question_text.trim(),
        question_type: q.question_type,
        marks: parseInt(q.marks, 10) || 1,
        options: q.question_type === 'multiple_choice' ? q.options : null,
        correct_answer: q.question_type === 'multiple_choice' ? q.correct_answer : null
      }));

      const body = {
        institutionId: user.institutionId,
        title: details.title.trim(),
        description: details.description.trim() || null,
        class_id: parseInt(details.class_id, 10),
        section: details.section.trim() || null,
        subject_id: details.subject_id ? parseInt(details.subject_id, 10) : null,
        teacher_id: details.teacher_id ? parseInt(details.teacher_id, 10) : null,
        time_limit_mins: parseInt(details.time_limit_mins, 10) || 0,
        status: details.status,
        created_by: user.id,
        actor_id: user.id,
        questions: sanitized
      };

      const url = isEditMode
        ? `${API_BASE_URL}/admin/exams/${examToEdit.id}`
        : `${API_BASE_URL}/admin/exams`;
      const res = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      alert(`Exam ${isEditMode ? 'updated' : 'created'}.`);
      onFinish();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }

  const totalMarks = questions.reduce((s, q) => s + (parseInt(q.marks, 10) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button onClick={onFinish}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900 transition-colors w-fit">
          <ArrowLeft className="size-4" /> Cancel
        </button>

        <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
          <button onClick={onFinish} disabled={saving}
            className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors flex-1 sm:flex-none">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors flex-1 sm:flex-none">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {saving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Exam')}
          </button>
        </div>
      </div>

      {isEditMode && examToEdit?.submission_count > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed">
            This exam has <strong className="font-semibold">{examToEdit.submission_count}</strong> submission(s).
            Removing or restructuring questions will affect existing graded scores.
          </div>
        </div>
      )}

      {/* Details card */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <h2 className="text-sm font-semibold text-zinc-900">Exam Details</h2>
        </div>

        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <FormField label="Title" required>
            <input value={details.title} onChange={e => setDetails({ ...details, title: e.target.value })}
              placeholder="e.g. Mid-Term Physics Test" className={inputCls} />
          </FormField>
          
          <FormField label="Time Limit (minutes)">
            <input type="number" min="0" value={details.time_limit_mins}
              onChange={e => setDetails({ ...details, time_limit_mins: e.target.value })}
              placeholder="0 = no limit" className={inputCls} />
          </FormField>

          <FormField label="Class" required>
            <div className="relative">
              <select value={details.class_id} onChange={e => handleClassChange(e.target.value)}
                className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                <option value="">Select class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.className}{c.section ? ` - ${c.section}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {isTeacher && !isAllAccess && classes.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1 font-medium">You are not assigned to any class in the Timetable.</p>
            )}
          </FormField>

          <FormField label="Section (optional)">
            <input value={details.section} onChange={e => setDetails({ ...details, section: e.target.value })}
              placeholder="Leave blank for all sections" className={inputCls} />
          </FormField>

          <FormField label="Subject">
            <div className="relative">
              <select value={details.subject_id} onChange={e => handleSubjectChange(e.target.value)}
                className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                <option value="">- Optional -</option>
                {availableSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </FormField>

          <FormField label="Teacher">
            <div className="relative">
              <select value={details.teacher_id} onChange={e => setDetails({ ...details, teacher_id: e.target.value })}
                className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                <option value="">- Optional -</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Auto-fills from the subject; you can override.</p>
          </FormField>

          <FormField label="Status">
            <div className="relative">
              <select value={details.status} onChange={e => setDetails({ ...details, status: e.target.value })}
                className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                <option value="published">Published (students can attempt)</option>
                <option value="draft">Draft (hidden from students)</option>
                <option value="closed">Closed (no new attempts)</option>
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </FormField>

          <div className="md:col-span-2">
            <FormField label="Description (optional)">
              <textarea value={details.description}
                onChange={e => setDetails({ ...details, description: e.target.value })}
                rows={2} placeholder="Brief context for students..." 
                className={`${inputCls} h-auto py-2 min-h-[80px] resize-none`} />
            </FormField>
          </div>
        </div>
      </div>

      {/* Questions card */}
      <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 sm:p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/50">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Questions</h2>
            <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
              {questions.length} question{questions.length === 1 ? '' : 's'} | {totalMarks} total marks
            </p>
          </div>
          <button onClick={addQuestion} type="button"
            className="h-8 px-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors w-full sm:w-auto shrink-0">
            <Plus className="size-3.5" /> Add Question
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 bg-zinc-50/30">
          {questions.map((q, idx) => (
            <QuestionEditor key={q.id} index={idx} question={q}
              onChange={(field, value) => updateQuestion(q.id, field, value)}
              onOptionChange={(key, value) => updateOption(q.id, key, value)}
              onRemove={() => removeQuestion(q.id)} />
          ))}
          {questions.length === 0 && (
            <div className="border border-dashed border-zinc-300 bg-white rounded-lg p-8 text-center italic text-zinc-400 text-sm font-medium">
              No questions - click "Add Question" above.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions Duplicate for convenience on long forms */}
      {questions.length > 2 && (
        <div className="flex justify-end gap-3 pb-8">
          <button onClick={handleSave} disabled={saving}
            className="h-10 px-8 bg-primary hover:bg-primary/90 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-md font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Exam')}
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================================
//  QuestionEditor - single question card in the editor
// =====================================================================
function QuestionEditor({ index, question, onChange, onOptionChange, onRemove }) {
  return (
    <div className="bg-white ring-1 ring-zinc-200 rounded-lg p-4 sm:p-6 relative group transition-all hover:ring-zinc-300 hover:shadow-sm">
      <button onClick={onRemove} type="button"
        className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 rounded p-1 transition-colors sm:opacity-0 sm:group-hover:opacity-100" title="Remove Question">
        <X className="size-4" />
      </button>

      <div className="flex items-center gap-2.5 mb-4">
        <span className="size-6 rounded-md bg-zinc-100 ring-1 ring-zinc-200 text-zinc-600 text-[11px] font-semibold flex items-center justify-center shrink-0">
          Q{index + 1}
        </span>
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Question Configuration</span>
      </div>

      <div className="space-y-4 sm:pr-8">
        <textarea value={question.question_text} onChange={e => onChange('question_text', e.target.value)}
          rows={2} placeholder="Enter the question..."
          className={`${inputCls} h-auto py-2 min-h-[60px] resize-none`} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Question Type">
            <div className="relative">
              <select value={question.question_type} onChange={e => onChange('question_type', e.target.value)}
                className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                <option value="multiple_choice">Multiple Choice (auto-graded)</option>
                <option value="short_answer">Written Answer (manual grading)</option>
              </select>
              <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </FormField>
          
          <FormField label="Marks">
            <input type="number" min="1" value={question.marks}
              onChange={e => onChange('marks', e.target.value)} className={inputCls} />
          </FormField>
        </div>

        {question.question_type === 'multiple_choice' && question.options && (
          <div className="space-y-3 pt-2 border-t border-zinc-100 mt-4">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Options</label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.keys(question.options).map(key => (
                <div key={key} className="flex items-center gap-2">
                  <span className="size-8 rounded-md bg-zinc-50 ring-1 ring-zinc-200 text-xs font-semibold text-zinc-500 flex items-center justify-center shrink-0">
                    {key}
                  </span>
                  <input value={question.options[key]} placeholder={`Option ${key}...`}
                    onChange={e => onOptionChange(key, e.target.value)}
                    className={`${inputCls} flex-1`} />
                </div>
              ))}
            </div>

            <div className="pt-2">
              <FormField label="Correct Answer">
                <div className="relative sm:w-1/2">
                  <select value={question.correct_answer} onChange={e => onChange('correct_answer', e.target.value)}
                    className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
                    <option value="">Pick correct option...</option>
                    {Object.keys(question.options).map(key =>
                      question.options[key].trim() && (
                        <option key={key} value={key}>{key} - {question.options[key]}</option>
                      ))}
                  </select>
                  <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </FormField>
            </div>
          </div>
        )}

        {question.question_type === 'short_answer' && (
          <div className="bg-blue-50/50 border border-blue-100/50 rounded-lg p-3 text-xs font-medium text-blue-700 flex gap-2.5 mt-4">
            <Info className="size-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">Written answers are graded manually after students submit. They will not be auto-scored.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------
const inputCls = 'h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors';

function FormField({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
        {label}{required && <span className="text-accent">*</span>}
      </label>
      {children}
    </div>
  );
}