import DashboardPage from './DashboardPage.jsx';

export default function SuperAdminDashboard() {
  return <DashboardPage initialRole="SUPER_ADMIN" showRoleSelector={false} />;
}
