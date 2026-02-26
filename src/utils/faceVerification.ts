import * as faceapi from 'face-api.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { db, storage, appId } from '../config/firebase';

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

const dataURLtoBlob = (dataURL: string): Blob => {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(parts[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
};

export const uploadPhotoToStorage = async (
  dataURL: string,
  path: string
): Promise<string> => {
  const blob = dataURLtoBlob(dataURL);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
};

export const captureFrameFromVideo = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  maxWidth = 640,
  maxHeight = 480,
  quality = 0.6
): string | null => {
  if (video.readyState < 2 || video.videoWidth === 0) return null;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

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
  return data.length > 5000 ? data : null;
};

export interface FaceVerificationLog {
  userId: string;
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
