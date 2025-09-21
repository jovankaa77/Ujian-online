// Face Detection Utility using MediaPipe Face Detection
export class FaceDetectionService {
  private model: any = null;
  private isLoading = false;
  private isLoaded = false;

  async loadModel(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.isLoading) {
      // Wait for loading to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.isLoaded;
    }

    this.isLoading = true;
    
    try {
      // Load MediaPipe Face Detection
      const { FaceDetection } = await import('@mediapipe/face_detection');
      const { Camera } = await import('@mediapipe/camera_utils');
      
      this.model = new FaceDetection({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
        }
      });

      await new Promise((resolve, reject) => {
        this.model.setOptions({
          model: 'short',
          minDetectionConfidence: 0.5,
        });

        this.model.onResults(() => {
          resolve(true);
        });

        this.model.initialize().then(resolve).catch(reject);
      });

      this.isLoaded = true;
      console.log('✅ Face detection model loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to load face detection model:', error);
      this.isLoaded = false;
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  async detectFaces(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<number> {
    if (!this.isLoaded) {
      console.warn('Face detection model not loaded');
      return 0;
    }

    try {
      return new Promise((resolve) => {
        this.model.onResults((results: any) => {
          const faceCount = results.detections ? results.detections.length : 0;
          resolve(faceCount);
        });

        this.model.send({ image: imageElement });
      });
    } catch (error) {
      console.error('Error detecting faces:', error);
      return 0;
    }
  }

  isModelLoaded(): boolean {
    return this.isLoaded;
  }

  isModelLoading(): boolean {
    return this.isLoading;
  }
}

// Singleton instance
export const faceDetectionService = new FaceDetectionService();