"""
Production Face Recognition Module for MediRunner Gateway.

Uses face_recognition library with 128-dimensional face encodings.
Provides real face detection, encoding extraction, and matching.

Requirements:
    - face_recognition
    - opencv-python  
    - numpy
    - pillow
"""
import face_recognition
import cv2
import numpy as np
from PIL import Image
from io import BytesIO
import base64
import json
from pathlib import Path
from typing import Optional, Tuple, List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class FaceLoginRequest(BaseModel):
    """Request model for face login."""
    image: str  # base64 encoded image


class FaceLoginResponse(BaseModel):
    """Response model for face login."""
    success: bool
    user: Optional[str] = None
    message: Optional[str] = None
    confidence: Optional[float] = None  # 0-100 confidence score


class EnrollUserRequest(BaseModel):
    """Request model for user enrollment."""
    user_id: str  # Unique identifier
    name: str  # Display name
    image: str  # base64 encoded face image


class EnrollUserResponse(BaseModel):
    """Response model for user enrollment."""
    success: bool
    user_id: Optional[str] = None
    message: Optional[str] = None


class UserListResponse(BaseModel):
    """Response model for listing enrolled users."""
    users: List[Dict[str, str]]


# ============================================================================
# CONFIGURATION
# ============================================================================

ENROLLED_USERS_FILE = "enrolled_users_encodings.json"
FACE_MATCH_THRESHOLD = 0.6  # Lower is more strict (face_recognition default)


# ============================================================================
# FACE RECOGNIZER CLASS
# ============================================================================

