const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

// GET /api/reminders?eventId=...
router.get('/', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';

  const reminders = db.prepare(`
    SELECT r.*, u.name as creator_name
    FROM scheduled_reminders r
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.event_id = ?
    ORDER BY r.scheduled_at ASC
  `).all(eventId);

  res.json({ success: true, reminders });
});

// GET /api/reminders/sent-log?eventId=...
router.get('/sent-log', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';

  const logs = db.prepare(`
    SELECT * FROM sent_reminders_log
    WHERE event_id = ?
    ORDER BY sent_at DESC
    LIMIT 100
  `).all(eventId);

  res.json({ success: true, logs });
});

// POST /api/reminders/schedule - Create scheduled email reminder
router.post('/schedule', requireAuth, requireCoordinator, (req, res) => {
  const { eventId, reminderType, title, subject, messageBody, targetAudience, scheduledAt } = req.body;

  if (!title || !subject || !messageBody) {
    return res.status(400).json({ error: 'Title, subject, and message body are required.' });
  }

  const newId = `rem_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO scheduled_reminders (id, event_id, reminder_type, title, subject, message_body, target_audience, scheduled_at, status, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    newId,
    eventId || 'evt_2026',
    reminderType || 'general',
    title,
    subject,
    messageBody,
    targetAudience || 'all',
    scheduledAt || now,
    req.user.id,
    now
  );

  const created = db.prepare('SELECT * FROM scheduled_reminders WHERE id = ?').get(newId);
  res.json({ success: true, message: 'Reminder scheduled successfully.', reminder: created });
});

// POST /api/reminders/:id/trigger - Trigger sending of reminder emails immediately
router.post('/:id/trigger', requireAuth, requireCoordinator, (req, res) => {
  const reminderId = req.params.id;
  const reminder = db.prepare('SELECT * FROM scheduled_reminders WHERE id = ?').get(reminderId);

  if (!reminder) {
    return res.status(404).json({ error: 'Reminder not found.' });
  }

  // Determine recipients based on target_audience
  let recipients = [];
  if (reminder.target_audience === 'pending_rsvp') {
    recipients = db.prepare(`
      SELECT u.id, u.name, u.email
      FROM users u
      LEFT JOIN rsvps r ON r.user_id = u.id AND r.event_id = ?
      WHERE r.id IS NULL OR r.status = 'tentative'
    `).all(reminder.event_id);
  } else if (reminder.target_audience === 'pending_payment') {
    recipients = db.prepare(`
      SELECT u.id, u.name, u.email
      FROM users u
      LEFT JOIN contributions c ON c.user_id = u.id AND c.event_id = ? AND c.status = 'verified'
      WHERE c.id IS NULL
    `).all(reminder.event_id);
  } else if (reminder.target_audience === 'coordinators') {
    recipients = db.prepare(`
      SELECT id, name, email FROM users
      WHERE role IN ('coordinator', 'accounts_volunteer', 'admin')
    `).all();
  } else {
    // 'all'
    recipients = db.prepare('SELECT id, name, email FROM users WHERE status = "active"').all();
  }

  const now = new Date().toISOString();
  const insertLog = db.prepare(`
    INSERT INTO sent_reminders_log (id, reminder_id, event_id, channel, recipient_email, recipient_name, subject, content, status, sent_at)
    VALUES (?, ?, ?, 'email', ?, ?, ?, ?, 'sent', ?)
  `);

  db.transaction(() => {
    for (const r of recipients) {
      const personalizedBody = reminder.message_body.replace(/Batchmate/gi, r.name.split(' ')[0]);
      insertLog.run(
        `snt_${uuidv4().substring(0, 8)}`,
        reminder.id,
        reminder.event_id,
        r.email,
        r.name,
        reminder.subject,
        personalizedBody,
        now
      );
    }

    db.prepare(`
      UPDATE scheduled_reminders
      SET status = 'sent',
          sent_count = ?,
          sent_at = ?
      WHERE id = ?
    `).run(recipients.length, now, reminder.id);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, event_id, user_id, user_name, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud_${uuidv4().substring(0, 8)}`,
      reminder.event_id,
      req.user.id,
      req.user.name,
      'TRIGGER_REMINDER',
      `Dispatched email reminder "${reminder.title}" to ${recipients.length} recipients (${reminder.target_audience})`,
      now
    );
  })();

  res.json({
    success: true,
    message: `Reminder successfully sent to ${recipients.length} batchmates! View them in the Sent Reminders log.`,
    recipientCount: recipients.length
  });
});

