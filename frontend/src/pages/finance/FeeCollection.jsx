import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { Search, Save, Receipt, Download } from 'lucide-react';
import { demoStore } from '../../services/demoStore';
import { formatCurrency } from '../../lib/utils';
import { downloadElementAsPDF, nextReceiptNo } from '../../lib/pdfUtils';
import { useTenant } from '../../contexts/TenantContext';
import { toast } from 'sonner';

const MODES = ['Cash', 'Online', 'Cheque', 'DD', 'Razorpay'];

export default function FeeCollection() {
  const { studentId } = useParams();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const students = demoStore.list('students');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(students.find((s) => s.id === studentId) || null);
  const [form, setForm] = useState({ feeName: 'Tuition Fee - Term 2', amount: 18500, mode: 'Online', chequeNo: '', bank: '', remarks: '' });
  const [lastReceipt, setLastReceipt] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const matches = q ? students.filter((s) => `${s.fullName} ${s.admissionNo}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const studentTx = picked ? demoStore.list('transactions').filter((t) => t.studentId === picked.id) : [];

  const collect = () => {
    if (!picked) return toast.error('Pick a student');
    if (!form.amount) return toast.error('Enter amount');
    const receiptNo = nextReceiptNo(demoStore.list('transactions'));
    const row = demoStore.add('transactions', {
      studentId: picked.id, studentName: picked.fullName,
      feeName: form.feeName, amount: Number(form.amount),
      paymentDate: new Date().toISOString(), paymentMethod: form.mode.toUpperCase(),
      receiptNo, status: 'PAID', remarks: form.remarks,
      chequeNo: form.chequeNo, bank: form.bank,
    });
    setLastReceipt(row);
    toast.success(`Payment received · ${receiptNo}`);
  };

  const downloadReceipt = async () => {
    if (!lastReceipt) return;
    await downloadElementAsPDF('receipt-preview', `${lastReceipt.receiptNo}.pdf`);
  };

  return (
    <div className="space-y-6" data-testid="fee-collection">
      <NavLink to="/dashboard/finance" className="label-eyebrow text-primary">← Back to Finance</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Fee Collection</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Picker + Form */}
        <div className="lg:col-span-2 space-y-4">
          {!picked && (
            <div className="glass-morphism rounded-[2rem] p-5">
              <label className="label-eyebrow text-muted-foreground">Find Student</label>
              <div className="mt-1.5 flex items-center gap-2 px-3 h-11 rounded-2xl border border-border bg-card">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or admission number…" className="flex-1 bg-transparent outline-none text-sm" data-testid="fee-search" />
              </div>
              <div className="mt-3 space-y-2">
                {matches.map((s) => (
                  <button key={s.id} onClick={() => setPicked(s)} className="w-full text-left p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 flex items-center gap-3" data-testid={`fee-pick-${s.id}`}>
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-sm">{s.firstName[0]}</div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">{s.fullName}</div>
                      <div className="label-eyebrow text-muted-foreground">{s.admissionNo} · {s.className}-{s.section}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {picked && (
            <>
              <div className="glass-morphism rounded-[2rem] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="label-eyebrow text-muted-foreground">Selected Student</div>
                    <div className="font-display font-black text-2xl tracking-tighter mt-1">{picked.fullName}</div>
                    <div className="label-eyebrow text-muted-foreground mt-0.5">{picked.admissionNo} · {picked.className}-{picked.section}</div>
                  </div>
                  <button onClick={() => { setPicked(null); setLastReceipt(null); }} className="label-eyebrow text-primary">Change</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                  <div className="col-span-full">
                    <label className="label-eyebrow text-muted-foreground">Fee Description</label>
                    <input value={form.feeName} onChange={(e) => set('feeName', e.target.value)} className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm" data-testid="fee-name" />
                  </div>
                  <div>
                    <label className="label-eyebrow text-muted-foreground">Amount (₹)</label>
                    <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm" data-testid="fee-amount" />
                  </div>
                  <div>
                    <label className="label-eyebrow text-muted-foreground">Payment Mode</label>
                    <select value={form.mode} onChange={(e) => set('mode', e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="fee-mode">
                      {MODES.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  {form.mode === 'Cheque' && (
                    <>
                      <div><label className="label-eyebrow text-muted-foreground">Cheque No.</label><input value={form.chequeNo} onChange={(e) => set('chequeNo', e.target.value)} className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm" data-testid="fee-cheque" /></div>
                      <div><label className="label-eyebrow text-muted-foreground">Bank</label><input value={form.bank} onChange={(e) => set('bank', e.target.value)} className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm" data-testid="fee-bank" /></div>
                    </>
                  )}
                  <div className="col-span-full">
                    <label className="label-eyebrow text-muted-foreground">Remarks</label>
                    <input value={form.remarks} onChange={(e) => set('remarks', e.target.value)} className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm" />
                  </div>
                </div>
                <button onClick={collect} className="mt-5 h-11 px-5 rounded-2xl bg-emerald-500 text-white label-eyebrow flex items-center gap-2" data-testid="fee-collect">
                  <Save className="h-3.5 w-3.5" />Collect Payment · {formatCurrency(form.amount || 0)}
                </button>
              </div>

              <div className="glass-morphism rounded-[2rem] p-5">
                <div className="label-eyebrow text-muted-foreground mb-3">Fee History</div>
                <div className="space-y-2">
                  {studentTx.length === 0 && <div className="text-sm text-muted-foreground text-center py-2">No prior payments</div>}
                  {studentTx.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-2xl border border-border">
                      <div>
                        <div className="font-bold text-sm">{t.feeName}</div>
                        <div className="label-eyebrow text-muted-foreground">{t.receiptNo} · {t.paymentMethod}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-black tracking-tighter">{formatCurrency(t.amount)}</div>
                        <span className={`px-2 py-0.5 rounded-full label-eyebrow ${t.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{t.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Receipt preview */}
        <div>
          <div className="label-eyebrow text-muted-foreground mb-2">Receipt Preview</div>
          <motion.div id="receipt-preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white text-slate-900 rounded-[2rem] p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white grid place-items-center"><Receipt className="h-5 w-5" /></div>
                <div>
                  <div className="font-display font-black text-lg tracking-tight">{tenant?.name || 'School'}</div>
                  <div className="text-[10px] text-slate-500">Fee Receipt</div>
                </div>
              </div>
              <div className="text-right text-[10px]">
                <div className="font-mono font-bold">{lastReceipt?.receiptNo || '—'}</div>
                <div className="text-slate-500">{new Date(lastReceipt?.paymentDate || Date.now()).toLocaleDateString('en-IN')}</div>
              </div>
            </div>
            <div className="mt-4 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Student</span><span className="font-bold">{picked?.fullName || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Admission No.</span><span className="font-mono font-bold">{picked?.admissionNo || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Class</span><span className="font-bold">{picked?.className}-{picked?.section}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Fee</span><span className="font-bold">{lastReceipt?.feeName || form.feeName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Mode</span><span className="font-bold">{lastReceipt?.paymentMethod || form.mode}</span></div>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-indigo-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">Amount Paid</span>
              <span className="font-display font-black text-2xl tracking-tighter text-indigo-700">{formatCurrency(lastReceipt?.amount || form.amount)}</span>
            </div>
            <div className="mt-3 text-[10px] text-slate-500">Amount in words: <span className="italic">{numberToWords(Number(lastReceipt?.amount || form.amount))} only</span></div>
            <div className="mt-6 flex items-end justify-between text-[10px] text-slate-500">
              <span>Cashier · Admin</span>
              <span>Authorised Signatory</span>
            </div>
          </motion.div>
          {lastReceipt && (
            <button onClick={downloadReceipt} className="mt-3 w-full h-10 rounded-2xl bg-foreground text-background label-eyebrow flex items-center justify-center gap-2" data-testid="fee-download-receipt">
              <Download className="h-3.5 w-3.5" />Download Receipt PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple number-to-words for receipt
function numberToWords(num) {
  if (!num || isNaN(num)) return 'Zero rupees';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  };
  return `${inWords(Math.floor(num))} rupees`;
}
