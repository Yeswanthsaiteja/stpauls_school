import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Save, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { listClasses, getTimetable, saveTimetable } from '../services/firebase/academicService';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function loadTiming() {
  try { return JSON.parse(localStorage.getItem('benita_timing') || ''); } catch { return null; }
}
function saveTiming(t) { localStorage.setItem('benita_timing', JSON.stringify(t)); }

export default function Timetable() {
  const [profile, setProfile] = useState('Primary');
  const [timing, setTiming] = useState(() => loadTiming() || {
    Nursery: { start: '09:00', end: '12:30', periods: 4, periodMin: 35, shortBreak: '10:30', shortBreakMin: 10, lunch: '12:00', lunchMin: 0 },
    Primary: { start: '08:30', end: '14:30', periods: 7, periodMin: 40, shortBreak: '10:30', shortBreakMin: 10, lunch: '12:30', lunchMin: 30 },
    High:    { start: '08:00', end: '15:00', periods: 8, periodMin: 45, shortBreak: '10:30', shortBreakMin: 10, lunch: '12:45', lunchMin: 30 },
  });
  const [classes, setClasses] = useState([]);
  const [cls, setCls] = useState('');
  const [sec, setSec] = useState('');
  const [grid, setGrid] = useState({});
  const [loading, setLoading] = useState(true);

  const periodsCount = timing[profile].periods;

  useEffect(() => {
    listClasses().then((clsList) => {
      setClasses(clsList);
      if (clsList.length > 0) {
        setCls(clsList[0].name);
        if (clsList[0].sections?.length > 0) setSec(clsList[0].sections[0]);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!cls) return;
    const loadTT = async () => {
      const data = await getTimetable(cls, sec);
      setGrid(data?.slots || {});
    };
    loadTT();
  }, [cls, sec]);

  const activeClassObj = classes.find(c => c.name === cls);
  const sectionOpts = activeClassObj ? activeClassObj.sections : [];

  const updateTiming = (k, v) => setTiming((t) => ({ ...t, [profile]: { ...t[profile], [k]: v } }));
  const persistTiming = () => { saveTiming(timing); toast.success('Timings saved'); };
  
  const persistGrid = async () => { 
    if (!cls) return;
    await saveTimetable(cls, sec, grid); 
    toast.success(`Timetable saved for ${cls}-${sec}`); 
  };

  const setCell = (day, idx, value) => setGrid((g) => ({ ...g, [`${day}-${idx}`]: value }));

  return (
    <div className="space-y-6" data-testid="timetable-page">
      <NavLink to="/dashboard/academic" className="label-eyebrow text-primary">← Back to Academic</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Timetable</h1>

      {/* Timing config */}
      <div className="glass-morphism rounded-[2rem] p-5">
        <div className="flex items-center gap-2 mb-4"><Settings className="h-4 w-4" /><div className="label-eyebrow text-muted-foreground">School Timing Profiles</div></div>
        <div className="flex gap-2 mb-4 flex-wrap">
          {Object.keys(timing).map((p) => (
            <button key={p} onClick={() => setProfile(p)} className={`px-4 py-1.5 rounded-full label-eyebrow ${profile === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`} data-testid={`profile-${p}`}>{p}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['start', 'Start Time', 'time'], ['end', 'End Time', 'time'],
            ['periods', 'Periods/Day', 'number'], ['periodMin', 'Period Minutes', 'number'],
            ['shortBreak', 'Short Break', 'time'], ['shortBreakMin', 'Short Break Min', 'number'],
            ['lunch', 'Lunch Time', 'time'], ['lunchMin', 'Lunch Minutes', 'number'],
          ].map(([k, label, type]) => (
            <div key={k}>
              <label className="label-eyebrow text-muted-foreground">{label}</label>
              <input type={type} value={timing[profile][k]} onChange={(e) => updateTiming(k, type === 'number' ? Number(e.target.value) : e.target.value)} className="mt-1.5 w-full h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid={`timing-${k}`} />
            </div>
          ))}
        </div>
        <button onClick={persistTiming} className="mt-4 h-10 px-4 rounded-2xl bg-foreground text-background label-eyebrow flex items-center gap-2" data-testid="timing-save">
          <Save className="h-3.5 w-3.5" />Save Timing
        </button>
      </div>

      {/* Class selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="label-eyebrow text-muted-foreground">Class</label>
          <select value={cls} onChange={(e) => {
            setCls(e.target.value);
            const newCls = classes.find(c => c.name === e.target.value);
            if (newCls?.sections?.length > 0) setSec(newCls.sections[0]);
            else setSec('');
          }} className="ml-2 h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="tt-class">
            {classes.map((c) => <option key={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Section</label>
          <select value={sec} onChange={(e) => setSec(e.target.value)} className="ml-2 h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="tt-section">
            <option value="">All</option>
            {sectionOpts?.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={persistGrid} className="ml-auto h-10 px-4 rounded-2xl bg-primary text-primary-foreground label-eyebrow flex items-center gap-2" data-testid="tt-save">
          <Save className="h-3.5 w-3.5" />Save Timetable
        </button>
      </div>

      {/* Grid */}
      <div className="glass-morphism rounded-[2rem] p-3 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="label-eyebrow text-muted-foreground p-2 text-left">Day</th>
              {Array.from({ length: periodsCount }, (_, i) => (
                <th key={i} className="label-eyebrow text-muted-foreground p-2 text-left">P{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d} className="border-t border-border">
                <td className="p-2 font-bold">{d}</td>
                {Array.from({ length: periodsCount }, (_, i) => (
                  <td key={i} className="p-1">
                    <input
                      value={grid[`${d}-${i}`] || ''}
                      onChange={(e) => setCell(d, i, e.target.value)}
                      placeholder="Subject"
                      className="w-full h-10 px-2 rounded-xl border border-border bg-card text-xs"
                      data-testid={`tt-${d}-${i}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
