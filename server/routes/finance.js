const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireCoordinator, requireAccountsVolunteer } = require('../middleware/auth');

// Multer storage for payment proofs and expense receipts
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads', 'receipts');
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
  limits: { fileSize: 10 * 1024 * 1024 }
});

// GET /api/finance/summary?eventId=...
router.get('/summary', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);

  if (!event) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  const contribStats = db.prepare(`
    SELECT
      COUNT(*) as total_contributions_count,
      SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END) as verified_total,
      SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_count,
      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END) as rejected_total,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
    FROM contributions
    WHERE event_id = ?
  `).get(eventId);

  const expenseStats = db.prepare(`
    SELECT
      COUNT(*) as total_expense_count,
      SUM(amount) as total_expenses
    FROM expenses
    WHERE event_id = ?
  `).get(eventId);

  const verifiedTotal = contribStats.verified_total || 0;
  const pendingTotal = contribStats.pending_total || 0;
  const totalExpenses = expenseStats.total_expenses || 0;
  const netBalance = verifiedTotal - totalExpenses;
  const targetBudget = event.target_budget || 0;
  const fundingPercent = targetBudget > 0 ? Math.min(100, Math.round((verifiedTotal / targetBudget) * 100)) : 0;

  // Breakdown by payment methods
  const methodsBreakdown = db.prepare(`
    SELECT payment_method, COUNT(*) as count, SUM(amount) as total
    FROM contributions
    WHERE event_id = ? AND status = 'verified'
    GROUP BY payment_method
  `).all(eventId);

  // Breakdown by expense category
  const expenseCategories = db.prepare(`
    SELECT category, COUNT(*) as count, SUM(amount) as total
    FROM expenses
    WHERE event_id = ?
    GROUP BY category
  `).all(eventId);

  res.json({
    success: true,
    summary: {
      eventId,
      eventTitle: event.title,
      targetBudget,
      feePerMember: event.fee_per_member,
      currency: event.currency || 'INR',
      verifiedTotal,
      verifiedCount: contribStats.verified_count || 0,
      pendingTotal,
      pendingCount: contribStats.pending_count || 0,
      rejectedTotal: contribStats.rejected_total || 0,
      rejectedCount: contribStats.rejected_count || 0,
      totalExpenses,
      expenseCount: expenseStats.total_expense_count || 0,
      netBalance,
      fundingPercent,
      bankDetails: {
        bankName: event.bank_name,
        accountNo: event.bank_account_no,
        ifsc: event.bank_ifsc,
        upiId: event.upi_id
      },
      methodsBreakdown,
      expenseCategories
    }
  });
});

// GET /api/finance/contributions?eventId=...
router.get('/contributions', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';

  const contributions = db.prepare(`
    SELECT c.*,
      u.name as member_name, u.email as member_email, u.phone as member_phone, u.avatar as member_avatar,
      v.name as verifier_name
    FROM contributions c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN users v ON v.id = c.verified_by
    WHERE c.event_id = ?
    ORDER BY 
      CASE c.status
        WHEN 'pending' THEN 1
        WHEN 'verified' THEN 2
        ELSE 3
      END,
      c.created_at DESC
  `).all(eventId);

  res.json({ success: true, contributions });
});

// POST /api/finance/contributions - Member submits contribution (starts as 'pending')
router.post('/contributions', requireAuth, upload.single('proofFile'), (req, res) => {
  const { eventId, amount, paymentMethod, referenceId, paymentDate, notes } = req.body;

  if (!amount || !referenceId) {
    return res.status(400).json({ error: 'Contribution amount and Reference / UTR ID are required.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Please enter a valid contribution amount.' });
  }

  const newId = `cnt_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();
  const proofUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;
  const payDate = paymentDate || now.split('T')[0];

  // ALWAYS inserted with status 'pending' until verified by an authorised Accounts volunteer
  db.prepare(`
    INSERT INTO contributions (id, event_id, user_id, amount, currency, payment_method, reference_id, payment_date, proof_file_url, notes, status, created_at)
    VALUES (?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    newId,
    eventId || 'evt_2026',
    req.user.id,
    parsedAmount,
    paymentMethod || 'UPI',
    referenceId.trim(),
    payDate,
    proofUrl,
    notes || '',
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
    'SUBMIT_CONTRIBUTION',
    `Submitted contribution of ₹${parsedAmount} via ${paymentMethod || 'UPI'} (Ref: ${referenceId.trim()}). Awaiting Accounts Volunteer verification.`,
    now
  );

  const created = db.prepare('SELECT * FROM contributions WHERE id = ?').get(newId);
  res.json({
    success: true,
    message: 'Payment details submitted successfully! Status is Pending Verification by the Accounts Volunteer team.',
    contribution: created
  });
});

