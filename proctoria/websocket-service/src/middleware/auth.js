const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class AuthMiddleware {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'proctoria_websocket_secret_2024';
  }

  /**
   * Socket authentication middleware
   */
  authenticate() {
    return (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, this.JWT_SECRET);
        
        // Set user information on socket
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        socket.sessionId = decoded.sessionId;
        socket.isAuthenticated = true;
        
        // Additional role-based properties
        if (decoded.role === 'admin') {
          socket.isAdmin = true;
          socket.permissions = decoded.permissions || [];
        } else {
          socket.isStudent = true;
          socket.currentSession = decoded.sessionId;
        }

        logger.info(`Socket authenticated: ${socket.userId} (${socket.userRole})`);
        next();
        
      } catch (error) {
        logger.error('Socket authentication failed:', error);
        next(new Error('Invalid authentication token'));
      }
    };
  }

  /**
   * Verify API token for internal service calls
   */
  verifyApiToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET);
      return decoded.service === 'proctoring_api';
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate JWT token for testing
   */
  generateToken(payload, expiresIn = '24h') {
    return jwt.sign(payload, this.JWT_SECRET, { expiresIn });
  }

  /**
   * Check if socket has specific permission
   */
  hasPermission(socket, permission) {
    if (!socket.isAuthenticated) return false;
    
    if (socket.isAdmin) {
      return socket.permissions.includes('super_admin') || socket.permissions.includes(permission);
    }
    
    // Students have limited permissions
    const studentPermissions = ['join_session', 'send_help_request', 'upload_screenshot'];
    return studentPermissions.includes(permission);
  }

  /**
   * Require authentication middleware
   */
  requireAuth() {
    return (socket, next) => {
      if (!socket.isAuthenticated) {
        return next(new Error('Authentication required'));
      }
      next();
    };
  }

  /**
   * Require admin role middleware
   */
  requireAdmin() {
    return (socket, next) => {
      if (!socket.isAuthenticated || !socket.isAdmin) {
        return next(new Error('Admin access required'));
      }
      next();
    };
  }

  /**
   * Require specific permission middleware
   */
  requirePermission(permission) {
    return (socket, next) => {
      if (!this.hasPermission(socket, permission)) {
        return next(new Error(`Permission required: ${permission}`));
      }
      next();
    };
  }

  /**
   * Rate limiting middleware
   */
  rateLimit(maxEvents = 100, windowMs = 60000) {
    const clients = new Map();
    
    return (socket, next) => {
      const clientId = socket.userId || socket.id;
      const now = Date.now();
      
      if (!clients.has(clientId)) {
        clients.set(clientId, { count: 1, resetTime: now + windowMs });
        return next();
      }
      
      const client = clients.get(clientId);
      
      if (now > client.resetTime) {
        client.count = 1;
        client.resetTime = now + windowMs;
        return next();
      }
      
      if (client.count >= maxEvents) {
        return next(new Error('Rate limit exceeded'));
      }
      
      client.count++;
      next();
    };
  }

  /**
   * Session validation middleware
   */
  validateSession() {
    return (socket, next) => {
      if (socket.isStudent && !socket.currentSession) {
        return next(new Error('Valid session required'));
      }
      next();
    };
  }

  /**
   * CORS validation for socket connections
   */
  validateOrigin(allowedOrigins) {
    return (socket, next) => {
      const origin = socket.handshake.headers.origin;
      
      if (!origin) {
        return next(new Error('Origin header required'));
      }
      
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return next();
      }
      
      return next(new Error('Origin not allowed'));
    };
  }
}

module.exports = new AuthMiddleware();