import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles, logAudit } from '../../middleware/auth.js';
import { parseDateOnly } from '../../lib/dateUtils.js';

export function employeesRouter() {
  const router = Router();

  // GET /api/employees: List employees
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const { q = '', departmentId = '', status = '', managerOnly = 'false' } = req.query;

      let whereClause = {};

      if (['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
        whereClause = {};
      } else if (user.role === 'MANAGER') {
        const empId = user.employee?.id;
        if (managerOnly === 'true' || !user.employee) {
          whereClause = { managerId: empId, isActive: true };
        } else {
          whereClause = {
            OR: [
              { managerId: empId },
              { id: empId },
              { isActive: true },
            ],
          };
        }
      } else {
        whereClause = { isActive: true };
      }

      if (q && typeof q === 'string') {
        whereClause.OR = [
          { fullName: { contains: q.trim(), mode: 'insensitive' } },
          { employeeCode: { contains: q.trim(), mode: 'insensitive' } },
          { workEmail: { contains: q.trim(), mode: 'insensitive' } },
        ];
      }

      if (departmentId) {
        whereClause.departmentId = departmentId;
      }

      if (status) {
        whereClause.status = status;
      }

      const employees = await prisma.employee.findMany({
        where: whereClause,
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, title: true } },
          manager: { select: { id: true, fullName: true, employeeCode: true } },
          userAccount: { select: { id: true, role: true, isActive: true, lastLoginAt: true } },
        },
        orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
      });

      return res.json({
        employees: employees.map((e) => ({
          id: e.id,
          employeeCode: e.employeeCode,
          fullName: e.fullName,
          workEmail: e.workEmail,
          mobile: e.mobile,
          employmentType: e.employmentType,
          status: e.status,
          joiningDate: e.joiningDate ? e.joiningDate.toISOString().slice(0, 10) : null,
          workLocation: e.workLocation,
          department: e.department?.name || 'Unassigned',
          departmentId: e.departmentId,
          designation: e.designation?.title || 'Unassigned',
          designationId: e.designationId,
          manager: e.manager?.fullName || 'None',
          managerId: e.managerId,
          role: e.userAccount?.role || 'EMPLOYEE',
          accountActive: e.userAccount?.isActive ?? e.isActive,
          lastLoginAt: e.userAccount?.lastLoginAt,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/employees/:id: Details
  router.get('/:id', requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          department: true,
          designation: true,
          manager: true,
          userAccount: { select: { id: true, email: true, role: true, isActive: true, lastLoginAt: true } },
          history: { orderBy: { changedAt: 'desc' }, take: 10 },
        },
      });

      if (!employee) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found.' } });
      }

      return res.json({ employee });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/employees: Create employee + user account
  router.post('/', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const body = req.body || {};
      const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const role = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN'].includes(body.role) ? body.role : 'EMPLOYEE';
      const employmentType = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].includes(body.employmentType) ? body.employmentType : 'FULL_TIME';
      const joiningDateText = typeof body.joiningDate === 'string' && body.joiningDate ? body.joiningDate : new Date().toISOString().slice(0, 10);

      if (fullName.length < 2) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Full name is required (minimum 2 characters).' } });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'A valid email is required.' } });
      }

      const joiningDate = parseDateOnly(joiningDateText);

      // Check duplicate
      const [existingUser, existingEmp] = await Promise.all([
        prisma.userAccount.findUnique({ where: { email } }),
        prisma.employee.findUnique({ where: { workEmail: email } }),
      ]);

      if (existingUser || existingEmp) {
        return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'An account or employee already exists with this email.' } });
      }

      // Generate unique employee code
      const count = await prisma.employee.count();
      let codeNumber = count + 1;
      let employeeCode = `GRA-EMP-${String(codeNumber).padStart(4, '0')}`;
      while (await prisma.employee.findUnique({ where: { employeeCode } })) {
        codeNumber += 1;
        employeeCode = `GRA-EMP-${String(codeNumber).padStart(4, '0')}`;
      }

      // Generate initial password
      const temporaryPassword = `Gr${crypto.randomBytes(9).toString('base64url')}!7`;
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);

      const created = await prisma.$transaction(async (tx) => {
        const account = await tx.userAccount.create({
          data: {
            email,
            displayName: fullName,
            passwordHash,
            role,
            isActive: true,
          },
        });

        const emp = await tx.employee.create({
          data: {
            employeeCode,
            fullName,
            workEmail: email,
            mobile: body.mobile?.trim() || null,
            workLocation: body.workLocation?.trim() || 'Headquarters',
            employmentType,
            joiningDate,
            departmentId: body.departmentId || null,
            designationId: body.designationId || null,
            managerId: body.managerId || null,
            userAccountId: account.id,
            isActive: true,
          },
          include: { department: true, designation: true, manager: true },
        });

        // Initialize opening leave ledger entries (12 days Casual, 10 days Sick)
        const leaveTypes = await tx.leaveType.findMany({ where: { isActive: true } });
        const currentYear = joiningDate.getFullYear();
        for (const lt of leaveTypes) {
          await tx.leaveLedgerEntry.create({
            data: {
              employeeId: emp.id,
              leaveTypeId: lt.id,
              year: currentYear,
              kind: 'OPENING',
              days: lt.annualAllowance ? Number(lt.annualAllowance) : (lt.code === 'SICK' ? 10 : 12),
              note: 'Initial annual allocation on onboarding',
            },
          });
        }

        return emp;
      });

      await logAudit(req, {
        action: 'EMPLOYEE_CREATED',
        entityType: 'Employee',
        entityId: created.id,
        after: { employeeCode: created.employeeCode, email: created.workEmail, role },
      });

      return res.status(201).json({
        message: 'Employee and login credentials created successfully.',
        employee: created,
        credentials: {
          email,
          temporaryPassword,
          instruction: 'Share these login credentials securely with the employee.',
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  // PATCH /api/employees/:id: Update employee details
  router.patch('/:id', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const body = req.body || {};

      const employee = await prisma.employee.findUnique({
        where: { id },
        include: { userAccount: true },
      });

      if (!employee) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found.' } });
      }

      const updateData = {};
      const allowed = ['fullName', 'mobile', 'workLocation', 'departmentId', 'designationId', 'managerId', 'employmentType', 'status'];

      for (const key of allowed) {
        if (body[key] !== undefined) {
          updateData[key] = body[key] === '' ? null : body[key];
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const emp = await tx.employee.update({
          where: { id },
          data: updateData,
          include: { department: true, designation: true, manager: true },
        });

        if (body.role && employee.userAccount) {
          await tx.userAccount.update({
            where: { id: employee.userAccount.id },
            data: { role: body.role },
          });
        }

        // Record history of changes (AC-03)
        const historyRows = [];
        for (const [field, newVal] of Object.entries(updateData)) {
          const oldVal = employee[field];
          if (String(oldVal || '') !== String(newVal || '')) {
            historyRows.push({
              employeeId: id,
              field,
              oldValue: oldVal ? String(oldVal) : null,
              newValue: newVal ? String(newVal) : null,
              changedById: req.user.employee?.id || req.user.id,
            });
          }
        }

        if (historyRows.length > 0) {
          await tx.employeeHistory.createMany({ data: historyRows });
        }

        return emp;
      });

      await logAudit(req, {
        action: 'EMPLOYEE_UPDATED',
        entityType: 'Employee',
        entityId: id,
        before: employee,
        after: updated,
      });

      return res.json({ message: 'Employee updated successfully.', employee: updated });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/employees/:id/deactivate: Deactivate account (BR-007)
  router.post('/:id/deactivate', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: { userAccount: true },
      });

      if (!employee) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found.' } });
      }

      const nextActive = !employee.isActive;

      await prisma.$transaction(async (tx) => {
        await tx.employee.update({
          where: { id },
          data: {
            isActive: nextActive,
            status: nextActive ? 'ACTIVE' : 'EXITED',
          },
        });

        if (employee.userAccountId) {
          await tx.userAccount.update({
            where: { id: employee.userAccountId },
            data: {
              isActive: nextActive,
              tokenVersion: { increment: 1 }, // instantly terminates session
            },
          });
        }
      });

      await logAudit(req, {
        action: nextActive ? 'EMPLOYEE_ACTIVATED' : 'EMPLOYEE_DEACTIVATED',
        entityType: 'Employee',
        entityId: id,
        after: { isActive: nextActive },
      });

      return res.json({
        message: nextActive ? 'Employee activated successfully.' : 'Employee deactivated and session revoked.',
        isActive: nextActive,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