// POST /api/reminders/whatsapp-share - Generate manually shared WhatsApp update
router.post('/whatsapp-share', (req, res) => {
  const { eventId, messageType, customNotes } = req.body;
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId || 'evt_2026');

  if (!event) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  let formattedText = '';

  if (messageType === 'rsvp_alert') {
    formattedText = `🌟 *GCP BATCH OF 98 - ANNUAL REUNION UPDATE* 🌟\n` +
      `*Government College of Physiotherapy (GCP), Trichy*\n\n` +
      `Dear Batchmates,\n` +
      `Our grand reunion is set for *${event.dates_display}* at *${event.venue_name}* (${event.venue_location})!\n\n` +
      `⏳ *Action Needed:* Please confirm your RSVP and family guest count today so our Venue & Catering teams can finalize oceanfront rooms and banquet menus.\n\n` +
      `🔗 *Confirm Your RSVP here:* https://gcp98-reunion.org/rsvp\n` +
      `${customNotes ? `\n📢 *Note:* ${customNotes}\n` : ''}\n` +
      `Let's make this reunion legendary! 🥂🎉\n` +
      `— *Organizing Committee, GCP Batch of 98*`;
  } else if (messageType === 'payment_alert') {
    formattedText = `💰 *GCP-98 REUNION TREASURY & CONTRIBUTION UPDATE* 💰\n\n` +
      `Dear Friends,\n` +
      `To secure our advance bookings for *${event.title}*, kindly transfer your batch contribution of *₹${event.fee_per_member.toLocaleString()}*.\n\n` +
      `🏦 *Bank Transfer Details:*\n` +
      `• Bank: *${event.bank_name}*\n` +
      `• Account No: *${event.bank_account_no}*\n` +
      `• IFSC Code: *${event.bank_ifsc}*\n` +
      `• UPI ID: *${event.upi_id}*\n\n` +
      `✅ *Important:* After payment, please submit your transaction UTR reference on our portal for verification by our Accounts Volunteer team.\n\n` +
      `🔗 *Submit Payment Proof:* https://gcp98-reunion.org/finance\n` +
      `${customNotes ? `\n📢 *Note:* ${customNotes}\n` : ''}\n` +
      `— *Finance & Accounts Volunteers (Padmaraj, Chennai & Nichoelles, Trichy)*`;
  } else if (messageType === 'poll_alert') {
    formattedText = `🗳️ *VOTE NOW: GCP-98 REUNION DATE POLL* 🗳️\n\n` +
      `Hey Batchmates! We have proposed candidate long weekends for our upcoming reunion.\n\n` +
      `Please vote for your preferred dates to help the committee finalize the best schedule for everyone:\n` +
      `🔗 *Vote on Date Poll:* https://gcp98-reunion.org/polls\n\n` +
      `${customNotes ? `\n📢 *Note:* ${customNotes}\n` : ''}\n` +
      `— *GCP Batch of 98 Organizing Committee*`;
  } else {
    // General reunion update
    formattedText = `🎓 *GCP BATCH OF 98 REUNION PORTAL UPDATE* 🎓\n` +
      `*Government College of Physiotherapy (GCP), Trichy*\n\n` +
      `*${event.title}*\n` +
      `📅 Dates: *${event.dates_display}*\n` +
      `📍 Venue: *${event.venue_name}*, ${event.venue_location}\n\n` +
      `${customNotes || 'Check out our latest announcements, volunteer tasks, and gallery updates on the batch portal.'}\n\n` +
      `🔗 *Open Batch App:* https://gcp98-reunion.org\n\n` +
      `— *GCP Batch of 98 Alumni Network, Trichy*`;
  }

  const encodedUrl = `https://wa.me/?text=${encodeURIComponent(formattedText)}`;

  res.json({
    success: true,
    messageText: formattedText,
    whatsappUrl: encodedUrl
  });
});

module.exports = router;
