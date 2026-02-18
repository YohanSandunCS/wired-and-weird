"""
Simplified Face Authentication Module for MediRunner Gateway.

This is a demo version that works without face_recognition library.
Uses a simple pixel-based comparison for demo purposes.

For production, replace with full face_recognition implementation.
"""
from PIL import Image
from io import BytesIO
import base64
import os
import json
from pathlib import Path
from typing import Optional, Tuple, List, Dict

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


class EnrollUserRequest(BaseModel):
    """Request model for user enrollment."""
    user_id: str  # Unique identifier (e.g., email, employee ID)
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


# Configuration
ENROLLED_USERS_DIR = "enrolled_users"
USERS_INDEX_FILE = "users.json"
DEMO_MODE = True  # Set to False when face_recognition is available


class SimpleFaceAuthenticator:
    """Simplified face authenticator for demo purposes."""
    
    def __init__(self):
        """Initialize the authenticator."""
        self.gateway_root = Path(__file__).parent.parent
        self.enrolled_users_dir = self.gateway_root / ENROLLED_USERS_DIR
        self.users_index_path = self.enrolled_users_dir / USERS_INDEX_FILE
        self._setup_directories()
        self.enrolled_users = self._load_users_index()
    
    def _setup_directories(self) -> None:
        """Create enrolled users directory if it doesn't exist."""
        self.enrolled_users_dir.mkdir(exist_ok=True)
        print(f"✓ Enrolled users directory: {self.enrolled_users_dir}")
    
    def _load_users_index(self) -> Dict[str, Dict[str, str]]:
        """Load the users index from JSON file."""
        if self.users_index_path.exists():
            with open(self.users_index_path, 'r') as f:
                users = json.load(f)
                print(f"✓ Loaded {len(users)} enrolled users")
                return users
        return {}
    
    def _save_users_index(self) -> None:
        """Save the users index to JSON file."""
        with open(self.users_index_path, 'w') as f:
            json.dump(self.enrolled_users, f, indent=2)
    
    def get_enrolled_users(self) -> List[Dict[str, str]]:
        """Get list of all enrolled users."""
        return [
            {"user_id": user_id, "name": user_data["name"]}
            for user_id, user_data in self.enrolled_users.items()
        ]
    
    def is_user_enrolled(self, user_id: str) -> bool:
        """Check if a user is enrolled."""
        return user_id in self.enrolled_users
    
    def enroll_user(self, user_id: str, name: str, base64_image: str) -> Tuple[bool, Optional[str]]:
        """
        Enroll a new user with their face image.
        
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
                return False, f"User '{user_id}' is already enrolled. Use a different user ID."
            
            # Decode and validate image
            image_data = base64.b64decode(base64_image)
            image = Image.open(BytesIO(image_data))
            
            # Validate image dimensions
            if image.size[0] < 200 or image.size[1] < 200:
                return False, "Image too small. Please ensure face is clearly visible and well-lit."
            
            # Save image file
            image_filename = f"{user_id}.jpg"
            image_path = self.enrolled_users_dir / image_filename
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            image.save(image_path, 'JPEG', quality=90)
            
            # Add to users index
            self.enrolled_users[user_id] = {
                "name": name,
                "image_file": image_filename,
                "enrolled_at": str(Path(image_path).stat().st_mtime)
            }
            self._save_users_index()
            
            print(f"✓ User enrolled: {user_id} ({name})")
            return True, f"User '{name}' enrolled successfully!"
            
        except Exception as e:
            print(f"ERROR in user enrollment: {e}")
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
            # Check if user exists
            if user_id not in self.enrolled_users:
                return False, f"User '{user_id}' not found."
            
            user_name = self.enrolled_users[user_id]["name"]
            image_filename = self.enrolled_users[user_id]["image_file"]
            image_path = self.enrolled_users_dir / image_filename
            
            # Delete image file
            if image_path.exists():
                image_path.unlink()
            
            # Remove from users index
            del self.enrolled_users[user_id]
            self._save_users_index()
            
            print(f"✓ User deleted: {user_id} ({user_name})")
            return True, f"User '{user_name}' deleted successfully!"
            
        except Exception as e:
            print(f"ERROR deleting user: {e}")
            return False, f"Error deleting user: {str(e)}"
    
    def _compare_images(self, image1: Image.Image, image2: Image.Image) -> float:
        """
        Compare two images and return similarity score (0-100).
        Higher score means more similar.
        
        Uses multiple comparison methods for better accuracy:
        1. Histogram comparison (color distribution)
        2. Pixel-level comparison (structural similarity)
        """
        try:
            # Resize both images to same size for comparison
            size = (200, 200)
            img1_resized = image1.resize(size)
            img2_resized = image2.resize(size)
            
            # Convert to RGB
            if img1_resized.mode != 'RGB':
                img1_resized = img1_resized.convert('RGB')
            if img2_resized.mode != 'RGB':
                img2_resized = img2_resized.convert('RGB')
            
            # Method 1: Histogram comparison for color distribution (40% weight)
            hist1_r = img1_resized.histogram()[0:256]
            hist1_g = img1_resized.histogram()[256:512]
            hist1_b = img1_resized.histogram()[512:768]
            
            hist2_r = img2_resized.histogram()[0:256]
            hist2_g = img2_resized.histogram()[256:512]
            hist2_b = img2_resized.histogram()[512:768]
            
            def correlate(hist1, hist2):
                sum1 = sum(hist1)
                sum2 = sum(hist2)
                if sum1 == 0 or sum2 == 0:
                    return 0
                
                # Normalize histograms
                hist1_norm = [h / sum1 for h in hist1]
                hist2_norm = [h / sum2 for h in hist2]
                
                # Calculate correlation
                correlation = sum(h1 * h2 for h1, h2 in zip(hist1_norm, hist2_norm))
                return correlation
            
            corr_r = correlate(hist1_r, hist2_r)
            corr_g = correlate(hist1_g, hist2_g)
            corr_b = correlate(hist1_b, hist2_b)
            
            histogram_similarity = (corr_r + corr_g + corr_b) / 3.0
            
            # Method 2: Pixel-level comparison (60% weight)
            # Convert images to pixel arrays
            pixels1 = list(img1_resized.getdata())
            pixels2 = list(img2_resized.getdata())
            
            if len(pixels1) != len(pixels2):
                return 0.0
            
            # Calculate pixel differences
            total_pixels = len(pixels1)
            pixel_differences = 0
            
            for p1, p2 in zip(pixels1, pixels2):
                # Calculate Euclidean distance between RGB values
                r_diff = abs(p1[0] - p2[0])
                g_diff = abs(p1[1] - p2[1])
                b_diff = abs(p1[2] - p2[2])
                
                # Average difference for this pixel (0-255 scale)
                avg_diff = (r_diff + g_diff + b_diff) / 3.0
                pixel_differences += avg_diff
            
            # Average difference per pixel
            avg_pixel_diff = pixel_differences / total_pixels
            
            # Convert to similarity (0-1 scale)
            # If avg difference is 0, similarity is 1; if avg difference is 255, similarity is 0
            pixel_similarity = 1.0 - (avg_pixel_diff / 255.0)
            
            # Combine both methods with weights
            combined_similarity = (histogram_similarity * 0.4) + (pixel_similarity * 0.6)
            
            # Convert to 0-100 scale
            similarity = combined_similarity * 100
            
            return similarity
            
        except Exception as e:
            print(f"Error comparing images: {e}")
            return 0.0
    
    def verify_face(self, base64_image: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Verify face against enrolled users.
        
        In DEMO MODE:
        - Performs basic image comparison (histogram-based)
        - Requires minimum similarity threshold (40%)
        - Returns best matching user
        
        Args:
            base64_image: Base64 encoded image string
            
        Returns:
            Tuple of (success: bool, message: Optional[str], user_id: Optional[str])
        """
        try:
            # Check if any users are enrolled
            if not self.enrolled_users:
                return False, "No users enrolled. Please enroll first.", None
            
            # Decode base64 image
            image_data = base64.b64decode(base64_image)
            captured_image = Image.open(BytesIO(image_data))
            
            # Validate image
            if captured_image.size[0] < 100 or captured_image.size[1] < 100:
                return False, "Image too small. Please ensure face is clearly visible.", None
            
            # Convert to RGB if needed
            if captured_image.mode != 'RGB':
                captured_image = captured_image.convert('RGB')
            
            # In demo mode, perform basic image comparison
            if DEMO_MODE:
                # Simple validation: image should have reasonable dimensions
                width, height = captured_image.size
                
                if width < 200 or height < 200:
                    return False, "Image resolution too low. Move closer to camera.", None
                
                if width > 4000 or height > 4000:
                    return False, "Image resolution too high. This seems unusual.", None
                
                # Check if image has reasonable data (not completely black/white)
                pixels = list(captured_image.getdata())
                if not pixels:
                    return False, "Empty image data", None
                
                unique_colors = len(set(pixels[:100]))
                if unique_colors < 5:
                    return False, "Image appears to be blank or has no face visible", None
                
                # Compare against all enrolled users
                best_match_user_id = None
                best_similarity = 0.0
                
                print("\n--- Face Comparison Results ---")
                for user_id, user_data in self.enrolled_users.items():
                    # Load enrolled user's image
                    enrolled_image_path = self.enrolled_users_dir / user_data["image_file"]
                    
                    if not enrolled_image_path.exists():
                        print(f"⚠️  Enrolled image not found for {user_id}")
                        continue
                    
                    enrolled_image = Image.open(enrolled_image_path)
                    
                    # Compare images
                    similarity = self._compare_images(captured_image, enrolled_image)
                    print(f"   {user_data['name']} ({user_id}): {similarity:.2f}% match")
                    
                    if similarity > best_similarity:
                        best_similarity = similarity
                        best_match_user_id = user_id
                
                print(f"   Best match: {best_similarity:.2f}%")
                print("-------------------------------\n")
                
                # Require minimum 55% similarity for demo (improved algorithm needs higher threshold)
                SIMILARITY_THRESHOLD = 55.0
                
                if best_similarity >= SIMILARITY_THRESHOLD and best_match_user_id:
                    user_name = self.enrolled_users[best_match_user_id]["name"]
                    return True, f"Welcome {user_name}! (Match: {best_similarity:.1f}%)", best_match_user_id
                else:
                    return False, f"Face not recognized. Best match was {best_similarity:.1f}% (need {SIMILARITY_THRESHOLD}%). Please enroll or try again with better lighting and position.", None
            
            # If not in demo mode, this shouldn't be called
            return False, "Face recognition library not available", None
                
        except Exception as e:
            print(f"ERROR in face verification: {e}")
            return False, f"Error processing image: {str(e)}", None


