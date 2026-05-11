import React, { useState, useMemo } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, LayoutDashboard, Users, BookOpen, IndianRupee, UserSquare2,
  CalendarCheck, MegaphoneIcon, Headset, IdCard, Bus, Hotel, Settings,
  Sun, Moon, LogOut, Menu, X, Bell, Search, ChevronLeft, Globe, AlertTriangle, Palette,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTenant } from '../contexts/TenantContext';
import { useTranslation } from 'react-i18next';
import { isFirebaseConfigured } from '../lib/firebase';
import { cn } from '../lib/utils';

const ROLE_NAV = {
  ADMIN: [
    { to: '/dashboard', icon: LayoutDashboard, key: 'dashboard' },
    { to: '/dashboard/students', icon: Users, key: 'students' },
    { to: '/dashboard/academic', icon: BookOpen, key: 'academic' },
    { to: '/dashboard/finance', icon: IndianRupee, key: 'finance' },
    { to: '/dashboard/employees', icon: UserSquare2, key: 'employees' },
    { to: '/dashboard/attendance', icon: CalendarCheck, key: 'attendance' },
    { to: '/dashboard/communication', icon: MegaphoneIcon, key: 'communication' },
    { to: '/dashboard/crm', icon: Headset, key: 'crm' },
    { to: '/dashboard/id-cards', icon: IdCard, key: 'idCards' },
    { to: '/dashboard/transport', icon: Bus, key: 'transport' },
    { to: '/dashboard/hostel', icon: Hotel, key: 'hostel' },
    { to: '/dashboard/settings', icon: Settings, key: 'settings' },
  ],
  STAFF: [
    { to: '/dashboard/staff-dashboard', icon: LayoutDashboard, key: 'dashboard' },
    { to: '/dashboard/students', icon: Users, key: 'students' },
    { to: '/dashboard/academic', icon: BookOpen, key: 'academic' },
    { to: '/dashboard/communication', icon: MegaphoneIcon, key: 'communication' },
    { to: '/dashboard/crm', icon: Headset, key: 'crm' },
    { to: '/dashboard/settings', icon: Settings, key: 'settings' },
  ],
  PARENT: [
    { to: '/dashboard/parent-dashboard', icon: LayoutDashboard, key: 'dashboard' },
    { to: '/dashboard/branding', icon: Palette, key: 'branding' },
    { to: '/dashboard/settings', icon: Settings, key: 'settings' },
  ],
};

const roleKey = (role) => {
  if (role === 'STAFF' || role === 'TEACHER') return 'STAFF';
  if (role === 'PARENT') return 'PARENT';
  return 'ADMIN';
};

export default function DashboardLayout() {
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { tenant, subscription } = useTenant();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = useMemo(() => ROLE_NAV[roleKey(profile?.role)] || [], [profile]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const switchLang = () => i18n.changeLanguage(i18n.language === 'te' ? 'en' : 'te');

  const SidebarBody = (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white shadow-lg shadow-indigo-500/30">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt="logo" className="h-full w-full object-cover rounded-2xl" />
          ) : <GraduationCap className="h-5 w-5" />}
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-display font-black text-base tracking-tight">{tenant?.name || 'Benita ERP'}</div>
            <div className="label-eyebrow text-muted-foreground">{t('appSub')}</div>
          </div>
        )}
      </div>

      <div className="px-5 mt-3 mb-2">
        {!collapsed && <div className="label-eyebrow text-muted-foreground">{t('coreOps')}</div>}
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto thin-scrollbar pb-4">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/dashboard' || it.to === '/dashboard/staff-dashboard' || it.to === '/dashboard/parent-dashboard'}
            data-testid={`nav-${it.key}`}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary"
                  />
                )}
                <it.icon className="h-[18px] w-[18px] flex-shrink-0" />
                {!collapsed && <span className="text-sm font-bold">{t(it.key)}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 mt-auto space-y-1 border-t border-border">
        <button
          data-testid="theme-toggle-sidebar"
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          {!collapsed && <span className="text-sm font-bold">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button
          data-testid="sign-out-btn"
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
        >
          <LogOut className="h-[18px] w-[18px]" />
          {!collapsed && <span className="text-sm font-bold">{t('signOut')}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex relative flex-col border-r border-border bg-card/40 backdrop-blur-xl transition-all duration-300',
          collapsed ? 'w-[80px]' : 'w-[260px]'
        )}
      >
        {SidebarBody}
        <button
          data-testid="sidebar-collapse-toggle"
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-24 h-7 w-7 rounded-full bg-card border border-border shadow grid place-items-center hover:bg-muted z-10"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 22 }}
              className="fixed left-0 top-0 bottom-0 w-[260px] bg-card border-r border-border z-50 lg:hidden"
            >
              <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 p-2 rounded-xl hover:bg-muted" data-testid="mobile-sidebar-close">
                <X className="h-4 w-4" />
              </button>
              {SidebarBody}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 sm:px-6 h-16 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-xl hover:bg-muted" data-testid="mobile-menu-open">
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="label-eyebrow text-muted-foreground">{tenant?.name || 'School'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                data-testid="lang-toggle"
                onClick={switchLang}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted text-xs font-black uppercase tracking-widest"
              >
                <Globe className="h-3.5 w-3.5" />{i18n.language === 'te' ? 'తెలుగు' : 'EN'}
              </button>
              <div className="hidden md:flex items-center gap-2 px-3 h-9 w-[220px] rounded-full bg-muted/60 border border-border">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input data-testid="topbar-search" placeholder={t('search')} className="bg-transparent outline-none text-sm flex-1" />
              </div>
              <button data-testid="bell-btn" className="relative p-2 rounded-xl hover:bg-muted">
                <Bell className="h-[18px] w-[18px]" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              </button>
              <div className="hidden sm:block h-6 w-px bg-border mx-1" />
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:block leading-tight text-right">
                  <div className="text-sm font-bold">{profile?.fullName || profile?.displayName || 'User'}</div>
                  <div className="label-eyebrow text-muted-foreground">{profile?.role || 'GUEST'}</div>
                </div>
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white text-sm font-black">
                  {(profile?.fullName || profile?.email || 'U')[0].toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Banners */}
        <div className="px-4 sm:px-6 pt-4 space-y-2">
          {!isFirebaseConfigured && (
            <div data-testid="banner-firebase" className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5" />
              <div className="text-xs text-rose-700 dark:text-rose-300">
                <span className="font-black uppercase tracking-widest">Demo Mode · </span>
                {t('firebaseNotConfigured')}
              </div>
            </div>
          )}
          {subscription?.status === 'expiring' && (
            <div data-testid="banner-expiring" className="rounded-2xl border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200 font-bold">
              {t('expiryReminder', { days: subscription.daysLeft })}
            </div>
          )}
        </div>

        {/* Subscription expired overlay */}
        {subscription?.status === 'expired' && (
          <div className="fixed inset-0 z-[80] backdrop-blur-md bg-background/80 grid place-items-center p-6">
            <div className="glass-morphism rounded-[2rem] p-10 max-w-md text-center">
              <div className="h-16 w-16 mx-auto rounded-3xl bg-rose-500/10 grid place-items-center mb-4">
                <AlertTriangle className="h-8 w-8 text-rose-500" />
              </div>
              <div className="font-display font-black text-2xl tracking-tight">{t('expiredMessage')}</div>
              <p className="text-sm text-muted-foreground mt-2">Please contact support to renew your subscription and restore full access.</p>
            </div>
          </div>
        )}

        <main className="flex-1 grid-bg-dots p-4 sm:p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
