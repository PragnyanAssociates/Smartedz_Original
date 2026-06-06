import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  ChevronLeft, Mail, Phone, MapPin, Calendar,
  BookOpen, Award, ShieldCheck, User, Loader2, Info, BarChart3, TrendingUp,
  Users, Briefcase, Hash, Wallet, GraduationCap, Fingerprint
} from 'lucide-react';
import { roundPct, band, buildStudentTotals, studentExamBreakdown } from '../Performance/PerfUtils';

// --- small display helpers -----------------------------------------
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// DD/MM/YYYY for date columns (parses the date portion directly to avoid
// any timezone drift from the stored UTC datetime).
const fmtDate = (v) => {
  if (!v) return '';
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

// "YYYY-MM" -> "Jun 2026"
const fmtMonth = (ym) => {
  const [y, m] = String(ym).split('-').map(Number);
  return `${MON[(m || 1) - 1] || ''} ${y || ''}`.trim();
};

// ₹ with Indian grouping; falls back to the raw value if not numeric.
const fmtMoney = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return `₹${n.toLocaleString('en-IN')}`;
};

export default function UserProfileDetail({ userId, seedProfile = null, classes = [], onBack }) {
  // `seedProfile` is the complete user row handed down from the Directory
  // (it comes from /admin/data and carries every column). `fetched` is the
  // /profile lookup. We merge them so the screen always has the full set.
  const [fetched, setFetched] = useState(null);
  const [loading, setLoading] = useState(!seedProfile);
  const [activeTab, setActiveTab] = useState('info');

  const fetchProfile = useCallback(async () => {
    try {
      if (!seedProfile) setLoading(true);
      const res = await fetch(`${API_BASE_URL}/profile/${userId}`);
      const data = await res.json();
      setFetched(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId, seedProfile]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Seed wins on shared keys (it's the authoritative full record); the
  // /profile result fills in anything seed doesn't carry.
  const profile = useMemo(() => {
    const merged = { ...(fetched || {}), ...(seedProfile || {}) };
    return Object.keys(merged).length ? merged : null;
  }, [fetched, seedProfile]);

  const tabs = useMemo(() => {
    const roleLc = (profile?.role || '').trim().toLowerCase();
    const isStudent = roleLc === 'student';
    const isTeacher = roleLc.includes('teacher');
    // Super Admin (and Developer) are never marked in the Attendance module,
    // so they get Basic Info only. Everyone else — Student, Teacher, and any
    // other role (Principal, custom roles…) — gets an Attendance tab.
    // Performance stays limited to Students and Teachers.
    const noAttendance = roleLc === 'super admin' || roleLc === 'developer';

    const t = [{ id: 'info', label: 'Basic Info', icon: User }];
    if (isStudent || isTeacher) t.push({ id: 'performance', label: 'Performance', icon: Award });
    if (!noAttendance) t.push({ id: 'attendance', label: 'Attendance', icon: ShieldCheck });
    return t;
  }, [profile]);

  if (loading || !profile) {
    return (
      <div className="h-64 flex items-center justify-center animate-in fade-in duration-300">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6 animate-in slide-in-from-bottom-2 duration-300">

      {/* Back Button */}
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
        <ChevronLeft className="size-4" /> Back to Directory
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 items-start">

        {/* Profile Card (Left Column) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-6 sm:p-8 text-center flex flex-col items-center">

            <div className="relative mb-5">
              {profile.profile_pic ? (
                <img src={profile.profile_pic} className="size-32 sm:size-40 rounded-full object-cover ring-1 ring-black/5 shadow-sm" alt={profile.name} />
              ) : (
                <div className="size-32 sm:size-40 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-300 ring-1 ring-black/5 shadow-sm">
                  <User className="size-16" />
                </div>
              )}
            </div>

            <h2 className="text-xl font-semibold text-zinc-900 tracking-tight leading-tight">{profile.name}</h2>

            <div className="mt-2.5">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary ring-1 ring-primary/20">
                {profile.role}
              </span>
            </div>

            {profile.email && (
              <p className="text-zinc-500 text-xs font-medium mt-3 truncate max-w-full" title={profile.email}>{profile.email}</p>
            )}
            <p className="text-zinc-400 text-[11px] font-medium mt-1">
              ID: {profile.admission_no || profile.username || userId}
            </p>
          </div>
        </div>

        {/* Dynamic Content Pane (Right Column) */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* Tab Switcher */}
          <div className="flex justify-start">
            <div className="inline-flex bg-zinc-100/80 p-1 rounded-md overflow-x-auto custom-scrollbar w-full sm:w-auto">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center justify-center gap-1.5 flex-1 sm:flex-none px-4 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                    activeTab === t.id ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  <t.icon className="size-3.5 shrink-0" /> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content Area */}
          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm p-5 sm:p-8 min-h-[400px]">
            {activeTab === 'info' && <BasicInfo profile={profile} classes={classes} />}

            {activeTab === 'performance' && (
              <PerformanceOverview userId={userId} role={profile.role} />
            )}

            {activeTab === 'attendance' && (
              <AttendanceOverview userId={userId} role={profile.role} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// =====================================================================
//  Basic info — curated sections + any leftover profile fields
// =====================================================================
// Keys rendered explicitly in a curated row below (or purely technical),
// so they are never duplicated under "Additional Details".
const SHOWN_KEYS = new Set([
  // technical / internal
  'id', 'userid', 'institutionid', 'institution_id', 'password', 'password_hash',
  'profile_pic', 'created_at', 'updated_at', 'role', 'name', 'username',
  'token', 'otp', 'academic_year_id', 'subject_ids',
  // personal & contact
  'email', 'phone', 'phone_no', 'mobile', 'dob', 'date_of_birth',
  'gender', 'address',
  // academic (student)
  'class_id', 'classname', 'class_name', 'section', 'roll_no', 'admission_no',
  'admission_date', 'parent_name', 'guardian_name', 'pen_no', 'tc_number',
  'school_joined_date', 'school_joined_grade', 'status',
  // employment (staff)
  'aadhar_no', 'aadhaar_no', 'joining_date', 'date_of_joining', 'experience',
  'prev_salary', 'present_salary', 'salary'
]);

const LABELS = {
  blood_group: 'Blood Group', father_name: "Father's Name", mother_name: "Mother's Name",
  qualification: 'Qualification', designation: 'Designation', religion: 'Religion',
  caste: 'Caste', category: 'Category', nationality: 'Nationality',
  emergency_contact: 'Emergency Contact', emergency_phone: 'Emergency Contact',
  whatsapp: 'WhatsApp', city: 'City', state: 'State', pincode: 'Pincode',
  country: 'Country', subject: 'Subject', department: 'Department'
};

const humanize = (k) =>
  k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function BasicInfo({ profile, classes = [] }) {
  const role = profile.role || '';
  const isStudent = /student/i.test(role);
  const isStaff = role === 'Super Admin' || /teacher/i.test(role);

  // Resolve the real class label from class_id (the profile only carries
  // the numeric id, which previously rendered as e.g. "1" instead of "10").
  const className = useMemo(() => {
    const c = (classes || []).find(x => String(x.id) === String(profile.class_id));
    if (c) return `${c.className}${c.section ? ` - ${c.section}` : ''}`;
    return profile.className || profile.class_name || (profile.class_id != null ? String(profile.class_id) : '');
  }, [classes, profile]);

  // Anything left over that we didn't curate explicitly.
  const extra = useMemo(() => {
    return Object.entries(profile || {})
      .filter(([k, v]) =>
        !SHOWN_KEYS.has(k.toLowerCase()) &&
        v !== null && v !== undefined && v !== '' &&
        typeof v !== 'object')
      .map(([k, v]) => ({ key: k, label: LABELS[k.toLowerCase()] || humanize(k), value: String(v) }));
  }, [profile]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">

        {/* Personal & Contact — everyone */}
        <div className="space-y-6">
          <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider border-b border-zinc-100 pb-2">Personal &amp; Contact</h4>
          <div className="space-y-4">
            <InfoRow icon={Mail} label="Email" value={profile.email} />
            <InfoRow icon={Phone} label="Phone" value={profile.phone_no || profile.phone || profile.mobile} />
            <InfoRow icon={Calendar} label="Date of Birth" value={fmtDate(profile.dob || profile.date_of_birth)} />
            <InfoRow icon={User} label="Gender" value={profile.gender} />
            <InfoRow icon={MapPin} label="Address" value={profile.address} />
          </div>
        </div>

        {/* Right column — Academic (students) or Employment (staff) */}
        {isStudent ? (
          <div className="space-y-6">
            <h4 className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider border-b border-zinc-100 pb-2">Academic Info</h4>
            <div className="space-y-4">
              <InfoRow icon={BookOpen} label="Class" value={className} />
              {profile.section && <InfoRow icon={Hash} label="Section" value={profile.section} />}
              <InfoRow icon={ShieldCheck} label="Roll No" value={profile.roll_no} />
              <InfoRow icon={Hash} label="Admission No" value={profile.admission_no} />
              <InfoRow icon={Calendar} label="Admission Date" value={fmtDate(profile.admission_date)} />
              <InfoRow icon={Users} label="Parent / Guardian" value={profile.parent_name || profile.guardian_name} />
              <InfoRow icon={Fingerprint} label="Aadhaar No" value={profile.aadhar_no || profile.aadhaar_no} />
              <InfoRow icon={Hash} label="PEN No" value={profile.pen_no} />
              <InfoRow icon={Hash} label="TC No" value={profile.tc_number} />
              <InfoRow icon={GraduationCap} label="School Joined Grade" value={profile.school_joined_grade} />
              <InfoRow icon={Calendar} label="School Joined Date" value={fmtDate(profile.school_joined_date)} />
              <InfoRow icon={ShieldCheck} label="Status" value={profile.status} />
            </div>
          </div>
        ) : isStaff ? (
          <div className="space-y-6">
            <h4 className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider border-b border-zinc-100 pb-2">Employment Details</h4>
            <div className="space-y-4">
              <InfoRow icon={Fingerprint} label="Aadhaar No" value={profile.aadhar_no || profile.aadhaar_no} />
              <InfoRow icon={Calendar} label="Joining Date" value={fmtDate(profile.joining_date || profile.date_of_joining)} />
              <InfoRow icon={Briefcase} label="Experience" value={profile.experience} />
              <InfoRow icon={Wallet} label="Previous Salary" value={fmtMoney(profile.prev_salary)} />
              <InfoRow icon={Wallet} label="Present Salary" value={fmtMoney(profile.present_salary)} />
              <InfoRow icon={ShieldCheck} label="Status" value={profile.status} />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h4 className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider border-b border-zinc-100 pb-2">Account</h4>
            <div className="space-y-4">
              <InfoRow icon={ShieldCheck} label="Status" value={profile.status} />
            </div>
          </div>
        )}
      </div>

      {/* Any additional profile fields we didn't curate explicitly */}
      {extra.length > 0 && (
        <div className="space-y-6">
          <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2 flex items-center gap-1.5">
            <Info className="size-3.5" /> Additional Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {extra.map(f => (
              <InfoRow key={f.key} icon={Info} label={f.label} value={f.value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// =====================================================================
//  Performance overview (student or teacher)
// =====================================================================
function PerformanceOverview({ userId, role }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url = role === 'Teacher'
      ? `${API_BASE_URL}/admin/performance/teacher/${userId}`
      : `${API_BASE_URL}/admin/performance/student/${userId}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, role]);

  if (loading) {
    return <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin size-7 text-primary" /></div>;
  }

  // ---- Teacher ----
  if (role === 'Teacher') {
    const detail = (data?.detail || []).filter(d => d.total_possible > 0);
    const pct = data?.overall_percentage != null ? roundPct(data.overall_percentage) : null;
    if (!detail.length) return <EmptyOverview icon={Award} text="No performance data recorded yet." />;
    return (
      <div className="space-y-6">
        <OverallCard pct={pct} obtained={data.overall_obtained} possible={data.overall_possible} label="Overall Teaching Performance" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {detail.map((d, i) => {
            const b = band(roundPct(d.percentage));
            return (
              <div key={i} className="bg-white border border-zinc-200 rounded-md p-3 flex justify-between items-center shadow-sm">
                <div className="min-w-0 pr-3">
                  <div className="text-sm font-semibold text-zinc-800 truncate">{d.class_group}</div>
                  <div className="text-[11px] font-medium text-zinc-500 truncate mt-0.5">{d.subject_name}</div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${b.bg} ${b.text}`}>{roundPct(d.percentage)}%</span>
                  <div className="text-[10px] font-medium text-zinc-400 mt-1 uppercase tracking-wider tabular-nums">
                    {Math.round(d.total_obtained)}/{Math.round(d.total_possible)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- Student ----
  const ranked = buildStudentTotals(data, { examTypeId: 'overall', subjectId: 'all' });
  const me = ranked.find(r => String(r.id) === String(userId));
  const breakdown = studentExamBreakdown(data, parseInt(userId, 10)) ;
  if (!me) return <EmptyOverview icon={Award} text="No marks recorded for this student yet." />;

  return (
    <div className="space-y-6">
      <OverallCard pct={me.percentage} obtained={me.obtained} possible={me.possible} label="Overall Performance"
        extra={`Rank #${me.rank} of ${ranked.length}`} />
      {breakdown.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <BarChart3 className="size-3.5" /> Exam-wise
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {breakdown.map(ex => {
              const b = band(ex.percentage);
              return (
                <div key={ex.exam_type_id} className="bg-white border border-zinc-200 rounded-md p-3 flex justify-between items-center shadow-sm">
                  <span className="text-xs font-semibold text-zinc-700 truncate mr-2">{ex.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-zinc-400 tabular-nums">{Math.round(ex.obtained)}/{Math.round(ex.possible)}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${b.bg} ${b.text}`}>{ex.percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// =====================================================================
//  Attendance overview — monthly Working / Present, read straight from
//  the live Attendance table via the history endpoint (active year) for
//  students AND staff, then grouped by month on the client. Reading the
//  same source the marker writes to means the latest marked day always
//  shows here immediately — no dependence on the Reports aggregation.
//  "Present" counts attended days (P + L), matching the Attendance module.
// =====================================================================
function AttendanceOverview({ userId, role }) {
  const [months, setMonths] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const finish = (arr) => { if (!cancelled) { setMonths(arr); setLoading(false); } };

    // Whole active year (no from/to) → group rows into months.
    fetch(`${API_BASE_URL}/admin/attendance/history/${userId}`)
      .then(r => r.json())
      .then(d => {
        const map = {};
        (d?.rows || []).forEach(r => {
          const ym = String(r.attendance_date).slice(0, 7);
          if (!ym) return;
          if (!map[ym]) map[ym] = { ym, working_days: 0, present_days: 0 };
          map[ym].working_days += 1;
          if (r.status === 'P' || r.status === 'L') map[ym].present_days += 1;
        });
        const arr = Object.values(map)
          .sort((a, b) => a.ym.localeCompare(b.ym))
          .map(m => ({ month: fmtMonth(m.ym), working_days: m.working_days, present_days: m.present_days }));
        finish(arr);
      })
      .catch(() => finish([]));

    return () => { cancelled = true; };
  }, [userId, role]);

  if (loading) {
    return <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin size-7 text-primary" /></div>;
  }

  const list = months || [];
  if (!list.length) return <EmptyOverview icon={ShieldCheck} text="No attendance recorded yet." />;

  const totals = list.reduce(
    (acc, m) => ({ working: acc.working + (m.working_days || 0), present: acc.present + (m.present_days || 0) }),
    { working: 0, present: 0 }
  );
  const pct = totals.working > 0 ? roundPct((totals.present / totals.working) * 100) : 0;

  return (
    <div className="space-y-6">
      <OverallCard pct={pct} obtained={totals.present} possible={totals.working}
        label="Overall Attendance" unit="days" />
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse text-sm min-w-[480px]">
          <thead className="bg-zinc-50/80">
            <tr>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Month</th>
              <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Working</th>
              <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">Present</th>
              <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase text-zinc-500 tracking-wider border-b border-zinc-100">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {list.map((m, i) => {
              const p = m.working_days > 0 ? roundPct((m.present_days / m.working_days) * 100) : 0;
              const b = band(p);
              return (
                <tr key={i} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-2.5 font-semibold text-zinc-800">{m.month}</td>
                  <td className="px-4 py-2.5 text-center text-zinc-600 tabular-nums">{m.working_days}</td>
                  <td className="px-4 py-2.5 text-center text-zinc-600 tabular-nums">{m.present_days}</td>
                  <td className={`px-4 py-2.5 text-center font-semibold tabular-nums ${b.text}`}>{p}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// --- shared bits ---------------------------------------------------
function OverallCard({ pct, obtained, possible, label, extra, unit }) {
  const b = band(pct ?? 0);
  return (
    <div className="bg-gradient-to-r from-zinc-50 to-white border border-zinc-200 rounded-lg p-4 sm:p-5 flex items-center gap-4 shadow-sm">
      <div className={`size-11 rounded-md flex items-center justify-center shrink-0 ring-1 ring-inset ${b.bg} ${b.border}`}>
        <TrendingUp className={`size-5 ${b.text}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</div>
        <div className="text-sm font-medium text-zinc-500 mt-0.5">
          {Math.round(obtained || 0)} / {Math.round(possible || 0)}{unit ? ` ${unit}` : ''}
          {extra ? <span className="text-zinc-400"> · {extra}</span> : null}
        </div>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${b.text}`}>{pct ?? 0}%</div>
    </div>
  );
}

function EmptyOverview({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Icon className="size-12 text-zinc-200 mb-4" />
      <p className="font-medium text-zinc-500 text-sm">{text}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <div className="size-8 sm:size-10 rounded-md bg-zinc-50 ring-1 ring-zinc-200 flex items-center justify-center text-zinc-400 shrink-0">
        <Icon className="size-4 sm:size-5" />
      </div>
      <div className="flex flex-col min-w-0 pt-0.5">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-zinc-900 truncate">{value || '-'}</p>
      </div>
    </div>
  );
}