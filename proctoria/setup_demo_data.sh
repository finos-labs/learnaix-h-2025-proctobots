#!/bin/bash

# Proctoria Demo Data Setup Script
# This script creates realistic demo data for hackathon presentation

echo "🎯 Setting up Proctoria Demo Data..."

# Base URLs
BACKEND_URL="http://localhost:8000"
ANALYTICS_URL="http://localhost:3001"
PLAGIARISM_URL="http://localhost:8080"
WEBSOCKET_URL="http://localhost:3003"

echo "📊 Creating demo exam sessions..."

# Create demo exam sessions
curl -X POST "$BACKEND_URL/api/v1/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": "demo_exam_001",
    "user_id": "student_alice_001",
    "quiz_id": "cs101_midterm_2024",
    "exam_title": "Computer Science 101 - Midterm Exam",
    "duration": 7200,
    "start_time": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "settings": {
      "face_detection": true,
      "audio_monitoring": true,
      "screen_sharing": true,
      "plagiarism_check": true
    }
  }'

echo ""

curl -X POST "$BACKEND_URL/api/v1/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": "demo_exam_002", 
    "user_id": "student_bob_002",
    "quiz_id": "math202_final_2024",
    "exam_title": "Advanced Mathematics - Final Exam",
    "duration": 10800,
    "start_time": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "settings": {
      "face_detection": true,
      "audio_monitoring": true,
      "screen_sharing": true,
      "plagiarism_check": true
    }
  }'

echo ""
echo "🔍 Creating demo violations..."

# Create realistic violation scenarios
curl -X POST "$BACKEND_URL/api/v1/violations" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "demo_exam_001",
    "violation_type": "face_not_visible",
    "severity": "warning",
    "description": "Student face not clearly visible for 15 seconds",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "confidence": 0.85
  }'

curl -X POST "$BACKEND_URL/api/v1/violations" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "demo_exam_001",
    "violation_type": "multiple_persons_detected",
    "severity": "critical",
    "description": "Multiple faces detected in camera feed",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "confidence": 0.92
  }'

curl -X POST "$BACKEND_URL/api/v1/violations" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "demo_exam_002",
    "violation_type": "suspicious_audio",
    "severity": "warning", 
    "description": "Background conversation detected",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "confidence": 0.78
  }'

echo ""
echo "📝 Testing plagiarism detection..."

# Test plagiarism detection with sample text
curl -X POST "$PLAGIARISM_URL/api/plagiarism/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed.",
    "sessionId": "demo_exam_001",
    "questionId": "q1_cs101"
  }'

echo ""
echo "📈 Generating analytics data..."

# Test analytics endpoints
curl -X GET "$ANALYTICS_URL/api/reports/session/demo_exam_001"
curl -X GET "$ANALYTICS_URL/api/dashboard/stats"

echo ""
echo "✅ Demo data setup complete!"
echo ""
echo "🎮 Demo URLs to showcase:"
echo "Backend Health: $BACKEND_URL/health"
echo "Analytics Health: $ANALYTICS_URL/health" 
echo "Plagiarism Health: $PLAGIARISM_URL/api/plagiarism/health"
echo "WebSocket Health: $WEBSOCKET_URL/health"
echo ""
echo "📊 Demo Endpoints:"
echo "Sessions: $BACKEND_URL/api/v1/sessions"
echo "Violations: $BACKEND_URL/api/v1/violations"
echo "Analytics: $ANALYTICS_URL/api/dashboard/stats"
echo "Plagiarism: $PLAGIARISM_URL/api/plagiarism/analyze"