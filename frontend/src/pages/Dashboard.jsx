import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserSquare2, IndianRupee, CalendarCheck, AlertCircle, RefreshCw, Download, Sparkles, TrendingUp, GraduationCap } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTranslation } from 'react-i18next';
import { listStudents } from '../services/firebase/studentsService';
import { listEmployees } from '../services/firebase/employeesService';
import { listTransactions } from '../services/firebase/financeService';
import { subscribeRecentActivities } from '../services/firebase/activityService';
import { formatCurrency, exportToCSV } from '../lib/utils';
import { useTenant } from '../contexts/TenantContext';
import axios from 'axios';

const STAT_COLORS = {
  indigo:  { from: 'from-indigo-500',  to: 'to-violet-500',  ring: 'bg-indigo-500/10',  text: 'text-indigo-500'  },
  purple:  { from: 'from-fuchsia-500', to: 'to-purple-500',  ring: 'bg-fuchsia-500/10', text: 'text-fuchsia-500' },
  emerald: { from: 'from-emerald-500', to: 'to-teal-500',    ring: 'bg-emerald-500/10', text: 'text-emerald-500' },
  amber:   { from: 'from-amber-500',   to: 'to-orange-500',  ring: 'bg-amber-500/10',   text: 'text-amber-500'   },
  rose:    { from: 'from-rose-500',    to: 'to-pink-500',    ring: 'bg-rose-500/10',    text: 'text-rose-500'    },
};

