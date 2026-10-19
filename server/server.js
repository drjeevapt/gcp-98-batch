const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Ensure db and initial schema
const db = require('./db');
const { seedDatabase } = require('./seed');
const { authenticate } = require('./middleware/auth');

// Seed default data if needed
seedDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON body parsing and CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global authentication extractor (attaches req.user if token or session present)
app.use(authenticate);

// Static file serving
app.use(express.static(path.join(__dirname, '..', 'public')));
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadsDir = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/polls', require('./routes/polls'));
app.use('/api/rsvps', require('./routes/rsvps'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/backup', require('./routes/backup'));

// Single Page Application Fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
  next();
});

// Background Reminder Engine (Runs every 60 seconds on persistent instances)
if (!isVercel) {
  setInterval(() => {
    try {
    const nowIso = new Date().toISOString();
    const dueReminders = db.prepare(`
      SELECT * FROM scheduled_reminders
      WHERE status = 'pending' AND scheduled_at <= ?
    `).all(nowIso);

    for (const rem of dueReminders) {
      console.log(`[Scheduler] Processing scheduled reminder: "${rem.title}"`);
      // Determine recipients
      let recipients = [];
      if (rem.target_audience === 'pending_rsvp') {
        recipients = db.prepare(`
          SELECT u.id, u.name, u.email
          FROM users u
          LEFT JOIN rsvps r ON r.user_id = u.id AND r.event_id = ?
          WHERE r.id IS NULL OR r.status = 'tentative'
        `).all(rem.event_id);
      } else if (rem.target_audience === 'pending_payment') {
        recipients = db.prepare(`
          SELECT u.id, u.name, u.email
          FROM users u
          LEFT JOIN contributions c ON c.user_id = u.id AND c.event_id = ? AND c.status = 'verified'
          WHERE c.id IS NULL
        `).all(rem.event_id);
      } else {
        recipients = db.prepare('SELECT id, name, email FROM users WHERE status = "active"').all();
      }

      const insertLog = db.prepare(`
        INSERT INTO sent_reminders_log (id, reminder_id, event_id, channel, recipient_email, recipient_name, subject, content, status, sent_at)
        VALUES (?, ?, ?, 'email', ?, ?, ?, ?, 'sent', ?)
      `);

      const { v4: uuidv4 } = require('uuid');
      for (const r of recipients) {
        insertLog.run(
          `snt_${uuidv4().substring(0, 8)}`,
          rem.id,
          rem.event_id,
          r.email,
          r.name,
          rem.subject,
          rem.message_body.replace(/Batchmate/gi, r.name.split(' ')[0]),
          nowIso
        );
      }

      db.prepare(`
        UPDATE scheduled_reminders
        SET status = 'sent',
            sent_count = ?,
            sent_at = ?
        WHERE id = ?
      `).run(recipients.length, nowIso, rem.id);
    }
  } catch (err) {
    console.error('[Scheduler Error]:', err.message);
  }
}, 60000);
}

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🎓 GCP-98 Annual Batch Reunion App is running!`);
    console.log(`🚀 URL: http://localhost:${PORT}`);
    console.log(`📂 Database: data/reunion.db (Persistent SQLite)`);
    console.log(`====================================================`);
  });
}

module.exports = app;

