import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyC6JKHURMERm5VuJSfWy1DiGJ_Z-kUfIdM",
  authDomain: "ujian-online-15771.firebaseapp.com",
  projectId: "ujian-online-15771",
  storageBucket: "ujian-online-15771.firebasestorage.app",
  messagingSenderId: "576591173041",
  appId: "1:576591173041:web:a19ef2da4a07866eb91990",
  measurementId: "G-34TVQSPSTJ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);

export const appId = 'ujian-online-app';