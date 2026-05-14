import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { FaUsers, FaCogs, FaCalendarAlt, FaLayerGroup, FaArrowUp, FaTrash, FaEdit, FaCheck, FaPlus, FaShieldAlt, FaTimes } from 'react-icons/fa';
import { MdAddCircle, MdClass, MdOutlineViewModule } from 'react-icons/md';

// ==========================================
// 1. ACADEMIC YEAR COMPONENT (Integrated)
// ==========================================
const AcademicYearSettings = () => {
    const [years, setYears] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingYearId, setEditingYearId] = useState(null);
    const [newYear, setNewYear] = useState({ name: '', start: '', end: '' });

    const fetchYears = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get('/academic-years');
            setYears(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchYears(); }, []);

    // Safely format date to YYYY-MM-DD for HTML input
    const formatDate = (dateString) => {
        const d = new Date(dateString);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleEditYear = (y) => {
        setEditingYearId(y.id);
        setNewYear({
            name: y.year_name,
            start: formatDate(y.start_date),
            end: formatDate(y.end_date)
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteYear = async (id) => {
        if (window.confirm("Are you sure you want to delete this Academic Year?")) {
            try {
                await apiClient.delete(`/academic-years/${id}`);
                if (editingYearId === id) {
                    setEditingYearId(null);
                    setNewYear({ name: '', start: '', end: '' });
                }
                fetchYears();
            } catch (e) { alert("Failed to delete year. It might be in use."); }
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            if (editingYearId) {
                await apiClient.put(`/academic-years/${editingYearId}`, { 
                    year_name: newYear.name, 
                    start_date: newYear.start, 
                    end_date: newYear.end 
                });
                alert("Academic Year Updated Successfully!");
                setEditingYearId(null);
            } else {
                await apiClient.post('/academic-years', { 
                    year_name: newYear.name, 
                    start_date: newYear.start, 
                    end_date: newYear.end 
                });
                alert("New Academic Year Created Successfully!");
            }
            setNewYear({ name: '', start: '', end: '' });
            fetchYears();
        } catch (e) { alert("Failed to save year."); }
    };

    const setCurrentYear = async (id) => {
        if (window.confirm("Changing the current year will move the whole system context to this year. Continue?")) {
            try {
                await apiClient.put(`/academic-years/set-current/${id}`);
                fetchYears();
                window.location.reload();
            } catch (e) { alert("Update failed"); }
        }
    };

    return (
        <div className="ay-container animate-fade">
            <style>{`
                .ay-container { font-family: 'Inter', sans-serif; }
                .setup-card { background: white; padding: 30px; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
                .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }
                .input-box { display: flex; flex-direction: column; gap: 5px; }
                .input-box label { font-size: 12px; font-weight: 700; color: #64748b; }
                .input-box input { padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; outline: none; background: #f8fafc; }
                .input-box input:focus { border-color: #4f46e5; background: white; }
                .add-ay-btn { background: #4f46e5; color: white; border: none; padding: 12px; border-radius: 10px; font-weight: 700; cursor: pointer; align-self: flex-end; height: 43px;}
                .btn-cancel { background: #f1f5f9; color: #475569; border: none; padding: 12px; border-radius: 10px; font-weight: 700; cursor: pointer; align-self: flex-end; height: 43px; margin-right: 10px;}
                
                .year-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
                .year-card { background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; position: relative; transition: 0.3s; }
                .year-card.active { border-color: #4f46e5; background: #f5f3ff; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.1); }
                .status-badge { position: absolute; top: 15px; right: 15px; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 800; }
                .card-actions { display: flex; gap: 8px; margin-top: 15px; justify-content: flex-end; }
            `}</style>

            <div className="setup-card">
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <MdAddCircle size={24} color="#4f46e5" />
                    <h2 style={{margin:0}}>{editingYearId ? "Edit Session" : "Setup New Session"}</h2>
                </div>
                <form className="form-row" onSubmit={handleAdd}>
                    <div className="input-box">
                        <label>Session Name</label>
                        <input required placeholder="e.g. 2025-2026" value={newYear.name} onChange={e => setNewYear({...newYear, name: e.target.value})} />
                    </div>
                    <div className="input-box">
                        <label>Start Date</label>
                        <input required type="date" value={newYear.start} onChange={e => setNewYear({...newYear, start: e.target.value})} />
                    </div>
                    <div className="input-box">
                        <label>End Date</label>
                        <input required type="date" value={newYear.end} onChange={e => setNewYear({...newYear, end: e.target.value})} />
                    </div>
                    <div style={{display: 'flex', alignSelf: 'flex-end'}}>
                        {editingYearId && <button type="button" className="btn-cancel" onClick={() => { setEditingYearId(null); setNewYear({ name: '', start: '', end: '' }); }}>Cancel</button>}
                        <button type="submit" className="add-ay-btn">{editingYearId ? "Update Session" : "Initialize Year"}</button>
                    </div>
                </form>
            </div>

            <h3 style={{color: '#1e293b', marginBottom: '20px'}}>Historical & Active Sessions</h3>
            <div className="year-grid">
                {years.map(y => (
                    <div key={y.id} className={`year-card ${y.is_current ? 'active' : ''}`}>
                        <span className="status-badge" style={{
                            background: y.is_current ? '#4f46e5' : '#e2e8f0',
                            color: y.is_current ? 'white' : '#64748b'
                        }}>
                            {y.is_current ? 'CURRENT SESSION' : 'ARCHIVED'}
                        </span>
                        <h4 style={{margin: '0 0 10px 0', fontSize: '20px'}}>{y.year_name}</h4>
                        <div style={{display:'flex', gap:'10px', color:'#64748b', fontSize:'13px'}}>
                            <span>📅 {new Date(y.start_date).toLocaleDateString()}</span>
                            <span>to</span>
                            <span>{new Date(y.end_date).toLocaleDateString()}</span>
                        </div>
                        
                        {!y.is_current && (
                            <button 
                                onClick={() => setCurrentYear(y.id)}
                                style={{marginTop: '20px', width: '100%', padding: '10px', background: 'white', border: '1px solid #4f46e5', color: '#4f46e5', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}
                            >
                                Activate This Session
                            </button>
                        )}
                        
                        <div className="card-actions">
                            <button className="icon-btn edit" onClick={() => handleEditYear(y)}><FaEdit size={16}/></button>
                            <button className="icon-btn delete" onClick={() => handleDeleteYear(y.id)}><FaTrash size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ==========================================
// 2. CLASS SETTINGS COMPONENT (New)
// ==========================================
const ClassSettings = ({ classes, sections, loadData }) => {
    const [newClassName, setNewClassName] = useState('');
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [newSectionName, setNewSectionName] = useState('');
    const [editingClassId, setEditingClassId] = useState(null);

    const handleAddClass = async (e) => {
        e.preventDefault();
        if (!newClassName) return;
        try {
            if (editingClassId) {
                await apiClient.put(`/classes/${editingClassId}`, { class_name: newClassName });
                setEditingClassId(null);
            } else {
                await apiClient.post('/classes', { class_name: newClassName });
            }
            setNewClassName('');
            loadData();
        } catch (error) { alert("Failed to save class."); }
    };

    const handleEditClass = (c) => {
        setEditingClassId(c.id);
        setNewClassName(c.class_name);
    };

    const handleDeleteClass = async (id) => {
        if (window.confirm("Delete this class? All linked sections will also be removed.")) {
            try {
                await apiClient.delete(`/classes/${id}`);
                if (selectedClassId === id) setSelectedClassId(null);
                if (editingClassId === id) {
                    setEditingClassId(null);
                    setNewClassName('');
                }
                loadData();
            } catch (error) { alert("Failed to delete class."); }
        }
    };

    const handleAddSection = async (e) => {
        e.preventDefault();
        if (!newSectionName || !selectedClassId) return;
        try {
            await apiClient.post('/sections', { class_id: selectedClassId, section_name: newSectionName });
            setNewSectionName('');
            loadData();
        } catch (error) { alert("Failed to add section."); }
    };

    const handleDeleteSection = async (id) => {
        if (window.confirm("Delete this section?")) {
            try {
                await apiClient.delete(`/sections/${id}`);
                loadData();
            } catch (error) { alert("Failed to delete section."); }
        }
    };

    const activeSections = sections.filter(s => s.class_id === selectedClassId);

    return (
        <div className="class-settings-layout animate-fade">
            <style>{`
                .class-settings-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
                .module-card { background: white; border-radius: 16px; padding: 25px; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
                .module-card h3 { margin: 0 0 20px 0; color: #1e293b; display: flex; align-items: center; gap: 10px; }
                
                .add-form { display: flex; gap: 10px; margin-bottom: 25px; }
                .add-form input { flex: 1; padding: 12px 15px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; background: #f8fafc; }
                .add-form input:focus { border-color: #4f46e5; background: white; }
                
                .list-container { display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; padding-right: 5px; }
                .list-item { 
                    display: flex; justify-content: space-between; align-items: center; 
                    padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: 0.2s;
                }
                .list-item:hover { border-color: #cbd5e1; }
                .list-item.selected { background: #eef2ff; border-color: #4f46e5; }
                .list-item span { font-weight: 700; color: #334155; }
                .list-item.selected span { color: #4f46e5; }
                
                .empty-hint { text-align: center; color: #94a3b8; padding: 40px 20px; font-style: italic; }
            `}</style>

            {/* LEFT: CLASSES */}
            <div className="module-card">
                <h3><MdClass size={22} color="#4f46e5"/> Manage Classes</h3>
                <form className="add-form" onSubmit={handleAddClass}>
                    <input placeholder="e.g. Class 1, Nursery" value={newClassName} onChange={e => setNewClassName(e.target.value)} />
                    {editingClassId && <button type="button" className="btn-cancel" style={{padding: '0 15px'}} onClick={() => { setEditingClassId(null); setNewClassName(''); }}><FaTimes/></button>}
                    <button type="submit" className="btn-primary">{editingClassId ? <FaCheck/> : <FaPlus/>}</button>
                </form>

                <div className="list-container">
                    {classes.length === 0 && <div className="empty-hint">No classes created yet.</div>}
                    {classes.map(c => (
                        <div key={c.id} className={`list-item ${selectedClassId === c.id ? 'selected' : ''}`} onClick={() => setSelectedClassId(c.id)}>
                            <span>{c.class_name}</span>
                            <div style={{display: 'flex', gap: '5px'}}>
                                <button className="icon-btn edit" onClick={(e) => { e.stopPropagation(); handleEditClass(c); }}><FaEdit size={14}/></button>
                                <button className="icon-btn delete" onClick={(e) => { e.stopPropagation(); handleDeleteClass(c.id); }}><FaTrash size={14}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: SECTIONS */}
            <div className="module-card" style={{ opacity: selectedClassId ? 1 : 0.5, pointerEvents: selectedClassId ? 'auto' : 'none' }}>
                <h3><MdOutlineViewModule size={22} color="#4f46e5"/> Manage Sections</h3>
                {selectedClassId ? (
                    <>
                        <p style={{marginTop: '-15px', marginBottom: '20px', color: '#64748b', fontSize: '13px'}}>
                            Adding sections for: <strong>{classes.find(c => c.id === selectedClassId)?.class_name}</strong>
                        </p>
                        <form className="add-form" onSubmit={handleAddSection}>
                            <input placeholder="e.g. A, B, Section C" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} />
                            <button type="submit" className="btn-primary"><FaPlus/></button>
                        </form>

                        <div className="list-container">
                            {activeSections.length === 0 && <div className="empty-hint">No sections assigned to this class.</div>}
                            {activeSections.map(s => (
                                <div key={s.id} className="list-item">
                                    <span>Section {s.section_name}</span>
                                    <button className="icon-btn delete" onClick={() => handleDeleteSection(s.id)}><FaTrash size={14}/></button>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="empty-hint" style={{marginTop: '20px'}}>Select a class from the left to manage its sections.</div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// 3. ROLE CREATION COMPONENT
// ==========================================
const RoleCreation = ({ roles, loadData }) => {
    const [roleInput, setRoleInput] = useState('');
    const [editingRoleId, setEditingRoleId] = useState(null);

    const handleSaveRole = async () => {
        if (!roleInput) return;
        if (editingRoleId) {
            await apiClient.put(`/roles/${editingRoleId}`, { role_name: roleInput });
            setEditingRoleId(null);
        } else {
            await apiClient.post('/roles', { role_name: roleInput });
        }
        setRoleInput('');
        loadData();
    };

    const handleDeleteRole = async (id) => {
        if (window.confirm("Delete this role? This cannot be undone.")) {
            try {
                await apiClient.delete(`/roles/${id}`);
                loadData();
            } catch (e) { alert(e.response?.data?.message || "Error deleting"); }
        }
    };

    return (
        <div className="card animate-fade">
            <h2 style={{margin:'0 0 20px 0', color: '#111827'}}>Role Management</h2>
            <div className="role-input-container">
                <input 
                    placeholder="Enter Role Name (e.g. Librarian)" 
                    value={roleInput} 
                    onChange={e => setRoleInput(e.target.value)} 
                    className="role-text-input"
                />
                <button className="btn-primary" onClick={handleSaveRole}>
                    {editingRoleId ? <><FaCheck/> Update Role</> : <><FaPlus/> Save Role</>}
                </button>
                {editingRoleId && <button className="btn-cancel" onClick={() => {setEditingRoleId(null); setRoleInput('');}}>Cancel</button>}
            </div>

            <div className="role-grid">
                {roles.map(r => (
                    <div key={r.id} className="role-item-card">
                        <span className="role-name">{r.role_name}</span>
                        <div className="role-actions">
                            <button className="icon-btn edit" onClick={() => {setEditingRoleId(r.id); setRoleInput(r.role_name);}}><FaEdit/></button>
                            <button className="icon-btn delete" onClick={() => handleDeleteRole(r.id)}><FaTrash/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ==========================================
// 4. ROLE PERMISSIONS COMPONENT
// ==========================================
const RolePermissions = ({ roles }) => {
    const availableModules = [
        'Admissions', 'Alumni', 'Fees Management', 'Timetable', 'Attendance', 
        'Syllabus', 'Lesson Plan', 'Exams & Schedules', 'Marks Entry', 
        'Group Chat', 'Transport', 'Manage Login'
    ];
    
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [permissions, setPermissions] = useState([]);

    useEffect(() => {
        if (roles.length > 0 && !selectedRoleId) {
            setSelectedRoleId(roles[0].id.toString());
        }
    }, [roles, selectedRoleId]);

    useEffect(() => {
        if (selectedRoleId) {
            const currentRole = roles.find(r => r.id.toString() === selectedRoleId);
            const isSuperAdmin = currentRole?.role_name === 'Super Admin' || currentRole?.role_name === 'SUPER ADMIN';

            apiClient.get(`/roles/${selectedRoleId}/permissions`).then(res => {
                const fetchedPerms = res.data;
                const initialPerms = availableModules.map(mod => {
                    const found = fetchedPerms.find(f => f.module_name === mod);
                    if (found) {
                        const isHidden = (!found.can_read && !found.can_edit && !found.can_delete);
                        return { 
                            ...found, 
                            can_read: !!found.can_read, 
                            can_edit: !!found.can_edit, 
                            can_delete: !!found.can_delete, 
                            is_hidden: isHidden 
                        };
                    } else {
                        if (isSuperAdmin) {
                            return { module_name: mod, can_read: true, can_edit: true, can_delete: true, is_hidden: false };
                        }
                        return { module_name: mod, can_read: false, can_edit: false, can_delete: false, is_hidden: true };
                    }
                });
                setPermissions(initialPerms);
            }).catch(err => console.error("Error fetching permissions", err));
        }
    }, [selectedRoleId, roles]);

    const handleToggle = (moduleName, field) => {
        setPermissions(prev => prev.map(p => {
            if (p.module_name === moduleName) {
                let updated = { ...p, [field]: !p[field] };
                
                if (field === 'is_hidden' && updated.is_hidden) {
                    updated.can_read = false;
                    updated.can_edit = false;
                    updated.can_delete = false;
                } else if (field !== 'is_hidden' && updated[field]) {
                    updated.is_hidden = false;
                }
                if (!updated.can_read && !updated.can_edit && !updated.can_delete) {
                    updated.is_hidden = true;
                }

                return updated;
            }
            return p;
        }));
    };

    const handleSavePermissions = async () => {
        try {
            await apiClient.post(`/roles/${selectedRoleId}/permissions`, { permissions });
            alert("Permissions updated successfully!");
        } catch (error) {
            alert("Failed to update permissions.");
        }
    };

    if (roles.length === 0) return <div className="card">Please create a role first in the Role Creation tab.</div>;

    return (
        <div className="card animate-fade">
            <h2 style={{margin:'0 0 20px 0'}}>Assign Module Permissions</h2>
            
            <div style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <label style={{ fontWeight: '700', color: '#1e293b' }}>Select Role to Configure:</label>
                <select 
                    value={selectedRoleId} 
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', minWidth: '250px', outline: 'none', background: '#f8fafc', fontWeight: '600' }}
                >
                    {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.role_name}</option>
                    ))}
                </select>
            </div>

            <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                        <tr>
                            <th>Module Name</th>
                            <th style={{ textAlign: 'center' }}>Hide completely</th>
                            <th style={{ textAlign: 'center' }}>Read Only</th>
                            <th style={{ textAlign: 'center' }}>Edit / Add</th>
                            <th style={{ textAlign: 'center' }}>Delete</th>
                        </tr>
                    </thead>
                    <tbody>
                        {permissions.map((p, index) => (
                            <tr key={p.module_name} style={{ background: index % 2 === 0 ? 'white' : '#f8fafc' }}>
                                <td style={{ fontWeight: 600, color: '#334155' }}>{p.module_name}</td>
                                <td style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={p.is_hidden} onChange={() => handleToggle(p.module_name, 'is_hidden')} style={{ cursor: 'pointer', transform: 'scale(1.3)', accentColor: '#64748b' }} />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={p.can_read} onChange={() => handleToggle(p.module_name, 'can_read')} style={{ cursor: 'pointer', transform: 'scale(1.3)', accentColor: '#4f46e5' }} />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={p.can_edit} onChange={() => handleToggle(p.module_name, 'can_edit')} style={{ cursor: 'pointer', transform: 'scale(1.3)', accentColor: '#4f46e5' }} />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={p.can_delete} onChange={() => handleToggle(p.module_name, 'can_delete')} style={{ cursor: 'pointer', transform: 'scale(1.3)', accentColor: '#ef4444' }} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={handleSavePermissions}>
                    <FaCheck/> Save Permissions
                </button>
            </div>
        </div>
    );
};

// ==========================================
// 5. USER LIST COMPONENT
// ==========================================
const UserList = ({ roles, users, subTab, setSubTab, loadData }) => {
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);

    const emptyUser = {
        username: '', password: '', full_name: '', email: '', role_id: '',
        status: 'active', roll_no: '', admission_no: '', parent_name: '',
        phone_no: '', aadhar_no: '', pen_no: '', admission_date: '',
        joining_date: '', experience: '', class_group: ''
    };
    const [newUser, setNewUser] = useState(emptyUser);

    const handleUserInputChange = (e) => {
        setNewUser({ ...newUser, [e.target.name]: e.target.value });
    };

    const handleAddClick = () => {
        setEditingUserId(null);
        setNewUser(emptyUser);
        setIsUserModalOpen(true);
    };

    const handleEditClick = (userObj) => {
        setEditingUserId(userObj.id);
        setNewUser({
            ...userObj,
            password: userObj.password || '', 
            email: userObj.email || '',
            phone_no: userObj.phone_no || '',
            aadhar_no: userObj.aadhar_no || '',
            roll_no: userObj.roll_no || '',
            admission_no: userObj.admission_no || '',
            class_group: userObj.class_group || '',
            experience: userObj.experience || ''
        });
        setIsUserModalOpen(true);
    };

    const handleDeleteClick = async (id) => {
        if (window.confirm("Are you sure you want to delete this user? This cannot be undone.")) {
            try {
                await apiClient.delete(`/users/${id}`);
                alert("User deleted successfully!");
                loadData();
            } catch (error) {
                alert("Error deleting user: " + (error.response?.data?.error || error.message));
            }
        }
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        try {
            if (editingUserId) {
                await apiClient.put(`/users/${editingUserId}`, newUser);
                alert("User Updated Successfully");
            } else {
                await apiClient.post('/users', newUser);
                alert("User Created Successfully");
            }
            setIsUserModalOpen(false);
            setNewUser(emptyUser);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Error saving user: " + (error.response?.data?.error || error.message));
        }
    };

    return (
        <div className="animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div className="sub-tab-bar">
                    {roles.map(r => (
                        <button key={r.id} className={`sub-tab ${subTab === r.role_name ? 'active' : ''}`} onClick={() => setSubTab(r.role_name)}>
                            {r.role_name}
                        </button>
                    ))}
                </div>
                <button className="btn-primary" onClick={handleAddClick}>
                    <FaPlus /> Add New User
                </button>
            </div>

            <div className="card no-padding">
                <table className="data-table">
                    <thead><tr><th>Full Name</th><th>Username</th><th>Contact</th><th>Account Status</th><th style={{textAlign: 'right'}}>Actions</th></tr></thead>
                    <tbody>
                        {users.filter(u => u.role === subTab).map(u => (
                            <tr key={u.id}>
                                <td style={{fontWeight: 700, color: '#111827'}}>{u.full_name}</td>
                                <td style={{color:'#64748b'}}>{u.username}</td>
                                <td style={{color:'#64748b'}}>{u.phone_no || '---'}</td>
                                <td><span className={`status-pill ${u.status === 'active' ? 'active' : 'inactive'}`}>{u.status}</span></td>
                                <td style={{textAlign: 'right'}}>
                                    <div style={{display: 'flex', gap: '5px', justifyContent: 'flex-end'}}>
                                        <button className="icon-btn edit" onClick={() => handleEditClick(u)}><FaEdit size={16}/></button>
                                        <button className="icon-btn delete" onClick={() => handleDeleteClick(u.id)}><FaTrash size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.filter(u => u.role === subTab).length === 0 && (
                            <tr><td colSpan="5" style={{textAlign: 'center', color: '#94a3b8', padding: '30px'}}>No users found in this role.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit User Modal */}
            {isUserModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade">
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                            <h2>{editingUserId ? "Edit User Details" : "Create New User"}</h2>
                            <button type="button" className="icon-btn" onClick={() => setIsUserModalOpen(false)}><FaTimes size={20}/></button>
                        </div>
                        <form onSubmit={handleSaveUser}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Full Name *</label>
                                    <input required name="full_name" value={newUser.full_name} onChange={handleUserInputChange} />
                                </div>
                                <div className="form-group">
                                    <label>Username *</label>
                                    <input required name="username" value={newUser.username} onChange={handleUserInputChange} />
                                </div>
                                <div className="form-group">
                                    <label>Password *</label>
                                    <input required type="password" name="password" value={newUser.password} onChange={handleUserInputChange} placeholder={editingUserId ? "(Provide password)" : ""} />
                                </div>
                                <div className="form-group">
                                    <label>Assign Role *</label>
                                    <select required name="role_id" value={newUser.role_id} onChange={handleUserInputChange}>
                                        <option value="">Select a Role</option>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Email Address</label>
                                    <input type="email" name="email" value={newUser.email} onChange={handleUserInputChange} />
                                </div>
                                <div className="form-group">
                                    <label>Phone Number</label>
                                    <input name="phone_no" value={newUser.phone_no} onChange={handleUserInputChange} />
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <select name="status" value={newUser.status} onChange={handleUserInputChange}>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Aadhar No</label>
                                    <input name="aadhar_no" value={newUser.aadhar_no} onChange={handleUserInputChange} />
                                </div>
                            </div>
                            
                            <hr style={{margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0'}} />
                            <h4 style={{marginBottom: '15px', color: '#64748b'}}>Optional Academic Details</h4>
                            
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Roll No</label>
                                    <input name="roll_no" value={newUser.roll_no} onChange={handleUserInputChange} />
                                </div>
                                <div className="form-group">
                                    <label>Admission No</label>
                                    <input name="admission_no" value={newUser.admission_no} onChange={handleUserInputChange} />
                                </div>
                                <div className="form-group">
                                    <label>Class Group (If Teacher)</label>
                                    <input name="class_group" value={newUser.class_group} onChange={handleUserInputChange} />
                                </div>
                                <div className="form-group">
                                    <label>Experience (If Staff)</label>
                                    <input name="experience" value={newUser.experience} onChange={handleUserInputChange} />
                                </div>
                            </div>

                            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px'}}>
                                <button type="button" className="btn-cancel" onClick={() => setIsUserModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary">{editingUserId ? "Update User" : "Save User"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================
// 6. MAIN PARENT COMPONENT
// ==========================================
export default function AdminLM() {
    const [mainTab, setMainTab] = useState('users');
    const [subTab, setSubTab] = useState('');
    
    const [roles, setRoles] = useState([]);
    const [users, setUsers] = useState([]);
    const [years, setYears] = useState([]);
    const [classes, setClasses] = useState([]);
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [r, u, y, c, s] = await Promise.all([
                apiClient.get('/roles'),
                apiClient.get('/users'),
                apiClient.get('/academic-years'),
                apiClient.get('/classes'),
                apiClient.get('/sections') 
            ]);
            setRoles(r.data);
            setUsers(u.data);
            setYears(y.data);
            setClasses(c.data);
            setSections(s.data);
            if (r.data.length > 0 && !subTab) setSubTab(r.data[0].role_name);
        } catch (e) { console.error("Sync Error", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    return (
        <div className="master-admin-layout">
            <style>{`
                .master-admin-layout { font-family: 'Inter', sans-serif; padding: 20px; background-color: #f8fafc; min-height: 100vh;}
                
                .main-tab-nav { display: flex; flex-wrap: wrap; gap: 30px; border-bottom: 2px solid #e2e8f0; margin-bottom: 30px; }
                .tab-trigger { 
                    padding: 10px 0; cursor: pointer; border: none; background: none; 
                    font-weight: 700; color: #94a3b8; display: flex; align-items: center; gap: 8px; 
                    border-bottom: 3px solid transparent; transition: 0.2s; font-size: 14px;
                }
                .tab-trigger:hover { color: #4f46e5; }
                .tab-trigger.active { color: #4f46e5; border-bottom-color: #4f46e5; }

                .sub-tab-bar { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 5px; }
                .sub-tab { 
                    padding: 8px 20px; border-radius: 50px; border: none; 
                    background: transparent; cursor: pointer; font-size: 14px; font-weight: 600; color: #64748b;
                    transition: all 0.3s ease;
                }
                .sub-tab.active { background: #4f46e5; color: white; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.2); }

                .card { background: white; border-radius: 16px; padding: 30px; border: 1px solid #f1f5f9; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
                .card.no-padding { padding: 0; overflow: hidden; }

                .role-input-container { display: flex; gap: 15px; margin-bottom: 30px; align-items: center; }
                .role-text-input { flex: 1; padding: 14px 20px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 14px; background: white; transition: 0.2s; }
                .role-text-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }

                .role-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 10px; }
                .role-item-card { 
                    background: white; border: 1px solid #e2e8f0; padding: 15px 20px; 
                    border-radius: 12px; display: flex; justify-content: space-between; align-items: center;
                    min-width: 200px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: 0.2s;
                }
                .role-item-card:hover { border-color: #cbd5e1; box-shadow: 0 4px 6px rgba(0,0,0,0.04); }
                .role-name { font-weight: 700; color: #1e293b; font-size: 15px; }

                .data-table { width: 100%; border-collapse: collapse; background: white; }
                .data-table th { text-align: left; padding: 16px 24px; background: #f8fafc; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e2e8f0; }
                .data-table td { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
                .data-table tr:last-child td { border-bottom: none; }

                .btn-primary { background: #5a67d8; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px; transition: 0.2s; font-size: 14px; }
                .btn-primary:hover { background: #4c51bf; }
                .btn-cancel { background: #f1f5f9; color: #475569; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.2s;}
                .btn-cancel:hover { background: #e2e8f0; }
                
                .icon-btn { border: none; background: transparent; padding: 6px; border-radius: 6px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
                .icon-btn.edit { color: #3b82f6; }
                .icon-btn.delete { color: #ef4444; }
                .icon-btn:hover { background: #f1f5f9; }

                .status-pill { padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                .status-pill.active { background: #dcfce7; color: #166534; }
                .status-pill.inactive { background: #fee2e2; color: #991b1b; }

                /* Modal Styles */
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(4px); }
                .modal-content { background: white; padding: 30px 40px; border-radius: 16px; width: 700px; max-width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .form-group { display: flex; flex-direction: column; gap: 8px; }
                .form-group label { font-size: 13px; font-weight: 600; color: #475569; }
                .form-group input, .form-group select { padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; font-size: 14px; transition: border-color 0.2s; background: #f8fafc; }
                .form-group input:focus, .form-group select:focus { border-color: #4f46e5; background: white; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }

                .animate-fade { animation: fadeIn 0.4s ease; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            <nav className="main-tab-nav">
                <button className={`tab-trigger ${mainTab === 'users' ? 'active' : ''}`} onClick={() => setMainTab('users')}><FaUsers/> Users</button>
                <button className={`tab-trigger ${mainTab === 'roles' ? 'active' : ''}`} onClick={() => setMainTab('roles')}><FaCogs/> Role Creation</button>
                <button className={`tab-trigger ${mainTab === 'permissions' ? 'active' : ''}`} onClick={() => setMainTab('permissions')}><FaShieldAlt/> Role Permissions</button>
                <button className={`tab-trigger ${mainTab === 'academic' ? 'active' : ''}`} onClick={() => setMainTab('academic')}><FaCalendarAlt/> Academic Year</button>
                <button className={`tab-trigger ${mainTab === 'classes' ? 'active' : ''}`} onClick={() => setMainTab('classes')}><FaLayerGroup/> Class Settings</button>
                <button className={`tab-trigger ${mainTab === 'promotion' ? 'active' : ''}`} onClick={() => setMainTab('promotion')}><FaArrowUp/> Promotion</button>
            </nav>

            <div className="content-area">
                {mainTab === 'users' && <UserList roles={roles} users={users} subTab={subTab} setSubTab={setSubTab} loadData={loadData} />}
                {mainTab === 'roles' && <RoleCreation roles={roles} loadData={loadData} />}
                {mainTab === 'permissions' && <RolePermissions roles={roles} />}
                {mainTab === 'academic' && <AcademicYearSettings />}
                {mainTab === 'classes' && <ClassSettings classes={classes} sections={sections} loadData={loadData} />}
                
                {mainTab === 'promotion' && <div className="card">Batch Promotion module ready for next session.</div>}
            </div>
        </div>
    );
}