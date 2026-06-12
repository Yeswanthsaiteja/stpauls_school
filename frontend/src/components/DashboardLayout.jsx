import React, { useState, useMemo, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, LayoutDashboard, Users, BookOpen, IndianRupee, UserSquare2,
  CalendarCheck, MegaphoneIcon, Headset, IdCard, Bus, Hotel, Settings, Library,
  Sun, Moon, LogOut, Menu, X, Bell, Search, ChevronLeft, Globe, AlertTriangle,
  FileText, CheckSquare, MessageSquare, Check, BookMarked, ChevronRight, Calendar,
} from 'lucide-react';
import { ParentChildContext } from '../pages/ParentDashboard';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import logoSrc from '../assets/logo.png';
import { useTenant } from '../contexts/TenantContext';
import { useTranslation } from 'react-i18next';
import { isFirebaseConfigured } from '../lib/firebase';
import { cn } from '../lib/utils';
import { subscribeNotifications, markAllNotificationsRead, markNotificationRead } from '../services/firebase/notificationsService';

const ROLE_NAV = {
  ADMIN: [
    { to: '/dashboard', icon: LayoutDashboard, key: 'dashboard' },
    { to: '/dashboard/students', icon: Users, key: 'students' },
    { to: '/dashboard/academic', icon: BookOpen, key: 'academic' },
    { to: '/dashboard/finance', icon: IndianRupee, key: 'finance' },
    { to: '/dashboard/employees', icon: UserSquare2, key: 'employees' },
    { to: '/dashboard/attendance', icon: CalendarCheck, key: 'attendance' },
    { to: '/dashboard/communication', icon: MegaphoneIcon, key: 'communication' },
    { to: '/dashboard/library', icon: Library, key: 'library' },
    { to: '/dashboard/crm', icon: Headset, key: 'crm' },
    { to: '/dashboard/diary', icon: BookMarked, key: 'diary' },
    { to: '/dashboard/id-cards', icon: IdCard, key: 'idCards' },
    { to: '/dashboard/transport', icon: Bus, key: 'transport' },
    { to: '/dashboard/hostel', icon: Hotel, key: 'hostel' },
    { to: '/dashboard/settings', icon: Settings, key: 'settings' },
  ],
  STAFF: [
    { to: '/dashboard/staff-dashboard',            icon: LayoutDashboard, key: 'dashboard',   end: true },
    { to: '/dashboard/staff-dashboard/my-class',   icon: Users,           key: 'myClass' },
    { to: '/dashboard/staff-dashboard/attendance', icon: CalendarCheck,   key: 'attendance' },
    { to: '/dashboard/staff-dashboard/marks',      icon: BookOpen,        key: 'marks' },
    { to: '/dashboard/staff-dashboard/topics',     icon: CheckSquare,     key: 'topics' },
    { to: '/dashboard/staff-dashboard/diary',      icon: BookMarked,      key: 'diary' },
    { to: '/dashboard/staff-dashboard/leave',      icon: FileText,        key: 'leave' },
    { to: '/dashboard/staff-dashboard/messages',   icon: MessageSquare,   key: 'messages' },
    { to: '/dashboard/settings',                   icon: Settings,        key: 'settings' },
  ],
  PARENT: [
    { to: '/dashboard/parent-dashboard', icon: LayoutDashboard, key: 'dashboard', end: true },
    { to: '/dashboard/parent-dashboard/diary', icon: BookMarked, key: 'diary' },
    { to: '/dashboard/parent-dashboard/attendance', icon: CalendarCheck, key: 'attendance' },
    { to: '/dashboard/parent-dashboard/finance', icon: IndianRupee, key: 'finance' },
    { to: '/dashboard/parent-dashboard/result', icon: BookOpen, key: 'results' },
    { to: '/dashboard/parent-dashboard/exam-timetable', icon: Calendar, key: 'examTimetable' },
    { to: '/dashboard/parent-dashboard/announcements', icon: Bell, key: 'announcements' },
    { to: '/dashboard/parent-dashboard/support', icon: Headset, key: 'support' },
    { to: '/dashboard/parent-dashboard/messages', icon: MegaphoneIcon, key: 'messages' },
    { to: '/dashboard/settings', icon: Settings, key: 'settings' },
  ],
};

const STAFF_ROLES = new Set([
  'staff', 'teacher', 'class teacher', 'principal', 'vice principal',
  'accountant', 'librarian', 'lab assistant', 'administrative', 'support staff',
]);

