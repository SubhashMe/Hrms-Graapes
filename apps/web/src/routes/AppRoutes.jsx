import { Navigate, Route, Routes } from 'react-router-dom';

import AppShell from '../layouts/AppShell.jsx';
import StatusPage from '../features/status/StatusPage.jsx';

import SuperAdminDashboard from '../components/dashboard/SuperAdminDashboard.jsx';
import HRAdminDashboard from '../components/dashboard/HRAdminDashboard.jsx';
import ManagerDashboard from '../components/dashboard/ManagerDashboard.jsx';
import EmployeeDashboard from '../components/dashboard/EmployeeDashboard.jsx';

import ComingSoon from '../features/placeholder/ComingSoon.jsx';
import EmployeeFeaturePage from '../features/placeholder/EmployeeFeaturePage.jsx';

import Login from '../pages/Login.jsx';
import ProfilePage from '../features/profile/ProfilePage.jsx';
import MyAttendance from '../features/attendance/MyAttendance.jsx';

import { NAV_ITEMS, ROLE_NAV } from '../app/navigation.js';
import { ShieldCheck } from 'lucide-react';

import { AuthGuard } from '../auth/AuthGuard.jsx';
import { useAuth } from '../app/AuthContext.jsx';

// Collect navigation items without duplicates.
// Attendance is excluded because it has its own dedicated route.
const ALL_NAV_ITEMS = [
  ...new Map(
    Object.values(ROLE_NAV)
      .flat()
      .filter(
        (item) =>
          !item.built &&
          item.to !== '/' &&
          item.to !== '/attendance'
      )
      .map((item) => [item.to, item])
  ).values(),
];

function RoleAwareFeature({ item }) {
  const { user } = useAuth();

  const role = String(user?.role || '')
    .trim()
    .toUpperCase()
    .replace(/[ -]/g, '_');

  const isEmployeeSelfService =
    ['EMPLOYEE', 'INTERN', 'EMPLOYEE_INTERN', 'EMPLOYEE/INTERN'].includes(
      role
    ) ||
    role.includes('EMPLOYEE') ||
    role.includes('INTERN');

  const selfServicePaths = [
    '/attendance',
    '/leave',
    '/documents',
    '/holidays',
    '/announcements',
    '/settings',
  ];

  if (isEmployeeSelfService && selfServicePaths.includes(item.to)) {
    return <EmployeeFeaturePage path={item.to} />;
  }

  return <ComingSoon item={item} />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Root and login */}
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      {/* Protected application layout */}
      <Route element={<AppShell />}>
        {/* Dedicated attendance page */}
        <Route
          path="/attendance"
          element={
            <AuthGuard>
              <MyAttendance />
            </AuthGuard>
          }
        />

        {/* Other navigation features */}
        {ALL_NAV_ITEMS.map((item) => (
          <Route
            key={item.to}
            path={item.to}
            element={
              <AuthGuard>
                <RoleAwareFeature item={item} />
              </AuthGuard>
            }
          />
        ))}

        {/* Super Admin dashboard */}
        <Route
          path="/dashboard/super-admin"
          element={
            <AuthGuard roles={['SUPER_ADMIN']}>
              <SuperAdminDashboard />
            </AuthGuard>
          }
        />

        {/* HR Admin dashboard */}
        <Route
          path="/dashboard/hr-admin"
          element={
            <AuthGuard roles={['HR_ADMIN']}>
              <HRAdminDashboard />
            </AuthGuard>
          }
        />

        {/* Manager dashboard */}
        <Route
          path="/dashboard/manager"
          element={
            <AuthGuard roles={['MANAGER']}>
              <ManagerDashboard />
            </AuthGuard>
          }
        />

        {/* Employee dashboard */}
        <Route
          path="/dashboard/employee"
          element={
            <AuthGuard roles={['EMPLOYEE', 'INTERN']}>
              <EmployeeDashboard />
            </AuthGuard>
          }
        />

        {/* System status */}
        <Route
          path="/status"
          element={
            <AuthGuard>
              <StatusPage />
            </AuthGuard>
          }
        />

        {/* User profile */}
        <Route
          path="/profile"
          element={
            <AuthGuard>
              <ProfilePage />
            </AuthGuard>
          }
        />

        {/* Super Admin only */}
        <Route
          path="/admin"
          element={
            <AuthGuard roles={['SUPER_ADMIN']}>
              <ComingSoon
                item={{
                  label: 'Admin',
                  icon: ShieldCheck,
                }}
              />
            </AuthGuard>
          }
        />

        {/* Unknown routes */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Route>
    </Routes>
  );
}