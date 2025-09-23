#!/bin/bash

# Proctoria Development Setup Script
# This script sets up the complete development environment

set -e

echo "🚀 Setting up Proctoria Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p backend/ml_models
    mkdir -p backend/uploads
    mkdir -p backend/logs
    mkdir -p analytics-service/logs
    mkdir -p plagiarism-service/temp
    mkdir -p plagiarism-service/reports
    mkdir -p plagiarism-service/logs
    mkdir -p websocket-service/logs
    mkdir -p nginx/logs
    mkdir -p nginx/ssl
    mkdir -p monitoring
    
    print_success "Directories created"
}

# Create environment files
create_env_files() {
    print_status "Creating environment files..."
    
    # Backend .env
    cat > backend/.env << EOF
DATABASE_URL=postgresql://proctoria:proctoria_pass_2024@localhost:5432/proctoria
REDIS_URL=redis://:redis_pass_2024@localhost:6379/0
JWT_SECRET=proctoria_jwt_secret_2024
LOG_LEVEL=info
ENVIRONMENT=development
API_VERSION=v1
WEBSOCKET_URL=http://localhost:3003
ANALYTICS_URL=http://localhost:3001
PLAGIARISM_URL=http://localhost:8080
EOF

    # Analytics .env
    cat > analytics-service/.env << EOF
DATABASE_URL=postgresql://proctoria:proctoria_pass_2024@localhost:5432/proctoria
REDIS_URL=redis://:redis_pass_2024@localhost:6379/1
JWT_SECRET=proctoria_jwt_secret_2024
LOG_LEVEL=info
ENVIRONMENT=development
BACKEND_URL=http://localhost:8000
EOF

    # WebSocket .env
    cat > websocket-service/.env << EOF
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_pass_2024
REDIS_DB=3
JWT_SECRET=proctoria_jwt_secret_2024
LOG_LEVEL=info
ENVIRONMENT=development
PROCTORING_API_URL=http://localhost:8000
ANALYTICS_API_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://learnaixproctoria.local
EOF

    # Plagiarism .env
    cat > plagiarism-service/.env << EOF
DATABASE_URL=postgresql://proctoria:proctoria_pass_2024@localhost:5432/proctoria
REDIS_URL=redis://:redis_pass_2024@localhost:6379/2
JWT_SECRET=proctoria_jwt_secret_2024
LOG_LEVEL=info
ENVIRONMENT=development
JPLAG_MEMORY=2g
EOF
    
    print_success "Environment files created"
}

# Download ML models
download_ml_models() {
    print_status "Setting up ML models..."
    
    # Create ML models directory structure
    mkdir -p backend/ml_models/mediapipe
    mkdir -p backend/ml_models/yolo
    mkdir -p backend/ml_models/face_detection
    
    # Create placeholder model files (in production, download actual models)
    cat > backend/ml_models/README.md << EOF
# ML Models Directory

This directory contains the machine learning models used by Proctoria:

## MediaPipe Models
- Face detection and landmark models
- Pose estimation models
- Hand tracking models

## YOLO Models
- Object detection models for identifying phones, books, laptops
- Custom trained models for exam environment monitoring

## Face Recognition Models
- Identity verification models
- Face matching and comparison models

## Setup Instructions

1. Download MediaPipe models:
   \`\`\`bash
   # Face detection model
   wget -O ml_models/mediapipe/face_detection_short_range.tflite \\
     https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite
   
   # Face landmark model
   wget -O ml_models/mediapipe/face_landmarker.task \\
     https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
   \`\`\`

2. Download YOLO models:
   \`\`\`bash
   # YOLOv8 object detection
   wget -O ml_models/yolo/yolov8n.pt \\
     https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt
   \`\`\`

Note: In development, mock models are used. Download actual models for production.
EOF
    
    print_success "ML models directory setup complete"
}

# Build services
build_services() {
    print_status "Building Docker services..."
    
    # Build all services
    docker-compose build --parallel
    
    print_success "Docker services built successfully"
}

# Start services
start_services() {
    print_status "Starting services..."
    
    # Start infrastructure services first
    docker-compose up -d postgres redis
    
    print_status "Waiting for database to be ready..."
    sleep 10
    
    # Start application services
    docker-compose up -d backend analytics plagiarism websocket
    
    print_status "Waiting for services to start..."
    sleep 15
    
    # Start nginx
    docker-compose up -d nginx
    
    print_success "All services started successfully"
}

# Check service health
check_health() {
    print_status "Checking service health..."
    
    # Wait a bit for services to fully start
    sleep 10
    
    # Check each service
    services=("postgres:5432" "redis:6379" "backend:8000" "analytics:3001" "plagiarism:8080" "websocket:3003")
    
    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"
        if docker-compose exec -T $name timeout 5 bash -c "echo > /dev/tcp/localhost/$port" 2>/dev/null; then
            print_success "$name service is healthy"
        else
            print_warning "$name service might not be ready yet"
        fi
    done
}

# Create test data
create_test_data() {
    print_status "Creating test data..."
    
    # Wait for backend to be ready
    sleep 5
    
    # Create a test user and session (this would typically be done through the API)
    docker-compose exec -T postgres psql -U proctoria -d proctoria << EOF
-- Insert test data
INSERT INTO proctoring_sessions (user_id, quiz_id, session_token, status) VALUES
(1, 1, 'test_session_token_123', 'active'),
(2, 1, 'test_session_token_456', 'completed'),
(3, 2, 'test_session_token_789', 'active');

-- Insert test violations
INSERT INTO violations (session_id, type, description, confidence, severity) 
SELECT id, 'face_not_detected', 'Test violation', 0.8, 'high' 
FROM proctoring_sessions LIMIT 1;
EOF
    
    print_success "Test data created"
}

# Display service URLs
display_urls() {
    print_success "🎉 Proctoria development environment is ready!"
    echo ""
    echo "Service URLs:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🌐 API Gateway:          http://localhost"
    echo "🔧 Backend API:          http://localhost:8000"
    echo "📊 Analytics API:        http://localhost:3001"
    echo "🔍 Plagiarism API:       http://localhost:8080"
    echo "🔌 WebSocket Service:    http://localhost:3003"
    echo "🗄️  PostgreSQL:          localhost:5432 (proctoria/proctoria_pass_2024)"
    echo "🔴 Redis:                localhost:6379"
    echo ""
    echo "API Documentation:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📚 Backend Docs:         http://localhost:8000/docs"
    echo "📈 Analytics Docs:       http://localhost:3001/docs"
    echo "🔍 Plagiarism Docs:      http://localhost:8080/swagger-ui.html"
    echo ""
    echo "Useful Commands:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 View logs:            docker-compose logs -f [service]"
    echo "🔄 Restart service:      docker-compose restart [service]"
    echo "🛑 Stop all services:    docker-compose down"
    echo "🗑️  Remove all data:      docker-compose down -v"
    echo "🔍 Service status:       docker-compose ps"
    echo ""
}

# Main setup function
main() {
    echo "🎯 Proctoria - AI-Powered Moodle Proctoring Plugin"
    echo "=================================================="
    echo ""
    
    check_docker
    create_directories
    create_env_files
    download_ml_models
    
    # Ask if user wants to build and start services
    read -p "Do you want to build and start all services now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        build_services
        start_services
        check_health
        create_test_data
        display_urls
    else
        print_status "Setup complete. Run 'docker-compose up -d' when ready to start services."
    fi
}

# Run main function
main "$@"