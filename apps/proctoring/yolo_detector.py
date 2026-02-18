"""
YOLO-based object detection for exam proctoring.
Detects persons and mobile phones using YOLOv8.

Cost-effective replacement for Gemini API-based detection.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from io import BytesIO
from typing import List, Tuple

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# COCO class IDs for relevant objects
# Ref: COCO 2017 label set used by YOLOv8 pretrained models
PERSON_CLASS_ID = 0
LAPTOP_CLASS_ID = 63
CELL_PHONE_CLASS_ID = 67
BOOK_CLASS_ID = 73

# Configurable thresholds
CONFIDENCE_THRESHOLD = 0.5
PERSON_CONFIDENCE_THRESHOLD = 0.6
PHONE_CONFIDENCE_THRESHOLD = 0.4  # Lower threshold for phones (often harder to detect)
LAPTOP_CONFIDENCE_THRESHOLD = 0.4
BOOK_CONFIDENCE_THRESHOLD = 0.35


@dataclass
class DetectionResult:
    """Single detection result from YOLO."""
    class_id: int
    class_name: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2


@dataclass
class YOLOAnalysisResult:
    """Complete YOLO analysis result for a webcam frame."""
    person_count: int
    phone_detected: bool
    phone_count: int
    laptop_detected: bool
    laptop_count: int
    book_detected: bool
    book_count: int
    all_detections: List[DetectionResult] = field(default_factory=list)
    error: str | None = None
    
    @property
    def has_multiple_persons(self) -> bool:
        """Check if more than one person is detected."""
        return self.person_count > 1
    
    @property
    def has_violations(self) -> bool:
        """Check if any proctoring violations detected."""
        return (
            self.has_multiple_persons
            or self.phone_detected
            or self.laptop_detected
            or self.book_detected
        )


class YOLODetector:
    """
    Singleton YOLO detector for exam proctoring.
    
    Uses YOLOv8n (nano) for fast inference with minimal memory footprint.
    Model is loaded once and reused for all detection requests.
    """
    
    _instance: "YOLODetector" = None
    _model = None
    _model_loaded: bool = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def _load_model(self):
        """Load YOLOv8n model. Downloads weights on first use (~6MB)."""
        if self._model_loaded:
            return
            
        try:
            from ultralytics import YOLO
            
            logger.info("Loading YOLOv8n model for proctoring...")
            self._model = YOLO("yolov8n.pt")
            self._model_loaded = True
            logger.info("YOLOv8n model loaded successfully")
            
        except ImportError:
            logger.error("ultralytics not installed. Run: pip install ultralytics")
            self._model = None
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            self._model = None
    
    def ensure_model_loaded(self):
        """Ensure model is loaded before inference."""
        if not self._model_loaded:
            self._load_model()
    
    def analyze_frame(self, image_data: bytes) -> YOLOAnalysisResult:
        """
        Analyze a webcam frame for persons and mobile phones.
        
        Args:
            image_data: Raw image bytes (JPEG/PNG)
            
        Returns:
            YOLOAnalysisResult with detection counts and details
        """
        self.ensure_model_loaded()
        
        if self._model is None:
            return YOLOAnalysisResult(
                person_count=1,  # Safe default
                phone_detected=False,
                phone_count=0,
                laptop_detected=False,
                laptop_count=0,
                book_detected=False,
                book_count=0,
                all_detections=[],
                error="YOLO model not loaded"
            )
        
        try:
            # Convert bytes to numpy array via PIL
            image = Image.open(BytesIO(image_data))
            if image.mode != 'RGB':
                image = image.convert('RGB')
            image_np = np.array(image)
            
            # Run YOLO inference
            # Only detect relevant classes to keep inference fast.
            results = self._model(
                image_np,
                conf=CONFIDENCE_THRESHOLD,
                classes=[
                    PERSON_CLASS_ID,
                    LAPTOP_CLASS_ID,
                    CELL_PHONE_CLASS_ID,
                    BOOK_CLASS_ID,
                ],
                verbose=False
            )
            
            # Parse detection results
            detections = []
            person_count = 0
            phone_count = 0
            laptop_count = 0
            book_count = 0
            
            if results and len(results) > 0:
                boxes = results[0].boxes
                
                for box in boxes:
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    bbox = tuple(map(int, box.xyxy[0].tolist()))
                    class_name = self._model.names[class_id]
                    
                    detection = DetectionResult(
                        class_id=class_id,
                        class_name=class_name,
                        confidence=confidence,
                        bbox=bbox
                    )
                    detections.append(detection)
                    
                    # Count based on class with appropriate thresholds
                    if class_id == PERSON_CLASS_ID and confidence >= PERSON_CONFIDENCE_THRESHOLD:
                        person_count += 1
                    elif class_id == CELL_PHONE_CLASS_ID and confidence >= PHONE_CONFIDENCE_THRESHOLD:
                        phone_count += 1
                    elif class_id == LAPTOP_CLASS_ID and confidence >= LAPTOP_CONFIDENCE_THRESHOLD:
                        laptop_count += 1
                    elif class_id == BOOK_CLASS_ID and confidence >= BOOK_CONFIDENCE_THRESHOLD:
                        book_count += 1
            
            logger.info(
                "YOLO detected: %s person(s), %s phone(s), %s laptop(s), %s book(s), raw detections: %s",
                person_count,
                phone_count,
                laptop_count,
                book_count,
                len(detections),
            )
            
            return YOLOAnalysisResult(
                person_count=person_count,
                phone_detected=phone_count > 0,
                phone_count=phone_count,
                laptop_detected=laptop_count > 0,
                laptop_count=laptop_count,
                book_detected=book_count > 0,
                book_count=book_count,
                all_detections=detections
            )
            
        except Exception as e:
            logger.error(f"YOLO analysis failed: {e}")
            return YOLOAnalysisResult(
                person_count=1,  # Safe default - assume single person
                phone_detected=False,
                phone_count=0,
                laptop_detected=False,
                laptop_count=0,
                book_detected=False,
                book_count=0,
                all_detections=[],
                error=str(e)
            )


# Module-level singleton accessor
_detector_instance: YOLODetector | None = None


def get_detector() -> YOLODetector:
    """Get the singleton YOLO detector instance."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = YOLODetector()
    return _detector_instance


def analyze_frame_for_proctoring(image_data: bytes) -> YOLOAnalysisResult:
    """
    Convenience function for analyzing a webcam frame.
    
    Args:
        image_data: Raw image bytes from webcam
        
    Returns:
        YOLOAnalysisResult with person/phone detection results
    """
    return get_detector().analyze_frame(image_data)


def preload_model():
    """
    Pre-load the YOLO model.
    
    Call this during Django startup to avoid cold-start latency
    on the first proctoring request.
    """
    detector = get_detector()
    detector.ensure_model_loaded()
    return detector._model_loaded
