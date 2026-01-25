import React, { useState } from 'react';
import { loginOrRegister } from '../services/firebase';

interface LoginProps {
  onLogin: (id: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Please fill in all identity fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const id = await loginOrRegister(name, email);
      onLogin(id);
    } catch (err: any) {
      setError(err.message || 'Connection to identity server failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#020617] relative overflow-hidden font-['Plus_Jakarta_Sans']">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[150px] pointer-events-none"></div>
      
      <div className="glass-card w-full max-w-lg p-12 rounded-[3.5rem] relative z-10 border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white text-3xl font-black mx-auto mb-6 shadow-2xl shadow-blue-600/30 italic">M</div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Matrix<span className="text-blue-500 italic">Pro</span></h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Weekly Planning Tool</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Full Identity Name</label>
              <input 
                type="text" required value={name} onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all text-sm font-medium placeholder:text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Corporate Email Address</label>
              <input 
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all text-sm font-medium placeholder:text-slate-700"
              />
            </div>
          </div>

          {error && (
            <div className="text-rose-400 text-[10px] font-black uppercase tracking-widest text-center bg-rose-500/10 py-4 rounded-xl border border-rose-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
              {error}
            </div>
          )}

          <button 
            type="submit" disabled={loading}
            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-900/40 hover:bg-blue-500 transition-all active:scale-[0.98] disabled:opacity-50 text-[11px]"
          >
            {loading ? 'Establishing Session...' : 'Login'}
          </button>
        </form>

        <div className="mt-12 text-center">
          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Aptean Center • Strategy Engine v2.0</p>
        </div>
      </div>
    </div>
  );
};