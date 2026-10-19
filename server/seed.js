const crypto = require('crypto');
const db = require('./db');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const defaultPasswordHash = hashPassword('batch98');

function seedDatabase(forceReseed = false) {
  if (forceReseed) {
    console.log('Force reseed requested. Resetting database tables...');
    db.exec(`
      DELETE FROM audit_logs;
      DELETE FROM sent_reminders_log;
      DELETE FROM scheduled_reminders;
      DELETE FROM announcements;
      DELETE FROM expenses;
      DELETE FROM contributions;
      DELETE FROM quotations;
      DELETE FROM tasks;
      DELETE FROM team_members;
      DELETE FROM volunteer_teams;
      DELETE FROM rsvps;
      DELETE FROM poll_votes;
      DELETE FROM poll_options;
      DELETE FROM date_polls;
      DELETE FROM events;
      DELETE FROM invite_codes;
      DELETE FROM users;
    `);
  } else {
    // Check if already seeded
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount > 0) {
      console.log('Database already has users, skipping full reseed.');
      return;
    }
  }

  console.log('Seeding fresh GCP-98 Batch Reunion database with official leadership roster...');

  const now = new Date().toISOString();

  // 1. Insert Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, phone, whatsapp, password_hash, role, assigned_team_id, city, profession, bio, avatar, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const users = [
    {
      id: 'usr_jeeva_admin',
      name: 'Jeeva',
      email: 'jeeva@gcp98.org',
      phone: '+91 98401 11998',
      whatsapp: '+919840111998',
      role: 'admin',
      team: 'venue',
      city: 'Chennai',
      profession: 'Chief Batch Administrator',
      bio: 'Overall Batch Administrator and President for GCP Batch of 98 Annual Reunion, Government College of Physiotherapy (GCP), Trichy.',
      avatar: '👨‍💼'
    },
    {
      id: 'usr_padmaraj_acc',
      name: 'Padmaraj',
      email: 'padmaraj@gcp98.org',
      phone: '+91 98410 44556',
      whatsapp: '+919841044556',
      role: 'accounts_volunteer',
      team: 'finance',
      city: 'Chennai',
      profession: 'Finance & Accounts Lead',
      bio: 'Lead for Finance & Accounts. Authorized Accounts volunteer verifying member contributions and auditing reunion treasury.',
      avatar: '💼'
    },
    {
      id: 'usr_nichoelles_acc',
      name: 'Nichoelles',
      email: 'nichoelles@gcp98.org',
      phone: '+91 94431 55667',
      whatsapp: '+919443155667',
      role: 'accounts_volunteer',
      team: 'finance',
      city: 'Trichy',
      profession: 'Finance & Accounts Co-Lead',
      bio: 'Authorized Accounts volunteer managing bank reconciliation, payments confirmation, and verified accounts statements.',
      avatar: '📊'
    },
    {
      id: 'usr_kumaresh_venue',
      name: 'Kumaresh',
      email: 'kumaresh@gcp98.org',
      phone: '+91 98421 22334',
      whatsapp: '+919842122334',
      role: 'coordinator',
      team: 'venue',
      city: 'Dindigul',
      profession: 'Location & Venue Lead',
      bio: 'Location Team Lead (Dindigul) & Venue & Hospitality Lead. Also Transport Co-Lead for arrival pick-ups.',
      avatar: '🏨'
    },
    {
      id: 'usr_babu_comms',
      name: 'Babu',
      email: 'babu@gcp98.org',
      phone: '+91 98402 33445',
      whatsapp: '+919840233445',
      role: 'coordinator',
      team: 'comms',
      city: 'Chennai',
      profession: 'Communications Lead & Hospitality Co-Lead',
      bio: 'Lead for Communications & Outreach, and Venue & Hospitality Co-Lead for batchmate reception.',
      avatar: '📢'
    },
    {
      id: 'usr_kavitha_food',
      name: 'Kavitha',
      email: 'kavitha@gcp98.org',
      phone: '+91 94433 66778',
      whatsapp: '+919443366778',
      role: 'coordinator',
      team: 'catering',
      city: 'Hosur',
      profession: 'Food & Menu Lead',
      bio: 'Lead for Food & Menu ensuring authentic banquets and dietary choices, and Communications Co-Lead.',
      avatar: '🍽️'
    },
    {
      id: 'usr_ilaveyini_food',
      name: 'Ilaveyini',
      email: 'ilaveyini@gcp98.org',
      phone: '+91 98403 77889',
      whatsapp: '+919840377889',
      role: 'coordinator',
      team: 'catering',
      city: 'Chennai',
      profession: 'Food & Menu Co-Lead',
      bio: 'Food & Menu Co-Lead coordinating banquet tastings, gala dinners, and pure veg/non-veg menus.',
      avatar: '👩‍🍳'
    },
    {
      id: 'usr_dhatchina_ent',
      name: 'Dhatchina Moorthy',
      email: 'dhatchina@gcp98.org',
      phone: '+91 98422 88990',
      whatsapp: '+919842288990',
      role: 'coordinator',
      team: 'entertainment',
      city: 'Madurai',
      profession: 'Entertainment & Mementos Lead',
      bio: 'Lead for Entertainment & Mementos, curating 90s college nostalgia programs, awards, and mementos.',
      avatar: '🎸'
    },
    {
      id: 'usr_jebaraj_ent',
      name: 'Jebaraj Fletcher',
      email: 'jebaraj@gcp98.org',
      phone: '+91 94432 99001',
      whatsapp: '+919443299001',
      role: 'coordinator',
      team: 'entertainment',
      city: 'Puducherry',
      profession: 'Entertainment & Mementos Co-Lead',
      bio: 'Entertainment & Mementos Co-Lead coordinating commemorative batch hoodies, trophies, and video retrospectives.',
      avatar: '🎭'
    },
    {
      id: 'usr_pandithurai_trans',
      name: 'Pandithurai',
      email: 'pandithurai@gcp98.org',
      phone: '+91 94434 12345',
      whatsapp: '+919443412345',
      role: 'coordinator',
      team: 'logistics',
      city: 'Karaikudi',
      profession: 'Transport Lead',
      bio: 'Lead for Transport coordinating group coaches, railway station/airport pick-ups, and convoy logistics.',
      avatar: '🚌'
    },
    {
      id: 'usr_siddharth_mbr',
      name: 'Siddharth Roy',
      email: 'siddharth@gcp98.org',
      phone: '+91 98300 56789',
      whatsapp: '+919830056789',
      role: 'member',
      team: null,
      city: 'Coimbatore',
      profession: 'Software Consultant',
      bio: 'Proud alumnus of Government College of Physiotherapy (GCP), Trichy - GCP Batch of 98. Looking forward to catching up with everyone!',
      avatar: '🧑‍💻'
    },
    {
      id: 'usr_shalini_mbr',
      name: 'Shalini Kulkarni',
      email: 'shalini@gcp98.org',
      phone: '+91 98200 78901',
      whatsapp: '+919820078901',
      role: 'member',
      team: null,
      city: 'Salem',
      profession: 'Educationist',
      bio: 'Attending with spouse and two children.',
      avatar: '👩‍🏫'
    },
    {
      id: 'usr_rahul_mbr',
      name: 'Rahul Bose',
      email: 'rahul@gcp98.org',
      phone: '+91 98210 67890',
      whatsapp: '+919821067890',
      role: 'member',
      team: null,
      city: 'Tirunelveli',
      profession: 'Healthcare Entrepreneur',
      bio: 'Hostel memories forever! Coming for the weekend.',
      avatar: '👨‍⚕️'
    }
  ];

  for (const u of users) {
    insertUser.run(
      u.id,
      u.name,
      u.email,
      u.phone,
      u.whatsapp,
      defaultPasswordHash,
      u.role,
      u.team,
      u.city,
      u.profession,
      u.bio,
      u.avatar,
      now
    );
  }

  // 2. Insert Invite Codes
  const insertInvite = db.prepare(`
    INSERT INTO invite_codes (id, code, role, assigned_team_id, max_uses, used_count, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertInvite.run('inv_1', 'BATCH98-VIP', 'member', null, 100, 3, 'Official batch invite token for GCP Batch of 98 (Government College of Physiotherapy, Trichy)', 'usr_jeeva_admin', now);
  insertInvite.run('inv_2', 'GCP98-REUNITE', 'member', null, 50, 1, 'General alumni registration code', 'usr_jeeva_admin', now);
  insertInvite.run('inv_3', 'ACCOUNTS-VOLUNTEER-98', 'accounts_volunteer', 'finance', 5, 2, 'Authorised accounts team access pass (Padmaraj & Nichoelles)', 'usr_jeeva_admin', now);

  // 3. Insert Events
  const insertEvent = db.prepare(`
    INSERT INTO events (id, year, title, theme, description, venue_name, venue_location, dates_display, start_date, end_date, status, target_budget, fee_per_member, currency, upi_id, bank_name, bank_account_no, bank_ifsc, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertEvent.run(
    'evt_2026',
    2026,
    'GCP Batch of 98 Annual Batch Day 2026',
    'Nostalgia & Brotherhood in Trichy',
    'Official Batch Day celebration of Government College of Physiotherapy (GCP), Trichy - GCP Batch of 98. Successfully completed on October 11, 2026 at Mullai Resort, Vayaloor, Trichy under the leadership of Jeeva (Admin), with Kumaresh (Location & Venue), Padmaraj & Nichoelles (Finance & Accounts), Kavitha & Ilaveyini (Food & Menu), Dhatchina Moorthy & Jebaraj Fletcher (Entertainment), Pandithurai (Transport), and Babu (Comms). Reconciled attendance, awards, banquet feast, and audited accounts are archived.',
    'Mullai Resort, Vayaloor',
    'Trichy',
    'October 11, 2026',
    '2026-10-11',
    '2026-10-11',
    'completed',
    750000,
    15000,
    'INR',
    'gcp98reunion@hdfcbank',
    'HDFC Bank - Alumni Reunion Escrow',
    '50100498989801',
    'HDFC0001998',
    now
  );

  insertEvent.run(
    'evt_2025',
    2025,
    'GCP-98 Silver Jubilee Homecoming 2025',
    '25 Years of Brotherhood & Excellence',
    'Historical Silver Jubilee milestone celebration of GCP Batch of 98, Government College of Physiotherapy (GCP), Trichy. Held at Royal Orchid Convention Resort. Completely audited and archived.',
    'Royal Orchid Convention Resort',
    'Yercaud / Shevaroy Hills',
    'December 12 - 14, 2025',
    '2025-12-12',
    '2025-12-14',
    'archived',
    720000,
    14000,
    'INR',
    'gcp98reunion@hdfcbank',
    'HDFC Bank',
    '50100498989801',
    'HDFC0001998',
    '2025-01-10T10:00:00.000Z'
  );

  insertEvent.run(
    'evt_2024',
    2024,
    'GCP-98 Winter Get-Together 2024',
    'Rekindling Old Flames',
    'Intimate batch gathering with hostel memory sessions, bonfire barbecue, and alumni scholarship endowment launch.',
    'Hilltop Retreat & Convention',
    'Kodaikanal',
    'November 15 - 17, 2024',
    '2024-11-15',
    '2024-11-17',
    'archived',
    480000,
    10000,
    'INR',
    'gcp98reunion@hdfcbank',
    'HDFC Bank',
    '50100498989801',
    'HDFC0001998',
    '2024-01-15T10:00:00.000Z'
  );

  insertEvent.run(
    'evt_2027',
    2027,
    'GCP Batch of 98 Annual Batch Day 2027',
    'Together Again: Heritage & Brotherhood',
    'Official planning in full swing for our upcoming 2027 Batch Day in October month! Organizing Committee and Location Team are gathering member preferences via date polls to finalize candidate October weekends and venue in Trichy/destination.',
    'Trichy / Destination (Poll in Progress)',
    'Trichy / Tamil Nadu',
    'October 2027 (Date Polls Active)',
    '2027-10-09',
    '2027-10-10',
    'planning',
    850000,
    15000,
    'INR',
    'gcp98reunion@hdfcbank',
    'HDFC Bank - Alumni Reunion Escrow',
    '50100498989801',
    'HDFC0001998',
    now
  );

  // 4. Six Volunteer Teams (with exact requested names and 2 coordinators each)
  const insertTeam = db.prepare(`
    INSERT INTO volunteer_teams (id, name, icon, purpose, coordinator_1_id, coordinator_2_id, budget_allocation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Finance & Accounts (Lead: Padmaraj, Chennai; Nichoelles, Trichy)
  insertTeam.run(
    'finance',
    'Finance & Accounts',
    '💰',
    'Manage reunion treasury, bank accounts, UPI receipts, vendor disbursements, expense audit and verified balance sheet reports. Lead: Padmaraj (Chennai), Co-Lead: Nichoelles (Trichy).',
    'usr_padmaraj_acc',
    'usr_nichoelles_acc',
    15000
  );

  // 2. Venue & Hospitality (Lead: Kumaresh, Dindigul; Babu, Chennai - Location Team: Kumaresh, Dindigul)
  insertTeam.run(
    'venue',
    'Venue & Hospitality',
    '🏨',
    'Resort contract negotiations, room inventory allotment, arrival welcome desk, check-in hampers and Location Team scouting (Dindigul / destination). Lead: Kumaresh (Dindigul), Co-Lead: Babu (Chennai).',
    'usr_kumaresh_venue',
    'usr_babu_comms',
    420000
  );

  // 3. Food & Menu (Lead: Kavitha, Hosur; Ilaveyini, Chennai)
  insertTeam.run(
    'catering',
    'Food & Menu',
    '🍽️',
    'Curating authentic South Indian feast, gala dinner menus, veg/non-veg/jain options, cocktail appetizers, and midnight refreshments. Lead: Kavitha (Hosur), Co-Lead: Ilaveyini (Chennai).',
    'usr_kavitha_food',
    'usr_ilaveyini_food',
    210000
  );

  // 4. Entertainment & Mementos (Lead: Dhatchina Moorthy, Madurai; Jebaraj Fletcher, Puducherry)
  insertTeam.run(
    'entertainment',
    'Entertainment & Mementos',
    '🎸',
    'Cultural evening, 90s college nostalgia quiz, DJ & music, commemorative batch hoodies & mementos, video retrospectives and trophies. Lead: Dhatchina Moorthy (Madurai), Co-Lead: Jebaraj Fletcher (Puducherry).',
    'usr_dhatchina_ent',
    'usr_jebaraj_ent',
    110000
  );

  // 5. Transport (formerly Logistics & Technology) (Lead: Pandithurai, Karaikudi; Kumaresh, Dindigul)
  insertTeam.run(
    'logistics',
    'Transport',
    '🚌',
    'Coach bus coordination, railway station & airport group pickups, intercity travel routes, and convoy transport logistics. Lead: Pandithurai (Karaikudi), Co-Lead: Kumaresh (Dindigul).',
    'usr_pandithurai_trans',
    'usr_kumaresh_venue',
    65000
  );

  // 6. Communications & Outreach (Lead: Babu, Chennai; Kavitha, Hosur)
  insertTeam.run(
    'comms',
    'Communications & Outreach',
    '📢',
    'Connecting all 98 batchmates across cities and countries, WhatsApp broadcasts, automated email reminders, and nostalgic rollcall. Lead: Babu (Chennai), Co-Lead: Kavitha (Hosur).',
    'usr_babu_comms',
    'usr_kavitha_food',
    30000
  );

  // 5. Date Polls for 2026 (Completed) and 2027 (Active in October)
  const insertPoll = db.prepare(`
    INSERT INTO date_polls (id, event_id, title, description, deadline, status, finalized_option_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPoll.run(
    'poll_2026',
    'evt_2026',
    '2026 Batch Day Confirmed Date & Venue',
    'Concluded member poll for 2026 Batch Day. Final decision: Sunday, October 11, 2026 at Mullai Resort, Vayaloor, Trichy.',
    '2026-10-01',
    'finalized',
    'opt_2026_1',
    now
  );

  const insertPollOpt = db.prepare(`
    INSERT INTO poll_options (id, poll_id, option_text, location_hint, dates_hint, vote_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertPollOpt.run('opt_2026_1', 'poll_2026', 'Sunday, October 11, 2026 (Selected & Held)', 'Mullai Resort, Vayaloor, Trichy', 'October 11, 2026', 28);
  insertPollOpt.run('opt_2026_2', 'poll_2026', 'Sunday, October 04, 2026 (Alternative)', 'Trichy City Center', 'October 04, 2026', 6);
  insertPollOpt.run('opt_2026_3', 'poll_2026', 'Sunday, October 18, 2026', 'Srirangam Heritage Enclave', 'October 18, 2026', 4);

  // Active Date Poll for 2027 (October Month Planning)
  insertPoll.run(
    'poll_2027',
    'evt_2027',
    'Vote: Preferred October Weekend for 2027 Batch Day',
    'The Organizing Committee and Location Team are planning our 2027 Batch Day in October month. Please vote for your preferred October 2027 weekend to help us finalize dates and bookings:',
    '2027-01-31',
    'open',
    null,
    now
  );

  insertPollOpt.run('opt_2027_1', 'poll_2027', 'Weekend 1: October 2 - 3, 2027 (Gandhi Jayanti Weekend)', 'Trichy / Vayaloor Heritage Enclave', 'Oct 02 - Oct 03, 2027', 8);
  insertPollOpt.run('opt_2027_2', 'poll_2027', 'Weekend 2: October 9 - 10, 2027 (Second Saturday & Sunday - Recommended)', 'Trichy / Destination Resort (Location Team Recommended)', 'Oct 09 - Oct 10, 2027', 16);
  insertPollOpt.run('opt_2027_3', 'poll_2027', 'Weekend 3: October 16 - 17, 2027 (Mid-October Autumn Weekend)', 'Trichy / Convention Venue', 'Oct 16 - Oct 17, 2027', 6);
  insertPollOpt.run('opt_2027_4', 'poll_2027', 'Weekend 4: October 23 - 24, 2027 (Late October Pre-Festive Weekend)', 'Trichy / Coastal Getaway', 'Oct 23 - Oct 24, 2027', 4);

  // Insert poll votes
  const insertVote = db.prepare(`
    INSERT INTO poll_votes (id, poll_id, option_id, user_id, vote_choice, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  // 2026 votes
  insertVote.run('vote_1', 'poll_2026', 'opt_2026_1', 'usr_jeeva_admin', 'yes', now);
  insertVote.run('vote_2', 'poll_2026', 'opt_2026_1', 'usr_padmaraj_acc', 'yes', now);
  insertVote.run('vote_3', 'poll_2026', 'opt_2026_1', 'usr_kumaresh_venue', 'yes', now);
  insertVote.run('vote_4', 'poll_2026', 'opt_2026_1', 'usr_pandithurai_trans', 'yes', now);
  insertVote.run('vote_5', 'poll_2026', 'opt_2026_2', 'usr_kavitha_food', 'yes', now);

  // 2027 votes
  insertVote.run('vote_27_1', 'poll_2027', 'opt_2027_2', 'usr_jeeva_admin', 'yes', now);
  insertVote.run('vote_27_2', 'poll_2027', 'opt_2027_2', 'usr_padmaraj_acc', 'yes', now);
  insertVote.run('vote_27_3', 'poll_2027', 'opt_2027_2', 'usr_kumaresh_venue', 'yes', now);
  insertVote.run('vote_27_4', 'poll_2027', 'opt_2027_1', 'usr_babu_comms', 'yes', now);
  insertVote.run('vote_27_5', 'poll_2027', 'opt_2027_2', 'usr_kavitha_food', 'yes', now);

  // 6. RSVPs with guest & meal counts
  const insertRsvp = db.prepare(`
    INSERT INTO rsvps (id, event_id, user_id, status, adult_guests, kids_count, total_headcount, meal_preference, dietary_notes, accommodation_needed, arrival_date, departure_date, travel_mode, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRsvp.run(
    'rsvp_1',
    'evt_2026',
    'usr_jeeva_admin',
    'attending',
    1,
    0,
    2,
    'non_veg',
    'None',
    1,
    '2026-11-20',
    '2026-11-22',
    'Driving from Chennai with committee banners',
    'Reunion admin setup room required.',
    now
  );

  insertRsvp.run(
    'rsvp_2',
    'evt_2026',
    'usr_padmaraj_acc',
    'attending',
    1,
    2,
    4,
    'veg',
    'Pure vegetarian food for kids and self',
    1,
    '2026-11-20',
    '2026-11-22',
    'Driving from Chennai with family',
    'Family attending full weekend.',
    now
  );

  insertRsvp.run(
    'rsvp_3',
    'evt_2026',
    'usr_kumaresh_venue',
    'attending',
    0,
    0,
    1,
    'non_veg',
    'None',
    1,
    '2026-11-19',
    '2026-11-23',
    'Arriving 1 day prior from Dindigul for setup',
    'Location team & resort room allocation setup.',
    now
  );

  insertRsvp.run(
    'rsvp_4',
    'evt_2026',
    'usr_kavitha_food',
    'attending',
    1,
    1,
    3,
    'veg',
    'Kid meal required for child',
    1,
    '2026-11-20',
    '2026-11-22',
    'Coach from Hosur',
    'Food & Menu tasting session on Friday afternoon.',
    now
  );

  insertRsvp.run(
    'rsvp_5',
    'evt_2026',
    'usr_pandithurai_trans',
    'attending',
    1,
    0,
    2,
    'non_veg',
    'None',
    1,
    '2026-11-20',
    '2026-11-22',
    'Coordinating group bus from Karaikudi/Madurai',
    'Transport lead convoy arrival.',
    now
  );

  insertRsvp.run(
    'rsvp_6',
    'evt_2026',
    'usr_dhatchina_ent',
    'attending',
    1,
    1,
    3,
    'non_veg',
    'None',
    1,
    '2026-11-20',
    '2026-11-22',
    'Train from Madurai',
    'Bringing cultural quiz props & mementos.',
    now
  );

  insertRsvp.run(
    'rsvp_7',
    'evt_2026',
    'usr_siddharth_mbr',
    'attending',
    0,
    0,
    1,
    'non_veg',
    'None',
    1,
    '2026-11-20',
    '2026-11-22',
    'Train from Coimbatore',
    'Hostel B wing memories ready!',
    now
  );

  // 7. Tasks with ownership and deadlines
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, event_id, team_id, title, description, assigned_to, due_date, priority, status, created_by, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTask.run(
    'tsk_1',
    'evt_2026',
    'venue',
    'Finalize Mullai Resort, Vayaloor booking and hall setup',
    'Negotiate banquet dining hall, day-resort amenities, lawn access, and welcome hampers in coordination with Kumaresh (Location Team).',
    'usr_kumaresh_venue',
    '2026-10-10',
    'urgent',
    'completed',
    'usr_jeeva_admin',
    now,
    '2026-10-11T18:00:00.000Z'
  );

  insertTask.run(
    'tsk_2',
    'evt_2026',
    'finance',
    'Reconcile October batch contribution pledges',
    'Cross-check all UTR submissions against HDFC statement. Issue official receipts and follow up on pending dues.',
    'usr_padmaraj_acc',
    '2026-10-31',
    'high',
    'in_progress',
    'usr_jeeva_admin',
    now,
    null
  );

  insertTask.run(
    'tsk_3',
    'evt_2026',
    'catering',
    'Menu tasting and banquet finalization for Gala Dinner',
    'Curate traditional banquet menu, gala appetizers, live dosa counters, and pure veg/non-veg selections.',
    'usr_kavitha_food',
    '2026-11-02',
    'high',
    'todo',
    'usr_jeeva_admin',
    now,
    null
  );

  insertTask.run(
    'tsk_4',
    'evt_2026',
    'entertainment',
    'Finalize batch hoodie sizes and commemorative memento print',
    'Verify embroidered crest samples with GCP 1998 logo and order 75 custom batch hoodies + memento awards.',
    'usr_dhatchina_ent',
    '2026-10-28',
    'urgent',
    'todo',
    'usr_jeeva_admin',
    now,
    null
  );

  insertTask.run(
    'tsk_5',
    'evt_2026',
    'logistics',
    'Finalize AC Coach buses and airport/station pick-up schedules',
    'Arrange 2 luxury AC coach buses for batchmates arriving from Chennai Central, Madurai, and Trichy.',
    'usr_pandithurai_trans',
    '2026-11-10',
    'high',
    'todo',
    'usr_jeeva_admin',
    now,
    null
  );

  insertTask.run(
    'tsk_6',
    'evt_2026',
    'comms',
    'Broadcast WhatsApp reminder on RSVP deadline & payment dues',
    'Send formatted batch update on room count, contribution verification status, and attendance rollcall.',
    'usr_babu_comms',
    '2026-10-22',
    'urgent',
    'completed',
    'usr_jeeva_admin',
    now,
    '2026-10-12T10:00:00.000Z'
  );

  // 2027 Planning Tasks (October Month)
  insertTask.run(
    'tsk_27_1',
    'evt_2027',
    'venue',
    'Collate October 2027 Date Poll votes & shortlist venues',
    'Monitor live member polling on candidate October weekends to finalize official dates and contract negotiations.',
    'usr_kumaresh_venue',
    '2027-01-31',
    'urgent',
    'in_progress',
    'usr_jeeva_admin',
    now,
    null
  );

  insertTask.run(
    'tsk_27_2',
    'evt_2027',
    'venue',
    'Location Team resort site inspection in Trichy & nearby regions',
    'Location Team inspection of resorts, banquet capacity, and lodging for October 2027 Batch Day.',
    'usr_kumaresh_venue',
    '2027-02-15',
    'high',
    'todo',
    'usr_jeeva_admin',
    now,
    null
  );

  insertTask.run(
    'tsk_27_3',
    'evt_2027',
    'finance',
    'Draft preliminary budget & contribution structure for 2027',
    'Calculate projected expenses for catering, stage AV, mementos, and transport for October 2027.',
    'usr_padmaraj_acc',
    '2027-02-28',
    'high',
    'todo',
    'usr_jeeva_admin',
    now,
    null
  );

  insertTask.run(
    'tsk_27_4',
    'evt_2027',
    'comms',
    'Launch batch outreach campaign for October 2027 milestone',
    'Reach out to domestic and overseas batchmates to build maximum attendance for October 2027.',
    'usr_babu_comms',
    '2027-01-15',
    'urgent',
    'in_progress',
    'usr_jeeva_admin',
    now,
    null
  );

  // 8. Quotations / Vendor Bids
  const insertQuote = db.prepare(`
    INSERT INTO quotations (id, event_id, team_id, vendor_name, category, amount, currency, file_url, file_name, notes, status, rejection_reason, submitted_by, reviewed_by, reviewed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertQuote.run(
    'qte_1',
    'evt_2026',
    'venue',
    'Mullai Resort, Vayaloor (Trichy)',
    'venue',
    185000,
    'INR',
    '/uploads/quotations/mullai_resort_vayaloor.pdf',
    'Mullai_Resort_Vayaloor_Settlement.pdf',
    'Banquet halls, lush lawn dining, day-suite amenities, welcome drinks, and hall setup for October 11, 2026 Batch Day in Trichy. Negotiated by Kumaresh (Location Team) & Babu (Chennai). Approved & Settled.',
    'approved',
    null,
    'usr_kumaresh_venue',
    'usr_jeeva_admin',
    now,
    now
  );

  insertQuote.run(
    'qte_2',
    'evt_2026',
    'entertainment',
    'SouthWave Audio & Stage Lighting (Madurai)',
    'av_sound',
    85000,
    'INR',
    '/uploads/quotations/southwave_av_quote.pdf',
    'SouthWave_AV_Lighting_Proposal.pdf',
    'High-fidelity sound, wireless microphones, retro lighting, and 16x9ft high-res LED video backdrop for nostalgia memories. Submitted by Dhatchina Moorthy.',
    'approved',
    null,
    'usr_dhatchina_ent',
    'usr_jeeva_admin',
    now,
    now
  );

  insertQuote.run(
    'qte_3',
    'evt_2026',
    'entertainment',
    'Royal Memento & Apparel Crafts (Madurai)',
    'memento',
    62000,
    'INR',
    '/uploads/quotations/hoodies_mementos_quote.pdf',
    'GCP98_Hoodies_Mementos_Estimate.pdf',
    '75 custom embroidered GCP-98 batch hoodies + engraved glass memento trophies. Submitted by Jebaraj Fletcher & Dhatchina Moorthy.',
    'pending',
    null,
    'usr_jebaraj_ent',
    null,
    null,
    now
  );

  insertQuote.run(
    'qte_4',
    'evt_2026',
    'logistics',
    'Southern Star Luxury Travels (Karaikudi & Chennai)',
    'transport',
    55000,
    'INR',
    '/uploads/quotations/bus_transport_quote.pdf',
    'Southern_Star_Luxury_Coaches_Quote.pdf',
    '2 Volvo AC Luxury coaches for batch transport, station pick-up and drop-offs. Submitted by Pandithurai (Transport Lead).',
    'approved',
    null,
    'usr_pandithurai_trans',
    'usr_jeeva_admin',
    now,
    now
  );

  // 9. Contributions / Member Payments
  // Note: 2 VERIFIED by Padmaraj (Accounts Lead), 2 PENDING verification so user can test the Accounts Volunteer verification gate!
  const insertContribution = db.prepare(`
    INSERT INTO contributions (id, event_id, user_id, amount, currency, payment_method, reference_id, payment_date, proof_file_url, notes, status, verified_by, verified_at, verification_notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertContribution.run(
    'cnt_1',
    'evt_2026',
    'usr_jeeva_admin',
    30000,
    'INR',
    'UPI',
    'UPI/429188291029/HDFC',
    '2026-10-10',
    '/uploads/receipts/proof_jeeva_upi.png',
    'Fee for self + spouse sponsorship pledge (₹15,000 + ₹15,000 voluntary contribution)',
    'verified',
    'usr_padmaraj_acc',
    '2026-10-11T14:30:00.000Z',
    'Credited in HDFC Bank A/C on 10-Oct. Verified by Padmaraj (Accounts Lead).',
    '2026-10-10T12:00:00.000Z'
  );

  insertContribution.run(
    'cnt_2',
    'evt_2026',
    'usr_kumaresh_venue',
    15000,
    'INR',
    'NEFT',
    'NEFT-N261012984712',
    '2026-10-12',
    '/uploads/receipts/proof_kumaresh_neft.png',
    'Standard member fee for 2026 reunion',
    'verified',
    'usr_padmaraj_acc',
    '2026-10-13T10:15:00.000Z',
    'Bank statement verified by Padmaraj (Accounts). Official receipt generated.',
    '2026-10-12T09:30:00.000Z'
  );

  insertContribution.run(
    'cnt_3',
    'evt_2026',
    'usr_siddharth_mbr',
    15000,
    'INR',
    'UPI',
    'UPI/429599182301/SBIN',
    '2026-10-18',
    '/uploads/receipts/proof_siddharth_upi.png',
    'Transferred via Google Pay to gcp98reunion@hdfcbank',
    'pending', // Ready to be verified by Padmaraj or Nichoelles!
    null,
    null,
    null,
    now
  );

  insertContribution.run(
    'cnt_4',
    'evt_2026',
    'usr_shalini_mbr',
    25000,
    'INR',
    'Bank Transfer',
    'IMPS-IM0928371928',
    '2026-10-17',
    '/uploads/receipts/proof_shalini_imps.png',
    'Member fee + extra guest/kids contribution',
    'pending', // Ready to be verified by Padmaraj or Nichoelles!
    null,
    null,
    null,
    now
  );

  insertContribution.run(
    'cnt_5',
    'evt_2026',
    'usr_rahul_mbr',
    10000,
    'INR',
    'Cash / Cheque',
    'CHQ-981029',
    '2026-10-15',
    null,
    'Cheque handed over in Chennai meetup',
    'rejected',
    'usr_nichoelles_acc',
    '2026-10-16T11:00:00.000Z',
    'Cheque returned due to signature mismatch. Please re-issue via UPI or NEFT. Flagged by Nichoelles (Accounts).',
    '2026-10-15T10:00:00.000Z'
  );

  // 10. Expenses
  const insertExpense = db.prepare(`
    INSERT INTO expenses (id, event_id, team_id, title, category, amount, currency, vendor_name, payment_date, payment_mode, receipt_url, receipt_name, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertExpense.run(
    'exp_1',
    'evt_2026',
    'venue',
    'Mullai Resort, Vayaloor Venue Settlement',
    'venue',
    185000,
    'INR',
    'Mullai Resort, Vayaloor (Trichy)',
    '2026-10-11',
    'Bank Transfer',
    '/uploads/receipts/mullai_resort_receipt.pdf',
    'Mullai_Resort_Settlement_Receipt.pdf',
    'Full settlement for venue, lawn banquet hall, and amenities for Oct 11, 2026 Batch Day in Trichy. Coordinated by Kumaresh (Location Team) & Padmaraj (Accounts Lead).',
    'usr_padmaraj_acc',
    now
  );

  insertExpense.run(
    'exp_2',
    'evt_2026',
    'entertainment',
    'Sound & DJ booking deposit (25%)',
    'av_sound',
    20000,
    'INR',
    'SouthWave Audio & Stage Lighting (Madurai)',
    '2026-10-16',
    'UPI',
    '/uploads/receipts/dj_token_receipt.pdf',
    'DJ_Sound_Token_20k.pdf',
    'Booking token for 90s retro night and LED wall. Coordinated by Dhatchina Moorthy (Madurai).',
    'usr_padmaraj_acc',
    now
  );

  // 11. Announcements
  const insertAnnounce = db.prepare(`
    INSERT INTO announcements (id, event_id, title, content, priority, is_pinned, author_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAnnounce.run(
    'anc_1',
    'evt_2026',
    'GCP Batch of 98 Batch Day 2026 Concluded at Mullai Resort, Vayaloor, Trichy!',
    'Heartiest congratulations to all batchmates! Our 2026 Batch Day was successfully celebrated on October 11, 2026 at Mullai Resort, Vayaloor, Trichy under the leadership of Jeeva (Admin), with Kumaresh (Location Team & Venue), Padmaraj & Nichoelles (Finance & Accounts), Kavitha & Ilaveyini (Food & Menu), Dhatchina Moorthy & Jebaraj Fletcher (Entertainment & Mementos), Pandithurai (Transport), and Babu (Communications & Outreach). Audited financials, verified contributions, and official attendance register are now available in the portal. Planning for 2027 Batch Day in October month has commenced!',
    'urgent',
    1,
    'usr_jeeva_admin',
    now
  );

  insertAnnounce.run(
    'anc_2',
    'evt_2026',
    'Contribution Verification Protocol - Message from Finance & Accounts',
    'Please note that for strict financial audit and transparency, all payments made via UPI or Bank Transfer must include your UTR / Reference number. Our Accounts Volunteers (Padmaraj & Nichoelles) will reconcile each deposit before issuing verified batch receipts.',
    'important',
    1,
    'usr_padmaraj_acc',
    now
  );

  insertAnnounce.run(
    'anc_3',
    'evt_2026',
    'Memento Hoodies & Nostalgia Slide Submissions Open',
    'The Entertainment team (Dhatchina Moorthy & Jebaraj Fletcher) is curating our silver batch yearbook and nostalgic video! Please send your old 1994-1998 college photos, hostel snaps, and submit your hoodie size in the profile settings.',
    'normal',
    0,
    'usr_dhatchina_ent',
    now
  );

  // 12. Scheduled Reminders
  const insertReminder = db.prepare(`
    INSERT INTO scheduled_reminders (id, event_id, reminder_type, title, subject, message_body, target_audience, scheduled_at, status, sent_count, sent_at, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertReminder.run(
    'rem_1',
    'evt_2027',
    'rsvp_deadline',
    '2027 Batch Day Date Polls Active (October Month Planning)',
    '[GCP-98] 🗳️ Vote on Candidate October 2027 Weekends for 2027 Batch Day!',
    'Dear GCP Batch of 98 Batchmates,\n\nFollowing our grand and memorable Batch Day on October 11, 2026 at Mullai Resort, Vayaloor, Trichy, planning has kicked off for our next gathering in October 2027!\n\nPlease log in and vote for your preferred October 2027 weekend on our portal so the Location Team can finalize venue bookings: https://gcp98-reunion.org/polls\n\nWarm regards,\nJeeva & Organizing Committee (Government College of Physiotherapy, Trichy)',
    'all',
    '2026-10-25T09:00:00.000Z',
    'pending',
    0,
    null,
    'usr_jeeva_admin',
    now
  );

  insertReminder.run(
    'rem_2',
    'evt_2026',
    'payment_dues',
    'Payment Verification Dues Reminder',
    '[GCP-98 Accounts] Reunion Contribution Dues & Verification Update',
    'Dear Batchmate,\n\nThis is a friendly reminder from Padmaraj (Chennai) & Nichoelles (Trichy) of your Finance & Accounts team. The standard contribution fee of ₹15,000 is due by Oct 31, 2026. If you have already transferred the amount, please log into the portal and submit your transaction UTR so our Accounts Volunteers can verify your receipt.\n\nThank you for making our reunion possible!\nPadmaraj & Nichoelles (Finance & Accounts Leads)',
    'pending_payment',
    '2026-10-26T10:00:00.000Z',
    'pending',
    0,
    null,
    'usr_padmaraj_acc',
    now
  );

  // 13. Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, event_id, user_id, user_name, action, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run(
    'aud_1',
    'evt_2026',
    'usr_padmaraj_acc',
    'Padmaraj',
    'VERIFY_PAYMENT',
    'Verified contribution of ₹30,000 for Jeeva (Ref: UPI/429188291029/HDFC)',
    '2026-10-11T14:30:00.000Z'
  );

  insertAudit.run(
    'aud_2',
    'evt_2026',
    'usr_padmaraj_acc',
    'Padmaraj',
    'VERIFY_PAYMENT',
    'Verified contribution of ₹15,000 for Kumaresh (Ref: NEFT-N261012984712)',
    '2026-10-13T10:15:00.000Z'
  );

  insertAudit.run(
    'aud_3',
    'evt_2026',
    'usr_jeeva_admin',
    'Jeeva',
    'APPROVE_QUOTE',
    'Approved vendor quotation from Heritage Coastal Resort & Convention Center for ₹3,80,000 (Venue Lead: Kumaresh)',
    '2026-10-14T11:00:00.000Z'
  );

  console.log('Seeding completed successfully with official GCP-98 leadership roster!');
}

module.exports = { seedDatabase };

if (require.main === module) {
  const force = process.argv.includes('--force');
  seedDatabase(force);
}