class ProductionFaceRecognizer:
    """
    Production-grade face recognition using face_recognition library.
    
    Features:
        - Face detection with dlib HOG or CNN detector
        - 128-dimensional face encoding extraction
        - Face matching using euclidean distance
        - JSON storage for encodings (no image files)
    """
    
    def __init__(self):
        """Initialize the face recognizer."""
        self.gateway_root = Path(__file__).parent.parent
        self.users_file_path = self.gateway_root / ENROLLED_USERS_FILE
        self.enrolled_users = self._load_users()
        
        print("=" * 60)
        print("🤖 Production Face Recognition System Initialized")
        print("=" * 60)
        print(f"✓ Using face_recognition library v{face_recognition.__version__}")
        print(f"✓ Using OpenCV v{cv2.__version__}")
        print(f"✓ Enrolled users file: {self.users_file_path}")
        print(f"✓ Loaded {len(self.enrolled_users)} enrolled users")
        print(f"✓ Face match threshold: {FACE_MATCH_THRESHOLD}")
        print("=" * 60)
    
    def _load_users(self) -> Dict[str, Dict]:
        """
        Load enrolled users from JSON file.
        
        Returns:
            Dict mapping user_id to user data (name and encoding)
        """
        if self.users_file_path.exists():
            with open(self.users_file_path, 'r') as f:
                users_data = json.load(f)
                # Convert encoding lists back to numpy arrays
                for user_id in users_data:
                    users_data[user_id]['encoding'] = np.array(
                        users_data[user_id]['encoding']
                    )
                return users_data
        return {}
    
    def _save_users(self) -> None:
        """Save enrolled users to JSON file."""
        # Convert numpy arrays to lists for JSON serialization
        users_data = {}
        for user_id, data in self.enrolled_users.items():
            users_data[user_id] = {
                'name': data['name'],
                'encoding': data['encoding'].tolist(),
                'enrolled_at': data.get('enrolled_at', '')
            }
        
        with open(self.users_file_path, 'w') as f:
            json.dump(users_data, f, indent=2)
    
    def get_enrolled_users(self) -> List[Dict[str, str]]:
        """Get list of all enrolled users (without encodings)."""
        return [
            {"user_id": user_id, "name": user_data["name"]}
            for user_id, user_data in self.enrolled_users.items()
        ]
    
    def is_user_enrolled(self, user_id: str) -> bool:
        """Check if a user is enrolled."""
        return user_id in self.enrolled_users
    
    def _decode_image(self, base64_image: str) -> np.ndarray:
        """
        Decode base64 image to numpy array in RGB format.
        
        Args:
            base64_image: Base64 encoded image string
            
        Returns:
            numpy array in RGB format (face_recognition uses RGB)
        """
        image_data = base64.b64decode(base64_image)
        image = Image.open(BytesIO(image_data))
        
        # Convert to RGB (face_recognition requires RGB)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert PIL Image to numpy array
        image_np = np.array(image)
        
        return image_np
    
    def detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detect faces in an image.
        
        Args:
            image: numpy array in RGB format
            
        Returns:
            List of face locations as (top, right, bottom, left) tuples
        """
        face_locations = face_recognition.face_locations(
            image,
            model="hog"  # Use "cnn" for better accuracy but slower (requires GPU)
        )
        return face_locations
    
    def extract_encoding(self, image: np.ndarray, face_location: Tuple = None) -> Optional[np.ndarray]:
        """
        Extract 128-dimensional face encoding from image.
        
        Args:
            image: numpy array in RGB format
            face_location: Optional pre-detected face location
            
        Returns:
            128-d numpy array encoding, or None if no face found
        """
        if face_location:
            # Use provided face location
            encodings = face_recognition.face_encodings(image, [face_location])
        else:
            # Detect face automatically
            encodings = face_recognition.face_encodings(image)
        
        if len(encodings) > 0:
            return encodings[0]
        return None
    
    def enroll_user(self, user_id: str, name: str, base64_image: str) -> Tuple[bool, Optional[str]]:
        """
        Enroll a new user with their face encoding.
        
        Args:
            user_id: Unique identifier for the user
            name: Display name
            base64_image: Base64 encoded face image
            
        Returns:
            Tuple of (success: bool, message: Optional[str])
        """
        try:
            # Check if user already enrolled
            if user_id in self.enrolled_users:
                return False, f"User '{user_id}' is already enrolled. Delete first to re-enroll."
            
            # Decode image
            image = self._decode_image(base64_image)
            
            # Detect faces
            face_locations = self.detect_faces(image)
            
            if len(face_locations) == 0:
                return False, "No face detected in image. Please ensure your face is clearly visible and well-lit."
            
            if len(face_locations) > 1:
                return False, f"Multiple faces detected ({len(face_locations)}). Please ensure only one face is in the frame."
            
            # Extract encoding for the detected face
            face_location = face_locations[0]
            encoding = self.extract_encoding(image, face_location)
            
            if encoding is None:
                return False, "Failed to extract face encoding. Please try again with better lighting."
            
            # Store user data with encoding
            from datetime import datetime
            self.enrolled_users[user_id] = {
                'name': name,
                'encoding': encoding,
                'enrolled_at': datetime.now().isoformat()
            }
            
            # Save to file
            self._save_users()
            
            print(f"✓ User enrolled: {user_id} ({name})")
            print(f"  - Face location: {face_location}")
            print(f"  - Encoding shape: {encoding.shape}")
            
            return True, f"User '{name}' enrolled successfully! Face encoding captured."
            
        except Exception as e:
            print(f"ERROR in enrollment: {e}")
            return False, f"Error enrolling user: {str(e)}"
    
    def delete_user(self, user_id: str) -> Tuple[bool, Optional[str]]:
        """
        Delete an enrolled user.
        
        Args:
            user_id: Unique identifier for the user to delete
            
        Returns:
            Tuple of (success: bool, message: Optional[str])
        """
        try:
            if user_id not in self.enrolled_users:
                return False, f"User '{user_id}' not found."
            
            user_name = self.enrolled_users[user_id]["name"]
            del self.enrolled_users[user_id]
            self._save_users()
            
            print(f"✓ User deleted: {user_id} ({user_name})")
            return True, f"User '{user_name}' deleted successfully!"
            
        except Exception as e:
            print(f"ERROR deleting user: {e}")
            return False, f"Error deleting user: {str(e)}"
    
    def verify_face(self, base64_image: str) -> Tuple[bool, Optional[str], Optional[str], Optional[float]]:
        """
        Verify face against enrolled users using face embeddings.
        
        Args:
            base64_image: Base64 encoded image string
            
        Returns:
            Tuple of (success: bool, message: Optional[str], user_id: Optional[str], confidence: Optional[float])
        """
        try:
            # Check if any users enrolled
            if not self.enrolled_users:
                return False, "No users enrolled. Please enroll first.", None, None
            
            # Decode image
            image = self._decode_image(base64_image)
            
            # Detect faces
            face_locations = self.detect_faces(image)
            
            if len(face_locations) == 0:
                return False, "No face detected in image. Please ensure your face is clearly visible.", None, None
            
            if len(face_locations) > 1:
                return False, f"Multiple faces detected ({len(face_locations)}). Please ensure only one face is in the frame.", None, None
            
            # Extract encoding from captured image
            face_location = face_locations[0]
            captured_encoding = self.extract_encoding(image, face_location)
            
            if captured_encoding is None:
                return False, "Failed to extract face encoding. Please try again.", None, None
            
            # Compare against all enrolled users
            best_match_user_id = None
            best_distance = float('inf')
            
            print("\n" + "=" * 60)
            print("🔍 Face Verification Results")
            print("=" * 60)
            
            enrolled_encodings = []
            user_ids_list = []
            
            for user_id, user_data in self.enrolled_users.items():
                enrolled_encodings.append(user_data['encoding'])
                user_ids_list.append(user_id)
            
            # Compute face distances (Euclidean distance in 128-d space)
            face_distances = face_recognition.face_distance(
                enrolled_encodings,
                captured_encoding
            )
            
            # Find best match
            for i, (user_id, distance) in enumerate(zip(user_ids_list, face_distances)):
                user_name = self.enrolled_users[user_id]['name']
                confidence = max(0, (1 - distance) * 100)  # Convert distance to confidence %
                
                print(f"   {user_name} ({user_id}):")
                print(f"      Distance: {distance:.4f}")
                print(f"      Confidence: {confidence:.1f}%")
                print(f"      Match: {'✓ YES' if distance < FACE_MATCH_THRESHOLD else '✗ NO'}")
                
                if distance < best_distance:
                    best_distance = distance
                    best_match_user_id = user_id
            
            print("=" * 60)
            print(f"🎯 Best Match: {best_distance:.4f}")
            print(f"🎚️  Threshold: {FACE_MATCH_THRESHOLD:.2f}")
            print("=" * 60 + "\n")
            
            # Check if best match meets threshold
            if best_distance < FACE_MATCH_THRESHOLD and best_match_user_id:
                user_name = self.enrolled_users[best_match_user_id]["name"]
                confidence = max(0, (1 - best_distance) * 100)
                
                return (
                    True,
                    f"Welcome {user_name}!",
                    best_match_user_id,
                    round(confidence, 1)
                )
            else:
                confidence = max(0, (1 - best_distance) * 100) if best_distance != float('inf') else 0
                return (
                    False,
                    f"Face not recognized. Best match confidence: {confidence:.1f}% (need >{(1-FACE_MATCH_THRESHOLD)*100:.0f}%). Please enroll or try again.",
                    None,
                    None
                )
                
        except Exception as e:
            print(f"ERROR in face verification: {e}")
            import traceback
            traceback.print_exc()
            return False, f"Error processing image: {str(e)}", None, None


# Initialize the face recognizer (singleton)
face_recognizer = ProductionFaceRecognizer()


# ============================================================================
# FASTAPI ROUTER
# ============================================================================

def create_auth_router() -> APIRouter:
    """Create and configure the authentication router."""
    
    router = APIRouter(tags=["authentication"])
    
    @router.post("/enroll", response_model=EnrollUserResponse)
    async def enroll_user(request: EnrollUserRequest) -> EnrollUserResponse:
        """
        Enroll a new user with face recognition.
        
        Detects face in image, extracts 128-d encoding, and stores it.
        
        Args:
            request: Contains user_id, name, and base64 encoded image
            
        Returns:
            EnrollUserResponse with success status and message
        """
        success, message = face_recognizer.enroll_user(
            request.user_id,
            request.name,
            request.image
        )
        
        if success:
            return EnrollUserResponse(
                success=True,
                user_id=request.user_id,
                message=message
            )
        else:
            return EnrollUserResponse(
                success=False,
                message=message
            )
    
    @router.delete("/users/{user_id}")
    async def delete_user(user_id: str):
        """
        Delete an enrolled user.
        
        Args:
            user_id: User ID to delete
            
        Returns:
            Response with success status and message
        """
        success, message = face_recognizer.delete_user(user_id)
        
        return {
            "success": success,
            "message": message
        }
    
    @router.get("/users", response_model=UserListResponse)
    async def list_users() -> UserListResponse:
        """Get list of all enrolled users."""
        users = face_recognizer.get_enrolled_users()
        return UserListResponse(users=users)
    
    @router.get("/users/{user_id}")
    async def check_user(user_id: str):
        """Check if a specific user is enrolled."""
        is_enrolled = face_recognizer.is_user_enrolled(user_id)
        return {
            "user_id": user_id,
            "enrolled": is_enrolled
        }
    
    @router.post("/face-login", response_model=FaceLoginResponse)
    async def face_login(request: FaceLoginRequest) -> FaceLoginResponse:
        """
        Authenticate user via face recognition.
        
        Detects face, extracts encoding, and matches against enrolled users.
        
        Args:
            request: Contains base64 encoded image
            
        Returns:
            FaceLoginResponse with success status, user info, and confidence
        """
        success, message, user_id, confidence = face_recognizer.verify_face(request.image)
        
        if success:
            user_name = face_recognizer.enrolled_users[user_id]["name"] if user_id else "Unknown"
            return FaceLoginResponse(
                success=True,
                user=user_name,
                message=message,
                confidence=confidence
            )
        else:
            return FaceLoginResponse(
                success=False,
                message=message,
                confidence=confidence
            )
    
    @router.get("/health")
    async def auth_health():
        """Check if authentication system is ready."""
        enrolled_count = len(face_recognizer.enrolled_users)
        return {
            "status": "ready",
            "production_mode": True,
            "face_recognition_version": face_recognition.__version__,
            "opencv_version": cv2.__version__,
            "enrolled_users_count": enrolled_count,
            "enrolled_users": face_recognizer.get_enrolled_users(),
            "face_match_threshold": FACE_MATCH_THRESHOLD,
            "message": f"Production face recognition active. {enrolled_count} users enrolled."
        }
    
    return router
