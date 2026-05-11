import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Settings } from 'lucide-react';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../lib/pdfUtils';
import { toast } from 'sonner';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function loadTiming() {
  try { return JSON.parse(localStorage.getItem('benita_timing') || ''); } catch { return null; }
}
function saveTiming(t) { localStorage.setItem('benita_timing', JSON.stringify(t)); }
function loadGrid(key) {
  try { return JSON.parse(localStorage.getItem(`benita_tt_${key}`) || ''); } catch { return null; }
}
function saveGrid(key, g) { localStorage.setItem(`benita_tt_${key}`, JSON.stringify(g)); }

export default function Timetable() {
  const [profile, setProfile] = useState('Primary');
  const [timing, setTiming] = useState(() => loadTiming() || {
    Nursery: { start: '09:00', end: '12:30', periods: 4, periodMin: 35, shortBreak: '10:30', shortBreakMin: 10, lunch: '12:00', lunchMin: 0 },
    Primary: { start: '08:30', end: '14:30', periods: 7, periodMin: 40, shortBreak: '10:30', shortBreakMin: 10, lunch: '12:30', lunchMin: 30 },
    High:    { start: '08:00', end: '15:00', periods: 8, periodMin: 45, shortBreak: '10:30', shortBreakMin: 10, lunch: '12:45', lunchMin: 30 },
  });
  const [cls, setCls] = useState('5th');
  const [sec, setSec] = useState('A');

  const key = `${cls}-${sec}`;
  const periodsCount = timing[profile].periods;
  const [grid, setGrid] = useState(() => loadGrid(key) || {});

  React.useEffect(() => { setGrid(loadGrid(key) || {}); }, [key]);

  const updateTiming = (k, v) => setTiming((t) => ({ ...t, [profile]: { ...t[profile], [k]: v } }));
  const persistTiming = () => { saveTiming(timing); toast.success('Timings saved'); };
  const persistGrid = () => { saveGrid(key, grid); toast.success(`Timetable saved · ${key}`); };

  const setCell = (day, idx, value) => setGrid((g) => ({ ...g, [`${day}-${idx}`]: value }));

  return (
    <div className="space-y-6" data-testid="timetable-page">
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
          <select value={cls} onChange={(e) => setCls(e.target.value)} className="ml-2 h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="tt-class">
            {CLASS_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-muted-foreground">Section</label>
          <select value={sec} onChange={(e) => setSec(e.target.value)} className="ml-2 h-10 px-3 rounded-2xl border border-border bg-card text-sm" data-testid="tt-section">
            {SECTION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
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
