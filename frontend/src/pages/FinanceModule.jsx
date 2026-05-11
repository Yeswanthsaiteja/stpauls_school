import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, IndianRupee, Wallet, ListChecks, MessageCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { demoStore } from '../services/demoStore';
import { formatCurrency, getWhatsAppUrl } from '../lib/utils';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

export default function FinanceModule() {
  const tx = demoStore.list('transactions');
  const paid = tx.filter((x) => x.status === 'PAID').reduce((s, x) => s + x.amount, 0);
  const navigate = useNavigate();
  const pieData = [
    { name: 'Tuition', value: 480000 },
    { name: 'Transport', value: 120000 },
    { name: 'Hostel', value: 86000 },
    { name: 'Other', value: 42000 },
  ];
  const defaulters = tx.filter((x) => x.status !== 'PAID').slice(0, 4);

  return (
    <div className="space-y-6" data-testid="finance-module">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">Revenue Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">Total Collections MTD · <span className="font-display font-black text-foreground tracking-tighter text-lg">{formatCurrency(paid)}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: IndianRupee, label: 'Fee Setup', sub: 'Structures · slabs', color: 'from-indigo-500 to-violet-500', to: '/dashboard/finance/setup' },
          { icon: Wallet, label: 'Fee Collection', sub: 'Receive · receipt', color: 'from-emerald-500 to-teal-500', to: '/dashboard/finance/collect' },
          { icon: ListChecks, label: 'Ledger', sub: 'Income · expense', color: 'from-amber-500 to-orange-500', to: '/dashboard/finance/ledger' },
          { icon: TrendingUp, label: 'Payroll', sub: 'Staff payslips', color: 'from-rose-500 to-pink-500', to: '/dashboard/finance/payroll' },
        ].map((c) => (
          <motion.button onClick={() => c.to !== '#' && navigate(c.to)} whileHover={{ y: -5, scale: 1.02 }} key={c.label} className="glass-morphism rounded-[2rem] p-5 text-left" data-testid={`finance-card-${c.label.split(' ').join('-')}`}>
            <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${c.color} grid place-items-center text-white`}><c.icon className="h-5 w-5" /></div>
            <div className="mt-4 font-bold">{c.label}</div>
            <div className="label-eyebrow text-muted-foreground mt-1">{c.sub}</div>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass-morphism rounded-[2rem] p-5 lg:col-span-1">
          <div className="label-eyebrow text-muted-foreground mb-4">Category Distribution</div>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={56} outerRadius={88} paddingAngle={4}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 14 }} formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {pieData.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} /><span className="font-medium">{p.name}</span></div>
                <span className="font-display font-black tracking-tighter">{formatCurrency(p.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-morphism rounded-[2rem] p-5 lg:col-span-2">
          <div className="label-eyebrow text-muted-foreground mb-4">Recent Transactions</div>
          <div className="space-y-2">
            {tx.map((t) => {
              const isIn = t.status === 'PAID';
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/30">
                  <div className={`h-9 w-9 rounded-xl grid place-items-center ${isIn ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {isIn ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{t.studentName}</div>
                    <div className="label-eyebrow text-muted-foreground">{t.feeName} · {t.receiptNo}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-black tracking-tighter">{formatCurrency(t.amount)}</div>
                    <div className={`label-eyebrow ${isIn ? 'text-emerald-500' : 'text-rose-500'}`}>{t.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 glass-morphism rounded-[2rem] p-5 relative overflow-hidden">
          <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-blue-500/15 blur-2xl" />
          <div className="relative">
            <div className="label-eyebrow text-muted-foreground">Razorpay Integration</div>
            <div className="font-display font-black text-2xl tracking-tighter mt-1">Online Fee Payments</div>
            <p className="text-xs text-muted-foreground mt-2">Accept UPI, cards & netbanking. Auto-receipt to parents.</p>
            <a href="/dashboard/razorpay" className="mt-4 inline-flex items-center px-4 h-10 rounded-2xl bg-foreground text-background label-eyebrow" data-testid="razorpay-config-btn">Configure API Keys</a>
          </div>
        </div>
        <div className="lg:col-span-2 glass-morphism rounded-[2rem] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="label-eyebrow text-muted-foreground">Fee Reminders</div>
            <button className="label-eyebrow text-primary">Send All</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {defaulters.map((d) => (
              <div key={d.id} className="rounded-2xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">{d.studentName}</div>
                    <div className="label-eyebrow text-muted-foreground">{d.feeName}</div>
                  </div>
                  <div className="font-display font-black tracking-tighter">{formatCurrency(d.amount)}</div>
                </div>
                <a href={getWhatsAppUrl('+919812345671', `Reminder: ${d.feeName} of ₹${d.amount} for ${d.studentName}`)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 label-eyebrow">
                  <MessageCircle className="h-3 w-3" />Send Reminder
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
