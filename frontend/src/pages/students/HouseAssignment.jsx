import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Palette, Search, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { getCurrentAcademicYear } from '../../utils';
import { CLASS_OPTIONS, SECTION_OPTIONS } from '../../lib/pdfUtils';
import { listStudents, updateStudent } from '../../services/firebase/studentsService';

const HOUSES = [
  { id: 'red', label: 'Red', color: '#E53935' },
  { id: 'green', label: 'Green', color: '#388E3C' },
  { id: 'blue', label: 'Blue', color: '#1565C0' },
  { id: 'yellow', label: 'Yellow', color: '#F9A825' },
];

const PRE_PRIMARY_HOUSE = { id: 'pink', label: 'Pink', color: '#C2185B' };

export default function HouseAssignment() {
  const { t } = useTranslation();
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Check if selected class is Pre-Primary
  const isPrePrimary = ['Nursery', 'LKG', 'UKG'].includes(selectedClass);
  const availableHouses = isPrePrimary ? [PRE_PRIMARY_HOUSE] : HOUSES;

  useEffect(() => {
    if (!academicYear || !selectedClass || !selectedSection) {
      setStudents([]);
      return;
    }
    loadStudents();
    // eslint-disable-next-line
  }, [academicYear, selectedClass, selectedSection]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const data = await listStudents({
        academicYear,
        className: selectedClass,
        section: selectedSection,
        status: 'ACTIVE'
      });
      // Sort students alphabetically
      data.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
      setStudents(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const assignHouse = async (studentId, houseId) => {
    // Optimistic update
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, house: houseId } : s));
    
    // Save to DB immediately
    try {
      await updateStudent(studentId, { house: houseId });
      toast.success('House updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update house');
      // Revert on failure
      loadStudents();
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const counts = {};
    availableHouses.forEach(h => counts[h.id] = 0);
    counts['unassigned'] = 0;
    
    students.forEach(s => {
      if (s.house && availableHouses.find(h => h.id === s.house)) {
        counts[s.house]++;
      } else if (s.house && !availableHouses.find(h => h.id === s.house)) {
         // Student has a house, but it's not valid for this class
         counts['unassigned']++;
      } else {
        counts['unassigned']++;
      }
    });
    return counts;
  }, [students, availableHouses]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto" data-testid="house-assignment">
      <div className="flex items-center justify-between">
        <div>
          <NavLink to=".." className="label-eyebrow text-primary hover:underline">{t('back')}</NavLink>
          <h1 className="font-display font-black text-3xl tracking-tighter uppercase mt-2 flex items-center gap-2">
            <Palette className="h-7 w-7 text-primary" />
            House Assignment
          </h1>
        </div>
      </div>

      <div className="glass-morphism rounded-[2rem] p-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="label-eyebrow text-muted-foreground mb-2 block">{t('academicYear')}</label>
          <input
            className="w-full h-11 px-4 rounded-2xl bg-background/50 border border-border outline-none focus:border-primary transition-colors font-semibold"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="e.g. 2024-2025"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="label-eyebrow text-muted-foreground mb-2 block">{t('class')}</label>
          <select
            className="w-full h-11 px-4 rounded-2xl bg-background/50 border border-border outline-none focus:border-primary transition-colors font-semibold appearance-none"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">Select Class...</option>
            {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="label-eyebrow text-muted-foreground mb-2 block">{t('section')}</label>
          <select
            className="w-full h-11 px-4 rounded-2xl bg-background/50 border border-border outline-none focus:border-primary transition-colors font-semibold appearance-none"
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
          >
            <option value="">Select Section...</option>
            {SECTION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-none">
          <button 
            onClick={loadStudents}
            disabled={loading || !academicYear || !selectedClass || !selectedSection}
            className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
      </div>

      {students.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {availableHouses.map(h => (
            <div key={h.id} className="glass-morphism rounded-[1.5rem] p-4 flex flex-col items-center justify-center gap-1 border border-border/50 shadow-sm" style={{ borderBottom: `4px solid ${h.color}` }}>
              <div className="text-3xl font-black" style={{ color: h.color }}>{stats[h.id] || 0}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{h.label}</div>
            </div>
          ))}
          <div className="glass-morphism rounded-[1.5rem] p-4 flex flex-col items-center justify-center gap-1 border border-border/50 shadow-sm border-b-4 border-b-muted">
            <div className="text-3xl font-black text-muted-foreground">{stats['unassigned']}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unassigned</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : students.length > 0 ? (
        <div className="glass-morphism rounded-[2rem] overflow-hidden border border-border">
          <div className="overflow-x-auto thin-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-5 py-4 font-bold label-eyebrow w-16 text-center">#</th>
                  <th className="px-5 py-4 font-bold label-eyebrow">Student Name</th>
                  <th className="px-5 py-4 font-bold label-eyebrow">Admission No</th>
                  <th className="px-5 py-4 font-bold label-eyebrow">Current House</th>
                  <th className="px-5 py-4 font-bold label-eyebrow text-right">Assign House</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                <AnimatePresence>
                  {students.map((s, idx) => {
                    const currentHouseObj = availableHouses.find(h => h.id === s.house);
                    return (
                      <motion.tr 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        key={s.id} 
                        className="hover:bg-muted/10 transition-colors"
                      >
                        <td className="px-5 py-3 text-center text-muted-foreground font-mono text-xs">{idx + 1}</td>
                        <td className="px-5 py-3 font-bold">{s.fullName}</td>
                        <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{s.admissionNo}</td>
                        <td className="px-5 py-3">
                          {currentHouseObj ? (
                            <span 
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-white flex inline-flex items-center gap-1.5"
                              style={{ backgroundColor: currentHouseObj.color }}
                            >
                              {currentHouseObj.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs font-semibold px-2 py-1 bg-muted rounded-lg">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {availableHouses.map(h => (
                              <button
                                key={h.id}
                                onClick={() => assignHouse(s.id, h.id)}
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${s.house === h.id ? 'scale-110 ring-2 ring-offset-2 ring-offset-background' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                                style={{ 
                                  backgroundColor: h.color,
                                  borderColor: s.house === h.id ? h.color : 'transparent',
                                  ringColor: h.color
                                }}
                                title={`Assign to ${h.label}`}
                              >
                                {s.house === h.id && <CheckCircle2 className="h-4 w-4 text-white" />}
                              </button>
                            ))}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedClass && selectedSection && !loading ? (
        <div className="py-20 text-center text-muted-foreground font-semibold">
          No students found in {selectedClass}-{selectedSection}
        </div>
      ) : null}
    </div>
  );
}
