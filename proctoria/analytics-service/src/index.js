const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 8001;

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'proctoria-analytics',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Simple demo endpoint
app.get('/api/analytics/overview', (req, res) => {
  res.json({
    totalSessions: 142,
    activeSessions: 8,
    totalViolations: 23,
    averageRiskScore: 15.7,
    timestamp: new Date().toISOString()
  });
});

// API routes - commented out for demo
// app.use('/api/v1/analytics', authenticateToken, analyticsRoutes);
// app.use('/api/v1/reports', authenticateToken, reportsRoutes);
// app.use('/api/v1/metrics', authenticateToken, metricsRoutes);
// app.use('/api/v1/dashboard', authenticateToken, dashboardRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info(`Analytics service running on port ${PORT}`);
});

module.exports = app;