'use client';

import React, { useState } from 'react';
import { LogIn, KeyRound, Mail, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { login, forgotPassword, verifyOtp, resetPassword } from '@core/services';

interface LoginViewProps {
  onSuccess: (user: { email: string; role?: string; id?: string }) => void;
}

type Mode = 'login' | 'forgot' | 'otp' | 'reset';

const SEED_LOGINS = [
  'admin@aiproject.local',
  'pm@aiproject.local',
  'dev1@aiproject.local',
  'dev2@aiproject.local',
];

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('admin@aiproject.local');
  const [password, setPassword] = useState('Admin@123');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err?.msg || err?.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const user = await login(email, password);
      onSuccess({
        email: (user as any).email || email,
        role: (user as any).role,
        id: (user as any).user_id || (user as any).id,
      });
    });
  };

  const submitForgot = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await forgotPassword(email);
      setNotice('If the account exists, an OTP has been sent (check the backend log).');
      setMode('otp');
    });
  };

  const submitOtp = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await verifyOtp(email, otp);
      setNotice('OTP verified. Choose a new password.');
      setMode('reset');
    });
  };

  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await resetPassword(email, newPassword);
      setNotice('Password reset. You can sign in now.');
      setMode('login');
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white border-2 border-slate-900 shadow-sm">
        <div className="p-6 border-b border-slate-300 flex items-center space-x-3">
          <div className="w-9 h-9 bg-indigo-600 flex items-center justify-center text-white font-black text-xs tracking-wider">
            PI
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest uppercase text-slate-900">
              AI Project Intelligence
            </h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase">Sign in to your workspace</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-800 text-xs font-mono">
              {error}
            </div>
          )}
          {notice && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-mono">
              {notice}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={submitLogin} className="space-y-3">
              <Field icon={Mail} label="Email">
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-transparent text-sm text-slate-900 focus:outline-none font-mono"
                />
              </Field>
              <Field icon={KeyRound} label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-transparent text-sm text-slate-900 focus:outline-none font-mono"
                />
              </Field>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span>Sign in</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="w-full text-[11px] font-bold text-indigo-600 hover:underline uppercase tracking-wider"
              >
                Forgot password?
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={submitForgot} className="space-y-3">
              <Field icon={Mail} label="Account email">
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-transparent text-sm text-slate-900 focus:outline-none font-mono"
                />
              </Field>
              <Submit busy={busy} label="Send OTP" icon={ShieldCheck} />
              <BackLink onClick={() => setMode('login')} />
            </form>
          )}

          {mode === 'otp' && (
            <form onSubmit={submitOtp} className="space-y-3">
              <Field icon={ShieldCheck} label="One-time code">
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  placeholder="123456"
                  className="w-full bg-transparent text-sm text-slate-900 focus:outline-none font-mono tracking-widest"
                />
              </Field>
              <Submit busy={busy} label="Verify code" icon={ShieldCheck} />
              <BackLink onClick={() => setMode('forgot')} />
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={submitReset} className="space-y-3">
              <Field icon={KeyRound} label="New password">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full bg-transparent text-sm text-slate-900 focus:outline-none font-mono"
                />
              </Field>
              <Submit busy={busy} label="Reset password" icon={KeyRound} />
              <BackLink onClick={() => setMode('login')} />
            </form>
          )}

          <div className="pt-3 border-t border-slate-200">
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1">Seed accounts</p>
            <div className="flex flex-wrap gap-1.5">
              {SEED_LOGINS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setEmail(s);
                    setPassword('Admin@123');
                  }}
                  className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-600 hover:border-slate-500"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ icon: React.ElementType; label: string; children: React.ReactNode }> = ({
  icon: Icon,
  label,
  children,
}) => (
  <label className="block">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">{label}</span>
    <span className="flex items-center space-x-2 bg-slate-50 border border-slate-300 px-2.5 py-2">
      <Icon className="w-4 h-4 text-indigo-600 shrink-0" />
      {children}
    </span>
  </label>
);

const Submit: React.FC<{ busy: boolean; label: string; icon: React.ElementType }> = ({
  busy,
  label,
  icon: Icon,
}) => (
  <button
    type="submit"
    disabled={busy}
    className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black flex items-center justify-center space-x-2 disabled:opacity-50"
  >
    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
    <span>{label}</span>
  </button>
);

const BackLink: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-[11px] font-bold text-slate-500 hover:text-slate-900 uppercase tracking-wider flex items-center justify-center space-x-1"
  >
    <ArrowLeft className="w-3 h-3" />
    <span>Back to sign in</span>
  </button>
);
