import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import { detectExtensions, startExtensionMonitoring, ExtensionDetectionResult } from '../../utils/extensionDetection';
import {
  loadFaceModels,
  detectSingleFace,
  captureFrameFromVideo,
  descriptorToArray,
} from '../../utils/faceVerification';

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
  extensions: boolean | null;
}

const StudentPreCheck: React.FC<StudentPreCheckProps> = ({ navigateTo, navigateBack, appState, user }) => {
  const { studentInfo } = appState;
  const [checks, setChecks] = useState<DeviceChecks>({ device: null, camera: null, screenCount: null, microphone: null, extensions: null });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [extensionResult, setExtensionResult] = useState<ExtensionDetectionResult | null>(null);
  const [extensionMonitoringCleanup, setExtensionMonitoringCleanup] = useState<(() => void) | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<MediaStream | null>(null);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);
  const permissionCheckRef = useRef<boolean>(false);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);

  const [faceModelStatus, setFaceModelStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [faceVerified, setFaceVerified] = useState(false);
  const [faceCapturing, setFaceCapturing] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [baselineDescriptor, setBaselineDescriptor] = useState<Float32Array | null>(null);
  const [baselinePhotoUrl, setBaselinePhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
                     window.screen.width < 1024;

    setChecks(c => ({ ...c, device: !isMobile }));
    checkExtensions();

    const checkScreens = async () => {
      try {
        if ('getScreenDetails' in window) {
          const screenDetails = await (window as any).getScreenDetails();
          setChecks(c => ({ ...c, screenCount: screenDetails.screens.length === 1 }));
        } else {
          setChecks(c => ({ ...c, screenCount: true }));
        }
      } catch {
        setChecks(c => ({ ...c, screenCount: true }));
      }
    };

    checkScreens();

    if (isMobile) return;

    const cleanup = startExtensionMonitoring((result) => {
      setExtensionResult(result);
      setChecks(c => ({ ...c, extensions: !result.hasRiskyExtensions }));
    }, 15000);

    setExtensionMonitoringCleanup(() => cleanup);

    const checkMediaDevices = async () => {
      try {
        permissionCheckRef.current = true;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();

        setChecks(c => ({
          ...c,
          camera: videoTracks.length > 0,
          microphone: audioTracks.length > 0
        }));

        if (videoRef.current && videoTracks.length > 0) {
          const videoStream = new MediaStream(videoTracks);
          currentStreamRef.current = stream;
          videoRef.current.srcObject = videoStream;
        }

        if (audioTracks.length > 0) {
          audioRef.current = new MediaStream(audioTracks);
        }

        if (videoTracks.length > 0 && audioTracks.length > 0) {
          startContinuousMonitoring();
        }

      } catch (err) {
        console.error("Error accessing media devices.", err);

        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setChecks(c => ({ ...c, camera: true, microphone: false }));
          if (videoRef.current) {
            currentStreamRef.current = videoStream;
            videoRef.current.srcObject = videoStream;
          }
        } catch (videoErr) {
          setChecks(c => ({ ...c, camera: false, microphone: false }));
        }
      }
    };

    checkMediaDevices();
  }, []);

  useEffect(() => {
    const allDeviceChecks = checks.device && checks.camera && checks.screenCount && checks.microphone && checks.extensions;
    if (allDeviceChecks && faceModelStatus === 'idle') {
      setFaceModelStatus('loading');
      loadFaceModels().then(success => {
        setFaceModelStatus(success ? 'loaded' : 'error');
      });
    }
  }, [checks, faceModelStatus]);

  const checkExtensions = async () => {
    try {
      const result = await detectExtensions();
      setExtensionResult(result);
      setChecks(c => ({ ...c, extensions: !result.hasRiskyExtensions }));
    } catch (error) {
      console.error('Error checking extensions:', error);
      setChecks(c => ({ ...c, extensions: true }));
    }
  };

  const startContinuousMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);

    const monitorDevices = async () => {
      try {
        if (currentStreamRef.current) {
          const videoTracks = currentStreamRef.current.getVideoTracks();
          const audioTracks = currentStreamRef.current.getAudioTracks();

          const cameraActive = videoTracks.length > 0 && videoTracks[0].readyState === 'live';
          const microphoneActive = audioTracks.length > 0 && audioTracks[0].readyState === 'live';

          setChecks(prevChecks => ({
            ...prevChecks,
            camera: cameraActive,
            microphone: microphoneActive
          }));

          if (!cameraActive || !microphoneActive) {
            await recheckMediaPermissions();
          }
        } else {
          await recheckMediaPermissions();
        }

        await recheckScreenCount();

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
                         window.screen.width < 1024;

        setChecks(prevChecks => ({
          ...prevChecks,
          device: !isMobile,
        }));

      } catch (error) {
        console.error("Error in continuous monitoring:", error);
        setChecks(prevChecks => ({
          ...prevChecks,
          camera: false,
          microphone: false,
        }));
      }
    };

    monitoringIntervalRef.current = setInterval(monitorDevices, 2000);
  }, [isMonitoring]);

  const recheckMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      setChecks(prevChecks => ({
        ...prevChecks,
        camera: videoTracks.length > 0,
        microphone: audioTracks.length > 0
      }));

      if (videoRef.current && videoTracks.length > 0) {
        const videoStream = new MediaStream(videoTracks);
        videoRef.current.srcObject = videoStream;
      }

      currentStreamRef.current = stream;
      if (audioTracks.length > 0) {
        audioRef.current = new MediaStream(audioTracks);
      }

    } catch (error) {
      console.error("Failed to recheck media permissions:", error);
      setChecks(prevChecks => ({
        ...prevChecks,
        camera: false,
        microphone: false
      }));
    }
  };

  const recheckScreenCount = async () => {
    try {
      if ('getScreenDetails' in window) {
        const screenDetails = await (window as any).getScreenDetails();
        setChecks(prevChecks => ({ ...prevChecks, screenCount: screenDetails.screens.length === 1 }));
      }
    } catch {
      setChecks(prevChecks => ({ ...prevChecks, screenCount: true }));
    }
  };

  const allDeviceChecksPassed = checks.device && checks.camera && checks.screenCount && checks.microphone && checks.extensions;
  const allChecksPassed = allDeviceChecksPassed && faceVerified;

  useEffect(() => {
    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
      if (extensionMonitoringCleanup) {
        extensionMonitoringCleanup();
      }
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCaptureFace = async () => {
    if (!videoRef.current || !faceCanvasRef.current || faceModelStatus !== 'loaded') return;

    setFaceCapturing(true);
    setFaceError(null);

    try {
      const detection = await detectSingleFace(videoRef.current);

      if (!detection) {
        setFaceError('Wajah tidak terdeteksi. Pastikan wajah Anda terlihat jelas di kamera.');
        setFaceCapturing(false);
        return;
      }

      const photoData = captureFrameFromVideo(videoRef.current, faceCanvasRef.current);
      if (!photoData) {
        setFaceError('Gagal mengambil foto. Coba lagi.');
        setFaceCapturing(false);
        return;
      }

      const descriptor = detection.descriptor;
      setBaselineDescriptor(descriptor);
      setBaselinePhotoUrl(photoData);

      const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, user.id);
      try {
        await updateDoc(userDocRef, {
          faceDescriptor: descriptorToArray(descriptor),
          faceBaselineUrl: photoData,
          faceVerifiedAt: new Date().toISOString(),
        });
      } catch {
        const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
        await addDoc(usersRef, {
          id: user.id,
          fullName: studentInfo?.name || user.fullName || user.name || '',
          kelas: studentInfo?.className || user.className || '',
          jurusan: studentInfo?.major || user.major || '',
          faceDescriptor: descriptorToArray(descriptor),
          faceBaselineUrl: photoData,
          faceVerifiedAt: new Date().toISOString(),
        });
      }

      setFaceVerified(true);
    } catch (error: any) {
      console.error('Face capture error:', error);
      setFaceError(`Gagal verifikasi wajah: ${error.message}`);
    } finally {
      setFaceCapturing(false);
    }
  };

  const startExam = async () => {
    if (!allChecksPassed) {
      alert("Semua pemeriksaan perangkat dan verifikasi wajah harus berhasil sebelum memulai ujian.");
      return;
    }

    try {
      const finalExtensionCheck = await detectExtensions();
      if (finalExtensionCheck.hasRiskyExtensions) {
        alert("Terdeteksi ekstensi browser yang tidak diizinkan. Silakan nonaktifkan ekstensi tersebut dan coba lagi.");
        return;
      }
    } catch (error) {
      console.warn('Final extension check failed:', error);
    }

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
    }

    if (!appState.exam || !user) {
      console.error("Missing exam or user data");
      alert("Data ujian tidak lengkap. Silakan coba lagi.");
      navigateBack();
      return;
    }

    const finalStudentInfo = studentInfo || {
      name: user.fullName || user.name || '',
      fullName: user.fullName || user.name || '',
      nim: user.nim || '',
      major: user.major || '',
      className: user.className || ''
    };

    if (!finalStudentInfo.name && finalStudentInfo.fullName) {
      finalStudentInfo.name = finalStudentInfo.fullName;
    }

    const { exam } = appState;

    const now = new Date();
    const startTime = new Date(exam.startTime);
    const endTime = new Date(exam.endTime);

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
      const docRef = await addDoc(sessionRef, {
        studentId: user.id,
        studentInfo: finalStudentInfo,
        startTime: new Date(),
        status: 'started',
        violations: 0,
        answers: {},
        finalScore: null,
        faceBaselineUrl: baselinePhotoUrl || null,
        faceVerifiedAt: baselinePhotoUrl ? new Date().toISOString() : null,
        examCode: exam.code,
      });

      navigateTo('student_exam', {
        sessionId: docRef.id,
        exam: exam,
        studentInfo: finalStudentInfo,
        faceDescriptor: baselineDescriptor ? descriptorToArray(baselineDescriptor) : null,
        faceBaselineUrl: baselinePhotoUrl,
      });
    } catch (error) {
      console.error("Gagal memulai sesi ujian:", error);
      alert("Gagal memulai sesi ujian. Silakan coba lagi.");
    }
  };

  const renderCheckItem = (label: string, status: boolean | null) => {
    let statusText = "Memeriksa...";
    let colorClass = "text-yellow-400";
    let icon = "\u23F3";
    if (status === true) {
      statusText = "OK";
      colorClass = "text-green-400";
      icon = "\u2705";
    } else if (status === false) {
      statusText = "Gagal/Ditolak";
      colorClass = "text-red-400";
      icon = "\u274C";
    }

    return (
      <li className="flex justify-between items-center p-3 bg-gray-700 rounded-md">
        <span className="flex items-center">
          <span className="mr-2">{icon}</span>
          {label}
        </span>
        <span className={`font-bold ${colorClass}`}>
          {statusText}
          {isMonitoring && status !== null && (
            <span className="ml-2 text-xs text-blue-400">(Live)</span>
          )}
        </span>
      </li>
    );
  };

  const handleManualRefresh = async () => {
    try {
      setChecks({ device: null, camera: null, screenCount: null, microphone: null, extensions: null });
      setExtensionResult(null);
      setFaceVerified(false);
      setBaselineDescriptor(null);
      setBaselinePhotoUrl(null);
      setFaceError(null);
      setFaceModelStatus('idle');

      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        setIsMonitoring(false);
      }

      if (extensionMonitoringCleanup) {
        extensionMonitoringCleanup();
        setExtensionMonitoringCleanup(null);
      }

      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
        currentStreamRef.current = null;
      }

      if (audioRef.current) {
        audioRef.current.getTracks().forEach(track => track.stop());
        audioRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      permissionCheckRef.current = false;

      setTimeout(() => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
                         window.screen.width < 1024;

        setChecks(c => ({ ...c, device: !isMobile }));
        checkExtensions();

        const cleanup = startExtensionMonitoring((result) => {
          setExtensionResult(result);
          setChecks(c => ({ ...c, extensions: !result.hasRiskyExtensions }));
        }, 15000);

        setExtensionMonitoringCleanup(() => cleanup);

        const recheckScreens = async () => {
          try {
            if ('getScreenDetails' in window) {
              const screenDetails = await (window as any).getScreenDetails();
              setChecks(c => ({ ...c, screenCount: screenDetails.screens.length === 1 }));
            } else {
              setChecks(c => ({ ...c, screenCount: true }));
            }
          } catch {
            setChecks(c => ({ ...c, screenCount: true }));
          }
        };

        recheckScreens();

        if (!isMobile) {
          const recheckMediaDevices = async () => {
            try {
              permissionCheckRef.current = true;
              const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
              });

              const videoTracks = stream.getVideoTracks();
              const audioTracks = stream.getAudioTracks();

              setChecks(c => ({
                ...c,
                camera: videoTracks.length > 0,
                microphone: audioTracks.length > 0
              }));

              if (videoRef.current && videoTracks.length > 0) {
                const videoStream = new MediaStream(videoTracks);
                currentStreamRef.current = stream;
                videoRef.current.srcObject = videoStream;
              }

              if (audioTracks.length > 0) {
                audioRef.current = new MediaStream(audioTracks);
              }

              if (videoTracks.length > 0 && audioTracks.length > 0) {
                startContinuousMonitoring();
              }

            } catch (err) {
              console.error("Error re-accessing media devices:", err);

              try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                setChecks(c => ({ ...c, camera: true, microphone: false }));
                if (videoRef.current) {
                  currentStreamRef.current = videoStream;
                  videoRef.current.srcObject = videoStream;
                }
              } catch (videoErr) {
                setChecks(c => ({ ...c, camera: false, microphone: false }));
              }
            }
          };

          recheckMediaDevices();
        }
      }, 1000);

    } catch (error) {
      console.error("Error during manual refresh:", error);
      alert("Terjadi kesalahan saat refresh. Silakan coba lagi.");
    }
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
        {isMonitoring && (
          <div className="mb-4 bg-blue-900 border border-blue-500 p-3 rounded-md">
            <div className="flex items-center justify-center">
              <div className="animate-pulse w-3 h-3 bg-blue-400 rounded-full mr-2"></div>
              <span className="text-blue-300 text-sm font-bold">Monitoring Real-time Aktif</span>
            </div>
          </div>
        )}

        <ul className="space-y-3 mb-6">
          {renderCheckItem("Akses dari Desktop", checks.device)}
          {renderCheckItem("Layar Tunggal", checks.screenCount)}
          {renderCheckItem("Akses Kamera", checks.camera)}
          {renderCheckItem("Akses Mikrofon", checks.microphone)}
          {renderCheckItem("Ekstensi Browser Aman", checks.extensions)}
          {renderCheckItem("Verifikasi Wajah", faceVerified ? true : allDeviceChecksPassed && !faceVerified ? null : null)}
        </ul>

        {extensionResult && extensionResult.detectedExtensions.length > 0 && (
          <div className="mb-6 bg-red-900 border border-red-500 p-4 rounded-lg">
            <h4 className="text-red-300 font-bold mb-3">Ekstensi Terdeteksi ({extensionResult.detectedExtensions.length})</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {extensionResult.detectedExtensions.map((ext, index) => (
                <div key={index} className="bg-red-800 p-2 rounded text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-red-200">{ext.name}</span>
                      <span className={`ml-2 px-2 py-1 text-xs rounded ${
                        ext.risk === 'high' ? 'bg-red-600' :
                        ext.risk === 'medium' ? 'bg-yellow-600' : 'bg-gray-600'
                      }`}>
                        {ext.risk === 'high' ? 'TINGGI' : ext.risk === 'medium' ? 'SEDANG' : 'RENDAH'}
                      </span>
                    </div>
                  </div>
                  <p className="text-red-300 text-xs mt-1">{ext.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 bg-red-800 border border-red-600 p-3 rounded">
              <p className="text-red-200 text-sm">
                <strong>Peringatan:</strong> Ekstensi di atas dapat membantu dalam ujian dan tidak diizinkan.
                Silakan nonaktifkan ekstensi tersebut di pengaturan browser Anda, lalu klik "Refresh Pemeriksaan".
              </p>
              <div className="mt-2 text-xs text-red-300">
                <p><strong>Cara menonaktifkan:</strong></p>
                <p>1. Klik menu browser &gt; More tools &gt; Extensions</p>
                <p>2. Matikan toggle ekstensi yang terdeteksi</p>
                <p>3. Klik "Refresh Pemeriksaan" di bawah</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 text-center">
          <button
            onClick={handleManualRefresh}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm"
          >
            Refresh Pemeriksaan
          </button>
        </div>

        {checks.device === false && (
          <p className="text-red-400 text-center mb-4">
            Ujian hanya bisa diakses dari Laptop/Desktop dengan layar minimal 1024px.
          </p>
        )}

        {checks.screenCount === false && (
          <p className="text-red-400 text-center mb-4">
            Ujian hanya bisa diakses dengan satu layar. Matikan layar tambahan.
          </p>
        )}

        {checks.camera === false && (
          <p className="text-yellow-400 text-center mb-4">
            Mohon izinkan akses kamera di browser Anda, lalu segarkan halaman ini.
          </p>
        )}

        {checks.microphone === false && (
          <p className="text-red-400 text-center mb-4">
            Mohon izinkan akses mikrofon di browser Anda untuk monitoring audio, lalu segarkan halaman ini.
          </p>
        )}

        {checks.extensions === false && (
          <p className="text-red-400 text-center mb-4">
            Terdeteksi ekstensi browser yang tidak diizinkan. Silakan nonaktifkan ekstensi tersebut.
          </p>
        )}

        {permissionCheckRef.current && (!checks.camera || !checks.microphone) && (
          <div className="mb-4 p-3 bg-red-900 border border-red-500 rounded-md">
            <p className="text-red-300 text-sm text-center">
              <strong>Peringatan:</strong> Akses kamera atau mikrofon telah dinonaktifkan.
              Silakan aktifkan kembali di pengaturan browser Anda dan klik "Refresh Pemeriksaan".
            </p>
          </div>
        )}

        <div className="my-4 w-full aspect-video bg-gray-900 rounded-md overflow-hidden">
          {checks.camera === false && (
            <div className="w-full h-full flex items-center justify-center bg-red-900">
              <div className="text-center p-4">
                <div className="text-red-400 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                  </svg>
                </div>
                <p className="text-red-300 text-sm font-bold">Kamera Tidak Aktif</p>
                <p className="text-red-400 text-xs">Izinkan akses kamera</p>
              </div>
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${checks.camera === false ? 'hidden' : ''}`}
          />
        </div>

        <canvas ref={faceCanvasRef} style={{ display: 'none' }} />

        {allDeviceChecksPassed && !faceVerified && (
          <div className="mb-4 p-4 bg-gray-700 border border-gray-600 rounded-lg">
            <h3 className="text-lg font-bold mb-2 text-center">Verifikasi Wajah</h3>
            <p className="text-sm text-gray-300 mb-3 text-center">
              Pastikan wajah Anda terlihat jelas di kamera, lalu klik tombol di bawah untuk mengambil foto verifikasi.
            </p>

            {faceModelStatus === 'loading' && (
              <div className="text-center mb-3">
                <div className="inline-flex items-center text-yellow-400 text-sm">
                  <div className="animate-spin w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full mr-2"></div>
                  Memuat model pengenalan wajah...
                </div>
              </div>
            )}

            {faceModelStatus === 'error' && (
              <div className="text-center mb-3">
                <p className="text-red-400 text-sm">Gagal memuat model. Klik Refresh Pemeriksaan untuk mencoba lagi.</p>
              </div>
            )}

            {faceError && (
              <div className="mb-3 p-2 bg-red-900 border border-red-500 rounded text-sm text-red-300 text-center">
                {faceError}
              </div>
            )}

            <button
              onClick={handleCaptureFace}
              disabled={faceCapturing || faceModelStatus !== 'loaded'}
              className={`w-full font-bold py-3 px-4 rounded-lg transition-all ${
                faceCapturing || faceModelStatus !== 'loaded'
                  ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-700 text-white'
              }`}
            >
              {faceCapturing ? 'Memproses wajah...' : 'Ambil Foto Verifikasi Wajah'}
            </button>
          </div>
        )}

        {faceVerified && (
          <div className="mb-4 p-3 bg-green-900 border border-green-500 rounded-md">
            <p className="text-green-300 text-sm text-center font-bold">
              Verifikasi wajah berhasil! Wajah Anda telah direkam sebagai referensi.
            </p>
          </div>
        )}

        {checks.device && (
          <div className="mb-4 p-3 bg-blue-900 border border-blue-500 rounded-md">
            <p className="text-blue-300 text-sm">
              <strong>Penting:</strong> Ujian akan otomatis masuk mode fullscreen dan mengaktifkan monitoring audio serta verifikasi wajah.
              Keluar dari fullscreen atau aktivitas suara akan direkam sebagai bukti pengawasan.
              Sistem akan terus memantau perangkat Anda selama ujian.
            </p>
          </div>
        )}

        {checks.device && checks.camera && checks.screenCount && !checks.microphone && (
          <div className="mb-4 p-3 bg-red-900 border border-red-500 rounded-md">
            <p className="text-red-300 text-sm">
              <strong>Akses Mikrofon Diperlukan:</strong> Sistem memerlukan akses mikrofon untuk monitoring audio selama ujian.
              Tanpa izin mikrofon, Anda tidak dapat memulai ujian.
            </p>
          </div>
        )}

        {checks.device && checks.camera && checks.screenCount && checks.microphone && !checks.extensions && (
          <div className="mb-4 p-3 bg-red-900 border border-red-500 rounded-md">
            <p className="text-red-300 text-sm">
              <strong>Ekstensi Tidak Diizinkan:</strong> Terdeteksi ekstensi browser yang dapat membantu dalam ujian.
              Silakan nonaktifkan ekstensi tersebut untuk melanjutkan.
            </p>
          </div>
        )}

        {!allDeviceChecksPassed && permissionCheckRef.current && (
          <div className="mb-4 p-3 bg-yellow-900 border border-yellow-500 rounded-md">
            <p className="text-yellow-300 text-sm text-center">
              <strong>Monitoring Aktif:</strong> Sistem terus memantau perangkat Anda.
              Pastikan semua akses tetap diizinkan untuk dapat memulai ujian.
            </p>
          </div>
        )}

        <button
          onClick={startExam}
          disabled={!allChecksPassed}
          className={`w-full font-bold py-3 px-4 rounded-lg transition-all duration-300 ${
            allChecksPassed
              ? 'bg-green-600 hover:bg-green-700 text-white transform hover:scale-105'
              : 'bg-gray-500 text-gray-300 cursor-not-allowed'
          }`}
        >
          {allChecksPassed ? 'Mulai Ujian' :
           checks.device === false ? 'Gunakan Desktop/Laptop' :
           checks.screenCount === false ? 'Gunakan Layar Tunggal' :
           checks.camera === false ? 'Izinkan Akses Kamera' :
           checks.microphone === false ? 'Izinkan Akses Mikrofon' :
           checks.extensions === false ? 'Nonaktifkan Ekstensi Berbahaya' :
           !faceVerified ? 'Verifikasi Wajah Diperlukan' :
           'Menunggu Pemeriksaan Selesai'}
        </button>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Sistem akan terus memantau perangkat Anda. Jangan menonaktifkan akses yang sudah diberikan.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudentPreCheck;
