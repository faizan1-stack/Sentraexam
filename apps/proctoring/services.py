"""
Hybrid AI Detection Services for Exam Proctoring.

Uses YOLOv8 for cost-effective person/phone detection.
Optionally uses Gemini for gaze analysis and face verification.
"""
from __future__ import annotations

import io
import json
import logging
import time
from typing import TypedDict, Any
from collections import deque

import google.generativeai as genai
from django.conf import settings
from PIL import Image

# YOLO-based local detection (cost-effective)
from .yolo_detector import analyze_frame_for_proctoring, YOLOAnalysisResult

logger = logging.getLogger(__name__)

# Configure Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)
else:
    logger.warning("GEMINI_API_KEY not found in settings. AI features will fail.")

# Model configuration
GENERATION_CONFIG = {
    "temperature": 0.1,  # Low temperature for consistent JSON
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 1024,
    "response_mime_type": "application/json",
}

class GazeResult(TypedDict):
    direction: str  # "center", "left", "right", "up", "down"
    is_looking_away: bool
    yaw: float  # Estimated
    pitch: float # Estimated

class FaceVerificationResult(TypedDict):
    is_match: bool
    confidence: float
    message: str

class AnalysisResult(TypedDict):
    faces_detected: int
    objects_detected: list[str]
    prohibited_objects: list[str]
    gaze_result: GazeResult | None
    face_verification: FaceVerificationResult | None
    is_looking_away: bool
    confidence: float
    error: str | None

# Prohibited objects mapping
PROHIBITED_OBJECTS_MAP = {
    'phone': 'PHONE_DETECTED',
    'mobile': 'PHONE_DETECTED',
    'book': 'BOOK_DETECTED',
    'textbook': 'BOOK_DETECTED',
    'laptop': 'LAPTOP_DETECTED',
    'computer': 'LAPTOP_DETECTED',
    'tablet': 'LAPTOP_DETECTED',
    'notes': 'BOOK_DETECTED',
    # Keep model/UI enums stable: map unsupported types to a generic object violation.
    'headphones': 'OBJECT_DETECTED',
    'earbuds': 'OBJECT_DETECTED',
}

# Session-based temporal analyzers
_temporal_analyzers: dict[str, "TemporalAnalyzer"] = {}
# Per-process throttling to reduce cost (Gemini verification) and noise (duplicate violations).
_last_face_verification_ts: dict[str, float] = {}


