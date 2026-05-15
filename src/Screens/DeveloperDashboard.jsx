import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Button, Card, CardContent, CardHeader, Badge, Modal, Input, Label, Select } from '../components/ui';
import { Building2, Plus, LayoutGrid, LogOut, Code } from 'lucide-react';

export default function DeveloperDashboard() {
  const { institutions, refreshData, setCurrentUser, API_URL } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'School', logo: '', superAdminName: '', superAdminEmail: '', superAdminPassword: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const schoolKey = `SK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const res = await fetch(`${API_URL}/api/developer/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, schoolKey })
    });
    if (res.ok) {
      refreshData();
      setIsModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white p-4 border-b flex justify-between items-center">
        <div className="flex items-center gap-2 font-bold"><LayoutGrid /> Developer Console</div>
        <Button variant="ghost" onClick={() => setCurrentUser(null)}><LogOut className="w-4 h-4 mr-2" /> Sign Out</Button>
      </header>
      <main className="p-6 max-w-7xl mx-auto w-full">
        <div className="flex justify-between mb-6">
          <h2 className="text-2xl font-bold">Institutions</h2>
          <Button onClick={() => setIsModalOpen(true)}><Plus className="w-4 h-4 mr-2" /> Onboard New</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {institutions.map(inst => (
            <Card key={inst.id}>
              <CardHeader className="flex flex-row justify-between">
                <Badge>{inst.type}</Badge>
                <span className="text-xs font-mono">Key: {inst.schoolKey}</span>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"><Building2 /></div>
                <div className="font-bold">{inst.name}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Onboard Institution">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Label>Institution Name</Label>
          <Input required onChange={e => setFormData({...formData, name: e.target.value})} />
          <Label>Type</Label>
          <Select onChange={e => setFormData({...formData, type: e.target.value})}>
            <option value="School">School</option>
            <option value="College">College</option>
          </Select>
          <hr />
          <Label>Super Admin Name</Label>
          <Input required onChange={e => setFormData({...formData, superAdminName: e.target.value})} />
          <Label>Super Admin Email</Label>
          <Input type="email" required onChange={e => setFormData({...formData, superAdminEmail: e.target.value})} />
          <Label>Initial Password</Label>
          <Input required onChange={e => setFormData({...formData, superAdminPassword: e.target.value})} />
          <Button type="submit" className="w-full">Create Institution & Admin</Button>
        </form>
      </Modal>
    </div>
  );
}