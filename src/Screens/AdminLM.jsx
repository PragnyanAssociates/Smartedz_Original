import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaUserShield, FaChalkboardTeacher, FaUserGraduate } from 'react-icons/fa';

const CLASSES = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

export default function AdminLM() {
    const [users, setUsers] = useState([]);
    const [activeTab, setActiveTab] = useState('Super Admin');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState({
        username: '', password: '', full_name: '', role: 'Student', class_group: 'Class 1', roll_no: '', phone_no: ''
    });

    const fetchUsers = async () => {
        const res = await fetch('http://localhost:3001/api/users');
        const data = await res.json();
        setUsers(data);
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleSave = async () => {
        await fetch('http://localhost:3001/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        setIsModalOpen(false);
        fetchUsers();
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this user?")) {
            await fetch(`http://localhost:3001/api/users/${id}`, { method: 'DELETE' });
            fetchUsers();
        }
    };

    const filteredUsers = users.filter(u => 
        u.role === activeTab && 
        (u.full_name.toLowerCase().includes(search.toLowerCase()) || u.username.includes(search))
    );

    return (
        <div className="p-4 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
                <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                    <FaPlus /> Add User
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b mb-6">
                {['Super Admin', 'Admin', 'Teacher', 'Student'].map(role => (
                    <button 
                        key={role}
                        onClick={() => setActiveTab(role)}
                        className={`pb-2 px-4 font-semibold ${activeTab === role ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
                    >
                        {role}s
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="mb-4 relative">
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                <input 
                    type="text" placeholder="Search by name or username..." 
                    className="w-full pl-10 pr-4 py-2 border rounded-xl"
                    value={search} onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Username</th>
                            <th className="p-4">Class/Group</th>
                            <th className="p-4">Phone</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(u => (
                            <tr key={u.id} className="border-b hover:bg-gray-50">
                                <td className="p-4 font-medium">{u.full_name}</td>
                                <td className="p-4 text-gray-600">{u.username}</td>
                                <td className="p-4">{u.class_group || 'N/A'}</td>
                                <td className="p-4">{u.phone_no || 'N/A'}</td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button className="text-blue-600 p-2 hover:bg-blue-50 rounded"><FaEdit /></button>
                                    <button onClick={() => handleDelete(u.id)} className="text-red-600 p-2 hover:bg-red-50 rounded"><FaTrash /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-2xl p-6">
                        <h2 className="text-xl font-bold mb-4">Add New User</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <input placeholder="Full Name" className="border p-2 rounded" onChange={e => setFormData({...formData, full_name: e.target.value})} />
                            <input placeholder="Username" className="border p-2 rounded" onChange={e => setFormData({...formData, username: e.target.value})} />
                            <input placeholder="Password" type="text" className="border p-2 rounded" onChange={e => setFormData({...formData, password: e.target.value})} />
                            <select className="border p-2 rounded" onChange={e => setFormData({...formData, role: e.target.value})}>
                                <option value="Student">Student</option>
                                <option value="Teacher">Teacher</option>
                                <option value="Admin">Admin</option>
                            </select>
                            <select className="border p-2 rounded" onChange={e => setFormData({...formData, class_group: e.target.value})}>
                                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input placeholder="Phone No" className="border p-2 rounded" onChange={e => setFormData({...formData, phone_no: e.target.value})} />
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600">Cancel</button>
                            <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2 rounded-lg">Save User</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}