// POST /api/finance/contributions/:id/verify
// CRITICAL RULE ENFORCEMENT:
// "Do not mark payments as verified until an authorised Accounts volunteer confirms them."
router.post('/contributions/:id/verify', requireAuth, requireAccountsVolunteer, (req, res) => {
  const { notes } = req.body;
  const contribId = req.params.id;

  const contribution = db.prepare('SELECT c.*, u.name as member_name FROM contributions c JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(contribId);
  if (!contribution) {
    return res.status(404).json({ error: 'Contribution record not found.' });
  }

  if (contribution.status === 'verified') {
    return res.status(400).json({ error: 'This payment has already been verified.' });
  }

  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(`
      UPDATE contributions
      SET status = 'verified',
          verified_by = ?,
          verified_at = ?,
          verification_notes = ?
      WHERE id = ?
    `).run(req.user.id, now, notes || `Verified by authorised Accounts volunteer ${req.user.name}`, contribId);

    // Strict audit trail entry
    db.prepare(`
      INSERT INTO audit_logs (id, event_id, user_id, user_name, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud_${uuidv4().substring(0, 8)}`,
      contribution.event_id,
      req.user.id,
      req.user.name,
      'VERIFY_PAYMENT',
      `Confirmed & verified payment of ₹${contribution.amount} for ${contribution.member_name} (Ref: ${contribution.reference_id})`,
      now
    );
  })();

  const updated = db.prepare('SELECT * FROM contributions WHERE id = ?').get(contribId);
  res.json({
    success: true,
    message: `Payment of ₹${contribution.amount} for ${contribution.member_name} verified by Accounts Volunteer!`,
    contribution: updated
  });
});

// POST /api/finance/contributions/:id/reject
// Only an authorised Accounts volunteer or Admin can reject / flag invalid payments
router.post('/contributions/:id/reject', requireAuth, requireAccountsVolunteer, (req, res) => {
  const { reason } = req.body;
  const contribId = req.params.id;

  const contribution = db.prepare('SELECT c.*, u.name as member_name FROM contributions c JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(contribId);
  if (!contribution) {
    return res.status(404).json({ error: 'Contribution record not found.' });
  }

  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(`
      UPDATE contributions
      SET status = 'rejected',
          verified_by = ?,
          verified_at = ?,
          verification_notes = ?
      WHERE id = ?
    `).run(req.user.id, now, reason || 'Payment could not be verified against bank statement.', contribId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, event_id, user_id, user_name, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud_${uuidv4().substring(0, 8)}`,
      contribution.event_id,
      req.user.id,
      req.user.name,
      'REJECT_PAYMENT',
      `Rejected payment of ₹${contribution.amount} for ${contribution.member_name} (Ref: ${contribution.reference_id}). Reason: ${reason || 'Bank statement mismatch'}`,
      now
    );
  })();

  res.json({ success: true, message: 'Payment marked as rejected with explanation.' });
});

// GET /api/finance/expenses?eventId=...
router.get('/expenses', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';

  const expenses = db.prepare(`
    SELECT e.*,
      vt.name as team_name, vt.icon as team_icon,
      u.name as creator_name
    FROM expenses e
    JOIN volunteer_teams vt ON vt.id = e.team_id
    LEFT JOIN users u ON u.id = e.created_by
    WHERE e.event_id = ?
    ORDER BY e.payment_date DESC
  `).all(eventId);

  res.json({ success: true, expenses });
});

// POST /api/finance/expenses - Record new expense
router.post('/expenses', requireAuth, requireCoordinator, upload.single('receiptFile'), (req, res) => {
  const { eventId, teamId, title, category, amount, vendorName, paymentDate, paymentMode, notes } = req.body;

  if (!teamId || !title || !amount) {
    return res.status(400).json({ error: 'Team, title, and expense amount are required.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid expense amount.' });
  }

  const newId = `exp_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();
  const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;
  const receiptName = req.file ? req.file.originalname : null;

  db.prepare(`
    INSERT INTO expenses (id, event_id, team_id, title, category, amount, currency, vendor_name, payment_date, payment_mode, receipt_url, receipt_name, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    eventId || 'evt_2026',
    teamId,
    title,
    category || 'misc',
    parsedAmount,
    vendorName || '',
    paymentDate || now.split('T')[0],
    paymentMode || 'Bank Transfer',
    receiptUrl,
    receiptName,
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
    'LOG_EXPENSE',
    `Recorded expense of ₹${parsedAmount} for "${title}" (${vendorName || 'Vendor'})`,
    now
  );

  const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(newId);
  res.json({ success: true, message: 'Expense recorded successfully.', expense: created });
});

module.exports = router;
