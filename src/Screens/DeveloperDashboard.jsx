import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Card, CardContent, CardHeader, Badge, Modal, Input, Label, Select } from '../components/ui';
import { Building2, Plus, LogOut, Trash2, Edit3, Image as ImageIcon, Shield, LayoutGrid, Mail, Lock, User, Globe } from 'lucide-react';
import smartedzLogo from '../assets/smartedzlogo.png';

export default function DeveloperDashboard() {
  const { institutions, usersList, logout, refreshData, API_URL } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
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

  const openEditModal = (inst) => {
    const admin = usersList.find(u => u.institutionId === inst.id && u.role === 'Super Admin');
    setIsEditMode(true);
    setSelectedId(inst.id);
    setFormData({ 
      name: inst.name, type: inst.type, logo: inst.logo || '',
      superAdminName: admin?.name || '', superAdminEmail: admin?.email || '', superAdminPassword: admin?.password || '' 
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = isEditMode ? `${API_URL}/api/developer/institution/${selectedId}` : `${API_URL}/api/developer/onboard`;
    const res = await fetch(url, {
      method: isEditMode ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, schoolKey: isEditMode ? undefined : `SK-${Math.random().toString(36).substring(2, 8).toUpperCase()}` })
    });
    if (res.ok) { refreshData(); setIsModalOpen(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <header className="bg-white/80 backdrop-blur-md border-b px-8 py-4 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <img src={smartedzLogo} alt="SmartEdz" className="h-12 w-auto drop-shadow-sm" />
          <div className="h-8 w-[1px] bg-slate-200"></div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">DEV<span className="text-blue-600">CONSOLE</span></h1>
        </div>
        <Button variant="ghost" onClick={logout} className="rounded-full hover:bg-red-50 hover:text-red-600">
          <LogOut size={18} className="mr-2" /> Sign Out
        </Button>
      </header>

      <main className="p-8 max-w-[1400px] mx-auto w-full">
        <div className="flex justify-between items-center mb-10">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Institutions</h2>
                <p className="text-slate-500 font-medium">Control and monitor your system tenants.</p>
            </div>
            <Button onClick={() => { setIsEditMode(false); setFormData({name:'', type:'School', logo:'', superAdminName:'', superAdminEmail:'', superAdminPassword:''}); setIsModalOpen(true); }} 
                    className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 px-8 py-6 rounded-2xl transition-all hover:scale-105 active:scale-95">
              <Plus className="w-5 h-5 mr-2" /> Onboard School
            </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {institutions.map(inst => (
            <Card key={inst.id} className="group border-none shadow-sm hover:shadow-2xl transition-all duration-500 rounded-[2rem] overflow-hidden bg-white ring-1 ring-slate-100">
              <CardHeader className="flex flex-row justify-between items-center bg-slate-50/50 p-6 border-none">
                <Badge className="bg-blue-600 text-white px-4 py-1.5 rounded-full border-none shadow-md shadow-blue-100">{inst.type}</Badge>
                <div className="flex gap-2">
                  <button onClick={() => openEditModal(inst)} className="p-3 bg-white hover:bg-blue-600 hover:text-white text-slate-400 rounded-2xl shadow-sm transition-all duration-300">
                    <Edit3 size={18} />
                  </button>
                  <button onClick={() => { if(window.confirm('Delete?')) fetch(`${API_URL}/api/developer/institution/${inst.id}`, {method:'DELETE'}).then(refreshData) }} 
                          className="p-3 bg-white hover:bg-red-600 hover:text-white text-slate-400 rounded-2xl shadow-sm transition-all duration-300">
                    <Trash2 size={18} />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-10 flex flex-col items-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-blue-400 blur-2xl opacity-10 rounded-full"></div>
                    {inst.logo ? (
                        <img src={inst.logo} className="w-28 h-28 object-contain rounded-3xl p-4 bg-white shadow-inner relative z-10 border border-slate-50" alt="logo" />
                    ) : (
                        <div className="w-28 h-28 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 relative z-10"><Building2 size={40} /></div>
                    )}
                  </div>
                  <h3 className="font-black text-2xl text-slate-800 tracking-tight">{inst.name}</h3>
                  <div className="flex items-center gap-2 mt-3 bg-slate-100 px-4 py-1.5 rounded-full">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Key: {inst.schoolKey}</span>
                  </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* NEW DYNAMIC MODAL DESIGN */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={isEditMode ? "Update Institution Profile" : "Onboard New Client"}
      >
        <form onSubmit={handleSubmit} className="space-y-8 max-w-xl mx-auto py-2">
          
          {/* Logo Upload Interface */}
          <div className="flex justify-center">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative w-32 h-32 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500 transition-all shadow-inner">
                {formData.logo ? (
                  <img src={formData.logo} className="w-full h-full object-contain p-4" alt="Preview" />
                ) : (
                  <div className="text-center">
                    <ImageIcon className="mx-auto text-slate-300 mb-1" size={32} />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Institution Logo</p>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Section 1: Brand Identity */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Globe size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">General Information</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label className="text-[11px] ml-1">Official Name</Label>
                    <Input required placeholder="Lincoln High" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <Label className="text-[11px] ml-1">Category</Label>
                    <Select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                        <option value="School">School</option>
                        <option value="College">College</option>
                        <option value="University">University</option>
                    </Select>
                </div>
              </div>
            </div>

            {/* Section 2: Security Credentials */}
            <div className="bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100 space-y-4 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                    <Shield size={80} />
               </div>
               <div className="flex items-center gap-2 text-blue-600 mb-4">
                <Shield size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Master Admin Access</span>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-4 text-slate-400" size={16} />
                  <Input required placeholder="Full Name" className="pl-12" value={formData.superAdminName} onChange={e => setFormData({...formData, superAdminName: e.target.value})} />
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-4 text-slate-400" size={16} />
                  <Input type="email" required placeholder="Admin Email" className="pl-12" value={formData.superAdminEmail} onChange={e => setFormData({...formData, superAdminEmail: e.target.value})} />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-4 text-slate-400" size={16} />
                  <Input required placeholder="Secure Password" className="pl-12" value={formData.superAdminPassword} onChange={e => setFormData({...formData, superAdminPassword: e.target.value})} />
                </div>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full py-7 text-lg font-black rounded-3xl bg-slate-900 hover:bg-blue-600 shadow-2xl shadow-blue-100 transition-all duration-500 uppercase tracking-widest">
            {isEditMode ? "Save All Changes" : "Deploy System"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}