# Initialize the authenticator (singleton)
face_authenticator = SimpleFaceAuthenticator()


# Create FastAPI router
def create_auth_router() -> APIRouter:
    """Create and configure the authentication router."""
    
    router = APIRouter(tags=["authentication"])
    
    @router.post("/enroll", response_model=EnrollUserResponse)
    async def enroll_user(request: EnrollUserRequest) -> EnrollUserResponse:
        """
        Enroll a new user with face recognition.
        
        Args:
            request: Contains user_id, name, and base64 encoded image
            
        Returns:
            EnrollUserResponse with success status and message
        """
        success, message = face_authenticator.enroll_user(
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
        success, message = face_authenticator.delete_user(user_id)
        
        return {
            "success": success,
            "message": message
        }
    
    @router.get("/users", response_model=UserListResponse)
    async def list_users() -> UserListResponse:
        """Get list of all enrolled users."""
        users = face_authenticator.get_enrolled_users()
        return UserListResponse(users=users)
    
    @router.get("/users/{user_id}")
    async def check_user(user_id: str):
        """Check if a specific user is enrolled."""
        is_enrolled = face_authenticator.is_user_enrolled(user_id)
        return {
            "user_id": user_id,
            "enrolled": is_enrolled
        }
    
    @router.post("/face-login", response_model=FaceLoginResponse)
    async def face_login(request: FaceLoginRequest) -> FaceLoginResponse:
        """
        Authenticate user via face recognition.
        
        DEMO MODE: Performs basic image validation only.
        
        Args:
            request: Contains base64 encoded image
            
        Returns:
            FaceLoginResponse with success status and user info
        """
        # Verify the face
        success, message, user_id = face_authenticator.verify_face(request.image)
        
        if success:
            user_name = face_authenticator.enrolled_users[user_id]["name"] if user_id else "Unknown"
            return FaceLoginResponse(
                success=True,
                user=user_name,
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
        enrolled_count = len(face_authenticator.enrolled_users)
        return {
            "status": "ready" if DEMO_MODE else "not_configured",
            "demo_mode": DEMO_MODE,
            "enrolled_users_count": enrolled_count,
            "enrolled_users": face_authenticator.get_enrolled_users(),
            "message": f"Using simplified authentication for demo. {enrolled_count} users enrolled." if DEMO_MODE else "Full face recognition available"
        }
    
    return router
