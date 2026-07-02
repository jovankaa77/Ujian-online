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

  // Enhance contrast/brightness to improve detection on low-quality cameras
  ctx.filter = 'contrast(1.2) brightness(1.05)';
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
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

export interface FaceQualityResult {
  faceCount: number;
  status: 'ok' | 'no_face' | 'multiple_faces' | 'too_small' | 'sideways' | 'partially_covered';
  message: string;
  color: 'green' | 'yellow' | 'red';
  box?: { x: number; y: number; width: number; height: number };
}

const avgPoint = (pts: faceapi.Point[]) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

export const detectFaceQualityFromVideo = async (
  video: HTMLVideoElement
): Promise<FaceQualityResult> => {
  if (!modelsLoaded) {
    return { faceCount: 0, status: 'no_face', message: 'Model belum dimuat.', color: 'red' };
  }
  if (video.readyState < 2 || !video.videoWidth) {
    return { faceCount: 0, status: 'no_face', message: 'Kamera belum siap.', color: 'red' };
  }

  const canvas = videoToCanvas(video);
  if (!canvas) {
    return { faceCount: 0, status: 'no_face', message: 'Gagal membaca kamera.', color: 'red' };
  }

  try {
    const detections = await faceapi
      .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
      .withFaceLandmarks();

    if (detections.length === 0) {
      return {
        faceCount: 0, status: 'no_face', color: 'red',
        message: 'Wajah tidak terdeteksi. Pastikan wajah Anda terlihat penuh dan pencahayaan cukup.',
      };
    }

    if (detections.length > 1) {
      const b = detections[0].detection.box;
      return {
        faceCount: detections.length, status: 'multiple_faces', color: 'red',
        message: `Terdeteksi ${detections.length} wajah. Hanya 1 wajah yang diizinkan.`,
        box: { x: b.x, y: b.y, width: b.width, height: b.height },
      };
    }

    const det = detections[0];
    const box = det.detection.box;
    const score = det.detection.score;
    const pts = det.landmarks.positions;

    const faceWidthRatio = box.width / canvas.width;
    if (faceWidthRatio < 0.13) {
      return {
        faceCount: 1, status: 'too_small', color: 'yellow',
        message: 'Wajah terlalu jauh. Dekatkan wajah Anda ke kamera.',
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
      };
    }

    // Sideways: compare nose tip horizontal position vs eye midpoint
    const leftEyeCenter = avgPoint(pts.slice(36, 42));
    const rightEyeCenter = avgPoint(pts.slice(42, 48));
    const eyeMidX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
    const eyeDist = Math.abs(rightEyeCenter.x - leftEyeCenter.x);
    const noseTip = pts[30];
    const noseDeviation = eyeDist > 0 ? Math.abs(noseTip.x - eyeMidX) / eyeDist : 0;

    if (noseDeviation > 0.38) {
      return {
        faceCount: 1, status: 'sideways', color: 'yellow',
        message: 'Wajah menghadap samping. Hadapkan wajah langsung ke kamera.',
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
      };
    }

    // Partial coverage: low detection score = mask/hand/object blocking face
    if (score < 0.48) {
      return {
        faceCount: 1, status: 'partially_covered', color: 'yellow',
        message: 'Wajah terdeteksi kurang jelas. Pastikan wajah tidak tertutup masker, tangan, atau benda lain.',
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
      };
    }

    // Check lower face coverage using landmark geometry
    const noseTipY = noseTip.y;
    const chinY = pts[8].y;
    const eyeY = (leftEyeCenter.y + rightEyeCenter.y) / 2;
    const totalFaceH = chinY - eyeY;
    const lowerFaceH = chinY - noseTipY;
    if (totalFaceH > 0 && lowerFaceH / totalFaceH < 0.22) {
      return {
        faceCount: 1, status: 'partially_covered', color: 'yellow',
        message: 'Bagian bawah wajah tertutup. Lepas masker atau benda yang menutupi wajah.',
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
      };
    }

    return {
      faceCount: 1, status: 'ok', color: 'green',
      message: 'Wajah terdeteksi dengan baik.',
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
    };
  } catch (error) {
    console.error('[detectFaceQuality] Error:', error);
    return { faceCount: 0, status: 'no_face', message: 'Gagal mendeteksi wajah.', color: 'red' };
  }
};
