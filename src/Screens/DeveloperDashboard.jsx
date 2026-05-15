import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Card, CardContent, CardHeader, Badge, Modal, Input, Label, Select } from '../components/ui';
import { Building2, Plus, LogOut, Trash2, Edit3, Image as ImageIcon, Shield, LayoutGrid, Key } from 'lucide-react';
import smartedzLogo from '../assets/smartedzlogo.png';

export default function DeveloperDashboard() {
  const { institutions, usersList, logout, refreshData, API_URL } = useAuth();
  
  // Modal & Edit States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // Form State (Now includes Super Admin fields for both create and edit)
  const [formData, setFormData] = useState({ 
    name: '', type: 'School', logo: '', 
    superAdminName: '', superAdminEmail: '', superAdminPassword: '' 
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, logo: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const openOnboardModal = () => {
    setIsEditMode(false);
    setFormData({ name: '', type: 'School', logo: '', superAdminName: '', superAdminEmail: '', superAdminPassword: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (inst) => {
    // Find the Super Admin assigned to this school from the usersList
    const admin = usersList.find(u => u.institutionId === inst.id && u.role === 'Super Admin');
    
    setIsEditMode(true);
    setSelectedId(inst.id);
    setFormData({ 
      name: inst.name, 
      type: inst.type, 
      logo: inst.logo || '',
      superAdminName: admin?.name || '',
      superAdminEmail: admin?.email || '',
      superAdminPassword: admin?.password || '' // Note: In production use hashing, but per your request we use plain text
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = isEditMode 
      ? `${API_URL}/api/developer/institution/${selectedId}` 
      : `${API_URL}/api/developer/onboard`;
    
    const method = isEditMode ? 'PUT' : 'POST';
    const schoolKey = isEditMode ? undefined : `SK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, schoolKey })
    });

    if (res.ok) {
      refreshData();
      setIsModalOpen(false);
    } else {
        const err = await res.json();
        alert("Error: " + err.error);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`⚠️ WARNING: Are you sure you want to delete ${name}? All associated users and data will be permanently removed.`)) {
      const res = await fetch(`${API_URL}/api/developer/institution/${id}`, { method: 'DELETE' });
      if (res.ok) refreshData();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <img src={smartedzLogo} alt="SmartEdz" className="h-10 w-auto" />
          <div className="h-6 w-[1px] bg-slate-200"></div>
          <span className="font-bold text-slate-700 tracking-tight">Developer Console</span>
        </div>
        <Button variant="ghost" onClick={logout} className="text-slate-500 hover:text-red-600 transition-colors">
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </header>

      <main className="p-6 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-2xl font-extrabold text-slate-900">Institutions</h2>
                <p className="text-slate-500 text-sm">Manage client profiles and system access.</p>
            </div>
            <Button onClick={openOnboardModal} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 px-6">
              <Plus className="w-4 h-4 mr-2" /> Onboard School
            </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {institutions.map(inst => (
            <Card key={inst.id} className="group hover:shadow-xl transition-all duration-300 border-slate-200 overflow-hidden bg-white">
              <CardHeader className="flex flex-row justify-between items-center bg-slate-50/50 pb-3 px-4">
                <Badge className="bg-white border-slate-200 text-blue-600 font-bold">{inst.type}</Badge>
                <div className="flex gap-1">
                  <button onClick={() => openEditModal(inst)} className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-md transition-colors" title="Edit Info">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => handleDelete(inst.id, inst.name)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-md transition-colors" title="Delete Institution">
                    <Trash2 size={16} />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="flex flex-col items-center text-center space-y-4">
                    {inst.logo ? (
                      <img src={inst.logo} alt={inst.name} className="w-24 h-24 object-contain rounded-2xl border p-3 bg-white shadow-sm" />
                    ) : (
                      <div className="w-24 h-24 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border-2 border-dashed">
                        <Building2 size={40} />
                      </div>
                    )}
                    <div>
                      <h3 className="font-extrabold text-xl text-slate-800 line-clamp-1">{inst.name}</h3>
                      <div className="flex items-center justify-center gap-1 mt-2">
                        <Key size={10} className="text-slate-400" />
                        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{inst.schoolKey}</p>
                      </div>
                    </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* MODAL: Handles both Create and Edit for ALL fields */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={isEditMode ? "Edit Full Institution Details" : "Onboard New Institution"}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* LOGO SECTION */}
          <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
            <Label className="mb-3 text-slate-500 uppercase text-[10px] font-bold tracking-widest">Logo Upload</Label>
            <div className="relative group cursor-pointer">
              {formData.logo ? (
                <img src={formData.logo} className="w-28 h-28 object-contain border-2 border-white shadow-md rounded-xl p-2 bg-white" alt="Preview" />
              ) : (
                <div className="w-28 h-28 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400 bg-white">
                  <ImageIcon size={28} />
                  <span className="text-[10px] mt-2 font-bold uppercase">Browse</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
          </div>

          {/* BASIC INFO */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>School Name</Label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="School">School</option>
                <option value="College">College</option>
                <option value="University">University</option>
              </Select>
            </div>
          </div>

          {/* ADMIN ACCOUNT SECTION (Always editable now) */}
          <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-tighter">
                <Shield size={14}/> Primary Super Admin Account
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1">
                    <Label className="text-blue-700/70 text-[10px]">Admin Full Name</Label>
                    <Input required value={formData.superAdminName} onChange={e => setFormData({...formData, superAdminName: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <Label className="text-blue-700/70 text-[10px]">Login Email</Label>
                    <Input type="email" required value={formData.superAdminEmail} onChange={e => setFormData({...formData, superAdminEmail: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <Label className="text-blue-700/70 text-[10px]">Login Password</Label>
                    <Input required value={formData.superAdminPassword} onChange={e => setFormData({...formData, superAdminPassword: e.target.value})} />
                </div>
              </div>
          </div>

          <Button type="submit" className="w-full py-6 font-extrabold text-lg shadow-xl shadow-blue-100">
            {isEditMode ? "Update All Records" : "Launch Institution"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}