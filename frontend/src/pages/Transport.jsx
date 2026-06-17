import React, { useState, useEffect } from 'react';
import { getCurrentAcademicYear } from '../utils';

import { motion, AnimatePresence } from 'framer-motion';
import { Bus, MapPin, Clock, Users, Navigation, Plus, RefreshCw, X, ChevronRight } from 'lucide-react';
import { listRoutes, addRoute, updateRoute } from '../services/firebase/transportService';
import { listAllocations } from '../services/firebase/transportService';
import { toast } from 'sonner';

export default function Transport() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', vehicleNo: '', driverName: '', driverPhone: '', capacity: 40, stops: '' });
  const [saving, setSaving] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null); // route object for detail panel
  const [routeStudents, setRouteStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const YEARS = ['2024-25', '2025-26', '2026-27', '2027-28'];
  const [allStudents, setAllStudents] = useState([]);

  const load = async () => {
    setLoading(true);
    const [data, stu] = await Promise.all([
      listRoutes(),
      import('../services/firebase/studentsService').then(m => m.listStudents({ status: 'ACTIVE' }))
    ]);
    setRoutes(data);
    setAllStudents(stu);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalRiders = routes.reduce((s, r) => s + (r.enrolled || 0), 0);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name) return toast.error('Route code and name are required');
    if (saving) return; setSaving(true);
    try {
      const stopsArr = form.stops.split(',').map(s => s.trim()).filter(Boolean);
      const row = await addRoute({ ...form, stops: stopsArr, enrolled: 0, status: 'ACTIVE' });
      if (row) {
        setRoutes(r => [row, ...r]);
        toast.success('Route added to Firestore');
      } else {
        toast.error('Firebase not configured. Please check your setup.');
      }
      setShowAdd(false);
      setForm({ code: '', name: '', vehicleNo: '', driverName: '', driverPhone: '', capacity: 40, stops: '' });
    } catch {
      toast.error('Failed to add route. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openRoute = async (route) => {
    setSelectedRoute(route);
    setLoadingStudents(true);
    try {
      const allocs = await listAllocations({ routeId: route.id });
      // Filter allocations to only show students belonging to the selected academic year
      const activeStudentIds = new Set(allStudents.filter(s => (s.academicYear || '2026-27') === academicYear).map(s => s.id));
      setRouteStudents(allocs.filter(a => activeStudentIds.has(a.studentId)));
    } catch {
      setRouteStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const toggleStatus = async (route) => {
    const next = route.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await updateRoute(route.id, { status: next });
    setRoutes(rs => rs.map(r => r.id === route.id ? { ...r, status: next } : r));
    if (selectedRoute?.id === route.id) setSelectedRoute(r => ({ ...r, status: next }));
    toast.success(`Route marked ${next}`);
  };

  return (
    <div className="space-y-6" data-testid="transport-module">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Transport</h1>
        <div className="flex items-center gap-2">
          <select value={academicYear} onChange={(e) => { setAcademicYear(e.target.value); setSelectedRoute(null); }} className="h-9 px-3 rounded-xl border border-border bg-card text-sm font-bold">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load} className="h-9 w-9 rounded-xl bg-muted grid place-items-center hover:bg-muted/80" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground label-eyebrow hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Add Route
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Routes', v: routes.length, c: 'from-indigo-500 to-violet-500', icon: Bus },
          { l: 'Active', v: routes.filter(r => r.status === 'ACTIVE').length, c: 'from-emerald-500 to-teal-500', icon: Navigation },
          { l: 'Total Riders', v: totalRiders, c: 'from-amber-500 to-orange-500', icon: Users },
          { l: 'Avg Capacity', v: routes.length ? Math.round(routes.reduce((s, r) => s + (r.capacity || 40), 0) / routes.length) : 0, c: 'from-rose-500 to-pink-500', icon: Clock },
        ].map((s, i) => (
          <motion.div key={i} whileHover={{ y: -5, scale: 1.02 }} className="glass-morphism rounded-[2rem] p-5">
            <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${s.c} grid place-items-center text-white`}><s.icon className="h-5 w-5" /></div>
            <div className="mt-4 label-eyebrow text-muted-foreground">{s.l}</div>
            <div className="font-display font-black text-3xl tracking-tighter">{s.v}</div>
          </motion.div>
        ))}
      </div>

      {/* Add Route form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="glass-morphism rounded-[2rem] p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="col-span-full label-eyebrow text-primary mb-1">Add New Route</div>
          {[
            { label: 'Route Code*', key: 'code', placeholder: 'R4' },
            { label: 'Route Name*', key: 'name', placeholder: 'Kondapur Route' },
            { label: 'Vehicle No.', key: 'vehicleNo', placeholder: 'TS09AB1234' },
            { label: 'Driver Name', key: 'driverName', placeholder: 'Name' },
            { label: 'Driver Phone', key: 'driverPhone', placeholder: '9876543210' },
            { label: 'Capacity', key: 'capacity', type: 'number', placeholder: '40' },
          ].map(f => (
            <div key={f.key}>
              <label className="label-eyebrow text-muted-foreground">{f.label}</label>
              <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="label-eyebrow text-muted-foreground">Stops (comma-separated)</label>
            <input type="text" value={form.stops} onChange={e => setForm(d => ({ ...d, stops: e.target.value }))}
              placeholder="Stop 1, Stop 2, School"
              className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary" />
          </div>
          <div className="col-span-full flex gap-2">
            <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Route'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="h-10 px-5 rounded-xl bg-muted label-eyebrow">Cancel</button>
          </div>
        </form>
      )}

      {/* Route list + detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Route list */}
        <div className={`space-y-3 ${selectedRoute ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Loading routes…</div>
          ) : routes.length === 0 ? (
            <div className="glass-morphism rounded-[2rem] p-10 text-center text-muted-foreground">
              <Bus className="h-10 w-10 mx-auto mb-3 opacity-30" />
              No transport routes yet. Click "Add Route" to get started.
            </div>
          ) : (
            routes.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => openRoute(r)}
                className={`glass-morphism rounded-[2rem] p-5 cursor-pointer transition-all hover:shadow-lg ${selectedRoute?.id === r.id ? 'border-2 border-primary/40' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center text-white flex-shrink-0"><Bus className="h-5 w-5" /></div>
                    <div>
                      <div className="font-display font-black text-lg tracking-tighter">{r.name || `Route ${r.code}`}</div>
                      <div className="label-eyebrow text-muted-foreground">{r.driverName ? `Driver: ${r.driverName}` : 'No driver'} · {r.vehicleNo || 'No vehicle'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full label-eyebrow flex items-center gap-1 ${r.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${r.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />{r.status || 'ACTIVE'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary label-eyebrow">{r.enrolled || 0}/{r.capacity || 40} riders</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                {r.stops?.length > 0 && (
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    {r.stops.map((s, idx) => (
                      <React.Fragment key={idx}>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50">
                          <MapPin className="h-3 w-3 text-primary" />
                          <span className="label-eyebrow">{s}</span>
                        </div>
                        {idx < r.stops.length - 1 && <span className="text-muted-foreground">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* Route detail / students panel */}
        <AnimatePresence>
          {selectedRoute && (
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
              className="glass-morphism rounded-[2rem] p-5 space-y-4 h-fit">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display font-black text-lg tracking-tighter">{selectedRoute.name}</div>
                  <div className="label-eyebrow text-muted-foreground">Code: {selectedRoute.code}</div>
                </div>
                <button onClick={() => setSelectedRoute(null)} className="h-8 w-8 rounded-xl bg-muted grid place-items-center hover:bg-muted/80">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-muted/40 p-2">
                  <div className="label-eyebrow text-muted-foreground">Driver</div>
                  <div className="font-bold">{selectedRoute.driverName || '—'}</div>
                </div>
                <div className="rounded-xl bg-muted/40 p-2">
                  <div className="label-eyebrow text-muted-foreground">Vehicle</div>
                  <div className="font-bold">{selectedRoute.vehicleNo || '—'}</div>
                </div>
                <div className="rounded-xl bg-muted/40 p-2">
                  <div className="label-eyebrow text-muted-foreground">Capacity</div>
                  <div className="font-bold">{selectedRoute.capacity || 40}</div>
                </div>
                <div className="rounded-xl bg-muted/40 p-2">
                  <div className="label-eyebrow text-muted-foreground">Phone</div>
                  <div className="font-bold text-xs">{selectedRoute.driverPhone || '—'}</div>
                </div>
              </div>

              <button onClick={() => toggleStatus(selectedRoute)}
                className={`w-full h-9 rounded-xl label-eyebrow ${selectedRoute.status === 'ACTIVE' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-600'}`}>
                Mark {selectedRoute.status === 'ACTIVE' ? 'Inactive' : 'Active'}
              </button>

              <div>
                <div className="label-eyebrow text-muted-foreground mb-3">
                  Enrolled Students ({loadingStudents ? '…' : routeStudents.length})
                </div>
                {loadingStudents ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">Loading…</div>
                ) : routeStudents.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">No students enrolled yet.<br />Students are added via Admission Form.</div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {routeStudents.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-border">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-xs flex-shrink-0">
                          {(a.studentName || 'S')[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">{a.studentName}</div>
                          <div className="label-eyebrow text-muted-foreground">{a.stop || 'No stop'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
