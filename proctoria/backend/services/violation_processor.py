from sqlalchemy.orm import Session
from models.models import Violation, ProctoringSession
from schemas.schemas import ViolationCreate, ViolationResponse
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ViolationProcessor:
    """Processes and manages violations."""
    
    async def process_violation(self, db: Session, session_id: str, violation_data: ViolationCreate) -> Violation:
        """Process and store a violation."""
        try:
            # Get session
            session = db.query(ProctoringSession).filter(
                ProctoringSession.session_id == session_id
            ).first()
            
            if not session:
                raise Exception(f"Session {session_id} not found")
            
            # Create violation record
            db_violation = Violation(
                session_id=session.id,
                type=violation_data.type,
                confidence=violation_data.confidence,
                details=violation_data.details,
                screenshot_url=violation_data.screenshot_url,
                resolved=False,
                timecreated=datetime.utcnow()
            )
            
            db.add(db_violation)
            
            # Update session violation count
            session.violation_count += 1
            session.timemodified = datetime.utcnow()
            
            db.commit()
            db.refresh(db_violation)
            
            logger.info(f"Processed violation {violation_data.type} for session {session_id}")
            return db_violation
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to process violation for session {session_id}: {str(e)}")
            raise
    
    async def create_violation(self, db: Session, session_id: str, violation_data: ViolationCreate) -> Violation:
        """Manually create a violation."""
        return await self.process_violation(db, session_id, violation_data)
    
    async def get_session_violations(self, db: Session, session_id: str) -> list[ViolationResponse]:
        """Get all violations for a session."""
        try:
            session = db.query(ProctoringSession).filter(
                ProctoringSession.session_id == session_id
            ).first()
            
            if not session:
                return []
            
            violations = db.query(Violation).filter(
                Violation.session_id == session.id
            ).order_by(Violation.timecreated.desc()).all()
            
            return [
                ViolationResponse(
                    id=v.id,
                    type=v.type,
                    confidence=v.confidence,
                    details=v.details,
                    screenshot_url=v.screenshot_url,
                    resolved=v.resolved,
                    timecreated=v.timecreated
                )
                for v in violations
            ]
            
        except Exception as e:
            logger.error(f"Failed to get violations for session {session_id}: {str(e)}")
            return []
    
    async def update_violation_status(self, db: Session, violation_id: int, resolved: bool):
        """Update violation resolution status."""
        try:
            violation = db.query(Violation).filter(Violation.id == violation_id).first()
            if violation:
                violation.resolved = resolved
                db.commit()
                logger.info(f"Updated violation {violation_id} status to {'resolved' if resolved else 'unresolved'}")
            else:
                logger.warning(f"Violation {violation_id} not found")
                
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update violation {violation_id}: {str(e)}")
            raise
    
    async def get_violation_summary(self, db: Session, session_id: str) -> dict:
        """Get violation summary for a session."""
        try:
            session = db.query(ProctoringSession).filter(
                ProctoringSession.session_id == session_id
            ).first()
            
            if not session:
                return {}
            
            violations = db.query(Violation).filter(
                Violation.session_id == session.id
            ).all()
            
            # Count violations by type
            violation_counts = {}
            total_violations = len(violations)
            resolved_violations = sum(1 for v in violations if v.resolved)
            
            for violation in violations:
                violation_counts[violation.type] = violation_counts.get(violation.type, 0) + 1
            
            return {
                "total_violations": total_violations,
                "resolved_violations": resolved_violations,
                "unresolved_violations": total_violations - resolved_violations,
                "violation_types": violation_counts,
                "most_common_violation": max(violation_counts.keys(), key=violation_counts.get) if violation_counts else None
            }
            
        except Exception as e:
            logger.error(f"Failed to get violation summary for session {session_id}: {str(e)}")
            return {}