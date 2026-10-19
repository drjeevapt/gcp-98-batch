const crypto = require('crypto');
const db = require('../db');

// Simple JWT-like token generator using HMAC-SHA256
const SECRET = process.env.SESSION_SECRET || 'gcp98-reunion-secret-key-2026';

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

// Authentication Middleware
function authenticate(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  // Also support convenient direct user header for testing/switching in pair programming
  const directUserId = req.headers['x-user-id'];

  if (token) {
    const payload = verifyToken(token);
    if (payload && payload.userId) {
      const user = db.prepare('SELECT id, name, email, phone, whatsapp, role, assigned_team_id, city, profession, avatar, status FROM users WHERE id = ?').get(payload.userId);
      if (user && user.status === 'active') {
        req.user = user;
        return next();
      }
    }
  }

  if (directUserId) {
    const user = db.prepare('SELECT id, name, email, phone, whatsapp, role, assigned_team_id, city, profession, avatar, status FROM users WHERE id = ?').get(directUserId);
    if (user && user.status === 'active') {
      req.user = user;
      return next();
    }
  }

  req.user = null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in or use your invite token.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
  }
  next();
}

function requireCoordinator(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const isCoord = req.user.role === 'admin' || req.user.role === 'coordinator' || req.user.role === 'accounts_volunteer';
  if (!isCoord) {
    return res.status(403).json({ error: 'Access denied: Volunteer Coordinator or Admin role required.' });
  }
  next();
}

// STRICT REQUIREMENT:
// "Do not mark payments as verified until an authorised Accounts volunteer confirms them."
function requireAccountsVolunteer(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const isAuthorizedAccounts =
    req.user.role === 'admin' ||
    req.user.role === 'accounts_volunteer' ||
    (req.user.assigned_team_id === 'finance' && req.user.role === 'coordinator');

  if (!isAuthorizedAccounts) {
    return res.status(403).json({
      error: 'Permission Denied: Only an authorised Accounts volunteer or Admin can verify or modify financial payments.'
    });
  }
  next();
}

module.exports = {
  signToken,
  verifyToken,
  authenticate,
  requireAuth,
  requireAdmin,
  requireCoordinator,
  requireAccountsVolunteer
};
