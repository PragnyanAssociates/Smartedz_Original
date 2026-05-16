import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Code, Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import smartedzLogo from '../assets/smartedzlogo.png';

export default function LoginScreen() {
  const { login, API_URL } = useAuth();
  const navigate = useNavigate();
  
  const [role, setRole] = useState('Super Admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });
      const data = await res.json();
      if (data.success) {
        login(data.user, data.token);
        navigate('/dashboard');
      } else {
        alert(data.message || "Invalid Credentials");
      }
    } catch (err) { 
      alert("Server connection failed. Please check if backend is running."); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        
        <div className="text-center mb-6">
          <img 
            src={smartedzLogo} 
            alt="SmartEdz Logo" 
            className="w-32 h-auto mx-auto mb-2 drop-shadow-sm" 
          />
          <h1 className="text-2xl font-bold text-slate-900">SmartEdz ERP</h1>
          {role === 'Developer' && (
            <div className="mt-1">
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Developer Mode
                </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl ring-1 ring-slate-200 border-none p-8">
          <div className="pb-4">
            <h3 className="text-center text-slate-700 font-bold flex items-center justify-center gap-2 text-lg">
               {role === 'Developer' ? <Code size={18}/> : <Shield size={18}/>}
               {role === 'Developer' ? 'System Login' : 'Sign In'}
            </h3>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <input 
                type="email" 
                placeholder="name@example.com"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50 hover:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••"
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50 hover:bg-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center" 
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Login'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          © 2025 SmartEdz. All rights reserved.
        </p>
      </div>

      <div className="fixed bottom-4 w-full flex justify-center">
        <button 
          onClick={() => setRole(role === 'Developer' ? 'Super Admin' : 'Developer')}
          className="text-[10px] text-slate-300 hover:text-slate-500 transition-colors flex items-center gap-1 uppercase tracking-tighter"
        >
          <Code size={10} />
          Developer Access
        </button>
      </div>
    </div>
  );
}