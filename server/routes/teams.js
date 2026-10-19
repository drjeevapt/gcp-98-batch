const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/teams - List the 6 volunteer teams with coordinator details and metrics
router.get('/', (req, res) => {
  const teams = db.prepare('SELECT * FROM volunteer_teams').all();

  const fullTeams = teams.map(team => {
    const c1 = team.coordinator_1_id ? db.prepare('SELECT id, name, email, phone, whatsapp, avatar, profession, city FROM users WHERE id = ?').get(team.coordinator_1_id) : null;
    const c2 = team.coordinator_2_id ? db.prepare('SELECT id, name, email, phone, whatsapp, avatar, profession, city FROM users WHERE id = ?').get(team.coordinator_2_id) : null;

    // Get active tasks count
    const taskStats = db.prepare(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'urgent' AND status != 'completed' THEN 1 ELSE 0 END) as urgent_tasks
      FROM tasks
      WHERE team_id = ?
    `).get(team.id);

    // Get team members
    const members = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.whatsapp, u.avatar, u.city
      FROM users u
      WHERE u.assigned_team_id = ?
    `).all(team.id);

    // Total expenses incurred by this team
    const expenseStat = db.prepare(`
      SELECT SUM(amount) as total_spent
      FROM expenses
      WHERE team_id = ?
    `).get(team.id);

    return {
      ...team,
      coordinator_1: c1,
      coordinator_2: c2,
      members,
      stats: {
        total_tasks: taskStats.total_tasks || 0,
        completed_tasks: taskStats.completed_tasks || 0,
        urgent_tasks: taskStats.urgent_tasks || 0,
        total_spent: expenseStat.total_spent || 0
      }
    };
  });

  res.json({ success: true, teams: fullTeams });
});

// PUT /api/teams/:id/coordinators - Admin can assign/reassign the 2 coordinators per team
router.put('/:id/coordinators', requireAuth, requireAdmin, (req, res) => {
  const { coordinator_1_id, coordinator_2_id, budget_allocation, purpose } = req.body;
  const teamId = req.params.id;

  const team = db.prepare('SELECT * FROM volunteer_teams WHERE id = ?').get(teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found.' });
  }

  db.transaction(() => {
    db.prepare(`
      UPDATE volunteer_teams
      SET coordinator_1_id = COALESCE(?, coordinator_1_id),
          coordinator_2_id = COALESCE(?, coordinator_2_id),
          budget_allocation = COALESCE(?, budget_allocation),
          purpose = COALESCE(?, purpose)
      WHERE id = ?
    `).run(coordinator_1_id, coordinator_2_id, budget_allocation, purpose, teamId);

    // Update user roles/team assignments if specified
    if (coordinator_1_id) {
      db.prepare("UPDATE users SET assigned_team_id = ?, role = CASE WHEN role = 'member' THEN 'coordinator' ELSE role END WHERE id = ?").run(teamId, coordinator_1_id);
    }
    if (coordinator_2_id) {
      db.prepare("UPDATE users SET assigned_team_id = ?, role = CASE WHEN role = 'member' THEN 'coordinator' ELSE role END WHERE id = ?").run(teamId, coordinator_2_id);
    }
  })();

  res.json({ success: true, message: `Coordinators updated for ${team.name}.` });
});

// POST /api/teams/:id/join - Join a team as volunteer
router.post('/:id/join', requireAuth, (req, res) => {
  const teamId = req.params.id;
  const team = db.prepare('SELECT * FROM volunteer_teams WHERE id = ?').get(teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found.' });
  }

  db.prepare('UPDATE users SET assigned_team_id = ? WHERE id = ?').run(teamId, req.user.id);
  res.json({ success: true, message: `You have joined the ${team.name} volunteer team!` });
});

module.exports = router;
