import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Code, Shield, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
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
    /* Outer container forces a scrollable area to hide the dev button */
    <div className="min-h-[108vh] bg-[#f4f7fa] relative overflow-x-hidden">
      
      {/* Background Decor - Abstract & Non-stretching */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-indigo-100 rounded-full blur-3xl opacity-40 animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <style>{`
        @keyframes reveal {
          from { opacity: 0; transform: translateY(20px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-reveal { animation: reveal 0.8s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
      `}</style>

      {/* PRIMARY VIEWPORT: Everything here fits on the default screen without scrolling */}
      <div className="h-screen w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        
        {/* Main Card Container */}
        <div className="z-10 w-full max-w-6xl bg-white rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] flex flex-col md:flex-row overflow-hidden animate-reveal border border-white/60">
          
          {/* LEFT PANEL: Branding */}
          <div className="w-full md:w-5/12 bg-slate-50/50 p-10 md:p-14 lg:p-16 flex flex-col justify-center relative">
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-2/3 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent hidden md:block"></div>
            
            <div className="flex items-center gap-3 mb-10">
              <img 
                src={smartedzLogo} 
                alt="SmartEdz Logo" 
                className="h-14 w-auto drop-shadow-sm" 
              />
              <div className="text-3xl font-black tracking-tight">
                <span className="text-[#3284c7]">Smart</span>
                <span className="text-[#f29132]">Edz</span>
              </div>
            </div>

            <div className="space-y-5">
              <h1 className="text-3xl font-bold text-slate-900 leading-tight tracking-tight">
                Complete ERP Solution for Educational Institutions
              </h1>
              <p className="text-slate-500 text-base leading-relaxed max-w-sm">
                The unified platform to manage your entire institution seamlessly.
              </p>
            </div>

            {role === 'Developer' && (
              <div className="mt-8 animate-bounce">
                <span className="inline-flex items-center gap-2 text-[9px] bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                  <Code size={10} /> Developer Active
                </span>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Login Form */}
          <div className="w-full md:w-7/12 p-10 md:p-14 lg:p-16 bg-white flex flex-col justify-center">
            <div className="mb-8 text-center md:text-left">
              <div className="inline-flex w-14 h-14 rounded-xl bg-indigo-50 text-indigo-600 items-center justify-center mb-4 shadow-sm ring-1 ring-indigo-50">
                 {role === 'Developer' ? <Code size={28}/> : <Shield size={28}/>}
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">Sign In</h2>
              <p className="text-slate-400 text-sm mt-1">Enter your credentials to access your account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  type="email" 
                  placeholder="pragnyanhyd@gmail.com"
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                  className="w-full px-5 py-3.5 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all bg-slate-50/50 hover:bg-white text-slate-700 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Secure Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                    className="w-full px-5 py-3.5 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all bg-slate-50/50 hover:bg-white text-slate-700 pr-12 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-colors p-1.5"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              <div className="pt-2 space-y-5">
                <button 
                  type="submit" 
                  className="w-full py-4 bg-indigo-600 text-white text-base font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2" 
                  disabled={loading}
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Sign In Now'}
                </button>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-all group"
                  >
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Welcome Page
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Static Footer (Visible on Screen) */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-slate-400 text-[11px] font-medium tracking-wide">
            © 2025 <span className="text-slate-600">SmartEdz</span>. All rights reserved.
          </p>
          <div className="h-[1px] w-10 bg-slate-200"></div>
        </div>
      </div>

      {/* HIDDEN SECTION: Requires scroll to reach */}
      <div className="flex items-center justify-center pb-8 pt-4">
        <button 
          onClick={() => setRole(role === 'Developer' ? 'Super Admin' : 'Developer')}
          className="text-[9px] text-slate-300 hover:text-indigo-400 transition-all flex items-center gap-2 uppercase tracking-[0.4em] font-light py-2 px-4 rounded-lg hover:bg-white/50 backdrop-blur-sm shadow-sm border border-transparent hover:border-slate-100"
        >
          <Code size={10} />
          Developer Access
        </button>
      </div>
    </div>
  );
}