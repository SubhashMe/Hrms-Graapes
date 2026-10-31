// Seed script. Safe to run more than once (uses upsert).
//   npm run db:seed
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
const prisma = new PrismaClient();

async function main() {
  const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';
  const configuredEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const email = (isDevelopment && (!configuredEmail || configuredEmail === 'admin@example.com') ? 'superadmin@graapes.com' : configuredEmail || '').trim().toLowerCase();
  const configuredPassword = process.env.SUPER_ADMIN_PASSWORD;
  const password = (isDevelopment && (!configuredPassword || configuredPassword.startsWith('CHANGE_ME')) ? 'GraapesSuper@2026' : configuredPassword) || '';

  if (!email || !password || password.length < 12 || password.startsWith('CHANGE_ME')) {
    throw new Error('Set SUPER_ADMIN_EMAIL and a real SUPER_ADMIN_PASSWORD (min 12 chars) in .env before seeding.');
  }

  // 1. Organization settings
  const settings = {
    workplaceName: 'Graapes Private Limited',
    timezone: process.env.COMPANY_TIMEZONE || 'Asia/Kolkata',
    allowSelfApproval: false,
    payrollEnabled: false,
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.organizationSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  // 2. Leave Types with standard allowances
  const leaveTypes = [
    { code: 'CASUAL', name: 'Casual Leave', isPaid: true, annualAllowance: 12, allowHalfDay: true, requiresReason: false },
    { code: 'SICK', name: 'Sick Leave', isPaid: true, annualAllowance: 10, allowHalfDay: true, requiresReason: true },
    { code: 'UNPAID', name: 'Unpaid Leave', isPaid: false, annualAllowance: null, allowHalfDay: true, requiresReason: true },
  ];
  const seededLeaveTypes = {};
  for (const lt of leaveTypes) {
    const record = await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: { annualAllowance: lt.annualAllowance, isPaid: lt.isPaid, allowHalfDay: lt.allowHalfDay, requiresReason: lt.requiresReason },
      create: lt,
    });
    seededLeaveTypes[lt.code] = record;
  }

  // 3. Departments
  const engDept = await prisma.department.upsert({
    where: { code: 'ENG' },
    update: {},
    create: { name: 'Engineering', code: 'ENG', isActive: true },
  });
  const hrDept = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {},
    create: { name: 'Human Resources', code: 'HR', isActive: true },
  });
  const prdDept = await prisma.department.upsert({
    where: { code: 'PRD' },
    update: {},
    create: { name: 'Product & Design', code: 'PRD', isActive: true },
  });

  // 4. Designations
  const engMgrDesig = await prisma.designation.upsert({
    where: { title_departmentId: { title: 'Engineering Manager', departmentId: engDept.id } },
    update: {},
    create: { title: 'Engineering Manager', departmentId: engDept.id, isActive: true },
  });
  const sdeDesig = await prisma.designation.upsert({
    where: { title_departmentId: { title: 'Senior Software Engineer', departmentId: engDept.id } },
    update: {},
    create: { title: 'Senior Software Engineer', departmentId: engDept.id, isActive: true },
  });
  const hrMgrDesig = await prisma.designation.upsert({
    where: { title_departmentId: { title: 'HR Manager', departmentId: hrDept.id } },
    update: {},
    create: { title: 'HR Manager', departmentId: hrDept.id, isActive: true },
  });

  // 5. User Accounts
  const demoAccounts = [
    { email: 'superadmin@graapes.com', password: 'GraapesSuper@2026', role: 'SUPER_ADMIN', name: 'Super Admin' },
    { email: 'hradmin@graapes.com', password: 'GraapesHR@2026', role: 'HR_ADMIN', name: 'Priya Sharma (HR)' },
    { email: 'manager@graapes.com', password: 'GraapesMgr@2026', role: 'MANAGER', name: 'Vikram Malhotra (Manager)' },
    { email: 'employee@graapes.com', password: 'GraapesEmp@2026', role: 'EMPLOYEE', name: 'Rahul Verma (Software Engineer)' },
  ];

  const seededUsers = {};
  for (const account of demoAccounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    const u = await prisma.userAccount.upsert({
      where: { email: account.email },
      update: { passwordHash, role: account.role, isActive: true, displayName: account.name, failedLogins: 0, lockedUntil: null },
      create: { email: account.email, passwordHash, role: account.role, displayName: account.name, isActive: true },
    });
    seededUsers[account.email] = u;
  }

  // 6. Link Employee Profiles for Inter-connectedness
  // Vikram Malhotra (Engineering Manager)
  const managerEmp = await prisma.employee.upsert({
    where: { workEmail: 'manager@graapes.com' },
    update: {
      fullName: 'Vikram Malhotra',
      departmentId: engDept.id,
      designationId: engMgrDesig.id,
      userAccountId: seededUsers['manager@graapes.com'].id,
    },
    create: {
      employeeCode: 'GRA-EMP-0002',
      fullName: 'Vikram Malhotra',
      workEmail: 'manager@graapes.com',
      mobile: '+91 98765 43210',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      joiningDate: new Date('2024-01-15T00:00:00.000Z'),
      workLocation: 'Bengaluru HQ',
      departmentId: engDept.id,
      designationId: engMgrDesig.id,
      userAccountId: seededUsers['manager@graapes.com'].id,
    },
  });

  // Priya Sharma (HR Admin)
  await prisma.employee.upsert({
    where: { workEmail: 'hradmin@graapes.com' },
    update: {
      fullName: 'Priya Sharma',
      departmentId: hrDept.id,
      designationId: hrMgrDesig.id,
      userAccountId: seededUsers['hradmin@graapes.com'].id,
    },
    create: {
      employeeCode: 'GRA-EMP-0001',
      fullName: 'Priya Sharma',
      workEmail: 'hradmin@graapes.com',
      mobile: '+91 98765 11111',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      joiningDate: new Date('2023-06-01T00:00:00.000Z'),
      workLocation: 'Bengaluru HQ',
      departmentId: hrDept.id,
      designationId: hrMgrDesig.id,
      userAccountId: seededUsers['hradmin@graapes.com'].id,
    },
  });

  // Rahul Verma (Senior Software Engineer) -> Reports to Vikram Malhotra
  const devEmp = await prisma.employee.upsert({
    where: { workEmail: 'employee@graapes.com' },
    update: {
      fullName: 'Rahul Verma',
      departmentId: engDept.id,
      designationId: sdeDesig.id,
      managerId: managerEmp.id,
      userAccountId: seededUsers['employee@graapes.com'].id,
    },
    create: {
      employeeCode: 'GRA-EMP-0003',
      fullName: 'Rahul Verma',
      workEmail: 'employee@graapes.com',
      mobile: '+91 98765 22222',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      joiningDate: new Date('2024-03-01T00:00:00.000Z'),
      workLocation: 'Bengaluru HQ',
      departmentId: engDept.id,
      designationId: sdeDesig.id,
      managerId: managerEmp.id,
      userAccountId: seededUsers['employee@graapes.com'].id,
    },
  });

  // 7. Seed Opening Leave Balances
  const currentYear = new Date().getFullYear();
  for (const emp of [managerEmp, devEmp]) {
    for (const [code, lt] of Object.entries(seededLeaveTypes)) {
      if (lt.annualAllowance) {
        const existing = await prisma.leaveLedgerEntry.findFirst({
          where: { employeeId: emp.id, leaveTypeId: lt.id, year: currentYear, kind: 'OPENING' },
        });
        if (!existing) {
          await prisma.leaveLedgerEntry.create({
            data: {
              employeeId: emp.id,
              leaveTypeId: lt.id,
              year: currentYear,
              kind: 'OPENING',
              days: Number(lt.annualAllowance),
              note: `Annual ${lt.name} allowance for ${currentYear}`,
            },
          });
        }
      }
    }
  }

  // 8. Seed Holidays
  const holidays = [
    { name: 'Diwali', date: new Date('2026-11-08T00:00:00.000Z'), location: 'All Locations' },
    { name: 'Guru Nanak Jayanti', date: new Date('2026-11-24T00:00:00.000Z'), location: 'All Locations' },
    { name: 'Christmas Day', date: new Date('2026-12-25T00:00:00.000Z'), location: 'All Locations' },
  ];
  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { date_name: { date: h.date, name: h.name } },
      update: { isPublished: true },
      create: { name: h.name, date: h.date, location: h.location, isPublished: true },
    });
  }

  // 9. Seed Announcement
  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { title: 'Welcome to the Graapes HRMS Portal' },
  });
  if (!existingAnnouncement) {
    await prisma.announcement.create({
      data: {
        title: 'Welcome to the Graapes HRMS Portal',
        body: 'Welcome to the new unified core HRMS platform! You can now record daily attendance, submit leave applications, review holidays, and manage personal profiles in real-time.',
        status: 'PUBLISHED',
        publishAt: new Date(),
        createdById: seededUsers['superadmin@graapes.com'].id,
        audiences: {
          create: { type: 'ALL' },
        },
      },
    });
  }

  console.log('Seed successfully completed with interconnected organization, employees, leave balances, holidays, and announcements!');
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
