import React, { useState, useEffect, useCallback } from 'react';
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

const getCurrentYear = () => new Date().getFullYear().toString();

const StatusPill = ({ status }) => {
  const styles = {
    Pending: 'bg-amber-100 text-amber-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
  };
  return (
    <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
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
  const [filterYear, setFilterYear] = useState(getCurrentYear());

  // --- Fetch Data ---
  const fetchData = useCallback(async () => {
    if (!user?.institutionId || !isAdmin) return;
    setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/admin/preadmissions/${user.institutionId}`);
      url.searchParams.append('year', filterYear);
      url.searchParams.append('userId', user.id);
      if (searchText) url.searchParams.append('search', searchText);

      const res = await fetch(url);
      const records = await res.json();
      setData(Array.isArray(records) ? records : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, filterYear, searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // If not admin, completely block the screen
  if (!canRead && !isAdmin) {
  return (
    <div className="py-20 text-center text-slate-500">
      <IdCard className="w-12 h-12 mx-auto text-slate-300 mb-4" />
      <h2 className="text-xl font-bold text-slate-700">Access Denied</h2>
      <p>You do not have permission to view the admissions directory.</p>
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
        school_joined_date: toYYYYMMDD(item.school_joined_date),
        school_outgoing_date: toYYYYMMDD(item.school_outgoing_date),
        tc_issued_date: toYYYYMMDD(item.tc_issued_date)
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
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setSelectedImage({ uri: ev.target.result, file });
      reader.readAsDataURL(file);
    }
  };

  // --- Strict Validation Logic ---
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
      
      const validateGrade = (grade, label) => {
          if (!grade) return true;
          if (!/^[a-zA-Z0-9\s-]+$/.test(grade)) {
              alert(`Invalid Grade: ${label} must be alphanumeric (e.g. LKG, 1).`);
              return false;
          }
          return true;
      };
      if (!validateGrade(formData.school_joined_grade, 'Joined Grade')) return false;
      if (!validateGrade(formData.school_outgoing_grade, 'Outgoing Grade')) return false;

      return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    
    try {
      const body = new FormData();
      body.append('institutionId', user.institutionId);
      
      const allowedFields = [
        'admission_no', 'student_name', 'joining_grade', 'dob', 'phone_no', 'previous_institute', 
        'previous_grade', 'pen_no', 'aadhar_no', 'parent_name', 'parent_phone', 'address', 'status', 
        'school_joined_date', 'school_joined_grade', 'school_outgoing_date', 'school_outgoing_grade', 
        'tc_issued_date', 'tc_number'
      ];

      allowedFields.forEach(key => {
        const val = formData[key];
        if (val !== null && val !== undefined && val !== '') body.append(key, String(val));
      });
      
      if (selectedImage?.file) body.append('photo', selectedImage.file);

      const url = isEditing ? `${API_BASE_URL}/admin/preadmissions/${currentItem.id}` : `${API_BASE_URL}/admin/preadmissions`;
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        body
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Save failed');
      }
      setModalVisible(false);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center justify-center text-center gap-1">
        <h1 className="text-xl lg:text-2xl font-black text-slate-800">Admissions Directory</h1>
        <p className="text-sm text-slate-500 font-medium">Manage applications and full student records</p>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: List */}
        <div className={`lg:col-span-5 flex flex-col gap-4 ${selectedItem ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && fetchData()} placeholder="Search name or ID..."
                className="w-full bg-slate-50 border-none rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <select value={filterYear} onChange={e => { setFilterYear(e.target.value); fetchData(); }} 
              className="ml-3 bg-slate-50 border-none rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
              <option value={getCurrentYear()}>{getCurrentYear()}</option>
              <option value={parseInt(getCurrentYear()) - 1}>{parseInt(getCurrentYear()) - 1}</option>
            </select>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[70vh]">
            <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h2 className="font-black text-slate-700">Applications ({data.length})</h2>
             {(canEdit || isAdmin) && (
  <button onClick={() => handleOpenModal()} className="bg-blue-600 ...">
    <Plus size={16} />
  </button>
)}

            </div>
            
            <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
              {loading ? <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div> 
              : data.length === 0 ? <div className="p-10 text-center text-slate-400 font-medium">No records found.</div>
              : data.map(item => (
                <div key={item.id} onClick={() => setSelectedItem(item)} className={`p-4 flex items-center cursor-pointer transition-colors ${selectedItem?.id === item.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <img src={item.photo_url ? `${API_BASE_URL.replace('/api','')}${item.photo_url}` : '/default-avatar.png'} alt="" className="w-10 h-10 rounded-full object-cover bg-slate-200 mr-3" />
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-bold truncate ${selectedItem?.id === item.id ? 'text-blue-700' : 'text-slate-700'}`}>{item.student_name}</h4>
                    <p className="text-xs text-slate-500">ID: {item.admission_no}</p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Details */}
        <div className={`lg:col-span-7 ${!selectedItem ? 'hidden lg:block' : 'block'}`}>
          {!selectedItem ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 h-[70vh] flex flex-col items-center justify-center text-center p-8">
              <IdCard className="w-16 h-16 text-slate-200 mb-4" />
              <h3 className="text-xl font-black text-slate-400">Select an Application</h3>
              <p className="text-slate-400 font-medium mt-1">Choose a student from the list to view their full directory profile.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm h-[80vh] flex flex-col">
              <div className="p-6 border-b border-slate-50 flex items-center gap-4 bg-slate-50/50 rounded-t-3xl shrink-0">
                <button onClick={() => setSelectedItem(null)} className="lg:hidden p-2 bg-white rounded-xl shadow-sm text-slate-500"><X size={16} /></button>
                <img src={selectedItem.photo_url ? `${API_BASE_URL.replace('/api','')}${selectedItem.photo_url}` : '/default-avatar.png'} alt="" className="w-16 h-16 rounded-2xl object-cover bg-slate-200 border-2 border-white shadow-sm" />
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-800">{selectedItem.student_name}</h3>
                  <p className="text-sm font-bold text-slate-500">Grade: {selectedItem.joining_grade} • ID: {selectedItem.admission_no}</p>
                </div>
               <div className="flex gap-2">
  {(canEdit || isAdmin) && (
    <button onClick={() => handleOpenModal(selectedItem)} className="...">
      <Edit size={16} />
    </button>
  )}
  {(canDelete || isAdmin) && (
    <button onClick={() => handleDelete(selectedItem.id)} className="...">
      <Trash2 size={16} />
    </button>
  )}
</div>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                  <InfoRow icon={Calendar} label="Submitted" value={formatDate(selectedItem.submission_date, true)} />
                  <InfoRow icon={Calendar} label="D.O.B" value={formatDate(selectedItem.dob)} />
                  <InfoRow icon={Phone} label="Student Phone" value={selectedItem.phone_no || '—'} />
                  <InfoRow icon={User} label="Parent" value={selectedItem.parent_name || '—'} />
                  <InfoRow icon={Phone} label="Parent Phone" value={selectedItem.parent_phone || '—'} />
                  <InfoRow icon={IdCard} label="Pen No" value={selectedItem.pen_no || '—'} />
                  <InfoRow icon={IdCard} label="Aadhar No" value={selectedItem.aadhar_no || '—'} />
                  <div className="sm:col-span-2"><InfoRow icon={MapPin} label="Address" value={selectedItem.address || '—'} /></div>
                </div>

                {/* Academic History */}
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Academic History</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                    <div className="sm:col-span-2"><InfoRow icon={School} label="Previous Institute" value={selectedItem.previous_institute || '—'} /></div>
                    <InfoRow icon={GraduationCap} label="Joined Grade" value={selectedItem.school_joined_grade || '—'} />
                    <InfoRow icon={GraduationCap} label="Outgoing Grade" value={selectedItem.school_outgoing_grade || '—'} />
                    <InfoRow icon={Calendar} label="Joined Date" value={formatDate(selectedItem.school_joined_date)} />
                    <InfoRow icon={Calendar} label="Outgoing Date" value={formatDate(selectedItem.school_outgoing_date)} />
                    <InfoRow icon={FileText} label="TC Number" value={selectedItem.tc_number || '—'} />
                    <InfoRow icon={Calendar} label="TC Issued Date" value={formatDate(selectedItem.tc_issued_date)} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL FOR CREATE/EDIT --- */}
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setModalVisible(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={24} /></button>
            <h2 className="text-2xl font-black mb-6 text-slate-800">{isEditing ? 'Edit Application' : 'New Application'}</h2>

            <div className="flex flex-col items-center mb-6">
              <div className="relative">
                <img src={selectedImage?.uri || (formData.photo_url ? `${API_BASE_URL.replace('/api','')}${formData.photo_url}` : '/default-avatar.png')} 
                  alt="" className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 bg-slate-50" />
                <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full cursor-pointer shadow-md transition-colors">
                  <Camera size={14} />
                  <input type="file" accept="image/*" onChange={handleChoosePhoto} className="hidden" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Form Fields using standard unified inputs */}
              <Field label="Admission No *" value={formData.admission_no} onChange={v => setForm('admission_no', v)} />
              <Field label="Joining Grade *" value={formData.joining_grade} onChange={v => setForm('joining_grade', v)} />
              <div className="md:col-span-2"><Field label="Student Name *" value={formData.student_name} onChange={v => setForm('student_name', v.replace(/[^a-zA-Z\s]/g, ''))} /></div>
              
              <Field label="Date of Birth" type="date" value={formData.dob} onChange={v => setForm('dob', v)} />
              <Field label="Student Phone" type="tel" placeholder="10 Digits" value={formData.phone_no} onChange={v => setForm('phone_no', v.replace(/[^0-9]/g, '').slice(0,10))} />
              <Field label="Pen No" placeholder="Alphanumeric" value={formData.pen_no} onChange={v => setForm('pen_no', v.replace(/[^a-zA-Z0-9]/g, ''))} />
              <Field label="Aadhar No" placeholder="12 Digits" value={formData.aadhar_no} onChange={v => setForm('aadhar_no', v.replace(/[^0-9]/g, '').slice(0,12))} />
              
              <div className="md:col-span-2 mt-4"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Parent Information</h3></div>
              <Field label="Parent Name" value={formData.parent_name} onChange={v => setForm('parent_name', v.replace(/[^a-zA-Z\s]/g, ''))} />
              <Field label="Parent Phone" type="tel" placeholder="10 Digits" value={formData.parent_phone} onChange={v => setForm('parent_phone', v.replace(/[^0-9]/g, '').slice(0,10))} />
              <div className="md:col-span-2"><Field label="Address" type="textarea" value={formData.address} onChange={v => setForm('address', v)} /></div>

              <div className="md:col-span-2 mt-4"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Academic History</h3></div>
              <div className="md:col-span-2"><Field label="Previous Institute" value={formData.previous_institute} onChange={v => setForm('previous_institute', v)} /></div>
              <Field label="Previous Grade" value={formData.previous_grade} onChange={v => setForm('previous_grade', v)} />
              <div className="hidden md:block"></div>
              <Field label="School Joined Date" type="date" value={formData.school_joined_date} onChange={v => setForm('school_joined_date', v)} />
              <Field label="School Outgoing Date" type="date" value={formData.school_outgoing_date} onChange={v => setForm('school_outgoing_date', v)} />
              <Field label="Joined Grade" value={formData.school_joined_grade} onChange={v => setForm('school_joined_grade', v.replace(/[^a-zA-Z0-9\s-]/g, ''))} />
              <Field label="Outgoing Grade" value={formData.school_outgoing_grade} onChange={v => setForm('school_outgoing_grade', v.replace(/[^a-zA-Z0-9\s-]/g, ''))} />
              <Field label="TC Number" value={formData.tc_number} onChange={v => setForm('tc_number', v.replace(/[^a-zA-Z0-9]/g, ''))} />
              <Field label="TC Issued Date" type="date" value={formData.tc_issued_date} onChange={v => setForm('tc_issued_date', v)} />

              <div className="md:col-span-2 mt-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 block">Status</label>
                <div className="flex gap-2">
                  {['Pending', 'Approved', 'Rejected'].map(status => (
                    <button key={status} onClick={() => setForm('status', status)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${formData.status === status ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={handleSave} disabled={isSaving} className="w-full bg-slate-900 hover:bg-blue-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black uppercase tracking-widest mt-8 transition-all shadow-xl flex justify-center gap-2">
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  function setForm(key, value) { setFormData(prev => ({ ...prev, [key]: value })); }
}

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0"><Icon size={14} className="text-blue-600" /></div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold text-slate-700 truncate">{value}</p>
    </div>
  </div>
);

// Shared input field standard 
function Field({ label, value, onChange, type = 'text', required, placeholder }) {
  const base = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium transition-all";
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</label>
      {type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={2} placeholder={placeholder} className={base + ' resize-none'} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={base} />
      )}
    </div>
  );
}