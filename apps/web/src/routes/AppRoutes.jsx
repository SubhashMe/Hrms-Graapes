import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from '../layouts/AppShell.jsx';
import StatusPage from '../features/status/StatusPage.jsx';
import SuperAdminDashboard from '../components/dashboard/SuperAdminDashboard.jsx';
import HRAdminDashboard from '../components/dashboard/HRAdminDashboard.jsx';
import ManagerDashboard from '../components/dashboard/ManagerDashboard.jsx';
import EmployeeDashboard from '../components/dashboard/EmployeeDashboard.jsx';
import ComingSoon from '../features/placeholder/ComingSoon.jsx';
import Login from '../pages/Login.jsx';
import { NAV_ITEMS } from '../app/navigation.js';
import { ShieldCheck } from 'lucide-react';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Login page without sidebar and header */}
      <Route path="/login" element={<Login />} />

      {/* Existing dashboard layout */}
      <Route element={<AppShell />}>
        {NAV_ITEMS.filter((n) => !n.built && n.to !== '/').map((n) => (
          <Route key={n.to} path={n.to} element={<ComingSoon item={n} />} />
        ))}

        <Route path="/" element={<SuperAdminDashboard />} />
        <Route path="/dashboard/super-admin" element={<SuperAdminDashboard />} />
        <Route path="/dashboard/hr-admin" element={<HRAdminDashboard />} />
        <Route path="/dashboard/manager" element={<ManagerDashboard />} />
        <Route path="/dashboard/employee" element={<EmployeeDashboard />} />

        <Route path="/status" element={<StatusPage />} />

        <Route
          path="/admin"
          element={<ComingSoon item={{ label: 'Admin', icon: ShieldCheck }} />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}