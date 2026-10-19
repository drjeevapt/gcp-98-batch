const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

// GET /api/tasks?eventId=...&teamId=...&status=...&assignedToMe=true
router.get('/', (req, res) => {
  const eventId = req.query.eventId || 'evt_2026';
  const teamId = req.query.teamId;
  const status = req.query.status;
  const priority = req.query.priority;
  const assignedToMe = req.query.assignedToMe === 'true' && req.user ? req.user.id : null;

  let sql = `
    SELECT t.*, 
      u_assign.name as assignee_name, u_assign.email as assignee_email, u_assign.avatar as assignee_avatar,
      u_creator.name as creator_name,
      vt.name as team_name, vt.icon as team_icon
    FROM tasks t
    LEFT JOIN users u_assign ON u_assign.id = t.assigned_to
    LEFT JOIN users u_creator ON u_creator.id = t.created_by
    JOIN volunteer_teams vt ON vt.id = t.team_id
    WHERE t.event_id = ?
  `;
  const params = [eventId];

  if (teamId) {
    sql += ' AND t.team_id = ?';
    params.push(teamId);
  }
  if (status) {
    sql += ' AND t.status = ?';
    params.push(status);
  }
  if (priority) {
    sql += ' AND t.priority = ?';
    params.push(priority);
  }
  if (assignedToMe) {
    sql += ' AND t.assigned_to = ?';
    params.push(assignedToMe);
  }

  sql += `
    ORDER BY 
      CASE t.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      t.due_date ASC
  `;

  const tasks = db.prepare(sql).all(...params);
  res.json({ success: true, tasks });
});

// POST /api/tasks - Create task (Coordinators or Admin)
router.post('/', requireAuth, requireCoordinator, (req, res) => {
  const { eventId, teamId, title, description, assignedTo, dueDate, priority } = req.body;

  if (!teamId || !title) {
    return res.status(400).json({ error: 'Team and Title are required.' });
  }

  const newId = `tsk_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO tasks (id, event_id, team_id, title, description, assigned_to, due_date, priority, status, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?)
  `).run(
    newId,
    eventId || 'evt_2026',
    teamId,
    title,
    description || '',
    assignedTo || null,
    dueDate || '',
    priority || 'medium',
    req.user.id,
    now
  );

  const created = db.prepare(`
    SELECT t.*, u.name as assignee_name, vt.name as team_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assigned_to
    JOIN volunteer_teams vt ON vt.id = t.team_id
    WHERE t.id = ?
  `).get(newId);

  res.json({ success: true, message: 'Task created successfully.', task: created });
});

// PUT /api/tasks/:id - Update task status / details
router.put('/:id', requireAuth, (req, res) => {
  const { status, title, description, assignedTo, dueDate, priority } = req.body;
  const taskId = req.params.id;

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  // Permission check: admin, coordinator, creator, or assigned user
  const canEdit =
    req.user.role === 'admin' ||
    req.user.role === 'coordinator' ||
    req.user.role === 'accounts_volunteer' ||
    existing.assigned_to === req.user.id ||
    existing.created_by === req.user.id;

  if (!canEdit) {
    return res.status(403).json({ error: 'Access denied: You cannot edit this task.' });
  }

  const completedAt = status === 'completed' && existing.status !== 'completed' ? new Date().toISOString() : existing.completed_at;

  db.prepare(`
    UPDATE tasks
    SET status = COALESCE(?, status),
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        assigned_to = COALESCE(?, assigned_to),
        due_date = COALESCE(?, due_date),
        priority = COALESCE(?, priority),
        completed_at = ?
    WHERE id = ?
  `).run(
    status,
    title,
    description,
    assignedTo,
    dueDate,
    priority,
    completedAt,
    taskId
  );

  const updated = db.prepare(`
    SELECT t.*, u.name as assignee_name, vt.name as team_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assigned_to
    JOIN volunteer_teams vt ON vt.id = t.team_id
    WHERE t.id = ?
  `).get(taskId);

  res.json({ success: true, message: 'Task updated.', task: updated });
});

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, requireCoordinator, (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Task removed.' });
});

module.exports = router;
