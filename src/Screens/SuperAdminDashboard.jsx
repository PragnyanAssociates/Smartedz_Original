import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Card, CardContent, CardHeader, Badge, Modal, Input, Label, Select } from '../components/ui';
import { Users, Plus, Shield, Trash2 } from 'lucide-react';

export default function SuperAdminDashboard() {
  const { user, usersList, refreshData, API_URL } = useAuth();
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [instData, setInstData] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'Teacher', modules: '' });

  // Fetch specific institution details (name and logo) on load
  useEffect(() => {
    const fetchInst = async () => {
        const res = await fetch(`${API_URL}/api/admin/data/${user.institutionId}`);
        const data = await res.json();
        setInstData(data.institution);
    };
    if (user?.institutionId) fetchInst();
  }, [user]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userForm, institutionId: user.institutionId })
    });
    if (res.ok) { refreshData(); setIsUserModalOpen(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* School Custom Header */}
      <div className="bg-white border-b px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
            {instData?.logo ? (
                <img src={instData.logo} alt="logo" className="h-12 w-12 object-contain p-1 border rounded-lg bg-slate-50" />
            ) : (
                <div className="h-12 w-12 bg-blue-100 rounded-lg" />
            )}
            <div>
                <h1 className="text-xl font-bold text-slate-800">{instData?.name || "Loading..."}</h1>
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Institution Dashboard</p>
            </div>
        </div>
        <Button onClick={() => setIsUserModalOpen(true)} className="bg-blue-600"><Plus size={16} className="mr-1"/> Add Staff</Button>
      </div>

      <div className="p-8 overflow-auto flex-1 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-none shadow-lg shadow-blue-100">
            <CardContent className="p-6">
              <Users className="mb-2 opacity-50" />
              <p className="text-xs opacity-80 font-bold uppercase">Total Users</p>
              <h3 className="text-4xl font-bold">{usersList.length}</h3>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50/50">
            <h3 className="font-bold text-slate-700">Staff & Permissions</h3>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 text-xs uppercase border-b bg-slate-50">
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Modules</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => (
                  <tr key={u.id} className="border-b hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{u.name}</td>
                    <td className="p-4 text-slate-500 text-sm">{u.email}</td>
                    <td className="p-4"><Badge className={u.role === 'Super Admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-700'}>{u.role}</Badge></td>
                    <td className="p-4 text-xs font-bold text-blue-600">{u.modules || "FULL ACCESS"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Create User Account">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input required placeholder="Full Name" onChange={e => setUserForm({...userForm, name: e.target.value})} />
          <Input type="email" required placeholder="Email" onChange={e => setUserForm({...userForm, email: e.target.value})} />
          <Input required placeholder="Password" onChange={e => setUserForm({...userForm, password: e.target.value})} />
          <Select onChange={e => setUserForm({...userForm, role: e.target.value})}>
            <option value="Teacher">Teacher</option>
            <option value="Admin">Admin</option>
            <option value="Principal">Principal</option>
          </Select>
          <Input placeholder="Modules (e.g. Finance, Academics)" onChange={e => setUserForm({...userForm, modules: e.target.value})} />
          <Button type="submit" className="w-full py-4">Create User</Button>
        </form>
      </Modal>
    </div>
  );
}