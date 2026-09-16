import express from 'express';

export default function createNotificationsRouter(requireAuth) {
  const router = express.Router();

  router.delete('/', requireAuth, async (req, res) => {
  const { userId, id } = req.query;
  if (!Array.isArray(req.dbData.notifications)) req.dbData.notifications = [];
  if (id) {
    req.dbData.notifications = req.dbData.notifications.filter(n => n.id !== id);
  } else if (userId) {
    req.dbData.notifications = req.dbData.notifications.filter(n => n.userId !== userId && n.userId !== 'all');
  } else {
    req.dbData.notifications = [];
  }
  try { await req.broadcastUpdate('notifications'); } catch (e) { console.error('Socket save error', e); }
  res.json({ success: true });
});

  router.put('/read', requireAuth, async (req, res) => {
  const { id, userId } = req.body || {};
  if (!Array.isArray(req.dbData.notifications)) return res.json({ success: true });
  req.dbData.notifications = req.dbData.notifications.map(n => {
    if (id && n.id === id) return { ...n, read: true };
    if (!id && (n.userId === userId || n.userId === 'all' || !userId)) return { ...n, read: true };
    return n;
  });
  try { await req.broadcastUpdate('notifications'); } catch (e) { console.error('Socket save error', e); }
  res.json({ success: true });
});

  return router;
}
