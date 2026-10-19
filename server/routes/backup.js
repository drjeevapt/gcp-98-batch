const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/backup/download - Download persistent SQLite database backup
router.get('/download', requireAuth, requireAdmin, (req, res) => {
  const dbDir = path.join(__dirname, '..', '..', 'data');
  const sourceDb = path.join(dbDir, 'reunion.db');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `GCP98_Reunion_DB_Backup_${timestamp}.sqlite`;
  const backupPath = path.join(dbDir, backupFilename);

  try {
    // Use better-sqlite3 atomic backup API
    db.backup(backupPath)
      .then(() => {
        res.download(backupPath, backupFilename, (err) => {
          // Clean up temp backup copy after sending
          if (fs.existsSync(backupPath)) {
            try { fs.unlinkSync(backupPath); } catch (e) {}
          }
        });
      })
      .catch((err) => {
        console.error('Backup error:', err);
        res.status(500).json({ error: 'Failed to create database backup.' });
      });
  } catch (err) {
    console.error('Backup exception:', err);
    res.status(500).json({ error: 'Database backup exception.' });
  }
});

// GET /api/backup/export-json - Full JSON snapshot
router.get('/export-json', requireAuth, requireAdmin, (req, res) => {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    app: 'GCP-98 Batch Reunion Portal',
    events: db.prepare('SELECT * FROM events').all(),
    users: db.prepare('SELECT id, name, email, phone, whatsapp, role, assigned_team_id, city, profession, bio, avatar, status, invite_code_used, created_at FROM users').all(),
    teams: db.prepare('SELECT * FROM volunteer_teams').all(),
    date_polls: db.prepare('SELECT * FROM date_polls').all(),
    poll_options: db.prepare('SELECT * FROM poll_options').all(),
    poll_votes: db.prepare('SELECT * FROM poll_votes').all(),
    rsvps: db.prepare('SELECT * FROM rsvps').all(),
    tasks: db.prepare('SELECT * FROM tasks').all(),
    quotations: db.prepare('SELECT * FROM quotations').all(),
    contributions: db.prepare('SELECT * FROM contributions').all(),
    expenses: db.prepare('SELECT * FROM expenses').all(),
    announcements: db.prepare('SELECT * FROM announcements').all(),
    scheduled_reminders: db.prepare('SELECT * FROM scheduled_reminders').all(),
    invite_codes: db.prepare('SELECT * FROM invite_codes').all(),
    audit_logs: db.prepare('SELECT * FROM audit_logs').all()
  };

  const filename = `GCP98_Reunion_Snapshot_${new Date().toISOString().split('T')[0]}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(data, null, 2));
});

module.exports = router;
