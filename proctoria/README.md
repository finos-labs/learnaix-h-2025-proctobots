# Proctoria - AI-Powered Moodle Proctoring Plugin

Proctoria is a comprehensive AI-enabled Moodle proctoring plugin designed for secure online exam monitoring. It provides real-time behavior analysis, identity verification, secure browser environments, and detailed incident logging to ensure exam integrity with a seamless learner experience.

## 🎯 Features

### Core Proctoring Features
- **Real-time Face Detection**: Continuous monitoring using MediaPipe ML models
- **Identity Verification**: Biometric verification with confidence scoring
- **Object Detection**: YOLO-based detection of phones, books, and unauthorized materials
- **Behavior Analysis**: Mouse movements, keystroke patterns, focus tracking
- **Browser Security**: Tab switching detection, developer tools blocking
- **Audio Monitoring**: Suspicious audio activity detection
- **Screenshot Capture**: Automated and on-demand screenshot collection

### Advanced AI Capabilities
- **Risk Scoring**: Dynamic risk assessment based on violation patterns
- **Plagiarism Detection**: JPlag integration for code similarity analysis
- **Real-time Alerts**: Instant violation notifications with severity levels
- **Intervention System**: Admin dashboard for live monitoring and intervention
- **Analytics Dashboard**: Comprehensive reporting and trend analysis

### Integration Features
- **Moodle Plugin**: Seamless integration with Moodle quiz access rules
- **RESTful APIs**: Complete API suite for external integrations
- **WebSocket Support**: Real-time communication and monitoring
- **Microservices Architecture**: Scalable, containerized deployment
- **Multi-language Support**: Plagiarism detection for multiple programming languages

## 🏗️ Architecture

Proctoria follows a microservices architecture with the following components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Moodle LMS    │    │   Frontend UI   │    │   Admin Panel   │
│     Plugin      │    │   (React/Vue)   │    │   Dashboard     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     Nginx Gateway         │
                    │   (Load Balancer/Proxy)   │
                    └─────────┬─────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
    ┌──────▼──────┐  ┌────────▼────────┐  ┌─────▼─────┐
    │   Backend   │  │   WebSocket     │  │ Analytics │
    │   Service   │  │   Service       │  │ Service   │
    │ (FastAPI)   │  │ (Socket.io)     │  │ (Node.js) │
    └──────┬──────┘  └────────┬────────┘  └─────┬─────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Plagiarism      │
                    │   Service         │
                    │ (Java/JPlag)      │
                    └─────────┬─────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
    ┌──────▼──────┐  ┌────────▼────────┐  ┌─────▼─────┐
    │ PostgreSQL  │  │     Redis       │  │ ML Models │
    │ Database    │  │    Cache        │  │MediaPipe/ │
    │             │  │                 │  │   YOLO    │
    └─────────────┘  └─────────────────┘  └───────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for development)
