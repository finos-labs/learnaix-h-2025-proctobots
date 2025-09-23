const logger = require('../utils/logger');
const redisClient = require('../utils/redis');

class SessionManager {
  constructor() {
    this.sessions = new Map(); // In-memory fallback
    this.roomSessions = new Map(); // Track rooms and their sessions
  }

  /**
   * Create a new session
   */
  async createSession(sessionId, sessionData) {
    try {
      const session = {
        id: sessionId,
        ...sessionData,
        createdAt: new Date(),
        lastActivity: new Date(),
        isActive: true
      };

      // Store in Redis if available
      if (redisClient.isConnected()) {
        await redisClient.setex(`session:${sessionId}`, 3600, JSON.stringify(session));
      }

      // Store in memory as fallback
      this.sessions.set(sessionId, session);
      
      logger.info(`Session created: ${sessionId}`);
      return session;
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    try {
      // Try Redis first
      if (redisClient.isConnected()) {
        const sessionData = await redisClient.get(`session:${sessionId}`);
        if (sessionData) {
          return JSON.parse(sessionData);
        }
      }

      // Fallback to memory
      return this.sessions.get(sessionId) || null;
    } catch (error) {
      logger.error('Error getting session:', error);
      return this.sessions.get(sessionId) || null;
    }
  }

  /**
   * Update session
   */
  async updateSession(sessionId, updateData) {
    try {
      const existingSession = await this.getSession(sessionId);
      if (!existingSession) {
        throw new Error('Session not found');
      }

      const updatedSession = {
        ...existingSession,
        ...updateData,
        lastActivity: new Date()
      };

      // Update in Redis
      if (redisClient.isConnected()) {
        await redisClient.setex(`session:${sessionId}`, 3600, JSON.stringify(updatedSession));
      }

      // Update in memory
      this.sessions.set(sessionId, updatedSession);

      logger.info(`Session updated: ${sessionId}`);
      return updatedSession;
    } catch (error) {
      logger.error('Error updating session:', error);
      throw error;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId) {
    try {
      // Remove from Redis
      if (redisClient.isConnected()) {
        await redisClient.del(`session:${sessionId}`);
      }

      // Remove from memory
      this.sessions.delete(sessionId);

      logger.info(`Session deleted: ${sessionId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting session:', error);
      return false;
    }
  }

  /**
   * Join a room
   */
  async joinRoom(sessionId, roomId) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Update session with room info
      await this.updateSession(sessionId, { 
        roomId: roomId,
        joinedRoomAt: new Date()
      });

      // Track room sessions
      if (!this.roomSessions.has(roomId)) {
        this.roomSessions.set(roomId, new Set());
      }
      this.roomSessions.get(roomId).add(sessionId);

      logger.info(`Session ${sessionId} joined room ${roomId}`);
      return true;
    } catch (error) {
      logger.error('Error joining room:', error);
      throw error;
    }
  }

  /**
   * Leave a room
   */
  async leaveRoom(sessionId, roomId) {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        await this.updateSession(sessionId, { 
          roomId: null,
          leftRoomAt: new Date()
        });
      }

      // Remove from room tracking
      if (this.roomSessions.has(roomId)) {
        this.roomSessions.get(roomId).delete(sessionId);
        if (this.roomSessions.get(roomId).size === 0) {
          this.roomSessions.delete(roomId);
        }
      }

      logger.info(`Session ${sessionId} left room ${roomId}`);
      return true;
    } catch (error) {
      logger.error('Error leaving room:', error);
      return false;
    }
  }

  /**
   * Get all sessions in a room
   */
  getRoomSessions(roomId) {
    return Array.from(this.roomSessions.get(roomId) || []);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const now = new Date();
      const expiredSessions = [];

      for (const [sessionId, session] of this.sessions) {
        const lastActivity = new Date(session.lastActivity);
        const timeDiff = now - lastActivity;
        
        // Sessions expire after 2 hours of inactivity
        if (timeDiff > 2 * 60 * 60 * 1000) {
          expiredSessions.push(sessionId);
        }
      }

      // Remove expired sessions
      for (const sessionId of expiredSessions) {
        await this.deleteSession(sessionId);
      }

      if (expiredSessions.length > 0) {
        logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
      }

      return expiredSessions.length;
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeSessions: this.getActiveSessions().length,
      totalRooms: this.roomSessions.size,
      averageSessionsPerRoom: this.roomSessions.size > 0 
        ? Array.from(this.roomSessions.values()).reduce((sum, sessions) => sum + sessions.size, 0) / this.roomSessions.size 
        : 0
    };
  }

  /**
   * Register socket connection (placeholder)
   */
  registerConnection(socket) {
    logger.info(`Connection registered for socket: ${socket.id}`);
  }

  /**
   * Unregister socket connection (placeholder)
   */
  unregisterConnection(socket) {
    logger.info(`Connection unregistered for socket: ${socket.id}`);
  }

  /**
   * Validate session (placeholder)
   */
  async validateSession(sessionId, userId) {
    const session = await this.getSession(sessionId);
    return session && session.userId === userId;
  }

  /**
   * Map user to session (placeholder)
   */
  mapUserToSession(userId, sessionId) {
    logger.info(`User ${userId} mapped to session ${sessionId}`);
  }

  /**
   * Update session status (placeholder)
   */
  updateSessionStatus(sessionId, status) {
    logger.info(`Session ${sessionId} status updated:`, status);
  }

  /**
   * End session (placeholder)
   */
  endSession(sessionId) {
    logger.info(`Session ${sessionId} ended`);
  }

  /**
   * Get system statistics (placeholder)
   */
  getSystemStatistics() {
    return this.getStats();
  }

  /**
   * Cleanup inactive sessions (placeholder)
   */
  cleanupInactiveSessions() {
    return this.cleanupExpiredSessions();
  }
}

// Export singleton instance
module.exports = new SessionManager();