import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Send, Search } from 'lucide-react';
import { demoStore } from '../services/demoStore';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function TeacherMessaging() {
  const { profile, user } = useAuth();
  const me = user?.email || profile?.email || 'admin@demo.school';
  const myName = profile?.fullName || 'Me';

  const employees = demoStore.list('employees');
  const parents = [
    { email: 'parent@demo.school', fullName: 'Priya Iyer' },
  ];

  const contacts = profile?.role === 'PARENT'
    ? [{ email: 'admin@demo.school', fullName: 'Asha Reddy' }, ...employees.map((e) => ({ email: `${e.fullName.split(' ')[0].toLowerCase()}@demo.school`, fullName: e.fullName }))]
    : parents;

  const [active, setActive] = useState(contacts[0]);
  const [messages, setMessages] = useState(demoStore.list('messages'));
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const scrollerRef = useRef(null);

  const refresh = () => setMessages(demoStore.list('messages'));
  const thread = messages.filter((m) =>
    (m.from === me && m.to === active?.email) || (m.from === active?.email && m.to === me)
  ).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [thread.length]);

  const send = () => {
    if (!text.trim() || !active) return;
    demoStore.add('messages', {
      from: me, fromName: myName, to: active.email, toName: active.fullName,
      message: text.trim(), read: false, timestamp: new Date().toISOString(),
    });
    setText('');
    refresh();
    toast.success('Sent');
  };

  const filteredContacts = contacts.filter((c) => !q || c.fullName.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5" data-testid="teacher-messaging">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Teacher Messaging</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
        {/* Contacts list */}
        <div className="glass-morphism rounded-[2rem] p-3 flex flex-col">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-2xl border border-border bg-card mb-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent outline-none text-sm" data-testid="tm-search" />
          </div>
          <div className="flex-1 overflow-y-auto thin-scrollbar space-y-1">
            {filteredContacts.map((c) => {
              const unread = messages.filter((m) => m.from === c.email && m.to === me && !m.read).length;
              return (
                <button key={c.email} onClick={() => setActive(c)} className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 ${active?.email === c.email ? 'bg-primary/5 border border-primary/30' : 'hover:bg-muted/30'}`} data-testid={`tm-contact-${c.email}`}>
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black">{c.fullName[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{c.fullName}</div>
                    <div className="label-eyebrow text-muted-foreground truncate">{c.email}</div>
                  </div>
                  {unread > 0 && <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground label-eyebrow">{unread}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Thread */}
        <div className="lg:col-span-3 glass-morphism rounded-[2rem] flex flex-col">
          {active ? (
            <>
              <div className="px-5 py-3 border-b border-border flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black">{active.fullName[0]}</div>
                <div>
                  <div className="font-bold">{active.fullName}</div>
                  <div className="label-eyebrow text-muted-foreground">{active.email}</div>
                </div>
              </div>
              <div ref={scrollerRef} className="flex-1 overflow-y-auto thin-scrollbar p-5 space-y-3" data-testid="tm-thread">
                {thread.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">No messages yet — say hi!</div>}
                {thread.map((m, i) => {
                  const mine = m.from === me;
                  return (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`} data-testid={`tm-msg-${m.id}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-3xl ${mine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                        <div className="text-sm">{m.message}</div>
                        <div className={`label-eyebrow mt-1 ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="p-4 border-t border-border flex items-center gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type a message…" className="flex-1 h-11 px-4 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary" data-testid="tm-input" />
                <button onClick={send} className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center" data-testid="tm-send"><Send className="h-4 w-4" /></button>
              </div>
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Select a contact to start chatting</div>
          )}
        </div>
      </div>
    </div>
  );
}
