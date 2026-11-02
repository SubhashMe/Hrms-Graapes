import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export function notificationsRouter() {
  const router = Router();

  // GET /api/notifications
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;

      const dbNotifications = await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 15,
      });

      // Synthesize dynamic contextual alerts for pending actions
      const dynamicAlerts = [];

      if (['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(user.role)) {
        let pendingWhere = { status: 'PENDING' };
        if (user.role === 'MANAGER' && user.employee) {
          pendingWhere.approverId = user.employee.id;
        }

        const [pendingLeaves, pendingCorrections] = await Promise.all([
          prisma.leaveRequest.count({ where: pendingWhere }),
          prisma.attendanceCorrection.count({ where: pendingWhere }),
        ]);

        if (pendingLeaves > 0) {
          dynamicAlerts.push({
            id: 'dyn-leaves',
            type: 'LEAVE_ACTION',
            title: 'Pending Leave Approvals',
            body: `You have ${pendingLeaves} pending leave ${pendingLeaves === 1 ? 'request' : 'requests'} awaiting your review.`,
            link: '/leave',
            readAt: null,
            createdAt: new Date(),
          });
        }

        if (pendingCorrections > 0) {
          dynamicAlerts.push({
            id: 'dyn-corrections',
            type: 'ATTENDANCE_ACTION',
            title: 'Attendance Corrections',
            body: `You have ${pendingCorrections} attendance correction ${pendingCorrections === 1 ? 'request' : 'requests'} to action.`,
            link: '/attendance',
            readAt: null,
            createdAt: new Date(),
          });
        }
      }

      // Latest company announcement notice
      const latestAnnouncement = await prisma.announcement.findFirst({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
      });

      if (latestAnnouncement) {
        dynamicAlerts.push({
          id: `dyn-ann-${latestAnnouncement.id}`,
          type: 'ANNOUNCEMENT',
          title: `Announcement: ${latestAnnouncement.title}`,
          body: latestAnnouncement.body.slice(0, 100) + '…',
          link: '/announcements',
          readAt: null,
          createdAt: latestAnnouncement.createdAt,
        });
      }

      const all = [...dynamicAlerts, ...dbNotifications];

      return res.json({
        notifications: all,
        unreadCount: all.filter((n) => !n.readAt).length,
      });
    } catch (error) {
      return next(error);
    }
  });

  // PATCH /api/notifications/:id/read
  router.patch('/:id/read', requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id.startsWith('dyn-')) {
        await prisma.notification.updateMany({
          where: { id, userId: req.user.id },
          data: { readAt: new Date() },
        });
      }
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/notifications/read-all
  router.post('/read-all', requireAuth, async (req, res, next) => {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
