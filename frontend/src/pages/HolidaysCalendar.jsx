import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Trash2, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { listHolidays, addHoliday, removeHoliday } from '../services/firebase/holidaysService';
import { toast } from 'sonner';

export default function HolidaysCalendar() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    name: '',
    type: 'PLANNED', // 'PLANNED' or 'SUDDEN'
  });

  const [calcMonth, setCalcMonth] = useState(new Date().getMonth());
  const [calcYear, setCalcYear] = useState(new Date().getFullYear());

  const workingDays = useMemo(() => {
    const startDate = new Date(calcYear, calcMonth, 1);
    const endDate = new Date(calcYear, calcMonth + 1, 0);
    let totalDays = endDate.getDate();
    let wd = 0;
    
    for (let day = 1; day <= totalDays; day++) {
      // Need to pad month and day for ISO string comparison (local time check)
      const mm = String(calcMonth + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${calcYear}-${mm}-${dd}`;
      
      const d = new Date(calcYear, calcMonth, day);
      const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
      
      // Sunday
      if (dayOfWeek === 0) continue;
      
      // 2nd Saturday
      if (dayOfWeek === 6 && Math.ceil(day / 7) === 2) continue;
      
      // Holiday
      if (holidays.some(h => h.date === dateStr)) continue;
      
      wd++;
    }
    return wd;
  }, [calcMonth, calcYear, holidays]);

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const data = await listHolidays();
      setHolidays(data);
    } catch (e) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.date) return toast.error('Name and date are required');
    if (saving) return; setSaving(true);
    try {
      await addHoliday({ date: form.date, name: form.name.trim(), type: form.type });
      toast.success('Holiday added');
      setForm({ ...form, name: '' });
      loadHolidays();
    } catch (err) {
      toast.error('Failed to add holiday');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this holiday?')) return;
    try {
      await removeHoliday(id);
      toast.success('Holiday removed');
      loadHolidays();
    } catch (err) {
      toast.error('Failed to remove holiday');
    }
  };

  // Group by year-month for better display (optional) or just list them
  const upcoming = holidays.filter(h => h.date >= new Date().toISOString().slice(0, 10)).sort((a,b) => a.date.localeCompare(b.date));
  const past = holidays.filter(h => h.date < new Date().toISOString().slice(0, 10)).sort((a,b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 max-w-4xl" data-testid="holidays-calendar">
      <NavLink to="/dashboard/attendance" className="label-eyebrow text-primary">← Back to Attendance</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Holidays Calendar</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* ADD HOLIDAY FORM */}
        <div className="md:col-span-1 space-y-4">
          <div className="glass-morphism rounded-[2rem] p-5">
            <h2 className="font-display font-bold text-lg mb-4 text-primary">Add Holiday</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="label-eyebrow text-muted-foreground">Date</label>
                <input 
                  type="date" 
                  value={form.date} 
                  onChange={e => setForm({ ...form, date: e.target.value })} 
                  className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" 
                  required 
                />
              </div>
              <div>
                <label className="label-eyebrow text-muted-foreground">Holiday Name / Reason</label>
                <input 
                  type="text" 
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })} 
                  placeholder="e.g. Diwali, Heavy Rain..." 
                  className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm" 
                  required 
                />
              </div>
              <div>
                <label className="label-eyebrow text-muted-foreground">Type</label>
                <select 
                  value={form.type} 
                  onChange={e => setForm({ ...form, type: e.target.value })} 
                  className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-border bg-card text-sm"
                >
                  <option value="PLANNED">Planned (Yearly list)</option>
                  <option value="SUDDEN">Sudden (Weather, Bandh)</option>
                </select>
              </div>
              <button 
                type="submit" 
                disabled={saving} 
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Holiday
              </button>
            </form>
          </div>
        </div>

        {/* HOLIDAYS LIST */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-morphism rounded-[2rem] p-5">
            <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-500" /> Upcoming Holidays
            </h2>
            {loading ? (
              <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : upcoming.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 text-sm">No upcoming holidays recorded.</div>
            ) : (
              <div className="space-y-2">
                {upcoming.map(h => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-3 rounded-2xl border border-border hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0">
                        <span className="font-bold text-lg">{new Date(h.date).getDate()}</span>
                      </div>
                      <div>
                        <div className="font-bold text-foreground">{h.name}</div>
                        <div className="label-eyebrow text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          {new Date(h.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', weekday: 'short' })}
                          {h.type === 'SUDDEN' && <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 text-[9px] uppercase tracking-wider flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Sudden</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(h.id)} className="h-9 w-9 rounded-xl text-rose-500 hover:bg-rose-500/10 grid place-items-center flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* WORKING DAYS CALCULATOR */}
          <div className="glass-morphism rounded-[2rem] p-5 border border-indigo-500/20 bg-indigo-50/30">
            <h2 className="font-display font-bold text-lg mb-4 text-indigo-700">Working Days Calculator</h2>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[120px]">
                <label className="label-eyebrow text-indigo-600/70">Month</label>
                <select value={calcMonth} onChange={e => setCalcMonth(Number(e.target.value))} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-indigo-200 bg-white text-sm text-indigo-900 outline-none">
                  {Array.from({length: 12}).map((_, i) => (
                    <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div className="w-24 flex-shrink-0">
                <label className="label-eyebrow text-indigo-600/70">Year</label>
                <input type="number" value={calcYear} onChange={e => setCalcYear(Number(e.target.value))} className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-indigo-200 bg-white text-sm text-indigo-900 outline-none" />
              </div>
              <div className="h-11 px-6 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-display font-black text-xl tracking-tighter">
                {workingDays} Days
              </div>
            </div>
            <div className="mt-3 text-xs text-indigo-600/70">
              *Excludes Sundays, 2nd Saturdays, and added holidays.
            </div>
          </div>

          <div className="glass-morphism rounded-[2rem] p-5 opacity-80">
            <h2 className="font-display font-bold text-lg mb-4 text-muted-foreground">Past Holidays</h2>
            {past.length === 0 ? (
              <div className="text-center text-muted-foreground py-4 text-sm">No past holidays recorded.</div>
            ) : (
              <div className="space-y-2">
                {past.map(h => (
                  <div key={h.id} className="flex items-center justify-between p-3 rounded-2xl border border-border bg-muted/20">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-muted grid place-items-center flex-shrink-0">
                        <span className="font-bold text-sm text-muted-foreground">{new Date(h.date).getDate()}</span>
                      </div>
                      <div>
                        <div className="font-bold text-muted-foreground text-sm">{h.name}</div>
                        <div className="label-eyebrow text-muted-foreground/60 mt-0.5">
                          {new Date(h.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(h.id)} className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 grid place-items-center flex-shrink-0 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
