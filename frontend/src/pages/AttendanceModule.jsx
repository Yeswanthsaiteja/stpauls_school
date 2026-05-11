import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { CalendarCheck, UserCog, BedDouble } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AttendanceModule() {
  const navigate = useNavigate();
  const data = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => ({ day: d, present: 86 + Math.round(Math.cos(i)*4 + Math.random()*6), absent: 6 + Math.round(Math.random()*4) }));
  const cards = [
    { icon: CalendarCheck, label: 'Student Attendance (Manual)', sub: 'Daily P/A/L', color: 'from-indigo-500 to-violet-500', to: '/dashboard/student-attendance' },
    { icon: UserCog, label: 'RFID Upload', sub: 'CSV bulk + WhatsApp', color: 'from-fuchsia-500 to-purple-500', to: '/dashboard/rfid-attendance' },
    { icon: BedDouble, label: 'Leave Management', sub: 'Apply · approve', color: 'from-amber-500 to-orange-500', to: '/dashboard/leave-management' },
  ];
  return (
    <div className="space-y-6" data-testid="attendance-module">
      <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter uppercase">Attendance Protocols</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <motion.button key={i} onClick={() => c.to !== '#' && navigate(c.to)} whileHover={{ y: -5, scale: 1.02 }} className="glass-morphism rounded-[2rem] p-5 text-left" data-testid={`att-card-${i}`}>
            <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${c.color} grid place-items-center text-white`}><c.icon className="h-5 w-5" /></div>
            <div className="mt-4 font-bold">{c.label}</div>
            <div className="label-eyebrow text-muted-foreground mt-1">{c.sub}</div>
          </motion.button>
        ))}
      </div>
      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="label-eyebrow text-muted-foreground mb-4">Engagement Metrics · 7 days</div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 14 }} />
              <Bar dataKey="present" fill="#6366f1" radius={[10,10,0,0]} />
              <Bar dataKey="absent" fill="#ef4444" radius={[10,10,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
