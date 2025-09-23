import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    # Database
    database_url: str = Field(default="postgresql://postgres:password@localhost:5432/proctoria")
    redis_url: str = Field(default="redis://localhost:6379")
    
    # API Configuration
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8000)
    secret_key: str = Field(default="your-secret-key-change-in-production")
    algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=30)
    
    # ML Models
    model_path: str = Field(default="./models")
    face_detection_model: str = Field(default="mediapipe")
    object_detection_model: str = Field(default="yolov8n.pt")
    pose_detection_model: str = Field(default="mediapipe")
    
    # WebRTC Configuration
    websocket_url: str = Field(default="ws://localhost:8003")
    
    # External Services
    analytics_service_url: str = Field(default="http://localhost:8001")
    plagiarism_service_url: str = Field(default="http://localhost:8002")
    
    # Processing Settings
    max_concurrent_sessions: int = Field(default=1000)
    violation_confidence_threshold: float = Field(default=0.7)
    risk_calculation_interval: int = Field(default=30)  # seconds
    
    # Security
    cors_origins: list = Field(default=["http://localhost:3000", "https://your-moodle-domain.com"])
    
    # File Storage
    upload_dir: str = Field(default="./uploads")
    max_file_size: int = Field(default=10 * 1024 * 1024)  # 10MB

    model_config = {
        "env_file": ".env",
        "extra": "ignore"  # Allow extra fields without validation errors
    }

settings = Settings()