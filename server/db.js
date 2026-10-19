const initSqlJs = require('sql.js/dist/sql-wasm-inline.js');
const path = require('path');
const fs = require('fs');


const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dbDir = isVercel ? path.join('/tmp', 'data') : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'reunion.db');
const localDbPath = path.join(__dirname, '..', 'data', 'reunion.db');

let rawDb = null;
let isReady = false;
let initPromise = null;

function saveDb() {
  if (!rawDb) return;
  try {
    const data = rawDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {}
}

async function ensureDbReady() {
  if (isReady && rawDb) return rawDb;
  if (!initPromise) {
    initPromise = (async () => {
      const SQL = await initSqlJs();
      let filebuffer = null;
      if (fs.existsSync(dbPath)) {
        try { filebuffer = fs.readFileSync(dbPath); } catch (e) {}
      } else if (fs.existsSync(localDbPath)) {
        try { filebuffer = fs.readFileSync(localDbPath); } catch (e) {}
      }

      if (filebuffer && filebuffer.length > 0) {
        rawDb = new SQL.Database(filebuffer);
      } else {
        rawDb = new SQL.Database();
      }

      isReady = true;
      initSchema();
      return rawDb;
    })();
  }
  return initPromise;
}

// Start async initialization immediately
initPromise = ensureDbReady();

const db = {
  ensureDbReady,
  prepare(sql) {
    return {
      all(...params) {
        if (!rawDb) throw new Error('Database not ready. Awaiting initialization.');
        const flat = params.flat();
        const stmt = rawDb.prepare(sql);
        if (flat.length > 0) stmt.bind(flat);
        const results = [];
        while (stmt.step()) results.push(stmt.getAsObject());
        stmt.free();
        return results;
      },
      get(...params) {
        if (!rawDb) throw new Error('Database not ready. Awaiting initialization.');
        const flat = params.flat();
        const stmt = rawDb.prepare(sql);
        if (flat.length > 0) stmt.bind(flat);
        let result = undefined;
        if (stmt.step()) result = stmt.getAsObject();
        stmt.free();
        return result;
      },
      run(...params) {
        if (!rawDb) throw new Error('Database not ready. Awaiting initialization.');
        const flat = params.flat();
        rawDb.run(sql, flat);
        const changes = rawDb.getRowsModified();
        saveDb();
        return { changes };
      }
    };
  },
  exec(sql) {
    if (!rawDb) return;
    rawDb.exec(sql);
    saveDb();
  },
  pragma(sql) {},
  transaction(fn) {
    return (...args) => fn(...args);
  }
};


function initSchema() {
  db.exec(`
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      whatsapp TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member', -- 'admin', 'coordinator', 'accounts_volunteer', 'member'
      assigned_team_id TEXT, -- 'finance', 'venue', 'catering', 'entertainment', 'logistics', 'comms'
      city TEXT,
      profession TEXT,
      bio TEXT,
      avatar TEXT,
      status TEXT DEFAULT 'active',
      invite_code_used TEXT,
      created_at TEXT NOT NULL
    );

    -- Invite Codes Table
    CREATE TABLE IF NOT EXISTS invite_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'member',
      assigned_team_id TEXT,
      max_uses INTEGER DEFAULT 50,
      used_count INTEGER DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    -- Yearly Reunion Events Table
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      year INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      theme TEXT,
      description TEXT,
      venue_name TEXT,
      venue_location TEXT,
      dates_display TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'planning', 'voting', 'archived'
      target_budget REAL DEFAULT 0,
      fee_per_member REAL DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      upi_id TEXT,
      bank_name TEXT,
      bank_account_no TEXT,
      bank_ifsc TEXT,
      created_at TEXT NOT NULL
    );

    -- Date Polls
    CREATE TABLE IF NOT EXISTS date_polls (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      deadline TEXT,
      status TEXT DEFAULT 'open', -- 'open', 'closed', 'finalized'
      finalized_option_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS poll_options (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL REFERENCES date_polls(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL,
      location_hint TEXT,
      dates_hint TEXT,
      vote_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS poll_votes (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL REFERENCES date_polls(id) ON DELETE CASCADE,
      option_id TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vote_choice TEXT DEFAULT 'yes', -- 'yes', 'maybe', 'no'
      created_at TEXT NOT NULL,
      UNIQUE(poll_id, user_id, option_id)
    );

    -- RSVPs Table
    CREATE TABLE IF NOT EXISTS rsvps (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL, -- 'attending', 'tentative', 'declined'
      adult_guests INTEGER DEFAULT 0,
      kids_count INTEGER DEFAULT 0,
      total_headcount INTEGER DEFAULT 1,
      meal_preference TEXT DEFAULT 'veg', -- 'veg', 'non_veg', 'jain', 'vegan', 'kids'
      dietary_notes TEXT,
      accommodation_needed INTEGER DEFAULT 0,
      arrival_date TEXT,
      departure_date TEXT,
      travel_mode TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE(event_id, user_id)
    );

    -- 6 Volunteer Teams
    CREATE TABLE IF NOT EXISTS volunteer_teams (
      id TEXT PRIMARY KEY, -- 'finance', 'venue', 'catering', 'entertainment', 'logistics', 'comms'
      name TEXT NOT NULL,
      icon TEXT,
      purpose TEXT,
      coordinator_1_id TEXT REFERENCES users(id),
      coordinator_2_id TEXT REFERENCES users(id),
      budget_allocation REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES volunteer_teams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_in_team TEXT DEFAULT 'member', -- 'coordinator', 'member'
      joined_at TEXT NOT NULL,
      UNIQUE(team_id, user_id)
    );

    -- Tasks
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES volunteer_teams(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      assigned_to TEXT REFERENCES users(id),
      due_date TEXT,
      priority TEXT DEFAULT 'medium', -- 'urgent', 'high', 'medium', 'low'
      status TEXT DEFAULT 'todo', -- 'todo', 'in_progress', 'review', 'completed'
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    -- Quotations / Vendor Bids
    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES volunteer_teams(id) ON DELETE CASCADE,
      vendor_name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      file_url TEXT,
      file_name TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
      rejection_reason TEXT,
      submitted_by TEXT REFERENCES users(id),
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT NOT NULL
    );

    -- Contributions / Batch Payments
    CREATE TABLE IF NOT EXISTS contributions (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      payment_method TEXT NOT NULL, -- 'UPI', 'NEFT', 'Bank Transfer', 'Cash', 'Zelle'
      reference_id TEXT NOT NULL, -- UTR or transaction ID
      payment_date TEXT NOT NULL,
      proof_file_url TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
      verified_by TEXT REFERENCES users(id),
      verified_at TEXT,
      verification_notes TEXT,
      created_at TEXT NOT NULL
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES volunteer_teams(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      vendor_name TEXT,
      payment_date TEXT NOT NULL,
      payment_mode TEXT,
      receipt_url TEXT,
      receipt_name TEXT,
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    -- Announcements
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      priority TEXT DEFAULT 'normal', -- 'urgent', 'important', 'normal'
      is_pinned INTEGER DEFAULT 0,
      author_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    -- Scheduled Reminders
    CREATE TABLE IF NOT EXISTS scheduled_reminders (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      reminder_type TEXT NOT NULL, -- 'rsvp_deadline', 'payment_dues', 'date_poll', 'general'
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      message_body TEXT NOT NULL,
      target_audience TEXT NOT NULL, -- 'all', 'pending_rsvp', 'pending_payment', 'coordinators'
      scheduled_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
      sent_count INTEGER DEFAULT 0,
      sent_at TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    -- Sent Reminders Inbox (for inspecting sent emails and reminders)
    CREATE TABLE IF NOT EXISTS sent_reminders_log (
      id TEXT PRIMARY KEY,
      reminder_id TEXT,
      event_id TEXT,
      channel TEXT NOT NULL, -- 'email' or 'whatsapp'
      recipient_email TEXT,
      recipient_name TEXT,
      subject TEXT,
      content TEXT,
      status TEXT DEFAULT 'sent',
      sent_at TEXT NOT NULL
    );

    -- Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      user_id TEXT REFERENCES users(id),
      user_name TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

module.exports = db;
