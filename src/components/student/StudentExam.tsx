import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, updateDoc, doc, query, limit } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import { AlertIcon } from '../ui/Icons';
import Modal from '../ui/Modal';

interface Question {
  id: string;
  text: string;
  type: 'mc' | 'essay';
  options?: string[];
  correctAnswer?: number;
}

interface StudentExamProps {
  appState: any;
  navigateTo: (page: string, data?: any) => void;
  user: any;
}

const StudentExam: React.FC<StudentExamProps> = ({ appState, navigateTo, user }) => {
  const { exam, studentInfo, sessionId } = appState;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(true);
  
  const calculateTimeLeft = () => {
    const endTime = new Date(exam.endTime).getTime();
    const now = new Date().getTime();
    const diff = (endTime - now) / 1000;
    return diff > 0 ? Math.round(diff) : 0;
  };
  
  const [timeLeft, setTimeLeft] = useState(() => {
    const initialTime = calculateTimeLeft();
    console.log("Initial time left:", initialTime, "seconds");
    return initialTime;
  });
  const [violations, setViolations] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showUnansweredModal, setShowUnansweredModal] = useState(false);
  const [unansweredQuestions, setUnansweredQuestions] = useState<number[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [violationReason, setViolationReason] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [vadInstance, setVadInstance] = useState<MicVAD | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioRecordingCount, setAudioRecordingCount] = useState(0);
  const [vadError, setVadError] = useState<string | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechStartTimeRef = useRef<number | null>(null);
  const speechDetectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isRestartingAudio, setIsRestartingAudio] = useState(false);
  
  const sessionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
  const attendancePhotoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const attendancePhotoTimestamps = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120];
  const [attendancePhotos, setAttendancePhotos] = useState<{[key: string]: string}>({});
  const examStartTimeRef = useRef<Date | null>(null);
  const [attendancePhotoCount, setAttendancePhotoCount] = useState(0);
  const attendanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const capturedMinutesRef = useRef<Set<number>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tabCountRef = useRef(1);
  const lastFocusTime = useRef(Date.now());
  const fullscreenRetryCount = useRef(0);
  const maxFullscreenRetries = 3;
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraInitRetryCount = useRef(0);
  const maxCameraRetries = 5;

  useEffect(() => {
    // Initialize audio monitoring
    const initializeAudioMonitoring = async () => {
      try {
        // Check if VAD is available from global script
        if (typeof window === 'undefined' || !(window as any).vad) {
          throw new Error('VAD library not loaded. Please refresh the page.');
        }
        
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        setAudioStream(stream);
        
        // Initialize VAD
        const vad = await (window as any).vad.MicVAD.new({
          stream: stream,
          onSpeechStart: () => {
            console.log("🎤 Speech start detected");
            speechStartTimeRef.current = Date.now();
            
            // Start recording after 1 second of continuous speech
            speechDetectionTimeoutRef.current = setTimeout(() => {
              if (speechStartTimeRef.current) {
                console.log("🎤 1 second of speech detected, starting recording...");
                startAudioRecording(stream);
              }
            }, 1000); // 1 second delay
          },
          onSpeechEnd: () => {
            console.log("🔇 Speech ended, stopping recording if active");
            speechStartTimeRef.current = null;
            
            // Clear the detection timeout if speech ends before 1 second
            if (speechDetectionTimeoutRef.current) {
              clearTimeout(speechDetectionTimeoutRef.current);
              speechDetectionTimeoutRef.current = null;
            }
            
            // Stop recording if currently recording
            if (isRecordingAudio && mediaRecorder && mediaRecorder.state === 'recording') {
              console.log("🛑 Stopping recording due to speech end");
              mediaRecorder.stop();
            }
          },
          onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
          baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.27/dist/"
        });
        
        setVadInstance(vad);
        vad.start();
        console.log("✅ Voice Activity Detection initialized");
        
      } catch (error) {
        console.error("❌ Failed to initialize audio monitoring:", error);
        setVadError(`Audio monitoring failed: ${error.message}`);
      }
    };
    
    if (!isFinished && !isLoading && questions.length > 0) {
      initializeAudioMonitoring();
    }
    
    // Initialize audio context
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Initialize camera with retry mechanism
    const initializeCamera = async (retryCount = 0) => {
      try {
        // Stop existing stream if any
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            track.stop();
            console.log("🛑 Stopping existing camera track");
          });
        }
        
        setCameraError(null);
        setIsCameraReady(false);
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            facingMode: 'user'
          },
          audio: false
        });
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          
          // Wait for video to be ready with multiple checks
          const checkVideoReady = () => {
            if (videoRef.current && 
                videoRef.current.readyState >= 2 && 
                videoRef.current.videoWidth > 0 && 
                videoRef.current.videoHeight > 0) {
              console.log("📷 Camera ready:", videoRef.current.videoWidth, "x", videoRef.current.videoHeight);
              setIsCameraReady(true);
              cameraInitRetryCount.current = 0; // Reset retry count on success
            } else {
              setTimeout(checkVideoReady, 100);
            }
          };
          
          videoRef.current.onloadedmetadata = checkVideoReady;
          videoRef.current.oncanplay = checkVideoReady;
          
          // Fallback timeout
          setTimeout(() => {
            if (!isCameraReady && videoRef.current) {
              console.log("📷 Camera timeout, forcing ready state");
              setIsCameraReady(true);
              cameraInitRetryCount.current = 0;
            }
          }, 5000);
        }
      } catch (error) {
        console.error("Camera access failed:", error);
        setCameraError(`Camera error: ${error.message}`);
        
        // Retry camera initialization
        if (retryCount < maxCameraRetries) {
          cameraInitRetryCount.current = retryCount + 1;
          console.log(`🔄 Retrying camera initialization (${retryCount + 1}/${maxCameraRetries})`);
          setTimeout(() => {
            initializeCamera(retryCount + 1);
          }, 2000); // Wait 2 seconds before retry
        } else {
          setIsCameraReady(false);
          setCameraError("Camera failed after multiple attempts");
        }
      }
    };
    
    // Start camera initialization immediately
    initializeCamera();
    
    // Cleanup
    return () => {
      // Cleanup audio monitoring
      if (vadInstance) {
        vadInstance.destroy();
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log("🛑 Camera track stopped");
        });
      }
    };
  }, []);

  const startAudioRecording = (stream: MediaStream) => {
    if (isRecordingAudio || !stream) {
      console.log("⚠️ Already recording or no stream available");
      return;
    }
    
    try {
      setIsRecordingAudio(true);
      audioChunksRef.current = [];
      
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        console.log("🎵 Audio recording stopped, processing...");
        
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            
            // Save to Firestore
            const audioData = {
              [`voiceRecording_${Date.now()}`]: {
                audioData: base64Audio,
                timestamp: new Date().toISOString(),
                duration: 10,
                studentId: user.id,
                studentName: studentInfo.name
              }
            };
            
            try {
              await updateDoc(sessionDocRef, audioData);
              setAudioRecordingCount(prev => prev + 1);
              console.log("✅ Audio recording saved to Firestore");
            } catch (error) {
              console.error("❌ Failed to save audio recording:", error);
            }
          };
          
          reader.readAsDataURL(audioBlob);
        }
        
        setIsRecordingAudio(false);
        setMediaRecorder(null);
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      
      // Stop recording after 10 seconds
      recordingTimeoutRef.current = setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 10000);
      
      console.log("🔴 Started 10-second audio recording");
      
    } catch (error) {
      console.error("❌ Failed to start audio recording:", error);
      setIsRecordingAudio(false);
    }
  };

  // Function to restart audio monitoring
  const restartAudioMonitoring = async () => {
    if (isRestartingAudio) return;
    
    setIsRestartingAudio(true);
    console.log("🔄 Manually restarting audio monitoring...");
    
    try {
      // Cleanup existing audio resources
      if (vadInstance) {
        vadInstance.destroy();
        setVadInstance(null);
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      
      // Reset states
      setVadError(null);
      setIsRecordingAudio(false);
      setMediaRecorder(null);
      
      // Wait a moment before reinitializing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if VAD is available from global script
      if (typeof window === 'undefined' || !(window as any).vad) {
        throw new Error('VAD library not loaded. Please refresh the page.');
      }
      
      // Reinitialize audio monitoring
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      setAudioStream(stream);
      
      // Initialize VAD with new stream
      const vad = await (window as any).vad.MicVAD.new({
        stream: stream,
        onSpeechStart: () => {
          console.log("🎤 Speech detected, starting recording...");
          startAudioRecording(stream);
        },
        onSpeechEnd: () => {
          console.log("🔇 Speech ended");
        },
        onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
        baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.27/dist/"
      });
      
      setVadInstance(vad);
      vad.start();
      console.log("✅ Audio monitoring restarted successfully");
      
    } catch (error) {
      console.error("❌ Failed to restart audio monitoring:", error);
      setVadError(`Audio restart failed: ${error.message}`);
    } finally {
      setIsRestartingAudio(false);
    }
  };

  // Function to manually restart camera
  const restartCamera = async () => {
    console.log("🔄 Manually restarting camera...");
    cameraInitRetryCount.current = 0;
    
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
    }
    
    // Reinitialize camera
    try {
      setCameraError(null);
      setIsCameraReady(false);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user'
        },
        audio: false
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        const checkVideoReady = () => {
          if (videoRef.current && 
              videoRef.current.readyState >= 2 && 
              videoRef.current.videoWidth > 0 && 
              videoRef.current.videoHeight > 0) {
            console.log("📷 Camera restarted successfully:", videoRef.current.videoWidth, "x", videoRef.current.videoHeight);
            setIsCameraReady(true);
          } else {
            setTimeout(checkVideoReady, 100);
          }
        };
        
        videoRef.current.onloadedmetadata = checkVideoReady;
        videoRef.current.oncanplay = checkVideoReady;
      }
    } catch (error) {
      console.error("Manual camera restart failed:", error);
      setCameraError(`Restart failed: ${error.message}`);
    }
  };

  // Monitor camera stream health
  useEffect(() => {
    if (!isFinished && isCameraReady) {
      const checkCameraHealth = setInterval(() => {
        if (videoRef.current && streamRef.current) {
          const video = videoRef.current;
          const stream = streamRef.current;
          
          // Check if video is still playing and stream is active
          if (video.readyState < 2 || !stream.active || stream.getTracks().length === 0) {
            console.log("⚠️ Camera health check failed, attempting restart...");
            setIsCameraReady(false);
            restartCamera();
          }
        }
      }, 10000); // Check every 10 seconds
      
      return () => clearInterval(checkCameraHealth);
    }
  }, [isCameraReady, isFinished]);

  // Attendance photo capture system
  useEffect(() => {
    if (isFinished || isLoading || questions.length === 0 || !isCameraReady) return;
    
    // Set exam start time
    if (!examStartTimeRef.current) {
      examStartTimeRef.current = new Date();
      console.log("📅 Exam started at:", examStartTimeRef.current.toLocaleTimeString());
    }
    
    // Clear any existing interval
    if (attendanceIntervalRef.current) {
      clearInterval(attendanceIntervalRef.current);
    }
    
    // Start attendance photo timer - check every 30 seconds for more precision
    attendanceIntervalRef.current = setInterval(() => {
      if (isFinished || !examStartTimeRef.current) return;
      
      const now = new Date();
      const elapsedMinutes = Math.floor((now.getTime() - examStartTimeRef.current.getTime()) / (1000 * 60));
      
      console.log(`⏰ Elapsed minutes: ${elapsedMinutes}`);
      
      // Check if current minute matches any of our scheduled photo times and hasn't been captured yet
      if (attendancePhotoTimestamps.includes(elapsedMinutes) && !capturedMinutesRef.current.has(elapsedMinutes)) {
        console.log(`📸 Taking attendance photo at minute ${elapsedMinutes}`);
        capturedMinutesRef.current.add(elapsedMinutes);
        const label = `Menit ke-${elapsedMinutes}`;
        captureAttendancePhoto(label);
      }
    }, 30000); // Check every 30 seconds for better precision
    
    return () => {
      if (attendanceIntervalRef.current) {
        clearInterval(attendanceIntervalRef.current);
      }
      
      // Stop audio monitoring
      if (vadInstance) {
        vadInstance.destroy();
        setVadInstance(null);
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
    };
  }, [isFinished, isLoading, questions.length, isCameraReady]);

  // Capture attendance photo function
  const captureAttendancePhoto = async (label: string) => {
    if (!videoRef.current || !canvasRef.current || !isCameraReady) {
      console.log("❌ Cannot capture attendance photo - camera not ready");
      return;
    }
    
    console.log(`📸 Attempting to capture attendance photo: ${label}`);
    
    const photoData = capturePhoto();
    if (photoData) {
      console.log(`✅ Attendance photo captured: ${label}`);
      
      // Save to local state
      setAttendancePhotos(prev => ({
        ...prev,
        [label]: photoData
      }));
      
      // Update photo count
      setAttendancePhotoCount(prev => prev + 1);
      
      // Save to Firebase
      const attendanceData: any = {};
      attendanceData[`attendancePhoto_${label.replace(/\s+/g, '_')}`] = {
        imageData: photoData,
        timestamp: new Date().toISOString(),
        label: label
      };
      
      try {
        await updateDoc(sessionDocRef, attendanceData);
        console.log(`✅ Attendance photo saved to Firebase: ${label}`);
      } catch (error) {
        console.error("Failed to save attendance photo:", error);
      }
    } else {
      console.log(`❌ Failed to capture attendance photo: ${label}`);
    }
  };

  useEffect(() => {
    // Optimized initialization
    const checkFullscreenSupport = () => {
      const elem = document.documentElement;
      return !!(elem.requestFullscreen || 
               (elem as any).webkitRequestFullscreen || 
               (elem as any).mozRequestFullScreen || 
               (elem as any).msRequestFullscreen);
    };
    
    setIsFullscreenSupported(checkFullscreenSupport());
    
    const fetchQuestions = async () => {
      try {
        // Limit questions for faster loading
        const questionsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/questions`);
        const querySnapshot = await getDocs(query(questionsRef, limit(100)));
        setQuestions(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
      } catch (error) {
        console.error("Gagal memuat soal:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchQuestions();
  }, [exam.id]);

  // Simple photo capture function
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.log("❌ Missing video or canvas element");
      return null;
    }
    
    const video = videoRef.current;
    
    // Check if video is actually playing and has dimensions
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      console.log("❌ Video not ready:", {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });
      return null;
    }
    
    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) {
        console.log("❌ Cannot get canvas context");
        return null;
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Clear canvas first
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64 with high quality
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      
      // Check if image is not just black/empty
      if (imageData.length < 10000) { // Very small image likely means it's black
        console.log("⚠️ Captured image seems too small/black");
        return null;
      }
      
      console.log("✅ Photo captured successfully:", canvas.width, "x", canvas.height);
      return imageData;
      
    } catch (error) {
      console.error("Failed to capture photo:", error);
      return null;
    }
  };

  // Fullscreen functions
  const enterFullscreen = async () => {
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
      fullscreenRetryCount.current = 0;
    } catch (error) {
      console.error("Failed to enter fullscreen:", error);
      fullscreenRetryCount.current++;
      
      if (fullscreenRetryCount.current < maxFullscreenRetries) {
        setTimeout(() => {
          if (!isFinished) {
            enterFullscreen();
          }
        }, 2000);
      } else {
        handleViolation("Fullscreen Required - Unable to Enter");
      }
    }
  };

  const isInFullscreen = () => {
    return !!(document.fullscreenElement || 
             (document as any).webkitFullscreenElement || 
             (document as any).mozFullScreenElement || 
             (document as any).msFullscreenElement);
  };

  // Auto-enter fullscreen when exam loads
  useEffect(() => {
    // Fullscreen is now handled by StudentPreCheck on user interaction
    // This useEffect is removed to prevent permission errors
  }, [isLoading, questions.length, isFullscreenSupported, isFinished]);

  useEffect(() => {
    if (isFinished || isLoading) return;
    
    // Enhanced security monitoring
    const handleVisibilityChange = () => {
      if (document.hidden && !isFinished) {
        handleViolation("Tab/Window Switch");
      }
    };
    
    // Monitor fullscreen changes
    const handleFullscreenChange = () => {
      if (!isInFullscreen() && !isFinished) {
        handleViolation("Exited Fullscreen");
        // Auto re-enter fullscreen after violation
        setTimeout(() => {
          if (!isFinished) {
            enterFullscreen();
          }
        }, 1000);
      }
    };
    
    const handleFocus = () => {
      lastFocusTime.current = Date.now();
    };
    
    const handleBlur = () => {
      if (!isFinished) {
        handleViolation("Focus Lost");
      }
    };
    
    // Detect multiple tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'examTabCount' && !isFinished) {
        const currentCount = parseInt(localStorage.getItem('examTabCount') || '1');
        if (currentCount > 1) {
          handleViolation("Multiple Tabs Detected");
        }
      }
    };
    
    // Set tab count
    const currentTabCount = parseInt(localStorage.getItem('examTabCount') || '0') + 1;
    localStorage.setItem('examTabCount', currentTabCount.toString());
    tabCountRef.current = currentTabCount;
    
    if (currentTabCount > 1) {
      handleViolation("Multiple Tabs Detected");
    }
    
    // Prevent right-click and common shortcuts
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleViolation("Right Click Attempt");
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block common cheating shortcuts
      if (
        e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'a' || e.key === 't' || e.key === 'n' || e.key === 'w') ||
        e.key === 'F12' ||
        e.key === 'F11' || // Block F11 fullscreen toggle
        e.key === 'Escape' || // Block Escape key (exits fullscreen)
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.key === 's') || // Block save
        (e.key === 'PrintScreen') || // Block screenshot
        e.altKey && e.key === 'Tab'
      ) {
        e.preventDefault();
        if (e.key === 'PrintScreen') {
          handleViolation("Screenshot Attempt");
        } else if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'a')) {
          handleViolation("Copy/Paste Attempt");
        } else {
          handleViolation("Prohibited Shortcut");
        }
      }
    };
    
    // Monitor screen changes
    const handleScreenChange = () => {
      if (screen.availWidth !== window.screen.availWidth || screen.availHeight !== window.screen.availHeight) {
        handleViolation("Screen Configuration Change");
      }
    };
    
    // Check for developer tools
    const checkDevTools = () => {
      const threshold = 160;
      if (window.outerHeight - window.innerHeight > threshold || window.outerWidth - window.innerWidth > threshold) {
        handleViolation("Developer Tools Detected");
      }
    };
    
    const devToolsInterval = setInterval(checkDevTools, 1000);
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        console.log("Timer tick - Time left:", newTime, "seconds");
        
        if (newTime <= 0) {
          clearInterval(timer);
          finishExam("Waktu Habis");
          return 0;
        }
        return newTime;
      });
    }, 1000);
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    window.addEventListener("storage", handleStorageChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleScreenChange);
    
    return () => {
      clearInterval(timer);
      clearInterval(devToolsInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleScreenChange);
      
      // Cleanup tab count
      const newCount = Math.max(0, tabCountRef.current - 1);
      if (newCount === 0) {
        localStorage.removeItem('examTabCount');
      } else {
        localStorage.setItem('examTabCount', newCount.toString());
      }
    };
  }, [isFinished, isLoading, violations]);

  const playWarningSound = () => {
    if (!audioContextRef.current) return;
    
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContextRef.current.currentTime);
    gainNode.gain.setValueAtTime(1, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContextRef.current.currentTime + 1);
    
    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + 0.5);
  };

  const handleViolation = (reason = "Unknown") => {
    const newViolations = violations + 1;
    setViolations(newViolations);
    setViolationReason(reason);
    
    console.log("🚨 Violation detected:", reason, "- Attempting to capture photo");
    
    // Try to capture photo with retry mechanism
    let photoData = null;
    
    // First attempt
    photoData = capturePhoto();
    
    // If first attempt fails, wait a bit and try again
    if (!photoData && videoRef.current) {
      console.log("🔄 First photo attempt failed, retrying...");
      setTimeout(() => {
        const retryPhoto = capturePhoto();
        if (retryPhoto) {
          // Update the violation record with the retry photo
          const retryViolationData: any = {};
          retryViolationData[`violationSnapshot_${newViolations}`] = {
            imageData: retryPhoto,
            timestamp: new Date().toISOString(),
            violationType: reason
          };
          
          updateDoc(sessionDocRef, retryViolationData).catch(error => {
            console.error("Failed to save retry photo:", error);
          });
        }
      }, 500);
    }
    
    // Prepare violation data
    const violationData: any = {
      violations: newViolations,
      lastViolation: { 
        reason, 
        timestamp: new Date(),
        hasSnapshot: !!photoData
      }
    };
    
    // Add photo if captured
    if (photoData) {
      console.log("✅ Adding photo to violation data");
      violationData[`violationSnapshot_${newViolations}`] = {
        imageData: photoData,
        timestamp: new Date().toISOString(),
        violationType: reason
      };
    } else {
      console.log("❌ No photo captured for violation");
    }
    
    // Save to Firebase
    updateDoc(sessionDocRef, violationData).catch(error => {
      console.error("Failed to save violation data:", error);
    });
    
    playWarningSound();
    
    if (newViolations >= 3) {
      finishExam(`Diskualifikasi: ${reason}`);
    } else {
      setShowViolationModal(true);
      
      // For first two violations, auto re-enter fullscreen after showing warning
      if (newViolations <= 2) {
        setTimeout(() => {
          setShowViolationModal(false);
          // Auto re-enter fullscreen immediately after closing modal
          setTimeout(() => {
            if (!isFinished && !isInFullscreen()) {
              enterFullscreen();
            }
          }, 100);
        }, 3000);
      } else {
        // For third violation, modal stays open (exam will be finished)
        setTimeout(() => setShowViolationModal(false), 3000);
      }
    }
  };

  const handleViolationOld = (reason = "Unknown") => {
    const newViolations = violations + 1;
    setViolations(newViolations);
    setViolationReason(reason);
    
    // Capture snapshot on violation
    captureViolationSnapshot(reason).then(snapshot => {
      const violationData = {
        violations: newViolations,
        lastViolation: { reason, timestamp: new Date() }
      };
      
      if (snapshot) {
        violationData[`violationSnapshot_${newViolations}`] = snapshot;
      }
      
      updateDoc(sessionDocRef, violationData);
    }).catch(error => {
      console.error("Error in violation handling:", error);
    });
    
    playWarningSound();
    
    if (newViolations >= 3) {
      finishExam(`Diskualifikasi: ${reason}`);
    } else {
      setShowViolationModal(true);
      setTimeout(() => setShowViolationModal(false), 3000);
      
      // Auto re-enter fullscreen after violation
      setTimeout(() => {
        if (!isFinished && !isInFullscreen()) {
          enterFullscreen();
        }
      }, 1500);
    }
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);
    updateDoc(sessionDocRef, { answers: newAnswers });
  };
  
  const checkUnansweredQuestions = () => {
    const unanswered = questions
      .map((q, index) => ({ question: q, index: index + 1 }))
      .filter(({ question }) => !answers[question.id] && answers[question.id] !== 0)
      .map(({ index }) => index);
    
    return unanswered;
  };
  
  const handleFinishAttempt = () => {
    const unanswered = checkUnansweredQuestions();
    if (unanswered.length > 0) {
      setUnansweredQuestions(unanswered);
      setShowUnansweredModal(true);
    } else {
      setShowConfirmModal(true);
    }
  };
  
  const finishExam = async (reason = "Selesai") => {
    if (isFinished) return;
    
    console.log("Finishing exam with reason:", reason);
    
    // Capture final attendance photo before finishing
    const finalLabel = "Selesai";
    await captureAttendancePhoto(finalLabel);
    
    setIsFinished(true);
    setShowConfirmModal(false);
    setShowUnansweredModal(false);
    
    // Clear attendance photo timer
    if (attendanceIntervalRef.current) {
      clearInterval(attendanceIntervalRef.current);
    }
    
    // Exit fullscreen when exam is finished
    if (isInFullscreen()) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      } catch (error) {
        console.error("Failed to exit fullscreen:", error);
      }
    }
    
    let score = 0;
    let status = 'finished';
    
    if (reason.startsWith("Diskualifikasi")) {
      score = 0;
      status = 'disqualified';
    } else {
      const mcQuestions = questions.filter(q => q.type === 'mc');
      mcQuestions.forEach(q => {
        if (q.correctAnswer === answers[q.id]) {
          score++;
        }
      });
      score = mcQuestions.length > 0 ? (score / mcQuestions.length) * 100 : 0;
    }
    
    setFinalScore(score);
    console.log("Final score calculated:", score);
    
    await updateDoc(sessionDocRef, { 
      status, 
      finishTime: new Date(), 
      finalScore: score, 
      answers 
    });
    
    console.log("Exam finished successfully");
  };

  if (isLoading) {
    return <div className="text-center p-8">Memuat soal ujian...</div>;
  }
  
  if (!isFullscreenSupported) {
    return (
      <div className="text-center h-screen flex flex-col justify-center items-center -mt-16">
        <div className="bg-red-800 p-8 rounded-lg shadow-xl max-w-md">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Browser Tidak Didukung</h2>
          <p className="text-gray-300 mb-4">
            Browser Anda tidak mendukung mode fullscreen yang diperlukan untuk ujian ini.
          </p>
          <p className="text-sm text-gray-400">
            Silakan gunakan browser modern seperti Chrome, Firefox, atau Edge versi terbaru.
          </p>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="text-center h-screen flex flex-col justify-center items-center -mt-16">
        {finalScore === 0 && violations >= 3 ? (
          <>
            <h2 className="text-4xl font-bold text-red-500 mb-4">Ujian Dihentikan!</h2>
            <p className="text-xl text-gray-300">
              Anda telah melebihi batas pelanggaran yang diizinkan.
            </p>
            <p className="text-2xl font-bold mt-4">
              Nilai Anda: <span className="text-red-500">0</span>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-4xl font-bold text-green-400 mb-4">Ujian Selesai!</h2>
            <p className="text-xl text-gray-300">Terima kasih telah menyelesaikan ujian.</p>
            <p className="text-2xl font-bold mt-4">
              Nilai Pilihan Ganda Anda: <span className="text-green-400">{finalScore?.toFixed(2)}</span>
            </p>
            <p className="text-lg text-gray-400 mt-2">
              Nilai esai (jika ada) akan diperiksa oleh dosen.
            </p>
            <button 
              onClick={() => navigateTo('student_dashboard', { currentUser: user, clearHistory: true })}
              className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
            >
              🏠 Kembali ke Dashboard
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <Modal 
        isOpen={showConfirmModal} 
        title="Selesaikan Ujian?" 
        onCancel={() => setShowConfirmModal(false)} 
        onConfirm={() => finishExam("Selesai")} 
        confirmText="Ya, Selesaikan" 
        confirmColor="green"
      >
        <p>Apakah Anda yakin ingin menyelesaikan ujian? Anda tidak dapat kembali setelah ini.</p>
      </Modal>

      <Modal 
        isOpen={showUnansweredModal} 
        title="Ada Soal yang Belum Dijawab" 
        onCancel={() => setShowUnansweredModal(false)} 
        onConfirm={() => setShowConfirmModal(true)} 
        confirmText="Tetap Selesaikan" 
        confirmColor="red"
        cancelText="Kembali Mengerjakan"
      >
        <p className="mb-3">Anda belum menjawab soal nomor:</p>
        <div className="bg-gray-700 p-3 rounded-md mb-3">
          <span className="font-bold text-yellow-400">
            {unansweredQuestions.join(', ')}
          </span>
        </div>
        <p className="text-sm text-gray-400">
          Apakah Anda yakin ingin menyelesaikan ujian tanpa menjawab soal-soal tersebut?
        </p>
      </Modal>

      {showViolationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
          <div className="bg-gray-800 border-2 border-yellow-500 p-8 rounded-lg text-center shadow-2xl">
            <AlertIcon />
            <h3 className="text-3xl font-bold text-yellow-400 mt-4">PERINGATAN!</h3>
            <p className="text-lg mt-2">Pelanggaran Terdeteksi: {violationReason}</p>
            <p className="text-sm text-red-400 mt-1">Sistem monitoring aktif!</p>
            <p className="text-2xl font-bold mt-2">
              Kesempatan tersisa: <span className="text-white">{3 - violations}</span>
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Foto telah diambil sebagai bukti pelanggaran
            </p>
            <div className="mt-4 bg-red-900 border border-red-500 p-3 rounded-md">
              <p className="text-red-300 text-sm font-bold">
                ⚠️ <strong>PERINGATAN PENTING:</strong>
              </p>
              <p className="text-red-200 text-xs mt-1">
                Jika Anda mengunjungi tab baru atau desktop baru maka akan langsung didiskualifikasi tanpa peringatan tambahan.
              </p>
            </div>
            <div className="mt-4 bg-blue-900 border border-blue-500 p-3 rounded-md">
              <p className="text-blue-300 text-sm font-bold">
                💡 Tekan Enter atau Spasi untuk melanjutkan ujian
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hidden video element for violation snapshots */}
      {/* Live camera feed for student and violation capture */}
      <div className="fixed top-4 right-4 z-50 bg-gray-800 rounded-lg border-2 border-gray-600 overflow-hidden shadow-lg">
        <div className="bg-gray-700 px-2 py-1 text-xs text-white text-center">
          📷 Live Camera
        </div>
        <div className="relative">
          <video 
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-40 h-30 object-cover"
          />
          {!isCameraReady && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
              <div className="text-center text-xs text-gray-400">
                {cameraError ? (
                  <>
                    <div>❌ Camera Error</div>
                    <div className="mt-1">Retry {cameraInitRetryCount.current}/{maxCameraRetries}</div>
                  </>
                ) : (
                  <>
                    <div>⏳ Loading...</div>
                    <div className="mt-1">Initializing</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="bg-gray-700 px-2 py-1 flex justify-between items-center">
          <button
            onClick={() => setShowCameraControls(!showCameraControls)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {showCameraControls ? '▼' : '▶'} Perbaiki Kamera
          </button>
          <div className="text-xs text-gray-400">
            {isCameraReady ? '🟢' : '🔴'}
          </div>
        </div>
        {showCameraControls && (
          <div className="bg-gray-700 px-2 py-2 border-t border-gray-600">
            <button
              onClick={restartCamera}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-2 rounded"
            >
              🔄 Restart Camera
            </button>
            {cameraError && (
              <div className="mt-1 text-xs text-red-400 text-center">
                {cameraError}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Audio Control Panel */}
      <div className="fixed top-4 left-4 bg-gray-800 text-white px-3 py-2 rounded text-xs z-40 border">
        <div className="mb-2">
          {vadInstance ? (
            <span className="text-green-400">🔊 Audio Monitor: Active</span>
          ) : vadError ? (
            <span className="text-red-400">🔇 Audio: Error</span>
          ) : isRestartingAudio ? (
            <span className="text-yellow-400">🔄 Audio: Restarting...</span>
          ) : (
            <span className="text-yellow-400">🔊 Audio: Initializing</span>
          )}
        </div>
        
        <div className="text-xs text-gray-400 mb-2">
          Jumlah Pelanggaran: {violations}/3
        </div>
        <div className="text-xs text-blue-400 mb-2">
          📸 Foto Absen: {attendancePhotoCount}
        </div>
        <div className="text-xs text-purple-400 mb-2">
          🎤 Human Voice: {audioRecordingCount}
        </div>
        
        {isRecordingAudio && (
          <div className="text-xs text-red-400 mb-2 animate-pulse">
            🔴 Recording Audio...
          </div>
        )}
        
        {/* Audio Control Button */}
        <button
          onClick={restartAudioMonitoring}
          disabled={isRestartingAudio}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-1 px-2 rounded disabled:bg-purple-400"
        >
          {isRestartingAudio ? '🔄 Restarting...' : '🔄 Restart Audio'}
        </button>
        
        {vadError && (
          <div className="mt-1 text-xs text-red-400 text-center">
            {vadError}
          </div>
        )}
        
        {streamRef.current && (
          <div className="text-xs text-gray-400 mt-1">
            Stream: {streamRef.current.active ? '🟢 Active' : '🔴 Inactive'}
          </div>
        )}
      </div>
      
      {/* Hidden canvas for photo capture */}
      <canvas 
        ref={canvasRef}
        style={{ 
          position: 'absolute',
          top: '-1000px',
          left: '-1000px',
          pointerEvents: 'none'
        }}
      />
      

      <div className="bg-gray-800 p-4 rounded-lg shadow-lg sticky top-4 z-10 flex justify-between items-center">
        <div className="w-full">
          <div className="flex justify-center mb-4">
            <div className="text-center">
              <div className="text-3xl font-mono bg-gray-900 px-6 py-3 rounded-lg mb-2">
                {Math.floor(timeLeft / 3600).toString().padStart(2, '0')}:
                {Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0')}:
                {(timeLeft % 60).toString().padStart(2, '0')}
              </div>
              <div className="flex justify-center space-x-4 text-sm">
                <div className="text-red-500">Pelanggaran: {violations}/3</div>
                <div className="text-blue-400">📸 Foto Absen: {attendancePhotoCount}</div>
                <div className="text-purple-400">🎤 Suara Manusia: {audioRecordingCount}</div>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">{exam.name}</h2>
              <p className="text-sm text-gray-400">{studentInfo.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Kode: {exam.code}</p>
            </div>
          </div>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="text-center p-8 mt-8 bg-gray-800 rounded-lg">
          <h3 className="text-2xl font-bold text-yellow-400 mb-4">Ujian Belum Siap</h3>
          <p className="text-gray-300">
            Tidak ada soal yang tersedia untuk ujian ini. Silakan hubungi dosen atau pengawas ujian Anda.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {questions.map((q, index) => (
            <div key={q.id} className="bg-gray-800 p-6 rounded-lg">
              <p className="font-semibold text-lg mb-4">{index + 1}. {q.text}</p>
              
              {q.type === 'mc' && q.options && (
                <div className="space-y-3">
                  {q.options.map((opt, i) => (
                    <label 
                      key={i} 
                      className={`block p-3 rounded-md cursor-pointer transition-colors ${
                        answers[q.id] === i 
                          ? 'bg-indigo-600' 
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name={q.id} 
                        checked={answers[q.id] === i} 
                        onChange={() => handleAnswerChange(q.id, i)} 
                        className="hidden" 
                      />
                      <span className="ml-2">{String.fromCharCode(65 + i)}. {opt}</span>
                    </label>
                  ))}
                </div>
              )}
              
              {q.type === 'essay' && (
                <textarea 
                  value={answers[q.id] || ''} 
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)} 
                  placeholder="Ketik jawaban esai Anda di sini..." 
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 h-32"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <button 
        onClick={handleFinishAttempt} 
        className="mt-8 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg text-lg" 
        disabled={questions.length === 0}
      >
        Selesaikan Ujian
      </button>
    </div>
  );
};

export default StudentExam;