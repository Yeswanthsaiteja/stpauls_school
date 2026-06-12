import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Lock, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import logoSrc from '../assets/logo.png';

function PinInput({ value, onChange }) {
  const inputRefs = useRef([]);
  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !e.target.value && i > 0) inputRefs.current[i - 1]?.focus();
  };
  const handleChange = (i, v) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = digit;
    const next = arr.join('').padEnd(4, ' ').slice(0, 4);
    onChange(next.trimEnd());
    if (digit && i < 3) inputRefs.current[i + 1]?.focus();
  };
  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    onChange(text);
    inputRefs.current[Math.min(text.length, 3)]?.focus();
    e.preventDefault();
  };
  return (
    <div className="flex gap-4 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 4 }).map((_, i) => (
        <input key={i} ref={(el) => (inputRefs.current[i] = el)}
          type="password" inputMode="numeric" maxLength={1} value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          className="h-20 w-16 sm:h-24 sm:w-20 rounded-[2rem] border-2 border-border/60 bg-background/50 text-center text-5xl font-black outline-none focus:border-primary focus:bg-primary/5 focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
        />
      ))}
    </div>
  );
}

export default function AppLockScreen() {
  const { profile, setAppLocked, signOut } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleUnlock = async (e, directPin) => {
    e?.preventDefault();
    const p = directPin || pin;
    if (p.length !== 4) return;
    setSubmitting(true);
    
    // Check against profile.pin
    // To be secure but simple, we store it obfuscated: btoa(pin + "SP")
    const hashedAttempt = btoa(p + 'SP');

    if (hashedAttempt === profile?.pin) {
      setAppLocked(false);
    } else {
      setError("Incorrect PIN. Please try again.");
      setPin('');
      setSubmitting(false);
    }
  };

  const handleForgotPin = async () => {
    await signOut();
    toast.info("Logged out. Please login with OTP and set a new PIN.");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="glow-blob absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full bg-indigo-500/20" />
        
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-[440px]">
        <div className="bg-card/60 backdrop-blur-2xl border border-border/50 shadow-2xl shadow-primary/5 rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-[340px] h-24 sm:w-[400px] sm:h-32 overflow-hidden mb-6 flex justify-center">
                <img src={logoSrc} alt="St. Paul's High School" className="h-full w-full object-contain" />
              </div>
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              <Lock className="h-8 w-8" />
            </div>
            <h1 className="font-display font-black text-3xl tracking-tighter">App Locked</h1>
            <p className="text-muted-foreground text-sm mt-2 text-center">
              Welcome back, {profile?.displayName || 'User'}.<br/>Enter your PIN to continue.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-6">
            <PinInput value={pin} onChange={(val) => {
              setPin(val);
              if (val.length === 4) handleUnlock(null, val);
            }} />
            
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} 
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex gap-2 items-start">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            <button type="submit" disabled={submitting || pin.length < 4} 
              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]">
              {submitting ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Unlock App'}
            </button>
            
            <button type="button" onClick={handleForgotPin} 
              className="w-full h-12 flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
              <LogOut className="h-4 w-4" /> Switch User / Forgot PIN
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
