import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles, logAudit } from '../../middleware/auth.js';

export function organizationRouter() {
  const router = Router();

  // GET /api/organization/options (used by employee forms)
  router.get('/options', requireAuth, async (_req, res, next) => {
    try {
      const [departments, designations, managers] = await Promise.all([
        prisma.department.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true },
        }),
        prisma.designation.findMany({
          where: { isActive: true },
          orderBy: { title: 'asc' },
          select: { id: true, title: true, departmentId: true },
        }),
        prisma.employee.findMany({
          where: { isActive: true, status: { not: 'EXITED' } },
          orderBy: { fullName: 'asc' },
          select: { id: true, fullName: true, employeeCode: true },
        }),
      ]);

      return res.json({ departments, designations, managers });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/organization/departments
  router.get('/departments', requireAuth, async (_req, res, next) => {
    try {
      const departments = await prisma.department.findMany({
        orderBy: { name: 'asc' },
        include: {
          head: { select: { id: true, fullName: true } },
          _count: { select: { employees: true, designations: true } },
        },
      });

      return res.json({
        departments: departments.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          headName: d.head?.fullName || null,
          headId: d.headId,
          employeeCount: d._count.employees,
          designationCount: d._count.designations,
          isActive: d.isActive,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/organization/departments (HR/Admin)
  router.post('/departments', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { name, code, headId } = req.body || {};
      if (!name || !code) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Department name and code are required.' } });
      }

      const existing = await prisma.department.findFirst({
        where: {
          OR: [{ name: name.trim() }, { code: code.trim().toUpperCase() }],
        },
      });

      if (existing) {
        return res.status(409).json({ error: { code: 'ALREADY_EXISTS', message: 'Department with this name or code already exists.' } });
      }

      const department = await prisma.department.create({
        data: {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          headId: headId || null,
          isActive: true,
        },
      });

      await logAudit(req, {
        action: 'DEPARTMENT_CREATED',
        entityType: 'Department',
        entityId: department.id,
        after: department,
      });

      return res.status(201).json({ department });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/organization/designations
  router.get('/designations', requireAuth, async (_req, res, next) => {
    try {
      const designations = await prisma.designation.findMany({
        orderBy: { title: 'asc' },
        include: {
          department: { select: { id: true, name: true } },
          _count: { select: { employees: true } },
        },
      });

      return res.json({
        designations: designations.map((d) => ({
          id: d.id,
          title: d.title,
          departmentId: d.departmentId,
          departmentName: d.department?.name || 'All Departments',
          employeeCount: d._count.employees,
          isActive: d.isActive,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/organization/designations (HR/Admin)
  router.post('/designations', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { title, departmentId } = req.body || {};
      if (!title) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Designation title is required.' } });
      }

      const designation = await prisma.designation.create({
        data: {
          title: title.trim(),
          departmentId: departmentId || null,
          isActive: true,
        },
        include: { department: true },
      });

      await logAudit(req, {
        action: 'DESIGNATION_CREATED',
        entityType: 'Designation',
        entityId: designation.id,
        after: designation,
      });

      return res.status(201).json({ designation });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

