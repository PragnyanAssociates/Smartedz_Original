import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  IndianRupee, Percent, Landmark, ReceiptText, BellRing, CalendarDays, Wallet,
  LayoutDashboard, BadgePercent, HelpCircle, X, ShieldCheck
} from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { usePermissions } from '../../Screens/PermissionsContext';
import { ClosedYearBadge } from './FeeYear';
import FeeAssign   from './FeeAssign';
import Concession  from './Concession';
import Account     from './Account';
import Payments    from './Payments';
import Alerts      from './Alerts';
import FeeCalendar from './FeeCalendar';
import Collection  from './Collection';
import FeeDashboard from './FeeDashboard';
import MyFee       from './MyFee';

// Must match the module_name used in Modules.js / the Permissions matrix.
const MODULE_NAME = 'FeeManagement';

// =====================================================================
//  FeeManagement
//  Owns the ACADEMIC YEAR for the whole module. Fee Assign, Concessions,
//  Paid/Unpaid and Alerts all read the one /fees/data payload, so the
//  year has to live here — each tab renders the picker in its own filter
//  row and they all move together.
//
//  Selecting a year that isn't the active one puts the module in
//  read-only mode: a closed year is history, and editing it would
//  rewrite what you already collected and reported. The server enforces
//  the same rule, so this isn't just a UI courtesy.
// =====================================================================
export default function FeeManagement() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const can = permissions?.can;
  const isAllAccess = !!permissions?.isAllAccess;

  const isStudent = (user?.role || '').toLowerCase().includes('student');
  const canEdit   = can ? can(MODULE_NAME, 'edit')   : true;
  const canDelete = can ? can(MODULE_NAME, 'delete') : true;
  // The guide is written for whoever actually runs the fee desk — read-only
  // roles don't see it.
  const fullAccess = isAllAccess || (canEdit && canDelete);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [help, setHelp] = useState(false);
  const [yearId, setYearId] = useState('');   // '' until /fees/data reports the active year
  const [data, setData] = useState({
    academic_year_id: null, active_year_id: null, academic_years: [], institution: null,
    classes: [], students: [], plans: [], installments: [], assignments: []
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.institutionId || isStudent) return;
    setLoading(true);
    try {
      const qs = yearId ? `?year=${encodeURIComponent(yearId)}` : '';
      const res = await fetch(`${API_BASE_URL}/fees/data/${user.institutionId}${qs}`);
      const json = await res.json();
      setData(json || {});
      // First load: the server answers with the active year — adopt it.
      if (!yearId && json?.academic_year_id) setYearId(String(json.academic_year_id));
    } catch (e) {
      console.error('Fee data fetch error:', e);
    }
    setLoading(false);
  }, [user, isStudent, yearId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const years        = data.academic_years || [];
  const activeYearId = data.active_year_id ?? null;
  const isActiveYear = yearId !== '' && String(yearId) === String(activeYearId);
  const yearName     = useMemo(
    () => (years.find(y => String(y.id) === String(yearId)) || {}).name || '',
    [years, yearId]
  );

  // ---- Student self-view ----
  if (isStudent) return <MyFee user={user} />;

  // Writes are only allowed on the active year — server enforces this too.
  const effectiveCanEdit = canEdit && isActiveYear;

  const yearProps = { years, yearId, setYearId, isActiveYear, yearName, activeYearId };

  // ---- Management view (admin / permitted staff) ----
  const tabs = [
    { id: 'dashboard',  label: 'Fee Dashboard', icon: LayoutDashboard },
    { id: 'assign',     label: 'Fee Assign',    icon: IndianRupee },
    { id: 'concession', label: 'Fee Concessions',    icon: BadgePercent },
    { id: 'account',    label: 'Account Details',       icon: Landmark },
    { id: 'payments',   label: 'Payments',      icon: ReceiptText },
    { id: 'collection', label: 'Paid / Unpaid', icon: Wallet },
    { id: 'alerts',     label: 'Alerts',        icon: BellRing },
    { id: 'calendar',   label: 'Fee Calendar',  icon: CalendarDays },
  ];
  const tabProps = { data, fetchData, user, canEdit: effectiveCanEdit, ...yearProps };

  return (
    <div className="p-8 max-w-[1440px] w-full mx-auto animate-in fade-in duration-700">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Fee Management</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Manage the Fee payments student wise & Class wise.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!canEdit && (
            <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              View only
            </span>
          )}
          {canEdit && !isActiveYear && yearId !== '' && <ClosedYearBadge yearName={yearName} />}
          {fullAccess && (
            <button onClick={() => setHelp(true)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors">
              <HelpCircle className="size-3.5" /> How to use
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-zinc-200 pb-4">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === t.id ? 'bg-primary text-white' : 'text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
            }`}>
            <t.icon className="size-3.5 shrink-0" /> {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="size-8 border-4 border-zinc-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'dashboard'  && <FeeDashboard user={user} school={data.institution} {...yearProps} />}
            {activeTab === 'assign'     && <FeeAssign {...tabProps} />}
            {activeTab === 'concession' && <Concession {...tabProps} />}
            {activeTab === 'account'    && <Account user={user} canEdit={canEdit} />}
            {activeTab === 'payments'   && <Payments {...tabProps} />}
            {activeTab === 'collection' && <Collection {...tabProps} />}
            {activeTab === 'alerts'     && <Alerts {...tabProps} />}
            {activeTab === 'calendar'   && <FeeCalendar {...tabProps} />}
          </>
        )}
      </div>

      {help && fullAccess && <HelpModal tab={activeTab} onClose={() => setHelp(false)} />}
    </div>
  );
}

// =====================================================================
//  How-to-use notes — the guide follows the tab you're standing on, so
//  it always answers "what do I do on THIS screen?". Same shell as the
//  Transport module guide.
// =====================================================================
const GUIDES = {
  dashboard: {
    title: 'Reading the fee dashboard',
    steps: [
      ['1 \u00b7 The four KPIs', 'Expected, Collected, Outstanding and Collection Rate % \u2014 where the school stands before you open anything else.'],
      ['2 \u00b7 Academic Year', 'Opens on your active year. Switch it to look back at a previous year \u2014 every tab in Fee Management follows, so you stay on one year throughout. There is no "all years": Expected is built from a year\'s plans against each student\'s current class, so mixing years would report a meaningless total.'],
      ['3 \u00b7 Fee and Class', 'Narrow further. Without them you are looking at Academic Fee, Books, Library and the rest mixed together. Pick one fee, then drill by class.'],
      ['4 \u00b7 The donuts', 'Students Paid vs Unpaid (partial payers are noted separately) and Collection by Method \u2014 Online against Offline.'],
      ['5 \u00b7 The trends', 'Monthly Collection is the last six months in IST. Collection by Fee and Collection by Class are collected-against-expected bars that turn green once a fee or class is fully collected.'],
      ['6 \u00b7 Download', 'Prints the whole dashboard \u2014 KPIs and every chart \u2014 on your school letterhead, with the year and filters noted at the top. Choose "Save as PDF" as the printer for a file, or send it straight to paper for a meeting.'],
    ],
    note: 'Read-only. Every figure comes from Fee Assign (expected) and Payments (collected) \u2014 if a number looks wrong, one of those two is where it gets fixed. If nothing opens on Download, allow pop-ups for this site.'
  },
  assign: {
    title: 'Setting up fees',
    steps: [
      ['1 \u00b7 Check the year first', 'Fees belong to an academic year \u2014 students pay afresh each year. The picker opens on your active year, and only the active year can be edited. A previous year shows for reference but is locked.'],
      ['2 \u00b7 Start with the class', 'Pick a class, then set its fee structure. Every school runs different classes, so each one carries its own amounts.'],
      ['3 \u00b7 Full fee and due date', 'Set the full fee for the year and the date it falls due. That date is what the Fee Calendar plots and what the Alerts rules fire against.'],
      ['4 \u00b7 Installments are optional', 'If the class pays in parts, add installment rows \u2014 each with its own label, amount and due date. The total is checked live against the full fee, so the parts must add up.'],
      ['5 \u00b7 Assign the plan per student', 'A structure isn\'t a bill until a student is on it. Give each student Full or Installment \u2014 two students in the same class can be on different plans.'],
      ['6 \u00b7 Get this right first', 'Everything downstream reads from here: Expected on the Dashboard, the Paid / Unpaid roster, the Calendar and the Alerts. A student with no plan simply owes nothing.'],
    ],
    note: 'Rolling into a new year: set it active in Manage Logins \u2192 Academics Year, then build the new structure. Last year\'s fees, payments and concessions stay exactly as they were \u2014 nothing is overwritten.'
  },
  concession: {
    title: 'Granting a concession',
    steps: [
      ['1 \u00b7 One year at a time', 'A concession applies to the selected academic year only. Next year the student starts on the full fee again unless you grant it afresh.'],
      ['2 \u00b7 Per student, not per class', 'Filter to a class, then give the individual student their concession amount. A reason is optional but worth writing \u2014 it is the only record of why the fee was reduced.'],
      ['3 \u00b7 The maths', 'Full Fee \u2212 Concession = Net Payable, shown on the row. Net Payable is what the student actually owes and what the Paid / Unpaid roster measures against.'],
      ['4 \u00b7 Change or remove', 'Edit the amount and Save; set it to 0 to put the student back on the full fee.'],
    ],
    note: 'A concession lowers what is expected from that student, so it moves Expected and Outstanding on the Dashboard too. It is not a payment \u2014 it never shows in Payments.'
  },
  account: {
    title: 'Payment accounts',
    steps: [
      ['1 \u00b7 Your school\'s own gateway', 'Online Payments (Razorpay): your display name, Key ID and Key Secret, plus the enable toggle. Every school uses its own account \u2014 the money goes straight to you.'],
      ['2 \u00b7 Live keys move real money', 'Test keys exercise the flow but settle nothing. Switch to Live keys with your Razorpay activation done before you tell parents to pay.'],
      ['3 \u00b7 Offline', 'Offline Payments (cash at office): the toggle plus your instructions. Whatever you write here is what the student reads before uploading their slip \u2014 be specific about where and when to pay.'],
      ['4 \u00b7 Turning one off', 'Disabling a method removes it from the student\'s My Fee screen. Leave at least one on, or nobody can pay.'],
    ],
    note: 'This screen has no academic year \u2014 your gateway and office instructions carry across years. The Key Secret is exactly that: treat this screen like your bank login.'
  },
  payments: {
    title: 'Payments & approvals',
    steps: [
      ['1 \u00b7 Online needs nothing from you', 'A gateway-verified payment is recorded as Paid on the spot \u2014 the money is already confirmed, so there is nothing to approve. A student who abandons the popup mid-payment creates no row at all.'],
      ['2 \u00b7 Offline is your job', 'The student uploads a paid slip and it lands here as Pending. Open the proof, check it against your records, then Approve \u2014 or Reject if it doesn\'t hold up.'],
      ['3 \u00b7 Approved means collected', 'Approving turns it Paid and takes that amount off the student\'s balance immediately, across the roster, the Calendar and the Dashboard.'],
      ['4 \u00b7 The trail', '"Approved by \u2039name\u203a" or "Rejected by \u2039name\u203a" sits under the status with the date and time in IST, so every decision has a person against it.'],
      ['5 \u00b7 Finding one', 'The year picker opens on your active year; students only ever pay into the active year, so a previous year is a closed record and its rows can\'t be actioned. Then filter by status, class or date, or search by student or roll.'],
      ['6 \u00b7 Download', 'An Excel file of exactly what your filters show \u2014 IST date and time, student, class, fee, amount, method, status, reference, and who approved or rejected it. Headed with the academic year and totalled at the bottom.'],
    ],
    note: 'Approve only against a slip you can actually verify \u2014 it is the one action here that moves money in the books. Reject also clears out anything stuck in Pending.'
  },
  collection: {
    title: 'Paid / Unpaid roster',
    steps: [
      ['1 \u00b7 Year, fee, class', 'The roster is always one fee for one class in one academic year \u2014 Academic Fee for Class 10, this year. That is the list you can actually act on.'],
      ['2 \u00b7 Unpaid', 'Who still owes, with Total due at the top. This is your follow-up list.'],
      ['3 \u00b7 Paid', 'Who has cleared, with Total collected at the top. Cross-check it against the Dashboard for the same year, fee and class.'],
      ['4 \u00b7 Download', 'Exports the full roster for that fee and class \u2014 paid and unpaid together \u2014 with Roll, Student, Class, Fee, Net Payable, Paid, Balance and status. Opens straight in Excel.'],
    ],
    note: 'Net Payable already has the student\'s concession taken off, so Balance is what they genuinely owe \u2014 not the class\'s headline fee. A previous year shows that year\'s roster as it finished.'
  },
  alerts: {
    title: 'Fee reminders',
    steps: [
      ['1 \u00b7 Rules live in a year', 'Reminders fire against the due dates from Fee Assign, which are per academic year \u2014 so the rules are too. Each new year needs its own rules; a closed year\'s rules stay as history and never send.'],
      ['2 \u00b7 Auto', 'Rules that fire on their own \u2014 before the due date, on the day, or after it. Set them once per class, or leave the class blank for the whole school.'],
      ['3 \u00b7 Write the message', 'Placeholders fill themselves in, so one rule reads correctly for every class. Keep it short \u2014 parents read it on a phone.'],
      ['4 \u00b7 Manual', 'Send now, to a class or to everyone, when something needs saying that no rule covers.'],
      ['5 \u00b7 The log', 'What went out, when, to how many. Check it before chasing anyone by phone \u2014 they may have been reminded already.'],
    ],
    note: 'A rule fires once per due date, so it cannot spam the same parents twice in a day. Reminders follow the due dates in Fee Assign \u2014 if a date is wrong there, the reminder goes out wrong too.'
  },
  calendar: {
    title: 'The fee calendar',
    steps: [
      ['1 \u00b7 Due dates on a month', 'Every full-fee and installment due date laid out, so the collection year reads at a glance instead of class by class.'],
      ['2 \u00b7 Plan around it', 'Heavy dates are where your fee desk will be busy and where the Alerts rules will fire. Spot them before the month starts, not during it.'],
      ['3 \u00b7 Where the dates come from', 'Straight from Fee Assign \u2014 the class full-fee due date and each installment\'s date. Move a date there and it moves here.'],
    ],
    note: 'Times shown are IST. A month with nothing on it means no due dates were set for it \u2014 which may be correct, or may be a class whose structure is still unfinished.'
  }
};

function HelpModal({ tab, onClose }) {
  const content = GUIDES[tab] || GUIDES.dashboard;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
          <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="size-5" /></button>
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
  );
}