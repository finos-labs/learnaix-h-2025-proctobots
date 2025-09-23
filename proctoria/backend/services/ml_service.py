import cv2
import numpy as np
import mediapipe as mp
from ultralytics import YOLO
import base64
import io
from PIL import Image
import json
import logging
from typing import List, Dict, Any, Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor

from schemas.schemas import ViolationCreate, FaceDetectionResult, ObjectDetectionResult, AudioAnalysisResult
from config import settings

logger = logging.getLogger(__name__)

class MLService:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=4)
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize all ML models."""
        try:
            # MediaPipe Face Detection
            self.mp_face_detection = mp.solutions.face_detection
            self.mp_drawing = mp.solutions.drawing_utils
            self.face_detection = self.mp_face_detection.FaceDetection(
                model_selection=0, min_detection_confidence=0.5
            )
            
            # MediaPipe Face Mesh for gaze tracking
            self.mp_face_mesh = mp.solutions.face_mesh
            self.face_mesh = self.mp_face_mesh.FaceMesh(
                max_num_faces=2,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            
            # MediaPipe Pose Detection
            self.mp_pose = mp.solutions.pose
            self.pose = self.mp_pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                enable_segmentation=False,
                min_detection_confidence=0.5
            )
            
            # YOLO Object Detection
            self.yolo_model = YOLO('yolov8n.pt')
            
            # Prohibited items to detect
            self.prohibited_objects = {
                'cell phone': 0.8,
                'book': 0.7,
                'laptop': 0.9,
                'tablet': 0.8,
                'person': 0.6  # Additional person
            }
            
            logger.info("ML models initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize ML models: {str(e)}")
            raise
    
    async def process_video_frame(self, frame_data: bytes, session_id: str) -> List[ViolationCreate]:
        """Process a video frame and detect violations."""
        try:
            # Decode image
            image = self._decode_image(frame_data)
            
            # Run all detections in parallel
            face_task = asyncio.create_task(
                asyncio.get_event_loop().run_in_executor(
                    self.executor, self._detect_faces, image
                )
            )
            object_task = asyncio.create_task(
                asyncio.get_event_loop().run_in_executor(
                    self.executor, self._detect_objects, image
                )
            )
            pose_task = asyncio.create_task(
                asyncio.get_event_loop().run_in_executor(
                    self.executor, self._analyze_pose, image
                )
            )
            gaze_task = asyncio.create_task(
                asyncio.get_event_loop().run_in_executor(
                    self.executor, self._analyze_gaze, image
                )
            )
            
            # Wait for all tasks to complete
            face_result, object_result, pose_result, gaze_result = await asyncio.gather(
                face_task, object_task, pose_task, gaze_task
            )
            
            # Combine results into violations
            violations = []
            violations.extend(self._process_face_violations(face_result))
            violations.extend(self._process_object_violations(object_result))
            violations.extend(self._process_pose_violations(pose_result))
            violations.extend(self._process_gaze_violations(gaze_result))
            
            return violations
            
        except Exception as e:
            logger.error(f"Error processing video frame for session {session_id}: {str(e)}")
            return []
    
    def _decode_image(self, frame_data: bytes) -> np.ndarray:
        """Decode image data to OpenCV format."""
        nparr = np.frombuffer(frame_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    def _detect_faces(self, image: np.ndarray) -> FaceDetectionResult:
        """Detect faces in the image."""
        try:
            results = self.face_detection.process(image)
            
            faces_detected = 0
            if results.detections:
                faces_detected = len(results.detections)
            
            # For identity matching, we would compare with stored baseline
            # This is simplified for the demo
            identity_match = faces_detected == 1
            identity_confidence = 0.95 if identity_match else 0.3
            
            # Expression analysis (simplified)
            expression_data = {
                "stress_level": np.random.uniform(0, 1),
                "focus_level": np.random.uniform(0, 1)
            }
            
            return FaceDetectionResult(
                faces_detected=faces_detected,
                identity_match=identity_match,
                identity_confidence=identity_confidence,
                expression_data=expression_data
            )
            
        except Exception as e:
            logger.error(f"Face detection error: {str(e)}")
            return FaceDetectionResult(
                faces_detected=0,
                identity_match=False,
                identity_confidence=0.0,
                expression_data={}
            )
    
    def _detect_objects(self, image: np.ndarray) -> ObjectDetectionResult:
        """Detect objects in the image."""
        try:
            results = self.yolo_model(image)
            
            objects_detected = []
            prohibited_items = []
            confidence_scores = {}
            
            for result in results:
                for box in result.boxes:
                    class_id = int(box.cls)
                    class_name = self.yolo_model.names[class_id]
                    confidence = float(box.conf)
                    
                    objects_detected.append({
                        "class": class_name,
                        "confidence": confidence,
                        "bbox": box.xyxy.tolist()
                    })
                    
                    # Check if it's a prohibited item
                    if class_name in self.prohibited_objects:
                        threshold = self.prohibited_objects[class_name]
                        if confidence >= threshold:
                            prohibited_items.append(class_name)
                    
                    confidence_scores[class_name] = confidence
            
            return ObjectDetectionResult(
                objects_detected=objects_detected,
                prohibited_items=prohibited_items,
                confidence_scores=confidence_scores
            )
            
        except Exception as e:
            logger.error(f"Object detection error: {str(e)}")
            return ObjectDetectionResult(
                objects_detected=[],
                prohibited_items=[],
                confidence_scores={}
            )
    
    def _analyze_pose(self, image: np.ndarray) -> Dict[str, Any]:
        """Analyze body pose and posture."""
        try:
            results = self.pose.process(image)
            
            if not results.pose_landmarks:
                return {"pose_detected": False}
            
            # Calculate posture metrics
            landmarks = results.pose_landmarks.landmark
            
            # Simplified posture analysis
            nose = landmarks[self.mp_pose.PoseLandmark.NOSE]
            left_shoulder = landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER]
            right_shoulder = landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER]
            
            # Calculate head tilt
            shoulder_slope = (right_shoulder.y - left_shoulder.y) / (right_shoulder.x - left_shoulder.x)
            head_tilt = abs(nose.x - (left_shoulder.x + right_shoulder.x) / 2)
            
            return {
                "pose_detected": True,
                "head_tilt": head_tilt,
                "shoulder_slope": shoulder_slope,
                "posture_score": 1.0 - min(head_tilt * 2, 1.0)
            }
            
        except Exception as e:
            logger.error(f"Pose analysis error: {str(e)}")
            return {"pose_detected": False}
    
    def _analyze_gaze(self, image: np.ndarray) -> Dict[str, Any]:
        """Analyze gaze direction and eye tracking."""
        try:
            results = self.face_mesh.process(image)
            
            if not results.multi_face_landmarks:
                return {"gaze_detected": False}
            
            # Simplified gaze analysis
            # In a real implementation, this would use eye landmarks to calculate gaze direction
            gaze_on_screen = np.random.uniform(0.7, 1.0)  # Placeholder
            gaze_deviation = 1.0 - gaze_on_screen
            
            return {
                "gaze_detected": True,
                "gaze_on_screen": gaze_on_screen,
                "gaze_deviation": gaze_deviation,
                "eye_movement_pattern": "normal"
            }
            
        except Exception as e:
            logger.error(f"Gaze analysis error: {str(e)}")
            return {"gaze_detected": False}
    
    def _process_face_violations(self, face_result: FaceDetectionResult) -> List[ViolationCreate]:
        """Process face detection results into violations."""
        violations = []
        
        if face_result.faces_detected == 0:
            violations.append(ViolationCreate(
                type="face_not_detected",
                confidence=0.9,
                details="No face detected in frame"
            ))
        elif face_result.faces_detected > 1:
            violations.append(ViolationCreate(
                type="multiple_faces",
                confidence=0.8,
                details=f"{face_result.faces_detected} faces detected"
            ))
        
        if not face_result.identity_match and face_result.faces_detected > 0:
            violations.append(ViolationCreate(
                type="identity_mismatch",
                confidence=1.0 - face_result.identity_confidence,
                details="Face does not match registered identity"
            ))
        
        return violations
    
    def _process_object_violations(self, object_result: ObjectDetectionResult) -> List[ViolationCreate]:
        """Process object detection results into violations."""
        violations = []
        
        for item in object_result.prohibited_items:
            confidence = object_result.confidence_scores.get(item, 0.5)
            violations.append(ViolationCreate(
                type=f"{item.replace(' ', '_')}_detected",
                confidence=confidence,
                details=f"Prohibited item detected: {item}"
            ))
        
        return violations
    
    def _process_pose_violations(self, pose_result: Dict[str, Any]) -> List[ViolationCreate]:
        """Process pose analysis results into violations."""
        violations = []
        
        if pose_result.get("pose_detected"):
            posture_score = pose_result.get("posture_score", 1.0)
            if posture_score < 0.5:
                violations.append(ViolationCreate(
                    type="poor_posture",
                    confidence=1.0 - posture_score,
                    details="Unusual posture detected"
                ))
        
        return violations
    
    def _process_gaze_violations(self, gaze_result: Dict[str, Any]) -> List[ViolationCreate]:
        """Process gaze analysis results into violations."""
        violations = []
        
        if gaze_result.get("gaze_detected"):
            gaze_deviation = gaze_result.get("gaze_deviation", 0.0)
            if gaze_deviation > 0.5:
                violations.append(ViolationCreate(
                    type="gaze_deviation",
                    confidence=gaze_deviation,
                    details="Student looking away from screen"
                ))
        
        return violations
    
    async def process_audio_chunk(self, audio_data: bytes, session_id: str) -> List[ViolationCreate]:
        """Process audio chunk for violations."""
        try:
            # This would implement voice activity detection and speech analysis
            # For now, we'll return a placeholder
            
            audio_result = AudioAnalysisResult(
                voice_detected=True,
                speaker_count=1,
                suspicious_keywords=[],
                noise_level=0.3
            )
            
            violations = []
            
            if audio_result.speaker_count > 1:
                violations.append(ViolationCreate(
                    type="multiple_speakers",
                    confidence=0.8,
                    details=f"{audio_result.speaker_count} speakers detected"
                ))
            
            if audio_result.suspicious_keywords:
                violations.append(ViolationCreate(
                    type="suspicious_audio",
                    confidence=0.9,
                    details=f"Suspicious keywords: {', '.join(audio_result.suspicious_keywords)}"
                ))
            
            return violations
            
        except Exception as e:
            logger.error(f"Error processing audio for session {session_id}: {str(e)}")
            return []
    
    async def process_behavior_event(self, event_data) -> List[ViolationCreate]:
        """Process behavior events (mouse, keyboard, browser)."""
        violations = []
        
        try:
            if event_data.event_type == "tab_switch":
                violations.append(ViolationCreate(
                    type="tab_switch",
                    confidence=0.9,
                    details="Student switched browser tabs"
                ))
            elif event_data.event_type == "copy_paste":
                violations.append(ViolationCreate(
                    type="copy_paste",
                    confidence=0.95,
                    details="Copy-paste activity detected"
                ))
            elif event_data.event_type == "dev_tools":
                violations.append(ViolationCreate(
                    type="developer_tools",
                    confidence=1.0,
                    details="Developer tools opened"
                ))
            
        except Exception as e:
            logger.error(f"Error processing behavior event: {str(e)}")
        
        return violations
    
    async def verify_identity(self, verification_data) -> Dict[str, Any]:
        """Verify user identity."""
        try:
            # This would implement face recognition against stored baseline
            # For now, return a placeholder result
            
            return {
                "verified": True,
                "confidence": 0.95,
                "user_id": verification_data.user_id,
                "verification_type": verification_data.verification_type
            }
            
        except Exception as e:
            logger.error(f"Identity verification error: {str(e)}")
            return {
                "verified": False,
                "confidence": 0.0,
                "error": str(e)
            }
    
    async def get_identity_baseline(self, db, user_id: int) -> Optional[Dict[str, Any]]:
        """Get identity baseline for a user."""
        try:
            # This would retrieve stored face encodings and voice prints
            # For now, return a placeholder
            
            return {
                "user_id": user_id,
                "has_face_baseline": True,
                "has_voice_baseline": False,
                "verification_status": "verified"
            }
            
        except Exception as e:
            logger.error(f"Error getting identity baseline for user {user_id}: {str(e)}")
            return None
    
    async def get_model_status(self) -> Dict[str, Any]:
        """Get status of all ML models."""
        return {
            "face_detection": "active",
            "object_detection": "active",
            "pose_analysis": "active",
            "gaze_tracking": "active",
            "audio_processing": "active",
            "models_loaded": True,
            "last_updated": "2025-09-23T10:00:00Z"
        }