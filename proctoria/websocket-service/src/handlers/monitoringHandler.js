const logger = require('../utils/logger');
const sessionManager = require('../services/sessionManager');

class MonitoringHandler {
  constructor(io) {
    this.io = io;
    this.monitoringData = new Map();
  }

  /**
   * Initialize monitoring handlers
   */
  init() {
    logger.info('Monitoring handler initialized');
  }

  /**
   * Handle client connection for monitoring
   */
  handleConnection(socket) {
    logger.info(`Monitoring client connected: ${socket.id}`);

    // Handle monitoring events
    socket.on('monitor:start', (data) => this.startMonitoring(socket, data));
    socket.on('monitor:stop', (data) => this.stopMonitoring(socket, data));
    socket.on('monitor:status', (data) => this.getMonitoringStatus(socket, data));
    socket.on('monitor:metrics', (data) => this.getMetrics(socket, data));
    socket.on('monitor:alert', (data) => this.handleAlert(socket, data));

    // Handle disconnection
    socket.on('disconnect', () => this.handleDisconnection(socket));
  }

  /**
   * Start monitoring for a session
   */
  async startMonitoring(socket, data) {
    try {
      const { sessionId, examId, userId } = data;

      if (!sessionId || !examId || !userId) {
        socket.emit('monitor:error', { 
          error: 'Missing required fields: sessionId, examId, userId' 
        });
        return;
      }

      // Create monitoring session
      const monitoringSession = {
        sessionId,
        examId,
        userId,
        socketId: socket.id,
        startTime: new Date(),
        isActive: true,
        metrics: {
          violations: 0,
          warnings: 0,
          alerts: 0,
          lastActivity: new Date()
        }
      };

      this.monitoringData.set(sessionId, monitoringSession);

      // Join monitoring room
      const roomId = `monitoring:${examId}`;
      socket.join(roomId);

      // Update session manager
      await sessionManager.updateSession(sessionId, {
        isMonitored: true,
        monitoringStarted: new Date()
      });

      socket.emit('monitor:started', {
        sessionId,
        message: 'Monitoring started successfully'
      });

      // Notify other monitors
      socket.to(roomId).emit('monitor:session_started', {
        sessionId,
        userId,
        startTime: monitoringSession.startTime
      });

      logger.info(`Monitoring started for session: ${sessionId}`);
    } catch (error) {
      logger.error('Error starting monitoring:', error);
      socket.emit('monitor:error', { 
        error: 'Failed to start monitoring' 
      });
    }
  }

