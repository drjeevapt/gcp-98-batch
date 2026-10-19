const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

// GET /api/announcements?eventId=...
router.get('/', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';

  const announcements = db.prepare(`
    SELECT a.*, u.name as author_name, u.avatar as author_avatar, u.role as author_role
    FROM announcements a
    LEFT JOIN users u ON u.id = a.author_id
    WHERE a.event_id = ?
    ORDER BY a.is_pinned DESC, a.created_at DESC
  `).all(eventId);

  res.json({ success: true, announcements });
});

// POST /api/announcements - Publish announcement (Coordinators or Admin)
router.post('/', requireAuth, requireCoordinator, (req, res) => {
  const { eventId, title, content, priority, isPinned } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  const newId = `anc_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO announcements (id, event_id, title, content, priority, is_pinned, author_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    eventId || 'evt_2026',
    title,
    content,
    priority || 'normal',
    isPinned ? 1 : 0,
    req.user.id,
    now
  );

  // Log audit
  db.prepare(`
    INSERT INTO audit_logs (id, event_id, user_id, user_name, action, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud_${uuidv4().substring(0, 8)}`,
    eventId || 'evt_2026',
    req.user.id,
    req.user.name,
    'POST_ANNOUNCEMENT',
    `Published announcement: "${title}"`,
    now
  );

  const created = db.prepare('SELECT * FROM announcements WHERE id = ?').get(newId);
  res.json({ success: true, message: 'Announcement broadcasted successfully!', announcement: created });
});

// DELETE /api/announcements/:id
router.delete('/:id', requireAuth, requireCoordinator, (req, res) => {
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Announcement deleted.' });
});

module.exports = router;
