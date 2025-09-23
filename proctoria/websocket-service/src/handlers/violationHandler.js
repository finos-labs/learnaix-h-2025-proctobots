const logger = require('../utils/logger');
const axios = require('axios');

class ViolationHandler {
  constructor() {
    this.violationQueue = new Map(); // Store violations temporarily
    this.processingInterval = setInterval(() => {
      this.processViolationQueue();
    }, 5000); // Process every 5 seconds
  }

  /**
   * Handle violation detected by ML models
   */
  async handleViolationDetected(socket, data) {
    try {
      const violation = {
        sessionId: socket.currentSession,
        userId: socket.userId,
        type: data.type,
        confidence: data.confidence,
        details: data.details,
        timestamp: Date.now(),
        screenshot: data.screenshot,
        metadata: data.metadata || {}
      };

      // Validate violation data
      if (!this.validateViolation(violation)) {
        socket.emit('error', { message: 'Invalid violation data' });
        return;
      }

      // Add to processing queue
      const violationId = this.addToQueue(violation);

      // Send immediate response to student
      this.sendViolationAlert(socket, violation);

      // Notify admin monitoring room
      this.notifyAdmins(violation);

      // Store in backend API
      await this.storeViolation(violation);

      logger.info(`Violation detected: ${violation.type} for user ${violation.userId} in session ${violation.sessionId}`);

    } catch (error) {
      logger.error('Error handling violation:', error);
      socket.emit('error', { message: 'Failed to process violation' });
    }
  }

  /**
   * Handle behavior events (mouse, keyboard, browser)
   */
  async handleBehaviorEvent(socket, data) {
    try {
      const behaviorEvent = {
        sessionId: socket.currentSession,
        userId: socket.userId,
        eventType: data.eventType,
        eventData: data.eventData,
        timestamp: Date.now()
      };

      // Analyze behavior for potential violations
      const violations = await this.analyzeBehavior(behaviorEvent);

      // Process any detected violations
      for (const violation of violations) {
        await this.handleViolationDetected(socket, violation);
      }

      // Log behavior event
      logger.debug(`Behavior event: ${behaviorEvent.eventType} for user ${behaviorEvent.userId}`);

    } catch (error) {
      logger.error('Error handling behavior event:', error);
    }
  }

  /**
   * Validate violation data
   */
  validateViolation(violation) {
    const requiredFields = ['sessionId', 'userId', 'type', 'confidence', 'timestamp'];
    
    for (const field of requiredFields) {
      if (!violation[field]) {
        logger.warn(`Missing required field: ${field}`);
        return false;
      }
    }

    if (violation.confidence < 0 || violation.confidence > 1) {
      logger.warn(`Invalid confidence value: ${violation.confidence}`);
      return false;
    }

    return true;
  }

  /**
   * Add violation to processing queue
   */
  addToQueue(violation) {
    const violationId = `${violation.sessionId}_${violation.timestamp}_${Math.random()}`;
    this.violationQueue.set(violationId, violation);
    return violationId;
  }

  /**
   * Send violation alert to student
   */
  sendViolationAlert(socket, violation) {
    const alertSeverity = this.getAlertSeverity(violation.type, violation.confidence);
    
    const alert = {
      type: 'violation_alert',
      severity: alertSeverity,
      violation: {
        type: violation.type,
        message: this.getViolationMessage(violation.type),
        confidence: violation.confidence,
        timestamp: violation.timestamp
      }
    };

    socket.emit('violation_alert', alert);

    // If high severity, also send popup warning
    if (alertSeverity === 'high' || alertSeverity === 'critical') {
      socket.emit('warning_popup', {
        title: 'Proctoring Violation Detected',
        message: this.getViolationMessage(violation.type),
        type: violation.type,
        timestamp: violation.timestamp
      });
    }
  }

  /**
   * Notify admin monitoring room
   */
  notifyAdmins(violation) {
    const io = require('../index').io;
    
    const adminNotification = {
      type: 'violation_detected',
      sessionId: violation.sessionId,
      userId: violation.userId,
      violation: {
        type: violation.type,
        confidence: violation.confidence,
        details: violation.details,
        timestamp: violation.timestamp
      },
      severity: this.getAlertSeverity(violation.type, violation.confidence)
    };

    io.to('admin_monitoring').emit('violation_notification', adminNotification);

    // For critical violations, send emergency alert
    if (adminNotification.severity === 'critical') {
      io.to('admin_monitoring').emit('critical_violation', adminNotification);
    }
  }

