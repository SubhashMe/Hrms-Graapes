import {
  LayoutDashboard, Users, Network, CalendarCheck, Plane, CalendarDays, Megaphone,
  FolderLock, BarChart3, ScrollText, Settings, Activity,
} from 'lucide-react';

/**
 * Navigation registry. `built: false` means the module is not implemented yet; the page says so
 * honestly instead of pretending to work. Flip to true as each module ships.
 * `primary` items appear in the mobile bottom bar (max 4 + "More").
 * Role-based filtering is added on Day 2 with authentication.
 */
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, built: true, primary: true },
  { to: '/employees', label: 'Employees', icon: Users, built: false },
  { to: '/organization', label: 'Organization', icon: Network, built: false },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, built: false, primary: true },
  { to: '/leave', label: 'Leave', icon: Plane, built: false, primary: true },
  { to: '/holidays', label: 'Holidays', icon: CalendarDays, built: false },
  { to: '/announcements', label: 'Announcements', icon: Megaphone, built: false },
  { to: '/documents', label: 'Documents', icon: FolderLock, built: false },
  { to: '/reports', label: 'Reports', icon: BarChart3, built: false },
  { to: '/audit', label: 'Audit', icon: ScrollText, built: false },
  { to: '/settings', label: 'Settings', icon: Settings, built: false, primary: true },
  { to: '/status', label: 'System status', icon: Activity, built: true },
];
