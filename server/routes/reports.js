const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// GET /api/reports/attendance.csv?eventId=...
router.get('/attendance.csv', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);

  const rsvps = db.prepare(`
    SELECT 
      u.name as member_name,
      u.email as member_email,
      u.phone as member_phone,
      u.city as member_city,
      r.status as rsvp_status,
      r.adult_guests,
      r.kids_count,
      r.total_headcount,
      r.meal_preference,
      r.dietary_notes,
      CASE WHEN r.accommodation_needed = 1 THEN 'Yes' ELSE 'No' END as room_needed,
      r.arrival_date,
      r.departure_date,
      r.travel_mode,
      r.notes as special_notes,
      r.updated_at
    FROM rsvps r
    JOIN users u ON u.id = r.user_id
    WHERE r.event_id = ?
    ORDER BY r.status ASC, u.name ASC
  `).all(eventId);

  const headers = [
    'Member Name',
    'Email',
    'Phone',
    'City',
    'RSVP Status',
    'Adult Guests',
    'Kids Count',
    'Total Headcount',
    'Meal Preference',
    'Dietary Notes',
    'Room Needed',
    'Arrival Date',
    'Departure Date',
    'Travel Mode',
    'Special Notes',
    'Last Updated'
  ];

  let csvContent = `GCP-98 Reunion Attendance Register - ${event ? event.title : eventId}\n`;
  csvContent += `Generated at: ${new Date().toLocaleString()}\n\n`;
  csvContent += headers.map(escapeCsvField).join(',') + '\n';

  for (const row of rsvps) {
    const line = [
      row.member_name,
      row.member_email,
      row.member_phone || '',
      row.member_city || '',
      row.rsvp_status.toUpperCase(),
      row.adult_guests,
      row.kids_count,
      row.total_headcount,
      row.meal_preference ? row.meal_preference.toUpperCase() : 'VEG',
      row.dietary_notes || '',
      row.room_needed,
      row.arrival_date || '',
      row.departure_date || '',
      row.travel_mode || '',
      row.special_notes || '',
      row.updated_at
    ];
    csvContent += line.map(escapeCsvField).join(',') + '\n';
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="GCP98_Attendance_Report_${event ? event.year : '2026'}.csv"`);
  res.send(csvContent);
});

// GET /api/reports/accounts.csv?eventId=...
router.get('/accounts.csv', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);

  // Contributions
  const contributions = db.prepare(`
    SELECT 
      c.payment_date,
      u.name as member_name,
      c.amount,
      c.payment_method,
      c.reference_id,
      c.status,
      v.name as verified_by_name,
      c.verified_at,
      c.verification_notes
    FROM contributions c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN users v ON v.id = c.verified_by
    WHERE c.event_id = ?
    ORDER BY c.payment_date DESC
  `).all(eventId);

  // Expenses
  const expenses = db.prepare(`
    SELECT 
      e.payment_date,
      vt.name as team_name,
      e.category,
      e.title,
      e.vendor_name,
      e.amount,
      e.payment_mode,
      u.name as recorded_by
    FROM expenses e
    JOIN volunteer_teams vt ON vt.id = e.team_id
    LEFT JOIN users u ON u.id = e.created_by
    WHERE e.event_id = ?
    ORDER BY e.payment_date DESC
  `).all(eventId);

  // Financial totals
  const totalVerified = contributions.filter(c => c.status === 'verified').reduce((sum, c) => sum + c.amount, 0);
  const totalPending = contributions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netCash = totalVerified - totalExpenses;

  let csvContent = `GCP-98 Batch Reunion Financial Audit Statement - ${event ? event.title : eventId}\n`;
  csvContent += `Generated: ${new Date().toLocaleString()}\n`;
  csvContent += `Target Budget: ₹${event ? event.target_budget.toLocaleString() : 0}\n`;
  csvContent += `Total Verified Collections: ₹${totalVerified.toLocaleString()}\n`;
  csvContent += `Pending Verification: ₹${totalPending.toLocaleString()}\n`;
  csvContent += `Total Approved Expenses: ₹${totalExpenses.toLocaleString()}\n`;
  csvContent += `Net Cash Balance In Escrow: ₹${netCash.toLocaleString()}\n\n`;

  // Section 1: Contributions
  csvContent += `--- BATCH CONTRIBUTIONS LEDGER ---\n`;
  const contribHeaders = ['Date', 'Member Name', 'Amount (INR)', 'Payment Mode', 'Reference / UTR ID', 'Verification Status', 'Verified By', 'Verified At', 'Auditor Notes'];
  csvContent += contribHeaders.map(escapeCsvField).join(',') + '\n';

  for (const c of contributions) {
    const line = [
      c.payment_date,
      c.member_name,
      c.amount,
      c.payment_method,
      c.reference_id,
      c.status.toUpperCase(),
      c.verified_by_name || 'N/A (Pending)',
      c.verified_at || '',
      c.verification_notes || ''
    ];
    csvContent += line.map(escapeCsvField).join(',') + '\n';
  }

  csvContent += '\n--- DISBURSEMENTS & EXPENSES LEDGER ---\n';
  const expHeaders = ['Date', 'Team', 'Category', 'Expense Description', 'Vendor / Payee', 'Amount (INR)', 'Payment Mode', 'Recorded By'];
  csvContent += expHeaders.map(escapeCsvField).join(',') + '\n';

  for (const e of expenses) {
    const line = [
      e.payment_date,
      e.team_name,
      e.category.toUpperCase(),
      e.title,
      e.vendor_name || '',
      e.amount,
      e.payment_mode,
      e.recorded_by || ''
    ];
    csvContent += line.map(escapeCsvField).join(',') + '\n';
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="GCP98_Accounts_Ledger_${event ? event.year : '2026'}.csv"`);
  res.send(csvContent);
});

// GET /api/reports/data?eventId=... - Full structured report data for PDF/Print view
router.get('/data', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);

  const rsvps = db.prepare(`
    SELECT r.*, u.name as member_name, u.email as member_email, u.phone as member_phone, u.city as member_city
    FROM rsvps r
    JOIN users u ON u.id = r.user_id
    WHERE r.event_id = ?
    ORDER BY r.status ASC, u.name ASC
  `).all(eventId);

  const contributions = db.prepare(`
    SELECT c.*, u.name as member_name, v.name as verifier_name
    FROM contributions c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN users v ON v.id = c.verified_by
    WHERE c.event_id = ?
    ORDER BY c.created_at DESC
  `).all(eventId);

  const expenses = db.prepare(`
    SELECT e.*, vt.name as team_name, u.name as creator_name
    FROM expenses e
    JOIN volunteer_teams vt ON vt.id = e.team_id
    LEFT JOIN users u ON u.id = e.created_by
    WHERE e.event_id = ?
    ORDER BY e.payment_date DESC
  `).all(eventId);

  res.json({
    success: true,
    event,
    rsvps,
    contributions,
    expenses
  });
});

module.exports = router;
