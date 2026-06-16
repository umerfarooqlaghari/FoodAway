const jwt = require('jsonwebtoken');
const rbacPolicy = require('./rbac-policy.json');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_in_production';

// Verify JWT Token Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, role, ... }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// RBAC Middleware Guard
const requireRole = (resource, action) => {
  return (req, res, next) => {
    // req.user is populated by verifyToken
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    const userRole = req.user.role;
    const permissions = rbacPolicy.roles[userRole];

    if (!permissions) {
      return res.status(403).json({ error: 'Role not recognized.' });
    }

    const resourcePermissions = permissions[resource];

    if (!resourcePermissions || !resourcePermissions.includes(action)) {
      return res.status(403).json({ error: `Forbidden: You do not have permission to ${action} ${resource}.` });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  requireRole,
  JWT_SECRET
};
