import * as faceapi from 'face-api.js';
import { collection, addDoc } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

let modelsLoaded = false;
let modelsLoading = false;

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';

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
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    return true;
  } catch (error) {
    console.error('Failed to load face models:', error);
    return false;
  } finally {
    modelsLoading = false;
  }
};

export const areModelsLoaded = () => modelsLoaded;

export const detectSingleFace = async (
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
) => {
  const detection = await faceapi
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection || null;
};

export const detectAllFaces = async (
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
) => {
  const detections = await faceapi
    .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  return detections;
};

export const euclideanDistance = (desc1: Float32Array, desc2: Float32Array): number => {
  return faceapi.euclideanDistance(
    Array.from(desc1),
    Array.from(desc2)
  );
};

export const captureFrameFromVideo = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  maxWidth = 640,
  maxHeight = 480,
  quality = 0.7
): string | null => {
  console.log('[captureFrame] Starting capture...', {
    videoReadyState: video.readyState,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight
  });

  if (video.readyState < 2) {
    console.log('[captureFrame] Video not ready (readyState < 2)');
    return null;
  }

  if (video.videoWidth === 0 || video.videoHeight === 0) {
    console.log('[captureFrame] Video has no dimensions');
    return null;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.log('[captureFrame] Could not get canvas context');
    return null;
  }

  let w = video.videoWidth;
  let h = video.videoHeight;
  const ratio = w / h;

  if (w > maxWidth) { w = maxWidth; h = w / ratio; }
  if (h > maxHeight) { h = maxHeight; w = h * ratio; }

  canvas.width = w;
  canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(video, 0, 0, w, h);

  const data = canvas.toDataURL('image/jpeg', quality);
  console.log('[captureFrame] Captured frame, data length:', data.length);

  if (data.length < 1000) {
    console.log('[captureFrame] Data too small, returning null');
    return null;
  }

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
}

export const saveFaceVerificationLog = async (log: FaceVerificationLog) => {
  try {
    const logsRef = collection(db, `artifacts/${appId}/public/data/face_verification_logs`);
    await addDoc(logsRef, {
      ...log,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to save face verification log:', error);
  }
};

export const descriptorToArray = (desc: Float32Array): number[] => Array.from(desc);
export const arrayToDescriptor = (arr: number[]): Float32Array => new Float32Array(arr);
