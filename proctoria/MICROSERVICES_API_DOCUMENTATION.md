# Proctoria Microservices API Documentation & Moodle Integration

## Overview
The Proctoria system consists of 4 microservices that work together to provide comprehensive AI-powered proctoring for Moodle quizzes. Each service has specific responsibilities and APIs that integrate seamlessly with the Moodle plugin.

## Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Backend   │    │   Analytics     │    │   Plagiarism    │    │   WebSocket     │
│   Port: 8000    │    │   Port: 3001    │    │   Port: 8080    │    │   Port: 3003    │
│   (FastAPI)     │    │   (Node.js)     │    │   (Spring Boot) │    │   (Socket.IO)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │                       │
         └───────────────────────┼───────────────────────┼───────────────────────┘
                                 │                       │
                         ┌───────────────────────────────────┐
                         │         Moodle Plugin             │
                         │    (quizaccess_proctoria)         │
                         │                                   │
                         │  • Quiz Settings Integration      │
                         │  • Real-time Monitoring           │
                         │  • Student Interface              │
                         │  • Instructor Dashboard           │
                         └───────────────────────────────────┘
```

---

## 1. AI Backend Service (Port 8000)
**Technology**: FastAPI (Python)  
**Purpose**: Core AI processing, session management, ML model inference

### Session Management APIs

#### POST `/api/v1/sessions/start`
**Purpose**: Start a new proctoring session for a quiz attempt
```json
Request Body:
{
    "quiz_id": 123,
    "user_id": 456,
    "attempt_id": 789,
    "duration": 3600,
    "settings": {
        "face_detection": true,
        "audio_monitoring": true,
        "screen_recording": false,
        "plagiarism_check": true
    }
}

Response:
{
    "session_id": "uuid-session-123",
    "status": "active",
    "message": "Session started successfully",
    "websocket_url": "ws://localhost:3003/ws/uuid-session-123"
}
```

#### POST `/api/v1/sessions/{session_id}/end`
**Purpose**: End a proctoring session when quiz is submitted
```json
Response:
{
    "message": "Session ended successfully",
    "final_risk_score": 15.7,
    "total_violations": 3,
    "session_duration": "01:45:30"
}
```

#### GET `/api/v1/sessions/{session_id}/status`
**Purpose**: Get real-time session status and risk score
```json
Response:
{
    "session_id": "uuid-session-123",
    "status": "active",
    "risk_score": 15.7,
    "violation_count": 3,
    "time_started": "2025-09-23T10:00:00Z",
    "last_activity": "2025-09-23T11:30:00Z",
    "current_violations": ["face_not_visible", "multiple_persons"]
}
```

### AI Processing APIs

#### POST `/api/v1/process/video-frame`
**Purpose**: Process webcam frames for facial recognition and behavior analysis
```json
Request: Multipart form data
- session_id: string
- frame: image file (base64 or binary)

Response:
{
    "violations_detected": 2,
    "processed": true,
    "violations": [
        {
            "type": "multiple_persons",
            "confidence": 0.87,
            "timestamp": "2025-09-23T11:30:15Z"
        },
        {
            "type": "face_not_visible",
            "confidence": 0.92,
            "timestamp": "2025-09-23T11:30:15Z"
        }
    ]
}
```

#### POST `/api/v1/process/audio-chunk`
**Purpose**: Process audio for voice detection and conversation analysis
```json
Request: Multipart form data
- session_id: string
- audio: audio file (wav/mp3)

Response:
{
    "violations_detected": 1,
    "processed": true,
    "violations": [
        {
            "type": "conversation_detected",
            "confidence": 0.78,
            "transcript": "Can you help me with question 5?",
            "timestamp": "2025-09-23T11:31:00Z"
        }
    ]
}
```

#### POST `/api/v1/process/behavior-event`
**Purpose**: Process browser behavior events (tab switching, copy/paste, etc.)
```json
Request Body:
{
    "session_id": "uuid-session-123",
    "event_type": "tab_switch",
    "event_data": {
        "from_tab": "Quiz - Question 5",
        "to_tab": "Google Search",
        "duration": 45
    },
    "timestamp": "2025-09-23T11:32:00Z"
}

