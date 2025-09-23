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
   ```bash
   # Face detection model
   wget -O ml_models/mediapipe/face_detection_short_range.tflite \
     https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite
   
   # Face landmark model
   wget -O ml_models/mediapipe/face_landmarker.task \
     https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
   ```

2. Download YOLO models:
   ```bash
   # YOLOv8 object detection
   wget -O ml_models/yolo/yolov8n.pt \
     https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt
   ```

Note: In development, mock models are used. Download actual models for production.
