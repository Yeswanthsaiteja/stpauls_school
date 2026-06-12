import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './i18n/config';
import { OfflineBanner, usePushNotifications, isNative } from './hooks/useNative';

import LoginPage from './pages/LoginPage';
import AppLockScreen from './components/AppLockScreen';
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
import LibraryModule from './pages/library/LibraryModule';
import StudentAttendance from './pages/StudentAttendance';
import IDCardStudio from './pages/IDCardStudio';
import Transport from './pages/Transport';
import Hostel from './pages/Hostel';
import RazorpaySettings from './pages/RazorpaySettings';
import Timetable from './pages/Timetable';
import RfidAttendance from './pages/RfidAttendance';
import AttendanceStatus from './pages/AttendanceStatus';
import LeaveManagement from './pages/LeaveManagement';
import HolidaysCalendar from './pages/HolidaysCalendar';
import EmployeeAdd from './pages/EmployeeAdd';
import EmployeeDirectoryPage from './pages/employees/EmployeeDirectoryPage';
import EmployeeRemoval from './pages/employees/EmployeeRemoval';
import EmployeeRejoin from './pages/employees/EmployeeRejoin';
import StudentDirectoryPage from './pages/students/StudentDirectoryPage';
import StudentProfile from './pages/students/StudentProfile';
import AdmissionFormFull from './pages/students/AdmissionFormFull';
import StudentRemoval from './pages/students/StudentRemoval';
import StudentRejoin from './pages/students/StudentRejoin';
import Certificates from './pages/students/Certificates';
import ClassesSections from './pages/academic/ClassesSections';
import FeeCollection from './pages/finance/FeeCollection';
import FeeSetup from './pages/finance/FeeSetup';
import Ledger from './pages/finance/Ledger';
import Payroll from './pages/finance/Payroll';
import FeeDefaulters from './pages/finance/FeeDefaulters';
import FeeStatus from './pages/finance/FeeStatus';
import LessonPlanning from './pages/academic/LessonPlanning';
import YearEndPromotion from './pages/academic/YearEndPromotion';
import SubjectsTopicsCRUD from './pages/academic/SubjectsTopicsCRUD';
import ExamSetupPage from './pages/academic/ExamSetupPage';
import Diary from './pages/Diary';
import ExamTimetablePage from './pages/ExamTimetablePage';
import TeacherMessaging from './pages/TeacherMessaging';

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
  if (!role) return <AdminDashboard />;
  const r = role.toLowerCase().trim();
  if (r === 'parent') return <Navigate to="/dashboard/parent-dashboard" replace />;
  if (r === 'school_admin' || r === 'admin') return <AdminDashboard />;
  return <Navigate to="/dashboard/staff-dashboard" replace />;
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
            <OfflineBanner />
            <Toaster position="top-right" richColors />
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardLayout />}>
                  <Route index element={<RoleHome />} />
                  <Route path="staff-dashboard/*" element={<StaffDashboard />} />
                  <Route path="parent-dashboard/*" element={<ParentDashboard />} />
                  <Route path="students/*" element={<StudentsModule />} />
                  <Route path="academic/*" element={<AcademicModule />} />
                  <Route path="finance" element={<FinanceModule />} />
                  <Route path="employees" element={<EmployeesModule />} />
                  <Route path="attendance" element={<AttendanceModule />} />
                  <Route path="library/*" element={<LibraryModule />} />
                  <Route path="communication" element={<CommunicationCenter />} />
                  <Route path="crm" element={<CRMPanel />} />
                  <Route path="settings" element={<AccountSettings />} />
                  <Route path="branding" element={<Stub title="Branding" />} />
                  <Route path="id-cards" element={<IDCardStudio />} />
                  <Route path="transport" element={<Transport />} />
                  <Route path="hostel" element={<Hostel />} />
                  <Route path="razorpay" element={<RazorpaySettings />} />
                  <Route path="results-entry" element={<ResultsEntry />} />
                  <Route path="student-attendance" element={<StudentAttendance />} />
                  <Route path="attendance-status" element={<AttendanceStatus />} />
                  <Route path="rfid-attendance" element={<RfidAttendance />} />
                  <Route path="leave-management" element={<LeaveManagement />} />
                  <Route path="holidays" element={<HolidaysCalendar />} />
                  <Route path="bulk-import" element={<BulkImport />} />
                  <Route path="timetable" element={<Timetable />} />
                  <Route path="employees/add" element={<EmployeeAdd />} />
                  <Route path="employees/directory" element={<EmployeeDirectoryPage />} />
                  <Route path="employees/removal" element={<EmployeeRemoval />} />
                  <Route path="employees/rejoin" element={<EmployeeRejoin />} />
                  <Route path="finance/setup" element={<FeeSetup />} />
                  <Route path="finance/collect/:studentId" element={<FeeCollection />} />
                  <Route path="finance/collect" element={<FeeCollection />} />
                  <Route path="finance/defaulters" element={<FeeDefaulters />} />
                  <Route path="finance/status" element={<FeeStatus />} />
                  <Route path="students/directory" element={<StudentDirectoryPage />} />
                  <Route path="students/profile/:id" element={<StudentProfile />} />
                  <Route path="students/admission-full" element={<AdmissionFormFull />} />
                  <Route path="students/edit/:id" element={<AdmissionFormFull />} />
                  <Route path="students/removal" element={<StudentRemoval />} />
                  <Route path="students/rejoin" element={<StudentRejoin />} />
                  <Route path="students/certificates" element={<Certificates />} />
                  <Route path="finance/ledger" element={<Ledger />} />
                  <Route path="finance/payroll" element={<Payroll />} />
                  <Route path="diary" element={<Diary />} />
                  <Route path="exam-timetable" element={<ExamTimetablePage />} />
                  <Route path="messaging" element={<TeacherMessaging />} />
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
