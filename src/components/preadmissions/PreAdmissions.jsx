import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Camera, Phone, Calendar, IdCard, User, FileText,
  MapPin, Edit, Trash2, GraduationCap, X, Check, School,
  Search, Loader2, ChevronDown
} from 'lucide-react';
import { usePermissions } from '../../Screens/PermissionsContext';

// --- Formatters ---
const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
  if (includeTime) { options.hour = '2-digit'; options.minute = '2-digit'; }
  return date.toLocaleDateString('en-GB', options);
};

const toYYYYMMDD = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

// Case-insensitive trimmed equality used by the client-side filters
const eq = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

const StatusPill = ({ status }) => {
  const styles = {
    Pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    Rejected: 'bg-red-50 text-red-700 ring-red-600/20',
  };
  return (
    <div className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${styles[status] || 'bg-zinc-50 text-zinc-600 ring-zinc-500/20'}`}>
      {status}
    </div>
  );
};

export default function PreAdmissionsScreen() {
  const { user } = useAuth();

  // Admin Check
  const { can, isAllAccess } = usePermissions();
  const canRead = can('PreAdmissions', 'read');
  const canEdit = can('PreAdmissions', 'edit');
  const canDelete = can('PreAdmissions', 'delete');
  const isAdmin = isAllAccess;

  const [data, setData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Filters
  const [searchText, setSearchText] = useState('');
  // Year filter now follows the ACADEMIC CALENDAR — it holds an academic
  // year id (defaults to the school's active year once loaded).
  const [filterAcademicYearId, setFilterAcademicYearId] = useState('');
  const [filterStatus, setFilterStatus] = useState(null);
  // Two independent class filters — Joining class and Previous class.
  // '' means "All Classes" (the default for both).
  const [filterJoiningClass, setFilterJoiningClass] = useState('');
  const [filterPreviousClass, setFilterPreviousClass] = useState('');

  // --- Fetch Data ---
  // Scoped to the selected academic year by submission_date range (from/to),
  // matching the way every other module anchors to the academic calendar.
  const fetchData = useCallback(async () => {
    if (!user?.institutionId || (!canRead && !isAdmin)) return;

    setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/admin/preadmissions/${user.institutionId}`);
      url.searchParams.append('userId', user.id);
      if (searchText) url.searchParams.append('search', searchText);

      const yr = academicYears.find(y => String(y.id) === String(filterAcademicYearId));
      if (yr?.startDate && yr?.endDate) {
        url.searchParams.append('from', String(yr.startDate).slice(0, 10));
        url.searchParams.append('to', String(yr.endDate).slice(0, 10));
      }

      const res = await fetch(url);
      const records = await res.json();
      setData(Array.isArray(records) ? records : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, canRead, searchText, academicYears, filterAcademicYearId]);

  // --- Fetch master list of classes + academic years -----------------
  const loadFormData = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
      const d = await res.json();
      setClasses(d.classes || []);
      const years = d.academicYears || [];
      setAcademicYears(years);
      // Default the year filter to the active academic year (once).
      setFilterAcademicYearId(prev => {
        if (prev) return prev;
        const active = years.find(y => y.isActive) || years[0];
        return active ? String(active.id) : '';
      });
    } catch (e) {
      console.error('Load data error:', e);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
    loadFormData();
  }, [fetchData, loadFormData]);

  // Distinct class names (grades). Sections are not relevant to a grade,
  // so we collapse to unique className values.
  const classOptions = useMemo(
    () => Array.from(new Set((classes || []).map(c => c.className).filter(Boolean))),
    [classes]
  );
  // Options for the in-form grade dropdowns.
  const gradeSelectOptions = useMemo(
    () => [{ value: '', label: 'Select grade...' }, ...classOptions.map(n => ({ value: n, label: n }))],
    [classOptions]
  );

  // --- FOOLPROOF FRONTEND FILTERING ---
  // Status + the two class filters are applied here (independent of each
  // other); the academic year is applied server-side via from/to.
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchStatus   = filterStatus ? eq(item.status, filterStatus) : true;
      const matchJoining  = filterJoiningClass ? eq(item.joining_grade, filterJoiningClass) : true;
      const matchPrevious = filterPreviousClass ? eq(item.previous_grade, filterPreviousClass) : true;
      return matchStatus && matchJoining && matchPrevious;
    });
  }, [data, filterStatus, filterJoiningClass, filterPreviousClass]);

  const getFilterTabClass = (status, isActive) => {
    if (!isActive) return 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200';
    if (status === 'Pending') return 'bg-amber-500 text-white shadow-sm';
    if (status === 'Approved') return 'bg-emerald-500 text-white shadow-sm';
    if (status === 'Rejected') return 'bg-red-500 text-white shadow-sm';
    return 'bg-primary text-white shadow-sm';
  };

  // If not admin and no read permission, completely block the screen
  if (!canRead && !isAdmin) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
        <div className="bg-white p-12 rounded-lg ring-1 ring-black/5 border-dashed text-center flex flex-col items-center">
          <IdCard className="size-10 text-zinc-300 mb-3" />
          <h2 className="text-lg font-semibold text-zinc-900 mb-1">Access Denied</h2>
          <p className="text-sm font-medium text-zinc-500">You do not have permission to view the admissions directory.</p>
        </div>
      </div>
    );
  }

  const handleOpenModal = (item = null) => {
    setSelectedImage(null);
    if (item) {
      setIsEditing(true);
      setCurrentItem(item);
      setFormData({
        ...item,
        dob: toYYYYMMDD(item.dob),
        school_joined_date: toYYYYMMDD(item.school_joined_date)
      });
    } else {
      setIsEditing(false);
      setCurrentItem(null);
      setFormData({ status: 'Pending' });
    }
    setModalVisible(true);
  };

  const handleChoosePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) return alert('Picture must be under 3 MB.');

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, photo_url: reader.result }));
      setSelectedImage({ uri: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    if (!formData.admission_no || !formData.student_name || !formData.joining_grade) {
      alert('Validation Error: Admission No, Name, and Joining Grade are required.');
      return false;
    }
    if (formData.phone_no && !/^[1-9][0-9]{9}$/.test(formData.phone_no)) {
      alert('Invalid Phone: Must be exactly 10 digits and cannot start with 0.');
      return false;
    }
    if (formData.pen_no && !/^[a-zA-Z0-9]{6,20}$/.test(formData.pen_no)) {
      alert('Invalid Pen No: Must be 6-20 alphanumeric characters.');
      return false;
    }
    if (formData.aadhar_no && !/^[0-9]{12}$/.test(formData.aadhar_no)) {
      alert('Invalid Aadhar: Must be exactly 12 digits.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);

    try {
      const payload = {
        institutionId: user.institutionId
      };

      // Removed fields (not relevant for pre-admission): school_joined_grade,
      // school_outgoing_date, school_outgoing_grade, tc_issued_date.
      const allowedFields = [
        'admission_no', 'student_name', 'joining_grade', 'dob', 'phone_no', 'previous_institute',
        'previous_grade', 'pen_no', 'aadhar_no', 'parent_name', 'parent_phone', 'address', 'status',
        'school_joined_date', 'tc_number', 'photo_url'
      ];

      allowedFields.forEach(key => {
        const val = formData[key];
        if (val !== null && val !== undefined && val !== '') {
          payload[key] = val;
        }
      });

      const url = isEditing ? `${API_BASE_URL}/admin/preadmissions/${currentItem.id}` : `${API_BASE_URL}/admin/preadmissions`;

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Save failed');
      }

      setModalVisible(false);
      setSelectedItem(null);
      fetchData();
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this application permanently?")) return;
    try {
      await fetch(`${API_BASE_URL}/admin/preadmissions/${id}`, {
        method: 'DELETE'
      });
      setSelectedItem(null);
      fetchData();
    } catch (e) { alert('Failed to delete.'); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">

      {/* Header */}
      <header className="flex flex-col mb-2 sm:mb-0">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
          <IdCard className="text-primary size-5" />
          Admissions Directory
        </h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Manage applications and full student records.</p>
      </header>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 flex-1">

        {/* LEFT COLUMN: List */}
        <div className={`lg:col-span-4 xl:col-span-5 flex flex-col gap-4 ${selectedItem ? 'hidden lg:flex' : 'flex'}`}>

          {/* FILTER SECTION */}
          <div className="bg-white p-2 rounded-lg shadow-sm ring-1 ring-black/5 flex flex-col gap-2">

            {/* ROW 1: Search & Academic Year */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 size-4" />
                <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchData()} placeholder="Search name or ID..."
                  className="h-9 w-full bg-zinc-50/50 border border-transparent rounded-md pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors placeholder:text-zinc-400" />
              </div>

              <div className="relative shrink-0">
                <select value={filterAcademicYearId} onChange={e => setFilterAcademicYearId(e.target.value)}
                  className="h-9 bg-zinc-50/50 border border-transparent rounded-md pl-3 pr-8 text-sm font-semibold text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none max-w-[180px] truncate">
                  {academicYears.length === 0 && <option value="">All</option>}
                  {academicYears.map(y => (
                    <option key={y.id} value={String(y.id)}>{y.name}{y.isActive ? ' (Active)' : ''}</option>
                  ))}
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* ROW 2: Status Tabs (toggleable; null = all statuses) */}
            <div className="flex gap-1">
              {['Pending', 'Approved', 'Rejected'].map((status) => (
                <button key={status} onClick={() => setFilterStatus(prev => prev === status ? null : status)}
                  className={`px-3 h-8 text-[10px] font-semibold rounded-md transition-colors flex-1 ${getFilterTabClass(status, filterStatus === status)}`}>
                  {status}
                </button>
              ))}
            </div>

            {/* ROW 3: Two class filters — Joining class & Previous class.
                 Both default to "All Classes" and filter independently. */}
            <div className="pt-2 mt-1 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">Joining Class</span>
                <div className="relative">
                  <select value={filterJoiningClass} onChange={e => setFilterJoiningClass(e.target.value)}
                    className="h-8 w-full bg-zinc-50/50 border border-transparent rounded-md pl-3 pr-8 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white appearance-none shadow-sm cursor-pointer transition-colors text-zinc-700 font-medium">
                    <option value="">All Classes</option>
                    {classOptions.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <ChevronDown className="size-3 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">Previous Class</span>
                <div className="relative">
                  <select value={filterPreviousClass} onChange={e => setFilterPreviousClass(e.target.value)}
                    className="h-8 w-full bg-zinc-50/50 border border-transparent rounded-md pl-3 pr-8 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white appearance-none shadow-sm cursor-pointer transition-colors text-zinc-700 font-medium">
                    <option value="">All Classes</option>
                    {classOptions.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <ChevronDown className="size-3 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col h-[70vh]">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 shrink-0">
              <h2 className="font-semibold text-zinc-800 text-sm">Applications ({filteredData.length})</h2>
              {(canEdit || isAdmin) && (
                <button onClick={() => handleOpenModal()} className="h-8 w-8 bg-primary/10 hover:bg-primary/20 text-primary rounded-md flex items-center justify-center transition-colors">
                  <Plus className="size-4" />
                </button>
              )}
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 divide-y divide-zinc-100">
              {loading ? (
                <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary size-6" /></div>
              ) : filteredData.length === 0 ? (
                <div className="p-10 text-center text-zinc-400 font-medium text-sm">No records found.</div>
              ) : (
                filteredData.map(item => (
                  <div key={item.id} onClick={() => setSelectedItem(item)} className={`p-4 flex items-center cursor-pointer transition-colors ${selectedItem?.id === item.id ? 'bg-primary/5' : 'hover:bg-zinc-50/80'}`}>
                    <img src={item.photo_url || '/default-avatar.png'} alt="" className="size-10 rounded-md object-cover bg-zinc-100 mr-3 ring-1 ring-black/5 shadow-sm" />
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className={`font-semibold text-sm truncate ${selectedItem?.id === item.id ? 'text-primary' : 'text-zinc-900'}`}>{item.student_name}</h4>
                      <p className="text-xs text-zinc-500 font-medium mt-0.5">Grade: {item.joining_grade} • ID: {item.admission_no}</p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Details */}
        <div className={`lg:col-span-8 xl:col-span-7 ${!selectedItem ? 'hidden lg:block' : 'block'}`}>
          {!selectedItem ? (
            <div className="bg-white rounded-lg ring-1 ring-black/5 border-dashed h-[70vh] flex flex-col items-center justify-center text-center p-8 mt-[52px]">
              <IdCard className="size-12 text-zinc-200 mb-3" />
              <h3 className="text-base font-semibold text-zinc-400">Select an Application</h3>
              <p className="text-zinc-400 font-medium text-sm mt-1">Choose a student from the list to view their full directory profile.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm h-[80vh] flex flex-col mt-[52px] lg:mt-0">
              <div className="p-5 border-b border-zinc-100 flex items-start sm:items-center gap-4 bg-zinc-50/50 rounded-t-lg shrink-0">
                <button onClick={() => setSelectedItem(null)} className="lg:hidden p-1.5 bg-white rounded-md shadow-sm ring-1 ring-black/5 text-zinc-500 hover:text-zinc-900 transition-colors mt-1 sm:mt-0">
                  <X className="size-4" />
                </button>
                <img src={selectedItem.photo_url || '/default-avatar.png'} alt="" className="size-16 rounded-lg object-cover bg-zinc-100 ring-1 ring-black/5 shadow-sm shrink-0" />
                <div className="flex-1 min-w-0 mt-1 sm:mt-0">
                  <h3 className="text-lg font-semibold text-zinc-900 truncate">{selectedItem.student_name}</h3>
                  <p className="text-xs font-medium text-zinc-500 mt-1 truncate">Grade: {selectedItem.joining_grade} - ID: {selectedItem.admission_no}</p>
                </div>
                <div className="flex gap-2 shrink-0 self-start sm:self-center">
                  {(canEdit || isAdmin) && (
                    <button onClick={() => handleOpenModal(selectedItem)} className="h-8 w-8 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-md flex items-center justify-center transition-colors">
                      <Edit className="size-4" />
                    </button>
                  )}
                  {(canDelete || isAdmin) && (
                    <button onClick={() => handleDelete(selectedItem.id)} className="h-8 w-8 bg-red-50 text-red-600 hover:bg-red-100 rounded-md flex items-center justify-center transition-colors">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow icon={Calendar} label="Submitted" value={formatDate(selectedItem.submission_date, true)} />
                  <InfoRow icon={Calendar} label="D.O.B" value={formatDate(selectedItem.dob)} />
                  <InfoRow icon={Phone} label="Student Phone" value={selectedItem.phone_no || '-'} />
                  <InfoRow icon={User} label="Parent" value={selectedItem.parent_name || '-'} />
                  <InfoRow icon={Phone} label="Parent Phone" value={selectedItem.parent_phone || '-'} />
                  <InfoRow icon={IdCard} label="Pen No" value={selectedItem.pen_no || '-'} />
                  <InfoRow icon={IdCard} label="Aadhar No" value={selectedItem.aadhar_no || '-'} />
                  <div className="sm:col-span-2"><InfoRow icon={MapPin} label="Address" value={selectedItem.address || '-'} /></div>
                </div>

                {/* Academic History */}
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

      {/* --- MODAL FOR CREATE/EDIT --- */}
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-4xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900">{isEditing ? 'Edit Application' : 'New Application'}</h2>
              <button onClick={() => setModalVisible(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md">
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar">
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <img src={selectedImage?.uri || (formData.photo_url ? `${API_BASE_URL.replace('/api','')}${formData.photo_url}` : '/default-avatar.png')}
                    alt="" className="size-24 rounded-full object-cover ring-2 ring-white shadow-md bg-zinc-50" />
                  <label className="absolute bottom-0 right-0 bg-primary hover:bg-primary/90 text-white p-2 rounded-full cursor-pointer shadow-sm ring-2 ring-white transition-colors">
                    <Camera className="size-3.5" />
                    <input type="file" accept="image/*" onChange={handleChoosePhoto} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Form Fields using standard unified inputs */}
                <Field label="Admission No" required value={formData.admission_no} onChange={v => setForm('admission_no', v)} />
                {/* Joining Grade is now a class dropdown */}
                <Field label="Joining Grade" required type="select" options={gradeSelectOptions}
                  value={formData.joining_grade} onChange={v => setForm('joining_grade', v)} />
                <div className="md:col-span-2"><Field label="Student Name" required value={formData.student_name} onChange={v => setForm('student_name', v.replace(/[^a-zA-Z\s]/g, ''))} /></div>

                <Field label="Date of Birth" type="date" value={formData.dob} onChange={v => setForm('dob', v)} />
                <Field label="Student Phone" type="tel" placeholder="10 Digits" value={formData.phone_no} onChange={v => setForm('phone_no', v.replace(/[^0-9]/g, '').slice(0,10))} />
                <Field label="Pen No" placeholder="Alphanumeric" value={formData.pen_no} onChange={v => setForm('pen_no', v.replace(/[^a-zA-Z0-9]/g, ''))} />
                <Field label="Aadhar No" placeholder="12 Digits" value={formData.aadhar_no} onChange={v => setForm('aadhar_no', v.replace(/[^0-9]/g, '').slice(0,12))} />

                <div className="md:col-span-2 mt-2">
                  <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2">Parent Information</h3>
                </div>
                <Field label="Parent Name" value={formData.parent_name} onChange={v => setForm('parent_name', v.replace(/[^a-zA-Z\s]/g, ''))} />
                <Field label="Parent Phone" type="tel" placeholder="10 Digits" value={formData.parent_phone} onChange={v => setForm('parent_phone', v.replace(/[^0-9]/g, '').slice(0,10))} />
                <div className="md:col-span-2"><Field label="Address" type="textarea" value={formData.address} onChange={v => setForm('address', v)} /></div>

                <div className="md:col-span-2 mt-2">
                  <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2">Academic History</h3>
                </div>
                <div className="md:col-span-2"><Field label="Previous Institute" value={formData.previous_institute} onChange={v => setForm('previous_institute', v)} /></div>
                {/* Previous Grade is a class dropdown. (Joined Grade, School Outgoing
                    Date and TC Issued Date removed — not relevant for pre-admission.) */}
                <Field label="Previous Grade" type="select" options={gradeSelectOptions}
                  value={formData.previous_grade} onChange={v => setForm('previous_grade', v)} />
                <Field label="School Joined Date" type="date" value={formData.school_joined_date} onChange={v => setForm('school_joined_date', v)} />
                <Field label="TC Number" value={formData.tc_number} onChange={v => setForm('tc_number', v.replace(/[^a-zA-Z0-9]/g, ''))} />

                <div className="md:col-span-2 mt-2">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">Status</label>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    {['Pending', 'Approved', 'Rejected'].map(status => {
                      const isActive = formData.status === status;
                      let activeClass = 'bg-primary text-white ring-primary shadow-sm';
                      if (isActive) {
                        if (status === 'Pending') activeClass = 'bg-amber-500 text-white ring-amber-600 shadow-sm';
                        if (status === 'Approved') activeClass = 'bg-emerald-500 text-white ring-emerald-600 shadow-sm';
                        if (status === 'Rejected') activeClass = 'bg-red-500 text-white ring-red-600 shadow-sm';
                      }
                      return (
                        <button key={status} type="button" onClick={() => setForm('status', status)}
                          className={`h-9 flex-1 rounded-md text-xs font-semibold transition-colors ring-1 ring-inset flex items-center justify-center ${
                            isActive
                            ? activeClass
                            : 'bg-white text-zinc-600 ring-black/5 hover:bg-zinc-50'
                          }`}>
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
              <button type="button" onClick={() => setModalVisible(false)} disabled={isSaving}
                className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={isSaving}
                className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">
                {isSaving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Check className="size-3.5 shrink-0" />}
                {isSaving ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function setForm(key, value) { setFormData(prev => ({ ...prev, [key]: value })); }
}

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 bg-white p-3 rounded-md ring-1 ring-black/5 shadow-sm">
    <div className="size-8 rounded-md bg-zinc-50 flex items-center justify-center ring-1 ring-black/5 shrink-0">
      <Icon className="size-4 text-primary" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-zinc-900 truncate mt-0.5">{value}</p>
    </div>
  </div>
);

// Shared input field standard — now supports type="select" (with options)
function Field({ label, value, onChange, type = 'text', required, placeholder, options }) {
  const base = "h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors shadow-sm";
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'select' ? (
        <div className="relative">
          <select value={value || ''} onChange={e => onChange(e.target.value)}
            className={`${base} appearance-none cursor-pointer pr-8`} required={required}>
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