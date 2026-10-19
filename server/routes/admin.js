const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Apply admin guard to all routes in this router
router.use(requireAuth, requireAdmin);

// GET /api/admin/dashboard?eventId=...
router.get('/dashboard', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';

  const memberStats = db.prepare(`
    SELECT 
      COUNT(*) as total_members,
      SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
      SUM(CASE WHEN role = 'accounts_volunteer' THEN 1 ELSE 0 END) as accounts_volunteers_count,
      SUM(CASE WHEN role = 'coordinator' THEN 1 ELSE 0 END) as coordinators_count
    FROM users
    WHERE status = 'active'
  `).get();

  const rsvpStats = db.prepare(`
    SELECT
      COUNT(*) as total_responses,
      SUM(CASE WHEN status = 'attending' THEN 1 ELSE 0 END) as attending_count,
      SUM(CASE WHEN status = 'attending' THEN total_headcount ELSE 0 END) as total_headcount
    FROM rsvps
    WHERE event_id = ?
  `).get(eventId);

  const financeStats = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END) as verified_total,
      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_verifications_count
    FROM contributions
    WHERE event_id = ?
  `).get(eventId);

  const taskStats = db.prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) as open_tasks,
      SUM(CASE WHEN priority = 'urgent' AND status != 'completed' THEN 1 ELSE 0 END) as urgent_tasks
    FROM tasks
    WHERE event_id = ?
  `).get(eventId);

  const quoteStats = db.prepare(`
    SELECT
      COUNT(*) as total_quotes,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_quotes
    FROM quotations
    WHERE event_id = ?
  `).get(eventId);

  const usersList = db.prepare(`
    SELECT id, name, email, phone, whatsapp, role, assigned_team_id, city, profession, avatar, created_at
    FROM users
    ORDER BY 
      CASE role
        WHEN 'admin' THEN 1
        WHEN 'accounts_volunteer' THEN 2
        WHEN 'coordinator' THEN 3
        ELSE 4
      END,
      name ASC
  `).all();

  const inviteCodes = db.prepare('SELECT * FROM invite_codes ORDER BY created_at DESC').all();

  const recentAudits = db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 25
  `).all();

  res.json({
    success: true,
    stats: {
      totalMembers: memberStats.total_members || 0,
      adminCount: memberStats.admin_count || 0,
      accountsVolunteersCount: memberStats.accounts_volunteers_count || 0,
      coordinatorsCount: memberStats.coordinators_count || 0,
      rsvpResponses: rsvpStats.total_responses || 0,
      attendingMembers: rsvpStats.attending_count || 0,
      totalHeadcount: rsvpStats.total_headcount || 0,
      verifiedFunds: financeStats.verified_total || 0,
      pendingFunds: financeStats.pending_total || 0,
      pendingVerificationsCount: financeStats.pending_verifications_count || 0,
      openTasks: taskStats.open_tasks || 0,
      urgentTasks: taskStats.urgent_tasks || 0,
      pendingQuotes: quoteStats.pending_quotes || 0
    },
    users: usersList,
    inviteCodes,
    recentAudits
  });
});

// POST /api/admin/users/role - Update user role & team
router.post('/users/role', (req, res) => {
  const { userId, role, assignedTeamId } = req.body;

  if (!userId || !role) {
    return res.status(400).json({ error: 'User ID and Role are required.' });
  }

  const validRoles = ['admin', 'coordinator', 'accounts_volunteer', 'member'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role specified.' });
  }

  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  db.transaction(() => {
    db.prepare(`
      UPDATE users
      SET role = ?,
          assigned_team_id = ?
      WHERE id = ?
    `).run(role, assignedTeamId || null, userId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `aud_${uuidv4().substring(0, 8)}`,
      req.user.id,
      req.user.name,
      'UPDATE_ROLE',
      `Changed role for ${targetUser.name} to ${role.toUpperCase()} (Team: ${assignedTeamId || 'None'})`,
      new Date().toISOString()
    );
  })();

  const updated = db.prepare('SELECT id, name, email, role, assigned_team_id FROM users WHERE id = ?').get(userId);
  res.json({ success: true, message: `Role updated for ${targetUser.name}.`, user: updated });
});

// POST /api/admin/invite-codes - Create new invite code
router.post('/invite-codes', (req, res) => {
  const { code, role, assignedTeamId, maxUses, notes } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Invite code string is required.' });
  }

  const formattedCode = code.trim().toUpperCase();
  const existing = db.prepare('SELECT id FROM invite_codes WHERE code = ?').get(formattedCode);
  if (existing) {
    return res.status(400).json({ error: 'An invite code with this text already exists.' });
  }

  const newId = `inv_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO invite_codes (id, code, role, assigned_team_id, max_uses, used_count, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    newId,
    formattedCode,
    role || 'member',
    assignedTeamId || null,
    parseInt(maxUses, 10) || 50,
    notes || '',
    req.user.id,
    now
  );

  const created = db.prepare('SELECT * FROM invite_codes WHERE id = ?').get(newId);
  res.json({ success: true, message: 'Invite code generated successfully.', inviteCode: created });
});

// GET /api/admin/audit-logs
router.get('/audit-logs', (req, res) => {
  const logs = db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 100
  `).all();

  res.json({ success: true, logs });
});

module.exports = router;
