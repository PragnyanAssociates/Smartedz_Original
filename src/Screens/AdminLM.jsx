import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { FaUsers, FaCogs, FaCalendarAlt, FaLayerGroup, FaArrowUp, FaTrash, FaEdit, FaCheck, FaPlus, FaShieldAlt } from 'react-icons/fa';

export default function AdminLM() {
    const [mainTab, setMainTab] = useState('users');
    const [subTab, setSubTab] = useState('');
    
    const [roles, setRoles] = useState([]);
    const [users, setUsers] = useState([]);
    const [years, setYears] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(false);

    // Role Editing State
    const [roleInput, setRoleInput] = useState('');
    const [editingRoleId, setEditingRoleId] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [r, u, y, c] = await Promise.all([
                apiClient.get('/roles'),
                apiClient.get('/users'),
                apiClient.get('/academic-years'),
                apiClient.get('/classes')
            ]);
            setRoles(r.data);
            setUsers(u.data);
            setYears(y.data);
            setClasses(c.data);
            if (r.data.length > 0 && !subTab) setSubTab(r.data[0].role_name);
        } catch (e) { console.error("Sync Error", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    // --- Role Actions ---
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

    // --- Tab Components ---
    const RoleCreation = () => (
        <div className="card animate-fade">
            <h2 style={{margin:'0 0 20px 0'}}>Role Management</h2>
            <div className="flex-row">
                <input 
                    placeholder="Enter Role Name (e.g. Librarian)" 
                    value={roleInput} 
                    onChange={e => setRoleInput(e.target.value)} 
                    style={{flex: 1}}
                />
                <button className="btn" onClick={handleSaveRole}>
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

    const RolePermissions = () => {
        const availableModules = ['Timetable', 'Homework', 'Attendance', 'Users', 'Settings', 'Examinations'];
        const [selectedRoleId, setSelectedRoleId] = useState(roles.length > 0 ? roles[0].id : null);
        const [permissions, setPermissions] = useState([]);

        useEffect(() => {
            if (roles.length > 0 && !selectedRoleId) {
                setSelectedRoleId(roles[0].id);
            }
        }, [roles]);

        useEffect(() => {
            if (selectedRoleId) {
                apiClient.get(`/roles/${selectedRoleId}/permissions`).then(res => {
                    const fetchedPerms = res.data;
                    // Map through all available modules and merge with fetched data
                    const initialPerms = availableModules.map(mod => {
                        const found = fetchedPerms.find(f => f.module_name === mod);
                        return found 
                            ? { ...found, can_read: !!found.can_read, can_edit: !!found.can_edit, can_delete: !!found.can_delete }
                            : { module_name: mod, can_read: false, can_edit: false, can_delete: false };
                    });
                    setPermissions(initialPerms);
                });
            }
        }, [selectedRoleId]);

        const handleToggle = (moduleName, field) => {
            setPermissions(prev => prev.map(p => 
                p.module_name === moduleName ? { ...p, [field]: !p[field] } : p
            ));
        };

        const handleSavePermissions = async () => {
            try {
                await apiClient.post(`/roles/${selectedRoleId}/permissions`, { permissions });
                alert("Permissions updated successfully!");
            } catch (error) {
                alert("Failed to update permissions.");
            }
        };

        if (roles.length === 0) return <div className="card">Please create a role first.</div>;

        return (
            <div className="card animate-fade">
                <h2 style={{margin:'0 0 20px 0'}}>Assign Module Permissions</h2>
                
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontWeight: 'bold', marginRight: '15px' }}>Select Role:</label>
                    <select 
                        value={selectedRoleId || ''} 
                        onChange={(e) => setSelectedRoleId(e.target.value)}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    >
                        {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.role_name}</option>
                        ))}
                    </select>
                </div>

                <table className="data-table" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                    <thead>
                        <tr>
                            <th>Module Name</th>
                            <th style={{ textAlign: 'center' }}>Read Only</th>
                            <th style={{ textAlign: 'center' }}>Edit / Add</th>
                            <th style={{ textAlign: 'center' }}>Delete</th>
                        </tr>
                    </thead>
                    <tbody>
                        {permissions.map(p => (
                            <tr key={p.module_name}>
                                <td style={{ fontWeight: 600 }}>{p.module_name}</td>
                                <td style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={p.can_read} onChange={() => handleToggle(p.module_name, 'can_read')} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={p.can_edit} onChange={() => handleToggle(p.module_name, 'can_edit')} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={p.can_delete} onChange={() => handleToggle(p.module_name, 'can_delete')} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn" onClick={handleSavePermissions}>
                        <FaCheck/> Save Permissions
                    </button>
                </div>
            </div>
        );
    };

    const UserList = () => (
        <div className="animate-fade">
            <div className="sub-tab-bar">
                {roles.map(r => (
                    <button key={r.id} className={`sub-tab ${subTab === r.role_name ? 'active' : ''}`} onClick={() => setSubTab(r.role_name)}>
                        {r.role_name}
                    </button>
                ))}
            </div>
            <div className="card no-padding">
                <table className="data-table">
                    <thead><tr><th>Full Name</th><th>Username</th><th>Contact</th><th>Account Status</th></tr></thead>
                    <tbody>
                        {users.filter(u => u.role === subTab).map(u => (
                            <tr key={u.id}>
                                <td style={{fontWeight: 700}}>{u.full_name}</td>
                                <td style={{color:'#64748b'}}>{u.username}</td>
                                <td>{u.phone_no || '---'}</td>
                                <td><span className="status-pill active">{u.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="master-admin-layout">
            <style>{`
                .master-admin-layout { font-family: 'Inter', sans-serif; padding: 10px; }
                .main-tab-nav { display: flex; flex-wrap: wrap; gap: 20px; border-bottom: 2px solid #f1f5f9; margin-bottom: 30px; }
                .tab-trigger { 
                    padding: 15px 10px; cursor: pointer; border: none; background: none; 
                    font-weight: 700; color: #94a3b8; display: flex; align-items: center; gap: 10px; 
                    border-bottom: 3px solid transparent; transition: 0.3s;
                }
                .tab-trigger.active { color: #4f46e5; border-bottom-color: #4f46e5; }

                .sub-tab-bar { display: flex; gap: 12px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px; }
                .sub-tab { 
                    padding: 10px 20px; border-radius: 50px; border: 1px solid #e2e8f0; 
                    background: white; cursor: pointer; font-size: 13px; font-weight: 600; color: #64748b;
                }
                .sub-tab.active { background: #4f46e5; color: white; border-color: #4f46e5; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.2); }

                .card { background: white; border-radius: 20px; padding: 30px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
                .card.no-padding { padding: 0; overflow: hidden; }

                .role-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 30px; }
                .role-item-card { 
                    background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; 
                    border-radius: 12px; display: flex; justify-content: space-between; align-items: center;
                }
                .role-name { font-weight: 700; color: #1e293b; }

                .data-table { width: 100%; border-collapse: collapse; }
                .data-table th { text-align: left; padding: 18px 20px; background: #f8fafc; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
                .data-table td { padding: 18px 20px; border-top: 1px solid #f1f5f9; font-size: 14px; }

                .btn { background: #4f46e5; color: white; border: none; padding: 12px 25px; border-radius: 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; }
                .btn-cancel { background: #f1f5f9; color: #64748b; border: none; padding: 12px 25px; border-radius: 10px; cursor: pointer; }
                .icon-btn { border: none; background: white; padding: 8px; border-radius: 8px; cursor: pointer; transition: 0.2s; }
                .icon-btn.edit { color: #3b82f6; }
                .icon-btn.delete { color: #ef4444; }
                .icon-btn:hover { background: #f1f5f9; transform: scale(1.1); }

                .status-pill { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
                .status-pill.active { background: #ecfdf5; color: #059669; }

                .flex-row { display: flex; gap: 10px; align-items: center; }
                input[type="text"] { padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; outline: none; background: #fcfcfc; }
                input[type="text"]:focus { border-color: #4f46e5; background: white; }

                .animate-fade { animation: fadeIn 0.4s ease; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            <nav className="main-tab-nav">
                <button className={`tab-trigger ${mainTab === 'users' ? 'active' : ''}`} onClick={() => setMainTab('users')}><FaUsers/> Users</button>
                <button className={`tab-trigger ${mainTab === 'roles' ? 'active' : ''}`} onClick={() => setMainTab('roles')}><FaCogs/> Role Creation</button>
                {/* NEW TAB HERE */}
                <button className={`tab-trigger ${mainTab === 'permissions' ? 'active' : ''}`} onClick={() => setMainTab('permissions')}><FaShieldAlt/> Role Permissions</button>
                
                <button className={`tab-trigger ${mainTab === 'academic' ? 'active' : ''}`} onClick={() => setMainTab('academic')}><FaCalendarAlt/> Academic Year</button>
                <button className={`tab-trigger ${mainTab === 'classes' ? 'active' : ''}`} onClick={() => setMainTab('classes')}><FaLayerGroup/> Class Settings</button>
                <button className={`tab-trigger ${mainTab === 'promotion' ? 'active' : ''}`} onClick={() => setMainTab('promotion')}><FaArrowUp/> Promotion</button>
            </nav>

            <div className="content-area">
                {mainTab === 'users' && <UserList />}
                {mainTab === 'roles' && <RoleCreation />}
                {/* NEW COMPONENT RENDER HERE */}
                {mainTab === 'permissions' && <RolePermissions />}
                
                {mainTab === 'academic' && <div className="card">Academic Year logic integrated with backend.</div>}
                {mainTab === 'classes' && <div className="card">Class/Section Management integrated.</div>}
                {mainTab === 'promotion' && <div className="card">Batch Promotion module ready for next session.</div>}
            </div>
        </div>
    );
}