Response:
{
    "violations_detected": 1,
    "processed": true,
    "risk_score_impact": +10
}
```

### Violation Management APIs

#### GET `/api/v1/violations/{session_id}`
**Purpose**: Get all violations for a specific session
```json
Response:
[
    {
        "id": 123,
        "type": "face_not_visible",
        "confidence": 0.92,
        "timestamp": "2025-09-23T11:30:15Z",
        "resolved": false,
        "severity": "medium",
        "evidence_url": "/uploads/evidence/violation_123.jpg"
    },
    {
        "id": 124,
        "type": "multiple_persons",
        "confidence": 0.87,
        "timestamp": "2025-09-23T11:30:20Z",
        "resolved": false,
        "severity": "high"
    }
]
```

#### PUT `/api/v1/violations/{violation_id}/status`
**Purpose**: Update violation status (resolve/unresolve)
```json
Request Body:
{
    "resolved": true,
    "reviewer_notes": "False positive - student adjusting camera"
}

Response:
{
    "updated": true,
    "violation_id": 123
}
```

### Identity Verification APIs

#### POST `/api/v1/identity/verify`
**Purpose**: Verify student identity before quiz starts
```json
Request Body:
{
    "user_id": 456,
    "session_id": "uuid-session-123",
    "photo": "base64_encoded_image",
    "id_document": "base64_encoded_id_image" // optional
}

Response:
{
    "verified": true,
    "confidence": 0.94,
    "match_score": 0.89,
    "message": "Identity verified successfully"
}
```

---

## 2. Analytics Service (Port 3001)
**Technology**: Node.js/Express  
**Purpose**: Data analytics, reporting, and statistical analysis

### Analytics APIs

#### GET `/api/v1/analytics/overview`
**Purpose**: Get system-wide analytics overview
```json
Response:
{
    "totalSessions": 142,
    "activeSessions": 8,
    "totalViolations": 23,
    "averageRiskScore": 15.7,
    "topViolationTypes": [
        {"type": "face_not_visible", "count": 45},
        {"type": "multiple_persons", "count": 23},
        {"type": "tab_switch", "count": 18}
    ],
    "timestamp": "2025-09-23T12:00:00Z"
}
```

#### GET `/api/v1/analytics/session/{session_id}/report`
**Purpose**: Generate detailed session report
```json
Response:
{
    "session_id": "uuid-session-123",
    "quiz_info": {
        "quiz_id": 123,
        "quiz_name": "Midterm Exam - Computer Science",
        "duration": "02:00:00"
    },
    "student_info": {
        "user_id": 456,
        "name": "John Doe",
        "email": "john.doe@university.edu"
    },
    "proctoring_summary": {
        "total_violations": 5,
        "final_risk_score": 25.3,
        "identity_verified": true,
        "session_duration": "01:55:30",
        "violations_by_type": {
            "face_not_visible": 2,
            "multiple_persons": 1,
            "tab_switch": 2
        }
    },
    "timeline": [
        {
            "timestamp": "2025-09-23T10:05:00Z",
            "event": "face_not_visible",
            "duration": 15,
            "severity": "medium"
        }
    ],
    "recommendations": [
        "Review timestamps 10:05-10:20 for face visibility issues",
        "Investigate potential collaboration at 11:30"
    ]
}
```

#### GET `/api/v1/analytics/instructor/{instructor_id}/dashboard`
**Purpose**: Get instructor dashboard data
```json
Response:
{
    "instructor_id": 789,
    "active_sessions": [
        {
            "session_id": "uuid-session-123",
            "student_name": "John Doe",
            "quiz_name": "Midterm Exam",
            "current_risk_score": 15.7,
            "status": "active",
            "duration": "01:30:00"
        }
    ],
    "flagged_sessions": [
        {
            "session_id": "uuid-session-456",
            "student_name": "Jane Smith",
            "risk_score": 45.2,
            "violation_count": 8,
            "requires_attention": true
        }
    ],
    "statistics": {
        "total_sessions_today": 15,
        "average_risk_score": 18.3,
        "high_risk_sessions": 3
    }
}
```

#### POST `/api/v1/analytics/reports/generate`
**Purpose**: Generate custom analytics reports
```json
Request Body:
{
    "report_type": "course_summary",
    "course_id": 101,
    "date_range": {
        "start": "2025-09-01",
        "end": "2025-09-23"
    },
    "include_details": true
}

Response:
{
    "report_id": "report_uuid_789",
    "status": "generating",
    "estimated_completion": "2025-09-23T12:05:00Z",
    "download_url": "/api/v1/reports/download/report_uuid_789"
}
```

---

## 3. Plagiarism Detection Service (Port 8080)
**Technology**: Spring Boot (Java)  
**Purpose**: Text analysis and plagiarism detection

### Plagiarism APIs

#### POST `/api/plagiarism/analyze`
**Purpose**: Analyze text for plagiarism
```json
Request Body:
{
    "text": "The quick brown fox jumps over the lazy dog...",
    "sessionId": "uuid-session-123",
    "questionId": 5,
    "userId": 456,
    "language": "en"
}

