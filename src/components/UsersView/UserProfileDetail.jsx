import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../apiConfig';
import {
  ChevronLeft, Mail, Phone, MapPin, Calendar,
  BookOpen, Award, Clock, ShieldCheck, User, Loader2, Info, BarChart3, TrendingUp
} from 'lucide-react';
import Timetable from '../Timetable/Timetable';
import { roundPct, band, buildStudentTotals, studentExamBreakdown } from '../Performance/PerfUtils';

export default function UserProfileDetail({ userId, onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/profile/${userId}`);
      const data = await res.json();
      setProfile(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const tabs = useMemo(() => {
    const t = [{ id: 'info', label: 'Basic Info', icon: User }];
    if (profile?.role === 'Teacher') t.push({ id: 'timetable', label: 'Schedule', icon: Clock });
    if (profile?.role === 'Student' || profile?.role === 'Teacher') {
      t.push({ id: 'performance', label: 'Performance', icon: Award });
      t.push({ id: 'attendance', label: 'Attendance', icon: ShieldCheck });
    }
    return t;
  }, [profile]);

  if (loading) {
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
            {activeTab === 'info' && <BasicInfo profile={profile} />}

            {activeTab === 'timetable' && (
              <Timetable teacherId={userId} isEmbedded={true} />
            )}

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
//  Basic info — curated sections + any extra profile fields
// =====================================================================
// Keys already shown above, or technical/internal — never listed under
// "Additional Details".
const HIDDEN_KEYS = new Set([
  'id', 'userid', 'institutionid', 'institution_id', 'password', 'password_hash',
  'profile_pic', 'created_at', 'updated_at', 'role', 'name', 'email',
  'phone', 'phone_no', 'mobile', 'dob', 'date_of_birth', 'address',
  'class_id', 'classname', 'class_name', 'roll_no', 'status', 'admission_no',
  'username', 'section', 'academic_year_id', 'token', 'otp'
]);

const LABELS = {
  gender: 'Gender', blood_group: 'Blood Group', father_name: "Father's Name",
  mother_name: "Mother's Name", guardian_name: 'Guardian', parent_name: 'Parent',
  joining_date: 'Joining Date', date_of_joining: 'Joining Date',
  qualification: 'Qualification', experience: 'Experience', designation: 'Designation',
  religion: 'Religion', caste: 'Caste', category: 'Category', nationality: 'Nationality',
  aadhar: 'Aadhar No', aadhar_no: 'Aadhar No', emergency_contact: 'Emergency Contact',
  emergency_phone: 'Emergency Contact', whatsapp: 'WhatsApp', city: 'City',
  state: 'State', pincode: 'Pincode', country: 'Country', subject: 'Subject',
  department: 'Department', salary: 'Salary'
};

const humanize = (k) =>
  k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function BasicInfo({ profile }) {
  const extra = useMemo(() => {
    return Object.entries(profile || {})
      .filter(([k, v]) =>
        !HIDDEN_KEYS.has(k.toLowerCase()) &&
        v !== null && v !== undefined && v !== '' &&
        typeof v !== 'object')
      .map(([k, v]) => ({ key: k, label: LABELS[k.toLowerCase()] || humanize(k), value: String(v) }));
  }, [profile]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
        <div className="space-y-6">
          <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider border-b border-zinc-100 pb-2">Personal &amp; Contact</h4>
          <div className="space-y-4">
            <InfoRow icon={Mail} label="Email" value={profile.email} />
            <InfoRow icon={Phone} label="Phone" value={profile.phone_no || profile.phone || profile.mobile} />
            <InfoRow icon={Calendar} label="Date of Birth" value={profile.dob || profile.date_of_birth} />
            <InfoRow icon={MapPin} label="Address" value={profile.address} />
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider border-b border-zinc-100 pb-2">Academic Info</h4>
          <div className="space-y-4">
            {profile.role === 'Student' && (
              <>
                <InfoRow icon={BookOpen} label="Class" value={profile.className || profile.class_name || profile.class_id} />
                <InfoRow icon={ShieldCheck} label="Roll No" value={profile.roll_no} />
                {profile.admission_no && <InfoRow icon={ShieldCheck} label="Admission No" value={profile.admission_no} />}
              </>
            )}
            <InfoRow icon={ShieldCheck} label="Status" value={profile.status} />
          </div>
        </div>
      </div>

      {/* Any additional profile fields */}
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
//  Attendance overview (student = monthly W/P from Attendance module)
// =====================================================================
function AttendanceOverview({ userId, role }) {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role === 'Teacher') { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE_URL}/admin/reports/student/${userId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setCard(d); })
      .catch(() => { if (!cancelled) setCard(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, role]);

  if (role === 'Teacher') {
    return <EmptyOverview icon={ShieldCheck} text="Staff attendance isn't shown in the directory view." />;
  }

  if (loading) {
    return <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin size-7 text-primary" /></div>;
  }

  const months = (card?.attendance || []).filter(m => (m.working_days || 0) > 0);
  if (!months.length) return <EmptyOverview icon={ShieldCheck} text="No attendance recorded for this student yet." />;

  const totals = months.reduce(
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
            {months.map((m, i) => {
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