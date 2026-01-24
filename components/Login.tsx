
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
    setLoading(true);
    setError('');
    try {
      const id = await loginOrRegister(name, email);
      onLogin(id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#020617] relative overflow-hidden font-['Inter']">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.2),transparent_80%)]"></div>
      
      <div className="glass-card w-full max-w-lg p-12 rounded-[3.5rem] relative z-10 glow-blue border border-white/5 shadow-2xl">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white text-3xl font-black mx-auto mb-6 shadow-2xl shadow-blue-600/30 italic">M</div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Matrix<span className="text-blue-500 italic">Pro</span></h1>
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em] mt-2">Enterprise Plan Hub</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <input 
              type="text" required value={name} onChange={e => setName(e.target.value)}
              placeholder="Full Name"
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-blue-500 transition-all text-sm font-medium"
            />
            <input 
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Corporate Email"
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-blue-500 transition-all text-sm font-medium"
            />
          </div>

          {error && <div className="text-rose-400 text-[10px] font-black uppercase text-center bg-rose-500/10 py-3 rounded-xl border border-rose-500/20">{error}</div>}

          <button 
            type="submit" disabled={loading}
            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-blue-500 transition-all active:scale-[0.98] disabled:opacity-50 text-xs"
          >
            {loading ? 'Initiating Link...' : 'Establish Session'}
          </button>
        </form>
      </div>
    </div>
  );
};
