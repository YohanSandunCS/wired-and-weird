"""
Face recognition using OpenCV (no dlib required - works on any Python version)
This uses OpenCV's built-in face detection + simple face embeddings
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, List
import cv2
import numpy as np
from PIL import Image
import io
import json
import os
from pathlib import Path

# Storage for enrolled users
STORAGE_FILE = Path(__file__).parent.parent / "enrolled_users_opencv.json"

class OpenCVFaceRecognizer:
    """Face recognition using OpenCV (no dlib dependency)"""
    
    def __init__(self):
        # Load OpenCV's pre-trained face detector (Haar Cascade)
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        
        # Initialize face recognizer (LBPH - Local Binary Patterns Histograms)
        self.recognizer = cv2.face.LBPHFaceRecognizer_create()
        self.enrolled_users = {}
        self.load_enrolled_users()
    
    def load_enrolled_users(self):
        """Load enrolled users from storage"""
        if STORAGE_FILE.exists():
            with open(STORAGE_FILE, 'r') as f:
                data = json.load(f)
                self.enrolled_users = data.get('users', {})
                print(f"[OPENCV] Loaded {len(self.enrolled_users)} enrolled user(s)")
        else:
            self.enrolled_users = {}
            print("[OPENCV] No enrolled users found")
    
    def save_enrolled_users(self):
        """Save enrolled users to storage"""
        STORAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(STORAGE_FILE, 'w') as f:
            json.dump({'users': self.enrolled_users}, f, indent=2)
        print(f"[OPENCV] Saved {len(self.enrolled_users)} enrolled user(s)")
    
    def detect_faces(self, image_array: np.ndarray) -> List[tuple]:
        """
        Detect faces in image using OpenCV Haar Cascade
        Returns list of (x, y, w, h) tuples
        """
        gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        return faces
    
    def extract_face_features(self, image_array: np.ndarray, face_rect: tuple) -> np.ndarray:
        """
        Extract face features using histogram comparison
        Returns feature vector for the face region
        """
        x, y, w, h = face_rect
        face_roi = image_array[y:y+h, x:x+w]
        
        # Convert to grayscale
        gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        
        # Resize to standard size (100x100)
        resized_face = cv2.resize(gray_face, (100, 100))
        
        # Compute histogram
        hist = cv2.calcHist([resized_face], [0], None, [256], [0, 256])
        hist = cv2.normalize(hist, hist).flatten()
        
        # Also compute LBP features
        lbp = self._compute_lbp(resized_face)
        
        # Combine histogram and LBP features
        features = np.concatenate([hist, lbp])
        
        return features
    
    def _compute_lbp(self, image: np.ndarray) -> np.ndarray:
        """Compute Local Binary Pattern features"""
        lbp_image = np.zeros_like(image)
        for i in range(1, image.shape[0] - 1):
            for j in range(1, image.shape[1] - 1):
                center = image[i, j]
                code = 0
                code |= (image[i-1, j-1] >= center) << 7
                code |= (image[i-1, j] >= center) << 6
                code |= (image[i-1, j+1] >= center) << 5
                code |= (image[i, j+1] >= center) << 4
                code |= (image[i+1, j+1] >= center) << 3
                code |= (image[i+1, j] >= center) << 2
                code |= (image[i+1, j-1] >= center) << 1
                code |= (image[i, j-1] >= center) << 0
                lbp_image[i, j] = code
        
        # Compute histogram of LBP image
        hist = cv2.calcHist([lbp_image], [0], None, [256], [0, 256])
        hist = cv2.normalize(hist, hist).flatten()
        return hist
    
    def compare_features(self, features1: np.ndarray, features2: np.ndarray) -> float:
        """
        Compare two feature vectors
        Returns similarity score (0-1, higher is more similar)
        """
        # Use cosine similarity
        similarity = np.dot(features1, features2) / (np.linalg.norm(features1) * np.linalg.norm(features2))
        return float(similarity)
    
    def enroll_user(self, username: str, image_bytes: bytes) -> Dict:
        """Enroll a new user with their face image"""
        print(f"[OPENCV ENROLL] Processing enrollment for user: {username}")
        
        # Convert bytes to numpy array
        image = Image.open(io.BytesIO(image_bytes))
        image_array = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Detect faces
        faces = self.detect_faces(image_array)
        
        if len(faces) == 0:
            print(f"[OPENCV ENROLL] ✗ No face detected")
            raise HTTPException(status_code=400, detail="No face detected in image")
        
        if len(faces) > 1:
            print(f"[OPENCV ENROLL] ✗ Multiple faces detected ({len(faces)})")
            raise HTTPException(status_code=400, detail="Multiple faces detected. Please ensure only one face is in the frame.")
        
        print(f"[OPENCV ENROLL] ✓ Detected 1 face")
        
        # Extract features from the first face
        face_rect = faces[0]
        features = self.extract_face_features(image_array, face_rect)
        
        # Store user
        self.enrolled_users[username] = {
            'features': features.tolist(),
            'face_rect': [int(x) for x in face_rect]
        }
        self.save_enrolled_users()
        
        print(f"[OPENCV ENROLL] ✓ User enrolled successfully")
        return {
            'success': True,
            'username': username,
            'message': 'Face enrolled successfully'
        }
    
    def verify_face(self, image_bytes: bytes) -> Dict:
        """Verify a face against enrolled users"""
        print(f"[OPENCV VERIFY] Processing verification")
        
        if not self.enrolled_users:
            print("[OPENCV VERIFY] ✗ No enrolled users")
            raise HTTPException(status_code=400, detail="No enrolled users. Please enroll first.")
        
        # Convert bytes to numpy array
        image = Image.open(io.BytesIO(image_bytes))
        image_array = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Detect faces
        faces = self.detect_faces(image_array)
        
        if len(faces) == 0:
            print("[OPENCV VERIFY] ✗ No face detected")
            raise HTTPException(status_code=400, detail="No face detected in image")
        
        print(f"[OPENCV VERIFY] ✓ Detected {len(faces)} face(s)")
        
        # Use first detected face
        face_rect = faces[0]
        features = self.extract_face_features(image_array, face_rect)
        
        # Compare with all enrolled users
        print(f"[OPENCV VERIFY] Comparing against {len(self.enrolled_users)} enrolled user(s)")
        
        best_match = None
        best_similarity = 0.0
        SIMILARITY_THRESHOLD = 0.75  # Adjust this threshold (0.7-0.85 recommended)
        
        for username, user_data in self.enrolled_users.items():
            stored_features = np.array(user_data['features'])
            similarity = self.compare_features(features, stored_features)
            confidence = int(similarity * 100)
            
            print(f"[OPENCV VERIFY] User: {username} | Similarity: {similarity:.2f} | Confidence: {confidence}%")
            
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = username
        
        if best_match and best_similarity >= SIMILARITY_THRESHOLD:
            print(f"[OPENCV VERIFY] ✓ Match found: {best_match} (similarity: {best_similarity:.2f})")
            return {
                'success': True,
                'username': best_match,
                'confidence': int(best_similarity * 100),
                'similarity': float(best_similarity)
            }
        else:
            print(f"[OPENCV VERIFY] ✗ No match found (best: {best_match} with {best_similarity:.2f})")
            raise HTTPException(status_code=401, detail="Face not recognized. Please try again or enroll first.")
    
    def delete_user(self, username: str) -> Dict:
        """Delete an enrolled user"""
        if username in self.enrolled_users:
            del self.enrolled_users[username]
            self.save_enrolled_users()
            print(f"[OPENCV] ✓ Deleted user: {username}")
            return {'success': True, 'message': f'User {username} deleted'}
        else:
            raise HTTPException(status_code=404, detail=f"User {username} not found")
    
    def get_all_users(self) -> List[str]:
        """Get list of all enrolled users"""
        return list(self.enrolled_users.keys())


# Initialize recognizer
recognizer = OpenCVFaceRecognizer()


def create_auth_router() -> APIRouter:
    """Create and configure the authentication router"""
    router = APIRouter(tags=["authentication"])
    
    @router.post("/enroll")
    async def enroll_face(
        username: str,
        image: UploadFile = File(...)
    ):
        """Enroll a new user with face image"""
        try:
            image_bytes = await image.read()
            result = recognizer.enroll_user(username, image_bytes)
            return result
        except HTTPException:
            raise
        except Exception as e:
            print(f"[OPENCV ENROLL] ✗ Error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Enrollment failed: {str(e)}")
    
    @router.post("/verify")
    async def verify_face(image: UploadFile = File(...)):
        """Verify face against enrolled users"""
        try:
            image_bytes = await image.read()
            result = recognizer.verify_face(image_bytes)
            return result
        except HTTPException:
            raise
        except Exception as e:
            print(f"[OPENCV VERIFY] ✗ Error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")
    
    @router.get("/users")
    async def list_users():
        """Get list of enrolled users"""
        users = recognizer.get_all_users()
        return {'users': users, 'count': len(users)}
    
    @router.delete("/users/{username}")
    async def delete_user(username: str):
        """Delete an enrolled user"""
        return recognizer.delete_user(username)
    
    @router.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {
            'status': 'ok',
            'mode': 'opencv',
            'enrolled_users': len(recognizer.get_all_users()),
            'python_version': '3.14+ compatible'
        }
    
    return router
