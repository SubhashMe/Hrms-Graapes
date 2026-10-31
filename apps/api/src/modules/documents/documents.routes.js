import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, logAudit } from '../../middleware/auth.js';

export function documentsRouter() {
  const router = Router();

  // GET /api/documents
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      let whereClause = {};

      if (['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
        whereClause = { deletedAt: null };
      } else {
        whereClause = {
          employeeId: user.employee?.id || 'none',
          deletedAt: null,
        };
      }

      const documents = await prisma.employeeDocument.findMany({
        where: whereClause,
        include: {
          employee: {
            select: { id: true, fullName: true, employeeCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json({
        documents: documents.map((d) => ({
          id: d.id,
          employeeId: d.employeeId,
          employeeName: d.employee?.fullName,
          employeeCode: d.employee?.employeeCode,
          category: d.category,
          title: d.title,
          fileName: d.fileName,
          sizeBytes: d.sizeBytes,
          createdAt: d.createdAt,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/documents (Record document metadata)
  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const { title, fileName, category = 'OTHER', targetEmployeeId } = req.body || {};

      if (!title || !fileName) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Document title and file name are required.' } });
      }

      let employeeId = user.employee?.id;
      if (['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) && targetEmployeeId) {
        employeeId = targetEmployeeId;
      }

      if (!employeeId) {
        return res.status(400).json({ error: { code: 'NO_EMPLOYEE', message: 'No employee record targeted.' } });
      }

      const storageKey = `doc_${crypto.randomUUID()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      const doc = await prisma.employeeDocument.create({
        data: {
          employeeId,
          category: ['RESUME', 'ID_PROOF', 'ADDRESS_PROOF', 'SIGNED_LETTER', 'CERTIFICATE', 'OTHER'].includes(category) ? category : 'OTHER',
          title: title.trim(),
          fileName: fileName.trim(),
          storageKey,
          mimeType: 'application/pdf',
          sizeBytes: 1024 * 50, // placeholder record size
          uploadedById: user.id,
        },
      });

      await logAudit(req, {
        action: 'DOCUMENT_RECORD_ADDED',
        entityType: 'EmployeeDocument',
        entityId: doc.id,
        after: { title: doc.title, category: doc.category },
      });

      return res.status(201).json({ document: doc });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

