import React, { useState } from 'react';
import { HelpCircle, X, ShieldCheck } from 'lucide-react';

// =====================================================================
//  HwHelp — the Homework "How to use" button + guide, in one place.
//
//  Both TeacherHomework and StudentHomework render this, so the two
//  screens can't drift apart. Drop it in a header:
//     <HomeworkHelp topic="list" canManage={canManage} />
//
//  Topics: 'list' | 'submissions' (teacher side) · 'student'
// =====================================================================

const GUIDES = {
  list: {
    title: 'Creating homework',
    steps: [
      ['1 \u00b7 Pick the type first', 'PDF / File Upload means students attach a file. Written / Text Answer gives them a typing screen inside the app. It decides how they answer, so get it right before you save \u2014 a Written task can\u2019t be answered with a photo of a notebook.'],
      ['2 \u00b7 Title, Class and Due Date', 'Those three are required. The class decides who sees it \u2014 every student in that class gets it.'],
      ['3 \u00b7 Subject and Teacher', 'The subject list narrows to the class you chose (a subject with no class links counts as available to all). Picking a subject auto-fills the Teacher from your Subjects mapping \u2014 change it if someone else set the work.'],
      ['4 \u00b7 Questions and attachments', 'Add questions one by one \u2014 students see them numbered, and they sit beside the answer box on the Written screen. Attach PDFs or images up to 5 MB each for worksheets or reference material.'],
      ['5 \u00b7 Finding it later', 'Search by title, class or subject, and narrow with the Class and Subject filters. Created By shows who set it, with the IST time.'],
      ['6 \u00b7 Submissions', 'The count in the list is how many have come in. Submissions opens the class roster \u2014 who has turned it in and who hasn\u2019t.'],
    ],
    note: 'Deleting homework deletes every submission with it \u2014 students lose their work and it cannot be recovered. To fix a mistake, use Edit instead.'
  },
  submissions: {
    title: 'Reviewing & grading',
    steps: [
      ['1 \u00b7 The whole class, roll-wise', 'Every student in the class is listed, not just those who submitted \u2014 so the gaps are the point. Submitted shows the date it came in; Not submitted is a plain grey dot.'],
      ['2 \u00b7 All / Submitted / Pending', 'Pending is your chase list. Search by name or roll number to jump to one student.'],
      ['3 \u00b7 Open a submission', 'Grade shows the questions again for context, then their typed answer or their files \u2014 click a file to read it here, no download needed.'],
      ['4 \u00b7 Grade and feedback', 'Grade is free text, so use whatever your school uses \u2014 A+, 18/20, Good. Remarks are the feedback the student reads, so make them specific.'],
      ['5 \u00b7 Grading locks it', 'Once you submit a grade, the student can no longer edit or delete their submission. Grade when you\u2019re finished reviewing \u2014 not as a placeholder.'],
    ],
    note: 'You can update a grade later \u2014 the student\u2019s submission stays locked, but your grade and remarks can change as often as you need.'
  },
  student: {
    title: 'Doing your homework',
    steps: [
      ['1 \u00b7 The list', 'Pending work sits at the top. All, Pending and Completed filter it. A red due date means it\u2019s overdue \u2014 you can still submit.'],
      ['2 \u00b7 Read it properly', 'Tap an assignment to see the description, the numbered questions, and any files your teacher attached. Tap a file to read it right here.'],
      ['3 \u00b7 Two ways to answer', 'Written opens a full screen with the questions on one side and your answer on the other \u2014 type and Submit Answer. PDF means Submit Homework and pick your files, up to 5 MB each.'],
      ['4 \u00b7 You can change your mind', 'Until your teacher grades it, you can edit your answer, resubmit your files, or delete the submission and start again.'],
      ['5 \u00b7 Once it\u2019s graded', 'Your grade and your teacher\u2019s remarks appear on the assignment, and the submission locks \u2014 nothing more to do.'],
    ],
    note: 'Submit before the due date where you can. If a file won\u2019t upload, it is almost always over 5 MB \u2014 compress it or split it, and photograph pages one at a time rather than in one large scan.'
  }
};

export default function HomeworkHelp({ topic = 'list', canManage = true, className = '' }) {
  const [open, setOpen] = useState(false);

  // A read-only staff member sees the roster but can't grade — the "grading
  // locks it" advice would be misleading, so send them to the list guide.
  const key = (topic === 'submissions' && !canManage) ? 'list' : topic;
  const content = GUIDES[key] || GUIDES.list;

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 self-start ${className}`}>
        <HelpCircle className="size-3.5" /> How to use
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
              <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X className="size-5" /></button>
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
      )}
    </>
  );
}