- Python 3.11+ (for development)
- Java 17+ (for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd proctoria
   ```

2. **Run the setup script**
   ```bash
   ./setup-dev.sh
   ```

3. **Access the services**
   - API Gateway: http://localhost
   - Backend API: http://localhost:8000/docs
   - Analytics API: http://localhost:3001/docs
   - WebSocket Service: http://localhost:3003
   - Admin Dashboard: http://localhost:3000 (when frontend is deployed)

### Manual Setup

If you prefer manual setup:

```bash
# Create environment files
cp backend/.env.example backend/.env
cp analytics-service/.env.example analytics-service/.env
cp websocket-service/.env.example websocket-service/.env

# Start services
docker-compose up -d

# Check service health
docker-compose ps
```

## 📁 Project Structure

```
proctoria/
├── backend/                    # FastAPI ML processing service
│   ├── services/              # ML models and processors
│   ├── api/                   # REST API endpoints
│   ├── models/                # Database models
│   └── ml_models/             # AI model files
├── analytics-service/         # Node.js analytics and reporting
│   ├── src/controllers/       # API controllers
│   ├── src/services/          # Business logic
│   └── prisma/                # Database schema
├── plagiarism-service/        # Java Spring Boot JPlag integration
│   ├── src/main/java/         # Java source code
│   └── src/main/resources/    # Configuration files
├── websocket-service/         # Real-time communication
│   ├── src/handlers/          # WebSocket event handlers
│   ├── src/middleware/        # Authentication & validation
│   └── src/utils/             # Utilities and helpers
├── moodle-plugin/             # Moodle integration files
│   ├── classes/               # PHP classes
│   ├── db/                    # Database definitions
│   └── lang/                  # Language files
├── nginx/                     # Reverse proxy configuration
├── db/                        # Database initialization
└── docker-compose.yml        # Service orchestration
```

## 🔧 Configuration

### Environment Variables

#### Backend Service
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/proctoria
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=your_jwt_secret
ML_MODELS_PATH=/app/ml_models
UPLOAD_PATH=/app/uploads
```

#### Analytics Service
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/proctoria
REDIS_URL=redis://localhost:6379/1
BACKEND_URL=http://backend:8000
```

#### WebSocket Service
```env
REDIS_HOST=localhost
REDIS_PORT=6379
PROCTORING_API_URL=http://backend:8000
CORS_ORIGINS=http://localhost:3000
```

### Moodle Integration

1. **Install the plugin**
   ```bash
   cp -r moodle-plugin/ /path/to/moodle/mod/quiz/accessrule/proctoria/
   ```

2. **Configure in Moodle Admin**
   - Navigate to Site Administration → Plugins → Activity modules → Quiz
   - Configure Proctoria settings
   - Set API endpoints and authentication

3. **Enable for quizzes**
   - Edit quiz settings
   - Under "Extra restrictions on attempts"
   - Enable "Proctoria monitoring"

## 📊 API Documentation

### Backend API Endpoints

#### Authentication
- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/auth/verify` - Token verification
- `POST /api/v1/auth/refresh` - Token refresh

#### Session Management
- `POST /api/v1/sessions/start` - Start proctoring session
- `GET /api/v1/sessions/{session_id}` - Get session details
- `POST /api/v1/sessions/{session_id}/end` - End session
- `POST /api/v1/sessions/{session_id}/heartbeat` - Session heartbeat

#### ML Processing
- `POST /api/v1/ml/process-frame` - Process video frame
- `POST /api/v1/ml/detect-objects` - Object detection
- `POST /api/v1/ml/verify-identity` - Identity verification
- `POST /api/v1/ml/analyze-audio` - Audio analysis

#### Violations
- `GET /api/v1/violations/{session_id}` - Get session violations
- `POST /api/v1/violations/{session_id}` - Report violation
- `PUT /api/v1/violations/{violation_id}` - Update violation

### Analytics API Endpoints

#### Dashboard
- `GET /api/analytics/dashboard` - Dashboard metrics
- `GET /api/analytics/sessions/stats` - Session statistics
- `GET /api/analytics/violations/trends` - Violation trends

#### Reporting
- `GET /api/analytics/reports/session/{session_id}` - Session report
- `GET /api/analytics/reports/user/{user_id}` - User report
- `POST /api/analytics/reports/generate` - Generate custom report

### WebSocket Events

#### Student Events
- `join_session` - Join proctoring session
- `violation_detected` - ML violation detected
- `behavior_event` - User behavior event
- `help_request` - Emergency help request

#### Admin Events
- `monitor_session` - Start monitoring session
- `send_intervention` - Send intervention message
- `terminate_session` - Terminate student session
- `request_screenshot` - Request screenshot from student

## 🤖 ML Models & AI Features

### Face Detection & Recognition
- **MediaPipe Face Detection**: Real-time face detection and landmark tracking
- **Identity Verification**: Biometric comparison with confidence scoring
- **Multiple Face Detection**: Identifies unauthorized persons in frame

### Object Detection
- **YOLOv8 Integration**: Custom trained models for exam environment
- **Prohibited Items**: Phones, books, laptops, papers detection
- **Confidence Thresholds**: Configurable detection sensitivity

### Behavior Analysis
- **Gaze Tracking**: Eye movement and attention analysis
- **Posture Detection**: Unusual sitting positions or movements
- **Activity Patterns**: Mouse movements, keystroke analysis

### Audio Processing
- **Voice Activity Detection**: Identifies speech and conversations
- **Audio Anomaly Detection**: Unusual sounds or background noise
- **Real-time Processing**: Continuous audio stream analysis

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication with role-based access control
- Session-based security with token refresh mechanisms
- API key authentication for service-to-service communication

### Data Protection
- End-to-end encryption for sensitive data transmission
- Secure file storage with access controls
- GDPR-compliant data handling and retention policies

### Browser Security
- Lockdown browser functionality detection
- Developer tools blocking and detection
- Full-screen enforcement with exit detection

## 📈 Monitoring & Analytics

### Real-time Monitoring
- Live session dashboards with violation alerts
- Real-time risk scoring and assessment
- Admin intervention capabilities with chat support

### Comprehensive Reporting
- Session-level detailed reports with timeline analysis
- User behavior patterns and trends analysis
- Violation statistics and improvement recommendations

### Performance Metrics
- System performance monitoring with health checks
- API response times and error rate tracking
- Resource utilization and scalability metrics

## 🧪 Testing

### Unit Tests
```bash
# Backend tests
cd backend && python -m pytest tests/

# Analytics tests
cd analytics-service && npm test

# WebSocket tests
cd websocket-service && npm test
```

### Integration Tests
```bash
# Full system test
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Load Testing
```bash
# API load testing
cd tests && python load_test.py

# WebSocket stress testing
cd tests && node websocket_load_test.js
```

## 🚀 Deployment

### Production Deployment

1. **Configure environment**
   ```bash
   cp .env.production .env
   # Edit configuration for production
   ```

2. **Build and deploy**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Setup monitoring**
   ```bash
   docker-compose --profile monitoring up -d
   ```

### Kubernetes Deployment
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Verify deployment
kubectl get pods -n proctoria
```

### Cloud Deployment (AWS/GCP/Azure)
- Terraform scripts available in `infrastructure/` directory
- Auto-scaling configurations for high availability
- Load balancer and CDN setup for global distribution

## 🔧 Development

### Local Development Setup

1. **Backend development**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

2. **Analytics development**
   ```bash
   cd analytics-service
   npm install
   npm run dev
   ```

3. **WebSocket development**
   ```bash
   cd websocket-service
   npm install
   npm run dev
   ```

### Code Style & Linting
```bash
# Python
black backend/
flake8 backend/

# JavaScript/TypeScript
npm run lint
npm run format
```

### Database Migrations
```bash
# Create migration
cd analytics-service && npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy
```

## 📚 Documentation

- [API Documentation](docs/api.md) - Complete API reference
- [Architecture Guide](docs/architecture.md) - System design and components
- [Deployment Guide](docs/deployment.md) - Production deployment instructions
- [Development Guide](docs/development.md) - Local development setup
- [ML Models Guide](docs/ml-models.md) - AI models and configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-repo/proctoria/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/proctoria/discussions)
- **Email**: support@proctoria.dev

## 🙏 Acknowledgments

- [MediaPipe](https://mediapipe.dev/) for face detection models
- [YOLO](https://ultralytics.com/) for object detection capabilities
- [JPlag](https://github.com/jplag/JPlag) for plagiarism detection
- [Socket.io](https://socket.io/) for real-time communication
- [FastAPI](https://fastapi.tiangolo.com/) for high-performance API framework

---

**Proctoria** - Ensuring Academic Integrity with AI-Powered Proctoring 🎓🤖