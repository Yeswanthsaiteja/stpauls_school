import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Send, Search, RefreshCw } from 'lucide-react';
import { listEmployees } from '../services/firebase/employeesService';
import { listMessages, sendMessage } from '../services/firebase/communicationService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function TeacherMessaging() {
  const { profile, user } = useAuth();
  const me = user?.uid || profile?.uid || 'admin';
  const myName = profile?.fullName || 'Admin';

  const [employees, setEmployees] = useState([]);
  const [messages, setMessages] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [emps, msgs] = await Promise.all([listEmployees(), listMessages()]);
    setEmployees(emps);
    setMessages(msgs);
    setActive((prev) => prev || emps[0] || null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const contacts = employees;

  const thread = messages
    .filter((m) => (m.senderId === me && m.recipientId === active?.id) || (m.senderId === active?.id && m.recipientId === me))
    .sort((a, b) => String(a.createdAt?.toMillis?.() || a.createdAt || '').localeCompare(String(b.createdAt?.toMillis?.() || b.createdAt || '')));

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [thread.length]);

  const send = async () => {
    if (!text.trim() || !active) return;
    setSending(true);
    const msg = await sendMessage({
      senderId: me, senderName: myName,
      recipientId: active.id, recipientName: active.fullName,
      message: text.trim(),
    });
    if (msg) setMessages((m) => [...m, msg]);
    setText('');
    setSending(false);
    toast.success('Message sent ✓');
  };

  const filteredContacts = contacts.filter((c) => !q || c.fullName?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5" data-testid="teacher-messaging">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Teacher Messaging</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
        {/* Contacts list */}
        <div className="glass-morphism rounded-[2rem] p-3 flex flex-col">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-2xl border border-border bg-card mb-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent outline-none text-sm" />
          </div>
          <div className="flex-1 overflow-y-auto thin-scrollbar space-y-1">
            {loading && <div className="text-center text-xs text-muted-foreground py-4">Loading…</div>}
            {filteredContacts.map((c) => {
              const unread = messages.filter((m) => m.senderId === c.id && m.recipientId === me && !m.read).length;
              return (
                <button key={c.id} onClick={() => setActive(c)} className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 ${active?.id === c.id ? 'bg-primary/5 border border-primary/30' : 'hover:bg-muted/30'}`}>
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black">{(c.fullName || '?')[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{c.fullName}</div>
                    <div className="label-eyebrow text-muted-foreground truncate">{c.department || 'Staff'}</div>
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
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Type a message…" className="flex-1 h-11 px-4 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary" />
                <button onClick={send} disabled={sending} className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center disabled:opacity-60">
                  <Send className="h-4 w-4" />
                </button>
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
