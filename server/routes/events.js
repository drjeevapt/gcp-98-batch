const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/events - List all yearly events (Active, Archived, Planning)
router.get('/', (req, res) => {
  const events = db.prepare(`
    SELECT * FROM events
    ORDER BY year DESC
  `).all();

  // Attach quick summary metrics for each event
  const eventsWithStats = events.map(evt => {
    const rsvpSummary = db.prepare(`
      SELECT 
        COUNT(*) as total_responses,
        SUM(CASE WHEN status = 'attending' THEN 1 ELSE 0 END) as attending_count,
        SUM(CASE WHEN status = 'attending' THEN total_headcount ELSE 0 END) as total_headcount
      FROM rsvps
      WHERE event_id = ?
    `).get(evt.id);

    const financeSummary = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END) as verified_funds,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_funds
      FROM contributions
      WHERE event_id = ?
    `).get(evt.id);

    const expenseSummary = db.prepare(`
      SELECT SUM(amount) as total_expenses
      FROM expenses
      WHERE event_id = ?
    `).get(evt.id);

    return {
      ...evt,
      stats: {
        attending_count: rsvpSummary.attending_count || 0,
        total_headcount: rsvpSummary.total_headcount || 0,
        verified_funds: financeSummary.verified_funds || 0,
        pending_funds: financeSummary.pending_funds || 0,
        total_expenses: expenseSummary.total_expenses || 0
      }
    };
  });

  res.json({ success: true, events: eventsWithStats });
});

// GET /api/events/active - Get current active event or requested by ?year=
router.get('/active', (req, res) => {
  let event;
  const yearQuery = req.query.year;

  if (yearQuery) {
    event = db.prepare('SELECT * FROM events WHERE year = ?').get(yearQuery);
  } else {
    event = db.prepare("SELECT * FROM events WHERE status IN ('active', 'completed') ORDER BY year DESC LIMIT 1").get();
    if (!event) {
      event = db.prepare('SELECT * FROM events ORDER BY year DESC LIMIT 1').get();
    }
  }

  if (!event) {
    return res.status(404).json({ error: 'No event found.' });
  }

  res.json({ success: true, event });
});

// POST /api/events - Create new yearly event (Admin only)
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { year, title, theme, description, venue_name, venue_location, dates_display, start_date, end_date, target_budget, fee_per_member, upi_id, bank_name, bank_account_no, bank_ifsc } = req.body;

  if (!year || !title) {
    return res.status(400).json({ error: 'Year and Title are required.' });
  }

  const existing = db.prepare('SELECT id FROM events WHERE year = ?').get(year);
  if (existing) {
    return res.status(400).json({ error: `An event for the year ${year} already exists.` });
  }

  const newId = `evt_${year}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO events (id, year, title, theme, description, venue_name, venue_location, dates_display, start_date, end_date, status, target_budget, fee_per_member, upi_id, bank_name, bank_account_no, bank_ifsc, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planning', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    year,
    title,
    theme || '',
    description || '',
    venue_name || '',
    venue_location || '',
    dates_display || '',
    start_date || '',
    end_date || '',
    target_budget || 0,
    fee_per_member || 0,
    upi_id || 'gcp98reunion@hdfcbank',
    bank_name || 'HDFC Bank',
    bank_account_no || '50100498989801',
    bank_ifsc || 'HDFC0001998',
    now
  );

  // Log audit
  db.prepare(`
    INSERT INTO audit_logs (id, event_id, user_id, user_name, action, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud_${uuidv4().substring(0, 8)}`,
    newId,
    req.user.id,
    req.user.name,
    'CREATE_EVENT',
    `Created new reunion event for ${year}: "${title}"`,
    now
  );

  const created = db.prepare('SELECT * FROM events WHERE id = ?').get(newId);
  res.json({ success: true, message: `Event for ${year} created successfully.`, event: created });
});

// PUT /api/events/:id - Update event details (Admin only)
router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const { title, theme, description, venue_name, venue_location, dates_display, start_date, end_date, status, target_budget, fee_per_member, upi_id, bank_name, bank_account_no, bank_ifsc } = req.body;

  db.prepare(`
    UPDATE events
    SET title = COALESCE(?, title),
        theme = COALESCE(?, theme),
        description = COALESCE(?, description),
        venue_name = COALESCE(?, venue_name),
        venue_location = COALESCE(?, venue_location),
        dates_display = COALESCE(?, dates_display),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        status = COALESCE(?, status),
        target_budget = COALESCE(?, target_budget),
        fee_per_member = COALESCE(?, fee_per_member),
        upi_id = COALESCE(?, upi_id),
        bank_name = COALESCE(?, bank_name),
        bank_account_no = COALESCE(?, bank_account_no),
        bank_ifsc = COALESCE(?, bank_ifsc)
    WHERE id = ?
  `).run(
    title, theme, description, venue_name, venue_location, dates_display, start_date, end_date, status, target_budget, fee_per_member, upi_id, bank_name, bank_account_no, bank_ifsc,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  res.json({ success: true, message: 'Event updated successfully.', event: updated });
});

// POST /api/events/:id/archive - Archive past year (Admin only)
router.post('/:id/archive', requireAuth, requireAdmin, (req, res) => {
  db.prepare("UPDATE events SET status = 'archived' WHERE id = ?").run(req.params.id);

  // Log audit
  db.prepare(`
    INSERT INTO audit_logs (id, event_id, user_id, user_name, action, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud_${uuidv4().substring(0, 8)}`,
    req.params.id,
    req.user.id,
    req.user.name,
    'ARCHIVE_EVENT',
    `Archived event ID ${req.params.id}`,
    new Date().toISOString()
  );

  res.json({ success: true, message: 'Event successfully archived.' });
});

module.exports = router;
