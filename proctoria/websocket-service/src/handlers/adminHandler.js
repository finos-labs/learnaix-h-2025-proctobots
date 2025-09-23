const logger = require('../utils/logger');
const axios = require('axios');

class AdminHandler {
  constructor() {
    this.adminSessions = new Map(); // Track admin sessions
  }

  /**
   * Handle admin connection
   */
  handleConnection(socket) {
    socket.on('admin_authenticate', (data) => this.handleAuthentication(socket, data));
    socket.on('monitor_session', (data) => this.handleMonitorSession(socket, data));
    socket.on('send_intervention', (data) => this.handleSendIntervention(socket, data));
    socket.on('terminate_session', (data) => this.handleTerminateSession(socket, data));
    socket.on('request_screenshot', (data) => this.handleRequestScreenshot(socket, data));
    socket.on('bulk_action', (data) => this.handleBulkAction(socket, data));
    socket.on('subscribe_dashboard', (data) => this.handleSubscribeDashboard(socket, data));
    socket.on('get_session_details', (data) => this.handleGetSessionDetails(socket, data));
    socket.on('update_proctoring_settings', (data) => this.handleUpdateSettings(socket, data));
    socket.on('disconnect', () => this.handleDisconnection(socket));
  }

  /**
   * Authenticate admin user
   */
  async handleAuthentication(socket, data) {
    try {
      const { token, adminId, permissions } = data;

      // Verify admin token with backend
      const isValid = await this.verifyAdminToken(token, adminId);
      
      if (!isValid) {
        socket.emit('auth_error', { message: 'Invalid admin credentials' });
        return;
      }

      // Set admin properties
      socket.adminId = adminId;
      socket.isAdmin = true;
      socket.permissions = permissions || [];
      socket.connectedAt = Date.now();

      // Join admin monitoring room
      socket.join('admin_monitoring');

      // Store admin session
      this.adminSessions.set(socket.id, {
        adminId,
        permissions,
        connectedAt: socket.connectedAt,
        lastActivity: Date.now()
      });

      // Send authentication success
      socket.emit('auth_success', {
        message: 'Admin authenticated successfully',
        permissions: socket.permissions,
        connectedAt: socket.connectedAt
      });

      // Send current active sessions
      await this.sendActiveSessions(socket);

      // Send dashboard data
      await this.sendDashboardData(socket);

      logger.info(`Admin ${adminId} authenticated and connected`);

    } catch (error) {
      logger.error('Admin authentication error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  }

  /**
   * Handle monitoring specific session
   */
  async handleMonitorSession(socket, data) {
    try {
      if (!this.hasPermission(socket, 'monitor_sessions')) {
        socket.emit('error', { message: 'Insufficient permissions' });
        return;
      }

      const { sessionId } = data;

      // Validate session exists
      const sessionExists = await this.validateSession(sessionId);
      if (!sessionExists) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // Join session monitoring room
      socket.join(`monitor_${sessionId}`);

      // Get session details
      const sessionDetails = await this.getSessionDetails(sessionId);

      // Send session data
      socket.emit('session_monitoring_started', {
        sessionId,
        sessionDetails,
        timestamp: Date.now()
      });

      logger.info(`Admin ${socket.adminId} started monitoring session ${sessionId}`);

    } catch (error) {
      logger.error('Error monitoring session:', error);
      socket.emit('error', { message: 'Failed to start monitoring session' });
    }
  }

  /**
   * Send intervention message to student
   */
  async handleSendIntervention(socket, data) {
    try {
      if (!this.hasPermission(socket, 'send_interventions')) {
        socket.emit('error', { message: 'Insufficient permissions' });
        return;
      }

      const { sessionId, message, type, userId } = data;

      const intervention = {
        id: `int_${Date.now()}_${Math.random()}`,
        sessionId,
        adminId: socket.adminId,
        message,
        type: type || 'warning', // warning, notification, critical
        timestamp: Date.now(),
        userId
      };

      // Send to student
      const io = require('../index').io;
      io.to(`session_${sessionId}`).emit('admin_intervention', intervention);

      // Log intervention
      await this.logIntervention(intervention);

      // Confirm to admin
      socket.emit('intervention_sent', {
        interventionId: intervention.id,
        sessionId,
        timestamp: intervention.timestamp
      });

      logger.info(`Admin ${socket.adminId} sent intervention to session ${sessionId}: ${message}`);

    } catch (error) {
      logger.error('Error sending intervention:', error);
      socket.emit('error', { message: 'Failed to send intervention' });
    }
  }

  /**
   * Terminate a proctoring session
   */
  async handleTerminateSession(socket, data) {
    try {
      if (!this.hasPermission(socket, 'terminate_sessions')) {
        socket.emit('error', { message: 'Insufficient permissions' });
        return;
      }

      const { sessionId, reason, userId } = data;

      // Terminate session in backend
      await this.terminateSessionInBackend(sessionId, reason, socket.adminId);

      // Notify student
      const io = require('../index').io;
      io.to(`session_${sessionId}`).emit('session_terminated', {
        reason,
        terminatedBy: socket.adminId,
        timestamp: Date.now(),
        message: 'Your proctoring session has been terminated by an administrator.'
      });

      // Notify other admins
      socket.to('admin_monitoring').emit('session_terminated_by_admin', {
        sessionId,
        terminatedBy: socket.adminId,
        reason,
        userId,
        timestamp: Date.now()
      });

      // Confirm to admin
      socket.emit('session_terminated_success', {
        sessionId,
        timestamp: Date.now()
      });

      logger.warn(`Admin ${socket.adminId} terminated session ${sessionId}: ${reason}`);

    } catch (error) {
      logger.error('Error terminating session:', error);
      socket.emit('error', { message: 'Failed to terminate session' });
    }
  }

  /**
   * Request screenshot from student
   */
  async handleRequestScreenshot(socket, data) {
    try {
      if (!this.hasPermission(socket, 'request_screenshots')) {
        socket.emit('error', { message: 'Insufficient permissions' });
        return;
      }

      const { sessionId, userId } = data;

      const screenshotRequest = {
        requestId: `scr_${Date.now()}_${Math.random()}`,
        sessionId,
        adminId: socket.adminId,
        timestamp: Date.now()
      };

      // Send request to student
      const io = require('../index').io;
      io.to(`session_${sessionId}`).emit('screenshot_requested', screenshotRequest);

      // Store pending request
      setTimeout(() => {
        socket.emit('screenshot_timeout', {
          requestId: screenshotRequest.requestId,
          sessionId
        });
      }, 30000); // 30 second timeout

      socket.emit('screenshot_request_sent', {
        requestId: screenshotRequest.requestId,
        sessionId,
        timestamp: screenshotRequest.timestamp
      });

      logger.info(`Admin ${socket.adminId} requested screenshot from session ${sessionId}`);

    } catch (error) {
      logger.error('Error requesting screenshot:', error);
      socket.emit('error', { message: 'Failed to request screenshot' });
    }
  }

  /**
   * Handle bulk actions on multiple sessions
   */
  async handleBulkAction(socket, data) {
    try {
      if (!this.hasPermission(socket, 'bulk_actions')) {
        socket.emit('error', { message: 'Insufficient permissions' });
        return;
      }

      const { sessionIds, action, parameters } = data;

      const results = [];
      
      for (const sessionId of sessionIds) {
        try {
          let result;
          
          switch (action) {
            case 'send_message':
              result = await this.sendBulkMessage(sessionId, parameters.message, socket.adminId);
              break;
            case 'terminate':
              result = await this.terminateSessionInBackend(sessionId, parameters.reason, socket.adminId);
              break;
            case 'flag':
              result = await this.flagSessionForReview(sessionId, parameters.reason, socket.adminId);
              break;
            default:
              throw new Error(`Unknown bulk action: ${action}`);
          }
          
          results.push({ sessionId, status: 'success', result });
          
        } catch (error) {
          results.push({ sessionId, status: 'error', error: error.message });
        }
      }

      socket.emit('bulk_action_completed', {
        action,
        results,
        timestamp: Date.now()
      });

      logger.info(`Admin ${socket.adminId} performed bulk action ${action} on ${sessionIds.length} sessions`);

    } catch (error) {
      logger.error('Error performing bulk action:', error);
      socket.emit('error', { message: 'Failed to perform bulk action' });
    }
  }

  /**
   * Subscribe to dashboard updates
   */
  async handleSubscribeDashboard(socket, data) {
    try {
      const { updateInterval = 10000 } = data; // Default 10 seconds

      // Join dashboard room
      socket.join('dashboard_updates');

      // Send initial dashboard data
      await this.sendDashboardData(socket);

      // Set up periodic updates
      socket.dashboardInterval = setInterval(async () => {
        try {
          await this.sendDashboardData(socket);
        } catch (error) {
          logger.error('Error sending dashboard update:', error);
        }
      }, updateInterval);

      socket.emit('dashboard_subscription_confirmed', {
        updateInterval,
        timestamp: Date.now()
      });

      logger.debug(`Admin ${socket.adminId} subscribed to dashboard updates`);

    } catch (error) {
      logger.error('Error subscribing to dashboard:', error);
      socket.emit('error', { message: 'Failed to subscribe to dashboard' });
    }
  }

  /**
   * Get detailed session information
   */
  async handleGetSessionDetails(socket, data) {
    try {
      const { sessionId } = data;

      const sessionDetails = await this.getSessionDetails(sessionId);
      
      socket.emit('session_details', {
        sessionId,
        details: sessionDetails,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error getting session details:', error);
      socket.emit('error', { message: 'Failed to get session details' });
    }
  }

  /**
   * Update proctoring settings
   */
  async handleUpdateSettings(socket, data) {
    try {
      if (!this.hasPermission(socket, 'manage_settings')) {
        socket.emit('error', { message: 'Insufficient permissions' });
        return;
      }

      const { settings, quizId } = data;

      // Update settings in backend
      await this.updateProctoringSettings(quizId, settings, socket.adminId);

      // Notify other admins
      socket.to('admin_monitoring').emit('settings_updated', {
        quizId,
        updatedBy: socket.adminId,
        timestamp: Date.now()
      });

      socket.emit('settings_updated_success', {
        quizId,
        timestamp: Date.now()
      });

      logger.info(`Admin ${socket.adminId} updated proctoring settings for quiz ${quizId}`);

    } catch (error) {
      logger.error('Error updating settings:', error);
      socket.emit('error', { message: 'Failed to update settings' });
    }
  }

  /**
   * Handle admin disconnection
   */
  handleDisconnection(socket) {
    // Clean up dashboard interval
    if (socket.dashboardInterval) {
      clearInterval(socket.dashboardInterval);
    }

    // Remove from admin sessions
    this.adminSessions.delete(socket.id);

    logger.info(`Admin ${socket.adminId} disconnected`);
  }

  /**
   * Verify admin token with backend
   */
  async verifyAdminToken(token, adminId) {
    try {
      const apiUrl = process.env.PROCTORING_API_URL || 'http://localhost:8000';
      
      const response = await axios.post(`${apiUrl}/api/v1/auth/verify-admin`, {
        token,
        admin_id: adminId
      }, {
        timeout: 5000
      });

      return response.data.valid === true;
      
    } catch (error) {
      logger.error('Admin token verification failed:', error.message);
      return false;
    }
  }

  /**
   * Check if admin has specific permission
   */
  hasPermission(socket, permission) {
    if (!socket.isAdmin) return false;
    
    // Super admin has all permissions
    if (socket.permissions.includes('super_admin')) return true;
    
    return socket.permissions.includes(permission);
  }

  /**
   * Validate session exists
   */
  async validateSession(sessionId) {
    try {
      const apiUrl = process.env.PROCTORING_API_URL || 'http://localhost:8000';
      
      const response = await axios.get(`${apiUrl}/api/v1/sessions/${sessionId}`, {
        timeout: 5000
      });

      return response.status === 200;
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Get session details from backend
   */
  async getSessionDetails(sessionId) {
    try {
      const apiUrl = process.env.PROCTORING_API_URL || 'http://localhost:8000';
      
      const response = await axios.get(`${apiUrl}/api/v1/sessions/${sessionId}/details`, {
        headers: {
          'Authorization': `Bearer ${process.env.API_TOKEN}`
        },
        timeout: 5000
      });

      return response.data;
      
    } catch (error) {
      logger.error('Failed to get session details:', error.message);
      throw new Error('Session details unavailable');
    }
  }

  /**
   * Send active sessions to admin
   */
  async sendActiveSessions(socket) {
    try {
      const apiUrl = process.env.PROCTORING_API_URL || 'http://localhost:8000';
      
      const response = await axios.get(`${apiUrl}/api/v1/sessions/active`, {
        headers: {
          'Authorization': `Bearer ${process.env.API_TOKEN}`
        },
        timeout: 5000
      });

      socket.emit('active_sessions', {
        sessions: response.data.sessions,
        count: response.data.count,
        timestamp: Date.now()
      });
      
    } catch (error) {
      logger.error('Failed to get active sessions:', error.message);
      socket.emit('active_sessions', { sessions: [], count: 0, timestamp: Date.now() });
    }
  }

  /**
   * Send dashboard data to admin
   */
  async sendDashboardData(socket) {
    try {
      const apiUrl = process.env.ANALYTICS_API_URL || 'http://localhost:3001';
      
      const response = await axios.get(`${apiUrl}/api/analytics/dashboard`, {
        headers: {
          'Authorization': `Bearer ${process.env.API_TOKEN}`
        },
        timeout: 5000
      });

      socket.emit('dashboard_data', {
        data: response.data,
        timestamp: Date.now()
      });
      
    } catch (error) {
      logger.error('Failed to get dashboard data:', error.message);
      socket.emit('dashboard_data', { data: null, timestamp: Date.now() });
    }
  }

  /**
   * Log admin intervention
   */
  async logIntervention(intervention) {
    try {
      const apiUrl = process.env.PROCTORING_API_URL || 'http://localhost:8000';
      
      await axios.post(`${apiUrl}/api/v1/interventions`, intervention, {
        headers: {
          'Authorization': `Bearer ${process.env.API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
    } catch (error) {
      logger.error('Failed to log intervention:', error.message);
    }
  }

  /**
   * Terminate session in backend
   */
  async terminateSessionInBackend(sessionId, reason, adminId) {
    try {
      const apiUrl = process.env.PROCTORING_API_URL || 'http://localhost:8000';
      
      const response = await axios.post(`${apiUrl}/api/v1/sessions/${sessionId}/terminate`, {
        reason,
        terminated_by: adminId
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      return response.data;
      
    } catch (error) {
      logger.error('Failed to terminate session in backend:', error.message);
      throw new Error('Session termination failed');
    }
  }

  /**
   * Send bulk message to session
   */
  async sendBulkMessage(sessionId, message, adminId) {
    const io = require('../index').io;
    
    const messageData = {
      sessionId,
      message,
      adminId,
      timestamp: Date.now(),
      type: 'admin_message'
    };

    io.to(`session_${sessionId}`).emit('admin_message', messageData);
    
    return { messageId: `msg_${Date.now()}`, sessionId };
  }

  /**
   * Flag session for review
   */
  async flagSessionForReview(sessionId, reason, adminId) {
    try {
      const apiUrl = process.env.PROCTORING_API_URL || 'http://localhost:8000';
      
      const response = await axios.post(`${apiUrl}/api/v1/sessions/${sessionId}/flag`, {
        reason,
        flagged_by: adminId
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      return response.data;
      
    } catch (error) {
      logger.error('Failed to flag session:', error.message);
      throw new Error('Session flagging failed');
    }
  }

  /**
   * Update proctoring settings
   */
  async updateProctoringSettings(quizId, settings, adminId) {
    try {
      const apiUrl = process.env.PROCTORING_API_URL || 'http://localhost:8000';
      
      const response = await axios.put(`${apiUrl}/api/v1/settings/quiz/${quizId}`, {
        settings,
        updated_by: adminId
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      return response.data;
      
    } catch (error) {
      logger.error('Failed to update settings:', error.message);
      throw new Error('Settings update failed');
    }
  }

  /**
   * Get connected admin count
   */
  getConnectedAdminCount() {
    return this.adminSessions.size;
  }

  /**
   * Get admin session info
   */
  getAdminSessionInfo() {
    const sessions = Array.from(this.adminSessions.values());
    return {
      count: sessions.length,
      sessions: sessions.map(session => ({
        adminId: session.adminId,
        connectedAt: session.connectedAt,
        lastActivity: session.lastActivity
      }))
    };
  }
}

module.exports = new AdminHandler();