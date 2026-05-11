import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Check, Shield, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function RazorpaySettings() {
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [enabled, setEnabled] = useState(false);

  const save = () => {
    if (!keyId || !keySecret) return toast.error('Both keys required');
    setEnabled(true);
    toast.success('Razorpay configured (demo). Live keys would be stored in tenant config.');
  };

  const testPayment = () => {
    toast.success('Test ₹100 payment intent created. In production this opens Razorpay checkout.');
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="razorpay-settings">
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Razorpay Integration</h1>

      <motion.div whileHover={{ y: -3 }} className="relative rounded-[2rem] p-6 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white overflow-hidden">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="label-eyebrow text-white/70">Payment Gateway</div>
            <div className="font-display font-black text-3xl tracking-tighter mt-1">Razorpay</div>
            <p className="text-sm text-white/80 mt-2 max-w-md">Accept UPI, cards, wallets and net-banking. Auto-receipts to parents on success.</p>
          </div>
          <div className="h-14 w-14 rounded-3xl bg-white/15 grid place-items-center"><CreditCard className="h-6 w-6" /></div>
        </div>
        <div className="relative flex gap-2 mt-5 flex-wrap">
          {['UPI', 'Cards', 'Netbanking', 'Wallets', 'EMI'].map((t) => (
            <span key={t} className="px-3 py-1 rounded-full bg-white/15 label-eyebrow">{t}</span>
          ))}
        </div>
      </motion.div>

      <div className="glass-morphism rounded-[2rem] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label-eyebrow text-muted-foreground">API Credentials</div>
            <div className="font-display font-black text-xl tracking-tighter">Configure Keys</div>
          </div>
          <span className={`px-2.5 py-1 rounded-full label-eyebrow ${enabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
            {enabled ? <><Check className="inline h-3 w-3 mr-1" />Connected</> : 'Not Configured'}
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label-eyebrow text-muted-foreground">Key ID</label>
            <input value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="rzp_live_XXXXXXXXXX" data-testid="rzp-key-id" className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm font-mono" />
          </div>
          <div>
            <label className="label-eyebrow text-muted-foreground">Key Secret</label>
            <input value={keySecret} onChange={(e) => setKeySecret(e.target.value)} type="password" placeholder="••••••••••••••••" data-testid="rzp-key-secret" className="mt-1.5 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm font-mono" />
          </div>
          <div className="flex gap-3">
            <button onClick={save} data-testid="rzp-save" className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />Save Securely
            </button>
            <button onClick={testPayment} disabled={!enabled} data-testid="rzp-test" className="h-11 px-5 rounded-2xl bg-emerald-500 text-white label-eyebrow flex items-center gap-2 disabled:opacity-50">
              <Zap className="h-3.5 w-3.5" />Test Payment
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { l: 'Today', v: '₹42,300', c: 'text-emerald-500' },
          { l: 'This Week', v: '₹2,18,500', c: 'text-indigo-500' },
          { l: 'MTD', v: '₹8,46,200', c: 'text-fuchsia-500' },
        ].map((s, i) => (
          <div key={i} className="glass-morphism rounded-[1.75rem] p-4">
            <div className="label-eyebrow text-muted-foreground">{s.l}</div>
            <div className={`font-display font-black text-2xl tracking-tighter mt-1 ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
