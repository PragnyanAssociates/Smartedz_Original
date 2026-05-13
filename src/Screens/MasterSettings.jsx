import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { MdSecurity, MdSettings, MdShield, MdArrowForward } from 'react-icons/md';

export default function MasterSettings() {
    const [roleName, setRoleName] = useState('');
    const [roles, setRoles] = useState([]);

    const fetchRoles = async () => {
        const res = await apiClient.get('/roles');
        setRoles(res.data);
    };

    useEffect(() => { fetchRoles(); }, []);

    const handleAddRole = async () => {
        if (!roleName) return;
        try {
            await apiClient.post('/roles', { role_name: roleName });
            setRoleName('');
            fetchRoles();
            alert("System Role Created!");
        } catch (e) { alert("Error creating role"); }
    };

    return (
        <div className="master-settings">
            <style>{`
                .master-settings { padding: 10px; font-family: 'Inter', sans-serif; }
                .settings-header { margin-bottom: 30px; }
                .settings-header h1 { margin: 0; color: #1e293b; }
                
                .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 25px; }
                .management-card { background: white; border-radius: 20px; border: 1px solid #e2e8f0; padding: 30px; }
                
                .role-input-box { display: flex; gap: 10px; margin-top: 20px; }
                .role-input-box input { flex: 1; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; outline: none; }
                .add-role-btn { background: #4f46e5; color: white; border: none; padding: 0 20px; border-radius: 10px; cursor: pointer; font-weight: 700; }
                
                .role-list { margin-top: 25px; display: flex; flex-wrap: wrap; gap: 10px; }
                .role-tag { 
                    background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 16px; border-radius: 50px; 
                    font-size: 13px; font-weight: 600; color: #475569; display: flex; align-items: center; gap: 8px;
                }
                .shield-icon { color: #4f46e5; }
            `}</style>

            <div className="settings-header">
                <h1>ERP Master Configuration</h1>
                <p style={{color:'#64748b'}}>Manage high-level system entities and user permissions.</p>
            </div>

            <div className="settings-grid">
                {/* ROLE MANAGEMENT */}
                <div className="management-card">
                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                        <MdSecurity size={24} color="#4f46e5" />
                        <h3 style={{margin:0}}>System Roles</h3>
                    </div>
                    <p style={{fontSize:'13px', color:'#64748b', marginTop:'10px'}}>Define access levels. These roles will appear as tabs in User Management.</p>
                    
                    <div className="role-input-box">
                        <input placeholder="Enter Role Name (e.g. Librarian)" value={roleName} onChange={e => setRoleName(e.target.value)} />
                        <button className="add-role-btn" onClick={handleAddRole}>Create</button>
                    </div>

                    <div className="role-list">
                        {roles.map(r => (
                            <div key={r.id} className="role-tag">
                                <MdShield className="shield-icon" size={14} />
                                {r.role_name}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ACADEMIC PREFERENCES */}
                <div className="management-card" style={{opacity: 0.6}}>
                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                        <MdSettings size={24} color="#64748b" />
                        <h3 style={{margin:0}}>System Preferences</h3>
                    </div>
                    <p style={{fontSize:'13px', color:'#64748b', marginTop:'10px'}}>Configure school-wide settings like Grading Systems, Attendance methods, and more.</p>
                    <div style={{marginTop:'30px', textAlign:'center', color:'#94a3b8', fontStyle:'italic'}}>
                        Advanced modules coming in Phase 2
                    </div>
                </div>
            </div>
        </div>
    );
}