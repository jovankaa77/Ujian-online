import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import { faceDetectionService } from '../../utils/faceDetection';

interface StudentPreCheckProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  appState: any;
  user: any;
}

interface DeviceChecks {
  device: boolean | null;
  camera: boolean | null;
  screenCount: boolean | null;
  microphone: boolean | null;
  faceDetection: boolean | null;
}

const StudentPreCheck: React.FC<StudentPreCheckProps> = ({ navigateTo, navigateBack, appState, user }) => {
  const { studentInfo } = appState;
  const [checks, setChecks] = useState<DeviceChecks>({ device: null, camera: null, screenCount: null, microphone: null, faceDetection: null });
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<MediaStream | null>(null);
  const [faceCount, setFaceCount] = useState(0);
  const [maxFaceCount, setMaxFaceCount] = useState(0);
  const faceDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Enhanced mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
                     window.screen.width < 1024;
    
    // Check screen count
    const checkScreens = async () => {
      try {
        if ('getScreenDetails' in window) {
          const screenDetails = await (window as any).getScreenDetails();
          setChecks(c => ({ ...c, screenCount: screenDetails.screens.length === 1 }));
        } else {
          // Fallback: assume single screen if API not available
          setChecks(c => ({ ...c, screenCount: true }));
        }
      } catch {
        setChecks(c => ({ ...c, screenCount: true }));
      }
    };
    
    setChecks(c => ({ ...c, device: !isMobile }));
    checkScreens();
    
    if (isMobile) return;
    
    // Load face detection model
    const loadFaceDetection = async () => {
      console.log("Loading face detection model...");
      const loaded = await faceDetectionService.loadModel();
      setChecks(c => ({ ...c, faceDetection: loaded }));
      
      if (loaded) {
        console.log("Face detection model loaded successfully");
      } else {
        console.error("Failed to load face detection model");
      }
    };
    
    loadFaceDetection();
    
    // Check camera and microphone permissions
    const checkMediaDevices = async () => {
      try {
        // Request both video and audio permissions
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        // Check if we got both video and audio tracks
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        setChecks(c => ({ 
          ...c, 
          camera: videoTracks.length > 0,
          microphone: audioTracks.length > 0
        }));
        
        if (videoRef.current && videoTracks.length > 0) {
          // Create video-only stream for display
          const videoStream = new MediaStream(videoTracks);
          videoRef.current.srcObject = videoStream;
          
          // Start face detection after video is loaded
          videoRef.current.onloadedmetadata = () => {
            startFaceDetection();
          };
        }
        
        // Store audio stream reference for later use
        if (audioTracks.length > 0) {
          audioRef.current = new MediaStream(audioTracks);
        }
        
      } catch (err) {
        console.error("Error accessing media devices.", err);
        
        // Try to determine which permission failed
        try {
          // Try video only
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setChecks(c => ({ ...c, camera: true, microphone: false }));
          if (videoRef.current) {
            videoRef.current.srcObject = videoStream;
          }
        } catch (videoErr) {
          setChecks(c => ({ ...c, camera: false, microphone: false }));
        }
      }
    };
    
    checkMediaDevices();
  }, []);

  const startFaceDetection = () => {
    if (!videoRef.current || !faceDetectionService.isModelLoaded()) return;
    
    // Clear existing interval
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }
    
    // Start face detection every 2 seconds
    faceDetectionIntervalRef.current = setInterval(async () => {
      if (videoRef.current && faceDetectionService.isModelLoaded()) {
        try {
          const detectedFaces = await faceDetectionService.detectFacesInVideo(videoRef.current);
          setFaceCount(detectedFaces);
          
          // Track maximum face count
          if (detectedFaces > maxFaceCount) {
            setMaxFaceCount(detectedFaces);
          }
          
          console.log(`Detected ${detectedFaces} faces`);
        } catch (error) {
          console.error("Face detection error:", error);
        }
      }
    }, 2000);
  };

  // Cleanup face detection interval
  useEffect(() => {
    return () => {
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
    };
  }, []);

  const allChecksPassed = checks.device && checks.camera && checks.screenCount && checks.microphone && checks.faceDetection;

  const startExam = async () => {
    // Stop face detection during exam start
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }
    
    // Request fullscreen immediately on user interaction
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).mozRequestFullScreen) {
        await (elem as any).mozRequestFullScreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
    } catch (error) {
      console.warn("Failed to enter fullscreen:", error);
      // Continue with exam even if fullscreen fails
    }

    // Validate that exam and user are defined
    if (!appState.exam || !user) {
      console.error("Missing exam or user data");
      alert("Data ujian tidak lengkap. Silakan coba lagi.");
      navigateBack();
      return;
    }

    // Ensure studentInfo is properly defined
    const finalStudentInfo = studentInfo || {
      name: user.fullName || user.name || '',
      fullName: user.fullName || user.name || '',
      nim: user.nim || '',
      major: user.major || '',
      className: user.className || ''
    };
    
    // Ensure name property exists for consistency
    if (!finalStudentInfo.name && finalStudentInfo.fullName) {
      finalStudentInfo.name = finalStudentInfo.fullName;
    }

    const { exam } = appState;
    
    // Validate exam time
    const now = new Date();
    const startTime = new Date(exam.startTime);
    const endTime = new Date(exam.endTime);
    
    console.log("Exam time validation:");
    console.log("Current time:", now.toISOString());
    console.log("Exam start time:", startTime.toISOString());
    console.log("Exam end time:", endTime.toISOString());
    
    if (now < startTime) {
      alert("Ujian belum dimulai. Silakan tunggu hingga waktu yang ditentukan.");
      navigateBack();
      return;
    }
    
    if (now > endTime) {
      alert("Waktu ujian telah berakhir. Anda tidak dapat lagi mengikuti ujian ini.");
      navigateBack();
      return;
    }
    
    const sessionRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`);
    
    try {
      console.log("Creating exam session...");
      const docRef = await addDoc(sessionRef, {
        studentId: user.id,
        studentInfo: finalStudentInfo,
        startTime: new Date(),
        status: 'started',
        violations: 0,
        answers: {},
        finalScore: null
      });
      
      console.log("Session created with ID:", docRef.id);
      
      navigateTo('student_exam', { 
        sessionId: docRef.id, 
        exam: exam,
        studentInfo: finalStudentInfo,
        maxFaceCount: maxFaceCount
      });
    } catch (error) {
      console.error("Gagal memulai sesi ujian:", error);
      alert("Gagal memulai sesi ujian. Silakan coba lagi.");
    }
  };

  const renderCheckItem = (label: string, status: boolean | null) => {
    let statusText = "Memeriksa...";
    let colorClass = "text-yellow-400";
    
    if (status === true) {
      statusText = "OK";
      colorClass = "text-green-400";
    } else if (status === false) {
      statusText = "Gagal/Ditolak";
      colorClass = "text-red-400";
    }
    
    return (
      <li className="flex justify-between items-center p-3 bg-gray-700 rounded-md">
        <span>{label}</span>
        <span className={`font-bold ${colorClass}`}>{statusText}</span>
      </li>
    );
  };

  return (
    <div>
      <button 
        onClick={navigateBack} 
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>
      <h2 className="text-3xl font-bold mb-6 text-center">Pemeriksaan Perangkat</h2>
      <div className="w-full max-w-lg mx-auto bg-gray-800 p-8 rounded-lg shadow-xl">
        <ul className="space-y-3 mb-6">
          {renderCheckItem("Akses dari Desktop", checks.device)}
          {renderCheckItem("Layar Tunggal", checks.screenCount)}
          {renderCheckItem("Akses Kamera", checks.camera)}
          {renderCheckItem("Akses Mikrofon", checks.microphone)}
          {renderCheckItem("Model Deteksi Wajah", checks.faceDetection)}
        </ul>
        
        {/* Face Detection Status */}
        {checks.camera && checks.faceDetection && (
          <div className="mb-6 bg-blue-900 border border-blue-500 p-4 rounded-lg">
            <h4 className="text-blue-300 font-bold mb-2">👤 Status Deteksi Wajah</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-200">Wajah Saat Ini:</span>
                <span className={`ml-2 font-bold ${
                  faceCount === 1 ? 'text-green-400' : 
                  faceCount === 0 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {faceCount} wajah
                </span>
              </div>
              <div>
                <span className="text-blue-200">Maksimal Terdeteksi:</span>
                <span className={`ml-2 font-bold ${
                  maxFaceCount === 1 ? 'text-green-400' : 
                  maxFaceCount === 0 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {maxFaceCount} wajah
                </span>
              </div>
            </div>
            <div className="mt-2 text-xs text-blue-200">
              💡 <strong>Ideal:</strong> Sistem mendeteksi tepat 1 wajah untuk ujian yang aman
            </div>
          </div>
        )}
        
        {checks.device === false && (
          <p className="text-red-400 text-center mb-4">
            ❌ Ujian hanya bisa diakses dari Laptop/Desktop dengan layar minimal 1024px.
          </p>
        )}
        
        {checks.screenCount === false && (
          <p className="text-red-400 text-center mb-4">
            ❌ Ujian hanya bisa diakses dengan satu layar. Matikan layar tambahan.
          </p>
        )}
        
        {checks.camera === false && (
          <p className="text-yellow-400 text-center mb-4">
            ⚠️ Mohon izinkan akses kamera di browser Anda, lalu segarkan halaman ini.
          </p>
        )}
        
        {checks.microphone === false && (
          <p className="text-red-400 text-center mb-4">
            ⚠️ Mohon izinkan akses mikrofon di browser Anda untuk monitoring audio, lalu segarkan halaman ini.
          </p>
        )}
        
        {checks.faceDetection === false && (
          <p className="text-red-400 text-center mb-4">
            ⚠️ Gagal memuat model deteksi wajah. Silakan refresh halaman.
          </p>
        )}
        
        {faceDetectionService.isModelLoading() && (
          <div className="mb-4 bg-yellow-900 border border-yellow-500 p-3 rounded-md">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-400 mr-2"></div>
              <p className="text-yellow-200 text-sm">
                🤖 Memuat model deteksi wajah...
              </p>
            </div>
          </div>
        )}
        
        <div className="my-4 w-full aspect-video bg-gray-900 rounded-md overflow-hidden">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
        </div>
        
        {checks.device && (
          <div className="mb-4 p-3 bg-blue-900 border border-blue-500 rounded-md">
            <p className="text-blue-300 text-sm">
              ℹ️ <strong>Penting:</strong> Ujian akan otomatis masuk mode fullscreen dan mengaktifkan monitoring audio. 
              Keluar dari fullscreen atau aktivitas suara akan direkam sebagai bukti pengawasan.
            </p>
          </div>
        )}
        
        {checks.device && checks.camera && checks.screenCount && !checks.microphone && (
          <div className="mb-4 p-3 bg-red-900 border border-red-500 rounded-md">
            <p className="text-red-300 text-sm">
              🚫 <strong>Akses Mikrofon Diperlukan:</strong> Sistem memerlukan akses mikrofon untuk monitoring audio selama ujian. 
              Tanpa izin mikrofon, Anda tidak dapat memulai ujian.
            </p>
          </div>
        )}
        
        <button 
          onClick={startExam} 
          disabled={!allChecksPassed} 
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {allChecksPassed ? 'Mulai Ujian' : 
           checks.device === false ? 'Gunakan Desktop/Laptop' :
           checks.screenCount === false ? 'Gunakan Layar Tunggal' :
           checks.camera === false ? 'Izinkan Akses Kamera' :
           checks.microphone === false ? 'Izinkan Akses Mikrofon' :
          checks.faceDetection === false ? 'Model Deteksi Wajah Gagal' :
          faceDetectionService.isModelLoading() ? 'Memuat Model Deteksi Wajah...' :
           'Menunggu Pemeriksaan Selesai'}
        </button>
      </div>
    </div>
  );
};

export default StudentPreCheck;