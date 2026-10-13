import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Camera, Phone, Calendar, IdCard, User, FileText,
  MapPin, Edit, Trash2, GraduationCap, X, Check, School,
  Search, Loader2, ChevronDown, Download, HelpCircle, ShieldCheck
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
const normGrade = (s) => String(s ?? '').trim().toLowerCase().replace(/^class\s*/, '').trim();

export default function PreAdmissionsScreen() {
  const { user } = useAuth();
  const { can, isAllAccess } = usePermissions();
  const canRead = can('PreAdmissions', 'read');
  const canEdit = can('PreAdmissions', 'edit');
  const canDelete = can('PreAdmissions', 'delete');
  const isAdmin = isAllAccess;

  const [data, setData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Filters (status tabs removed — this module is Pending-only now)
  const [searchText, setSearchText] = useState('');
  const currentYear = new Date().getFullYear();
  const [availableYears, setAvailableYears] = useState([]);
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [filterJoiningClass, setFilterJoiningClass] = useState('');

  const fetchData = useCallback(async () => {
    if (!user?.institutionId || (!canRead && !isAdmin)) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('userId', user.id);
      if (searchText) params.append('search', searchText);
      if (filterYear && filterYear !== 'all') params.append('year', filterYear);
      const res = await fetch(`${API_BASE_URL}/admin/preadmissions/${user.institutionId}?${params.toString()}`);
      const records = await res.json();
      setData(Array.isArray(records) ? records : []);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  }, [user, isAdmin, canRead, searchText, filterYear]);

  const loadFormData = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
      const d = await res.json();
      setClasses(d.classes || []);
    } catch (e) { console.error('Load classes error:', e); }
    try {
      const res2 = await fetch(`${API_BASE_URL}/admin/preadmissions/${user.institutionId}/years`);
      const yrs = await res2.json();
      setAvailableYears(Array.isArray(yrs) ? yrs.map(Number).filter(Boolean) : []);
    } catch (e) { console.error('Load years error:', e); }
  }, [user]);

  useEffect(() => { loadFormData(); }, [loadFormData]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const yearOptions = useMemo(() => {
    const set = new Set(availableYears); set.add(currentYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [availableYears, currentYear]);

  const classOptions = useMemo(
    () => Array.from(new Set((classes || []).map(c => c.className).filter(Boolean))), [classes]);
  const gradeSelectOptions = useMemo(
    () => [{ value: '', label: 'Select grade...' }, ...classOptions.map(n => ({ value: n, label: n }))], [classOptions]);
  const gradeOptionsWith = (val) => {
    if (!val) return gradeSelectOptions;
    return gradeSelectOptions.some(o => o.value === val) ? gradeSelectOptions : [...gradeSelectOptions, { value: val, label: val }];
  };

  // Joining-class filter only (status is server-side Pending; search server-side).
  const filteredData = useMemo(() => {
    return data.filter(item =>
      filterJoiningClass ? normGrade(item.joining_grade) === normGrade(filterJoiningClass) : true);
  }, [data, filterJoiningClass]);

  const handleDownload = useCallback(async () => {
    if (!user?.institutionId) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      params.set('year', filterYear);
      params.set('scope', 'pending');
      const res = await fetch(`${API_BASE_URL}/admin/preadmissions/${user.institutionId}/export?${params.toString()}`);
      if (!res.ok) throw new Error('Could not generate the Excel file.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filterYear === 'all' ? 'PreAdmissions_AllYears.xlsx' : `PreAdmissions_${filterYear}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { alert(e.message || 'Download failed.'); }
    setDownloading(false);
  }, [user, filterYear]);

  if (!canRead && !isAdmin) {
    return (
      <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
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
      setIsEditing(true); setCurrentItem(item);
      setFormData({ ...item, dob: toYYYYMMDD(item.dob), school_joined_date: toYYYYMMDD(item.school_joined_date) });
    } else {
      setIsEditing(false); setCurrentItem(null); setFormData({ status: 'Pending' });
    }
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

  const validateForm = () => {
    if (!formData.admission_no || !formData.student_name || !formData.joining_grade) { alert('Admission No, Name, and Joining Grade are required.'); return false; }
    if (formData.phone_no && !/^[1-9][0-9]{9}$/.test(formData.phone_no)) { alert('Phone must be exactly 10 digits and cannot start with 0.'); return false; }
    if (formData.pen_no && !/^[a-zA-Z0-9]{6,20}$/.test(formData.pen_no)) { alert('Pen No must be 6-20 alphanumeric characters.'); return false; }
    if (formData.aadhar_no && !/^[0-9]{12}$/.test(formData.aadhar_no)) { alert('Aadhar must be exactly 12 digits.'); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const payload = { institutionId: user.institutionId };
      const allowedFields = ['admission_no', 'student_name', 'joining_grade', 'dob', 'phone_no', 'previous_institute',
        'previous_grade', 'pen_no', 'aadhar_no', 'parent_name', 'parent_phone', 'address', 'status',
        'school_joined_date', 'tc_number', 'photo_url'];
      allowedFields.forEach(key => {
        const val = formData[key];
        if (val !== null && val !== undefined && val !== '') payload[key] = val;
      });
      // New records are always Pending; editing never changes status here.
      if (!isEditing) payload.status = 'Pending'; else delete payload.status;
      const url = isEditing ? `${API_BASE_URL}/admin/preadmissions/${currentItem.id}` : `${API_BASE_URL}/admin/preadmissions`;
      const res = await fetch(url, { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Save failed'); }
      setModalVisible(false); setSelectedItem(null); fetchData();
    } catch (error) { alert(error.message); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this application permanently?")) return;
    try {
      await fetch(`${API_BASE_URL}/admin/preadmissions/${id}`, { method: 'DELETE' });
      setSelectedItem(null); fetchData();
    } catch (e) { alert('Failed to delete.'); }
  };

  // Approve / Reject → moves the record into the Admissions module.
  const handleDecide = async (id, status) => {
    const label = status === 'Approved' ? 'Approve' : 'Reject';
    if (!window.confirm(`${label} this application? It will move to the Admissions module.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/preadmissions/${id}/decide`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to update.'); }
      setSelectedItem(null); fetchData();
    } catch (e) { alert(e.message); }
  };

  const canAct = canEdit || isAdmin;

  return (
    <div className="w-full py-6 lg:py-8 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col flex-1 min-h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2 sm:mb-0">
        <header className="flex flex-col">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
            <IdCard className="text-primary size-5" /> Pre-Admissions
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-[56ch]">Pending applications. Approve or reject to move them into Admissions.</p>
        </header>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <PreAdmissionsHelp canEdit={canAct} />
          <button onClick={handleDownload} disabled={downloading}
            className="h-9 px-4 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0">
            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {downloading ? 'Preparing...' : (filterYear === 'all' ? 'Download All (Excel)' : `Download ${filterYear} (Excel)`)}
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
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                  className="h-9 bg-zinc-50/50 border border-transparent rounded-md pl-3 pr-8 text-sm font-semibold text-zinc-700 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none">
                  {yearOptions.map(y => (<option key={y} value={String(y)}>{y}</option>))}
                  <option value="all">All Years</option>
                </select>
                <ChevronDown className="size-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div className="pt-2 mt-1 border-t border-zinc-100">
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
            </div>
          </div>

          <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col h-[70vh]">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 shrink-0">
              <h2 className="font-semibold text-zinc-800 text-sm">Pending ({filteredData.length})</h2>
              {canAct && (
                <button onClick={() => handleOpenModal()} className="h-8 w-8 bg-primary/10 hover:bg-primary/20 text-primary rounded-md flex items-center justify-center transition-colors">
                  <Plus className="size-4" />
                </button>
              )}
            </div>
            <div className="overflow-y-auto custom-scrollbar flex-1 divide-y divide-zinc-100">
              {loading ? (
                <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary size-6" /></div>
              ) : filteredData.length === 0 ? (
                <div className="p-10 text-center text-zinc-400 font-medium text-sm">No pending applications.</div>
              ) : (
                filteredData.map((item, idx) => (
                  <div key={item.id} onClick={() => setSelectedItem(item)}
                    className={`p-3 sm:p-4 flex items-center cursor-pointer transition-colors ${selectedItem?.id === item.id ? 'bg-primary/5' : 'hover:bg-zinc-50/80'}`}>
                    <span className="w-6 text-center text-xs font-semibold text-zinc-400 tabular-nums shrink-0 mr-1">{idx + 1}</span>
                    <img src={resolvePhoto(item.photo_url)} alt="" className="size-10 rounded-md object-cover bg-zinc-100 mr-3 ring-1 ring-black/5 shadow-sm" />
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className={`font-semibold text-sm truncate ${selectedItem?.id === item.id ? 'text-primary' : 'text-zinc-900'}`}>{item.student_name}</h4>
                      <p className="text-xs text-zinc-500 font-medium mt-0.5">Grade: {item.joining_grade} {'\u2022'} ID: {item.admission_no}</p>
                    </div>
                    {canAct && (
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleDecide(item.id, 'Approved')} title="Approve"
                          className="size-7 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 ring-1 ring-emerald-600/15 flex items-center justify-center transition-colors">
                          <Check className="size-3.5" />
                        </button>
                        <button onClick={() => handleDecide(item.id, 'Rejected')} title="Reject"
                          className="size-7 rounded-md bg-red-50 text-red-600 hover:bg-red-100 ring-1 ring-red-600/15 flex items-center justify-center transition-colors">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    )}
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
              <IdCard className="size-12 text-zinc-200 mb-3" />
              <h3 className="text-base font-semibold text-zinc-400">Select an Application</h3>
              <p className="text-zinc-400 font-medium text-sm mt-1">Choose an applicant to review, then Approve or Reject.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg ring-1 ring-black/5 shadow-sm h-[80vh] flex flex-col mt-[52px] lg:mt-0">
              <div className="p-5 border-b border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-zinc-50/50 rounded-t-lg shrink-0">
                <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
                  <button onClick={() => setSelectedItem(null)} className="lg:hidden p-1.5 bg-white rounded-md shadow-sm ring-1 ring-black/5 text-zinc-500 hover:text-zinc-900 transition-colors">
                    <X className="size-4" />
                  </button>
                  <img src={resolvePhoto(selectedItem.photo_url)} alt=""
                    onClick={() => selectedItem.photo_url && setPhotoPreview(resolvePhoto(selectedItem.photo_url))}
                    className="size-16 rounded-lg object-cover bg-zinc-100 ring-1 ring-black/5 shadow-sm shrink-0 cursor-zoom-in hover:ring-primary/40 transition-all" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-zinc-900 truncate">{selectedItem.student_name}</h3>
                    <p className="text-xs font-medium text-zinc-500 mt-1 truncate">Grade: {selectedItem.joining_grade} - ID: {selectedItem.admission_no}</p>
                  </div>
                </div>
                {canAct && (
                  <div className="flex flex-wrap gap-2 shrink-0 w-full sm:w-auto">
                    <button onClick={() => handleDecide(selectedItem.id, 'Approved')}
                      className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors">
                      <Check className="size-3.5" /> Approve
                    </button>
                    <button onClick={() => handleDecide(selectedItem.id, 'Rejected')}
                      className="h-8 px-3 bg-red-500 hover:bg-red-600 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors">
                      <X className="size-3.5" /> Reject
                    </button>
                    <button onClick={() => handleOpenModal(selectedItem)} title="Edit"
                      className="h-8 w-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-primary rounded-md flex items-center justify-center shadow-sm ring-1 ring-black/5 transition-colors">
                      <Edit className="size-4" />
                    </button>
                    {(canDelete || isAdmin) && (
                      <button onClick={() => handleDelete(selectedItem.id)} title="Delete"
                        className="h-8 w-8 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-red-600 rounded-md flex items-center justify-center shadow-sm ring-1 ring-black/5 transition-colors">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AuditRow icon={User} label="Created By" name={selectedItem.created_by_name} time={fmtIST(selectedItem.submission_date)} />
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
        <PreAdmissionModal
          isEditing={isEditing} formData={formData} setForm={(k, v) => setFormData(p => ({ ...p, [k]: v }))}
          selectedImage={selectedImage} onPhoto={handleChoosePhoto}
          gradeOptionsWith={gradeOptionsWith} resolvePhoto={resolvePhoto}
          onCancel={() => setModalVisible(false)} onSave={handleSave} isSaving={isSaving} />
      )}
    </div>
  );
}

// --- Create / Edit modal (no status selector — status is set by Approve/Reject)
function PreAdmissionModal({ isEditing, formData, setForm, selectedImage, onPhoto, gradeOptionsWith, resolvePhoto, onCancel, onSave, isSaving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-4xl shadow-xl relative max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 rounded-t-lg shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900">{isEditing ? 'Edit Application' : 'New Application'}</h2>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 hover:bg-zinc-100 rounded-md"><X className="size-4" /></button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <img src={selectedImage?.uri || resolvePhoto(formData.photo_url)} alt="" className="size-24 rounded-full object-cover ring-2 ring-white shadow-md bg-zinc-50" />
              <label className="absolute bottom-0 right-0 bg-primary hover:bg-primary/90 text-white p-2 rounded-full cursor-pointer shadow-sm ring-2 ring-white transition-colors">
                <Camera className="size-3.5" />
                <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <Field label="Admission No" required value={formData.admission_no} onChange={v => setForm('admission_no', v)} />
            <Field label="Joining Grade" required type="select" options={gradeOptionsWith(formData.joining_grade)} value={formData.joining_grade} onChange={v => setForm('joining_grade', v)} />
            <div className="md:col-span-2"><Field label="Student Name" required value={formData.student_name} onChange={v => setForm('student_name', v.replace(/[^a-zA-Z\s]/g, ''))} /></div>
            <Field label="Date of Birth" type="date" value={formData.dob} onChange={v => setForm('dob', v)} />
            <Field label="Student Phone" type="tel" placeholder="10 Digits" value={formData.phone_no} onChange={v => setForm('phone_no', v.replace(/[^0-9]/g, '').slice(0, 10))} />
            <Field label="Pen No" placeholder="Alphanumeric" value={formData.pen_no} onChange={v => setForm('pen_no', v.replace(/[^a-zA-Z0-9]/g, ''))} />
            <Field label="Aadhar No" placeholder="12 Digits" value={formData.aadhar_no} onChange={v => setForm('aadhar_no', v.replace(/[^0-9]/g, '').slice(0, 12))} />
            <div className="md:col-span-2 mt-2"><h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2">Parent Information</h3></div>
            <Field label="Parent Name" value={formData.parent_name} onChange={v => setForm('parent_name', v.replace(/[^a-zA-Z\s]/g, ''))} />
            <Field label="Parent Phone" type="tel" placeholder="10 Digits" value={formData.parent_phone} onChange={v => setForm('parent_phone', v.replace(/[^0-9]/g, '').slice(0, 10))} />
            <div className="md:col-span-2"><Field label="Address" type="textarea" value={formData.address} onChange={v => setForm('address', v)} /></div>
            <div className="md:col-span-2 mt-2"><h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-2">Academic History</h3></div>
            <div className="md:col-span-2"><Field label="Previous Institute" value={formData.previous_institute} onChange={v => setForm('previous_institute', v)} /></div>
            <Field label="Previous Grade" type="select" options={gradeOptionsWith(formData.previous_grade)} value={formData.previous_grade} onChange={v => setForm('previous_grade', v)} />
            <Field label="School Joined Date" type="date" value={formData.school_joined_date} onChange={v => setForm('school_joined_date', v)} />
            <Field label="TC Number" value={formData.tc_number} onChange={v => setForm('tc_number', v.replace(/[^a-zA-Z0-9]/g, ''))} />
          </div>
        </div>
        <div className="p-5 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50 rounded-b-lg shrink-0">
          <button type="button" onClick={onCancel} disabled={isSaving} className="h-9 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-md font-semibold text-xs hover:bg-zinc-50 transition-colors w-full sm:w-auto">Cancel</button>
          <button type="button" onClick={onSave} disabled={isSaving} className="h-9 px-6 bg-primary hover:bg-primary/90 disabled:bg-zinc-300 disabled:text-zinc-500 text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto min-w-[120px]">
            {isSaving ? <Loader2 className="size-3.5 animate-spin shrink-0" /> : <Check className="size-3.5 shrink-0" />}
            {isSaving ? 'Saving...' : 'Save Record'}
          </button>
        </div>
      </div>
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
    title: 'Pre-Admissions',
    steps: [
      ['1 \u00b7 What this is', 'The intake list of pending applications. Fill in the applicant\u2019s details, parent info, academic history and a photo.'],
      ['2 \u00b7 Add or edit', 'Use the + button to add an application, or open one and hit Edit. Admission No, Student Name and Joining Grade are required.'],
      ['3 \u00b7 Approve or Reject', 'On a row, or inside the profile, use Approve / Reject. The application leaves this list and moves into the Admissions module, stamped with the active academic year.'],
      ['4 \u00b7 Find applications', 'Search by name or ID, pick a Year (the submission year), and narrow by Joining Class.'],
      ['5 \u00b7 Download', 'Export the pending list as an Excel file.'],
    ],
    note: 'This list only ever shows Pending applications. Once a decision is made, manage the record in the Admissions module.'
  },
  view: {
    title: 'Pre-Admissions',
    steps: [
      ['1 \u00b7 Browse', 'Pick an application to see the full profile.'],
      ['2 \u00b7 Find one', 'Search by name or ID, choose a Year, and narrow by Joining Class.'],
      ['3 \u00b7 Download', 'Export the pending list as a spreadsheet.'],
    ],
    note: 'This is a read-only view \u2014 adding, editing and deciding applications needs the right permissions.'
  }
};

function PreAdmissionsHelp({ canEdit = false }) {
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