  /**
   * Store violation in backend API
   */
  async storeViolation(violation) {
    try {
      const apiUrl = process.env.PROCTORING_API_URL || 'http://localhost:8000';
      
      const response = await axios.post(`${apiUrl}/api/v1/violations/${violation.sessionId}`, {
        type: violation.type,
        confidence: violation.confidence,
        details: violation.details,
        screenshot_url: violation.screenshot
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      logger.debug(`Violation stored in backend: ${response.data.violation_id}`);
      
    } catch (error) {
      logger.error('Failed to store violation in backend:', error.message);
      // Don't throw error - continue processing even if storage fails
    }
  }

  /**
   * Analyze behavior for violations
   */
  async analyzeBehavior(behaviorEvent) {
    const violations = [];
    
    switch (behaviorEvent.eventType) {
      case 'tab_switch':
        violations.push({
          type: 'tab_switch',
          confidence: 0.9,
          details: 'Student switched browser tabs',
          metadata: behaviorEvent.eventData
        });
        break;
        
      case 'copy_paste':
        violations.push({
          type: 'copy_paste',
          confidence: 0.95,
          details: 'Copy-paste activity detected',
          metadata: behaviorEvent.eventData
        });
        break;
        
      case 'right_click':
        if (behaviorEvent.eventData.context === 'text_selection') {
          violations.push({
            type: 'suspicious_interaction',
            confidence: 0.6,
            details: 'Right-click on text detected',
            metadata: behaviorEvent.eventData
          });
        }
        break;
        
      case 'key_combination':
        const { keys } = behaviorEvent.eventData;
        if (keys.includes('ctrl') && (keys.includes('c') || keys.includes('v'))) {
          violations.push({
            type: 'copy_paste_shortcut',
            confidence: 0.8,
            details: 'Copy/paste keyboard shortcut detected',
            metadata: behaviorEvent.eventData
          });
        }
        break;
        
      case 'window_blur':
        violations.push({
          type: 'window_focus_lost',
          confidence: 0.7,
          details: 'Browser window lost focus',
          metadata: behaviorEvent.eventData
        });
        break;
        
      case 'fullscreen_exit':
        violations.push({
          type: 'fullscreen_violation',
          confidence: 0.8,
          details: 'Student exited fullscreen mode',
          metadata: behaviorEvent.eventData
        });
        break;
    }
    
    return violations;
  }

  /**
   * Get alert severity based on violation type and confidence
   */
  getAlertSeverity(type, confidence) {
    const criticalViolations = ['multiple_faces', 'identity_mismatch', 'copy_paste', 'developer_tools'];
    const highViolations = ['face_not_detected', 'phone_detected', 'tab_switch', 'suspicious_audio'];
    const mediumViolations = ['gaze_deviation', 'poor_posture', 'window_focus_lost'];
    
    if (criticalViolations.includes(type) || confidence >= 0.9) {
      return 'critical';
    } else if (highViolations.includes(type) || confidence >= 0.7) {
      return 'high';
    } else if (mediumViolations.includes(type) || confidence >= 0.5) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get human-readable violation message
   */
  getViolationMessage(type) {
    const messages = {
      'face_not_detected': 'Your face is not clearly visible. Please ensure your camera is working and you are facing the screen.',
      'multiple_faces': 'Multiple faces detected. Please ensure you are alone during the exam.',
      'identity_mismatch': 'Face verification failed. Please contact your instructor immediately.',
      'phone_detected': 'Mobile device detected. Please remove all electronic devices from your workspace.',
      'book_detected': 'Unauthorized materials detected. Please remove all books and papers from your workspace.',
      'laptop_detected': 'Additional computer detected. Please ensure only one device is being used.',
      'suspicious_audio': 'Unusual audio activity detected. Please ensure you are not communicating with others.',
      'gaze_deviation': 'You appear to be looking away from the screen. Please keep your eyes on the exam.',
      'tab_switch': 'Browser tab switching detected. Please stay on the exam page.',
      'copy_paste': 'Copy-paste activity detected. This action is not allowed during the exam.',
      'developer_tools': 'Developer tools detected. Please close all browser developer tools.',
      'poor_posture': 'Unusual posture detected. Please sit normally and face the camera.',
      'window_focus_lost': 'Exam window lost focus. Please return to the exam.',
      'fullscreen_violation': 'Please return to fullscreen mode to continue the exam.'
    };
    
    return messages[type] || 'Potential violation detected. Please follow exam guidelines.';
  }

  /**
   * Process violation queue
   */
  async processViolationQueue() {
    if (this.violationQueue.size === 0) return;
    
    logger.debug(`Processing ${this.violationQueue.size} violations in queue`);
    
    // Process violations in batches
    const violations = Array.from(this.violationQueue.values());
    this.violationQueue.clear();
    
    // Group by session for batch processing
    const sessionGroups = violations.reduce((groups, violation) => {
      if (!groups[violation.sessionId]) {
        groups[violation.sessionId] = [];
      }
      groups[violation.sessionId].push(violation);
      return groups;
    }, {});
    
    // Process each session's violations
    for (const [sessionId, sessionViolations] of Object.entries(sessionGroups)) {
      try {
        await this.processSessionViolations(sessionId, sessionViolations);
      } catch (error) {
        logger.error(`Error processing violations for session ${sessionId}:`, error);
      }
    }
  }

  /**
   * Process violations for a specific session
   */
  async processSessionViolations(sessionId, violations) {
    // Calculate risk score update
    const riskIncrement = violations.reduce((sum, v) => sum + (v.confidence * 0.1), 0);
    
    // Update session risk score
    try {
      const apiUrl = process.env.PROCTORING_API_URL || 'http://localhost:8000';
      await axios.post(`${apiUrl}/api/v1/risk-score/${sessionId}/recalculate`, {}, {
        headers: {
          'Authorization': `Bearer ${process.env.API_TOKEN}`
        },
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to update risk score:', error.message);
    }
    
    // Check if session should be flagged
    const criticalViolations = violations.filter(v => 
      this.getAlertSeverity(v.type, v.confidence) === 'critical'
    );
    
    if (criticalViolations.length >= 2) {
      await this.flagSession(sessionId, 'Multiple critical violations detected');
    }
  }

  /**
   * Flag a session for manual review
   */
  async flagSession(sessionId, reason) {
    const io = require('../index').io;
    
    // Notify admins
    io.to('admin_monitoring').emit('session_flagged', {
      sessionId,
      reason,
      timestamp: Date.now(),
      severity: 'critical'
    });
    
    // Notify student
    io.to(`session_${sessionId}`).emit('session_flagged', {
      message: 'Your session has been flagged for review. Please continue following exam guidelines.',
      timestamp: Date.now()
    });
    
    logger.warn(`Session ${sessionId} flagged: ${reason}`);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.violationQueue.clear();
  }
}

module.exports = new ViolationHandler();