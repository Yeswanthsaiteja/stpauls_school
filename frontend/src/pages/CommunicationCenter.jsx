import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, MessageSquare, Send } from 'lucide-react';
import { demoStore } from '../services/demoStore';
import { toast } from 'sonner';

export default function CommunicationCenter() {
  const [tab, setTab] = useState('announce');
  const [list, setList] = useState(demoStore.list('announcements'));
  const [form, setForm] = useState({ title: '', description: '', targetRole: 'ALL' });

  const send = () => {
    if (!form.title) return toast.error('Title required');
    const row = demoStore.add('announcements', { ...form, date: new Date().toISOString(), postedBy: 'Admin' });
    setList((l) => [row, ...l]);
    setForm({ title: '', description: '', targetRole: 'ALL' });
    toast.success('Announcement sent');
  };

  return (
    <div className="space-y-6" data-testid="communication-center">
      <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">Communication</h1>
      <div className="flex bg-muted rounded-full p-1 w-fit">
        <button onClick={() => setTab('announce')} data-testid="tab-announce" className={`px-4 py-1.5 rounded-full label-eyebrow ${tab === 'announce' ? 'bg-background shadow' : 'text-muted-foreground'}`}>
          <Megaphone className="h-3.5 w-3.5 inline mr-1.5" />Announcements
        </button>
        <button onClick={() => setTab('msg')} data-testid="tab-msg" className={`px-4 py-1.5 rounded-full label-eyebrow ${tab === 'msg' ? 'bg-background shadow' : 'text-muted-foreground'}`}>
          <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" />Direct Messages
        </button>
      </div>

      {tab === 'announce' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 glass-morphism rounded-[2rem] p-5">
            <div className="label-eyebrow text-muted-foreground mb-3">Posted</div>
            <div className="space-y-3">
              {list.map((a) => (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={a.id} className="p-4 rounded-2xl border border-border">
                  <div className="flex justify-between">
                    <div className="font-bold">{a.title}</div>
                    <span className="label-eyebrow bg-primary/10 text-primary px-2.5 py-1 rounded-full">{a.targetRole}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                  <div className="label-eyebrow text-muted-foreground mt-2">{new Date(a.date).toLocaleString()}</div>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="glass-morphism rounded-[2rem] p-5">
            <div className="label-eyebrow text-muted-foreground mb-3">Compose</div>
            <input data-testid="ann-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary" />
            <textarea data-testid="ann-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Message" rows={4} className="mt-3 w-full px-4 py-2.5 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary" />
            <select data-testid="ann-target" value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })} className="mt-3 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm">
              <option>ALL</option><option>STAFF</option><option>PARENT</option><option>STUDENT</option>
            </select>
            <button onClick={send} data-testid="ann-send" className="mt-3 w-full h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center justify-center gap-2">
              <Send className="h-3.5 w-3.5" /> Publish
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-morphism rounded-[2rem] p-8 text-center text-sm text-muted-foreground">Direct Messages — feature scaffold in place.</div>
      )}
    </div>
  );
}
