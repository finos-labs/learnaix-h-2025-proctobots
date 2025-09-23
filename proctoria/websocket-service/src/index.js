const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const redis = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
require('dotenv').config();

const logger = require('./utils/logger');
const authMiddleware = require('./middleware/auth');
const sessionManager = require('./services/sessionManager');
const violationHandler = require('./handlers/violationHandler');
const monitoringHandler = require('./handlers/monitoringHandler');
const adminHandler = require('./handlers/adminHandler');

const app = express();
const server = createServer(app);

// Express middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP'
});
app.use(limiter);

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    res.json({
      status: 'healthy',
      service: 'proctoria-websocket',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      service: 'proctoria-websocket',
      error: error.message
    });
  }
});

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// Redis adapter for horizontal scaling
if (process.env.REDIS_URL) {
  const pubClient = redis.createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  
  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis adapter initialized for Socket.IO');
  }).catch(err => {
    logger.error('Failed to connect to Redis:', err);
  });
}

// Authentication middleware
io.use(authMiddleware.authenticate());

// Connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}, User: ${socket.userId}, Role: ${socket.userRole}`);
  
  // Register connection
  sessionManager.registerConnection(socket);
  
  // Handle different connection types
  if (socket.userRole === 'student') {
    handleStudentConnection(socket);
  } else if (socket.userRole === 'teacher' || socket.userRole === 'admin') {
    handleAdminConnection(socket);
  }
  
  // Common event handlers
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
  
  socket.on('disconnect', (reason) => {
    logger.info(`Client disconnected: ${socket.id}, Reason: ${reason}`);
    sessionManager.unregisterConnection(socket);
  });
  
  socket.on('error', (error) => {
    logger.error(`Socket error for ${socket.id}:`, error);
  });
});

// Student connection handlers
function handleStudentConnection(socket) {
  // Join session room
  socket.on('join_session', async (data) => {
    try {
      const { sessionId, quizId } = data;
      
      if (!sessionId || !quizId) {
        socket.emit('error', { message: 'Session ID and Quiz ID are required' });
        return;
      }
      
      // Validate session
      const isValid = await sessionManager.validateSession(sessionId, socket.userId);
      if (!isValid) {
        socket.emit('error', { message: 'Invalid session' });
        return;
      }
      
      // Join room
      socket.join(`session_${sessionId}`);
      socket.currentSession = sessionId;
      
      // Store session mapping
      sessionManager.mapUserToSession(socket.userId, sessionId);
      
      socket.emit('session_joined', {
        sessionId,
        message: 'Successfully joined proctoring session',
        timestamp: Date.now()
      });
      
      // Notify admins
      socket.to('admin_monitoring').emit('student_joined', {
        sessionId,
        userId: socket.userId,
        timestamp: Date.now()
      });
      
      logger.info(`Student ${socket.userId} joined session ${sessionId}`);
      
    } catch (error) {
      logger.error('Error joining session:', error);
      socket.emit('error', { message: 'Failed to join session' });
    }
  });
  
  // Handle violation reports
  socket.on('violation_detected', (data) => {
    violationHandler.handleViolationDetected(socket, data);
  });
  
  // Handle behavior events
  socket.on('behavior_event', (data) => {
    violationHandler.handleBehaviorEvent(socket, data);
  });
  
  // Handle status updates
  socket.on('status_update', (data) => {
    sessionManager.updateSessionStatus(socket.currentSession, data);
    
    // Broadcast to admins
    socket.to('admin_monitoring').emit('session_status_update', {
      sessionId: socket.currentSession,
      userId: socket.userId,
      status: data,
      timestamp: Date.now()
    });
  });
  
  // Handle emergency situations
  socket.on('emergency_help', (data) => {
    const emergencyData = {
      sessionId: socket.currentSession,
      userId: socket.userId,
      message: data.message || 'Student requested emergency help',
      timestamp: Date.now(),
      type: 'emergency'
    };
    
    // Notify all admins immediately
    socket.to('admin_monitoring').emit('emergency_alert', emergencyData);
    
    // Send confirmation to student
    socket.emit('emergency_acknowledged', {
      message: 'Emergency help request sent to instructors',
      timestamp: Date.now()
    });
    
    logger.warn(`Emergency help requested by student ${socket.userId} in session ${socket.currentSession}`);
  });
  
  // Handle quiz submission events
  socket.on('quiz_submitted', (data) => {
    const submissionData = {
      sessionId: socket.currentSession,
      userId: socket.userId,
      quizId: data.quizId,
      timestamp: Date.now()
    };
    
    // End proctoring session
    sessionManager.endSession(socket.currentSession);
    
    // Notify admins
    socket.to('admin_monitoring').emit('quiz_submitted', submissionData);
    
    socket.emit('session_ended', {
      message: 'Proctoring session ended - quiz submitted',
      timestamp: Date.now()
    });
  });
}

// Admin connection handlers
function handleAdminConnection(socket) {
  // Join admin monitoring room
  socket.join('admin_monitoring');
  
  // Handle monitoring requests
  socket.on('start_monitoring', (data) => {
    monitoringHandler.startMonitoring(socket, data);
  });
  
  socket.on('stop_monitoring', (data) => {
    monitoringHandler.stopMonitoring(socket, data);
  });
  
  // Handle admin interventions
  socket.on('send_message_to_student', (data) => {
    adminHandler.sendMessageToStudent(socket, data);
  });
  
  socket.on('pause_session', (data) => {
    adminHandler.pauseSession(socket, data);
  });
  
  socket.on('resume_session', (data) => {
    adminHandler.resumeSession(socket, data);
  });
  
  socket.on('end_session', (data) => {
    adminHandler.endSession(socket, data);
  });
  
  socket.on('flag_session', (data) => {
    adminHandler.flagSession(socket, data);
  });
  
  // Handle dashboard data requests
  socket.on('get_dashboard_data', async (data) => {
    try {
      const dashboardData = await monitoringHandler.getDashboardData(data);
      socket.emit('dashboard_data', dashboardData);
    } catch (error) {
      logger.error('Error getting dashboard data:', error);
      socket.emit('error', { message: 'Failed to get dashboard data' });
    }
  });
  
  // Handle real-time statistics requests
  socket.on('subscribe_statistics', (data) => {
    socket.join('statistics_subscribers');
    monitoringHandler.sendCurrentStatistics(socket);
  });
  
  socket.on('unsubscribe_statistics', () => {
    socket.leave('statistics_subscribers');
  });
}

// Periodic tasks
const cron = require('node-cron');

// Send statistics updates every 30 seconds
cron.schedule('*/30 * * * * *', () => {
  const stats = sessionManager.getSystemStatistics();
  io.to('statistics_subscribers').emit('statistics_update', stats);
});

// Clean up inactive sessions every 5 minutes
cron.schedule('*/5 * * * *', () => {
  sessionManager.cleanupInactiveSessions();
});

// Send heartbeat to all connected clients every minute
cron.schedule('* * * * *', () => {
  io.emit('heartbeat', { timestamp: Date.now() });
});

// Global error handling
io.engine.on('connection_error', (err) => {
  logger.error('Connection error:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 8003;

server.listen(PORT, () => {
  logger.info(`WebSocket service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io };