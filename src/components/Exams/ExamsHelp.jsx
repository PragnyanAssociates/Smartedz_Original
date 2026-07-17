import React, { useState } from 'react';
import { HelpCircle, X, ShieldCheck } from 'lucide-react';

// =====================================================================
//  ExamsHelp — the "How to use" button + guide for the Exams module.
//
//  Lives in the Exams header, so it stays put across every sub-view
//  (schedule detail, exam submissions, grading). The guide follows the
//  active tab and the person's role:
//     schedules | exams | student-schedules | student-exams
// =====================================================================

const GUIDES = {
  schedules: {
    title: 'Publishing an exam schedule',
    steps: [
      ['1 \u00b7 Two kinds of schedule', 'School Exams is your own timetable \u2014 date, subject, time, room, per class. Govt Schedule is the board\u2019s: an exam name with a from/to date range, no periods or rooms. Pick the type first; it changes the whole row layout.'],
      ['2 \u00b7 Title and subtitle', 'Title is what everyone sees (e.g. Final Term Exam). Subtitle is free text and it is the only place a term or year is recorded \u2014 exam schedules aren\u2019t tied to an academic year \u2014 so write "Term I \u00b7 2026-2027" and next year\u2019s schedule can\u2019t be confused with this one.'],
      ['3 \u00b7 One schedule per class', 'The class you pick decides who sees it. Two classes sitting different papers need two schedules.'],
      ['4 \u00b7 Add the rows', 'Add Row for each paper: date, subject, time and room. Type the time as HH:MM and pick AM / PM \u2014 there is no clock picker, so it is quick to key in.'],
      ['5 \u00b7 Special Row', 'A highlighted full-width row for anything that isn\u2019t a paper \u2014 Holiday, Sunday, Study Leave. Main text is the heading, sub text is the detail. It sits in the list in date order like everything else.'],
      ['6 \u00b7 Check it before parents do', 'The eye opens the schedule exactly as students see it. Read it there once \u2014 a wrong date on a printed exam timetable is a phone-call afternoon.'],
    ],
    note: 'Students see the schedule for their own class the moment you save \u2014 there is no draft state. Delete removes it for everyone straight away.'
  },
  exams: {
    title: 'Online exams',
    steps: [
      ['1 \u00b7 What this is', 'A real test students sit inside the app \u2014 not a timetable. Create Online Exam builds the paper: questions, marks and the time limit.'],
      ['2 \u00b7 Read the list', 'Each row shows the question count, total marks and the time limit (or No limit), plus who created it and when in IST. The submissions pill tells you how many have come in.'],
      ['3 \u00b7 Editing after it\u2019s live', 'Once students have started, changing questions or marks changes what they are sitting. Check the submissions count before you edit.'],
      ['4 \u00b7 Submissions', 'The eye lists everyone who attempted it with their status \u2014 in progress, submitted, or graded. Search by name or roll number.'],
      ['5 \u00b7 Grading', 'Grade opens the attempt. Anything auto-marked is scored already; written answers are yours to mark. The score shows against the exam total once graded, and Update lets you revise it later.'],
    ],
    note: 'Deleting an exam deletes every attempt with it \u2014 students\u2019 answers and their marks go too, and it cannot be undone.'
  },
  'student-schedules': {
    title: 'Your exam timetable',
    steps: [
      ['Your class only', 'You see the schedules published for your class. School Exams are your school\u2019s own papers; Govt Schedule is the board\u2019s dates.'],
      ['Read the whole thing', 'Tap a schedule to open it \u2014 every paper with its date, time and room, in order.'],
      ['Highlighted rows', 'A coloured row across the table is a note from your school \u2014 a holiday or a study day, not a paper.'],
    ],
    note: 'Your school publishes this and can change it. Check back before each paper rather than trusting a screenshot you took last week.'
  },
  'student-exams': {
    title: 'Taking an online exam',
    steps: [
      ['What you\u2019ll see', 'The exams set for your class, with the marks and the time limit before you begin.'],
      ['Before you start', 'A timed exam starts counting as soon as you open it \u2014 so start when you\u2019re ready, somewhere with a steady connection, not on the move.'],
      ['Answering', 'Work through the questions and submit before the time runs out.'],
      ['Your result', 'Some answers are marked automatically; anything written is marked by your teacher, so your score appears once they\u2019ve finished.'],
    ],
    note: 'If something goes wrong during an exam, tell your teacher straight away rather than starting again \u2014 they can see your attempt.'
  }
};

export default function ExamsHelp({ topic = 'schedules', canManage = true, className = '' }) {
  const [open, setOpen] = useState(false);

  // A read-only staff member can look but not create, edit or grade — the
  // setup steps would just be noise, so send them to the student-side guide.
  const key = !canManage && topic === 'schedules' ? 'student-schedules'
            : !canManage && topic === 'exams'     ? 'student-exams'
            : topic;
  const content = GUIDES[key] || GUIDES.schedules;

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