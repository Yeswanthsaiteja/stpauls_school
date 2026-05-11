import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTenant } from '../contexts/TenantContext';
import { Sun, Moon, Globe, User as UserIcon, Building2, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function AccountSettings() {
  const { profile } = useAuth();
  const { theme, toggle } = useTheme();
  const { tenant } = useTenant();
  const { t, i18n } = useTranslation();

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">{t('settings')}</h1>

      <motion.div whileHover={{ y: -3 }} className="glass-morphism rounded-[2rem] p-6">
        <div className="flex items-center gap-2 mb-4"><UserIcon className="h-4 w-4" /><div className="label-eyebrow text-muted-foreground">Profile</div></div>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white font-black text-xl">{(profile?.fullName || 'U')[0]}</div>
          <div>
            <div className="font-display font-black text-2xl tracking-tighter">{profile?.fullName || 'User'}</div>
            <div className="label-eyebrow text-muted-foreground mt-1">{profile?.role || 'GUEST'} · {profile?.email || tenant?.email}</div>
          </div>
        </div>
      </motion.div>

      <motion.div whileHover={{ y: -3 }} className="glass-morphism rounded-[2rem] p-6">
        <div className="flex items-center gap-2 mb-4"><Building2 className="h-4 w-4" /><div className="label-eyebrow text-muted-foreground">Tenant</div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><div className="label-eyebrow text-muted-foreground">School Name</div><div className="font-bold">{tenant?.name}</div></div>
          <div><div className="label-eyebrow text-muted-foreground">Subscription</div><div className="font-bold">Active</div></div>
          <div><div className="label-eyebrow text-muted-foreground">Contact</div><div className="font-bold">{tenant?.contactNumber}</div></div>
          <div><div className="label-eyebrow text-muted-foreground">Email</div><div className="font-bold">{tenant?.email}</div></div>
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
        <div className="flex items-center gap-2 mb-4"><Lock className="h-4 w-4" /><div className="label-eyebrow text-muted-foreground">Change Password</div></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input type="password" placeholder="Current" className="h-11 px-4 rounded-2xl border border-border bg-card text-sm" />
          <input type="password" placeholder="New" className="h-11 px-4 rounded-2xl border border-border bg-card text-sm" />
          <input type="password" placeholder="Confirm" className="h-11 px-4 rounded-2xl border border-border bg-card text-sm" />
        </div>
        <button onClick={() => toast.success('Password updated (demo)')} className="mt-3 px-5 h-11 rounded-2xl bg-primary text-primary-foreground label-eyebrow">Update</button>
      </div>
    </div>
  );
}
