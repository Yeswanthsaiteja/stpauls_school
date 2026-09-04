import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, AlertCircle, RefreshCw, LogOut, Delete } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import logoSrc from '../assets/logo.png';

// On-screen numeric keypad — no hardware keyboard needed, avoids iOS 26 simulator keyboard crash
function NumPad({ onDigit, onDelete }) {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'];
  return (
    <div className="grid grid-cols-3 gap-3">
      {keys.map((k, i) =>
        k === null ? (
          <div key={i} />
        ) : k === 'del' ? (
          <button
            key={i}
            type="button"
            onClick={onDelete}
            className="h-16 rounded-2xl bg-muted/50 border border-border/40 text-foreground flex items-center justify-center active:scale-95 transition-transform"
          >
            <Delete className="h-5 w-5" />
          </button>
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => onDigit(String(k))}
            className="h-16 rounded-2xl bg-muted/50 border border-border/40 text-foreground text-2xl font-bold flex items-center justify-center active:scale-95 active:bg-primary/10 transition-all"
          >
            {k}
          </button>
        )
      )}
    </div>
  );
}

function PinDots({ value }) {
  return (
    <div className="flex gap-5 justify-center">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ scale: value.length > i ? [1, 1.3, 1] : 1 }}
          transition={{ duration: 0.15 }}
          className={`h-5 w-5 rounded-full border-2 transition-all ${
            value.length > i
              ? 'bg-primary border-primary shadow-lg shadow-primary/30'
              : 'border-border/60 bg-transparent'
          }`}
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
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleDigit = (digit) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length === 4) {
      setTimeout(() => handleUnlock(next), 100);
    }
  };

  const handleDelete = () => {
    setPin(p => p.slice(0, -1));
    setError('');
  };

  const handleUnlock = async (p) => {
    const attempt = p || pin;
    if (attempt.length !== 4) return;
    setSubmitting(true);
    const hashedAttempt = btoa(attempt + 'SP');
    if (hashedAttempt === profile?.pin) {
      setAppLocked(false);
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
      setSubmitting(false);
    }
  };

  const handleForgotPin = async () => {
    await signOut();
    toast.info('Logged out. Please login with OTP and set a new PIN.');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="glow-blob absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full bg-indigo-500/20" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-[400px]">
        <div className="bg-card/60 backdrop-blur-2xl border border-border/50 shadow-2xl shadow-primary/5 rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col items-center mb-6">
            <div className="w-[220px] h-20 overflow-hidden mb-4 flex justify-center">
              <img src={logoSrc} alt="St. Paul's High School" className="h-full w-full object-contain" />
            </div>
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Lock className="h-7 w-7" />
            </div>
            <h1 className="font-display font-black text-2xl tracking-tighter">App Locked</h1>
            <p className="text-muted-foreground text-sm mt-1 text-center">
              Welcome back, {profile?.displayName || 'User'}.<br />Enter your PIN to continue.
            </p>
          </div>

          <div className="space-y-6">
            {/* PIN dots */}
            <PinDots value={pin} />

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex gap-2 items-start">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Numeric pad */}
            {submitting ? (
              <div className="flex justify-center py-4">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <NumPad onDigit={handleDigit} onDelete={handleDelete} />
            )}

            {/* Forgot PIN — shows confirmation, no navigation */}
            {!confirmLogout ? (
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                className="w-full h-12 flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
              >
                <LogOut className="h-4 w-4" /> Switch User / Forgot PIN
              </button>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <p className="text-center text-sm text-muted-foreground">Are you sure? You will be logged out.</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmLogout(false)}
                    className="flex-1 h-11 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleForgotPin}
                    className="flex-1 h-11 rounded-xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 transition-colors"
                  >
                    Log Out
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