def analyze_snapshot_with_gemini(
    image_data: bytes, 
    reference_image_data: bytes | None = None
) -> AnalysisResult:
    """
    Analyze a webcam snapshot using Gemini 1.5 Flash.
    Performs face detection, object detection, gaze analysis, and verification in one go.
    """
    try:
        model = genai.GenerativeModel(
            model_name=getattr(settings, "GEMINI_MODEL_NAME", "gemini-1.5-flash"),
            generation_config=GENERATION_CONFIG,
            system_instruction="""
            You are an AI Exam Proctor. Analyze the image(s) strictly for exam violations.
            Output JSON ONLY.
            
            Fields to extract:
            1. faces_detected (int): Number of faces visible.
            2. objects_detected (list[str]): List of visible objects (e.g., "mobile phone", "book", "laptop", "headphones"). Ignore furniture/clothing.
            3. gaze (dict): 
               - direction (str): "center", "left", "right", "up", "down", "closed".
               - is_looking_away (bool): true if looking away from screen/camera for >2 seconds.
               - yaw (float): estimated horizontal angle in degrees (-90 to 90). 0 = facing camera.
               - pitch (float): estimated vertical angle in degrees (-90 to 90). 0 = facing camera.
            4. face_verification (dict, optional): Only if 2 images provided. Compare first (current) vs second (reference).
               - is_match (bool): Is it the same person?
               - confidence (float): 0.0 to 1.0.
            
            Strictly ignore background objects like shelves, beds, etc. Focus on cheating tools.
            """
        )

        parts = []
        
        # Current snapshot (Image 1)
        image_part = {
            "mime_type": "image/jpeg",
            "data": image_data
        }
        parts.append(image_part)
        
        prompt = "Analyze this exam snapshot."

        # Reference image for verification (Image 2)
        if reference_image_data:
            reference_part = {
                "mime_type": "image/jpeg",
                "data": reference_image_data
            }
            parts.append(reference_part)
            prompt += " verify if the person in the first image matches the reference person in the second image."

        parts.append(prompt)

        # Call Gemini
        start_time = time.time()
        response = model.generate_content(parts)
        # response.resolve() # Ensure completion
        
        logger.info(f"Gemini analysis took {time.time() - start_time:.2f}s")
        
        if not response.text:
            raise ValueError("Empty response from Gemini")

        # Parse JSON
        result_json = json.loads(response.text)
        
        # Extract fields
        faces_detected = result_json.get("faces_detected", 0)
        objects = [obj.lower() for obj in result_json.get("objects_detected", [])]
        gaze_data = result_json.get("gaze", {})
        
        # Map prohibited objects
        prohibited = []
        for obj in objects:
            for keyword, violation_type in PROHIBITED_OBJECTS_MAP.items():
                if keyword in obj:
                    prohibited.append(keyword)
                    break
        
        # Gaze result
        direction = gaze_data.get("direction", "center")
        yaw = gaze_data.get("yaw")
        pitch = gaze_data.get("pitch")
        gaze_result: GazeResult = {
            "direction": direction,
            "is_looking_away": gaze_data.get("is_looking_away", False),
            "yaw": float(yaw) if yaw is not None else (30.0 if direction in ["left", "right"] else 0.0),
            "pitch": float(pitch) if pitch is not None else (20.0 if direction in ["up", "down"] else 0.0),
        }

        # Face verification result
        verification_data = result_json.get("face_verification")
        verification_result = None
        if verification_data:
            verification_result = {
                "is_match": verification_data.get("is_match", True),
                "confidence": verification_data.get("confidence", 0.0),
                "message": "Match" if verification_data.get("is_match") else "Identity Mismatch"
            }

        return {
            "faces_detected": faces_detected,
            "face_locations": [], # Not needed for pure logic
            "objects_detected": [{"class_name": o, "confidence": 0.9, "bbox": []} for o in objects],
            "prohibited_objects": prohibited,
            "gaze_result": gaze_result,
            "face_verification": verification_result,
            "is_looking_away": gaze_result["is_looking_away"],
            "confidence": 0.9, # High confidence from GenAI
            "error": None
        }

    except Exception as e:
        logger.error(f"Gemini analysis failed: {e}")
        return {
            "faces_detected": 1, # Default to safe assumption
            "face_locations": [],
            "objects_detected": [],
            "prohibited_objects": [],
            "gaze_result": None,
            "face_verification": None,
            "is_looking_away": False,
            "confidence": 0.0,
            "error": str(e)
        }


# =============================================================================
# TEMPORAL ANALYSIS (Kept from Phase 3)
# =============================================================================

class TemporalAnalyzer:
    """Tracks patterns across multiple snapshots."""
    
    def __init__(self, session_id: str, window_size: int = 10):
        self.session_id = session_id
        self.history = deque(maxlen=window_size)
    
    def add_result(self, analysis_result: AnalysisResult):
        self.history.append({
            **analysis_result,
            "timestamp": time.time(),
        })
    
    def detect_patterns(self) -> list[dict]:
        if len(self.history) < 3: return []
        
        violations = []
        history_list = list(self.history)
        
        # Pattern 1: Intermittent Face
        face_counts = [r.get("faces_detected", 0) for r in history_list]
        no_face_ratio = sum(1 for f in face_counts if f == 0) / len(face_counts)
        if no_face_ratio >= 0.3:
            violations.append({
                "type": "INTERMITTENT_FACE",
                "severity": 4,
                "details": {"message": "Face frequently disappears"}
            })
            
        # Pattern 2: Persistent Gaze Away
        gaze_results = [r.get("gaze_result") for r in history_list if r.get("gaze_result")]
        if gaze_results:
            def _is_away(g: dict) -> bool:
                try:
                    yaw = float(g.get("yaw") or 0.0)
                    pitch = float(g.get("pitch") or 0.0)
                except Exception:
                    yaw = 0.0
                    pitch = 0.0
                return bool(g.get("is_looking_away")) or abs(yaw) >= 35.0 or abs(pitch) >= 25.0

            away_ratio = sum(1 for g in gaze_results if _is_away(g)) / len(gaze_results)
            if away_ratio >= 0.5:
                violations.append({
                    "type": "PERSISTENT_GAZE_AWAY",
                    "severity": 4,
                    "details": {"message": "Consistently looking away"}
                })

        return violations

