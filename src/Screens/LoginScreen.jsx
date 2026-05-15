import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../components/ui';
import { Code, Shield, Loader2, Eye, EyeOff } from 'lucide-react';
// Import your logo from assets
import smartedzLogo from '../assets/smartedzlogo.png';

export default function LoginScreen() {
  const { login, API_URL } = useAuth();
  const navigate = useNavigate();
  
  // States
  const [role, setRole] = useState('Super Admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // State for eye toggle

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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Logo and Header Section */}
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

        {/* Main Login Card */}
        <Card className="border-none shadow-xl ring-1 ring-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-slate-700 flex items-center justify-center gap-2">
               {role === 'Developer' ? <Code size={18}/> : <Shield size={18}/>}
               {role === 'Developer' ? 'System Login' : 'Sign In'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email"
                  type="email" 
                  placeholder="name@example.com"
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                  className="bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input 
                    id="password"
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                    className="bg-slate-50 border-slate-200 focus:bg-white pr-10"
                  />
                  {/* Password Visibility Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              <Button type="submit" className="w-full py-6 text-lg font-bold shadow-lg shadow-blue-200" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-slate-400 text-xs mt-6">
          © 2025 SmartEdz. All rights reserved.
        </p>
      </div>

      {/* Discrete Developer Toggle */}
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