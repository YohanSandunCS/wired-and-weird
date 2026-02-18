"""
Face Recognition Authentication Module for MediRunner Gateway.

This module provides face-based authentication by comparing uploaded images
against a pre-registered admin face encoding.
"""
import face_recognition
import numpy as np
from PIL import Image
from io import BytesIO
import base64
import os
from pathlib import Path
from typing import Optional, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


# Request/Response Models
class FaceLoginRequest(BaseModel):
    """Request model for face login."""
    image: str  # base64 encoded image


class FaceLoginResponse(BaseModel):
    """Response model for face login."""
    success: bool
    user: Optional[str] = None
    message: Optional[str] = None


# Face Recognition Configuration
FACE_MATCH_THRESHOLD = 0.55
ADMIN_IMAGE_FILENAME = "admin.jpg"


class FaceAuthenticator:
    """Handles face recognition authentication logic."""
    
    def __init__(self):
        """Initialize the face authenticator and load admin face encoding."""
        self.admin_encoding: Optional[np.ndarray] = None
        self._load_admin_face()
    
    def _load_admin_face(self) -> None:
        """
        Load the admin face image and generate its encoding.
        Looks for admin.jpg in the gateway root directory.
        """
        # Look for admin.jpg in gateway root (parent of app folder)
        gateway_root = Path(__file__).parent.parent
        admin_image_path = gateway_root / ADMIN_IMAGE_FILENAME
        
        if not admin_image_path.exists():
            print(f"WARNING: Admin face image not found at {admin_image_path}")
            print("Face login will not work until admin.jpg is added to the gateway folder.")
            return
        
        try:
            # Load the admin image
            admin_image = face_recognition.load_image_file(str(admin_image_path))
            
            # Get face encodings
            encodings = face_recognition.face_encodings(admin_image)
            
            if len(encodings) == 0:
                print(f"ERROR: No face detected in {ADMIN_IMAGE_FILENAME}")
                return
            
            if len(encodings) > 1:
                print(f"WARNING: Multiple faces detected in {ADMIN_IMAGE_FILENAME}, using the first one.")
            
            # Store the first face encoding
            self.admin_encoding = encodings[0]
            print(f"✓ Admin face encoding loaded successfully from {admin_image_path}")
            
        except Exception as e:
            print(f"ERROR: Failed to load admin face: {e}")
    
    def verify_face(self, base64_image: str) -> Tuple[bool, Optional[str]]:
        """
        Verify a face from a base64 encoded image.
        
        Args:
            base64_image: Base64 encoded image string
            
        Returns:
            Tuple of (success: bool, message: Optional[str])
        """
        # Check if admin encoding is loaded
        if self.admin_encoding is None:
            return False, "System not configured for face login"
        
        try:
            # Decode base64 image
            image_data = base64.b64decode(base64_image)
            image = Image.open(BytesIO(image_data))
            
            # Convert PIL image to numpy array for face_recognition
            image_array = np.array(image)
            
            # Detect faces in the uploaded image
            face_locations = face_recognition.face_locations(image_array)
            
            if len(face_locations) == 0:
                return False, "No face detected in image"
            
            if len(face_locations) > 1:
                return False, "Multiple faces detected. Please ensure only one person is in frame."
            
            # Get face encoding for the detected face
            face_encodings = face_recognition.face_encodings(image_array, face_locations)
            
            if len(face_encodings) == 0:
                return False, "Could not process face encoding"
            
            # Compare with admin encoding
            face_encoding = face_encodings[0]
            face_distance = face_recognition.face_distance([self.admin_encoding], face_encoding)[0]
            
            # Check if face matches (lower distance = better match)
            if face_distance <= FACE_MATCH_THRESHOLD:
                return True, "Face recognized successfully"
            else:
                return False, f"Face not recognized (confidence: {1 - face_distance:.2f})"
                
        except Exception as e:
            print(f"ERROR in face verification: {e}")
            return False, f"Error processing image: {str(e)}"


# Initialize the authenticator (singleton)
face_authenticator = FaceAuthenticator()


# Create FastAPI router
def create_auth_router() -> APIRouter:
    """Create and configure the authentication router."""
    
    router = APIRouter(tags=["authentication"])
    
    @router.post("/face-login", response_model=FaceLoginResponse)
    async def face_login(request: FaceLoginRequest) -> FaceLoginResponse:
        """
        Authenticate user via face recognition.
        
        Args:
            request: Contains base64 encoded image
            
        Returns:
            FaceLoginResponse with success status and user info
        """
        # Verify the face
        success, message = face_authenticator.verify_face(request.image)
        
        if success:
            return FaceLoginResponse(
                success=True,
                user="admin",
                message=message
            )
        else:
            return FaceLoginResponse(
                success=False,
                message=message
            )
    
    @router.get("/health")
    async def auth_health():
        """Check if authentication system is ready."""
        return {
            "status": "ready" if face_authenticator.admin_encoding is not None else "not_configured",
            "admin_face_loaded": face_authenticator.admin_encoding is not None
        }
    
    return router
