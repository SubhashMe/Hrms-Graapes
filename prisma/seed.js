// Seed script. Safe to run more than once (uses upsert).
//   npm run db:seed
// Creates: base settings, DEMO-DEFAULT leave types (no entitlements), and the first Super Admin
// from .env. Synthetic demo people are added on Day 2/3 behind SEED_DEMO_DATA=true.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12 || password.startsWith('CHANGE_ME')) {
    throw new Error(
      'Set SUPER_ADMIN_EMAIL and a real SUPER_ADMIN_PASSWORD (min 12 chars) in .env before seeding.',
    );
  }

  // Organization settings (workplace name is editable later from Settings and persisted here).
  const settings = {
    workplaceName: 'Graapes Private Limited',
    timezone: process.env.COMPANY_TIMEZONE || 'Asia/Kolkata', // BR-009 proposal
    allowSelfApproval: false, // BR-005
    payrollEnabled: false, // AC-12: payroll stays off
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.organizationSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // DEMO-DEFAULT leave types. annualAllowance stays NULL: HR must configure entitlements (OQ-05).
  const leaveTypes = [
    { code: 'CASUAL', name: 'Casual Leave', requiresReason: false },
    { code: 'SICK', name: 'Sick Leave', requiresReason: true },
    { code: 'UNPAID', name: 'Unpaid Leave', isPaid: false, requiresReason: true },
  ];
  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({ where: { code: lt.code }, update: {}, create: lt });
  }

  // First Super Admin. Password comes from .env, is hashed, and is never logged.
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.userAccount.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, role: 'SUPER_ADMIN', isActive: true },
  });

  console.log(`Seed complete. Super Admin account: ${email}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
