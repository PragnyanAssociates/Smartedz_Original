import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Phone, Calendar, IdCard, User, FileText, MapPin, Edit, Trash2,
  GraduationCap, X, Check, School, Search, Loader2, ChevronDown,
  Download, HelpCircle, ShieldCheck, CalendarRange, Camera
} from 'lucide-react';
import { usePermissions } from '../../Screens/PermissionsContext';

// --- Formatters ---
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtIST = (val) => {
  if (!val) return '';
  let d;
  if (typeof val === 'string' && !val.includes('T') && !val.endsWith('Z')) d = new Date(val.replace(' ', 'T') + 'Z');
  else d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
};
const toYYYYMMDD = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};
const resolvePhoto = (p) => {
  if (!p) return '/default-avatar.png';
  if (/^(data:|https?:|blob:)/i.test(p)) return p;
  return `${API_BASE_URL.replace('/api', '')}${p}`;
};

const StatusPill = ({ status }) => {
  const styles = {
    Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    Rejected: 'bg-red-50 text-red-700 ring-red-600/20',
  };
  return (
    <div className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${styles[status] || 'bg-zinc-50 text-zinc-600 ring-zinc-500/20'}`}>
      {status}
    </div>
  );
};

export default function AdmissionsScreen() {
  const { user } = useAuth();
  const { can, isAllAccess } = usePermissions();
  const canRead = can('PreAdmissions', 'read');
  const canEdit = can('PreAdmissions', 'edit');
  const canDelete = can('PreAdmissions', 'delete');
  const isAdmin = isAllAccess;
  const canAct = canEdit || isAdmin;

  const [data, setData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // Edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);

  // Filters
  const currentYear = String(new Date().getFullYear());
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('Approved'); // 'Approved' | 'Rejected'
  const [years, setYears] = useState([]);              // calendar years present in admissions
  const [filterYear, setFilterYear] = useState('');    // selected year, or 'all'

  // Guards against an out-of-order response (an earlier tab's fetch
  // resolving after a later one and overwriting it).
  const reqSeq = useRef(0);
  const fetchData = useCallback(async () => {
    if (!user?.institutionId || (!canRead && !isAdmin)) return;
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchText) params.append('search', searchText);
      if (filterStatus) params.append('status', filterStatus);
      if (filterYear && filterYear !== 'all') params.append('year', filterYear);
      const res = await fetch(`${API_BASE_URL}/admin/admissions/${user.institutionId}?${params.toString()}`);
      const records = await res.json();
      if (seq === reqSeq.current) setData(Array.isArray(records) ? records : []);
    } catch (e) { console.error(e); }
    finally { if (seq === reqSeq.current) setLoading(false); }
  }, [user, isAdmin, canRead, searchText, filterStatus, filterYear]);

  const loadMeta = useCallback(async () => {
    if (!user?.institutionId) return;
    // classes (for the grade dropdowns)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
      const d = await res.json();
      setClasses(d.classes || []);
    } catch (e) { console.error('meta load:', e); }
    // distinct calendar years present in admissions
    try {
      const res2 = await fetch(`${API_BASE_URL}/admin/admissions/${user.institutionId}/years`);
      const yr = await res2.json();
      setYears(Array.isArray(yr) ? yr.map(String).filter(Boolean) : []);
    } catch (e) { console.error('years load:', e); }
  }, [user]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { fetchData(); }, [fetchData]);

  // Default the year filter to the current calendar year once meta loads;
  // if there's nothing this year but earlier years have records, show the
  // most recent one.
  useEffect(() => {
    if (filterYear) return;
    if (years.includes(currentYear) || years.length === 0) setFilterYear(currentYear);
    else setFilterYear(years[0]);
  }, [years, filterYear, currentYear]);

  // Year dropdown: every year present, plus the current year, newest first.
  const yearOptions = useMemo(() => {
    const set = new Set(years);
    set.add(currentYear);
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [years, currentYear]);

  const classOptions = useMemo(
    () => Array.from(new Set((classes || []).map(c => c.className).filter(Boolean))), [classes]);
  const gradeSelectOptions = useMemo(
    () => [{ value: '', label: 'Select grade...' }, ...classOptions.map(n => ({ value: n, label: n }))], [classOptions]);
  const gradeOptionsWith = (val) => {
    if (!val) return gradeSelectOptions;
    return gradeSelectOptions.some(o => o.value === val) ? gradeSelectOptions : [...gradeSelectOptions, { value: val, label: val }];
  };

  const handleDownload = useCallback(async () => {
    if (!user?.institutionId) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      params.set('year', filterYear || 'all');
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`${API_BASE_URL}/admin/admissions/${user.institutionId}/export?${params.toString()}`);
      if (!res.ok) throw new Error('Could not generate the Excel file.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Admissions_${(filterYear === 'all' || !filterYear) ? 'AllYears' : filterYear}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { alert(e.message || 'Download failed.'); }
    setDownloading(false);
  }, [user, filterYear, filterStatus]);

  if (!canRead && !isAdmin) {
    return (
      <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <IdCard className="size-10 text-zinc-300 mb-3" />
          <h2 className="text-lg font-semibold text-zinc-900 mb-1">Access Denied</h2>
          <p className="text-sm font-medium text-zinc-500">You do not have permission to view admissions.</p>
        </div>
      </div>
    );
  }

  const openEdit = (item) => {
    setSelectedImage(null); setCurrentItem(item);
    setFormData({ ...item, dob: toYYYYMMDD(item.dob), school_joined_date: toYYYYMMDD(item.school_joined_date) });
    setModalVisible(true);
  };

  const handleChoosePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return alert('Picture must be under 3 MB.');
    const reader = new FileReader();
    reader.onloadend = () => { setFormData(prev => ({ ...prev, photo_url: reader.result })); setSelectedImage({ uri: reader.result }); };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!formData.admission_no || !formData.student_name || !formData.joining_grade) return alert('Admission No, Name, and Joining Grade are required.');
    if (formData.phone_no && !/^[1-9][0-9]{9}$/.test(formData.phone_no)) return alert('Phone must be exactly 10 digits and cannot start with 0.');
    if (formData.aadhar_no && !/^[0-9]{12}$/.test(formData.aadhar_no)) return alert('Aadhar must be exactly 12 digits.');
    setIsSaving(true);
    try {
      const payload = { institutionId: user.institutionId };
      const allowed = ['admission_no', 'student_name', 'joining_grade', 'dob', 'phone_no', 'previous_institute',
        'previous_grade', 'pen_no', 'aadhar_no', 'parent_name', 'parent_phone', 'address', 'status',
        'school_joined_date', 'tc_number', 'photo_url'];
      allowed.forEach(k => { const v = formData[k]; if (v !== null && v !== undefined && v !== '') payload[k] = v; });
      const res = await fetch(`${API_BASE_URL}/admin/preadmissions/${currentItem.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Save failed'); }
      setModalVisible(false); setSelectedItem(null); fetchData();
    } catch (e) { alert(e.message); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this admission permanently?")) return;
    try {
      await fetch(`${API_BASE_URL}/admin/preadmissions/${id}`, { method: 'DELETE' });
      setSelectedItem(null); fetchData();
    } catch (e) { alert('Failed to delete.'); }
  };

  const statusTab = (s) => {
    const on = filterStatus === s;
    const base = 'px-3 h-8 text-[10px] font-semibold rounded-md transition-colors flex-1 ';
    if (!on) return base + 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200';
    return base + (s === 'Approved' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-red-500 text-white shadow-sm');
  };

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2 sm:mb-0">
        <header className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="text-primary size-5" /> Admissions
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Approved &amp; rejected applications, by academic year.</p>
        </header>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
          <AdmissionsHelp canEdit={canAct} />
          <button onClick={handleDownload} disabled={downloading}
            className="h-9 px-4 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0">
            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {downloading ? 'Preparing...' : 'Download (Excel)'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 flex-1">
        {/* LEFT: List */}
        <div className={`lg:col-span-4 xl:col-span-5 flex flex-col gap-4 ${selectedItem ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-white p-2 rounded-lg shadow-sm ring-1 ring-black/5 flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchData()} placeholder="Search name or ID..."
                  className="h-9 w-full bg-zinc-50/50 border border-transparent rounded-md pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors placeholder:text-zinc-400" />
              </div>
              <div className="relative shrink-0">
                <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setSelectedItem(null); }}
                  className="h-9 bg-zinc-50/50 border border-transparent rounded-md pl-3 pr-8 text-sm font-semibold text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none max-w-[150px]">
                  {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
                  <option value="all">All Years</option>
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div className="flex gap-1">
              {['Approved', 'Rejected'].map(s => (
                <button key={s} onClick={() => { setFilterStatus(s); setSelectedItem(null); }} className={statusTab(s)}>{s}</button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col h-[70vh]">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 shrink-0">
              <h2 className="font-semibold text-zinc-800 text-sm">{filterStatus} ({data.length})</h2>
            </div>
            <div className="overflow-y-auto custom-scrollbar flex-1 divide-y divide-zinc-100">
              {loading ? (
                <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary size-6" /></div>
              ) : data.length === 0 ? (
                <div className="p-10 text-center text-zinc-400 font-medium text-sm">No {filterStatus.toLowerCase()} admissions.</div>
              ) : (
                data.map((item, idx) => (
                  <div key={item.id} onClick={() => setSelectedItem(item)}
                    className={`p-3 sm:p-4 flex items-center cursor-pointer transition-colors ${selectedItem?.id === item.id ? 'bg-primary/5' : 'hover:bg-zinc-50/80'}`}>
                    <span className="w-6 text-center text-xs font-semibold text-zinc-400 tabular-nums shrink-0 mr-1">{idx + 1}</span>
                    <img src={resolvePhoto(item.photo_url)} alt="" className="size-10 rounded-md object-cover bg-zinc-100 mr-3 ring-1 ring-black/5 shadow-sm" />
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className={`font-semibold text-sm truncate ${selectedItem?.id === item.id ? 'text-primary' : 'text-zinc-900'}`}>{item.student_name}</h4>
                      <p className="text-xs text-zinc-500 font-medium mt-0.5">Grade: {item.joining_grade} {'\u2022'} ID: {item.admission_no}</p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Details */}
        <div className={`lg:col-span-8 xl:col-span-7 ${!selectedItem ? 'hidden lg:block' : 'block'}`}>
          {!selectedItem ? (
            <div className="bg-white rounded-lg ring-1 ring-black/5 border-dashed h-[70vh] flex flex-col items-center justify-center text-center p-8 mt-[52px]">
              <GraduationCap className="size-12 text-zinc-200 mb-3" />
              <h3 className="text-base font-semibold text-zinc-400">Select an Admission</h3>
              <p className="text-zinc-400 font-medium text-sm mt-1">Choose a record to view the full profile.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm h-[80vh] flex flex-col mt-[52px] lg:mt-0">
              <div className="p-5 border-b border-zinc-100 flex items-start sm:items-center gap-4 bg-zinc-50/50 rounded-t-lg shrink-0">
                <button onClick={() => setSelectedItem(null)} className="lg:hidden p-1.5 bg-white rounded-md shadow-sm ring-1 ring-black/5 text-zinc-500 hover:text-zinc-900 transition-colors mt-1 sm:mt-0"><X className="size-4" /></button>
                <img src={resolvePhoto(selectedItem.photo_url)} alt=""
                  onClick={() => selectedItem.photo_url && setPhotoPreview(resolvePhoto(selectedItem.photo_url))}
                  className="size-16 rounded-lg object-cover bg-zinc-100 ring-1 ring-black/5 shadow-sm shrink-0 cursor-zoom-in hover:ring-primary/40 transition-all" />
                <div className="flex-1 min-w-0 mt-1 sm:mt-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-zinc-900 truncate">{selectedItem.student_name}</h3>
                    <StatusPill status={selectedItem.status} />
                  </div>
                  <p className="text-xs font-medium text-zinc-500 mt-1 truncate">
                    Grade: {selectedItem.joining_grade} - ID: {selectedItem.admission_no}
                    {selectedItem.admission_year ? ` \u2022 ${selectedItem.admission_year}` : ''}
                  </p>
                </div>
                {canAct && (
                  <div className="flex gap-2 shrink-0 self-start sm:self-center">
                    <button onClick={() => openEdit(selectedItem)} title="Edit" className="h-8 w-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md flex items-center justify-center shadow-sm ring-1 ring-black/5 transition-colors"><Edit className="size-4" /></button>
                    {(canDelete || isAdmin) && (
                      <button onClick={() => handleDelete(selectedItem.id)} title="Delete" className="h-8 w-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-red-600 rounded-md flex items-center justify-center shadow-sm ring-1 ring-black/5 transition-colors"><Trash2 className="size-4" /></button>
                    )}
                  </div>
                )}
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AuditRow icon={User} label="Created By" name={selectedItem.created_by_name} time={fmtIST(selectedItem.submission_date)} />
                  <AuditRow
                    icon={selectedItem.status === 'Approved' ? Check : X}
                    label={`${selectedItem.status} By`} name={selectedItem.verified_by_name}
                    time={fmtIST(selectedItem.verified_at)} tone={selectedItem.status === 'Approved' ? 'emerald' : 'red'} />
                  <AuditRow icon={CalendarRange} label="Admission Year" name={selectedItem.admission_year || '\u2014'} time="" />
                  {selectedItem.updated_by_name && (
                    <AuditRow icon={Edit} label="Last Updated By" name={selectedItem.updated_by_name} time={fmtIST(selectedItem.updated_at)} />
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow icon={Calendar} label="D.O.B" value={formatDate(selectedItem.dob)} />
                  <InfoRow icon={Phone} label="Student Phone" value={selectedItem.phone_no || '-'} />
                  <InfoRow icon={User} label="Parent" value={selectedItem.parent_name || '-'} />
                  <InfoRow icon={Phone} label="Parent Phone" value={selectedItem.parent_phone || '-'} />
                  <InfoRow icon={IdCard} label="Pen No" value={selectedItem.pen_no || '-'} />
                  <InfoRow icon={IdCard} label="Aadhar No" value={selectedItem.aadhar_no || '-'} />
                  <div className="sm:col-span-2"><InfoRow icon={MapPin} label="Address" value={selectedItem.address || '-'} /></div>
                </div>
                <div className="pt-5 border-t border-zinc-100">
                  <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-4">Academic History</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2"><InfoRow icon={School} label="Previous Institute" value={selectedItem.previous_institute || '-'} /></div>
                    <InfoRow icon={GraduationCap} label="Previous Grade" value={selectedItem.previous_grade || '-'} />
                    <InfoRow icon={Calendar} label="Joined Date" value={formatDate(selectedItem.school_joined_date)} />
                    <InfoRow icon={FileText} label="TC Number" value={selectedItem.tc_number || '-'} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {photoPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setPhotoPreview(null)}>
          <button onClick={() => setPhotoPreview(null)} className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-md hover:bg-white/10 transition-colors"><X className="size-6" /></button>
          <img src={photoPreview} alt="Student" onClick={e => e.stopPropagation()} className="max-w-full max-h-[90vh] rounded-lg object-contain shadow-2xl ring-1 ring-white/10" />
        </div>
      )}

      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-4xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">Edit Admission</h2>
              <button onClick={() => setModalVisible(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md"><X className="size-4" /></button>
            </div>
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar">
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <img src={selectedImage?.uri || resolvePhoto(formData.photo_url)} alt="" className="size-24 rounded-full object-cover ring-2 ring-white shadow-md bg-zinc-50" />
                  <label className="absolute bottom-0 right-0 bg-primary hover:bg-primary/90 text-white p-2 rounded-full cursor-pointer shadow-sm ring-2 ring-white transition-colors">
                    <Camera className="size-3.5" />
                    <input type="file" accept="image/*" onChange={handleChoosePhoto} className="hidden" />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <Field label="Admission No" required value={formData.admission_no} onChange={v => setFormData(p => ({ ...p, admission_no: v }))} />
                <Field label="Joining Grade" required type="select" options={gradeOptionsWith(formData.joining_grade)} value={formData.joining_grade} onChange={v => setFormData(p => ({ ...p, joining_grade: v }))} />
                <div className="md:col-span-2"><Field label="Student Name" required value={formData.student_name} onChange={v => setFormData(p => ({ ...p, student_name: v.replace(/[^a-zA-Z\s]/g, '') }))} /></div>
                <Field label="Date of Birth" type="date" value={formData.dob} onChange={v => setFormData(p => ({ ...p, dob: v }))} />
                <Field label="Student Phone" type="tel" placeholder="10 Digits" value={formData.phone_no} onChange={v => setFormData(p => ({ ...p, phone_no: v.replace(/[^0-9]/g, '').slice(0, 10) }))} />
                <Field label="Pen No" value={formData.pen_no} onChange={v => setFormData(p => ({ ...p, pen_no: v.replace(/[^a-zA-Z0-9]/g, '') }))} />
                <Field label="Aadhar No" placeholder="12 Digits" value={formData.aadhar_no} onChange={v => setFormData(p => ({ ...p, aadhar_no: v.replace(/[^0-9]/g, '').slice(0, 12) }))} />
                <div className="md:col-span-2 mt-2"><h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2">Parent Information</h3></div>
                <Field label="Parent Name" value={formData.parent_name} onChange={v => setFormData(p => ({ ...p, parent_name: v.replace(/[^a-zA-Z\s]/g, '') }))} />
                <Field label="Parent Phone" type="tel" placeholder="10 Digits" value={formData.parent_phone} onChange={v => setFormData(p => ({ ...p, parent_phone: v.replace(/[^0-9]/g, '').slice(0, 10) }))} />
                <div className="md:col-span-2"><Field label="Address" type="textarea" value={formData.address} onChange={v => setFormData(p => ({ ...p, address: v }))} /></div>
                <div className="md:col-span-2 mt-2"><h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2">Academic History</h3></div>
                <div className="md:col-span-2"><Field label="Previous Institute" value={formData.previous_institute} onChange={v => setFormData(p => ({ ...p, previous_institute: v }))} /></div>
                <Field label="Previous Grade" type="select" options={gradeOptionsWith(formData.previous_grade)} value={formData.previous_grade} onChange={v => setFormData(p => ({ ...p, previous_grade: v }))} />
                <Field label="School Joined Date" type="date" value={formData.school_joined_date} onChange={v => setFormData(p => ({ ...p, school_joined_date: v }))} />
                <Field label="TC Number" value={formData.tc_number} onChange={v => setFormData(p => ({ ...p, tc_number: v.replace(/[^a-zA-Z0-9]/g, '') }))} />
                {/* Status — only Approved / Rejected in this module */}
                <div className="md:col-span-2 mt-2">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">Status</label>
                  <div className="flex gap-2 sm:gap-3">
                    {['Approved', 'Rejected'].map(s => {
                      const on = formData.status === s;
                      const act = s === 'Approved' ? 'bg-emerald-500 text-white ring-emerald-600 shadow-sm' : 'bg-red-500 text-white ring-red-600 shadow-sm';
                      return (
                        <button key={s} type="button" onClick={() => setFormData(p => ({ ...p, status: s }))}
                          className={`h-9 flex-1 rounded-md text-xs font-semibold transition-colors ring-1 ring-inset flex items-center justify-center ${on ? act : 'bg-white text-zinc-600 ring-black/5 hover:bg-zinc-50'}`}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
              <button type="button" onClick={() => setModalVisible(false)} disabled={isSaving} className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">Cancel</button>
              <button type="button" onClick={handleSave} disabled={isSaving} className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">
                {isSaving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Check className="size-3.5 shrink-0" />}
                {isSaving ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 bg-white p-3 rounded-md ring-1 ring-black/5 shadow-sm">
    <div className="size-8 rounded-md bg-zinc-50 flex items-center justify-center ring-1 ring-black/5 shrink-0"><Icon className="size-4 text-primary" /></div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-zinc-900 truncate mt-0.5">{value}</p>
    </div>
  </div>
);

const AuditRow = ({ icon: Icon, label, name, time, tone }) => {
  const toneMap = { emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-600/20', red: 'bg-red-50 text-red-600 ring-red-600/20', amber: 'bg-amber-50 text-amber-600 ring-amber-600/20' };
  const iconCls = toneMap[tone] || 'bg-zinc-50 text-primary ring-black/5';
  return (
    <div className="flex items-start gap-3 bg-white p-3 rounded-md ring-1 ring-black/5 shadow-sm">
      <div className={`size-8 rounded-md flex items-center justify-center ring-1 shrink-0 ${iconCls}`}><Icon className="size-4" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-zinc-900 mt-0.5 break-words">{name || '\u2014'}</p>
        {time && <p className="text-[11px] text-zinc-400 mt-0.5">{time}</p>}
      </div>
    </div>
  );
};

function Field({ label, value, onChange, type = 'text', required, placeholder, options }) {
  const base = "h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm";
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">{label} {required && <span className="text-red-500">*</span>}</label>
      {type === 'select' ? (
        <div className="relative">
          <select value={value || ''} onChange={e => onChange(e.target.value)} className={`${base} appearance-none cursor-pointer pr-8`} required={required}>
            {(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={2} placeholder={placeholder} className={`${base} h-auto py-2.5 resize-none`} required={required} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={base} required={required} />
      )}
    </div>
  );
}

// --- How to use -----------------------------------------------------
const GUIDES = {
  manage: {
    title: 'Admissions',
    steps: [
      ['1 \u00b7 What this is', 'Applications that were Approved or Rejected in Pre-Admissions land here, stamped with the calendar year the decision was made in.'],
      ['2 \u00b7 Approved / Rejected', 'Switch between the Approved and Rejected lists with the tabs. Each list is numbered (S.No).'],
      ['3 \u00b7 By year', 'Pick a year to see only that year\u2019s admissions. It defaults to the current year. The year is a saved plain value \u2014 it is never linked to the Academics module, so deleting an academic year never affects these records.'],
      ['4 \u00b7 Edit & delete', 'Open a record to edit its details, flip Approved \u2194 Rejected, or delete it.'],
      ['5 \u00b7 Download', 'Export the current year (or All Years, grouped by year) to Excel.'],
    ],
    note: 'Decisions are made in Pre-Admissions; this module is where decided records live and are managed year-wise.'
  },
  view: {
    title: 'Admissions',
    steps: [
      ['1 \u00b7 Browse', 'Pick a record to see the full profile and the decision audit.'],
      ['2 \u00b7 Filter', 'Switch Approved / Rejected, pick a year, and search by name or ID.'],
      ['3 \u00b7 Download', 'Export the selection to a spreadsheet.'],
    ],
    note: 'Read-only view \u2014 editing and deleting needs the right permissions.'
  }
};

function AdmissionsHelp({ canEdit = false }) {
  const [open, setOpen] = useState(false);
  const content = canEdit ? GUIDES.manage : GUIDES.view;
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 self-start">
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