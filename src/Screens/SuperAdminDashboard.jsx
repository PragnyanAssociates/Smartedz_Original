import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Button, Card, CardContent, CardHeader, Badge, Modal, Input, Label, Select } from '../components/ui';
import { Users, GraduationCap, Calendar, LogOut, Plus, Shield } from 'lucide-react';

export default function SuperAdminDashboard() {
  const { currentUser, setCurrentUser, users, classes, academicYears, refreshData, API_URL } = useAppContext();
  const [activeTab, setActiveTab] = useState('users');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'Teacher', modules: '' });

  const handleCreateUser = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userForm, institutionId: currentUser.institutionId })
    });
    refreshData();
    setIsUserModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white p-6 space-y-4">
        <div className="text-xl font-bold flex items-center gap-2"><GraduationCap /> ERP Admin</div>
        <nav className="space-y-2">
          <Button variant="ghost" className="w-full justify-start" onClick={() => setActiveTab('users')}>Users</Button>
          <Button variant="ghost" className="w-full justify-start" onClick={() => setActiveTab('academics')}>Academics</Button>
        </nav>
        <Button variant="destructive" className="w-full" onClick={() => setCurrentUser(null)}><LogOut className="mr-2 h-4 w-4" /> Logout</Button>
      </aside>

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Manage {activeTab === 'users' ? 'Staff & Students' : 'Academic Structure'}</h1>
          <Button onClick={() => setIsUserModalOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add New</Button>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Modules Assigned</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b">
                  <td className="p-4 font-medium">{u.name}</td>
                  <td className="p-4">{u.email}</td>
                  <td className="p-4"><Badge>{u.role}</Badge></td>
                  <td className="p-4 text-sm text-slate-500">{u.modules || 'All Access'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Create New User">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Label>Full Name</Label>
          <Input required onChange={e => setUserForm({...userForm, name: e.target.value})} />
          <Label>Email</Label>
          <Input type="email" required onChange={e => setUserForm({...userForm, email: e.target.value})} />
          <Label>Password</Label>
          <Input required onChange={e => setUserForm({...userForm, password: e.target.value})} />
          <Label>Role</Label>
          <Select onChange={e => setUserForm({...userForm, role: e.target.value})}>
            <option value="Admin">Admin</option>
            <option value="Teacher">Teacher</option>
            <option value="Student">Student</option>
          </Select>
          <Label>Assign Modules (comma separated)</Label>
          <Input placeholder="Academics, Finance, Exams" onChange={e => setUserForm({...userForm, modules: e.target.value})} />
          <Button type="submit" className="w-full">Create User & Assign Access</Button>
        </form>
      </Modal>
    </div>
  );
}