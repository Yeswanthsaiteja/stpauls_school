import React from 'react';
import { motion } from 'framer-motion';
import { Users, FileCheck, FileText, Headset, Bell, Cake, AlertCircle, Sparkles, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { demoStore } from '../services/demoStore';

const Stat = ({ icon: Icon, label, value, color, testId }) => (
  <motion.div whileHover={{ y: -5, scale: 1.02 }} className="glass-morphism rounded-[2rem] p-5 relative overflow-hidden" data-testid={testId}>
    <div className={`absolute -top-10 -right-10 h-28 w-28 rounded-full ${color}/20 blur-2xl`} />
    <div className={`h-11 w-11 rounded-2xl ${color} grid place-items-center text-white`}><Icon className="h-5 w-5" /></div>
    <div className="mt-4 label-eyebrow text-muted-foreground">{label}</div>
    <div className="mt-1 font-display font-black text-3xl tracking-tighter">{value}</div>
  </motion.div>
);

export default function StaffDashboard() {
  const { t } = useTranslation();
  const students = demoStore.list('students');
  const tickets = demoStore.list('tickets');

  const reminders = [
    { type: 'birthday', text: 'Diya Patel turns 14 tomorrow', icon: Cake, color: 'text-pink-500' },
    { type: 'fee', text: '6 fee reminders queued for Class X', icon: AlertCircle, color: 'text-amber-500' },
    { type: 'event', text: 'Lab session at 2 PM (X-A)', icon: Bell, color: 'text-indigo-500' },
  ];

  return (
    <div className="space-y-6" data-testid="staff-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">{t('staffHub')}</h1>
            <span className="px-3 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />{t('premiumAccess')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Your daily teaching log, tasks & student vitals.</p>
        </div>
        <div className="flex bg-muted rounded-full p-1">
          <button className="px-4 py-1.5 rounded-full bg-background label-eyebrow shadow">Overview</button>
          <button className="px-4 py-1.5 rounded-full label-eyebrow text-muted-foreground">Daily Log</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Stat testId="staff-stat-mystudents" icon={Users} label={t('myStudents')} value={students.length} color="bg-gradient-to-br from-indigo-500 to-violet-500" />
        <Stat testId="staff-stat-pending-adm" icon={FileCheck} label={t('pendingAdmissions')} value={3} color="bg-gradient-to-br from-emerald-500 to-teal-500" />
        <Stat testId="staff-stat-results" icon={FileText} label={t('resultsPending')} value={5} color="bg-gradient-to-br from-amber-500 to-orange-500" />
        <Stat testId="staff-stat-tickets" icon={Headset} label={t('ticketsRaised')} value={tickets.filter((x) => x.status !== 'CLOSED').length} color="bg-gradient-to-br from-rose-500 to-pink-500" />

        <motion.div whileHover={{ y: -5 }} className="glass-morphism rounded-[2rem] p-5 col-span-2 md:col-span-2 lg:col-span-1">
          <div className="label-eyebrow text-muted-foreground">Reminders</div>
          <div className="mt-3 space-y-2">
            {reminders.map((r, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted/50">
                <r.icon className={`h-4 w-4 ${r.color}`} />
                <div className="text-xs font-medium">{r.text}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-morphism rounded-[2rem] p-5">
          <div className="label-eyebrow text-muted-foreground mb-4">Recent Activity</div>
          <div className="space-y-3">
            {[
              { icon: GraduationCap, color: 'bg-indigo-500/10 text-indigo-500', text: 'Admission approved · Aarav Sharma' },
              { icon: FileText, color: 'bg-amber-500/10 text-amber-500', text: 'Result entered · X-A Mathematics' },
              { icon: Headset, color: 'bg-rose-500/10 text-rose-500', text: 'Ticket #TKT0019 escalated' },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/30">
                <div className={`h-9 w-9 rounded-xl grid place-items-center ${a.color}`}><a.icon className="h-4 w-4" /></div>
                <div className="text-sm font-medium">{a.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-morphism rounded-[2rem] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="label-eyebrow text-muted-foreground">{t('notifications')}</div>
            <button className="label-eyebrow text-primary">Mark all read</button>
          </div>
          <div className="space-y-3">
            {[
              { p: 'HIGH', text: 'Substitute needed for Period 4', time: '5m', color: 'bg-rose-500/10 text-rose-500 border-rose-500/30' },
              { p: 'MED', text: 'Lab report deadline tomorrow', time: '1h', color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
              { p: 'LOW', text: 'PTM schedule revised', time: '3h', color: 'bg-slate-500/10 text-slate-500 border-slate-500/30' },
            ].map((n, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-2xl border border-border">
                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${n.color}`}>{n.p}</span>
                <div className="flex-1 text-sm font-medium">{n.text}</div>
                <div className="label-eyebrow text-muted-foreground">{n.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
