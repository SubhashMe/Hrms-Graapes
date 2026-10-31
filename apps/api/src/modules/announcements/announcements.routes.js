import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRoles, logAudit } from '../../middleware/auth.js';

export function announcementsRouter() {
  const router = Router();

  // GET /api/announcements
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role);

      const whereClause = isAdmin
        ? {}
        : {
            status: 'PUBLISHED',
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } },
            ],
          };

      const announcements = await prisma.announcement.findMany({
        where: whereClause,
        include: {
          audiences: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json({
        announcements: announcements.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          status: a.status,
          publishAt: a.publishAt,
          createdAt: a.createdAt,
          audience: a.audiences.length ? a.audiences[0].type : 'ALL',
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/announcements (HR/Admin)
  router.post('/', requireAuth, requireRoles('SUPER_ADMIN', 'HR_ADMIN'), async (req, res, next) => {
    try {
      const { title, body, audienceType = 'ALL', departmentId, role } = req.body || {};
      if (!title || !body) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Title and message body are required.' } });
      }

      const announcement = await prisma.announcement.create({
        data: {
          title: title.trim(),
          body: body.trim(),
          status: 'PUBLISHED',
          publishAt: new Date(),
          createdById: req.user.id,
          audiences: {
            create: {
              type: audienceType,
              departmentId: departmentId || null,
              role: role || null,
            },
          },
        },
      });

      await logAudit(req, {
        action: 'ANNOUNCEMENT_PUBLISHED',
        entityType: 'Announcement',
        entityId: announcement.id,
        after: { title: announcement.title },
      });

      return res.status(201).json({ announcement });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

