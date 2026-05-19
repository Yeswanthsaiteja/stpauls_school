import React, { useState, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, ArrowRight, Shield, User as UserIcon, Users as UsersIcon,
  GraduationCap, Globe, Sparkles, AlertCircle, RefreshCw, CheckCircle2,
  Eye, ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// ─── Role definitions ─────────────────────────────────────────────────────────
const ROLES = [
  {
    id: 'admin',
    label: 'Admin',
    description: 'School administrator — full access',
    icon: Shield,
    gradient: 'from-violet-600 to-indigo-600',
    ring: 'ring-violet-500/40',
    bg: 'bg-violet-500/10',
    text: 'text-violet-600',
    hint: 'Use registered admin number',
  },
  {
    id: 'staff',
    label: 'Staff',
    description: 'Teacher or staff member',
    icon: UserIcon,
    gradient: 'from-cyan-500 to-blue-600',
    ring: 'ring-cyan-500/40',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-600',
    hint: 'Use your school-registered number',
  },
  {
    id: 'parent',
    label: 'Parent',
    description: 'Parent or guardian',
    icon: UsersIcon,
    gradient: 'from-fuchsia-500 to-pink-600',
    ring: 'ring-fuchsia-500/40',
    bg: 'bg-fuchsia-500/10',
    text: 'text-fuchsia-600',
    hint: 'Use the number given during admission',
  },
];

// ─── OTP input — 6 boxes ──────────────────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const inputRefs = useRef([]);
  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !e.target.value && i > 0) inputRefs.current[i - 1]?.focus();
  };
  const handleChange = (i, v) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = digit;
    const next = arr.join('').padEnd(6, ' ').slice(0, 6);
    onChange(next.trimEnd());
    if (digit && i < 5) inputRefs.current[i + 1]?.focus();
  };
  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(text);
    inputRefs.current[Math.min(text.length, 5)]?.focus();
    e.preventDefault();
  };
  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input key={i} ref={(el) => (inputRefs.current[i] = el)}
          type="text" inputMode="numeric" maxLength={1} value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          className="h-14 w-11 rounded-2xl border-2 border-border bg-card text-center text-xl font-black outline-none focus:border-primary transition-colors"
          data-testid={`otp-digit-${i}`}
        />
      ))}
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { sendOTP, verifyOTP, user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [step, setStep] = useState('role');   // 'role' | 'phone' | 'otp'
  const [selectedRole, setSelectedRole] = useState(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState(null);
  const [channel, setChannel] = useState('whatsapp'); // 'whatsapp' | 'sms'
  const timerRef = useRef(null);

  if (user) return <Navigate to="/dashboard" replace />;

  const role = ROLES.find((r) => r.id === selectedRole);

  const startCountdown = () => {
    setCountdown(30);
    timerRef.current = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(timerRef.current); return 0; } return c - 1; });
    }, 1000);
  };

  const selectRole = (roleId) => {
    setSelectedRole(roleId);
    setStep('phone');
    setError('');
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setError('Please enter a valid 10-digit mobile number'); return; }
    setSubmitting(true);
    const res = await sendOTP(digits, selectedRole);   // pass selected role
    setSubmitting(false);
    if (res.ok) {
      setPhoneDisplay(`+91 ${digits.slice(0, 5)} ${digits.slice(5)}`);
      setChannel(res.channel || 'whatsapp');
      if (res.devOtp) {
        setDevOtp(res.devOtp);
        toast.info('OTP shown below (SMS provider not configured)', { duration: 6000 });
      } else if (res.channel === 'whatsapp') {
        toast.success(`OTP sent to your WhatsApp (+91 ${digits})`);
      } else {
        toast.success(`OTP sent via SMS to +91 ${digits}`);
      }
      setStep('otp');
      startCountdown();
    } else {
      setError(res.error || 'Failed to send OTP');
    }
  };

  const handleVerifyOTP = async (e) => {
    e?.preventDefault();
    setError('');
    const code = otp.replace(/\s/g, '');
    if (code.length !== 6) { setError('Please enter the complete 6-digit OTP'); return; }
    setSubmitting(true);
    const res = await verifyOTP(code, `+91${phone.replace(/\D/g, '')}`);
    setSubmitting(false);
    if (res.ok) {
      toast.success(`Welcome, ${res.profile?.fullName || 'User'}!`);
      navigate('/dashboard');
    } else {
      const msg = res.error || 'Invalid OTP';
      setError(msg);
      toast.error(msg);
      // If it's a role mismatch (not wrong OTP), bounce back to role selection after delay
      const isRoleMismatch = msg.toLowerCase().includes('not the admin') ||
        msg.toLowerCase().includes('not registered as');
      if (isRoleMismatch) {
        setTimeout(() => { setStep('role'); setPhone(''); setOtp(''); setError(''); }, 2800);
      }
    }
  };

  const handleOtpChange = (val) => {
    setOtp(val);
    if (val.replace(/\s/g, '').length === 6) setTimeout(() => handleVerifyOTP(), 300);
  };

  const resendOTP = async () => {
    if (countdown > 0) return;
    setOtp(''); setError(''); setDevOtp(null);
    setSubmitting(true);
    const res = await sendOTP(phone, selectedRole);
    setSubmitting(false);
    if (res.ok) {
      startCountdown();
      if (res.devOtp) { setDevOtp(res.devOtp); } else { toast.success('OTP resent!'); }
    } else { setError(res.error); }
  };

  const goBack = () => {
    if (step === 'otp') { setStep('phone'); setOtp(''); setError(''); setDevOtp(null); setChannel('whatsapp'); }
    else if (step === 'phone') { setStep('role'); setPhone(''); setError(''); setSelectedRole(null); }
  };

  const switchLang = () => i18n.changeLanguage(i18n.language === 'te' ? 'en' : 'te');

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── LEFT pane ── */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 30, 0] }} transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="glow-blob absolute -top-32 -left-20 h-[500px] w-[500px] rounded-full bg-indigo-500" />
        <motion.div animate={{ scale: [1.1, 1, 1.1], rotate: [0, -25, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="glow-blob absolute -bottom-20 -right-20 h-[480px] w-[480px] rounded-full bg-fuchsia-500" />
        <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="glow-blob absolute top-1/2 left-1/3 h-[300px] w-[300px] rounded-full bg-cyan-500/60" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/10 backdrop-blur grid place-items-center">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-black text-xl tracking-tight uppercase">St. Paul's High School</div>
              <div className="label-eyebrow text-white/60">Institutional Management Suite</div>
            </div>
          </div>

          <div className="space-y-6 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/10">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span className="label-eyebrow">Secure Phone Login</span>
            </div>
            <h1 className="font-display font-black text-5xl xl:text-6xl tracking-tighter leading-[0.95]">
              Elevate your<br />
              <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                Educational Ecosystem.
              </span>
            </h1>
            <p className="text-white/70 text-base leading-relaxed">
              One platform for admissions, finance, attendance, academics and parent engagement — secured with OTP login.
            </p>

            {/* Role cards on left pane */}
            <div className="space-y-2 pt-2">
              {ROLES.map(({ icon: Icon, label, description, gradient, ring }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${gradient} grid place-items-center flex-shrink-0`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{label}</div>
                    <div className="text-xs text-white/50">{description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-white/50">© {new Date().getFullYear()} St. Paul's High School · Secure & Encrypted</div>
        </div>
      </div>

      {/* ── RIGHT pane ── */}
      <div className="flex-1 flex flex-col relative">
        <button onClick={switchLang}
          className="absolute top-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 label-eyebrow z-10">
          <Globe className="h-3.5 w-3.5" />{i18n.language === 'te' ? 'తెలుగు' : 'EN'}
        </button>

        <div className="flex-1 grid place-items-center p-6 sm:p-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">

            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display font-black text-lg tracking-tight uppercase">St. Paul's High School</div>
                <div className="label-eyebrow text-muted-foreground">Institutional Management Suite</div>
              </div>
            </div>

            <AnimatePresence mode="wait">

              {/* ── STEP 0: Role selection ── */}
              {step === 'role' && (
                <motion.div key="role" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="font-display font-black text-4xl tracking-tighter">Sign In</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">Select your role to continue</p>

                  <div className="mt-8 space-y-3">
                    {ROLES.map((r) => {
                      const Icon = r.icon;
                      return (
                        <motion.button key={r.id} whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                          onClick={() => selectRole(r.id)}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary/40 bg-card hover:bg-muted/40 transition-all text-left group`}>
                          <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${r.gradient} grid place-items-center flex-shrink-0 shadow-lg`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-base">{r.label}</div>
                            <div className="text-xs text-muted-foreground">{r.hint}</div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="mt-6 text-center text-xs text-muted-foreground">
                    OTP is valid for 10 minutes · Message rates may apply
                  </div>
                </motion.div>
              )}

              {/* ── STEP 1: Phone entry ── */}
              {step === 'phone' && (
                <motion.div key="phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <button onClick={goBack} className="label-eyebrow text-primary mb-6 flex items-center gap-1 hover:opacity-70 transition-opacity">
                    <ChevronLeft className="h-3.5 w-3.5" /> Back
                  </button>

                  {/* Selected role badge */}
                  {role && (
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${role.bg} mb-4`}>
                      <div className={`h-4 w-4 rounded-full bg-gradient-to-br ${role.gradient} grid place-items-center`}>
                        <role.icon className="h-2.5 w-2.5 text-white" />
                      </div>
                      <span className={`label-eyebrow ${role.text}`}>{role.label} Login</span>
                    </div>
                  )}

                  <h2 className="font-display font-black text-4xl tracking-tighter">Enter Number</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">We'll send a one-time password to your mobile</p>

                  <form onSubmit={handleSendOTP} className="mt-8 space-y-5" data-testid="login-form">
                    <div>
                      <label className="label-eyebrow text-muted-foreground">Mobile Number</label>
                      <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 border-border bg-card px-4 h-14 focus-within:border-primary transition-colors">
                        <div className="flex items-center gap-2 pr-3 border-r border-border">
                          <span className="text-lg">🇮🇳</span>
                          <span className="text-sm font-bold text-muted-foreground">+91</span>
                        </div>
                        <Phone className="h-4 w-4 text-muted-foreground ml-2" />
                        <input data-testid="login-phone"
                          type="tel" inputMode="numeric" maxLength={10} required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="flex-1 bg-transparent outline-none text-base font-bold tracking-widest"
                          placeholder="98765 43210" autoFocus />
                      </div>
                    </div>

                    {error && (
                      <div data-testid="login-error" className="flex items-start gap-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                        <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">{error}</p>
                      </div>
                    )}

                    <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                      type="submit" disabled={submitting || phone.length !== 10} data-testid="login-submit-btn"
                      className={`w-full py-3.5 rounded-2xl bg-gradient-to-r ${role?.gradient || 'from-indigo-600 to-violet-600'} text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-opacity`}>
                      {submitting ? <><RefreshCw className="h-4 w-4 animate-spin" /> Sending OTP…</> : <>Send OTP <ArrowRight className="h-4 w-4" /></>}
                    </motion.button>

                    <div className="text-center text-xs text-muted-foreground">OTP is valid for 10 minutes · Message rates may apply</div>
                  </form>
                </motion.div>
              )}

              {/* ── STEP 2: OTP entry ── */}
              {step === 'otp' && (
                <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <button onClick={goBack} className="label-eyebrow text-primary mb-6 flex items-center gap-1 hover:opacity-70 transition-opacity">
                    <ChevronLeft className="h-3.5 w-3.5" /> Change number
                  </button>

                  <div className={`h-14 w-14 rounded-[1.2rem] bg-gradient-to-br ${role?.gradient || 'from-indigo-500 to-violet-600'} grid place-items-center text-white mb-5 shadow-lg`}>
                    <Phone className="h-6 w-6" />
                  </div>

                  <h2 className="font-display font-black text-4xl tracking-tighter">Verify OTP</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    {channel === 'whatsapp' ? '💬 Check your WhatsApp on' : '📱 OTP sent via SMS to'}<br />
                    <span className="font-bold text-foreground">{phoneDisplay}</span>
                  </p>

                  {devOtp && (
                    <div className="mt-3 flex items-center gap-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                      <Eye className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <div className="text-xs text-amber-700 dark:text-amber-300">
                        <span className="font-semibold">SMS not configured.</span> Your OTP is{' '}
                        <button type="button" onClick={() => setOtp(devOtp)}
                          className="font-mono font-black text-base text-amber-900 dark:text-amber-100 tracking-widest hover:underline">
                          {devOtp}
                        </button>{' '}(tap to fill)
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleVerifyOTP} className="mt-8 space-y-5" data-testid="otp-form">
                    <OtpInput value={otp} onChange={handleOtpChange} />

                    {error && (
                      <div className="flex items-start gap-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                        <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">{error}</p>
                      </div>
                    )}

                    <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                      type="submit" disabled={submitting || otp.replace(/\s/g, '').length < 6} data-testid="otp-submit-btn"
                      className={`w-full py-3.5 rounded-2xl bg-gradient-to-r ${role?.gradient || 'from-indigo-600 to-violet-600'} text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 shadow-lg disabled:opacity-50`}>
                      {submitting ? <><RefreshCw className="h-4 w-4 animate-spin" /> Verifying…</> : <><CheckCircle2 className="h-4 w-4" /> Verify & Sign In</>}
                    </motion.button>

                    <div className="text-center">
                      {countdown > 0 ? (
                        <p className="text-sm text-muted-foreground">Resend in <span className="font-bold text-foreground">{countdown}s</span></p>
                      ) : (
                        <button type="button" onClick={resendOTP} disabled={submitting}
                          className="text-sm text-primary font-bold hover:underline disabled:opacity-50">
                          Didn't receive OTP? Resend
                        </button>
                      )}
                    </div>
                    <div className="text-center text-xs text-muted-foreground">OTP expires in 10 minutes · Check SMS</div>
                  </form>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
