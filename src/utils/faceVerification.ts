import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let modelsLoading = false;

const MODEL_URL = '/models';

export const loadFaceModels = async (): Promise<boolean> => {
  if (modelsLoaded) return true;
  if (modelsLoading) {
    while (modelsLoading) {
      await new Promise(r => setTimeout(r, 200));
    }
    return modelsLoaded;
  }

  modelsLoading = true;
  try {
    console.log('[FaceModels] Loading models from', MODEL_URL);

    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    console.log('[FaceModels] ssdMobilenetv1 loaded');

    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    console.log('[FaceModels] faceLandmark68Net loaded');

    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.log('[FaceModels] faceRecognitionNet loaded');

    modelsLoaded = true;
    console.log('[FaceModels] All models loaded successfully');
    return true;
  } catch (error) {
    console.error('[FaceModels] Failed to load face models:', error);
    return false;
  } finally {
    modelsLoading = false;
  }
};

export const areModelsLoaded = () => modelsLoaded;

const videoToCanvas = (video: HTMLVideoElement): HTMLCanvasElement | null => {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    console.log('[videoToCanvas] Video not ready:', {
      readyState: video.readyState,
      width: video.videoWidth,
      height: video.videoHeight,
    });
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export const detectSingleFace = async (
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
) => {
  try {
    let source: HTMLCanvasElement | HTMLImageElement = input as HTMLCanvasElement;

    if (input instanceof HTMLVideoElement) {
      const canvas = videoToCanvas(input);
      if (!canvas) {
        console.log('[detectSingleFace] Could not convert video to canvas');
        return null;
      }
      source = canvas;
    }

    const detection = await faceapi
      .detectSingleFace(source, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    console.log('[detectSingleFace] Detection result:', detection ? 'Face found' : 'No face');
    return detection || null;
  } catch (error) {
    console.error('[detectSingleFace] Error:', error);
    return null;
  }
};

export const detectAllFaces = async (
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
) => {
  try {
    let source: HTMLCanvasElement | HTMLImageElement = input as HTMLCanvasElement;

    if (input instanceof HTMLVideoElement) {
      const canvas = videoToCanvas(input);
      if (!canvas) {
        console.log('[detectAllFaces] Could not convert video to canvas');
        return [];
      }
      source = canvas;
    }

    console.log('[detectAllFaces] Running detection on', source instanceof HTMLCanvasElement ? `canvas ${source.width}x${source.height}` : 'image');

    const detections = await faceapi
      .detectAllFaces(source, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    console.log('[detectAllFaces] Found', detections.length, 'face(s)');
    return detections;
  } catch (error) {
    console.error('[detectAllFaces] Error:', error);
    return [];
  }
};

export const euclideanDistance = (desc1: Float32Array, desc2: Float32Array): number => {
  return faceapi.euclideanDistance(
    Array.from(desc1),
    Array.from(desc2)
  );
};

export const captureFrameFromVideo = (
  video: HTMLVideoElement,
  quality = 0.6
): string | null => {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    console.log('[captureFrame] Video not ready');
    return null;
  }

  const canvas = document.createElement('canvas');
  const maxW = 480;
  const maxH = 360;
  let w = video.videoWidth;
  let h = video.videoHeight;
  const ratio = w / h;

  if (w > maxW) { w = maxW; h = w / ratio; }
  if (h > maxH) { h = maxH; w = h * ratio; }

  canvas.width = Math.round(w);
  canvas.height = Math.round(h);

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const data = canvas.toDataURL('image/jpeg', quality);
  if (data.length < 500) {
    console.log('[captureFrame] Captured data too small');
    return null;
  }

  console.log('[captureFrame] Captured frame:', Math.round(data.length / 1024), 'KB');
  return data;
};

export interface FaceVerificationLog {
  studentId: string;
  fullName: string;
  kelas: string;
  jurusan: string;
  violationType: 'Wajah Ganda' | 'Wajah Tidak Dikenali';
  evidencePhotoUrl: string;
  baselinePhotoUrl: string;
  timestamp: Date;
  examId: string;
  examCode?: string;
}

export const descriptorToArray = (desc: Float32Array): number[] => Array.from(desc);
export const arrayToDescriptor = (arr: number[]): Float32Array => new Float32Array(arr);