Response:
{
    "jobId": "plagiarism-job-uuid-456",
    "status": "PROCESSING",
    "message": "Analysis started successfully",
    "estimatedCompletion": "2025-09-23T12:02:00Z"
}
```

#### GET `/api/plagiarism/status/{jobId}`
**Purpose**: Get plagiarism analysis status and results
```json
Response:
{
    "jobId": "plagiarism-job-uuid-456",
    "status": "COMPLETED",
    "progress": 100,
    "results": {
        "similarityScore": 15.7,
        "overallRisk": "low",
        "matches": [
            {
                "source": "Wikipedia - Computer Science",
                "similarity": 12.3,
                "matchedText": "Computer science is the study of algorithms...",
                "url": "https://en.wikipedia.org/wiki/Computer_science"
            }
        ],
        "statistics": {
            "totalWords": 150,
            "uniqueWords": 120,
            "commonPhrases": 5
        }
    },
    "completedAt": "2025-09-23T12:01:45Z"
}
```

#### POST `/api/plagiarism/batch-analyze`
**Purpose**: Analyze multiple texts in batch
```json
Request Body:
{
    "sessionId": "uuid-session-123",
    "submissions": [
        {
            "questionId": 1,
            "text": "Answer to question 1..."
        },
        {
            "questionId": 2,
            "text": "Answer to question 2..."
        }
    ]
}

Response:
{
    "batchId": "batch-uuid-789",
    "totalJobs": 2,
    "status": "PROCESSING",
    "jobs": [
        {"questionId": 1, "jobId": "job-1-uuid"},
        {"questionId": 2, "jobId": "job-2-uuid"}
    ]
}
```

#### GET `/api/plagiarism/health`
**Purpose**: Service health check
```json
Response:
{
    "status": "OK",
    "service": "Plagiarism Detection Service",
    "version": "1.0.0",
    "modelsLoaded": true,
    "databaseConnected": true
}
```

---

## 4. WebSocket Service (Port 3003)
**Technology**: Socket.IO (Node.js)  
**Purpose**: Real-time communication and live monitoring

### WebSocket Events

#### Connection Events
```javascript
// Client connects to WebSocket
socket = io('ws://localhost:3003', {
    auth: {
        token: 'jwt_token_here',
        sessionId: 'uuid-session-123',
        userId: 456,
        role: 'student' // or 'teacher', 'admin'
    }
});

// Server confirms connection
socket.on('connected', (data) => {
    console.log('Connected:', data);
    // {status: 'connected', sessionId: 'uuid-session-123', role: 'student'}
});
```

#### Student Events
```javascript
// Join proctoring session
socket.emit('join_session', {
    sessionId: 'uuid-session-123',
    quizId: 123
});

// Session joined confirmation
socket.on('session_joined', (data) => {
    // {sessionId: 'uuid-session-123', message: 'Successfully joined...', timestamp: 1695456789}
});

// Send behavior events
socket.emit('behavior_event', {
    type: 'tab_switch',
    data: {from: 'quiz', to: 'google.com', duration: 5},
    timestamp: Date.now()
});

// Receive violation alerts
socket.on('violation_alert', (data) => {
    // {type: 'face_not_visible', severity: 'medium', message: 'Please ensure your face is visible'}
});

// Emergency help request
socket.emit('emergency_help', {
    message: 'Technical difficulty with webcam'
});

// Emergency acknowledged
socket.on('emergency_acknowledged', (data) => {
    // {message: 'Emergency help request sent to instructors', timestamp: 1695456789}
});

// Quiz submission
socket.emit('quiz_submitted', {
    quizId: 123,
    submissionTime: Date.now()
});

// Session ended
socket.on('session_ended', (data) => {
    // {message: 'Proctoring session ended - quiz submitted', timestamp: 1695456789}
});
```

#### Instructor/Admin Events
```javascript
// Join admin monitoring
socket.emit('start_monitoring', {
    sessionIds: ['uuid-session-123', 'uuid-session-456']
});

// Receive real-time updates
socket.on('student_joined', (data) => {
    // {sessionId: 'uuid-session-123', userId: 456, timestamp: 1695456789}
});