def get_temporal_analyzer(session_id: str, window_size: int = 10) -> TemporalAnalyzer:
    analyzer = _temporal_analyzers.get(session_id)
    if analyzer is None or analyzer.history.maxlen != window_size:
        analyzer = TemporalAnalyzer(session_id, window_size=window_size)
        _temporal_analyzers[session_id] = analyzer
    return analyzer

def clear_temporal_analyzer(session_id: str):
    if session_id in _temporal_analyzers:
        del _temporal_analyzers[session_id]
    _last_face_verification_ts.pop(session_id, None)

# =============================================================================
# CONFIDENCE SCORING (Simplified)
# =============================================================================

class ViolationConfidenceScorer:
    def __init__(self, temporal_analyzer=None):
        self.temporal = temporal_analyzer
        
    def score_violation(self, violation: dict, analysis_result: AnalysisResult) -> dict:
        # GenAI is usually high confidence
        return {
            "overall_confidence": 0.85,
            "breakdown": {"ai_confidence": 0.9, "temporal": 0.8},
            "is_reliable": True
        }

# =============================================================================
# HYBRID YOLO + GEMINI ANALYSIS
# =============================================================================

def analyze_snapshot_hybrid(
    image_data: bytes,
    reference_image_data: bytes | None = None,
    use_gemini_for_gaze: bool = False,
) -> AnalysisResult:
    """
    Hybrid analysis: YOLO for persons/phones (free), Gemini for gaze/verification (optional).
    
    Args:
        image_data: Current frame bytes
        reference_image_data: Optional reference face for verification
        use_gemini_for_gaze: Whether to use Gemini for gaze analysis
        
    Returns:
        AnalysisResult with combined detection results
    """
    # YOLO detection (fast, free, local)
    yolo_result = analyze_frame_for_proctoring(image_data)
    
    # Build prohibited objects list from YOLO
    prohibited = []
    objects_detected = []
    
    # Record prohibited objects from YOLO detections
    if yolo_result.phone_detected:
        prohibited.append("phone")
    if getattr(yolo_result, "laptop_detected", False):
        prohibited.append("laptop")
    if getattr(yolo_result, "book_detected", False):
        prohibited.append("book")

    for detection in yolo_result.all_detections:
        if detection.class_name in {"cell phone", "laptop", "book"}:
            objects_detected.append(
                {
                    "class_name": detection.class_name,
                    "confidence": detection.confidence,
                    "bbox": list(detection.bbox),
                }
            )
    
    # Initialize result with YOLO data
    result: AnalysisResult = {
        "faces_detected": yolo_result.person_count,  # person count as proxy for faces
        "face_locations": [],
        "objects_detected": objects_detected,
        "prohibited_objects": prohibited,
        "gaze_result": None,
        "face_verification": None,
        "is_looking_away": False,
        "confidence": 0.9,
        "error": yolo_result.error
    }
    
    # Use Gemini for gaze and/or verification when requested.
    # Important: gaze detection must work even without a reference image.
    if use_gemini_for_gaze or reference_image_data is not None:
        try:
            gemini_result = analyze_snapshot_with_gemini(
                image_data, 
                reference_image_data
            )
            # Merge gaze and verification from Gemini
            result["gaze_result"] = gemini_result.get("gaze_result")
            result["face_verification"] = gemini_result.get("face_verification")
            result["is_looking_away"] = gemini_result.get("is_looking_away", False)
        except Exception as e:
            logger.warning(f"Gemini gaze/verification fallback failed: {e}")
    
    return result


# =============================================================================
# MAIN ORCHESTRATOR
# =============================================================================

