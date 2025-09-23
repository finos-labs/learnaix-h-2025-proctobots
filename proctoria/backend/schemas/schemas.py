from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

# Session Schemas
class SessionCreate(BaseModel):
    user_id: int
    quiz_id: int
    attempt_id: int

class SessionResponse(BaseModel):
    session_id: str
    status: str
    message: str

class SessionStatus(BaseModel):
    session_id: str
    status: str
    risk_score: float
    violation_count: int
    time_started: datetime
    last_activity: datetime

# Violation Schemas
class ViolationCreate(BaseModel):
    type: str
    confidence: float
    details: Optional[str] = None
    screenshot_url: Optional[str] = None

class ViolationResponse(BaseModel):
    id: int
    type: str
    confidence: float
    details: Optional[str]
    screenshot_url: Optional[str]
    resolved: bool
    timecreated: datetime

class ViolationStatusUpdate(BaseModel):
    resolved: bool

# Behavior Event Schema
class BehaviorEvent(BaseModel):
    session_id: str
    event_type: str  # 'mouse', 'keyboard', 'browser', 'tab_switch', etc.
    event_data: Dict[str, Any]
    timestamp: datetime

# Identity Verification Schema
class IdentityVerification(BaseModel):
    user_id: int
    image_data: str  # base64 encoded image
    verification_type: str  # 'face', 'id_document'

class IdentityBaseline(BaseModel):
    user_id: int
    face_encoding: Optional[str]
    voice_print: Optional[str]
    verification_status: str

# Analytics Schemas
class AnalyticsMetric(BaseModel):
    session_id: str
    question_id: Optional[int]
    metric_type: str
    metric_value: str

# ML Processing Schemas
class MLProcessingResult(BaseModel):
    violations: List[ViolationCreate]
    confidence_scores: Dict[str, float]
    processed_timestamp: datetime

class FaceDetectionResult(BaseModel):
    faces_detected: int
    identity_match: bool
    identity_confidence: float
    expression_data: Dict[str, Any]

class ObjectDetectionResult(BaseModel):
    objects_detected: List[Dict[str, Any]]
    prohibited_items: List[str]
    confidence_scores: Dict[str, float]

class AudioAnalysisResult(BaseModel):
    voice_detected: bool
    speaker_count: int
    suspicious_keywords: List[str]
    noise_level: float

# Plagiarism Schemas
class PlagiarismSubmission(BaseModel):
    session_id: str
    question_id: int
    code_content: str
    language: str

class PlagiarismResult(BaseModel):
    similarity_score: float
    matches_found: int
    report_url: Optional[str]
    status: str