const StatCard = ({ icon: Icon, label, value, color = 'indigo', sub, testId }) => {
  const c = STAT_COLORS[color];
  return (
    <motion.div
      data-testid={testId}
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative glass-morphism rounded-[2rem] p-5 overflow-hidden"
    >
      <div className={`absolute -top-10 -right-10 h-32 w-32 rounded-full ${c.ring} blur-2xl`} />
      <div className="flex items-start justify-between relative">
        <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${c.from} ${c.to} grid place-items-center text-white shadow-lg`}>
          <Icon className="h-5 w-5" />
        </div>
        {sub && <span className="label-eyebrow text-muted-foreground">{sub}</span>}
      </div>
      <div className="mt-5 label-eyebrow text-muted-foreground">{label}</div>
      <div className="mt-1 font-display font-black text-3xl tracking-tighter">{value}</div>
    </motion.div>
  );
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const [tick, setTick] = useState(0);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const [students, setStudents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    // DEBUG LOGGING TO CATCH TOKEN ISSUE
    import('../lib/firebase').then(({ auth }) => {
      if (auth.currentUser) {
        auth.currentUser.getIdToken().then(t => console.log('✅ TOKEN IS VALID:', t.substring(0, 20) + '...')).catch(e => console.error('❌ TOKEN FETCH FAILED:', e));
      } else {
        console.error('❌ auth.currentUser IS NULL IN DASHBOARD!');
      }
    });

    listStudents({ status: 'ACTIVE' }).then(setStudents);
    listEmployees({ status: 'ACTIVE' }).then(setEmployees);
    listTransactions().then(setTransactions);
  }, []);

  const stats = useMemo(() => {
    const paid = transactions.filter((x) => x.status === 'PAID').reduce((s, x) => s + x.amount, 0);
    const pending = transactions.filter((x) => x.status !== 'PAID').reduce((s, x) => s + x.amount, 0);
    const total = paid + pending;
    const collectionPct = total ? Math.round((paid / total) * 100) : 0;
    return {
      students: students.length,
      staff: employees.length,
      collection: `${collectionPct}%`,
      attendance: '94%',
      pending: formatCurrency(pending),
    };
  }, [students, employees, transactions]);

  const revenueData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((d, i) => ({ day: d, value: 25000 + Math.round(Math.sin(i + tick) * 8000 + Math.random() * 12000) }));
  }, [tick]);

  const [activity, setActivity] = useState([]);

  useEffect(() => {
    const unsub = subscribeRecentActivities(setActivity);
    return unsub;
  }, []);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const url = `${process.env.REACT_APP_BACKEND_URL}/api/ai/insights`;
      const { data } = await axios.post(url, {
        tenantName: tenant?.name || 'School',
        stats,
        locale: 'en',
      }, { timeout: 25000 });
      setInsights(data?.insights || []);
    } catch (e) {
      setInsights([
        'Attendance trending steady — recognise top classes weekly.',
        'Outstanding fees concentrated in upper grades; send reminders this week.',
        'Strong admission momentum — capture testimonials from new parents.',
      ]);
    } finally {
      setInsightsLoading(false);
    }
  }, [tenant, stats]);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  const handleExport = () => {
    exportToCSV(transactions.map((t) => ({
      receipt: t.receiptNo, student: t.studentName, fee: t.feeName, amount: t.amount, status: t.status, date: t.paymentDate,
    })), 'transactions.csv');
  };

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">{t('dashboard')}</h1>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{t('liveView')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{t('realtimeSignals')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTick((x) => x + 1)} data-testid="dashboard-refresh-btn" className="h-10 px-4 rounded-2xl bg-muted hover:bg-muted/80 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
            <RefreshCw className="h-3.5 w-3.5" />{t('refresh')}
          </button>
          <button onClick={handleExport} data-testid="dashboard-export-btn" className="h-10 px-4 rounded-2xl bg-foreground text-background hover:opacity-90 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
            <Download className="h-3.5 w-3.5" />{t('exportCsv')}
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard testId="stat-students" icon={Users} color="indigo" label={t('totalStudents')} value={stats.students} sub="+4 this week" />
        <StatCard testId="stat-staff" icon={UserSquare2} color="purple" label={t('totalStaff')} value={stats.staff} sub="3 depts" />
        <StatCard testId="stat-collection" icon={IndianRupee} color="emerald" label={t('feeCollection')} value={stats.collection} sub="MTD" />
        <StatCard testId="stat-attendance" icon={CalendarCheck} color="amber" label={t('attendanceToday')} value={stats.attendance} sub="Today" />
        <StatCard testId="stat-pending" icon={AlertCircle} color="rose" label={t('pendingFees')} value={stats.pending} sub="Outstanding" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Revenue chart */}
          <div className="glass-morphism rounded-[2rem] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="label-eyebrow text-muted-foreground">{t('revenueDynamics')}</div>
                <div className="font-display font-black text-2xl tracking-tighter mt-1 flex items-center gap-2">
                  ₹2,16,500 <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <div className="flex gap-1.5">
                {['7D', '30D', '90D'].map((p, i) => (
                  <button key={p} className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{p}</button>
                ))}
              </div>
            </div>
            <div style={{ width: '100%', height: 240, minHeight: 240 }}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 14 }} formatter={(v) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent activity */}
          <div className="glass-morphism rounded-[2rem] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="label-eyebrow text-muted-foreground">{t('recentActivity')}</div>
              <button className="label-eyebrow text-primary">{t('viewAll')}</button>
            </div>
            <div className="space-y-3">
              {activity.map((a, i) => (
                <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} key={i} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 transition">
                  <div className={`h-2 w-2 rounded-full ${a.dot}`} />
                  <div className="flex-1 text-sm font-medium">{a.text}</div>
                  <div className="label-eyebrow text-muted-foreground">{a.time}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Communication log dark card */}
          <div className="relative rounded-[2rem] p-6 bg-slate-950 text-white overflow-hidden">
            <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-indigo-500 glow-blob" />
            <div className="relative">
              <div className="label-eyebrow text-white/50">{t('communicationLog')}</div>
              <h3 className="font-display font-black text-2xl tracking-tighter mt-1">{t('messagesDispatchedToday')}</h3>
              <p className="text-sm text-white/70 mt-2 max-w-md">{t('communicationDesc')}</p>
              <div className="flex gap-2 mt-4">
                <span className="px-3 py-1 rounded-full bg-white/10 label-eyebrow">94 {t('delivered')}</span>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 label-eyebrow">22 {t('read')}</span>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 label-eyebrow">10 {t('pending')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights sidebar */}
        <div className="space-y-5">
          <div className="glass-morphism rounded-[2rem] p-5 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="label-eyebrow text-muted-foreground flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-fuchsia-500" />{t('aiInsights')}</div>
                <button onClick={loadInsights} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline" data-testid="ai-refresh-btn">
                  Refresh
                </button>
              </div>
              <div className="font-display font-black text-lg tracking-tighter mt-1">{t('poweredByGemini')}</div>
              <div className="mt-4 space-y-3">
                {insightsLoading && [1,2,3].map((i) => <div key={i} className="h-12 rounded-2xl bg-muted/60 animate-pulse" />)}
                {!insightsLoading && (insights || []).map((line, i) => (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} key={i} className="flex gap-3 p-3 rounded-2xl bg-muted/40 border border-border" data-testid={`insight-${i}`}>
                    <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center flex-shrink-0">
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-xs leading-relaxed">{line}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-[2rem] p-5">
            <div className="label-eyebrow text-muted-foreground">{t('quickGlance')}</div>
            <div className="mt-3 space-y-3">
              {[
                { icon: GraduationCap, label: t('avgClassStrength'), value: '34' },
                { icon: TrendingUp, label: t('yoyGrowth'), value: '+12%' },
                { icon: IndianRupee, label: t('avgFeeStudent'), value: '₹84,200' },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center"><r.icon className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1 text-xs font-bold">{r.label}</div>
                  <div className="font-display font-black text-base tracking-tighter">{r.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