socket.on('violation_detected', (data) => {
    // {sessionId: 'uuid-session-123', userId: 456, violation: {...}, timestamp: 1695456789}
});

socket.on('session_status_update', (data) => {
    // {sessionId: 'uuid-session-123', userId: 456, status: {...}, timestamp: 1695456789}
});

// Emergency alerts
socket.on('emergency_alert', (data) => {
    // {sessionId: 'uuid-session-123', userId: 456, message: 'Student needs help', type: 'emergency'}
});

// Send message to student
socket.emit('send_message_to_student', {
    sessionId: 'uuid-session-123',
    message: 'Please adjust your camera position',
    priority: 'medium'
});

// Pause/Resume session
socket.emit('pause_session', {sessionId: 'uuid-session-123'});
socket.emit('resume_session', {sessionId: 'uuid-session-123'});

// End session manually
socket.emit('end_session', {
    sessionId: 'uuid-session-123',
    reason: 'Academic integrity violation'
});

// Subscribe to statistics
socket.emit('subscribe_statistics');
socket.on('statistics_update', (data) => {
    // {activeSessions: 8, totalViolations: 23, averageRiskScore: 15.7}
});
```

---

## Moodle Plugin Integration

### Plugin Architecture
The `quizaccess_proctoria` plugin integrates all 4 microservices into Moodle's quiz system:

#### 1. Quiz Settings Integration
```php
// In rule.php - Add proctoring settings to quiz creation form
public static function add_settings_form_fields(mod_quiz_mod_form $quizform, MoodleQuickForm $mform) {
    $mform->addElement('header', 'proctoriaheader', 'AI Proctoring (Proctoria)');
    
    // Enable/disable proctoring
    $mform->addElement('advcheckbox', 'proctoria_enabled', 
        'Enable AI Proctoring', 'Activate AI proctoring for this quiz');
    
    // Proctoring options
    $mform->addElement('advcheckbox', 'proctoria_face_detection', 
        'Face Detection', 'Monitor student face visibility');
    
    $mform->addElement('advcheckbox', 'proctoria_audio_monitoring', 
        'Audio Monitoring', 'Detect conversations and sounds');
    
    $mform->addElement('advcheckbox', 'proctoria_plagiarism_check', 
        'Plagiarism Detection', 'Analyze text responses for plagiarism');
    
    $mform->addElement('select', 'proctoria_strictness', 'Monitoring Strictness', [
        'low' => 'Low - Minimal monitoring',
        'medium' => 'Medium - Standard monitoring', 
        'high' => 'High - Strict monitoring'
    ]);
}
```

#### 2. Quiz Attempt Integration
```php
// Start proctoring session when quiz attempt begins
public function prevent_access() {
    global $USER, $DB;
    
    if ($this->is_proctoring_enabled()) {
        // Call AI Backend to start session
        $session_data = [
            'quiz_id' => $this->quiz->id,
            'user_id' => $USER->id,
            'attempt_id' => $this->attemptobj->get_attemptid(),
            'settings' => $this->get_proctoring_settings()
        ];
        
        $session_response = $this->call_backend_api('POST', '/api/v1/sessions/start', $session_data);
        
        if ($session_response['status'] === 'success') {
            // Store session ID in user session
            $_SESSION['proctoria_session_id'] = $session_response['session_id'];
            
            // Inject JavaScript for real-time monitoring
            $this->inject_proctoring_javascript($session_response['session_id']);
        }
    }
    
    return false; // Allow access to continue
}
```

#### 3. Real-time Monitoring JavaScript
```javascript
// Injected into quiz attempt page
class ProctoriaMonitor {
    constructor(sessionId, websocketUrl) {
        this.sessionId = sessionId;
        this.socket = io(websocketUrl, {
            auth: {token: this.getAuthToken(), sessionId: sessionId, role: 'student'}
        });
        
        this.initializeMonitoring();
    }
    
    initializeMonitoring() {
        // Initialize webcam
        this.startVideoCapture();
        
        // Initialize audio monitoring
        this.startAudioCapture();
        
        // Monitor browser behavior
        this.monitorBrowserBehavior();
        
        // Connect to WebSocket
        this.connectWebSocket();
    }
    
    startVideoCapture() {
        navigator.mediaDevices.getUserMedia({video: true})
            .then(stream => {
                this.videoStream = stream;
                this.processVideoFrames();
            });
    }
    
