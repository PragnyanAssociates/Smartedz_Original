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

export default function FeeManagement() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const can = permissions?.can;
  const isAllAccess = !!permissions?.isAllAccess;

  const isStudent = (user?.role || '').toLowerCase().includes('student');
  const canEdit   = can ? can(MODULE_NAME, 'edit')   : true;
  const canDelete = can ? can(MODULE_NAME, 'delete') : true;
  
  const fullAccess = isAllAccess || (canEdit && canDelete);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [help, setHelp] = useState(false);
  const [yearId, setYearId] = useState('');
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

  if (isStudent) return <MyFee user={user} />;

  const effectiveCanEdit = canEdit && isActiveYear;

  const yearProps = { years, yearId, setYearId, isActiveYear, yearName, activeYearId };

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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Fee Management</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">
            Manage the Fee payments student wise & Class wise.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!canEdit && (
            <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
              View only
            </span>
          )}
          {canEdit && !isActiveYear && yearId !== '' && <ClosedYearBadge yearName={yearName} />}
          {fullAccess && (
            <button onClick={() => setHelp(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 shrink-0 text-xs font-medium text-zinc-600 hover:text-primary border border-zinc-200 rounded-md hover:bg-zinc-50 transition-colors">
              <HelpCircle className="size-4" /> How to use
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-zinc-200 pb-4">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === t.id ? 'bg-primary text-white border border-primary' : 'text-zinc-600 hover:bg-zinc-50 border border-zinc-200 bg-white'
            }`}>
            <t.icon className="size-3.5 shrink-0" /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-[500px]">
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

const GUIDES = {
  dashboard: {
    title: 'Reading the fee dashboard',
    steps: [
      ['1 - The four KPIs', 'Expected, Collected, Outstanding and Collection Rate % - where the school stands before you open anything else.'],
      ['2 - Academic Year', 'Opens on your active year. Switch it to look back at a previous year - every tab in Fee Management follows, so you stay on one year throughout. There is no "all years": Expected is built from a year\'s plans against each student\'s current class, so mixing years would report a meaningless total.'],
      ['3 - Fee and Class', 'Narrow further. Without them you are looking at Academic Fee, Books, Library and the rest mixed together. Pick one fee, then drill by class.'],
      ['4 - The donuts', 'Students Paid vs Unpaid (partial payers are noted separately) and Collection by Method - Online against Offline.'],
      ['5 - The trends', 'Monthly Collection is the last six months in IST. Collection by Fee and Collection by Class are collected-against-expected bars that turn green once a fee or class is fully collected.'],
      ['6 - Download', 'Prints the whole dashboard - KPIs and every chart - on your school letterhead, with the year and filters noted at the top. Choose "Save as PDF" as the printer for a file, or send it straight to paper for a meeting.'],
    ],
    note: 'Read-only. Every figure comes from Fee Assign (expected) and Payments (collected) - if a number looks wrong, one of those two is where it gets fixed. If nothing opens on Download, allow pop-ups for this site.'
  },
  assign: {
    title: 'Setting up fees',
    steps: [
      ['1 - Check the year first', 'Fees belong to an academic year - students pay afresh each year. The picker opens on your active year, and only the active year can be edited. A previous year shows for reference but is locked.'],
      ['2 - Start with the class', 'Pick a class, then set its fee structure. Every school runs different classes, so each one carries its own amounts.'],
      ['3 - Full fee and due date', 'Set the full fee for the year and the date it falls due. That date is what the Fee Calendar plots and what the Alerts rules fire against.'],
      ['4 - Installments are optional', 'If the class pays in parts, add installment rows - each with its own label, amount and due date. The total is checked live against the full fee, so the parts must add up.'],
      ['5 - Assign the plan per student', 'A structure isn\'t a bill until a student is on it. Give each student Full or Installment - two students in the same class can be on different plans.'],
      ['6 - Get this right first', 'Everything downstream reads from here: Expected on the Dashboard, the Paid / Unpaid roster, the Calendar and the Alerts. A student with no plan simply owes nothing.'],
    ],
    note: 'Rolling into a new year: set it active in Manage Logins -> Academics Year, then build the new structure. Last year\'s fees, payments and concessions stay exactly as they were - nothing is overwritten.'
  },
  concession: {
    title: 'Granting a concession',
    steps: [
      ['1 - One year at a time', 'A concession applies to the selected academic year only. Next year the student starts on the full fee again unless you grant it afresh.'],
      ['2 - Per student, not per class', 'Filter to a class, then give the individual student their concession amount. A reason is optional but worth writing - it is the only record of why the fee was reduced.'],
      ['3 - The maths', 'Full Fee - Concession = Net Payable, shown on the row. Net Payable is what the student actually owes and what the Paid / Unpaid roster measures against.'],
      ['4 - Change or remove', 'Edit the amount and Save; set it to 0 to put the student back on the full fee.'],
    ],
    note: 'A concession lowers what is expected from that student, so it moves Expected and Outstanding on the Dashboard too. It is not a payment - it never shows in Payments.'
  },
  account: {
    title: 'Payment accounts',
    steps: [
      ['1 - Your school\'s own gateway', 'Online Payments (Razorpay): your display name, Key ID and Key Secret, plus the enable toggle. Every school uses its own account - the money goes straight to you.'],
      ['2 - Live keys move real money', 'Test keys exercise the flow but settle nothing. Switch to Live keys with your Razorpay activation done before you tell parents to pay.'],
      ['3 - Offline', 'Offline Payments (cash at office): the toggle plus your instructions. Whatever you write here is what the student reads before uploading their slip - be specific about where and when to pay.'],
      ['4 - Turning one off', 'Disabling a method removes it from the student\'s My Fee screen. Leave at least one on, or nobody can pay.'],
    ],
    note: 'This screen has no academic year - your gateway and office instructions carry across years. The Key Secret is exactly that: treat this screen like your bank login.'
  },
  payments: {
    title: 'Payments & approvals',
    steps: [
      ['1 - Online needs nothing from you', 'A gateway-verified payment is recorded as Paid on the spot - the money is already confirmed, so there is nothing to approve. A student who abandons the popup mid-payment creates no row at all.'],
      ['2 - Offline is your job', 'The student uploads a paid slip and it lands here as Pending. Open the proof, check it against your records, then Approve - or Reject if it doesn\'t hold up.'],
      ['3 - Approved means collected', 'Approving turns it Paid and takes that amount off the student\'s balance immediately, across the roster, the Calendar and the Dashboard.'],
      ['4 - The trail', '"Approved by <name>" or "Rejected by <name>" sits under the status with the date and time in IST, so every decision has a person against it.'],
      ['5 - Finding one', 'The year picker opens on your active year; students only ever pay into the active year, so a previous year is a closed record and its rows can\'t be actioned. Then filter by status, class or date, or search by student or roll.'],
      ['6 - Download', 'An Excel file of exactly what your filters show - IST date and time, student, class, fee, amount, method, status, reference, and who approved or rejected it. Headed with the academic year and totalled at the bottom.'],
    ],
    note: 'Approve only against a slip you can actually verify - it is the one action here that moves money in the books. Reject also clears out anything stuck in Pending.'
  },
  collection: {
    title: 'Paid / Unpaid roster',
    steps: [
      ['1 - Year, fee, class', 'The roster is always one fee for one class in one academic year - Academic Fee for Class 10, this year. That is the list you can actually act on.'],
      ['2 - Unpaid', 'Who still owes, with Total due at the top. This is your follow-up list.'],
      ['3 - Paid', 'Who has cleared, with Total collected at the top. Cross-check it against the Dashboard for the same year, fee and class.'],
      ['4 - Download', 'Exports the full roster for that fee and class - paid and unpaid together - with Roll, Student, Class, Fee, Net Payable, Paid, Balance and status. Opens straight in Excel.'],
    ],
    note: 'Net Payable already has the student\'s concession taken off, so Balance is what they genuinely owe - not the class\'s headline fee. A previous year shows that year\'s roster as it finished.'
  },
  alerts: {
    title: 'Fee reminders',
    steps: [
      ['1 - Rules live in a year', 'Reminders fire against the due dates from Fee Assign, which are per academic year - so the rules are too. Each new year needs its own rules; a closed year\'s rules stay as history and never send.'],
      ['2 - Auto', 'Rules that fire on their own - before the due date, on the day, or after it. Set them once per class, or leave the class blank for the whole school.'],
      ['3 - Write the message', 'Placeholders fill themselves in, so one rule reads correctly for every class. Keep it short - parents read it on a phone.'],
      ['4 - Manual', 'Send now, to a class or to everyone, when something needs saying that no rule covers.'],
      ['5 - The log', 'What went out, when, to how many. Check it before chasing anyone by phone - they may have been reminded already.'],
    ],
    note: 'A rule fires once per due date, so it cannot spam the same parents twice in a day. Reminders follow the due dates in Fee Assign - if a date is wrong there, the reminder goes out wrong too.'
  },
  calendar: {
    title: 'The fee calendar',
    steps: [
      ['1 - Due dates on a month', 'Every full-fee and installment due date laid out, so the collection year reads at a glance instead of class by class.'],
      ['2 - Plan around it', 'Heavy dates are where your fee desk will be busy and where the Alerts rules will fire. Spot them before the month starts, not during it.'],
      ['3 - Where the dates come from', 'Straight from Fee Assign - the class full-fee due date and each installment\'s date. Move a date there and it moves here.'],
    ],
    note: 'Times shown are IST. A month with nothing on it means no due dates were set for it - which may be correct, or may be a class whose structure is still unfinished.'
  }
};

function HelpModal({ tab, onClose }) {
  const content = GUIDES[tab] || GUIDES.dashboard;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
          <span className="text-sm font-semibold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
          <button onClick={onClose} className="flex items-center justify-center size-8 rounded hover:bg-white/10 text-white/80 hover:text-white transition-colors">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {content.steps.map(([t, d], i) => (
            <div key={i} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold text-zinc-800">{t}</p>
              <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
            </div>
          ))}
          <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex items-start gap-3">
            <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-800 leading-relaxed">{content.note}</p>
          </div>
        </div>
      </div>
    </div>
  );
}