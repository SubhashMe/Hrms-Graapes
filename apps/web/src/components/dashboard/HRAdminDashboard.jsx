import DashboardPage from './DashboardPage.jsx';
import { BriefcaseBusiness, Building2, CalendarCheck, CalendarDays, ClipboardList, Clock3, FileBarChart, FolderLock, Megaphone, Network, Plane, ScrollText, Settings, ShieldCheck, UserCheck, Users } from 'lucide-react';

const config = {
 eyebrow: "HR ADMIN", title: "HR operations dashboard", subtitle: "Manage employee lifecycle, attendance, leave, documents and HR reporting.",
 stats: [{ label: "Employees", note: "Current records", icon: Users },
{ label: "Present today", note: "Today\u2019s summary", icon: Building2 },
{ label: "Pending leave requests", note: "Needs attention", icon: UserCheck },
{ label: "Attendance corrections", note: "Requires review", icon: Clock3 }],
 actions: [{ label: "Employee directory", to: "/employees", icon: Users },
{ label: "Attendance review", to: "/attendance", icon: CalendarCheck },
{ label: "Leave approvals", to: "/leave", icon: Plane }],
 sections: [{ title: "People operations", items: [{ title: "Employee management", description: "Create and update employee profiles" },{ title: "Attendance management", description: "Manage departments, designations and reporting managers" },{ title: "Leave management", description: "Track onboarding, offboarding and required documents" }] }, { title: "Attendance & leave", items: [{ title: "Employee management", description: "Review check-in/check-out records and missing punches" },{ title: "Attendance management", description: "Approve or reject leave requests within HR scope" },{ title: "Leave management", description: "Maintain leave policies, holidays and monthly reports" }] }]
};
export default function HRAdminDashboard() { return <DashboardPage config={config} />; }