const roleKey = (role) => {
  if (!role) return 'ADMIN';
  const r = role.toLowerCase().trim();
  if (r === 'school_admin' || r === 'admin') return 'ADMIN';
  if (r === 'parent') return 'PARENT';
  // Any other role retrieved from the employees collection should see the STAFF dashboard
  return 'STAFF';
};

// Notification type → icon colour
const NOTE_COLOURS = {
  leave_request: 'bg-amber-500/10 text-amber-600',
  leave_status:  'bg-emerald-500/10 text-emerald-600',
  message:       'bg-blue-500/10 text-blue-600',
  announcement:  'bg-violet-500/10 text-violet-600',
  crm_ticket:    'bg-rose-500/10 text-rose-600',
  ticket_update: 'bg-emerald-500/10 text-emerald-600',
};

function NotificationDropdown({ notifications, userId, onClose, t }) {
  const unread = notifications.filter(n => !n.read);

  const handleMarkAll = async () => {
    await markAllNotificationsRead(userId);
  };

  const handleMark = async (n) => {
    if (!n.read) await markNotificationRead(n.id);
  };

  const relativeTime = (n) => {
    const sec = n.createdAt?.seconds;
    if (!sec) return '';
    const diff = Math.floor((Date.now() / 1000) - sec);
    if (diff < 60) return t('justNow');
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-12 w-80 bg-card border border-border rounded-[1.5rem] shadow-2xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-bold text-sm">{t('notifications')}</span>
        <div className="flex items-center gap-2">
          {unread.length > 0 && (
            <button onClick={handleMarkAll} className="label-eyebrow text-primary text-[10px] hover:underline">
              {t('markAllRead')}
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-80 divide-y divide-border">
        {notifications.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">{t('noNotifications')}</div>
        )}
        {notifications.slice(0, 20).map((n) => (
          <div
            key={n.id}
            onClick={() => handleMark(n)}
            className={cn(
              'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50',
              !n.read && 'bg-primary/5'
            )}
          >
            <div className={cn('h-8 w-8 rounded-xl grid place-items-center flex-shrink-0 mt-0.5', NOTE_COLOURS[n.type] || 'bg-muted text-muted-foreground')}>
              {n.type === 'leave_request' && <FileText className="h-3.5 w-3.5" />}
              {n.type === 'leave_status'  && <Check className="h-3.5 w-3.5" />}
              {n.type === 'message'       && <MessageSquare className="h-3.5 w-3.5" />}
              {n.type === 'announcement'  && <Bell className="h-3.5 w-3.5" />}
              {(n.type === 'crm_ticket' || n.type === 'ticket_update') && <BookMarked className="h-3.5 w-3.5" />}
              {!['leave_request','leave_status','message','announcement','crm_ticket','ticket_update'].includes(n.type) && <Bell className="h-3.5 w-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold truncate">{n.title}</span>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
              <span className="label-eyebrow text-muted-foreground mt-1 block">{relativeTime(n)}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function DashboardLayout() {
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { tenant, subscription } = useTenant();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const bellRef = useRef(null);
  const profileRef = useRef(null);

  // Multi-child switcher state — read from ParentChildContext if available
  const parentCtx = React.useContext(ParentChildContext);
  const isParent = roleKey(profile?.role) === 'PARENT';

  const items = useMemo(() => {
    const baseRole = roleKey(profile?.role);
    let baseItems = [...(ROLE_NAV[baseRole] || [])];
    
    if (baseRole === 'STAFF' && profile?.permissions?.length > 0) {
      const extraItems = ROLE_NAV.ADMIN.filter(item => profile.permissions.includes(item.key));
      const settingsIdx = baseItems.findIndex(i => i.key === 'settings');
      if (settingsIdx !== -1) {
        baseItems = [...baseItems.slice(0, settingsIdx), ...extraItems, baseItems[settingsIdx]];
      } else {
        baseItems = [...baseItems, ...extraItems];
      }
    }
    
    return baseItems;
  }, [profile]);

  // Determine current user's notification userId
  const notifUserId = useMemo(() => {
    if (!profile) return null;
    const role = (profile.role || '').toLowerCase();
    if (role === 'school_admin' || role === 'admin') return 'admin';
    return profile.employeeId || null; // Firestore employee doc ID
  }, [profile]);

  // Real-time notification subscription
  useEffect(() => {
    if (!notifUserId) return;
    const unsub = subscribeNotifications(notifUserId, setNotifications);
    return unsub;
  }, [notifUserId]);

  // Close bell/profile dropdown when clicking outside
  useEffect(() => {
    if (!bellOpen && !profileOpen) return;
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [bellOpen, profileOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const switchLang = () => i18n.changeLanguage(i18n.language === 'te' ? 'en' : 'te');

  const SidebarBody = (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-6 pb-4 flex items-center justify-center">
        <button onClick={() => navigate('/dashboard')} className={`transition-all duration-300 overflow-hidden outline-none cursor-pointer hover:scale-105 ${collapsed ? 'w-12 h-12' : 'w-full px-2 h-28'}`}>
          <img src={logoSrc} alt="St. Paul's High School" className="w-full h-full object-contain" />
        </button>
      </div>

      <div className="px-5 mt-3 mb-2">
        {!collapsed && <div className="label-eyebrow text-muted-foreground">{t('coreOps')}</div>}
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto thin-scrollbar pb-4">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end || it.to === '/dashboard' || it.to === '/dashboard/parent-dashboard'}
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

      <div className="px-4 pb-2">
      </div>

      <div className="p-3 mt-auto">
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
        <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 sm:px-6 h-16 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-xl hover:bg-muted" data-testid="mobile-menu-open">
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="label-eyebrow text-muted-foreground">{tenant?.name || "St. Paul's High School"}</span>
              </div>
              {/* Multi-child switcher in topbar — only for PARENT with multiple children */}
              {isParent && parentCtx.linkedStudents.length > 1 && (
                <div className="hidden sm:flex items-center gap-1.5 ml-2">
                  <span className="label-eyebrow text-muted-foreground text-[10px]">Child:</span>
                  {parentCtx.linkedStudents.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => parentCtx.setChildIdx(i)}
                      className={`px-3 py-1.5 rounded-full label-eyebrow text-[10px] border transition-all ${
                        parentCtx.childIdx === i
                          ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                          : 'bg-muted border-border text-muted-foreground hover:border-fuchsia-400'
                      }`}
                    >
                      {c.name?.split(' ')[0] || `Child ${i + 1}`}
                    </button>
                  ))}
                </div>
              )}
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

              {/* Bell with notification dropdown */}
              <div className="relative" ref={bellRef}>
                <button
                  data-testid="bell-btn"
                  onClick={() => setBellOpen(v => !v)}
                  className="relative p-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-rose-500 text-white text-[9px] font-black grid place-items-center border-2 border-background"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </button>

                <AnimatePresence>
                  {bellOpen && (
                    <NotificationDropdown
                      notifications={notifications}
                      userId={notifUserId}
                      onClose={() => setBellOpen(false)}
                      t={t}
                    />
                  )}
                </AnimatePresence>
              </div>

              <div className="hidden sm:block h-6 w-px bg-border mx-1" />
              
              <div className="hidden sm:block h-6 w-px bg-border mx-1" />

              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  className="flex items-center gap-2.5 p-1 rounded-full hover:bg-muted/50 transition-colors"
                >
                  <div className="hidden sm:block leading-tight text-right">
                    <div className="text-sm font-bold">{profile?.fullName || profile?.displayName || 'User'}</div>
                    <div className="label-eyebrow text-muted-foreground">{profile?.role || 'GUEST'}</div>
                  </div>
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-white text-sm font-black">
                    {(profile?.fullName || profile?.email || 'U')[0].toUpperCase()}
                  </div>
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-[1.5rem] shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-3 border-b border-border bg-muted/30">
                        <div className="font-bold text-sm text-foreground truncate">{profile?.fullName || profile?.displayName || 'User'}</div>
                        <div className="text-xs text-muted-foreground truncate">{profile?.email || profile?.phoneNumber || ''}</div>
                      </div>
                      <div className="p-2 space-y-1">
                        <button
                          data-testid="theme-toggle-dropdown"
                          onClick={() => { toggle(); setProfileOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-semibold text-muted-foreground hover:text-foreground"
                        >
                          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                          {theme === 'dark' ? t('lightMode') : t('darkMode')}
                        </button>
                        <button
                          data-testid="sign-out-dropdown"
                          onClick={() => { handleSignOut(); setProfileOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors text-sm font-semibold"
                        >
                          <LogOut className="h-4 w-4" />
                          {t('signOut')}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
