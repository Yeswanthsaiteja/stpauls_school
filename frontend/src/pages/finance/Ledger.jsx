import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { TrendingUp, TrendingDown, Plus, X, FileDown, RefreshCw } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { listTransactions, listExpenses, addExpense as addExpenseFS } from '../../services/firebase/financeService';
import { getStudent } from '../../services/firebase/studentsService';
import { formatCurrency, exportToCSV } from '../../lib/utils';
import { downloadElementAsPDF } from '../../lib/pdfUtils';
import { toast } from 'sonner';
import { useTenant } from '../../contexts/TenantContext';

const CATEGORIES = ['Rent', 'Utilities', 'Maintenance', 'Salaries', 'Supplies', 'Events', 'Other'];
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#94a3b8'];

export default function Ledger() {
  const { tenant } = useTenant();
  const [expenses, setExpenses] = useState([]);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), category: 'Utilities', description: '', amount: 0, paidBy: 'Accountant' });
  const [filterDate, setFilterDate] = useState('');
  const [receiptToDownload, setReceiptToDownload] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [txData, expData] = await Promise.all([listTransactions(), listExpenses()]);
    setTxs(txData.filter((t) => t.status === 'PAID'));
    setExpenses(expData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addExpenseHandler = async () => {
    if (!form.description) return toast.error('Description required');
    if (saving) return; setSaving(true);
    const row = await addExpenseFS({ ...form, amount: Number(form.amount) });
    if (row) {
      setExpenses((e) => [row, ...e]);
      setOpen(false);
      setForm({ date: new Date().toISOString().slice(0, 10), category: 'Utilities', description: '', amount: 0, paidBy: 'Accountant' });
      toast.success('Expense saved to Firestore');
    } else {
      toast.error('Failed to save expense. Please check permissions.');
    }
    setSaving(false);
  };

  const filteredTxs = useMemo(() => {
    if (!filterDate) return txs;
    return txs.filter(t => (t.paymentDate || '').slice(0, 10) === filterDate);
  }, [txs, filterDate]);

  const filteredExpenses = useMemo(() => {
    if (!filterDate) return expenses;
    return expenses.filter(e => e.date === filterDate);
  }, [expenses, filterDate]);

  const incomeTotal = filteredTxs.reduce((s, t) => s + t.amount, 0);
  const expenseTotal = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const net = incomeTotal - expenseTotal;

  const exportLedger = () => {
    const incomes = filteredTxs.map((t) => ({ date: t.paymentDate?.slice(0,10), type: 'INCOME', category: t.feeName, description: t.studentName, amount: t.amount }));
    const exps = filteredExpenses.map((e) => ({ date: e.date, type: 'EXPENSE', category: e.category, description: e.description, amount: -e.amount }));
    exportToCSV([...incomes, ...exps].sort((a, b) => a.date.localeCompare(b.date)), 'ledger.csv');
  };

  return (
    <div className="space-y-6" data-testid="ledger-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to="/dashboard/finance" className="label-eyebrow text-primary">← Back</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Ledger</h1>
        </div>
        <div className="flex gap-3 items-center flex-wrap bg-card border border-border p-2 rounded-2xl">
          <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-1">
            <span className="label-eyebrow text-muted-foreground whitespace-nowrap">Select Date:</span>
            <input 
              type="date" 
              value={filterDate} 
              onChange={e => setFilterDate(e.target.value)} 
              className="h-9 bg-transparent border-none text-sm outline-none font-bold dark:[color-scheme:dark] dark:text-white" 
              title="Filter by Date Calendar"
            />
          </div>
          {filterDate && (
            <button onClick={() => setFilterDate('')} className="h-9 px-3 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 label-eyebrow flex items-center gap-1 transition-colors">
              Clear Date
            </button>
          )}
          <div className="flex-1"></div>
          <button onClick={load} className="h-10 w-10 rounded-xl bg-muted hover:bg-muted/80 grid place-items-center transition-colors" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={exportLedger} className="h-10 px-4 rounded-xl bg-muted hover:bg-muted/80 label-eyebrow flex items-center gap-2 transition-colors" data-testid="ledger-export"><FileDown className="h-3.5 w-3.5" />Export CSV</button>
          <button onClick={() => setOpen(true)} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2 transition-colors shadow-lg shadow-primary/20" data-testid="ledger-add-expense"><Plus className="h-3.5 w-3.5" />Add Expense</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <motion.div whileHover={{ y: -4 }} className="glass-morphism rounded-[2rem] p-5">
          <div className="label-eyebrow text-emerald-500">{filterDate ? `Income on ${new Date(filterDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Total Income'}</div>
          <div className="font-display font-black text-3xl tracking-tighter mt-1">{formatCurrency(incomeTotal)}</div>
          <div className="label-eyebrow text-muted-foreground mt-1">{filteredTxs.length} transactions</div>
        </motion.div>
        <motion.div whileHover={{ y: -4 }} className="glass-morphism rounded-[2rem] p-5">
          <div className="label-eyebrow text-rose-500">{filterDate ? `Expense on ${new Date(filterDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Total Expense'}</div>
          <div className="font-display font-black text-3xl tracking-tighter mt-1">{formatCurrency(expenseTotal)}</div>
          <div className="label-eyebrow text-muted-foreground mt-1">{filteredExpenses.length} entries</div>
        </motion.div>
        <motion.div whileHover={{ y: -4 }} className={`glass-morphism rounded-[2rem] p-5 ${net >= 0 ? '' : 'border-rose-500/30'}`}>
          <div className="label-eyebrow text-primary">{filterDate ? 'Net for Date' : 'Net Balance'}</div>
          <div className={`font-display font-black text-3xl tracking-tighter mt-1 ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(net)}</div>
        </motion.div>
      </div>



      <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
        <table className="w-full">
          <thead><tr>{['Date', 'Type', 'Category', 'Description', 'Amount', 'Receipt / Bill'].map((h) => <th key={h} className={`label-eyebrow text-muted-foreground px-3 py-2 ${h === 'Receipt / Bill' || h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
          <tbody>
            {[...filteredTxs.map((t) => ({ ...t, _rowId: t.id, date: t.paymentDate?.slice(0,10), type: 'INCOME', category: t.feeName, description: t.studentName, amount: t.amount })),
              ...filteredExpenses.map((e) => ({ ...e, _rowId: e.id, date: e.date, type: 'EXPENSE', category: e.category, description: e.description, amount: e.amount }))]
              .sort((a, b) => String(b.date).localeCompare(String(a.date)))
              .map((r) => (
                <tr key={r._rowId} className="border-t border-border" data-testid={`ledger-row-${r._rowId}`}>
                  <td className="px-3 py-2.5 text-sm">{r.date}</td>
                  <td className="px-3 py-2.5">{r.type === 'INCOME' ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 label-eyebrow flex items-center gap-1 w-fit"><TrendingUp className="h-3 w-3" />Income</span> : <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 label-eyebrow flex items-center gap-1 w-fit"><TrendingDown className="h-3 w-3" />Expense</span>}</td>
                  <td className="px-3 py-2.5 text-sm font-bold">{r.category}</td>
                  <td className="px-3 py-2.5 text-sm">{r.description}</td>
                  <td className={`px-3 py-2.5 font-display font-black tracking-tighter ${r.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{r.type === 'INCOME' ? '+' : '−'}{formatCurrency(r.amount)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {r.type === 'INCOME' && (
                      <button 
                        onClick={async () => {
                          let receiptData = { ...r };
                          if (!receiptData.fatherName || !receiptData.className) {
                            const student = await getStudent(r.studentId);
                            if (student) {
                              receiptData.fatherName = student.fatherName || student.parentName || receiptData.fatherName || '';
                              receiptData.className = student.className || receiptData.className || '';
                              receiptData.section = student.section || receiptData.section || '';
                              receiptData.admissionNo = student.admissionNo || receiptData.admissionNo || '';
                              receiptData.studentName = student.fullName || receiptData.studentName || '';
                            }
                          }
                          setReceiptToDownload(receiptData);
                          setTimeout(() => {
                            downloadElementAsPDF('ledger-receipt-preview', `${receiptData.receiptNo || receiptData._rowId}.pdf`).then(() => setReceiptToDownload(null));
                          }, 100);
                        }} 
                        className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors"
                        title="Download Receipt"
                      >
                        <FileDown className="h-4 w-4" />
                      </button>
                    )}
                  </td>
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
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm dark:[color-scheme:dark] dark:text-white" data-testid="exp-date" />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-11 px-3 rounded-2xl border border-border bg-background text-sm" data-testid="exp-category">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm" data-testid="exp-desc" />
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount (₹)" className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm" data-testid="exp-amount" />
              <input value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })} placeholder="Paid By" className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-sm" />
              <button onClick={addExpenseHandler} disabled={saving} className="w-full h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60" data-testid="exp-save">{saving ? 'Saving…' : 'Add Expense'}</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* HIDDEN RECEIPT TEMPLATE FOR DOWNLOADING */}
      {receiptToDownload && (
        <div className="absolute left-[-9999px] top-[-9999px]">
          <div id="ledger-receipt-preview" className="bg-white text-slate-900 p-6 w-[400px]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                  <span className="font-bold">R</span>
                </div>
                <div>
                  <div className="font-display font-black text-lg tracking-tight">{tenant?.name || 'School'}</div>
                  <div className="text-[10px] text-slate-500">Fee Receipt</div>
                </div>
              </div>
              <div className="text-right text-[10px]">
                <div className="font-mono font-bold">{receiptToDownload.receiptNo || '—'}</div>
                <div className="text-slate-500">{new Date(receiptToDownload.paymentDate || Date.now()).toLocaleDateString('en-IN')}</div>
              </div>
            </div>
            <div className="mt-4 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Student</span><span className="font-bold">{receiptToDownload.studentName || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Father's Name</span><span className="font-bold">{receiptToDownload.fatherName || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Admission No.</span><span className="font-mono font-bold">{receiptToDownload.admissionNo || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Class</span><span className="font-bold">{receiptToDownload.className}-{receiptToDownload.section}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Category</span><span className="font-bold">{receiptToDownload.feeName || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Mode</span><span className="font-bold">{receiptToDownload.paymentMethod || 'Online'}</span></div>
            </div>
            {receiptToDownload.termAllocations && receiptToDownload.termAllocations.length > 0 && (
              <div className="mt-3 pt-2 border-t border-slate-100 space-y-1">
                {receiptToDownload.termAllocations.map((a, i) => (
                  <div key={i} className="flex justify-between text-[10px]">
                    <span className="text-slate-500">{a.termName}</span>
                    <span className="font-bold">{formatCurrency(a.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 p-3 rounded-xl bg-indigo-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">Amount Paid</span>
              <span className="font-display font-black text-2xl tracking-tighter text-indigo-700">{formatCurrency(receiptToDownload.amount || 0)}</span>
            </div>
            <div className="mt-6 flex items-end justify-between text-[10px] text-slate-500">
              <span>Cashier · Admin</span>
              <span>Authorised Signatory</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
