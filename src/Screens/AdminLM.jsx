import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../api/client';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaUserShield, FaUsers, FaGraduationCap } from 'react-icons/fa';

export default function AdminLM() {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [classes, setClasses] = useState([]);
    const [activeTab, setActiveTab] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentYear, setCurrentYear] = useState(null);

    const [formData, setFormData] = useState({
        username: '', password: '', full_name: '', role: '', 
        class_id: '', roll_no: '', phone_no: '', admission_no: ''
    });

    const fetchData = async () => {
        try {
            const [uRes, rRes, cRes, yRes] = await Promise.all([
                apiClient.get('/users'),
                apiClient.get('/roles'),
                apiClient.get('/classes'),
                apiClient.get('/academic-year/current')
            ]);
            setUsers(uRes.data);
            setRoles(rRes.data);
            setClasses(cRes.data);
            setCurrentYear(yRes.data);
            if (rRes.data.length > 0) setActiveTab(rRes.data[0].role_name);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            // Include class and current academic year in the payload
            await apiClient.post('/users', { ...formData, academic_year_id: currentYear?.id });
            setIsModalOpen(false);
            fetchData();
        } catch (error) { alert("Failed to save user"); }
    };

    const filteredUsers = users.filter(u => 
        u.role === activeTab && 
        (u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || u.username.includes(searchQuery))
    );

    return (
        <div className="admin-lm-wrapper">
            <style>{`
                .admin-lm-wrapper { padding: 20px; }
                .top-info { background: #1e293b; color: white; padding: 15px 25px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
                .tabs-flex { display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 10px; }
                .role-tab { padding: 12px 24px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; cursor: pointer; font-weight: 700; color: #64748b; white-space: nowrap; }
                .role-tab.active { background: #4f46e5; color: white; border-color: #4f46e5; }
                .user-table { width: 100%; background: white; border-radius: 15px; border-collapse: collapse; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
                .user-table th { background: #f8fafc; padding: 15px; text-align: left; font-size: 12px; color: #64748b; }
                .user-table td { padding: 15px; border-top: 1px solid #f1f5f9; }
                .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
                .modal-box { background: white; padding: 30px; border-radius: 20px; width: 500px; max-width: 90%; }
            `}</style>

            <div className="top-info">
                <div>
                    <h2 style={{margin:0}}>User Management</h2>
                    <span style={{fontSize:'12px', opacity:0.7}}>Active Management Context: {currentYear?.year_name || 'Loading...'}</span>
                </div>
                <button onClick={() => setIsModalOpen(true)} style={{background:'white', color:'#1e293b', border:'none', padding:'10px 20px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer'}}>
                    + Create New Account
                </button>
            </div>

            <div className="tabs-flex">
                {roles.map(r => (
                    <button key={r.id} className={`role-tab ${activeTab === r.role_name ? 'active' : ''}`} onClick={() => setActiveTab(r.role_name)}>
                        {r.role_name}s
                    </button>
                ))}
            </div>

            <div style={{marginBottom: '20px'}}>
                <input 
                    placeholder={`Search within ${activeTab}s...`} 
                    style={{width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', boxSizing:'border-box'}}
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            <table className="user-table">
                <thead>
                    <tr>
                        <th>NAME</th>
                        <th>USERNAME</th>
                        <th>ACADEMIC INFO</th>
                        <th>ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredUsers.map(u => (
                        <tr key={u.id}>
                            <td style={{fontWeight:'bold'}}>{u.full_name}</td>
                            <td>{u.username}</td>
                            <td>
                                <span style={{fontSize:'12px', background:'#f1f5f9', padding:'4px 8px', borderRadius:'5px'}}>
                                    {u.role === 'Student' ? `Current: ${u.class_group}` : 'Staff Member'}
                                </span>
                            </td>
                            <td>
                                <button style={{color:'#ef4444', background:'none', border:'none', cursor:'pointer'}}><FaTrash/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {isModalOpen && (
                <div className="modal">
                    <div className="modal-box">
                        <h3>Create {formData.role} Account</h3>
                        <form onSubmit={handleSave} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                            <input required placeholder="Full Name" onChange={e => setFormData({...formData, full_name: e.target.value})} />
                            <input required placeholder="Username" onChange={e => setFormData({...formData, username: e.target.value})} />
                            <input required type="text" placeholder="Password" onChange={e => setFormData({...formData, password: e.target.value})} />
                            
                            <select onChange={e => setFormData({...formData, role: e.target.value})}>
                                <option value="">Select Role</option>
                                {roles.map(r => <option key={r.id} value={r.role_name}>{r.role_name}</option>)}
                            </select>

                            {formData.role === 'Student' && (
                                <>
                                    <select required onChange={e => setFormData({...formData, class_id: e.target.value})}>
                                        <option value="">Select Class</option>
                                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                                    </select>
                                    <input placeholder="Roll Number" onChange={e => setFormData({...formData, roll_no: e.target.value})} />
                                </>
                            )}

                            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                                <button type="submit" style={{flex:1, background:'#4f46e5', color:'white', border:'none', padding:'12px', borderRadius:'10px', fontWeight:'bold'}}>Save User</button>
                                <button type="button" onClick={() => setIsModalOpen(false)} style={{flex:1, background:'#f1f5f9', border:'none', padding:'12px', borderRadius:'10px'}}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}