import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { FilePlus2, ListChecks, CalendarDays, LayoutDashboard, HelpCircle, X, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import VoucherForm from './VoucherForm';
import Register from './Register';
import ExpensesCalendar from './ExpensesCalendar';
import ExpensesDashboard from './ExpensesDashboard';

const MODULE_NAME = 'DailyExpenses';

export default function DailyExpenses() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const can = permissions?.can;
  const isAllAccess = !!permissions?.isAllAccess;
  const canEdit   = can ? can(MODULE_NAME, 'edit')   : true;
  const canDelete = can ? can(MODULE_NAME, 'delete') : true;
  
  // The guide is written for whoever actually keeps the books - read-only
  // roles don't see it.
  const fullAccess = isAllAccess || (canEdit && canDelete);

  const [tab, setTab]           = useState('dashboard');
  const [editingId, setEditingId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [school, setSchool]     = useState({});
  const [help, setHelp]         = useState(false);
  
  // Academic years for the A.Y filter on the Dashboard + Register.
  const [years, setYears]       = useState([]);
  const [yearsReady, setYearsReady] = useState(false);

  // School name + logo for the voucher header (same source as DashboardHeader).
  useEffect(() => {
    if (!user?.institutionId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
        const data = await res.json();
        if (!alive) return;

        // Academic Year list (source of truth = the Academics Year tab).
        const ay = Array.isArray(data?.academicYears) ? data.academicYears : [];
        setYears(ay);
        setYearsReady(true);

        const inst = data?.institution;
        if (!inst) return;
        const isBranch = !!inst.parent_id;
        const name = isBranch ? (inst.parent_name || inst.name || '') : (inst.name || '');
        setSchool({
          name, branch: isBranch ? (inst.name || '') : '',
          logo: inst.logo || '', email: inst.school_email || '', phone: inst.phone || ''
        });
      } catch {
        if (alive) setYearsReady(true);   // fall back to All Years
      }
    })();
    return () => { alive = false; };
  }, [user]);

  const activeYearId = (years.find(y => y.isActive) || {}).id ?? null;
  const yearProps = { years, activeYearId, yearsReady };

  const newVoucher  = () => { setEditingId(null); setTab('voucher'); };
  const editVoucher = (id) => { setEditingId(id); setTab('voucher'); };
  const onSaved = () => { setEditingId(null); setRefreshKey(k => k + 1); setTab('register'); };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'voucher',  label: editingId ? 'Edit Voucher' : 'New Voucher', icon: FilePlus2 },
    { id: 'register', label: 'Register', icon: ListChecks },
    { id: 'calendar', label: 'Expenses Calendar', icon: CalendarDays },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Daily Expenses</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Record debit vouchers for day-to-day expenses and keep a running register.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!canEdit && <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-600/20 px-2.5 py-1 rounded-full uppercase tracking-wider">View only</span>}
          {fullAccess && (
            <button onClick={() => setHelp(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 shrink-0 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 hover:text-primary transition-colors shadow-sm">
              <HelpCircle className="size-3.5" /> How to use
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-zinc-200 pb-4">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { if (t.id === 'voucher' && tab === 'register') setEditingId(null); setTab(t.id); }}
            className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-primary text-white shadow-sm border border-primary' : 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200 shadow-sm'
            }`}>
            <t.icon className="size-3.5 shrink-0" /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1">
        {tab === 'dashboard' ? (
          <ExpensesDashboard user={user} school={school} {...yearProps} />
        ) : tab === 'voucher' ? (
          <VoucherForm
            key={editingId || 'new'}
            user={user} canEdit={canEdit} editingId={editingId} school={school}
            onSaved={onSaved}
            onCancel={editingId ? () => { setEditingId(null); setTab('register'); } : null}
          />
        ) : tab === 'register' ? (
          <Register
            user={user} canEdit={canEdit} refreshKey={refreshKey}
            onEdit={editVoucher} onNew={newVoucher} {...yearProps}
          />
        ) : (
          <ExpensesCalendar user={user} />
        )}
      </div>

      {help && fullAccess && <HelpModal tab={tab} onClose={() => setHelp(false)} />}
    </div>
  );
}

// =====================================================================
//  How-to-use notes - the guide follows the tab you're standing on, so
//  it always answers "what do I do on THIS screen?". Same shell as the
//  Transport module guide.
// =====================================================================
const GUIDES = {
  dashboard: {
    title: 'Reading the expense dashboard',
    steps: [
      ['1 - The four KPIs', 'Total Spent, Vouchers, Avg per voucher and This Month - the whole picture in one line before you open a single voucher.'],
      ['2 - Filter it', 'Academic Year, Head of A/C and a From / To date range. It opens on your active year, so the figures are this year\'s spend - switch to All Years to see the school\'s whole history. Every KPI and chart recomputes live. Refresh re-pulls from the server.'],
      ['3 - Spending by Head', 'Horizontal bars per head with the amount and the voucher count, so you can see whether a big head is one large payment or fifty small ones.'],
      ['4 - By Method', 'The donut splits spend across UPI, Bank, Cheque, Cash, Kind and Others - handy for tallying against the bank statement.'],
      ['5 - Monthly Spending', 'A fixed six-month bar trend, so this month always reads against the months behind it.'],
      ['6 - Download', 'Prints the whole dashboard - KPIs and every chart - on your school letterhead, with the filters you applied noted at the top. Choose "Save as PDF" as the printer for a file, or send it straight to paper for a meeting.'],
    ],
    note: 'Read-only. Every figure traces back to saved vouchers - if a number looks wrong, the fix is in the voucher, not here. If nothing opens on Download, allow pop-ups for this site.'
  },
  voucher: {
    title: 'Writing a debit voucher',
    steps: [
      ['1 - The number is automatic', 'VCH-00001 onwards, assigned by the server per school when you save. Never type one - the running order is what keeps the register audit-ready.'],
      ['2 - Who you paid', 'Name / Title and Phone No. Then Head of A/C - Salaries, Utilities, Office Maintenance, Building Maintenance, Transportation, Academic Maintenance, Events & Programs, IT & Equipment, Hostel & Canteen or Miscellaneous - and a Sub Head for the detail within it.'],
      ['3 - Head drives the reporting', 'The head you pick here is exactly what the Dashboard groups by. Reach for Miscellaneous only when nothing else genuinely fits, or your charts stop telling you anything.'],
      ['4 - Particulars', 'One row per line item - description and amount. The Total adds up live and the amount in words fills itself in. Transfer through records how it went out: UPI, Bank, Cheque, Cash, Kind or Others.'],
      ['5 - Payment proof', 'Attach the bill, receipt or screenshot. It stays on the voucher and opens from the Register and the Calendar, so the evidence never gets separated from the entry.'],
      ['6 - Save', 'Saving lands you in the Register with the voucher in the list. The printed voucher carries your school name and logo, ready to sign and file.'],
    ],
    note: 'The voucher header pulls your school name, logo, email and phone automatically - nothing to fill in. Correct a mistake with Edit from the Register; re-entering it double-counts the spend.'
  },
  register: {
    title: 'The expense register',
    steps: [
      ['1 - Every voucher, in order', 'The running book of what the school has spent, by voucher number. This is what you reconcile against and hand over when someone asks for records.'],
      ['2 - Find one', 'The register opens on your active Academic Year. Filter by Head or a date range, search by voucher number, name, head or sub head, or switch the year to All Years to look back at earlier ones.'],
      ['3 - Open one', 'The eye opens the full voucher - particulars, amount in words, the payment proof, and who created or last edited it with the IST time.'],
      ['4 - Recorded By', 'Shows who entered the voucher and when, in IST. If someone edited it later, an amber "edited - name" line sits under it - anyone can create, so both names are kept.'],
      ['5 - Edit', 'Edit reopens that voucher in the voucher screen. Change it, save, and you come back here with the list refreshed and your name on the edited line.'],
      ['6 - New entry', 'New Voucher starts a blank one - same as the tab above.'],
      ['7 - Download', 'An Excel file of exactly what your filters show, with a heading and running total per academic year, and the Recorded By name and IST time on every row. On All Years each year gets its own section plus a grand total.'],
    ],
    note: 'Download exports exactly what the filters show, so set the year and head first. Deleting a voucher pulls that spend out of the Register, the Calendar and the Dashboard together - if the payment really happened, correct it rather than deleting it.'
  },
  calendar: {
    title: 'The expenses calendar',
    steps: [
      ['1 - Spending by day', 'The same vouchers as the Register, laid out on a month. It answers "what went out on the 14th?" faster than any list.'],
      ['2 - Open the proof', 'The eye on a day\'s entry opens the same full voucher view as the Register - payment proof, amount in words and the audit line included.'],
      ['3 - Spot the mistakes', 'Heavy days stand out at a glance - which is how you catch a voucher dated wrong, or the same payment entered twice.'],
    ],
    note: 'A blank day means no voucher was recorded against it - either a quiet day, or one nobody has entered yet.'
  }
};

function HelpModal({ tab, onClose }) {
  const content = GUIDES[tab] || GUIDES.dashboard;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
          <span className="text-sm font-semibold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
          <button onClick={onClose} className="flex items-center justify-center size-8 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {content.steps.map(([t, d], i) => (
            <div key={i} className="rounded-md border border-zinc-200 shadow-sm bg-zinc-50 p-3">
              <p className="text-xs font-semibold text-zinc-800">{t}</p>
              <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
            </div>
          ))}
          <div className="rounded-md bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-600/20 p-3 flex items-start gap-3">
            <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">{content.note}</p>
          </div>
        </div>
      </div>
    </div>
  );
}