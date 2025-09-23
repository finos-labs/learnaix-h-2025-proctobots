from sqlalchemy.orm import Session
from models.models import ProctoringSession
from schemas.schemas import SessionCreate
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class SessionManager:
    """Manages proctoring sessions."""
    
    async def create_session(self, db: Session, session_data: SessionCreate) -> ProctoringSession:
        """Create a new proctoring session."""
        try:
            session_id = str(uuid.uuid4())
            
            db_session = ProctoringSession(
                session_id=session_id,
                user_id=session_data.user_id,
                quiz_id=session_data.quiz_id,
                attempt_id=session_data.attempt_id,
                status="active",
                risk_score=0.0,
                violation_count=0,
                timestarted=datetime.utcnow(),
                timecreated=datetime.utcnow(),
                timemodified=datetime.utcnow()
            )
            
            db.add(db_session)
            db.commit()
            db.refresh(db_session)
            
            logger.info(f"Created session {session_id} for user {session_data.user_id}")
            return db_session
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create session: {str(e)}")
            raise
    
    async def get_session(self, db: Session, session_id: str) -> ProctoringSession:
        """Get a session by ID."""
        return db.query(ProctoringSession).filter(
            ProctoringSession.session_id == session_id
        ).first()
    
    async def end_session(self, db: Session, session_id: str):
        """End a proctoring session."""
        try:
            session = await self.get_session(db, session_id)
            if session:
                session.status = "ended"
                session.timeended = datetime.utcnow()
                session.timemodified = datetime.utcnow()
                db.commit()
                logger.info(f"Ended session {session_id}")
            else:
                logger.warning(f"Session {session_id} not found")
                
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to end session {session_id}: {str(e)}")
            raise
    
    async def update_session_risk(self, db: Session, session_id: str, risk_score: float):
        """Update session risk score."""
        try:
            session = await self.get_session(db, session_id)
            if session:
                session.risk_score = risk_score
                session.timemodified = datetime.utcnow()
                db.commit()
                
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update risk score for session {session_id}: {str(e)}")
            raise
    
    async def increment_violation_count(self, db: Session, session_id: str):
        """Increment violation count for a session."""
        try:
            session = await self.get_session(db, session_id)
            if session:
                session.violation_count += 1
                session.timemodified = datetime.utcnow()
                db.commit()
                
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to increment violation count for session {session_id}: {str(e)}")
            raise