  /**
   * Stop monitoring for a session
   */
  async stopMonitoring(socket, data) {
    try {
      const { sessionId } = data;

      if (!sessionId) {
        socket.emit('monitor:error', { 
          error: 'Missing sessionId' 
        });
        return;
      }

      const monitoringSession = this.monitoringData.get(sessionId);
      if (!monitoringSession) {
        socket.emit('monitor:error', { 
          error: 'Monitoring session not found' 
        });
        return;
      }

      // Update monitoring session
      monitoringSession.isActive = false;
      monitoringSession.endTime = new Date();
      monitoringSession.duration = monitoringSession.endTime - monitoringSession.startTime;

      // Leave monitoring room
      const roomId = `monitoring:${monitoringSession.examId}`;
      socket.leave(roomId);

      // Update session manager
      await sessionManager.updateSession(sessionId, {
        isMonitored: false,
        monitoringStopped: new Date(),
        monitoringDuration: monitoringSession.duration
      });

      socket.emit('monitor:stopped', {
        sessionId,
        duration: monitoringSession.duration,
        metrics: monitoringSession.metrics
      });

      // Notify other monitors
      socket.to(roomId).emit('monitor:session_stopped', {
        sessionId,
        endTime: monitoringSession.endTime,
        metrics: monitoringSession.metrics
      });

      logger.info(`Monitoring stopped for session: ${sessionId}`);
    } catch (error) {
      logger.error('Error stopping monitoring:', error);
      socket.emit('monitor:error', { 
        error: 'Failed to stop monitoring' 
      });
    }
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(socket, data) {
    try {
      const { sessionId } = data;

      if (!sessionId) {
        socket.emit('monitor:error', { 
          error: 'Missing sessionId' 
        });
        return;
      }

      const monitoringSession = this.monitoringData.get(sessionId);
      if (!monitoringSession) {
        socket.emit('monitor:status', { 
          sessionId,
          isActive: false,
          message: 'Session not being monitored'
        });
        return;
      }

      socket.emit('monitor:status', {
        sessionId,
        isActive: monitoringSession.isActive,
        startTime: monitoringSession.startTime,
        duration: new Date() - monitoringSession.startTime,
        metrics: monitoringSession.metrics
      });
    } catch (error) {
      logger.error('Error getting monitoring status:', error);
      socket.emit('monitor:error', { 
        error: 'Failed to get monitoring status' 
      });
    }
  }

  /**
   * Get monitoring metrics
   */
  getMetrics(socket, data) {
    try {
      const { examId, sessionId } = data;

      if (sessionId) {
        // Get metrics for specific session
        const monitoringSession = this.monitoringData.get(sessionId);
        if (monitoringSession) {
          socket.emit('monitor:metrics', {
            sessionId,
            metrics: monitoringSession.metrics
          });
        } else {
          socket.emit('monitor:error', { 
            error: 'Session not found' 
          });
        }
      } else if (examId) {
        // Get aggregated metrics for exam
        const examSessions = Array.from(this.monitoringData.values())
          .filter(session => session.examId === examId);

        const aggregatedMetrics = {
          totalSessions: examSessions.length,
          activeSessions: examSessions.filter(s => s.isActive).length,
          totalViolations: examSessions.reduce((sum, s) => sum + s.metrics.violations, 0),
          totalWarnings: examSessions.reduce((sum, s) => sum + s.metrics.warnings, 0),
          totalAlerts: examSessions.reduce((sum, s) => sum + s.metrics.alerts, 0)
        };

        socket.emit('monitor:metrics', {
          examId,
          metrics: aggregatedMetrics,
          sessions: examSessions.map(s => ({
            sessionId: s.sessionId,
            userId: s.userId,
            isActive: s.isActive,
            metrics: s.metrics
          }))
        });
      } else {
        socket.emit('monitor:error', { 
          error: 'Missing examId or sessionId' 
        });
      }
    } catch (error) {
      logger.error('Error getting metrics:', error);
      socket.emit('monitor:error', { 
        error: 'Failed to get metrics' 
      });
    }
  }

  /**
   * Handle monitoring alert
   */
  handleAlert(socket, data) {
    try {
      const { sessionId, alertType, severity, message } = data;

      if (!sessionId || !alertType || !severity) {
        socket.emit('monitor:error', { 
          error: 'Missing required fields: sessionId, alertType, severity' 
        });
        return;
      }

      const monitoringSession = this.monitoringData.get(sessionId);
      if (!monitoringSession) {
        socket.emit('monitor:error', { 
          error: 'Monitoring session not found' 
        });
        return;
      }

      // Update metrics based on severity
      switch (severity) {
        case 'critical':
          monitoringSession.metrics.alerts++;
          break;
        case 'warning':
          monitoringSession.metrics.warnings++;
          break;
        case 'info':
          monitoringSession.metrics.violations++;
          break;
      }

      monitoringSession.metrics.lastActivity = new Date();

      // Create alert object
      const alert = {
        sessionId,
        alertType,
        severity,
        message,
        timestamp: new Date(),
        userId: monitoringSession.userId,
        examId: monitoringSession.examId
      };

      // Broadcast alert to monitoring room
      const roomId = `monitoring:${monitoringSession.examId}`;
      this.io.to(roomId).emit('monitor:alert', alert);

      // If critical, also broadcast to admin room
      if (severity === 'critical') {
        this.io.to('admin').emit('monitor:critical_alert', alert);
      }

      logger.warn(`Monitoring alert: ${alertType} (${severity}) for session ${sessionId}`);
    } catch (error) {
      logger.error('Error handling alert:', error);
      socket.emit('monitor:error', { 
        error: 'Failed to handle alert' 
      });
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(socket) {
    try {
      // Find and cleanup monitoring sessions for this socket
      for (const [sessionId, monitoringSession] of this.monitoringData) {
        if (monitoringSession.socketId === socket.id && monitoringSession.isActive) {
          monitoringSession.isActive = false;
          monitoringSession.endTime = new Date();
          
          logger.info(`Monitoring session ${sessionId} ended due to disconnection`);
        }
      }

      logger.info(`Monitoring client disconnected: ${socket.id}`);
    } catch (error) {
      logger.error('Error handling monitoring disconnection:', error);
    }
  }

  /**
   * Get all active monitoring sessions
   */
  getActiveSessions() {
    return Array.from(this.monitoringData.values())
      .filter(session => session.isActive);
  }

  /**
   * Cleanup expired monitoring sessions
   */
  cleanupExpired() {
    try {
      const now = new Date();
      const expiredSessions = [];

      for (const [sessionId, session] of this.monitoringData) {
        if (session.isActive) {
          const timeSinceActivity = now - session.metrics.lastActivity;
          // Sessions expire after 30 minutes of inactivity
          if (timeSinceActivity > 30 * 60 * 1000) {
            session.isActive = false;
            session.endTime = now;
            expiredSessions.push(sessionId);
          }
        }
      }

      if (expiredSessions.length > 0) {
        logger.info(`Cleaned up ${expiredSessions.length} expired monitoring sessions`);
      }

      return expiredSessions;
    } catch (error) {
      logger.error('Error cleaning up expired monitoring sessions:', error);
      return [];
    }
  }
}

module.exports = MonitoringHandler;