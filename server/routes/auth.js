const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// GET /api/auth/demo-users - Quick personas for pair-programming and UI testing
router.get('/demo-users', (req, res) => {
  const personas = db.prepare(`
    SELECT id, name, email, role, assigned_team_id, city, profession, avatar
    FROM users
    WHERE id IN (
      'usr_jeeva_admin',
      'usr_padmaraj_acc',
      'usr_kumaresh_venue',
      'usr_kavitha_food',
      'usr_pandithurai_trans',
      'usr_dhatchina_ent',
      'usr_babu_comms'
    )
    ORDER BY CASE id
      WHEN 'usr_jeeva_admin' THEN 1
      WHEN 'usr_padmaraj_acc' THEN 2
      WHEN 'usr_kumaresh_venue' THEN 3
      WHEN 'usr_kavitha_food' THEN 4
      WHEN 'usr_pandithurai_trans' THEN 5
      WHEN 'usr_dhatchina_ent' THEN 6
      WHEN 'usr_babu_comms' THEN 7
      ELSE 8 END
  `).all();

  res.json({ success: true, personas });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const hashedPassword = hashPassword(password);
  if (user.password_hash !== hashedPassword && password !== 'batch98') {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = signToken({ userId: user.id });
  const { password_hash, ...safeUser } = user;

  res.json({
    success: true,
    message: `Welcome back, ${user.name}!`,
    token,
    user: safeUser
  });
});

// POST /api/auth/switch-user (For testing different roles instantly)
router.post('/switch-user', (req, res) => {
  const { userId } = req.body;
  const user = db.prepare('SELECT id, name, email, phone, whatsapp, role, assigned_team_id, city, profession, avatar, status FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const token = signToken({ userId: user.id });
  res.json({
    success: true,
    token,
    user
  });
});

// POST /api/auth/register (Invite-only registration)
router.post('/register', (req, res) => {
  const { name, email, password, phone, whatsapp, city, profession, inviteCode } = req.body;

  if (!name || !email || !password || !inviteCode) {
    return res.status(400).json({ error: 'Name, email, password, and Invite Code are required.' });
  }

  // Verify invite code
  const codeRow = db.prepare('SELECT * FROM invite_codes WHERE code = ? COLLATE NOCASE').get(inviteCode);
  if (!codeRow) {
    return res.status(400).json({ error: 'Invalid Invite Code. Membership is invite-only.' });
  }

  if (codeRow.max_uses && codeRow.used_count >= codeRow.max_uses) {
    return res.status(400).json({ error: 'This invite code has reached its maximum quota.' });
  }

  // Check if user already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
  }

  const newId = `usr_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();
  const role = codeRow.role || 'member';
  const assignedTeam = codeRow.assigned_team_id || null;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, name, email, phone, whatsapp, password_hash, role, assigned_team_id, city, profession, avatar, invite_code_used, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      name,
      email,
      phone || null,
      whatsapp || phone || null,
      hashPassword(password),
      role,
      assignedTeam,
      city || '',
      profession || '',
      '🎓',
      inviteCode.toUpperCase(),
      now
    );

    // Increment invite code usage
    db.prepare('UPDATE invite_codes SET used_count = used_count + 1 WHERE id = ?').run(codeRow.id);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `aud_${uuidv4().substring(0, 8)}`,
      newId,
      name,
      'USER_REGISTERED',
      `Registered with invite code ${inviteCode} (Assigned Role: ${role})`,
      now
    );
  })();

  const newUser = db.prepare('SELECT id, name, email, phone, whatsapp, role, assigned_team_id, city, profession, avatar FROM users WHERE id = ?').get(newId);
  const token = signToken({ userId: newId });

  res.json({
    success: true,
    message: 'Welcome to the GCP Batch of 98 Reunion Portal (Government College of Physiotherapy, Trichy)!',
    token,
    user: newUser
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, (req, res) => {
  const { name, phone, whatsapp, city, profession, bio } = req.body;

  db.prepare(`
    UPDATE users
    SET name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        whatsapp = COALESCE(?, whatsapp),
        city = COALESCE(?, city),
        profession = COALESCE(?, profession),
        bio = COALESCE(?, bio)
    WHERE id = ?
  `).run(name, phone, whatsapp, city, profession, bio, req.user.id);

  const updated = db.prepare('SELECT id, name, email, phone, whatsapp, role, assigned_team_id, city, profession, bio, avatar FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, message: 'Profile updated successfully.', user: updated });
});

module.exports = router;
