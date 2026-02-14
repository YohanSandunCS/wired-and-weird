# mjpeg_server.py
import cv2
import time
from flask import Flask, Response

VIDEO_PATH = "./assets/mock_camera_video.mp4"
FRAME_WIDTH = 320
FRAME_HEIGHT = 240
JPEG_QUALITY = 60
FRAME_INTERVAL_SEC = 0.1  # 10 FPS

app = Flask(__name__)

def open_video_capture():
    return cv2.VideoCapture(VIDEO_PATH)

def generate_frames():
    cap = open_video_capture()
    if not cap.isOpened():
        print("[ERROR] Failed to open video file:", VIDEO_PATH)
        # Keep connection alive, but no frames
        while True:
            time.sleep(1)
            yield b""
    
    print("[INFO] Video opened successfully")

    while True:
        ret, frame = cap.read()

        # Loop video
        if not ret:
            print("[INFO] End of video, looping back to start")
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        # Resize
        frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))

        # Encode JPEG
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
        success, encoded = cv2.imencode(".jpg", frame, encode_params)
        if not success:
            print("[WARN] Failed to JPEG-encode frame, skipping.")
            time.sleep(FRAME_INTERVAL_SEC)
            continue

        jpg_bytes = encoded.tobytes()

        # MJPEG chunk with proper Content-Length for browser compatibility
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n"
            b"Content-Length: " + str(len(jpg_bytes)).encode('ascii') + b"\r\n"
            b"\r\n" +
            jpg_bytes +
            b"\r\n"
        )

        time.sleep(FRAME_INTERVAL_SEC)



@app.route("/")
def index():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>MJPEG Stream Server</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .stream-container { margin: 20px 0; }
            img { border: 2px solid #333; max-width: 100%; }
            .info { background: #f0f0f0; padding: 10px; border-radius: 5px; }
        </style>
    </head>
    <body>
        <h1>MJPEG Stream Server</h1>
        
        <div class="info">
            <p><strong>Network Stream URL:</strong> http://192.168.1.184:5001/stream</p>
            <p><strong>Local Stream URL:</strong> http://127.0.0.1:5001/stream</p>
            <p><strong>Test Frame:</strong> <a href="/test_frame" target="_blank">Single Frame</a></p>
        </div>
        
        <div class="stream-container">
            <h2>Live Video Stream:</h2>
            <img id="videoStream" src="/stream" width="320" height="240" alt="Video Stream" />
        </div>
        
        <div class="stream-container">
            <h2>Test Frame:</h2>
            <img src="/test_frame" width="320" height="240" alt="Test Frame" />
        </div>
        
        <script>
            // Reload stream image if it fails to load
            document.getElementById('videoStream').onerror = function() {
                console.log('Stream error, attempting reload...');
                setTimeout(() => {
                    this.src = '/stream?' + new Date().getTime();
                }, 1000);
            };
        </script>
    </body>
    </html>
    '''

@app.route("/test_frame")
def test_frame():
    """Serve a single test frame to verify video encoding"""
    cap = open_video_capture()
    if not cap.isOpened():
        return "Error: Could not open video file", 500
    
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        return "Error: Could not read frame", 500
    
    # Resize and encode
    frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))
    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
    success, encoded = cv2.imencode(".jpg", frame, encode_params)
    
    if not success:
        return "Error: Could not encode frame", 500
    
    return Response(encoded.tobytes(), mimetype='image/jpeg')

@app.route("/stream")
def stream():
    from flask import request
    
    # Capture request info before starting the generator
    client_ip = request.remote_addr
    user_agent = request.headers.get('User-Agent', 'Unknown')
    print(f"[INFO] Stream accessed from {client_ip} - User-Agent: {user_agent}")
    
    def generate_with_logging():
        frame_count = 0
        for frame_data in generate_frames():
            frame_count += 1
            if frame_count % 50 == 0:  # Log every 50 frames
                print(f"[DEBUG] Served {frame_count} frames to {client_ip}")
            yield frame_data
    
    response = Response(
        generate_with_logging(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )
    # Add headers for better browser compatibility
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Connection'] = 'close'
    return response

if __name__ == "__main__":
    print("[INFO] Starting MJPEG Server...")
    print(f"[INFO] Video file: {VIDEO_PATH}")
    print(f"[INFO] Local URL: http://127.0.0.1:5001/stream")
    print(f"[INFO] Network URL: http://192.168.1.184:5001/stream")
    print(f"[INFO] Frame rate: {1/FRAME_INTERVAL_SEC:.1f} FPS")
    print("[INFO] Press Ctrl+C to stop the server")
    
    try:
        app.run(host="0.0.0.0", port=5001, threaded=True, debug=False)
    except KeyboardInterrupt:
        print("\n[INFO] Server stopped by user")
    except Exception as e:
        print(f"[ERROR] Server error: {e}")
        input("Press Enter to exit...")
