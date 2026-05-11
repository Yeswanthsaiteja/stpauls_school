import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, User as UserIcon, Users as UsersIcon, AlertCircle, GraduationCap, Globe, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export default function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [role, setRole] = useState('admin');
  const [email, setEmail] = useState('admin@demo.school');
  const [password, setPassword] = useState('demo1234');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    const res = await signIn(email, password);
    setSubmitting(false);
    if (res.ok) {
      toast.success('Welcome back');
      navigate('/dashboard');
    } else {
      setError(res.error || 'Sign-in failed');
    }
  };

  const fillDemo = (kind) => {
    setRole(kind);
    if (kind === 'admin') { setEmail('admin@demo.school'); setPassword('demo1234'); }
    if (kind === 'staff') { setEmail('staff@demo.school'); setPassword('demo1234'); }
    if (kind === 'parent') { setEmail('parent@demo.school'); setPassword('demo1234'); }
  };

  const switchLang = () => i18n.changeLanguage(i18n.language === 'te' ? 'en' : 'te');

  return (
    <div className="min-h-screen flex bg-background">
      {/* LEFT pane */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="glow-blob absolute -top-32 -left-20 h-[500px] w-[500px] rounded-full bg-indigo-500"
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], rotate: [0, -25, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="glow-blob absolute -bottom-20 -right-20 h-[480px] w-[480px] rounded-full bg-fuchsia-500"
        />
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="glow-blob absolute top-1/2 left-1/3 h-[300px] w-[300px] rounded-full bg-cyan-500/60"
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/10 backdrop-blur grid place-items-center">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-black text-xl tracking-tight uppercase">Benita ERP</div>
              <div className="label-eyebrow text-white/60">{t('appSub')}</div>
            </div>
          </div>

          <div className="space-y-6 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/10">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span className="label-eyebrow">Premium School Platform</span>
            </div>
            <h1 className="font-display font-black text-5xl xl:text-6xl tracking-tighter leading-[0.95]">
              Elevate your<br />
              <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">Educational Ecosystem.</span>
            </h1>
            <p className="text-white/70 text-base leading-relaxed">
              Multi-tenant institutional management — admissions, finance, academics, and parent engagement, unified.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {['Real-time Tracking', 'Automated Billing', 'Parent Portal', 'AI Insights'].map((p) => (
                <span key={p} className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/10 backdrop-blur label-eyebrow">{p}</span>
              ))}
            </div>
          </div>

          <div className="text-xs text-white/50">© {new Date().getFullYear()} Benita Systems · Trusted by 200+ schools</div>
        </div>
      </div>

      {/* RIGHT pane: form */}
      <div className="flex-1 flex flex-col relative">
        <button
          data-testid="login-lang-toggle"
          onClick={switchLang}
          className="absolute top-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 label-eyebrow"
        >
          <Globe className="h-3.5 w-3.5" />{i18n.language === 'te' ? 'తెలుగు' : 'EN'}
        </button>

        <div className="flex-1 grid place-items-center p-6 sm:p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display font-black text-lg tracking-tight uppercase">Benita ERP</div>
                <div className="label-eyebrow text-muted-foreground">{t('appSub')}</div>
              </div>
            </div>

            <h2 className="font-display font-black text-4xl tracking-tighter">{t('loginTitle')}</h2>
            <p className="text-sm text-muted-foreground mt-1.5">{t('loginSubtitle')}</p>

            <div className="mt-7">
              <div className="label-eyebrow text-muted-foreground mb-3">{t('userRole')}</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: 'admin', icon: Shield, label: t('administrator') },
                  { k: 'staff', icon: UserIcon, label: t('staff') },
                  { k: 'parent', icon: UsersIcon, label: t('parent') },
                ].map((r) => (
                  <button
                    type="button"
                    key={r.k}
                    data-testid={`role-btn-${r.k}`}
                    onClick={() => fillDemo(r.k)}
                    className={`group rounded-2xl border p-3.5 text-left transition-all ${role === r.k ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
                  >
                    <r.icon className={`h-4 w-4 mb-2 ${role === r.k ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="text-[11px] font-black uppercase tracking-tight leading-tight">{r.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" data-testid="login-form">
              <div>
                <label className="label-eyebrow text-muted-foreground">{t('email')}</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 h-12 focus-within:border-primary transition">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <input
                    data-testid="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm font-medium"
                    placeholder="you@school.edu"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="label-eyebrow text-muted-foreground">{t('password')}</label>
                  <button type="button" className="label-eyebrow text-primary hover:underline" data-testid="forgot-password-btn">{t('forgotPassword')}</button>
                </div>
                <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 h-12 focus-within:border-primary transition">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <input
                    data-testid="login-password"
                    type={showPwd ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm font-medium"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPwd((v) => !v)} className="text-muted-foreground hover:text-foreground" data-testid="toggle-password-visibility">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div data-testid="login-error" className="flex items-start gap-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                  <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">{error}</p>
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={submitting}
                data-testid="login-submit-btn"
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 disabled:opacity-50"
              >
                {submitting ? 'Signing in…' : t('signIn')}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </motion.button>

              <div className="rounded-2xl bg-muted/60 p-3 text-[11px] text-muted-foreground">
                <span className="font-black uppercase tracking-widest text-foreground">Demo · </span>
                Tap a role above to auto-fill. Password: <span className="font-mono font-bold">demo1234</span>
              </div>

              <div className="text-center text-xs text-muted-foreground pt-1">{t('contactSupport')}</div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
