const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/rsvps?eventId=...
router.get('/', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';

  const rsvps = db.prepare(`
    SELECT r.*, u.name as member_name, u.email as member_email, u.phone as member_phone, u.city as member_city, u.avatar as member_avatar
    FROM rsvps r
    JOIN users u ON u.id = r.user_id
    WHERE r.event_id = ?
    ORDER BY r.updated_at DESC
  `).all(eventId);

  // Calculate detailed aggregate metrics for Catering & Venue coordinators
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_submitted,
      SUM(CASE WHEN status = 'attending' THEN 1 ELSE 0 END) as attending_members,
      SUM(CASE WHEN status = 'tentative' THEN 1 ELSE 0 END) as tentative_members,
      SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined_members,
      SUM(CASE WHEN status = 'attending' THEN total_headcount ELSE 0 END) as total_attending_headcount,
      SUM(CASE WHEN status = 'attending' THEN adult_guests ELSE 0 END) as total_adult_guests,
      SUM(CASE WHEN status = 'attending' THEN kids_count ELSE 0 END) as total_kids_count,
      SUM(CASE WHEN status = 'attending' AND meal_preference = 'veg' THEN 1 + adult_guests ELSE 0 END) as veg_meals,
      SUM(CASE WHEN status = 'attending' AND meal_preference = 'non_veg' THEN 1 + adult_guests ELSE 0 END) as non_veg_meals,
      SUM(CASE WHEN status = 'attending' AND meal_preference = 'jain' THEN 1 + adult_guests ELSE 0 END) as jain_meals,
      SUM(CASE WHEN status = 'attending' AND meal_preference = 'vegan' THEN 1 + adult_guests ELSE 0 END) as vegan_meals,
      SUM(CASE WHEN status = 'attending' THEN kids_count ELSE 0 END) as kids_meals,
      SUM(CASE WHEN status = 'attending' AND accommodation_needed = 1 THEN 1 ELSE 0 END) as rooms_needed
    FROM rsvps
    WHERE event_id = ?
  `).get(eventId);

  res.json({ success: true, rsvps, summary });
});

// GET /api/rsvps/me?eventId=...
router.get('/me', requireAuth, (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';
  const myRsvp = db.prepare('SELECT * FROM rsvps WHERE event_id = ? AND user_id = ?').get(eventId, req.user.id);
  res.json({ success: true, rsvp: myRsvp || null });
});

// POST /api/rsvps - Create or update personal RSVP
router.post('/', requireAuth, (req, res) => {
  const {
    eventId,
    status,
    adultGuests,
    kidsCount,
    mealPreference,
    dietaryNotes,
    accommodationNeeded,
    arrivalDate,
    departureDate,
    travelMode,
    notes
  } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'RSVP status (attending, tentative, declined) is required.' });
  }

  const targetEventId = eventId || 'evt_2026';
  const adults = parseInt(adultGuests, 10) || 0;
  const kids = parseInt(kidsCount, 10) || 0;
  const totalHeadcount = status === 'attending' ? (1 + adults + kids) : 0;
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT id FROM rsvps WHERE event_id = ? AND user_id = ?').get(targetEventId, req.user.id);

  if (existing) {
    db.prepare(`
      UPDATE rsvps
      SET status = ?,
          adult_guests = ?,
          kids_count = ?,
          total_headcount = ?,
          meal_preference = ?,
          dietary_notes = ?,
          accommodation_needed = ?,
          arrival_date = ?,
          departure_date = ?,
          travel_mode = ?,
          notes = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      status,
      adults,
      kids,
      totalHeadcount,
      mealPreference || 'veg',
      dietaryNotes || '',
      accommodationNeeded ? 1 : 0,
      arrivalDate || '',
      departureDate || '',
      travelMode || '',
      notes || '',
      now,
      existing.id
    );
  } else {
    db.prepare(`
      INSERT INTO rsvps (id, event_id, user_id, status, adult_guests, kids_count, total_headcount, meal_preference, dietary_notes, accommodation_needed, arrival_date, departure_date, travel_mode, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `rsvp_${uuidv4().substring(0, 8)}`,
      targetEventId,
      req.user.id,
      status,
      adults,
      kids,
      totalHeadcount,
      mealPreference || 'veg',
      dietaryNotes || '',
      accommodationNeeded ? 1 : 0,
      arrivalDate || '',
      departureDate || '',
      travelMode || '',
      notes || '',
      now
    );
  }

  // Log audit
  db.prepare(`
    INSERT INTO audit_logs (id, event_id, user_id, user_name, action, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud_${uuidv4().substring(0, 8)}`,
    targetEventId,
    req.user.id,
    req.user.name,
    'RSVP_UPDATED',
    `Updated RSVP to ${status.toUpperCase()} (Total Headcount: ${totalHeadcount}, Meals: ${mealPreference || 'veg'})`,
    now
  );

  const updated = db.prepare('SELECT * FROM rsvps WHERE event_id = ? AND user_id = ?').get(targetEventId, req.user.id);
  res.json({ success: true, message: 'Your RSVP has been saved!', rsvp: updated });
});

module.exports = router;
