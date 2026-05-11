import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Download, Check, Plus, FileDown } from 'lucide-react';
import { demoStore } from '../../services/demoStore';
import { formatCurrency, exportToCSV } from '../../lib/utils';
import { downloadElementAsPDF } from '../../lib/pdfUtils';
import { useTenant } from '../../contexts/TenantContext';
import { toast } from 'sonner';

export default function Payroll() {
  const { tenant } = useTenant();
  const employees = demoStore.list('employees');
  const [list, setList] = useState(demoStore.list('payroll'));
  const [month, setMonth] = useState('2025-12');
  const [payslip, setPayslip] = useState(null);

  const refresh = () => setList(demoStore.list('payroll'));
  const filtered = list.filter((p) => p.month === month);
  const total = filtered.reduce((s, p) => s + p.net, 0);
  const paid = filtered.filter((p) => p.status === 'PAID').length;
  const pending = filtered.length - paid;

  const generateForMonth = () => {
    employees.forEach((e) => {
      const exists = demoStore.list('payroll').find((p) => p.month === month && p.employeeId === e.employeeId);
      if (exists) return;
      const basic = e.basicSalary || (e.role === 'Principal' ? 75000 : e.role === 'Teacher' ? 45000 : 30000);
      const hra = Math.round(basic * 0.2);
      const da = Math.round(basic * 0.1);
      const deductions = Math.round((basic + hra + da) * 0.1);
      const net = basic + hra + da - deductions;
      demoStore.add('payroll', { employeeId: e.employeeId, employeeName: e.fullName, month, basic, hra, da, deductions, net, status: 'PENDING' });
    });
    refresh();
    toast.success(`Payroll generated for ${month}`);
  };

  const togglePaid = (id, status) => { demoStore.update('payroll', id, { status }); refresh(); };

  const downloadPayslip = async (p) => {
    setPayslip(p);
    // Wait one tick for DOM to render
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
          <NavLink to="/dashboard/finance" className="label-eyebrow text-primary">← Back</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2">Payroll</h1>
        </div>
        <div className="flex gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="payroll-month" />
          <button onClick={generateForMonth} className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid="payroll-generate"><Plus className="h-3.5 w-3.5" />Generate</button>
          <button onClick={exportAll} className="h-10 px-4 rounded-2xl bg-muted hover:bg-muted/80 label-eyebrow flex items-center gap-2" data-testid="payroll-export"><FileDown className="h-3.5 w-3.5" />Export</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-muted-foreground">Records</div><div className="font-display font-black text-2xl tracking-tighter">{filtered.length}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-emerald-500">Paid</div><div className="font-display font-black text-2xl tracking-tighter">{paid}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-amber-500">Pending</div><div className="font-display font-black text-2xl tracking-tighter">{pending}</div></div>
        <div className="glass-morphism rounded-2xl p-4"><div className="label-eyebrow text-primary">Total Net</div><div className="font-display font-black text-xl tracking-tighter">{formatCurrency(total)}</div></div>
      </div>

      <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
        <table className="w-full">
          <thead><tr>{['Emp ID', 'Name', 'Basic', 'HRA', 'DA', 'Ded.', 'Net', 'Status', ''].map((h) => <th key={h} className="label-eyebrow text-muted-foreground text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-sm text-muted-foreground">No payroll for {month} · click Generate</td></tr>}
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
                  <button onClick={() => togglePaid(p.id, p.status === 'PAID' ? 'PENDING' : 'PAID')} className={`px-2.5 py-1 rounded-full label-eyebrow ${p.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`} data-testid={`pr-status-${p.id}`}>{p.status}</button>
                </td>
                <td className="px-3 py-2.5">
                  <button onClick={() => downloadPayslip(p)} className="h-9 px-3 rounded-xl bg-primary/10 text-primary label-eyebrow flex items-center gap-1.5" data-testid={`pr-payslip-${p.id}`}><Download className="h-3 w-3" />Payslip</button>
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
                <tr className="border-t border-slate-200 font-bold"><td className="py-2">Total Earnings</td><td className="text-right">{formatCurrency(payslip.basic + payslip.hra + payslip.da)}</td></tr>
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
