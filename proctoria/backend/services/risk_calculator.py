from sqlalchemy.orm import Session
from models.models import Violation, ProctoringSession
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class RiskCalculator:
    """Calculates risk scores based on violations and behavior patterns."""
    
    def __init__(self):
        # Violation weights for risk calculation
        self.violation_weights = {
            'face_not_detected': 0.8,
            'multiple_faces': 0.9,
            'identity_mismatch': 0.95,
            'cell_phone_detected': 0.7,
            'book_detected': 0.6,
            'laptop_detected': 0.9,
            'person_detected': 0.8,
            'poor_posture': 0.3,
            'gaze_deviation': 0.4,
            'tab_switch': 0.5,
            'copy_paste': 0.9,
            'developer_tools': 1.0,
            'multiple_speakers': 0.8,
            'suspicious_audio': 0.8,
        }
        
        # Time decay factor for violations
        self.time_decay_hours = 1.0  # Violations lose impact after 1 hour
    
    async def calculate_session_risk(self, db: Session, session_id: str) -> float:
        """Calculate current risk score for a session."""
        try:
            session = db.query(ProctoringSession).filter(
                ProctoringSession.session_id == session_id
            ).first()
            
            if not session:
                return 0.0
            
            violations = db.query(Violation).filter(
                Violation.session_id == session.id,
                Violation.resolved == False
            ).all()
            
            if not violations:
                return 0.0
            
            total_risk = 0.0
            current_time = datetime.utcnow()
            
            for violation in violations:
                # Get base weight for violation type
                base_weight = self.violation_weights.get(violation.type, 0.5)
                
                # Apply confidence multiplier
                confidence_multiplier = violation.confidence
                
                # Apply time decay
                time_diff = current_time - violation.timecreated
                time_decay = self._calculate_time_decay(time_diff)
                
                # Calculate violation risk contribution
                violation_risk = base_weight * confidence_multiplier * time_decay
                total_risk += violation_risk
            
            # Apply frequency penalty (more violations = higher risk)
            frequency_multiplier = min(1.0 + (len(violations) * 0.1), 2.0)
            total_risk *= frequency_multiplier
            
            # Normalize to 0-1 range
            final_risk = min(total_risk, 1.0)
            
            logger.debug(f"Calculated risk score {final_risk} for session {session_id}")
            return final_risk
            
        except Exception as e:
            logger.error(f"Failed to calculate risk score for session {session_id}: {str(e)}")
            return 0.0
    
    def _calculate_time_decay(self, time_diff: timedelta) -> float:
        """Calculate time decay factor for violations."""
        hours_elapsed = time_diff.total_seconds() / 3600
        if hours_elapsed >= self.time_decay_hours:
            return 0.1  # Minimum impact after decay period
        else:
            # Linear decay from 1.0 to 0.1
            return 1.0 - (0.9 * hours_elapsed / self.time_decay_hours)
    
    async def update_session_risk(self, db: Session, session_id: str):
        """Update stored risk score for a session."""
        try:
            session = db.query(ProctoringSession).filter(
                ProctoringSession.session_id == session_id
            ).first()
            
            if not session:
                return
            
            new_risk_score = await self.calculate_session_risk(db, session_id)
            session.risk_score = new_risk_score
            session.timemodified = datetime.utcnow()
            db.commit()
            
            logger.debug(f"Updated risk score to {new_risk_score} for session {session_id}")
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update risk score for session {session_id}: {str(e)}")
            raise
    
    async def recalculate_session_risk(self, db: Session, session_id: str) -> float:
        """Force recalculation of risk score."""
        await self.update_session_risk(db, session_id)
        return await self.calculate_session_risk(db, session_id)
    
    async def get_risk_trend(self, db: Session, session_id: str, hours: int = 24) -> dict:
        """Get risk trend over time for a session."""
        try:
            session = db.query(ProctoringSession).filter(
                ProctoringSession.session_id == session_id
            ).first()
            
            if not session:
                return {}
            
            # Get violations in time windows
            current_time = datetime.utcnow()
            time_window = timedelta(hours=hours)
            start_time = current_time - time_window
            
            violations = db.query(Violation).filter(
                Violation.session_id == session.id,
                Violation.timecreated >= start_time
            ).order_by(Violation.timecreated).all()
            
            # Calculate risk at different time points
            time_points = []
            risk_scores = []
            
            # Sample every 15 minutes
            sample_interval = timedelta(minutes=15)
            current_sample = start_time
            
            while current_sample <= current_time:
                # Calculate risk up to this point
                relevant_violations = [
                    v for v in violations 
                    if v.timecreated <= current_sample
                ]
                
                if relevant_violations:
                    risk = self._calculate_risk_for_violations(relevant_violations, current_sample)
                else:
                    risk = 0.0
                
                time_points.append(current_sample.isoformat())
                risk_scores.append(risk)
                current_sample += sample_interval
            
            return {
                "time_points": time_points,
                "risk_scores": risk_scores,
                "average_risk": sum(risk_scores) / len(risk_scores) if risk_scores else 0.0,
                "peak_risk": max(risk_scores) if risk_scores else 0.0,
                "trend": "increasing" if len(risk_scores) > 1 and risk_scores[-1] > risk_scores[0] else "stable"
            }
            
        except Exception as e:
            logger.error(f"Failed to get risk trend for session {session_id}: {str(e)}")
            return {}
    
    def _calculate_risk_for_violations(self, violations: list, assessment_time: datetime) -> float:
        """Calculate risk for a specific set of violations at a specific time."""
        total_risk = 0.0
        
        for violation in violations:
            base_weight = self.violation_weights.get(violation.type, 0.5)
            confidence_multiplier = violation.confidence
            
            # Calculate time decay from assessment time
            time_diff = assessment_time - violation.timecreated
            time_decay = self._calculate_time_decay(time_diff)
            
            violation_risk = base_weight * confidence_multiplier * time_decay
            total_risk += violation_risk
        
        # Apply frequency penalty
        frequency_multiplier = min(1.0 + (len(violations) * 0.1), 2.0)
        total_risk *= frequency_multiplier
        
        return min(total_risk, 1.0)
    
    async def get_high_risk_sessions(self, db: Session, threshold: float = 0.7) -> list:
        """Get sessions with risk scores above threshold."""
        try:
            sessions = db.query(ProctoringSession).filter(
                ProctoringSession.risk_score >= threshold,
                ProctoringSession.status == "active"
            ).order_by(ProctoringSession.risk_score.desc()).all()
            
            return [
                {
                    "session_id": s.session_id,
                    "user_id": s.user_id,
                    "quiz_id": s.quiz_id,
                    "risk_score": s.risk_score,
                    "violation_count": s.violation_count,
                    "time_started": s.timestarted.isoformat(),
                    "last_activity": s.timemodified.isoformat()
                }
                for s in sessions
            ]
            
        except Exception as e:
            logger.error(f"Failed to get high risk sessions: {str(e)}")
            return []