from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class ProctoringSession(Base):
    __tablename__ = "proctoring_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, nullable=False)
    quiz_id = Column(Integer, nullable=False)
    attempt_id = Column(Integer, nullable=False)
    status = Column(String(20), default="active")
    risk_score = Column(Float, default=0.0)
    violation_count = Column(Integer, default=0)
    timestarted = Column(DateTime(timezone=True), server_default=func.now())
    timeended = Column(DateTime(timezone=True), nullable=True)
    timecreated = Column(DateTime(timezone=True), server_default=func.now())
    timemodified = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    violations = relationship("Violation", back_populates="session")
    analytics = relationship("Analytics", back_populates="session")

class Violation(Base):
    __tablename__ = "violations"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("proctoring_sessions.id"), nullable=False)
    type = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    details = Column(Text, nullable=True)
    screenshot_url = Column(String(255), nullable=True)
    resolved = Column(Boolean, default=False)
    timecreated = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    session = relationship("ProctoringSession", back_populates="violations")

class Analytics(Base):
    __tablename__ = "analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("proctoring_sessions.id"), nullable=False)
    question_id = Column(Integer, nullable=True)
    metric_type = Column(String(50), nullable=False)
    metric_value = Column(Text, nullable=False)
    timecreated = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    session = relationship("ProctoringSession", back_populates="analytics")

class IdentityBaseline(Base):
    __tablename__ = "identity_baselines"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, nullable=False)
    face_encoding = Column(Text, nullable=True)
    voice_print = Column(Text, nullable=True)
    baseline_image_url = Column(String(255), nullable=True)
    verification_status = Column(String(20), default="pending")
    timecreated = Column(DateTime(timezone=True), server_default=func.now())
    timemodified = Column(DateTime(timezone=True), onupdate=func.now())

class PlagiarismReport(Base):
    __tablename__ = "plagiarism_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("proctoring_sessions.id"), nullable=False)
    question_id = Column(Integer, nullable=False)
    submission_hash = Column(String(64), nullable=False)
    similarity_score = Column(Float, nullable=False)
    matches_found = Column(Integer, default=0)
    report_url = Column(String(255), nullable=True)
    status = Column(String(20), default="pending")
    timecreated = Column(DateTime(timezone=True), server_default=func.now())
    timeprocessed = Column(DateTime(timezone=True), nullable=True)