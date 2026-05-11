import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './i18n/config';

import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import AdminDashboard from './pages/Dashboard';
import StaffDashboard from './pages/StaffDashboard';
import ParentDashboard from './pages/ParentDashboard';
import StudentsModule from './pages/StudentsModule';
import AcademicModule from './pages/AcademicModule';
import FinanceModule from './pages/FinanceModule';
import EmployeesModule from './pages/EmployeesModule';
import AttendanceModule from './pages/AttendanceModule';
import CommunicationCenter from './pages/CommunicationCenter';
import CRMPanel from './pages/CRMPanel';
import AccountSettings from './pages/AccountSettings';
import BulkImport from './pages/BulkImport';
import ResultsEntry from './pages/ResultsEntry';
import StudentAttendance from './pages/StudentAttendance';
import IDCards from './pages/IDCards';
import Transport from './pages/Transport';
import Hostel from './pages/Hostel';
import RazorpaySettings from './pages/RazorpaySettings';

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="label-eyebrow">Loading…</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

function RoleHome() {
  const { profile } = useAuth();
  const role = profile?.role;
  if (role === 'PARENT') return <Navigate to="/dashboard/parent-dashboard" replace />;
  if (role === 'STAFF' || role === 'TEACHER') return <Navigate to="/dashboard/staff-dashboard" replace />;
  return <AdminDashboard />;
}

function Stub({ title }) {
  return <div className="space-y-3"><h1 className="font-display font-black text-3xl tracking-tighter uppercase">{title}</h1><div className="glass-morphism rounded-[2rem] p-8 text-center text-sm text-muted-foreground">Module scaffold ready · feature in pipeline.</div></div>;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TenantProvider>
          <BrowserRouter>
            <Toaster position="top-right" richColors />
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardLayout />}>
                  <Route index element={<RoleHome />} />
                  <Route path="staff-dashboard" element={<StaffDashboard />} />
                  <Route path="parent-dashboard/*" element={<ParentDashboard />} />
                  <Route path="students/*" element={<StudentsModule />} />
                  <Route path="academic/*" element={<AcademicModule />} />
                  <Route path="finance" element={<FinanceModule />} />
                  <Route path="employees" element={<EmployeesModule />} />
                  <Route path="attendance" element={<AttendanceModule />} />
                  <Route path="communication" element={<CommunicationCenter />} />
                  <Route path="crm" element={<CRMPanel />} />
                  <Route path="settings" element={<AccountSettings />} />
                  <Route path="branding" element={<Stub title="Branding" />} />
                  <Route path="id-cards" element={<IDCards />} />
                  <Route path="transport" element={<Transport />} />
                  <Route path="hostel" element={<Hostel />} />
                  <Route path="razorpay" element={<RazorpaySettings />} />
                  <Route path="results-entry" element={<ResultsEntry />} />
                  <Route path="student-attendance" element={<StudentAttendance />} />
                  <Route path="bulk-import" element={<BulkImport />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </TenantProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
