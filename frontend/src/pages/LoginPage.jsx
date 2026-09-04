import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, ArrowRight, Shield, User as UserIcon, Users as UsersIcon,
  Globe, Sparkles, AlertCircle, RefreshCw, CheckCircle2, ChevronLeft,
  Lock, KeyRound, LogIn, Trash2
} from 'lucide-react';
import { useAuth, resolvePhoneAsRole } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { doc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { db, functions, auth } from '../lib/firebase';
import logoSrc from '../assets/logo.png';

// ─── Saved Accounts Utils ───────────────────────────────────────────────────
const getSavedAccounts = () => {
  try {
    const raw = localStorage.getItem('stpauls_saved_accounts');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const saveAccount = (phone, role, name = '') => {
  if (!phone || !role) return;
  const accounts = getSavedAccounts();
  const existingIndex = accounts.findIndex(a => a.phone === phone && a.role === role);
  const newAccount = { phone, role, name, lastUsed: Date.now() };
  
  if (existingIndex >= 0) {
    accounts[existingIndex] = newAccount;
  } else {
    accounts.push(newAccount);
  }
  
  accounts.sort((a, b) => b.lastUsed - a.lastUsed);
  localStorage.setItem('stpauls_saved_accounts', JSON.stringify(accounts.slice(0, 5)));
};

const removeSavedAccount = (phone, role) => {
  const accounts = getSavedAccounts();
  const filtered = accounts.filter(a => !(a.phone === phone && a.role === role));
  localStorage.setItem('stpauls_saved_accounts', JSON.stringify(filtered));
};

// ─── Roles ───────────────────────────────────────────────────────────────────
const ROLES = [
  { id: 'admin',  labelKey: 'administrator', icon: Shield,    gradient: 'from-violet-500 to-indigo-600', hintKey: 'adminHint'  },
  { id: 'staff',  labelKey: 'staff',         icon: UserIcon,  gradient: 'from-cyan-400 to-blue-600',     hintKey: 'staffHint'  },
  { id: 'parent', labelKey: 'parent',        icon: UsersIcon, gradient: 'from-fuchsia-500 to-pink-600',  hintKey: 'parentHint' },
];



// ─── PIN Input ───────────────────────────────────────────────────────────────
function PinInput({ value, onChange, autoFocus = false }) {
  const refs = useRef([]);
  useEffect(() => { if (autoFocus) setTimeout(() => refs.current[0]?.focus(), 80); },);
  const handle = (i, v) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const a = value.split(''); a[i] = d;
    const next = a.join('').padEnd(4, ' ').slice(0, 4);
    onChange(next.trimEnd());
    if (d && i < 3) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => { if (e.key === 'Backspace' && !e.target.value && i > 0) refs.current[i - 1]?.focus(); };
  const onPaste = (e) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    onChange(t); refs.current[Math.min(t.length, 3)]?.focus(); e.preventDefault();
  };
  return (
    <div className="flex gap-4 justify-center" onPaste={onPaste}>
      {Array.from({ length: 4 }).map((_, i) => (
        <input key={i} ref={el => (refs.current[i] = el)}
          type="password" inputMode="numeric" maxLength={1} value={value[i] || ''}
          onChange={e => handle(i, e.target.value)} onKeyDown={e => onKey(i, e)}
          className="h-20 w-16 sm:h-24 sm:w-20 rounded-[2rem] border-2 border-border/60 bg-background/50 text-center text-5xl font-black outline-none focus:border-primary focus:bg-primary/5 focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
        />
      ))}
    </div>
  );
}

// ─── Error Box ───────────────────────────────────────────────────────────────
function ErrorBox({ msg }) {
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex gap-2 items-start">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><p>{msg}</p>
    </motion.div>
  );
}

// ─── Logo Component ───────────────────────────────────────────────────────────
function Logo({ className = '' }) {
  return (
    <div className={`overflow-hidden flex-shrink-0 ${className}`}>
      <img src={logoSrc} alt="St. Paul's High School" className="w-full h-full object-contain" />
    </div>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
export default function LoginPage() {
  const { sendOTP, verifyOTP, user, restoreSession, setAppLocked, setPinSetSession, setLoginRole } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // step: 'role' | 'saved_accounts' | 'phone' | 'pin_enter' | 'otp' | 'pin_setup'
  const [step, setStep]             = useState('role');
  const [pinSetupComplete, setPinSetupComplete] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRole, setSelectedRole] = useState(null);
  const [phone, setPhone]           = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [setupPin, setSetupPin]     = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loginPin, setLoginPin]     = useState('');
  const [isFirstTimeParent, setIsFirstTimeParent] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (user && (pinSetupComplete || ['role', 'phone', 'pin_enter'].includes(step))) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, step, pinSetupComplete, navigate]);

  const startCountdown = () => {
    setCountdown(30); clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current); return 0; } return c - 1; });
    }, 1000);
  };

  // ── Phone submit: always check if PIN exists first ──
  const handlePhoneSubmit = async (e) => {
    e.preventDefault(); setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setError('Please enter a valid 10-digit mobile number'); return; }
    
    if (submitting) return; setSubmitting(true);
    try {
      const validateRole = httpsCallable(functions, 'validatePhoneRole');
      const roleCheck = await validateRole({ phone: digits, role: selectedRole });
      
      if (!roleCheck.data.valid) {
        setError(`This phone number is not registered for the ${selectedRole} role.`);
        setSubmitting(false);
        return;
      }
      
      const checkPin = httpsCallable(functions, 'checkPinExists');
      const res = await checkPin({ phone: digits });
      setSubmitting(false);
      
      if (res.data.hasPin) {
        setIsFirstTimeParent(false);
        setStep('pin_enter');
      } else {
        if (selectedRole === 'parent') {
          setIsFirstTimeParent(true);
          setStep('pin_enter');
        } else {
          setStep('pin_setup');
        }
      }
    } catch (err) {
      console.error("checkPinExists error:", err);
      setError("Failed to verify phone number. Please check your connection.");
      setSubmitting(false);
    }
  };

  const handleForgotPin = async () => {
    if (submitting) return; setSubmitting(true);
    try {
      const requestPinReset = httpsCallable(functions, 'requestPinReset');
      await requestPinReset({ phone: phone.replace(/\D/g, ''), role: selectedRole });
      toast.success("Reset request sent to Administration.");
      setSubmitting(false);
    } catch (err) {
      setError("Failed to send reset request.");
      setSubmitting(false);
    }
  };

  // ── PIN Login via Cloud Function ──────────────────────────────────────────
  const handlePinLogin = async (e, directVal) => {
    e?.preventDefault(); setError('');
    const code = directVal || loginPin;
    if (code.length !== 4) return;
    
    if (submitting) return; setSubmitting(true);
    try {
      let customToken;
      if (isFirstTimeParent) {
        if (code !== '1234') {
          setError("Incorrect PIN. Please use your default PIN (1234).");
          setLoginPin(''); setSubmitting(false); return;
        }
        const registerFirstTimePin = httpsCallable(functions, 'registerFirstTimePin');
        const res = await registerFirstTimePin({ phone: phone.replace(/\D/g, ''), pin: code, role: selectedRole });
        customToken = res.data.token;
      } else {
        const loginWithPin = httpsCallable(functions, 'loginWithPin');
        const res = await loginWithPin({ phone: phone.replace(/\D/g, ''), pin: code });
        customToken = res.data.token;
      }
      
      await signInWithCustomToken(auth, customToken);
      
      setAppLocked(false);
      setPinSetSession(true); 
      
      saveAccount(phone.replace(/\D/g, ''), selectedRole);
      
      toast.success("Logged in successfully!");
    } catch (err) {
      console.error("PIN Login Error:", err);
      setError("Incorrect PIN. Please try again.");
      setLoginPin('');
      setSubmitting(false);
    }
  };

  const submittingRef = useRef(false);

  // ── Save PIN ──────────────────────────────────────────────────────────────
  const handleSavePin = async (e) => {
    e?.preventDefault(); setError('');
    if (setupPin !== confirmPin) { setError('PINs do not match'); return; }
    if (setupPin.length !== 4) { setError('PIN must be 4 digits'); return; }
    if (submitting) return; setSubmitting(true);
    try {
      if (!auth.currentUser) {
         // First time setup, no auth yet
         const registerFirstTimePin = httpsCallable(functions, 'registerFirstTimePin');
         const res = await registerFirstTimePin({ phone: phone.replace(/\D/g, ''), pin: setupPin, role: selectedRole });
         const customToken = res.data.token;
         await signInWithCustomToken(auth, customToken);
      }

      setAppLocked(false);
      setPinSetSession(true);

      saveAccount(phone.replace(/\D/g, ''), selectedRole);
      toast.success('PIN set! Next time, just enter your PIN.');
      setPinSetupComplete(true);
    } catch (err) {
      console.error("PIN setup error:", err);
      setError('Failed to save PIN. Please try again.');
      setSubmitting(false);
    }
  };



  const goBack = () => {
    setError('');
    if (step === 'pin_setup') navigate('/dashboard');
    else if (step === 'pin_enter') { 
      const hasSaved = getSavedAccounts().some(a => a.role === selectedRole);
      setStep(hasSaved ? 'saved_accounts' : 'phone'); 
      setLoginPin(''); 
    }
    else if (step === 'phone') { 
      const hasSaved = getSavedAccounts().some(a => a.role === selectedRole);
      setStep(hasSaved ? 'saved_accounts' : 'role'); 
      setPhone(''); 
    }
    else if (step === 'saved_accounts') {
      setStep('role');
      setSelectedRole(null);
    }
  };

  const switchLang = () => i18n.changeLanguage(i18n.language === 'te' ? 'en' : 'te');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-background">

      {/* ── LEFT decorative pane (desktop) ── */}
      <div className="hidden lg:flex w-[46%] relative overflow-hidden bg-slate-950 text-white flex-shrink-0">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <motion.div animate={{ scale: [1, 1.15, 1], rotate: [0, 25, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="glow-blob absolute -top-40 -left-24 h-[560px] w-[560px] rounded-full bg-indigo-600" />
        <motion.div animate={{ scale: [1.1, 1, 1.1], rotate: [0, -20, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="glow-blob absolute -bottom-24 -right-24 h-[500px] w-[500px] rounded-full bg-fuchsia-600" />
        <motion.div animate={{ y: [0, -24, 0], x: [0, 12, 0] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="glow-blob absolute top-1/2 left-1/3 h-[280px] w-[280px] rounded-full bg-cyan-500/50" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo — wider + taller */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex justify-center">
            <Logo className="w-full max-w-[750px] h-auto sm:h-64" />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-xs font-bold tracking-wider uppercase text-white/80">{t('securePhoneLogin')}</span>
            </div>
            <h1 className="font-display font-black text-5xl xl:text-6xl tracking-tighter leading-[1] text-white">
              {t('elevateYour')}<br />
              <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                {t('educationalEcosystem')}
              </span>
            </h1>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">{t('onePlatform')}</p>
            <div className="flex flex-col gap-2 pt-1">
              {ROLES.map(({ id, icon: Icon, labelKey, gradient }) => (
                <div key={id} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10">
                  <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${gradient} grid place-items-center flex-shrink-0`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-white/80">{t(labelKey)}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="text-xs text-white/30 font-medium">{t('encryptedFooter', { year: new Date().getFullYear() })}</div>
        </div>
      </div>

      {/* ── RIGHT auth pane ── */}
      <div className="flex-1 flex flex-col relative min-h-screen overflow-hidden safe-pt">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/3 pointer-events-none" />

        <button onClick={switchLang} className="absolute safe-top mt-2 right-5 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-xs font-bold tracking-wider uppercase transition-colors">
          <Globe className="h-3.5 w-3.5" />{i18n.language === 'te' ? 'తెలుగు' : 'EN'}
        </button>

        <div className="relative flex-1 flex flex-col items-center justify-center p-4 sm:p-12">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[440px]">

            {/* Mobile logo — wider + taller */}
            <div className="lg:hidden flex justify-center mb-10">
              <Logo className="w-full max-w-[450px] h-auto sm:h-48" />
            </div>

            <div className="bg-card/60 backdrop-blur-2xl border border-border/50 shadow-2xl shadow-primary/5 rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden">
              {/* Subtle inner glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

              <AnimatePresence mode="wait">

              {/* ── Role selection ── */}
              {step === 'role' && (
                <motion.div key="role" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
                  <p className="label-eyebrow text-primary mb-2 tracking-widest">{t('securePhoneLogin')}</p>
                  <h2 className="font-display font-black text-4xl tracking-tighter mb-1">{t('signIn')}</h2>
                  <p className="text-sm text-muted-foreground mb-8">{t('loginSubtitle')}</p>
                  <div className="space-y-3">
                    {ROLES.map(r => {
                      const Icon = r.icon;
                      return (
                        <motion.button key={r.id} whileHover={{ scale: 1.012, x: 3 }} whileTap={{ scale: 0.988 }}
                        onClick={() => { 
                          setSelectedRole(r.id); 
                          setLoginRole(r.id); 
                          setError(''); 
                          const hasSaved = getSavedAccounts().some(a => a.role === r.id);
                          setStep(hasSaved ? 'saved_accounts' : 'phone');
                        }}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary/40 bg-card hover:bg-muted/40 transition-all text-left group">
                          <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${r.gradient} grid place-items-center flex-shrink-0 shadow-lg`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-base">{t(r.labelKey)}</div>
                            <div className="text-xs text-muted-foreground">{t(r.hintKey)}</div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ── Saved Accounts ── */}
              {step === 'saved_accounts' && (
                <motion.div key="saved_accounts" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
                  <button onClick={goBack} className="mb-6 flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft className="h-4 w-4" />{t('backToRoles', 'Back to Roles')}
                  </button>
                  <h2 className="font-display font-black text-4xl tracking-tighter mb-1">Choose an account</h2>
                  <p className="text-sm text-muted-foreground mb-8">Select a recently used account to securely log in with your PIN.</p>
                  
                  <div className="space-y-3">
                    {getSavedAccounts().filter(a => a.role === selectedRole).map(acc => (
                      <motion.button key={`${acc.phone}-${refreshKey}`} whileHover={{ scale: 1.012, x: 3 }} whileTap={{ scale: 0.988 }}
                        onClick={() => { setPhone(acc.phone); setStep('pin_enter'); }}
                        className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-border hover:border-primary/40 bg-card hover:bg-muted/40 transition-all text-left group">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center flex-shrink-0">
                            <UserIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-bold text-base tracking-wide">+91 {acc.phone}</div>
                            <div className="text-xs text-muted-foreground capitalize">{acc.role} Account</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSavedAccount(acc.phone, acc.role);
                              setRefreshKey(k => k + 1);
                              
                              // Auto-close if no accounts left
                              const remaining = getSavedAccounts().filter(a => a.role === selectedRole);
                              if (remaining.length === 0) {
                                setStep('phone');
                              }
                            }}
                            className="p-2 text-muted-foreground/30 hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all" />
                        </div>
                      </motion.button>
                    ))}
                    
                    <motion.button whileHover={{ scale: 1.012 }} whileTap={{ scale: 0.988 }}
                      onClick={() => { setPhone(''); setStep('phone'); }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-transparent hover:bg-muted/20 transition-all text-left text-muted-foreground hover:text-foreground mt-4 group">
                      <div className="h-10 w-10 rounded-full bg-muted grid place-items-center flex-shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <UsersIcon className="h-4 w-4" />
                      </div>
                      <div className="font-bold text-sm">Use another account</div>
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* ── Phone entry ── */}
              {step === 'phone' && (
                <motion.div key="phone" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
                  <button onClick={goBack} className="mb-6 flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft className="h-4 w-4" />{t('backToRoles')}
                  </button>
                  <h2 className="font-display font-black text-4xl tracking-tighter mb-1">{t('enterNumber')}</h2>
                  <p className="text-sm text-muted-foreground mb-8">{t('enterNumberSub')}</p>
                  <form onSubmit={handlePhoneSubmit} className="space-y-5">
                    <div>
                      <label className="label-eyebrow text-muted-foreground">{t('mobileNumber')}</label>
                      <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 border-border bg-card px-4 h-14 focus-within:border-primary transition-colors shadow-sm">
                        <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-bold text-muted-foreground border-r border-border pr-3 mr-1">+91</span>
                        <input type="tel" value={phone}
                          onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                          placeholder="XXXXXXXXXX"
                          className="flex-1 bg-transparent font-bold text-base outline-none placeholder:text-muted-foreground/30 min-w-0" />
                      </div>
                    </div>
                    {error && <ErrorBox msg={error} />}
                    <button type="submit" disabled={submitting || phone.length !== 10}
                      className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]">
                      {submitting 
                        ? <><RefreshCw className="h-5 w-5 animate-spin" /> Please wait</> 
                        : <>Continue <ArrowRight className="h-4 w-4" /></>}
                    </button>
                  </form>
                </motion.div>
              )}



              {/* ── PIN entry ── */}
              {step === 'pin_enter' && (
                <motion.div key="pin_enter" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
                  <button onClick={goBack} className="mb-6 flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft className="h-4 w-4" />{t('changeNumber')}
                  </button>
                  <div className="flex flex-col items-center mb-6">
                    <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                      <Lock className="h-8 w-8" />
                    </div>
                    <h2 className="font-display font-black text-3xl tracking-tighter">Enter Your PIN</h2>
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      Welcome back! Please enter your 4-digit PIN to securely log in.
                    </p>
                  </div>
                  <form onSubmit={handlePinLogin} className="space-y-6">
                    <PinInput value={loginPin} onChange={val => {
                      setLoginPin(val);
                      if (val.length === 4) handlePinLogin(null, val);
                    }} />
                    
                    {error && <ErrorBox msg={error} />}
                    <button type="submit" disabled={submitting || loginPin.length !== 4}
                      className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]">
                      {submitting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <><LogIn className="h-5 w-5" /> Login</>}
                    </button>
                    <button type="button" onClick={handleForgotPin} disabled={submitting}
                      className="w-full h-12 flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
                      <KeyRound className="h-4 w-4" /> Forgot PIN?
                    </button>
                  </form>
                </motion.div>
              )}

              {/* ── PIN Setup ── */}
              {step === 'pin_setup' && (
                <motion.div key="pin_setup" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }}>
                  <div className="flex flex-col items-center text-center mb-8">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                      className="h-16 w-16 rounded-full bg-emerald-500/15 text-emerald-500 grid place-items-center mb-4">
                      <CheckCircle2 className="h-8 w-8" />
                    </motion.div>
                    <h2 className="font-display font-black text-3xl tracking-tighter">
                      Create Your PIN
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
                      Set a PIN to quickly unlock the app when you return.
                    </p>
                  </div>

                  <form onSubmit={handleSavePin} className="space-y-6">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground text-center tracking-widest uppercase mb-4">New PIN</p>
                      <PinInput value={setupPin} onChange={setSetupPin} />
                    </div>
                    <AnimatePresence>
                      {setupPin.length === 4 && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                          <p className="text-xs font-bold text-muted-foreground text-center tracking-widest uppercase mb-4">Confirm PIN</p>
                          <PinInput value={confirmPin} onChange={setConfirmPin} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {error && <ErrorBox msg={error} />}
                    {setupPin.length === 4 && confirmPin.length === 4 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className={`p-3 rounded-xl text-sm font-semibold text-center ${setupPin === confirmPin ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                        {setupPin === confirmPin ? '✓ PINs match' : '✗ PINs do not match'}
                      </motion.div>
                    )}
                    <button type="submit"
                      disabled={submitting || setupPin.length !== 4 || confirmPin.length !== 4 || setupPin !== confirmPin}
                      className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]">
                      {submitting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Save PIN &amp; Continue</>}
                    </button>
                  </form>
                </motion.div>
              )}

              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
