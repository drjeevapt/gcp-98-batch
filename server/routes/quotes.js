const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

// Multer storage for quotations
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads', 'quotations');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${Date.now()}_${safeName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// GET /api/quotes?eventId=...&teamId=...
router.get('/', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';
  const teamId = req.query.teamId;

  let sql = `
    SELECT q.*, 
      u_sub.name as submitter_name,
      u_rev.name as reviewer_name,
      vt.name as team_name, vt.icon as team_icon
    FROM quotations q
    LEFT JOIN users u_sub ON u_sub.id = q.submitted_by
    LEFT JOIN users u_rev ON u_rev.id = q.reviewed_by
    JOIN volunteer_teams vt ON vt.id = q.team_id
    WHERE q.event_id = ?
  `;
  const params = [eventId];

  if (teamId) {
    sql += ' AND q.team_id = ?';
    params.push(teamId);
  }

  sql += ' ORDER BY q.created_at DESC';

  const quotations = db.prepare(sql).all(...params);
  res.json({ success: true, quotations });
});

// POST /api/quotes - Upload new quotation
router.post('/', requireAuth, upload.single('quoteFile'), (req, res) => {
  const { eventId, teamId, vendorName, category, amount, notes } = req.body;

  if (!teamId || !vendorName || !amount) {
    return res.status(400).json({ error: 'Team, vendor name, and quote amount are required.' });
  }

  const newId = `qte_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();
  const fileUrl = req.file ? `/uploads/quotations/${req.file.filename}` : null;
  const fileName = req.file ? req.file.originalname : null;

  db.prepare(`
    INSERT INTO quotations (id, event_id, team_id, vendor_name, category, amount, currency, file_url, file_name, notes, status, submitted_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, 'pending', ?, ?)
  `).run(
    newId,
    eventId || 'evt_2026',
    teamId,
    vendorName,
    category || 'misc',
    parseFloat(amount),
    fileUrl,
    fileName,
    notes || '',
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
    'UPLOAD_QUOTE',
    `Uploaded quotation from ${vendorName} for ₹${amount} (${category})`,
    now
  );

  const created = db.prepare('SELECT * FROM quotations WHERE id = ?').get(newId);
  res.json({ success: true, message: 'Vendor quotation uploaded successfully.', quotation: created });
});

// POST /api/quotes/:id/approve - Approve quotation (Coordinators or Admin)
router.post('/:id/approve', requireAuth, requireCoordinator, (req, res) => {
  const quoteId = req.params.id;
  const quote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quoteId);

  if (!quote) {
    return res.status(404).json({ error: 'Quotation not found.' });
  }

  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(`
      UPDATE quotations
      SET status = 'approved',
          reviewed_by = ?,
          reviewed_at = ?
      WHERE id = ?
    `).run(req.user.id, now, quoteId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, event_id, user_id, user_name, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud_${uuidv4().substring(0, 8)}`,
      quote.event_id,
      req.user.id,
      req.user.name,
      'APPROVE_QUOTE',
      `Approved quotation from ${quote.vendor_name} for ₹${quote.amount}`,
      now
    );
  })();

  res.json({ success: true, message: `Quotation from ${quote.vendor_name} approved!` });
});

// POST /api/quotes/:id/reject - Reject quotation
router.post('/:id/reject', requireAuth, requireCoordinator, (req, res) => {
  const { reason } = req.body;
  const quoteId = req.params.id;

  const quote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quoteId);
  if (!quote) {
    return res.status(404).json({ error: 'Quotation not found.' });
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE quotations
    SET status = 'rejected',
        rejection_reason = ?,
        reviewed_by = ?,
        reviewed_at = ?
    WHERE id = ?
  `).run(reason || 'Rejected by committee review', req.user.id, now, quoteId);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, event_id, user_id, user_name, action, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud_${uuidv4().substring(0, 8)}`,
    quote.event_id,
    req.user.id,
    req.user.name,
    'REJECT_QUOTE',
    `Rejected quotation from ${quote.vendor_name} for ₹${quote.amount}. Reason: ${reason || 'N/A'}`,
    now
  );

  res.json({ success: true, message: 'Quotation marked as rejected.' });
});

module.exports = router;
