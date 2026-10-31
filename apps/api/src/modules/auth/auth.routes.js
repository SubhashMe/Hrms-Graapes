import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

const COOKIE_NAME = 'graapes_session';
const ttlSeconds = Math.max(1, Number(env.SESSION_TTL_HOURS) || 8) * 60 * 60;
const sign = (value) => crypto.createHmac('sha256', env.SESSION_SECRET).update(value).digest('base64url');
const safeEqual = (a, b) => {
  const aa = Buffer.from(a || ''); const bb = Buffer.from(b || '');
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
};
function createToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}
function readToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra || !safeEqual(signature, sign(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now() || !payload.sub) return null;
    return payload;
  } catch { return null; }
}
const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/', maxAge: ttlSeconds * 1000 });
const publicUser = (user) => ({ id: user.id, email: user.email, role: user.role, employeeId: user.employee?.id ?? null, employeeCode: user.employee?.employeeCode ?? null, fullName: user.employee?.fullName ?? (user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.email.split('@')[0]) });

export function authRouter() {
  const router = Router();

  router.post('/login', async (req, res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || !password || password.length > 200) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter your email and password.' } });
      const user = await prisma.userAccount.findUnique({ where: { email }, include: { employee: true } });
      // Always do a bcrypt comparison to reduce email-enumeration timing differences.
      const dummyHash = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.3K4xG7GkRz0y5dJ9kG6qVx5Kj5G8M5e';
      const passwordOk = await bcrypt.compare(password, user?.passwordHash || dummyHash).catch(() => false);
      if (!user || !user.isActive || !user.passwordHash || !passwordOk || (user.lockedUntil && user.lockedUntil > new Date())) {
        if (user && user.isActive && (!user.lockedUntil || user.lockedUntil <= new Date())) {
          const failed = user.failedLogins + 1;
          await prisma.userAccount.update({ where: { id: user.id }, data: { failedLogins: failed, ...(failed >= 8 ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000), failedLogins: 0 } : {}) } });
        }
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect, or the account is temporarily locked.' } });
      }
      await prisma.userAccount.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
      const token = createToken({ sub: user.id, tv: user.tokenVersion, exp: Date.now() + ttlSeconds * 1000 });
      res.cookie(COOKIE_NAME, token, cookieOptions());
      return res.json({ user: publicUser(user) });
    } catch (error) { return next(error); }
  });

  router.get('/me', async (req, res, next) => {
    try {
      const payload = readToken(req.cookies?.[COOKIE_NAME]);
      if (!payload) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
      const user = await prisma.userAccount.findUnique({ where: { id: payload.sub }, include: { employee: true } });
      if (!user || !user.isActive || user.tokenVersion !== payload.tv) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Session expired. Please sign in again.' } });
      return res.json({ user: publicUser(user) });
    } catch (error) { return next(error); }
  });

  async function currentAccount(req) {
    const payload = readToken(req.cookies?.[COOKIE_NAME]);
    if (!payload) return null;
    const user = await prisma.userAccount.findUnique({ where: { id: payload.sub }, include: { employee: { include: { department: true, designation: true, manager: true } } } });
    if (!user || !user.isActive || user.tokenVersion !== payload.tv) return null;
    return user;
  }

  const profilePayload = (user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.employee?.fullName || user.displayName || (user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.email.split('@')[0]),
    employee: user.employee ? {
      id: user.employee.id,
      employeeCode: user.employee.employeeCode,
      fullName: user.employee.fullName,
      workEmail: user.employee.workEmail,
      mobile: user.employee.mobile,
      personalAddress: user.employee.personalAddress,
      dateOfBirth: user.employee.dateOfBirth,
      employmentType: user.employee.employmentType,
      status: user.employee.status,
      joiningDate: user.employee.joiningDate,
      probationEndDate: user.employee.probationEndDate,
      workLocation: user.employee.workLocation,
      department: user.employee.department?.name || null,
      designation: user.employee.designation?.title || null,
      manager: user.employee.manager?.fullName || null,
      emergencyName: user.employee.emergencyName,
      emergencyRelation: user.employee.emergencyRelation,
      emergencyPhone: user.employee.emergencyPhone,
    } : {
      id: null,
      employeeCode: null,
      fullName: user.displayName || (user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.email.split('@')[0]),
      workEmail: user.email,
      mobile: user.mobile,
      personalAddress: user.personalAddress,
      dateOfBirth: user.dateOfBirth,
      employmentType: null, status: null, joiningDate: null, probationEndDate: null,
      workLocation: null, department: null, designation: null, manager: null,
      emergencyName: null, emergencyRelation: null, emergencyPhone: null,
    },
  });

  router.get('/profile', async (req, res, next) => {
    try {
      const user = await currentAccount(req);
      if (!user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.' } });
      return res.json({ profile: profilePayload(user) });
    } catch (error) { return next(error); }
  });

  router.put('/profile', async (req, res, next) => {
    try {
      const user = await currentAccount(req);
      if (!user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.' } });
      const body = req.body || {};
      if (!user.employee) {
        const allowedAccount = ['fullName', 'mobile', 'personalAddress', 'dateOfBirth'];
        const accountData = {};
        for (const key of allowedAccount) {
          if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
          const value = body[key];
          if (value !== null && typeof value !== 'string') return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `Invalid value for ${key}.` } });
          const clean = typeof value === 'string' ? value.trim() : null;
          if (clean && clean.length > (key === 'personalAddress' ? 1000 : 160)) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `${key} is too long.` } });
          accountData[key === 'fullName' ? 'displayName' : key] = clean || null;
        }
        if (accountData.displayName !== undefined && (!accountData.displayName || accountData.displayName.length < 2)) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter your full name.' } });
        if (accountData.dateOfBirth) {
          const parsed = new Date(`${accountData.dateOfBirth}T00:00:00.000Z`);
          if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== accountData.dateOfBirth) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid date of birth.' } });
          accountData.dateOfBirth = parsed;
        }
        await prisma.userAccount.update({ where: { id: user.id }, data: accountData });
        const refreshedAccount = await prisma.userAccount.findUnique({ where: { id: user.id }, include: { employee: { include: { department: true, designation: true, manager: true } } } });
        return res.json({ message: 'Profile updated successfully.', profile: profilePayload(refreshedAccount) });
      }
      const allowed = ['fullName', 'mobile', 'personalAddress', 'dateOfBirth', 'workLocation', 'emergencyName', 'emergencyRelation', 'emergencyPhone'];
      const data = {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          const value = body[key];
          if (value !== null && typeof value !== 'string') return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `Invalid value for ${key}.` } });
          const clean = typeof value === 'string' ? value.trim() : null;
          if (clean && clean.length > (key === 'personalAddress' ? 1000 : 160)) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `${key} is too long.` } });
          data[key] = clean || null;
        }
      }
      if (data.fullName !== undefined && (!data.fullName || data.fullName.length < 2)) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter your full name.' } });
      if (data.dateOfBirth) {
        const parsed = new Date(`${data.dateOfBirth}T00:00:00.000Z`);
        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== data.dateOfBirth) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid date of birth.' } });
        data.dateOfBirth = parsed;
      }
      const before = user.employee;
      const updated = await prisma.employee.update({ where: { id: before.id }, data });
      const history = allowed.filter((key) => data[key] !== undefined && String(before[key] ?? '') !== String(updated[key] ?? '')).map((key) => ({ employeeId: before.id, field: key, oldValue: before[key] instanceof Date ? before[key].toISOString().slice(0, 10) : (before[key] == null ? null : String(before[key])), newValue: updated[key] instanceof Date ? updated[key].toISOString().slice(0, 10) : (updated[key] == null ? null : String(updated[key])) }));
      if (history.length) await prisma.employeeHistory.createMany({ data: history });
      const refreshed = await prisma.userAccount.findUnique({ where: { id: user.id }, include: { employee: { include: { department: true, designation: true, manager: true } } } });
      return res.json({ message: 'Profile updated successfully.', profile: profilePayload(refreshed) });
    } catch (error) { return next(error); }
  });



  // Employee directory and account provisioning (HR Admin / Super Admin only).
  router.get('/employees', async (req, res, next) => {
    try {
      const actor = await currentAccount(req);
      if (!actor) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.' } });
      if (!['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(actor.role)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to the employee directory.' } });
      const where = actor.role === 'MANAGER' && actor.employee ? { managerId: actor.employee.id, isActive: true } : {};
      const employees = await prisma.employee.findMany({ where, orderBy: [{ createdAt: 'desc' }], include: { department: true, designation: true, manager: true, userAccount: { select: { email: true, isActive: true, role: true } } } });
      return res.json({ employees: employees.map((e) => ({ id: e.id, employeeCode: e.employeeCode, fullName: e.fullName, email: e.workEmail, mobile: e.mobile, status: e.status, employmentType: e.employmentType, joiningDate: e.joiningDate, department: e.department?.name || null, designation: e.designation?.title || null, manager: e.manager?.fullName || null, accountActive: e.userAccount?.isActive ?? false })) });
    } catch (error) { return next(error); }
  });

  router.get('/organization-options', async (req, res, next) => {
    try {
      const actor = await currentAccount(req);
      if (!actor) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.' } });
      const [departments, designations, managers] = await Promise.all([
        prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
        prisma.designation.findMany({ where: { isActive: true }, orderBy: { title: 'asc' }, select: { id: true, title: true, departmentId: true } }),
        prisma.employee.findMany({ where: { isActive: true, status: { not: 'EXITED' } }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, employeeCode: true } }),
      ]);
      return res.json({ departments, designations, managers });
    } catch (error) { return next(error); }
  });

  router.post('/employees', async (req, res, next) => {
    try {
      const actor = await currentAccount(req);
      if (!actor) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in again.' } });
      if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(actor.role)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only HR Admin or Super Admin can add employees.' } });
      const body = req.body || {};
      const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const joiningDateText = typeof body.joiningDate === 'string' && body.joiningDate ? body.joiningDate : new Date().toISOString().slice(0, 10);
      const employmentType = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].includes(body.employmentType) ? body.employmentType : 'FULL_TIME';
      if (fullName.length < 2 || fullName.length > 160) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid employee name.' } });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid work email.' } });
      const joiningDate = new Date(`${joiningDateText}T00:00:00.000Z`);
      if (Number.isNaN(joiningDate.getTime()) || joiningDate.toISOString().slice(0, 10) !== joiningDateText) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid joining date.' } });
      const existing = await prisma.userAccount.findUnique({ where: { email } });
      const existingEmployee = await prisma.employee.findUnique({ where: { workEmail: email } });
      if (existing || existingEmployee) return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'An account already exists with this email.' } });
      const [department, designation, manager] = await Promise.all([
        body.departmentId ? prisma.department.findFirst({ where: { id: body.departmentId, isActive: true } }) : null,
        body.designationId ? prisma.designation.findFirst({ where: { id: body.designationId, isActive: true } }) : null,
        body.managerId ? prisma.employee.findFirst({ where: { id: body.managerId, isActive: true } }) : null,
      ]);
      if (body.departmentId && !department) return res.status(400).json({ error: { code: 'INVALID_DEPARTMENT', message: 'Selected department was not found.' } });
      if (body.designationId && !designation) return res.status(400).json({ error: { code: 'INVALID_DESIGNATION', message: 'Selected designation was not found.' } });
      if (designation?.departmentId && department && designation.departmentId !== department.id) return res.status(400).json({ error: { code: 'DEPARTMENT_MISMATCH', message: 'Select a designation belonging to the selected department.' } });
      if (body.managerId && !manager) return res.status(400).json({ error: { code: 'INVALID_MANAGER', message: 'Selected manager was not found.' } });
      const last = await prisma.employee.count();
      let employeeCode = `GRA-EMP-${String(last + 1).padStart(4, '0')}`;
      while (await prisma.employee.findUnique({ where: { employeeCode } })) employeeCode = `GRA-EMP-${String(Number(employeeCode.split('-').at(-1)) + 1).padStart(4, '0')}`;
      const temporaryPassword = `Gr${crypto.randomBytes(9).toString('base64url')}!7`;
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);
      const created = await prisma.$transaction(async (tx) => {
        const account = await tx.userAccount.create({ data: { email, displayName: fullName, passwordHash, role: 'EMPLOYEE' } });
        const employee = await tx.employee.create({ data: { employeeCode, fullName, workEmail: email, employmentType, joiningDate, departmentId: department?.id || null, designationId: designation?.id || null, managerId: manager?.id || null, userAccountId: account.id, mobile: typeof body.mobile === 'string' ? body.mobile.trim() || null : null }, include: { department: true, designation: true, manager: true } });
        return employee;
      });
      return res.status(201).json({ message: 'Employee and login account created.', employee: { id: created.id, employeeCode: created.employeeCode, fullName: created.fullName, email: created.workEmail, department: created.department?.name || null, designation: created.designation?.title || null }, login: { email, temporaryPassword, instruction: 'Share these credentials securely. Ask the employee to change the password after first login.' } });
    } catch (error) { return next(error); }
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/' });
    return res.json({ ok: true });
  });
  return router;
}

export function roleDashboard(role) {
  return ({ SUPER_ADMIN: '/dashboard/super-admin', HR_ADMIN: '/dashboard/hr-admin', MANAGER: '/dashboard/manager', EMPLOYEE: '/dashboard/employee', FINANCE: '/dashboard/super-admin' })[role] || '/login';
}
