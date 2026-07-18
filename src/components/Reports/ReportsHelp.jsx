import React, { useState } from 'react';
import { HelpCircle, X, ShieldCheck } from 'lucide-react';

// =====================================================================
//  ReportsHelp — the "How to use" button + guide for the Reports module.
//
//  Lives in the Reports header, so it stays put across the class list and
//  every sub-view. The guide follows the active tab:
//     setup | marks | cards | student
//
//  Usage:  <ReportsHelp topic={tab} />
// =====================================================================

const GUIDES = {
  setup: {
    title: 'Setting up offline exams',
    steps: [
      ['1 \u00b7 Do this before any marks', 'Exam Setup is the foundation \u2014 exam types and their max marks. Until they exist there is nothing for Marks Entry to enter marks against.'],
      ['2 \u00b7 Exam types', 'Your school\u2019s papers: AT-1, UT-1, SA-1 and so on. Add each one once; every class reuses the same list.'],
      ['3 \u00b7 Max marks', 'Set the maximum per exam type per class, since a UT in Class 3 isn\u2019t out of the same total as Class 10. Where one subject differs from the rest, override it for that subject alone.'],
      ['4 \u00b7 Who enters the marks', 'Map each class + subject to the teacher responsible. That mapping is what puts the right subjects in front of the right teacher in Marks Entry.'],
      ['5 \u00b7 This config is shared across years', 'Exam types and max marks are school-wide settings, not per-year records \u2014 they carry into next year automatically. The marks themselves belong to the academic year in the badge above.'],
    ],
    note: 'Changing a max mark re-bases every percentage already calculated against it \u2014 report cards, Performance and the Overview analytics all shift. Set these at the start of the year and leave them alone; if a paper genuinely changes total, add a new exam type rather than editing an old one.'
  },
  marks: {
    title: 'Entering marks',
    steps: [
      ['1 \u00b7 Pick the class', 'The list shows every class with its total marks so far, its top student and its strongest subject \u2014 a quick read on what has been entered. Search by class name, then open one to enter or edit.'],
      ['2 \u00b7 Enter against an exam type', 'Choose the exam (AT-1, UT-1\u2026) and the subject, then key in each student\u2019s marks. What you can enter is capped by the max marks set in Exam Setup.'],
      ['3 \u00b7 Sort to suit the job', 'Roll number order matches the paper pile in front of you. High \u2192 Low and Low \u2192 High are for reviewing afterwards \u2014 spotting who needs help, or a mark keyed in wrong.'],
      ['4 \u00b7 Editing is normal', 'Entering marks again for the same student, subject and exam updates the mark rather than adding a second one. Correct a mistake by re-entering it.'],
      ['5 \u00b7 Where it flows', 'These marks feed Report Cards, the Performance screens and the Overview analytics. Enter them once, correctly, and the rest of the app follows.'],
    ],
    note: 'Marks are stamped with the ACTIVE academic year in the badge above. If that badge is showing the wrong year, stop \u2014 marks entered now would land in the wrong year\u2019s records. Fix it first in Manage Logins \u2192 Academics Year.'
  },
  cards: {
    title: 'Report cards',
    steps: [
      ['1 \u00b7 Pick the class, then the student', 'Report cards are generated from what is already in the system \u2014 there is nothing to fill in here.'],
      ['2 \u00b7 Marks come from Marks Entry', 'Every subject and exam on the card is what was entered there, with percentages worked out against the max marks from Exam Setup.'],
      ['3 \u00b7 Attendance is automatic', 'Pulled straight from the daily attendance register \u2014 you never type working days or days present. If the attendance looks wrong, the fix is in the Attendance module, not here.'],
      ['4 \u00b7 The bands', 'Green is 80% and above, blue 50\u201380%, red below 50% \u2014 the same thresholds as the Performance screens, so the two always agree.'],
      ['5 \u00b7 Before you print', 'A blank subject means no marks were entered for it, not a zero. Check Marks Entry is complete for the class before you hand cards out.'],
    ],
    note: 'Cards show the academic year in the badge above, and alumni are left out. Students see their own card under My Report Card the moment the marks are in \u2014 there is no publish step.'
  },
  student: {
    title: 'Your report card',
    steps: [
      ['Your marks', 'Every exam and subject your teachers have entered, with your percentage worked out against each paper\u2019s total.'],
      ['Your attendance', 'Taken automatically from the daily register \u2014 the days your school marked, and how many of them you were present for.'],
      ['Reading the colours', 'Green is 80% and above, blue is 50\u201380%, red is below 50%.'],
      ['Blanks', 'A subject with nothing against it just means those marks haven\u2019t been entered yet \u2014 it is not a zero.'],
    ],
    note: 'This is built from what your school enters and is read-only. If a mark or a day looks wrong, tell your class teacher \u2014 they can correct it and your card updates on its own.'
  }
};

export default function ReportsHelp({ topic = 'marks', className = '' }) {
  const [open, setOpen] = useState(false);
  const content = GUIDES[topic] || GUIDES.marks;

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