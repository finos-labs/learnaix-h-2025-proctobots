const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authenticateToken = (req, res, next) => {
  // For demo purposes, skip authentication
  // In production, implement proper JWT validation
  req.user = {
    id: 1,
    role: 'admin',
    username: 'demo_user'
  };
  next();
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole
};