def analyze_snapshot(
    image_file, 
    session_id: str = None, 
    settings_config: dict = None,
    reference_image_file = None,
    use_yolo: bool = True
) -> dict:
    """
    Main entry point for snapshot analysis.
    
    Args:
        image_file: Uploaded image file
        session_id: Exam session ID for temporal analysis
        settings_config: Proctoring settings
        reference_image_file: Reference face image for verification
        use_yolo: If True, use YOLO (free). If False, use Gemini API.
    """
    # Read image bytes
    try:
        image_file.seek(0)
        image_bytes = image_file.read()
        
        reference_bytes = None
        if reference_image_file and settings_config and settings_config.get("require_face_verification"):
            # Throttle verification calls (Gemini cost + latency).
            interval_s = int(settings_config.get("face_verification_interval") or 0)
            now_ts = time.time()
            last_ts = _last_face_verification_ts.get(str(session_id or ""), 0.0)
            should_verify = interval_s <= 0 or (now_ts - last_ts) >= interval_s
            if should_verify:
                reference_image_file.seek(0)
                reference_bytes = reference_image_file.read()
                if session_id:
                    _last_face_verification_ts[str(session_id)] = now_ts
        
        # Choose analysis method
        if use_yolo:
            # Hybrid: YOLO for detection, optionally Gemini for gaze
            use_gemini_gaze = settings_config.get("detect_looking_away", False) if settings_config else False
            analysis = analyze_snapshot_hybrid(
                image_bytes, 
                reference_bytes,
                use_gemini_for_gaze=use_gemini_gaze
            )
        else:
            # Full Gemini analysis (legacy, more expensive)
            analysis = analyze_snapshot_with_gemini(image_bytes, reference_bytes)
        
        # Run temporal analysis
        patterns = []
        temporal_analyzer = None
        enable_temporal = bool(settings_config.get("enable_temporal_analysis", True)) if settings_config else True
        if enable_temporal and session_id:
            window_size = int(settings_config.get("temporal_window_size", 10)) if settings_config else 10
            temporal_analyzer = get_temporal_analyzer(session_id, window_size=window_size)
            temporal_analyzer.add_result(analysis)
            patterns = temporal_analyzer.detect_patterns()

        # Detect Violations based on Analysis
        violations = detect_violations(analysis, settings_config or {})
        
        # Add pattern violations
        for pattern in patterns:
            violations.append(pattern)
            
        # Score violations
        scorer = ViolationConfidenceScorer(temporal_analyzer)
        scored_violations = []
        for v in violations:
            score = scorer.score_violation(v, analysis)
            if score["is_reliable"]:
                v["confidence_score"] = score["overall_confidence"]
                v["confidence_breakdown"] = score["breakdown"]
                scored_violations.append(v)

        return {
            "analysis_result": analysis,
            "violations": scored_violations
        }
        
    except Exception as e:
        logger.error(f"Analysis orchestration failed: {e}")
        return {"error": str(e)}


def detect_violations(analysis: AnalysisResult, config: dict) -> list[dict]:
    """Convert analysis result into violations based on config."""
    violations = []
    
    logger.info(f"detect_violations: faces_detected={analysis['faces_detected']}, prohibited_objects={analysis['prohibited_objects']}")
    
    # 1. Face Detection
    if config.get("detect_no_face", True) and analysis["faces_detected"] == 0:
        violations.append({"type": "NO_FACE", "severity": 4, "details": {"message": "No face detected"}})
    if config.get("detect_multiple_faces", True) and analysis["faces_detected"] > 1:
        violations.append({"type": "MULTIPLE_FACES", "severity": 5, "details": {"message": "Multiple faces detected"}})
        
    # 2. Objects
    if config.get("detect_objects", True):
        for prohibited in analysis["prohibited_objects"]:
            violations.append({
                "type": PROHIBITED_OBJECTS_MAP.get(prohibited, "OBJECT_DETECTED"),
                "severity": 5,
                "details": {"object": prohibited},
            })
        
    # 3. Gaze / Head Pose (basic)
    if config.get("detect_looking_away", True):
        gaze = analysis.get("gaze_result")
        if gaze:
            yaw = float(gaze.get("yaw") or 0.0)
            pitch = float(gaze.get("pitch") or 0.0)
            # Use either the model's boolean OR a conservative angle threshold (basic head-pose heuristic).
            looks_away = bool(gaze.get("is_looking_away")) or abs(yaw) >= 35.0 or abs(pitch) >= 25.0
        else:
            looks_away = False

        if gaze and looks_away:
            violations.append(
                {
                    "type": "LOOKING_AWAY",
                    "severity": 2,
                    "details": {
                        "direction": gaze.get("direction", "unknown"),
                        "yaw": gaze.get("yaw", 0.0),
                        "pitch": gaze.get("pitch", 0.0),
                    },
                }
            )

    # 4. Face verification
    if config.get("require_face_verification", False):
        verification = analysis.get("face_verification")
        if verification and not verification.get("is_match", True):
            violations.append(
                {
                    "type": "FACE_NOT_MATCHED",
                    "severity": 5,
                    "details": {"confidence": verification.get("confidence", 0.0)},
                }
            )
        
    return violations
