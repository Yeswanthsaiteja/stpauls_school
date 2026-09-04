import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTenant } from '../contexts/TenantContext';
import { Sun, Moon, Globe, User as UserIcon, Building2, Lock } from 'lucide-react';
import { toast } from 'sonner';

import { getStudent } from '../services/firebase/studentsService';
import { auth, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';

export default function AccountSettings() {
  const { profile } = useAuth();
  const { theme, toggle } = useTheme();
  const { tenant } = useTenant();
  const { t, i18n } = useTranslation();

  const [childPhoto, setChildPhoto] = React.useState(null);
  
  const [currentPin, setCurrentPin] = React.useState('');
  const [newPin, setNewPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [isUpdating, setIsUpdating] = React.useState(false);

  React.useEffect(() => {
    if ((profile?.role?.toLowerCase() === 'parent') && (profile?.linkedStudentId || profile?.linkedStudents?.[0]?.id)) {
      const studentId = profile?.linkedStudentId || profile?.linkedStudents?.[0]?.id;
      getStudent(studentId).then(s => {
        if (s?.photoURL) setChildPhoto(s.photoURL);
      });
    }
  }, [profile]);

  const handlePinUpdate = async () => {
    if (!currentPin || !newPin || !confirmPin) {
      toast.error('Please fill all PIN fields');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('New PINs do not match');
      return;
    }
    if (newPin.length !== 4) {
      toast.error('New PIN must be exactly 4 digits');
      return;
    }
    
    setIsUpdating(true);
    try {
      const setNewPinFn = httpsCallable(functions, 'setNewPin');
      await setNewPinFn({ currentPin, pin: newPin });
      
      toast.success('PIN updated successfully');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to update PIN. Please check your current PIN.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePinChange = (setter) => (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setter(val);
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">{t('settings')}</h1>

      <motion.div whileHover={{ y: -3 }} className="glass-morphism rounded-[2rem] p-6">
        <div className="flex items-center gap-2 mb-4"><UserIcon className="h-4 w-4" /><div className="label-eyebrow text-muted-foreground">Profile</div></div>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-xl overflow-hidden ring-4 ring-background">
            {childPhoto ? <img src={childPhoto} alt="Profile" className="h-full w-full object-cover" /> : (profile?.fullName || 'U')[0]}
          </div>
          <div>
            <div className="font-display font-black text-2xl tracking-tighter">{profile?.fullName || 'User'}</div>
            <div className="label-eyebrow text-muted-foreground mt-1">{profile?.role} · {profile?.designation || profile?.department || ''}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><div className="label-eyebrow text-muted-foreground">Phone</div><div className="font-bold">{profile?.phone || '—'}</div></div>
          <div><div className="label-eyebrow text-muted-foreground">Email</div><div className="font-bold">{profile?.email || '—'}</div></div>
          {profile?.department && <div><div className="label-eyebrow text-muted-foreground">Department</div><div className="font-bold">{profile.department}</div></div>}
          {profile?.employeeId && <div><div className="label-eyebrow text-muted-foreground">Employee ID</div><div className="font-bold">{profile.employeeId}</div></div>}
          {profile?.linkedStudentName && <div><div className="label-eyebrow text-muted-foreground">Child</div><div className="font-bold">{profile.linkedStudentName}</div></div>}
        </div>
      </motion.div>

      <motion.div whileHover={{ y: -3 }} className="glass-morphism rounded-[2rem] p-6">
        <div className="flex items-center gap-2 mb-4"><Building2 className="h-4 w-4" /><div className="label-eyebrow text-muted-foreground">Tenant</div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><div className="label-eyebrow text-muted-foreground">School Name</div><div className="font-bold">{tenant?.name || "St. Paul's High School"}</div></div>
          <div><div className="label-eyebrow text-muted-foreground">Subscription</div><div className="font-bold">Active</div></div>
          <div><div className="label-eyebrow text-muted-foreground">Contact</div><div className="font-bold">8978186701</div></div>
          <div><div className="label-eyebrow text-muted-foreground">Email</div><div className="font-bold">saintpaul.sklm@gmail.com</div></div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={toggle} data-testid="settings-theme-toggle" className="glass-morphism rounded-[1.75rem] p-5 text-left hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 grid place-items-center">{theme === 'dark' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-amber-500" />}</div>
            <div>
              <div className="font-bold text-sm">Appearance</div>
              <div className="label-eyebrow text-muted-foreground">Currently {theme}</div>
            </div>
          </div>
        </button>
        <button onClick={() => i18n.changeLanguage(i18n.language === 'te' ? 'en' : 'te')} data-testid="settings-lang-toggle" className="glass-morphism rounded-[1.75rem] p-5 text-left hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 grid place-items-center"><Globe className="h-4 w-4 text-indigo-500" /></div>
            <div>
              <div className="font-bold text-sm">Language</div>
              <div className="label-eyebrow text-muted-foreground">{i18n.language === 'te' ? 'తెలుగు' : 'English'}</div>
            </div>
          </div>
        </button>
      </div>

      <div className="glass-morphism rounded-[2rem] p-6">
        <div className="flex items-center gap-2 mb-4"><Lock className="h-4 w-4" /><div className="label-eyebrow text-muted-foreground">Change PIN</div></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input type="password" inputMode="numeric" maxLength={4} value={currentPin} onChange={handlePinChange(setCurrentPin)} placeholder="Current PIN" className="h-11 px-4 rounded-2xl border border-border bg-card text-sm text-center tracking-widest font-bold" />
          <input type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={handlePinChange(setNewPin)} placeholder="New PIN" className="h-11 px-4 rounded-2xl border border-border bg-card text-sm text-center tracking-widest font-bold" />
          <input type="password" inputMode="numeric" maxLength={4} value={confirmPin} onChange={handlePinChange(setConfirmPin)} placeholder="Confirm PIN" className="h-11 px-4 rounded-2xl border border-border bg-card text-sm text-center tracking-widest font-bold" />
        </div>
        <button disabled={isUpdating} onClick={handlePinUpdate} className="mt-3 px-5 h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow disabled:opacity-50 disabled:cursor-not-allowed">
          {isUpdating ? 'Updating...' : 'Update PIN'}
        </button>
      </div>
    </div>
  );
}
