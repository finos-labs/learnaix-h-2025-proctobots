const prisma = require('../utils/database');
const logger = require('../utils/logger');
const moment = require('moment');
const _ = require('lodash');

class AnalyticsService {
  /**
   * Get comprehensive analytics for a quiz
   */
  async getQuizAnalytics(quizId, options = {}) {
    try {
      const { startDate, endDate, includeInactive } = options;
      
      const whereClause = {
        quiz_id: parseInt(quizId),
        ...(startDate && endDate && {
          time_started: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        }),
        ...(includeInactive ? {} : { status: { not: 'ended' } })
      };

      // Get all sessions for this quiz
      const sessions = await prisma.proctoring_session.findMany({
        where: whereClause,
        include: {
          violations: true,
          analytics: true
        }
      });

      if (sessions.length === 0) {
        return this._getEmptyQuizAnalytics();
      }

      // Calculate basic metrics
      const totalSessions = sessions.length;
      const completedSessions = sessions.filter(s => s.status === 'ended').length;
      const activeSessions = sessions.filter(s => s.status === 'active').length;
      const flaggedSessions = sessions.filter(s => s.status === 'flagged').length;

      // Calculate violation metrics
      const allViolations = sessions.flatMap(s => s.violations);
      const violationTypes = _.groupBy(allViolations, 'type');
      const violationCounts = _.mapValues(violationTypes, violations => violations.length);

      // Calculate average metrics
      const averageRiskScore = sessions.reduce((sum, s) => sum + (s.risk_score || 0), 0) / totalSessions;
      const averageViolations = allViolations.length / totalSessions;
      const averageSessionDuration = this._calculateAverageSessionDuration(sessions);

      // Get time-based analytics
      const timeAnalytics = this._getTimeBasedAnalytics(sessions);
      
      // Get question-level analytics
      const questionAnalytics = await this._getQuestionAnalytics(sessions);

      return {
        quiz_id: quizId,
        summary: {
          total_sessions: totalSessions,
          completed_sessions: completedSessions,
          active_sessions: activeSessions,
          flagged_sessions: flaggedSessions,
          completion_rate: totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0,
          average_risk_score: Math.round(averageRiskScore * 100) / 100,
          average_violations: Math.round(averageViolations * 100) / 100,
          average_duration_minutes: averageSessionDuration
        },
        violations: {
          total_violations: allViolations.length,
          by_type: violationCounts,
          most_common: this._getMostCommonViolation(violationCounts),
          violation_rate: totalSessions > 0 ? (allViolations.length / totalSessions) * 100 : 0
        },
        time_analytics: timeAnalytics,
        question_analytics: questionAnalytics,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error in getQuizAnalytics:', error);
      throw error;
    }
  }

  /**
   * Get analytics for a specific student
   */
  async getStudentAnalytics(userId, options = {}) {
    try {
      const { courseId, limit } = options;
      
      const whereClause = {
        user_id: parseInt(userId),
        ...(courseId && { quiz_id: { in: await this._getQuizIdsForCourse(courseId) } })
      };

      const sessions = await prisma.proctoring_session.findMany({
        where: whereClause,
        include: {
          violations: true,
          analytics: true
        },
        orderBy: { time_started: 'desc' },
        take: limit
      });

      if (sessions.length === 0) {
        return this._getEmptyStudentAnalytics();
      }

      // Calculate student metrics
      const totalSessions = sessions.length;
      const averageRiskScore = sessions.reduce((sum, s) => sum + (s.risk_score || 0), 0) / totalSessions;
      const totalViolations = sessions.reduce((sum, s) => sum + s.violation_count, 0);
      
      // Behavioral patterns
      const behaviorPatterns = this._analyzeBehaviorPatterns(sessions);
      
      // Performance trends
      const performanceTrends = this._getStudentPerformanceTrends(sessions);
      
      // Risk assessment
      const riskAssessment = this._getStudentRiskAssessment(sessions);

      return {
        user_id: userId,
        summary: {
          total_sessions: totalSessions,
          average_risk_score: Math.round(averageRiskScore * 100) / 100,
          total_violations: totalViolations,
          sessions_flagged: sessions.filter(s => s.status === 'flagged').length,
          improvement_trend: performanceTrends.trend
        },
        behavior_patterns: behaviorPatterns,
        performance_trends: performanceTrends,
        risk_assessment: riskAssessment,
        recent_sessions: sessions.slice(0, 5).map(s => ({
          session_id: s.session_id,
          quiz_id: s.quiz_id,
          risk_score: s.risk_score,
          violation_count: s.violation_count,
          status: s.status,
          date: s.time_started
        })),
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error in getStudentAnalytics:', error);
      throw error;
    }
  }

  /**
   * Get analytics for a specific course
   */
  async getCourseAnalytics(courseId, options = {}) {
    try {
      const { period } = options;
      
      const quizIds = await this._getQuizIdsForCourse(courseId);
      
      if (quizIds.length === 0) {
        return this._getEmptyCourseAnalytics();
      }

      const sessions = await prisma.proctoring_session.findMany({
        where: {
          quiz_id: { in: quizIds },
          time_started: {
            gte: this._getPeriodStartDate(period)
          }
        },
        include: {
          violations: true
        }
      });

      // Course-level metrics
      const totalStudents = new Set(sessions.map(s => s.user_id)).size;
      const totalQuizzes = quizIds.length;
      const averageRiskScore = sessions.reduce((sum, s) => sum + (s.risk_score || 0), 0) / sessions.length;
      
      // Quiz performance comparison
      const quizComparison = await this._getQuizPerformanceComparison(quizIds);
      
      // Student engagement metrics
      const engagementMetrics = this._getEngagementMetrics(sessions);
      
      // Integrity metrics
      const integrityMetrics = this._getIntegrityMetrics(sessions);

      return {
        course_id: courseId,
        period: period,
        summary: {
          total_students: totalStudents,
          total_quizzes: totalQuizzes,
          total_sessions: sessions.length,
          average_risk_score: Math.round(averageRiskScore * 100) / 100,
          integrity_score: integrityMetrics.integrity_score
        },
        quiz_comparison: quizComparison,
        engagement_metrics: engagementMetrics,
        integrity_metrics: integrityMetrics,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error in getCourseAnalytics:', error);
      throw error;
    }
  }

  /**
   * Get detailed analytics for a specific session
   */
  async getSessionAnalytics(sessionId) {
    try {
      const session = await prisma.proctoring_session.findUnique({
        where: { session_id: sessionId },
        include: {
          violations: {
            orderBy: { time_created: 'asc' }
          },
          analytics: {
            orderBy: { time_created: 'asc' }
          }
        }
      });

      if (!session) {
        return null;
      }

      // Calculate session timeline
      const timeline = this._buildSessionTimeline(session);
      
      // Analyze violation patterns
      const violationAnalysis = this._analyzeViolationPatterns(session.violations);
      
      // Performance metrics
      const performanceMetrics = this._getSessionPerformanceMetrics(session);
      
      // Risk evolution
      const riskEvolution = this._getRiskEvolution(session);

      return {
        session_id: sessionId,
        basic_info: {
          user_id: session.user_id,
          quiz_id: session.quiz_id,
          attempt_id: session.attempt_id,
          status: session.status,
          time_started: session.time_started,
          time_ended: session.time_ended,
          duration_minutes: session.time_ended ? 
            moment(session.time_ended).diff(moment(session.time_started), 'minutes') : null
        },
        risk_metrics: {
          current_score: session.risk_score,
          evolution: riskEvolution,
          assessment: this._getRiskAssessmentLevel(session.risk_score)
        },
        violation_analysis: violationAnalysis,
        performance_metrics: performanceMetrics,
        timeline: timeline,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error in getSessionAnalytics:', error);
      throw error;
    }
  }

  /**
   * Add analytics metrics for a session
   */
  async addSessionMetrics(sessionId, metrics) {
    try {
      const session = await prisma.proctoring_session.findUnique({
        where: { session_id: sessionId }
      });

      if (!session) {
        throw new Error('Session not found');
      }

      const analyticsRecords = metrics.map(metric => ({
        session_id: session.id,
        question_id: metric.questionId || null,
        metric_type: metric.type,
        metric_value: JSON.stringify(metric.value),
        time_created: metric.timestamp ? new Date(metric.timestamp) : new Date()
      }));

      const result = await prisma.analytics.createMany({
        data: analyticsRecords,
        skipDuplicates: true
      });

      logger.info(`Added ${result.count} analytics metrics for session ${sessionId}`);
      
      return {
        session_id: sessionId,
        metrics_added: result.count,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error in addSessionMetrics:', error);
      throw error;
    }
  }

  /**
   * Get violations summary
   */
  async getViolationsSummary(options = {}) {
    try {
      const { startDate, endDate, courseId, groupBy } = options;
      
      let whereClause = {};
      
      if (startDate && endDate) {
        whereClause.time_created = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      if (courseId) {
        const quizIds = await this._getQuizIdsForCourse(courseId);
        whereClause.session = {
          quiz_id: { in: quizIds }
        };
      }

      const violations = await prisma.violation.findMany({
        where: whereClause,
        include: {
          session: true
        }
      });

      // Group violations by time period
      const groupedViolations = this._groupViolationsByTime(violations, groupBy);
      
      // Calculate summary statistics
      const summary = {
        total_violations: violations.length,
        by_type: _.countBy(violations, 'type'),
        by_time_period: groupedViolations,
        average_per_session: violations.length / new Set(violations.map(v => v.session_id)).size,
        resolution_rate: violations.filter(v => v.resolved).length / violations.length * 100
      };

      return summary;

    } catch (error) {
      logger.error('Error in getViolationsSummary:', error);
      throw error;
    }
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(options = {}) {
    try {
      const { period, courseId, metric } = options;
      
      let whereClause = {
        time_started: {
          gte: this._getPeriodStartDate(period)
        }
      };

      if (courseId) {
        const quizIds = await this._getQuizIdsForCourse(courseId);
        whereClause.quiz_id = { in: quizIds };
      }

      const sessions = await prisma.proctoring_session.findMany({
        where: whereClause,
        include: {
          violations: true
        },
        orderBy: { time_started: 'asc' }
      });

      const trends = this._calculateTrends(sessions, metric, period);
      
      return {
        metric: metric,
        period: period,
        trends: trends,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error in getPerformanceTrends:', error);
      throw error;
    }
  }

  // Helper methods
  _getEmptyQuizAnalytics() {
    return {
      summary: { total_sessions: 0, completion_rate: 0 },
      violations: { total_violations: 0 },
      time_analytics: {},
      question_analytics: []
    };
  }

  _getEmptyStudentAnalytics() {
    return {
      summary: { total_sessions: 0, average_risk_score: 0 },
      behavior_patterns: {},
      performance_trends: {},
      recent_sessions: []
    };
  }

  _getEmptyCourseAnalytics() {
    return {
      summary: { total_students: 0, total_quizzes: 0 },
      quiz_comparison: [],
      engagement_metrics: {},
      integrity_metrics: {}
    };
  }

  _calculateAverageSessionDuration(sessions) {
    const completedSessions = sessions.filter(s => s.time_ended);
    if (completedSessions.length === 0) return 0;
    
    const totalDuration = completedSessions.reduce((sum, s) => {
      return sum + moment(s.time_ended).diff(moment(s.time_started), 'minutes');
    }, 0);
    
    return Math.round(totalDuration / completedSessions.length);
  }

  _getTimeBasedAnalytics(sessions) {
    const hourlyDistribution = _.groupBy(sessions, s => 
      moment(s.time_started).hour()
    );
    
    const dailyDistribution = _.groupBy(sessions, s => 
      moment(s.time_started).format('dddd')
    );
    
    return {
      hourly_distribution: _.mapValues(hourlyDistribution, group => group.length),
      daily_distribution: _.mapValues(dailyDistribution, group => group.length)
    };
  }

  async _getQuestionAnalytics(sessions) {
    // This would analyze question-specific metrics
    // For now, return empty array
    return [];
  }

  _getMostCommonViolation(violationCounts) {
    if (Object.keys(violationCounts).length === 0) return null;
    return Object.keys(violationCounts).reduce((a, b) => 
      violationCounts[a] > violationCounts[b] ? a : b
    );
  }

  async _getQuizIdsForCourse(courseId) {
    // This would query Moodle database to get quiz IDs for a course
    // For now, return mock data
    return [1, 2, 3]; // Mock quiz IDs
  }

  _getPeriodStartDate(period) {
    const now = moment();
    switch (period) {
      case 'week': return now.subtract(1, 'week').toDate();
      case 'month': return now.subtract(1, 'month').toDate();
      case 'quarter': return now.subtract(3, 'months').toDate();
      case 'year': return now.subtract(1, 'year').toDate();
      default: return now.subtract(1, 'month').toDate();
    }
  }

  _analyzeBehaviorPatterns(sessions) {
    // Analyze student behavior patterns across sessions
    const patterns = {
      consistency: this._calculateConsistency(sessions),
      peak_violation_times: this._getPeakViolationTimes(sessions),
      improvement_trend: this._getImprovementTrend(sessions)
    };
    
    return patterns;
  }

  _getStudentPerformanceTrends(sessions) {
    const sortedSessions = sessions.sort((a, b) => 
      new Date(a.time_started) - new Date(b.time_started)
    );
    
    const riskScores = sortedSessions.map(s => s.risk_score || 0);
    const trend = this._calculateTrend(riskScores);
    
    return {
      trend: trend,
      risk_scores: riskScores.slice(-10), // Last 10 sessions
      improvement_rate: this._calculateImprovementRate(riskScores)
    };
  }

  _getStudentRiskAssessment(sessions) {
    const recentSessions = sessions.slice(0, 5);
    const averageRisk = recentSessions.reduce((sum, s) => sum + (s.risk_score || 0), 0) / recentSessions.length;
    
    return {
      current_level: this._getRiskAssessmentLevel(averageRisk),
      recommendation: this._getRiskRecommendation(averageRisk),
      factors: this._getRiskFactors(sessions)
    };
  }

  _getRiskAssessmentLevel(riskScore) {
    if (riskScore < 0.3) return 'low';
    if (riskScore < 0.6) return 'medium';
    if (riskScore < 0.8) return 'high';
    return 'critical';
  }

  _getRiskRecommendation(riskScore) {
    if (riskScore < 0.3) return 'Continue current practices';
    if (riskScore < 0.6) return 'Monitor closely and provide guidance';
    if (riskScore < 0.8) return 'Immediate intervention recommended';
    return 'Require additional verification methods';
  }

  _getRiskFactors(sessions) {
    // Analyze what factors contribute to risk
    return {
      frequent_violations: true, // Mock data
      inconsistent_behavior: false,
      technical_issues: false
    };
  }

  // Additional helper methods would go here...
  _calculateConsistency(sessions) { return 0.8; } // Mock
  _getPeakViolationTimes(sessions) { return []; } // Mock
  _getImprovementTrend(sessions) { return 'improving'; } // Mock
  _calculateTrend(values) { return 'stable'; } // Mock
  _calculateImprovementRate(values) { return 5.2; } // Mock
}

module.exports = new AnalyticsService();