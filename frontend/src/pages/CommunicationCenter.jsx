import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, MessageSquare, Send, Loader2, Trash2, Users } from 'lucide-react';
import {
  listAnnouncements, addAnnouncement, deleteAnnouncement,
  sendMessage, subscribeMessages,
} from '../services/firebase/communicationService';
import { listEmployees } from '../services/firebase/employeesService';
import { listStudents } from '../services/firebase/studentsService';
import { listClasses } from '../services/firebase/academicService';
import { addNotification } from '../services/firebase/notificationsService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getCurrentAcademicYear } from '../utils';

const TARGET_ROLES = ['ALL', 'STAFF', 'PARENT', 'STUDENT'];

// Admin always uses the hardcoded ID 'admin' — they have no Firestore employee doc
const ADMIN_SENDER_ID = 'admin';

export default function CommunicationCenter() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('announce');

  // ── Announcements ──────────────────────────────────────────────────────────
  const [annList, setAnnList] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [annForm, setAnnForm] = useState({ title: '', description: '', targetRole: 'ALL', targetClass: '', targetSection: '' });
  const [classes, setClasses] = useState([]);
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());

  useEffect(() => {
    listAnnouncements().then((data) => { setAnnList(data); setAnnLoading(false); });
    listClasses().then(setClasses);
  }, []);

  const publishAnn = async () => {
    if (!annForm.title) return toast.error('Title required');
    setSending(true);
    try {
      const row = await addAnnouncement({ ...annForm, academicYear, postedBy: profile?.fullName || 'Admin' });
      if (row) {
        setAnnList((l) => [row, ...l]);
        
        // If targeted at PARENT, send individual notifications to parents of those students
        // If targeted at PARENT or STUDENT, send individual notifications
        if (annForm.targetRole === 'PARENT' || annForm.targetRole === 'STUDENT') {
          const allStudents = await listStudents({ status: 'ACTIVE', academicYear });
          const targetStudents = allStudents.filter(s => 
            (!annForm.targetClass || s.className === annForm.targetClass) &&
            (!annForm.targetSection || s.section === annForm.targetSection)
          );
          
          // Send notification to each matching student (parent sees it when logged in with this context)
          await Promise.all(targetStudents.map(s => addNotification({
            userId: s.id, // Notification bound to student ID, Parent dashboard reads these
            type: 'announcement',
            title: `New announcement arrived: ${annForm.title}`,
            body: annForm.description.slice(0, 80)
          })));
        }

        setAnnForm({ title: '', description: '', targetRole: 'ALL', targetClass: '', targetSection: '' });
        toast.success('Announcement published');
      }
    } catch {
      toast.error('Failed to publish. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const removeAnn = async (id) => {
    await deleteAnnouncement(id);
    setAnnList((l) => l.filter((a) => a.id !== id));
    toast.success('Announcement deleted');
  };

  // ── Direct Messages ────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState([]);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null); // full employee object
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const bottomRef = useRef(null);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (tab === 'msg') {
      listEmployees({ status: 'ACTIVE' }).then((emps) => {
        setEmployees(emps);
        if (emps.length > 0 && !selectedEmployee) setSelectedEmployee(emps[0]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Real-time message subscription when recipient changes
  useEffect(() => {
    if (tab !== 'msg' || !selectedEmployee) return;
    setMsgLoading(true);
    setMessages([]);

    // Clean up previous subscription
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }

    // Admin's ID is 'admin', selected employee's ID is their Firestore doc ID
    const recipientId = selectedEmployee.id;
    unsubRef.current = subscribeMessages(ADMIN_SENDER_ID, recipientId, (msgs) => {
      setMessages(msgs);
      setMsgLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } };
  }, [tab, selectedEmployee?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMsg = async () => {
    if (!msgText.trim()) return;
    if (!selectedEmployee) return toast.error('Select a recipient');
    setMsgSending(true);
    try {
      const row = await sendMessage({
        senderId: ADMIN_SENDER_ID,
        senderName: profile?.fullName || 'Admin',
        recipientId: selectedEmployee.id,       // Firestore employee doc ID
        recipientName: selectedEmployee.fullName || 'Staff',
        text: msgText.trim(),
      });
      if (row) {
        setMsgText('');
        // Send notification to staff member
        await addNotification({
          userId: selectedEmployee.id,    // staff's Firestore doc ID
          type: 'message',
          title: `New message from Admin`,
          body: msgText.trim().slice(0, 80),
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch {
      toast.error('Failed to send message.');
    } finally {
      setMsgSending(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="communication-center">
      <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">Communication</h1>
      <div className="flex bg-muted rounded-full p-1 w-fit">
        <button onClick={() => setTab('announce')} data-testid="tab-announce"
          className={`px-4 py-1.5 rounded-full label-eyebrow transition-colors ${tab === 'announce' ? 'bg-background shadow' : 'text-muted-foreground'}`}>
          <Megaphone className="h-3.5 w-3.5 inline mr-1.5" />Announcements
        </button>
        <button onClick={() => setTab('msg')} data-testid="tab-msg"
          className={`px-4 py-1.5 rounded-full label-eyebrow transition-colors ${tab === 'msg' ? 'bg-background shadow' : 'text-muted-foreground'}`}>
          <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" />Direct Messages
        </button>
      </div>

      {tab === 'announce' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Posted announcements */}
          <div className="lg:col-span-2 glass-morphism rounded-[2rem] p-5">
            <div className="label-eyebrow text-muted-foreground mb-3">Posted Announcements</div>
            {annLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
            <div className="space-y-3">
              {annList.map((a) => (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={a.id}
                  className="p-4 rounded-2xl border border-border">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div className="font-bold">{a.title}</div>
                        <span className="label-eyebrow bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                          {a.targetRole}
                          {a.targetClass ? ` · ${a.targetClass}${a.targetSection ? `-${a.targetSection}` : ''}` : ''}
                          {a.targetRole === 'PARENT' || a.targetRole === 'STUDENT' ? ` (${academicYear})` : ''}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{a.description}</p>
                      <div className="label-eyebrow text-muted-foreground mt-2 flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        {a.postedBy || 'Admin'} · {a.date}
                      </div>
                    </div>
                    <button onClick={() => removeAnn(a.id)} className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-500 grid place-items-center hover:bg-rose-500/20 flex-shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
              {!annLoading && annList.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">No announcements yet. Compose one →</div>
              )}
            </div>
          </div>

          {/* Compose */}
          <div className="glass-morphism rounded-[2rem] p-5 space-y-3">
            <div className="label-eyebrow text-muted-foreground">Compose Announcement</div>
            <input data-testid="ann-title" value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
              placeholder="Title" className="w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary" />
            <textarea data-testid="ann-desc" value={annForm.description} onChange={(e) => setAnnForm({ ...annForm, description: e.target.value })}
              placeholder="Message body" rows={5}
              className="w-full px-4 py-2.5 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary resize-none" />
            <div>
              <label className="label-eyebrow text-muted-foreground">Target Audience</label>
              <select data-testid="ann-target" value={annForm.targetRole} onChange={(e) => setAnnForm({ ...annForm, targetRole: e.target.value, targetClass: '', targetSection: '' })}
                className="mt-1 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm">
                {TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            
            {(annForm.targetRole === 'PARENT' || annForm.targetRole === 'STUDENT') && (
              <>
                <div>
                  <label className="label-eyebrow text-muted-foreground">Academic Year</label>
                  <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="mt-1 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm">
                    <option value="2024-25">2024-25</option>
                    <option value="2025-26">2025-26</option>
                    <option value="2026-27">2026-27</option>
                    <option value="2027-28">2027-28</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-eyebrow text-muted-foreground">Class (Optional)</label>
                  <select value={annForm.targetClass} onChange={(e) => setAnnForm({ ...annForm, targetClass: e.target.value })} className="mt-1 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm">
                    <option value="">All Classes</option>
                    {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-eyebrow text-muted-foreground">Section (Optional)</label>
                  <input value={annForm.targetSection} onChange={(e) => setAnnForm({ ...annForm, targetSection: e.target.value.toUpperCase() })} placeholder="e.g. A" className="mt-1 w-full h-11 px-4 rounded-2xl border border-border bg-card text-sm uppercase" />
                </div>
                </div>
              </>
            )}

            <button onClick={publishAnn} disabled={sending} data-testid="ann-send"
              className="w-full h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center justify-center gap-2 disabled:opacity-60">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Publish
            </button>
          </div>
        </div>
      )}

      {tab === 'msg' && (
        <div className="glass-morphism rounded-[2rem] overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-4" style={{ minHeight: '500px' }}>
            {/* Recipient list */}
            <div className="border-r border-border p-4 space-y-2 overflow-y-auto">
              <div className="label-eyebrow text-muted-foreground mb-3">Staff / Recipients</div>
              {employees.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">No active employees found</div>
              )}
              {employees.map((e) => (
                <button key={e.id} onClick={() => setSelectedEmployee(e)}
                  className={`w-full text-left p-3 rounded-2xl transition-colors flex items-center gap-2 ${selectedEmployee?.id === e.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/60'}`}>
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-xs flex-shrink-0">
                    {(e.fullName || 'U')[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{e.fullName}</div>
                    <div className="label-eyebrow text-muted-foreground truncate">{e.department || e.role || ''}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Chat area */}
            <div className="md:col-span-3 flex flex-col">
              <div className="p-4 border-b border-border label-eyebrow text-muted-foreground">
                {selectedEmployee
                  ? `Chat with: ${selectedEmployee.fullName}`
                  : 'Select a recipient'}
              </div>
              <div className="flex-1 p-4 space-y-3 overflow-y-auto" style={{ maxHeight: '380px' }}>
                {msgLoading && <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>}
                {!msgLoading && messages.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-10">No messages yet. Start the conversation.</div>
                )}
                {messages.map((m) => {
                  const isMe = m.senderId === ADMIN_SENDER_ID;
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                        {!isMe && <div className="label-eyebrow mb-1 opacity-70">{m.senderName}</div>}
                        <div>{m.text || m.body}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="p-4 border-t border-border flex gap-2">
                <input
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMsg()}
                  placeholder={selectedEmployee ? `Message ${selectedEmployee.fullName}…` : 'Select a recipient first'}
                  disabled={!selectedEmployee}
                  className="flex-1 h-10 px-4 rounded-2xl border border-border bg-card text-sm outline-none focus:border-primary disabled:opacity-50"
                />
                <button onClick={sendMsg} disabled={msgSending || !msgText.trim() || !selectedEmployee}
                  className="h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60 flex items-center gap-1.5">
                  {msgSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
