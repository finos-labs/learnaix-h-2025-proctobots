const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const analyticsService = require('../services/analyticsService');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      details: errors.array()
    });
  }
  next();
};

/**
 * GET /api/v1/analytics/quiz/:quizId
 * Get analytics for a specific quiz
 */
router.get('/quiz/:quizId',
  [
    param('quizId').isInt().withMessage('Quiz ID must be an integer'),
    query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO 8601'),
    query('endDate').optional().isISO8601().withMessage('End date must be valid ISO 8601'),
    query('includeInactive').optional().isBoolean().withMessage('Include inactive must be boolean')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { quizId } = req.params;
      const { startDate, endDate, includeInactive = false } = req.query;
      
      const analytics = await analyticsService.getQuizAnalytics(quizId, {
        startDate,
        endDate,
        includeInactive: includeInactive === 'true'
      });
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error(`Error getting quiz analytics for quiz ${req.params.quizId}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve quiz analytics'
      });
    }
  }
);

/**
 * GET /api/v1/analytics/student/:userId
 * Get analytics for a specific student
 */
router.get('/student/:userId',
  [
    param('userId').isInt().withMessage('User ID must be an integer'),
    query('courseId').optional().isInt().withMessage('Course ID must be an integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { courseId, limit = 10 } = req.query;
      
      const analytics = await analyticsService.getStudentAnalytics(userId, {
        courseId: courseId ? parseInt(courseId) : null,
        limit: parseInt(limit)
      });
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error(`Error getting student analytics for user ${req.params.userId}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve student analytics'
      });
    }
  }
);

/**
 * GET /api/v1/analytics/course/:courseId
 * Get analytics for a specific course
 */
router.get('/course/:courseId',
  [
    param('courseId').isInt().withMessage('Course ID must be an integer'),
    query('period').optional().isIn(['week', 'month', 'quarter', 'year']).withMessage('Period must be week, month, quarter, or year')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { period = 'month' } = req.query;
      
      const analytics = await analyticsService.getCourseAnalytics(courseId, { period });
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error(`Error getting course analytics for course ${req.params.courseId}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve course analytics'
      });
    }
  }
);

/**
 * GET /api/v1/analytics/session/:sessionId
 * Get detailed analytics for a specific proctoring session
 */
router.get('/session/:sessionId',
  [
    param('sessionId').isUUID().withMessage('Session ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const analytics = await analyticsService.getSessionAnalytics(sessionId);
      
      if (!analytics) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Session not found'
        });
      }
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error(`Error getting session analytics for session ${req.params.sessionId}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve session analytics'
      });
    }
  }
);

/**
 * POST /api/v1/analytics/session/:sessionId/metrics
 * Add analytics metrics for a session
 */
router.post('/session/:sessionId/metrics',
  [
    param('sessionId').isUUID().withMessage('Session ID must be a valid UUID'),
    body('metrics').isArray().withMessage('Metrics must be an array'),
    body('metrics.*.type').notEmpty().withMessage('Metric type is required'),
    body('metrics.*.value').notEmpty().withMessage('Metric value is required'),
    body('metrics.*.questionId').optional().isInt().withMessage('Question ID must be an integer'),
    body('metrics.*.timestamp').optional().isISO8601().withMessage('Timestamp must be valid ISO 8601')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { metrics } = req.body;
      
      const result = await analyticsService.addSessionMetrics(sessionId, metrics);
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Metrics added successfully'
      });
    } catch (error) {
      logger.error(`Error adding metrics for session ${req.params.sessionId}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to add session metrics'
      });
    }
  }
);

/**
 * GET /api/v1/analytics/violations/summary
 * Get violation summary across all sessions
 */
router.get('/violations/summary',
  [
    query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO 8601'),
    query('endDate').optional().isISO8601().withMessage('End date must be valid ISO 8601'),
    query('courseId').optional().isInt().withMessage('Course ID must be an integer'),
    query('groupBy').optional().isIn(['day', 'week', 'month']).withMessage('Group by must be day, week, or month')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { startDate, endDate, courseId, groupBy = 'day' } = req.query;
      
      const summary = await analyticsService.getViolationsSummary({
        startDate,
        endDate,
        courseId: courseId ? parseInt(courseId) : null,
        groupBy
      });
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error getting violations summary:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve violations summary'
      });
    }
  }
);

/**
 * GET /api/v1/analytics/performance/trends
 * Get performance trends across time periods
 */
router.get('/performance/trends',
  [
    query('period').optional().isIn(['week', 'month', 'quarter']).withMessage('Period must be week, month, or quarter'),
    query('courseId').optional().isInt().withMessage('Course ID must be an integer'),
    query('metric').optional().isIn(['completion_rate', 'average_score', 'violation_rate']).withMessage('Invalid metric type')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { period = 'month', courseId, metric = 'completion_rate' } = req.query;
      
      const trends = await analyticsService.getPerformanceTrends({
        period,
        courseId: courseId ? parseInt(courseId) : null,
        metric
      });
      
      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      logger.error('Error getting performance trends:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve performance trends'
      });
    }
  }
);

module.exports = router;