    processVideoFrames() {
        setInterval(() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            // Capture frame and send to backend
            this.sendFrameToBackend(canvas.toDataURL());
        }, 5000); // Every 5 seconds
    }
    
    sendFrameToBackend(frameData) {
        fetch('http://localhost:8000/api/v1/process/video-frame', {
            method: 'POST',
            body: this.createFrameFormData(frameData)
        });
    }
    
    monitorBrowserBehavior() {
        // Tab switch detection
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.socket.emit('behavior_event', {
                    type: 'tab_switch_away',
                    timestamp: Date.now()
                });
            }
        });
        
        // Copy/paste detection
        document.addEventListener('paste', (e) => {
            this.socket.emit('behavior_event', {
                type: 'paste_detected',
                data: {length: e.clipboardData.getData('text').length},
                timestamp: Date.now()
            });
        });
    }
    
    connectWebSocket() {
        this.socket.on('violation_alert', (data) => {
            this.showViolationWarning(data);
        });
        
        this.socket.on('session_ended', (data) => {
            this.cleanup();
        });
    }
    
    showViolationWarning(violation) {
        // Display warning to student
        const warning = document.createElement('div');
        warning.className = 'proctoria-warning';
        warning.innerHTML = `
            <div class="alert alert-warning">
                <strong>Proctoring Alert:</strong> ${violation.message}
            </div>
        `;
        document.body.appendChild(warning);
        
        setTimeout(() => warning.remove(), 5000);
    }
}

// Initialize when quiz starts
document.addEventListener('DOMContentLoaded', () => {
    if (window.proctoriaSessionId) {
        new ProctoriaMonitor(window.proctoriaSessionId, 'ws://localhost:3003');
    }
});
```

#### 4. Instructor Dashboard Integration
```php
// Add proctoring tab to quiz management interface
public function add_quiz_navigation_tabs($quiz, $context) {
    if (has_capability('quizaccess/proctoria:monitor', $context)) {
        return [
            'proctoring' => [
                'name' => 'Live Proctoring',
                'url' => new moodle_url('/mod/quiz/accessrule/proctoria/monitor.php', ['id' => $quiz->id]),
                'icon' => 'fa-video-camera'
            ],
            'reports' => [
                'name' => 'Proctoring Reports', 
                'url' => new moodle_url('/mod/quiz/accessrule/proctoria/reports.php', ['id' => $quiz->id]),
                'icon' => 'fa-chart-bar'
            ]
        ];
    }
}
```

#### 5. Post-Quiz Processing
```php
// Process quiz submission and generate final report
public function quiz_attempt_submitted($attemptobj) {
    $session_id = $_SESSION['proctoria_session_id'];
    
    if ($session_id) {
        // End proctoring session
        $this->call_backend_api('POST', "/api/v1/sessions/{$session_id}/end");
        
        // Get final analytics report
        $report = $this->call_analytics_api('GET', "/api/v1/analytics/session/{$session_id}/report");
        
        // Store proctoring results in Moodle database
        $this->store_proctoring_results($attemptobj->get_attemptid(), $report);
        
        // Generate plagiarism report for text responses
        $this->process_plagiarism_results($attemptobj, $session_id);
    }
}
```

### API Integration Helper Functions
```php
// Helper class for API communication
class proctoria_api_client {
    private $backend_url = 'http://localhost:8000';
    private $analytics_url = 'http://localhost:3001'; 
    private $plagiarism_url = 'http://localhost:8080';
    private $websocket_url = 'ws://localhost:3003';
    
    public function call_backend_api($method, $endpoint, $data = null) {
        return $this->make_api_call($this->backend_url . $endpoint, $method, $data);
    }
    
    public function call_analytics_api($method, $endpoint, $data = null) {
        return $this->make_api_call($this->analytics_url . $endpoint, $method, $data);
    }
    
    public function call_plagiarism_api($method, $endpoint, $data = null) {
        return $this->make_api_call($this->plagiarism_url . $endpoint, $method, $data);
    }
    
    private function make_api_call($url, $method, $data) {
        $curl = curl_init();
        
        curl_setopt_array($curl, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->get_api_token()
            ]
        ]);
        
        if ($data) {
            curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($curl);
        curl_close($curl);
        
        return json_decode($response, true);
    }
}
```

This comprehensive API documentation shows how all 4 microservices work together and integrate with the Moodle plugin to provide a complete AI-powered proctoring solution. Each service has specific responsibilities and APIs that communicate seamlessly to deliver real-time monitoring, analysis, and reporting capabilities.