const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

// GET /api/polls?eventId=...
router.get('/', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';

  const polls = db.prepare(`
    SELECT * FROM date_polls
    WHERE event_id = ?
    ORDER BY created_at DESC
  `).all(eventId);

  const fullPolls = polls.map(poll => {
    const options = db.prepare(`
      SELECT o.*,
        (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id AND v.vote_choice = 'yes') as yes_count,
        (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id AND v.vote_choice = 'maybe') as maybe_count,
        (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id AND v.vote_choice = 'no') as no_count
      FROM poll_options o
      WHERE o.poll_id = ?
    `).all(poll.id);

    // Get list of all votes with voter names
    const votes = db.prepare(`
      SELECT v.*, u.name as voter_name, u.avatar as voter_avatar
      FROM poll_votes v
      JOIN users u ON u.id = v.user_id
      WHERE v.poll_id = ?
    `).all(poll.id);

    return {
      ...poll,
      options,
      votes
    };
  });

  res.json({ success: true, polls: fullPolls });
});

// POST /api/polls/vote - Cast or change vote on an option
router.post('/vote', requireAuth, (req, res) => {
  const { pollId, optionId, voteChoice } = req.body; // voteChoice: 'yes', 'maybe', 'no'

  if (!pollId || !optionId) {
    return res.status(400).json({ error: 'Poll ID and Option ID are required.' });
  }

  const poll = db.prepare('SELECT * FROM date_polls WHERE id = ?').get(pollId);
  if (!poll) {
    return res.status(404).json({ error: 'Poll not found.' });
  }

  if (poll.status === 'closed' || poll.status === 'finalized') {
    return res.status(400).json({ error: 'This poll is already closed.' });
  }

  const now = new Date().toISOString();
  const choice = voteChoice || 'yes';

  // Upsert vote
  const existing = db.prepare('SELECT id FROM poll_votes WHERE poll_id = ? AND user_id = ? AND option_id = ?').get(pollId, req.user.id, optionId);

  if (existing) {
    db.prepare('UPDATE poll_votes SET vote_choice = ?, created_at = ? WHERE id = ?').run(choice, now, existing.id);
  } else {
    db.prepare(`
      INSERT INTO poll_votes (id, poll_id, option_id, user_id, vote_choice, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`vote_${uuidv4().substring(0, 8)}`, pollId, optionId, req.user.id, choice, now);
  }

  // Recalculate option vote counts
  const totalYes = db.prepare("SELECT COUNT(*) as count FROM poll_votes WHERE option_id = ? AND vote_choice = 'yes'").get(optionId).count;
  db.prepare('UPDATE poll_options SET vote_count = ? WHERE id = ?').run(totalYes, optionId);

  res.json({ success: true, message: 'Your vote has been recorded!' });
});

// POST /api/polls/:id/finalize - Finalize selected date option into official event
router.post('/:id/finalize', requireAuth, requireCoordinator, (req, res) => {
  const { optionId } = req.body;
  const poll = db.prepare('SELECT * FROM date_polls WHERE id = ?').get(req.params.id);
  if (!poll) {
    return res.status(404).json({ error: 'Poll not found.' });
  }

  const option = db.prepare('SELECT * FROM poll_options WHERE id = ?').get(optionId);
  if (!option) {
    return res.status(404).json({ error: 'Option not found.' });
  }

  db.transaction(() => {
    // Mark poll finalized
    db.prepare("UPDATE date_polls SET status = 'finalized', finalized_option_id = ? WHERE id = ?").run(optionId, poll.id);

    // Update event dates and location
    if (option.dates_hint) {
      db.prepare('UPDATE events SET dates_display = ? WHERE id = ?').run(option.dates_hint, poll.event_id);
    }
    if (option.location_hint) {
      db.prepare('UPDATE events SET venue_name = ? WHERE id = ?').run(option.location_hint, poll.event_id);
    }

    // Log audit
    db.prepare(`
      INSERT INTO audit_logs (id, event_id, user_id, user_name, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud_${uuidv4().substring(0, 8)}`,
      poll.event_id,
      req.user.id,
      req.user.name,
      'FINALIZE_DATE',
      `Locked official reunion date to "${option.option_text}" (${option.dates_hint})`,
      new Date().toISOString()
    );
  })();

  res.json({ success: true, message: `Reunion date successfully locked to: ${option.option_text}` });
});

// POST /api/polls - Create new date poll
router.post('/', requireAuth, requireCoordinator, (req, res) => {
  const { eventId, title, description, deadline, options } = req.body;

  if (!title || !options || !options.length) {
    return res.status(400).json({ error: 'Title and at least one option are required.' });
  }

  const pollId = `poll_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(`
      INSERT INTO date_polls (id, event_id, title, description, deadline, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'open', ?)
    `).run(pollId, eventId || 'evt_2026', title, description || '', deadline || '', now);

    const insertOpt = db.prepare(`
      INSERT INTO poll_options (id, poll_id, option_text, location_hint, dates_hint, vote_count)
      VALUES (?, ?, ?, ?, ?, 0)
    `);

    for (const opt of options) {
      insertOpt.run(`opt_${uuidv4().substring(0, 8)}`, pollId, opt.text, opt.location || '', opt.dates || '');
    }
  })();

  res.json({ success: true, message: 'Date poll created successfully.' });
});

module.exports = router;
