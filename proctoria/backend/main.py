from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uvicorn
import json
import asyncio
from typing import List, Optional, Dict, Any
import logging
from datetime import datetime
import uuid

from config import settings
from database import get_db, engine
from models import models
from schemas import schemas
from services.ml_service import MLService
from services.session_manager import SessionManager
from services.violation_processor import ViolationProcessor
from services.risk_calculator import RiskCalculator
from services.websocket_manager import WebSocketManager

# Create tables
models.Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Proctoria API",
    description="AI-Powered Proctoring Service for Moodle Integration",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
ml_service = MLService()
session_manager = SessionManager()
violation_processor = ViolationProcessor()
risk_calculator = RiskCalculator()
websocket_manager = WebSocketManager()

# Security
security = HTTPBearer()

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Session Management Endpoints
@app.post("/api/v1/sessions/start", response_model=schemas.SessionResponse)
async def start_session(
    session_data: schemas.SessionCreate,
    db: Session = Depends(get_db)
):
    """Start a new proctoring session."""
    try:
        session = await session_manager.create_session(db, session_data)
        return schemas.SessionResponse(
            session_id=session.session_id,
            status=session.status,
            message="Session started successfully"
        )
    except Exception as e:
        logger.error(f"Failed to start session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """End a proctoring session."""
    try:
        await session_manager.end_session(db, session_id)
        return {"message": "Session ended successfully"}
    except Exception as e:
        logger.error(f"Failed to end session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/sessions/{session_id}/status", response_model=schemas.SessionStatus)
async def get_session_status(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Get current session status and risk score."""
    try:
        session = await session_manager.get_session(db, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        risk_score = await risk_calculator.calculate_session_risk(db, session_id)
        
        return schemas.SessionStatus(
            session_id=session_id,
            status=session.status,
            risk_score=risk_score,
            violation_count=session.violation_count,
            time_started=session.timestarted,
            last_activity=session.timemodified
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session status {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ML Processing Endpoints
@app.post("/api/v1/process/video-frame")
async def process_video_frame(
    session_id: str,
    frame: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Process a video frame for violations."""
    try:
        # Validate session
        session = await session_manager.get_session(db, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Read frame data
        frame_data = await frame.read()
        
        # Process with ML models
        violations = await ml_service.process_video_frame(frame_data, session_id)
        
        # Store violations
        for violation in violations:
            await violation_processor.process_violation(db, session_id, violation)
        
        # Update risk score
        await risk_calculator.update_session_risk(db, session_id)
        
        return {"violations_detected": len(violations), "processed": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process video frame for session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/process/audio-chunk")
async def process_audio_chunk(
    session_id: str,
    audio: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Process an audio chunk for violations."""
    try:
        # Validate session
        session = await session_manager.get_session(db, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Read audio data
        audio_data = await audio.read()
        
        # Process with ML models
        violations = await ml_service.process_audio_chunk(audio_data, session_id)
        
        # Store violations
        for violation in violations:
            await violation_processor.process_violation(db, session_id, violation)
        
        return {"violations_detected": len(violations), "processed": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process audio chunk for session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/process/behavior-event")
async def process_behavior_event(
    event_data: schemas.BehaviorEvent,
    db: Session = Depends(get_db)
):
    """Process a behavior event (mouse, keyboard, browser)."""
    try:
        # Validate session
        session = await session_manager.get_session(db, event_data.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Process event
        violations = await ml_service.process_behavior_event(event_data)
        
        # Store violations
        for violation in violations:
            await violation_processor.process_violation(db, event_data.session_id, violation)
        
        return {"violations_detected": len(violations), "processed": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process behavior event: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Violation Management
@app.post("/api/v1/violations/{session_id}")
async def create_violation(
    session_id: str,
    violation_data: schemas.ViolationCreate,
    db: Session = Depends(get_db)
):
    """Manually create a violation."""
    try:
        violation = await violation_processor.create_violation(db, session_id, violation_data)
        return {"violation_id": violation.id, "created": True}
    except Exception as e:
        logger.error(f"Failed to create violation for session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/violations/{session_id}", response_model=List[schemas.ViolationResponse])
async def get_violations(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Get all violations for a session."""
    try:
        violations = await violation_processor.get_session_violations(db, session_id)
        return violations
    except Exception as e:
        logger.error(f"Failed to get violations for session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/v1/violations/{violation_id}/status")
async def update_violation_status(
    violation_id: int,
    status_data: schemas.ViolationStatusUpdate,
    db: Session = Depends(get_db)
):
    """Update violation status (resolve/unresolve)."""
    try:
        await violation_processor.update_violation_status(db, violation_id, status_data.resolved)
        return {"updated": True}
    except Exception as e:
        logger.error(f"Failed to update violation {violation_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Risk Scoring
@app.get("/api/v1/risk-score/{session_id}")
async def get_risk_score(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Get current risk score for a session."""
    try:
        risk_score = await risk_calculator.calculate_session_risk(db, session_id)
        return {"session_id": session_id, "risk_score": risk_score}
    except Exception as e:
        logger.error(f"Failed to get risk score for session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/risk-score/{session_id}/recalculate")
async def recalculate_risk_score(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Recalculate risk score for a session."""
    try:
        risk_score = await risk_calculator.recalculate_session_risk(db, session_id)
        return {"session_id": session_id, "risk_score": risk_score, "recalculated": True}
    except Exception as e:
        logger.error(f"Failed to recalculate risk score for session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Identity Verification
@app.post("/api/v1/identity/verify")
async def verify_identity(
    verification_data: schemas.IdentityVerification,
    db: Session = Depends(get_db)
):
    """Verify user identity for proctoring."""
    try:
        result = await ml_service.verify_identity(verification_data)
        return result
    except Exception as e:
        logger.error(f"Failed to verify identity: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/identity/baseline/{user_id}")
async def get_identity_baseline(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get identity baseline for a user."""
    try:
        baseline = await ml_service.get_identity_baseline(db, user_id)
        return baseline
    except Exception as e:
        logger.error(f"Failed to get identity baseline for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ML Model Status
@app.get("/api/v1/ml/models/status")
async def get_model_status():
    """Get status of all ML models."""
    try:
        status = await ml_service.get_model_status()
        return status
    except Exception as e:
        logger.error(f"Failed to get model status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket for real-time communication
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket_manager.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await websocket_manager.handle_message(session_id, message)
    except WebSocketDisconnect:
        websocket_manager.disconnect(session_id)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        log_level="info"
    )