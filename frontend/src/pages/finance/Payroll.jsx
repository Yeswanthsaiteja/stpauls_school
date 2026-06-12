import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Download, Plus, FileDown, X, Loader2 } from 'lucide-react';
import { listPayroll, addPayrollEntry, updatePayrollStatus } from '../../services/firebase/financeService';
import { listEmployees } from '../../services/firebase/employeesService';
import { formatCurrency, exportToCSV } from '../../lib/utils';
import { downloadElementAsPDF } from '../../lib/pdfUtils';
import { useTenant } from '../../contexts/TenantContext';
import { toast } from 'sonner';

const BLANK_FORM = { employeeId: '', employeeName: '', basic: 0, hra: 0, da: 0, deductions: 0 };

export default function Payroll() {
  const { tenant } = useTenant();
  const [employees, setEmployees] = useState([]);
  const [list, setList] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [emps, payroll] = await Promise.all([listEmployees(), listPayroll({ month })]);
    setEmployees(emps);
    setList(payroll);
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const filtered = list.filter((p) => p.month === month);
  const total = filtered.reduce((s, p) => s + (p.net || 0), 0);
  const paid = filtered.filter((p) => p.status === 'PAID').length;
  const pending = filtered.length - paid;

  const net = Number(form.basic) + Number(form.hra) + Number(form.da) - Number(form.deductions);

  const handleEmpChange = (e) => {
    const emp = employees.find((x) => x.id === e.target.value || x.employeeId === e.target.value);
    if (!emp) return setForm(f => ({ ...f, employeeId: e.target.value, employeeName: '' }));
    const basic = emp.basicSalary || (emp.designation === 'Principal' ? 75000 : emp.designation === 'Teacher' ? 45000 : 30000);
    const hra = Math.round(basic * 0.2);
    const da = Math.round(basic * 0.1);
    const deductions = Math.round((basic + hra + da) * 0.1);
    setForm({
      employeeId: emp.employeeId || emp.id,
      employeeName: emp.fullName,
      basic, hra, da, deductions,
    });
  };

  const addEntry = async (e) => {
    e.preventDefault();
    if (!form.employeeId || !form.employeeName) return toast.error('Select an employee');
    if (filtered.some((p) => p.employeeId === form.employeeId)) {
      return toast.error(`Payroll for ${form.employeeName} already exists for ${month}`);
    }
    if (saving) return; setSaving(true);
    try {
      const row = await addPayrollEntry({ ...form, basic: Number(form.basic), hra: Number(form.hra), da: Number(form.da), deductions: Number(form.deductions), net, month, status: 'PENDING' });
      if (row) {
        setList(l => [row, ...l]);
        toast.success(`Payroll entry added for ${form.employeeName}`);
      }
      setForm(BLANK_FORM);
      setShowAdd(false);
    } catch {
      toast.error('Failed to add payroll entry');
    } finally {
      setSaving(false);
    }
  };

  const togglePaid = async (id, status) => {
    const next = status === 'PAID' ? 'PENDING' : 'PAID';
    await updatePayrollStatus(id, next);
    setList(l => l.map(p => p.id === id ? { ...p, status: next } : p));
    toast.success(`Marked ${next}`);
  };

  const downloadPayslip = async (p) => {
    setPayslip(p);
    setTimeout(async () => {
      await downloadElementAsPDF('payslip-area', `Payslip_${p.employeeId}_${p.month}.pdf`);
      toast.success('Payslip downloaded');
    }, 200);
  };

  const exportAll = () => exportToCSV(filtered.map((p) => ({
    employeeId: p.employeeId, name: p.employeeName, month: p.month,
    basic: p.basic, hra: p.hra, da: p.da, deductions: p.deductions, net: p.net, status: p.status,
  })), `payroll_${month}.csv`);

  return (
    <div className="space-y-6" data-testid="payroll-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <NavLink to="/dashboard/finance" className="label-eyebrow text-primary">← Back to Finance</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Payroll</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="payroll-month" />
          <button onClick={() => setShowAdd(v => !v)}
            className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid="payroll-add">
            <Plus className="h-3.5 w-3.5" /> Add Entry
          </button>
          <button onClick={exportAll}
            className="h-10 px-4 rounded-2xl bg-muted hover:bg-muted/80 label-eyebrow flex items-center gap-2" data-testid="payroll-export">
            <FileDown className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Records</div><div className="font-display font-black text-2xl tracking-tighter">{filtered.length}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-emerald-500">Paid</div><div className="font-display font-black text-2xl tracking-tighter">{paid}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-amber-500">Pending</div><div className="font-display font-black text-2xl tracking-tighter">{pending}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-primary">Total Net</div><div className="font-display font-black text-xl tracking-tighter">{formatCurrency(total)}</div></div>
      </div>

      {/* Add Entry Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass-morphism rounded-[2rem] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display font-black text-lg tracking-tighter">Add Payroll Entry · {month}</div>
              <button onClick={() => setShowAdd(false)} className="h-8 w-8 rounded-xl bg-muted grid place-items-center"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={addEntry} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="label-eyebrow text-muted-foreground">Employee *</label>
                <select value={form.employeeId} onChange={handleEmpChange}
                  className="mt-1 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="pr-emp-select">
                  <option value="">— Select Employee —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.employeeId || e.id}>{e.fullName} · {e.designation || e.department || ''}</option>
                  ))}
                </select>
              </div>
              {[
                { label: 'Basic Salary', key: 'basic' },
                { label: 'HRA', key: 'hra' },
                { label: 'DA', key: 'da' },
                { label: 'Deductions (PF/ESI/Tax)', key: 'deductions' },
              ].map(f => (
                <div key={f.key}>
                  <label className="label-eyebrow text-muted-foreground">{f.label}</label>
                  <input type="number" value={form[f.key]} onChange={(e) => setForm(d => ({ ...d, [f.key]: e.target.value }))}
                    className="mt-1 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm" />
                </div>
              ))}
              <div className="lg:col-span-2 flex items-center gap-4">
                <div className="flex-1 rounded-2xl bg-primary/10 p-3 text-center">
                  <div className="label-eyebrow text-primary">Net Salary</div>
                  <div className="font-display font-black text-2xl tracking-tighter text-primary">{formatCurrency(net)}</div>
                </div>
                <button type="submit" disabled={saving}
                  className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60 flex items-center gap-2">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Save
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payroll table */}
      <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {['Emp ID', 'Name', 'Basic', 'HRA', 'DA', 'Deductions', 'Net', 'Status', 'Actions'].map((h) => (
                <th key={h} className="label-eyebrow text-muted-foreground text-left px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-sm text-muted-foreground">No payroll entries for {month}. Click "Add Entry" to add.</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border" data-testid={`pr-row-${p.id}`}>
                <td className="px-3 py-2.5 font-mono text-xs font-bold">{p.employeeId}</td>
                <td className="px-3 py-2.5 text-sm font-bold">{p.employeeName}</td>
                <td className="px-3 py-2.5 text-sm">{formatCurrency(p.basic)}</td>
                <td className="px-3 py-2.5 text-sm">{formatCurrency(p.hra)}</td>
                <td className="px-3 py-2.5 text-sm">{formatCurrency(p.da)}</td>
                <td className="px-3 py-2.5 text-sm text-rose-600">−{formatCurrency(p.deductions)}</td>
                <td className="px-3 py-2.5 font-display font-black tracking-tighter">{formatCurrency(p.net)}</td>
                <td className="px-3 py-2.5">
                  <button onClick={() => togglePaid(p.id, p.status)}
                    className={`px-2.5 py-1 rounded-full label-eyebrow ${p.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}
                    data-testid={`pr-status-${p.id}`}>{p.status}
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <button onClick={() => downloadPayslip(p)}
                    className="h-9 px-3 rounded-xl bg-primary/10 text-primary label-eyebrow flex items-center gap-1.5"
                    data-testid={`pr-payslip-${p.id}`}>
                    <Download className="h-3 w-3" />Payslip
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Off-screen payslip render for PDF capture */}
      {payslip && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div id="payslip-area" className="bg-white text-slate-900 p-10 rounded-3xl" style={{ width: 720 }}>
            <div className="flex items-center justify-between border-b-2 border-indigo-100 pb-4">
              <div>
                <div className="font-display font-black text-2xl tracking-tight">{tenant?.name || 'School'}</div>
                <div className="text-xs text-slate-500">Payslip · {payslip.month}</div>
              </div>
              <div className="font-mono text-xs">{payslip.employeeId}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
              <div><div className="text-xs text-slate-500">Name</div><div className="font-bold">{payslip.employeeName}</div></div>
              <div><div className="text-xs text-slate-500">Status</div><div className="font-bold">{payslip.status}</div></div>
            </div>
            <table className="w-full mt-6 text-sm">
              <thead><tr className="border-b border-slate-200"><th className="text-left py-2">Earnings</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                <tr><td className="py-1">Basic</td><td className="text-right">{formatCurrency(payslip.basic)}</td></tr>
                <tr><td className="py-1">HRA</td><td className="text-right">{formatCurrency(payslip.hra)}</td></tr>
                <tr><td className="py-1">DA</td><td className="text-right">{formatCurrency(payslip.da)}</td></tr>
                <tr className="border-t border-slate-200 font-bold"><td className="py-2">Total Earnings</td><td className="text-right">{formatCurrency((payslip.basic||0) + (payslip.hra||0) + (payslip.da||0))}</td></tr>
                <tr><td className="py-1">Deductions (PF/ESI/Tax)</td><td className="text-right text-rose-600">−{formatCurrency(payslip.deductions)}</td></tr>
              </tbody>
            </table>
            <div className="mt-6 p-4 rounded-2xl bg-indigo-50 flex items-center justify-between">
              <div className="text-sm text-slate-500">Net Salary</div>
              <div className="font-display font-black text-3xl tracking-tighter text-indigo-700">{formatCurrency(payslip.net)}</div>
            </div>
            <div className="mt-10 flex justify-between items-end text-xs text-slate-500">
              <div>Generated electronically</div>
              <div>Authorised Signatory</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
