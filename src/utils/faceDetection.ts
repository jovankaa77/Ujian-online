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
      
      this.model = new FaceDetection({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
        }
      });

      // Configure the model
      this.model.setOptions({
        model: 'short', // Use short-range model for better performance
        minDetectionConfidence: 0.5,
      });

      // Wait for model to be ready
      await new Promise((resolve, reject) => {
        let isResolved = false;
        
        this.model.onResults((results: any) => {
          if (!isResolved) {
            isResolved = true;
            resolve(results);
          }
        });

        // Initialize the model
        this.model.initialize().then(() => {
          if (!isResolved) {
            isResolved = true;
            resolve(true);
          }
        }).catch(reject);

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            reject(new Error('Model loading timeout'));
          }
        }, 10000);
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
    if (!this.isLoaded || !this.model) {
      console.warn('Face detection model not loaded');
      return 0;
    }

    try {
      return new Promise((resolve) => {
        let isResolved = false;
        
        this.model.onResults((results: any) => {
          if (!isResolved) {
            isResolved = true;
            const faceCount = results.detections ? results.detections.length : 0;
            resolve(faceCount);
          }
        });

        this.model.send({ image: imageElement });

        // Timeout after 3 seconds
        setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            resolve(0);
          }
        }, 3000);
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