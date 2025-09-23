const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'websocket-service' },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),

    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    }),

    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          let log = `${timestamp} [${level}]: ${message}`;
          
          if (stack) {
            log += `\n${stack}`;
          }
          
          if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
          }
          
          return log;
        })
      )
    })
  ]
});

// Add request ID to logs for tracing
logger.requestId = (req, res, next) => {
  req.id = Math.random().toString(36).substr(2, 9);
  logger.defaultMeta.requestId = req.id;
  next();
};

// Socket connection logger
logger.socketConnection = (socket, event, data = {}) => {
  logger.info('Socket event', {
    socketId: socket.id,
    userId: socket.userId,
    adminId: socket.adminId,
    event,
    ...data
  });
};

// Violation logger
logger.violation = (violation) => {
  logger.warn('Violation detected', {
    sessionId: violation.sessionId,
    userId: violation.userId,
    type: violation.type,
    confidence: violation.confidence,
    timestamp: violation.timestamp
  });
};

// Performance logger
logger.performance = (metric, duration, metadata = {}) => {
  logger.info('Performance metric', {
    metric,
    duration,
    ...metadata
  });
};

// Error helper for socket events
logger.socketError = (socket, error, context = {}) => {
  logger.error('Socket error', {
    socketId: socket.id,
    userId: socket.userId,
    adminId: socket.adminId,
    error: error.message,
    stack: error.stack,
    ...context
  });
};

// API call logger
logger.apiCall = (method, url, status, duration, data = {}) => {
  logger.info('API call', {
    method,
    url,
    status,
    duration,
    ...data
  });
};

module.exports = logger;