import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../components/ui';
import { GraduationCap, Code, Shield, Loader2 } from 'lucide-react';

export default function Login() {
  const { setCurrentUser, API_URL } = useAppContext();
  const [role, setRole] = useState('Super Admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
      if (data.success) setCurrentUser(data.user);
      else alert(data.message);
    } catch (err) { alert("Server error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <GraduationCap className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold">Unified ERP</h1>
        </div>
        <Card>
          <CardHeader><CardTitle>Sign In</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={role === 'Developer' ? 'default' : 'outline'} onClick={() => setRole('Developer')}>Developer</Button>
                <Button type="button" variant={role === 'Super Admin' ? 'default' : 'outline'} onClick={() => setRole('Super Admin')}>Institution</Button>
              </div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}