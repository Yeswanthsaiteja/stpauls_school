import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { TrendingUp, TrendingDown, Plus, X, FileDown } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { demoStore } from '../../services/demoStore';
import { formatCurrency, exportToCSV } from '../../lib/utils';
import { toast } from 'sonner';

const CATEGORIES = ['Rent', 'Utilities', 'Maintenance', 'Salaries', 'Supplies', 'Events', 'Other'];
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#94a3b8'];

export default function Ledger() {
  const [expenses, setExpenses] = useState(demoStore.list('expenses'));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), category: 'Utilities', description: '', amount: 0, paidBy: 'Accountant' });

  const txs = demoStore.list('transactions').filter((t) => t.status === 'PAID');
  const refresh = () => setExpenses(demoStore.list('expenses'));

  const addExpense = () => {
    if (!form.description) return toast.error('Description required');
    demoStore.add('expenses', { ...form, amount: Number(form.amount) });
    refresh();
    setOpen(false);
    setForm({ date: new Date().toISOString().slice(0, 10), category: 'Utilities', description: '', amount: 0, paidBy: 'Accountant' });
    toast.success('Expense added');
  };

  const incomeTotal = txs.reduce((s, t) => s + t.amount, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const net = incomeTotal - expenseTotal;

  const categoryData = useMemo(() => {
    const m = {};
    expenses.forEach((e) => { m[e.category] = (m[e.category] || 0) + e.amount; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const monthlyData = useMemo(() => {
    const m = {};
    [...txs.map((t) => ({ ...t, _type: 'income', _date: t.paymentDate })), ...expenses.map((e) => ({ ...e, _type: 'expense', _date: e.date }))].forEach((row) => {
      const month = String(row._date || '').slice(0, 7);
      if (!month) return;
      if (!m[month]) m[month] = { month, income: 0, expense: 0 };
      m[month][row._type] += row.amount;
    });
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month));
  }, [txs, expenses]);

  const exportLedger = () => {
    const incomes = txs.map((t) => ({ date: t.paymentDate?.slice(0,10), type: 'INCOME', category: t.feeName, description: t.studentName, amount: t.amount }));
    const exps = expenses.map((e) => ({ date: e.date, type: 'EXPENSE', category: e.category, description: e.description, amount: -e.amount }));
    exportToCSV([...incomes, ...exps].sort((a, b) => a.date.localeCompare(b.date)), 'ledger.csv');
  };

  return (
    <div className="space-y-6" data-testid="ledger-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to="/dashboard/finance" className="label-eyebrow text-primary">← Back</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Ledger</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={exportLedger} className="h-10 px-4 rounded-2xl bg-muted hover:bg-muted/80 label-eyebrow flex items-center gap-2" data-testid="ledger-export"><FileDown className="h-3.5 w-3.5" />Export</button>
          <button onClick={() => setOpen(true)} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid="ledger-add-expense"><Plus className="h-3.5 w-3.5" />Add Expense</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <motion.div whileHover={{ y: -4 }} className="glass-morphism rounded-[2rem] p-5"><div className="label-eyebrow text-emerald-500">Total Income</div><div className="font-display font-black text-3xl tracking-tighter mt-1">{formatCurrency(incomeTotal)}</div><div className="label-eyebrow text-muted-foreground mt-1">{txs.length} transactions</div></motion.div>
        <motion.div whileHover={{ y: -4 }} className="glass-morphism rounded-[2rem] p-5"><div className="label-eyebrow text-rose-500">Total Expense</div><div className="font-display font-black text-3xl tracking-tighter mt-1">{formatCurrency(expenseTotal)}</div><div className="label-eyebrow text-muted-foreground mt-1">{expenses.length} entries</div></motion.div>
        <motion.div whileHover={{ y: -4 }} className={`glass-morphism rounded-[2rem] p-5 ${net >= 0 ? '' : 'border-rose-500/30'}`}><div className="label-eyebrow text-primary">Net Balance</div><div className={`font-display font-black text-3xl tracking-tighter mt-1 ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(net)}</div></motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-morphism rounded-[2rem] p-5">
          <div className="label-eyebrow text-muted-foreground mb-4">Monthly Income vs Expense</div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 14 }} formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="income" fill="#10b981" radius={[10,10,0,0]} />
                <Bar dataKey="expense" fill="#ef4444" radius={[10,10,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-morphism rounded-[2rem] p-5">
          <div className="label-eyebrow text-muted-foreground mb-4">Expense Category</div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="value" innerRadius={54} outerRadius={90} paddingAngle={3}>
                  {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 14 }} formatter={(v) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
        <table className="w-full">
          <thead><tr>{['Date', 'Type', 'Category', 'Description', 'Amount'].map((h) => <th key={h} className="label-eyebrow text-muted-foreground text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {[...txs.map((t) => ({ id: t.id, date: t.paymentDate?.slice(0,10), type: 'INCOME', category: t.feeName, description: t.studentName, amount: t.amount })),
              ...expenses.map((e) => ({ id: e.id, date: e.date, type: 'EXPENSE', category: e.category, description: e.description, amount: e.amount }))]
              .sort((a, b) => String(b.date).localeCompare(String(a.date)))
              .map((r) => (
                <tr key={r.id} className="border-t border-border" data-testid={`ledger-row-${r.id}`}>
                  <td className="px-3 py-2.5 text-sm">{r.date}</td>
                  <td className="px-3 py-2.5">{r.type === 'INCOME' ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 label-eyebrow flex items-center gap-1 w-fit"><TrendingUp className="h-3 w-3" />Income</span> : <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 label-eyebrow flex items-center gap-1 w-fit"><TrendingDown className="h-3 w-3" />Expense</span>}</td>
                  <td className="px-3 py-2.5 text-sm font-bold">{r.category}</td>
                  <td className="px-3 py-2.5 text-sm">{r.description}</td>
                  <td className={`px-3 py-2.5 font-display font-black tracking-tighter ${r.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{r.type === 'INCOME' ? '+' : '−'}{formatCurrency(r.amount)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-[2rem] p-6 w-full max-w-md border border-border">
            <div className="flex items-center justify-between mb-4"><div className="font-display font-black text-xl tracking-tighter">Add Expense</div><button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-muted"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="exp-date" />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="exp-category">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm" data-testid="exp-desc" />
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount (₹)" className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm" data-testid="exp-amount" />
              <input value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })} placeholder="Paid By" className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm" />
              <button onClick={addExpense} className="w-full h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow" data-testid="exp-save">Add Expense</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
