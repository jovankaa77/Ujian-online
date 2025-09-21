import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, updateDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import { faceDetectionService } from '../../utils/faceDetection';

interface Question {
  id: string;
  text: string;
  type: 'mc' | 'essay';
  options?: string[];
  correctAnswer?: number;
}

interface StudentExamProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  appState: any;
  user: any;
}

const StudentExam: React.FC<StudentExamProps> = ({ navigateTo, navigateBack, appState, user }) => {
  const { sessionId, exam, studentInfo } = appState;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [violations, setViolations] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [faceCount, setFaceCount] = useState(0);
  const [maxFaceCount, setMaxFaceCount] = useState(0);
  const [isFaceDetectionActive, setIsFaceDetectionActive] = useState(true);
  const [lastFaceDetectionTime, setLastFaceDetectionTime] = useState<Date | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const faceDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const attendancePhotoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const voiceDetectionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Initialize camera and face detection
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        mediaStreamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Initialize audio monitoring
        initializeAudioMonitoring(stream);
        
        // Start face detection
        startFaceDetection();
        
        // Start attendance photo capture
        startAttendancePhotoCapture();
        
      } catch (error) {
        console.error('Failed to initialize camera:', error);
      }
    };

    initializeCamera();

    return () => {
      // Cleanup
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
      if (attendancePhotoIntervalRef.current) {
        clearInterval(attendancePhotoIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Face detection function
  const detectFaces = useCallback(async () => {
    if (!videoRef.current || !isFaceDetectionActive || !faceDetectionService.isModelLoaded()) {
      return;
    }

    try {
      const detectedFaceCount = await faceDetectionService.detectFaces(videoRef.current);
      setFaceCount(detectedFaceCount);
      setLastFaceDetectionTime(new Date());
      
      // Update max face count
      if (detectedFaceCount > maxFaceCount) {
        setMaxFaceCount(detectedFaceCount);
      }

      // Capture photo if faces detected
      if (detectedFaceCount > 0) {
        await captureFaceDetectionPhoto(detectedFaceCount);
      }

    } catch (error) {
      console.error('Face detection error:', error);
    }
  }, [isFaceDetectionActive, maxFaceCount]);

  // Start face detection
  const startFaceDetection = useCallback(() => {
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }
    
    faceDetectionIntervalRef.current = setInterval(detectFaces, 2000); // Every 2 seconds
  }, [detectFaces]);

  // Capture face detection photo
  const captureFaceDetectionPhoto = async (detectedFaces: number) => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const timestamp = new Date().toISOString();

    try {
      const sessionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
      const facePhotoKey = `faceDetectionPhoto_${Date.now()}`;
      
      await updateDoc(sessionDocRef, {
        [facePhotoKey]: {
          imageData,
          timestamp,
          faceCount: detectedFaces,
          label: `${detectedFaces} Wajah Terdeteksi`
        }
      });

      console.log(`📸 Face detection photo captured: ${detectedFaces} faces`);
    } catch (error) {
      console.error('Failed to save face detection photo:', error);
    }
  };

  // Refresh face detection
  const refreshFaceDetection = () => {
    setIsFaceDetectionActive(false);
    setTimeout(() => {
      setIsFaceDetectionActive(true);
      setFaceCount(0);
      startFaceDetection();
    }, 1000);
  };

  // Initialize audio monitoring
  const initializeAudioMonitoring = async (stream: MediaStream) => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
      
      analyserRef.current.fftSize = 256;
      microphoneRef.current.connect(analyserRef.current);
      
      startVoiceDetection();
    } catch (error) {
      console.error('Failed to initialize audio monitoring:', error);
    }
  };

  // Voice detection
  const startVoiceDetection = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const detectVoice = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      
      // Voice threshold
      if (average > 30 && !isRecordingRef.current) {
        startVoiceRecording();
      }
      
      requestAnimationFrame(detectVoice);
    };
    
    detectVoice();
  };

  // Start voice recording
  const startVoiceRecording = async () => {
    if (!mediaStreamRef.current || isRecordingRef.current) return;

    try {
      isRecordingRef.current = true;
      recordedChunksRef.current = [];

      mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current, {
        mimeType: 'audio/webm'
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        await saveVoiceRecording(blob);
        isRecordingRef.current = false;
      };

      mediaRecorderRef.current.start();

      // Stop recording after 5 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 5000);

    } catch (error) {
      console.error('Failed to start voice recording:', error);
      isRecordingRef.current = false;
    }
  };

  // Save voice recording
  const saveVoiceRecording = async (blob: Blob) => {
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const audioData = reader.result as string;
        const timestamp = new Date().toISOString();
        const duration = 5; // 5 seconds

        const sessionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
        const voiceKey = `voiceRecording_${Date.now()}`;
        
        await updateDoc(sessionDocRef, {
          [voiceKey]: {
            audioData,
            timestamp,
            duration,
            studentId: user.id,
            studentName: studentInfo.name
          }
        });

        console.log('🎤 Voice recording saved');
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Failed to save voice recording:', error);
    }
  };

  // Attendance photo capture
  const startAttendancePhotoCapture = () => {
    const capturePhoto = async (label: string) => {
      if (!videoRef.current || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);

      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      const timestamp = new Date().toISOString();

      try {
        const sessionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
        const photoKey = `attendancePhoto_${Date.now()}`;
        
        await updateDoc(sessionDocRef, {
          [photoKey]: {
            imageData,
            timestamp,
            label
          }
        });

        console.log(`📸 Attendance photo captured: ${label}`);
      } catch (error) {
        console.error('Failed to save attendance photo:', error);
      }
    };

    // Schedule photos at specific intervals
    const schedulePhotoCapture = (minutes: number, label: string) => {
      setTimeout(() => {
        capturePhoto(label);
      }, minutes * 60 * 1000);
    };

    // Schedule photos every 5 minutes for first hour, then every 10 minutes
    const photoSchedule = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120];
    
    photoSchedule.forEach(minute => {
      schedulePhotoCapture(minute, `Menit ke-${minute}`);
    });

    // Final photo when exam ends
    const examDuration = Math.ceil((new Date(exam.endTime).getTime() - new Date().getTime()) / (1000 * 60));
    if (examDuration > 0) {
      schedulePhotoCapture(examDuration, 'Selesai');
    }
  };

  // Load questions
  useEffect(() => {
    const loadQuestions = async () => {
      const questionsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/questions`);
      const snapshot = await getDocs(questionsRef);
      const questionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      setQuestions(questionsData);
    };

    loadQuestions();
  }, [exam.id]);

  // Timer
  useEffect(() => {
    const endTime = new Date(exam.endTime).getTime();
    const updateTimer = () => {
      const now = new Date().getTime();
      const remaining = Math.max(0, endTime - now);
      setTimeLeft(Math.floor(remaining / 1000));
      
      if (remaining <= 0) {
        handleSubmit(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [exam.endTime]);

  // Anti-cheat monitoring
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('Tab/Window Switch');
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        recordViolation('Exited Fullscreen');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block common cheat keys
      const blockedKeys = ['F12', 'F11', 'PrintScreen'];
      const blockedCombos = [
        { ctrl: true, shift: true, key: 'I' }, // Dev tools
        { ctrl: true, shift: true, key: 'J' }, // Console
        { ctrl: true, key: 'U' }, // View source
        { ctrl: true, key: 'A' }, // Select all
        { ctrl: true, key: 'C' }, // Copy
        { ctrl: true, key: 'V' }, // Paste
        { ctrl: true, key: 'X' }, // Cut
        { alt: true, key: 'Tab' }, // Alt+Tab
      ];

      if (blockedKeys.includes(e.key) || 
          blockedCombos.some(combo => 
            (!combo.ctrl || e.ctrlKey) && 
            (!combo.shift || e.shiftKey) && 
            (!combo.alt || e.altKey) && 
            e.key === combo.key
          )) {
        e.preventDefault();
        recordViolation('Blocked Key Combination');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      recordViolation('Right Click Attempt');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const recordViolation = async (reason: string) => {
    const newViolations = violations + 1;
    setViolations(newViolations);
    
    setWarningMessage(`Pelanggaran terdeteksi: ${reason}. Pelanggaran ke-${newViolations}/3`);
    setShowWarning(true);
    
    // Capture violation photo
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        const sessionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
        await updateDoc(sessionDocRef, {
          violations: newViolations,
          [`violationSnapshot_${newViolations}`]: {
            imageData,
            timestamp: new Date().toISOString(),
            violationType: reason
          },
          lastViolation: {
            reason,
            timestamp: new Date().toISOString(),
            hasSnapshot: true
          }
        });
      }
    }
    
    if (newViolations >= 3) {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId), {
        status: 'disqualified',
        finishTime: new Date()
      });
      
      alert('Anda telah didiskualifikasi karena terlalu banyak pelanggaran.');
      navigateTo('student_dashboard', { currentUser: user, clearHistory: true });
    }
    
    setTimeout(() => setShowWarning(false), 5000);
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const calculateScore = () => {
    let score = 0;
    let totalMCQuestions = 0;
    
    questions.forEach(question => {
      if (question.type === 'mc') {
        totalMCQuestions++;
        if (answers[question.id] === question.correctAnswer) {
          score++;
        }
      }
    });
    
    return totalMCQuestions > 0 ? (score / totalMCQuestions) * 100 : 0;
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    if (isSubmitting) return;
    
    if (!isAutoSubmit) {
      const unansweredQuestions = questions.filter(q => answers[q.id] === undefined || answers[q.id] === '');
      if (unansweredQuestions.length > 0) {
        const confirmSubmit = window.confirm(
          `Masih ada ${unansweredQuestions.length} soal yang belum dijawab. Yakin ingin menyelesaikan ujian?`
        );
        if (!confirmSubmit) return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      const finalScore = calculateScore();
      const sessionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
      
      await updateDoc(sessionDocRef, {
        answers,
        finalScore,
        status: 'finished',
        finishTime: new Date(),
        maxFaceCount: maxFaceCount
      });
      
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      
      navigateTo('student_dashboard', { currentUser: user, clearHistory: true });
    } catch (error) {
      console.error('Failed to submit exam:', error);
      alert('Gagal mengirim jawaban. Silakan coba lagi.');
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-lg">Memuat soal ujian...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-red-900 bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-red-800 p-6 rounded-lg border-2 border-red-600 max-w-md">
            <h3 className="text-xl font-bold text-red-100 mb-4">⚠️ PERINGATAN!</h3>
            <p className="text-red-100 mb-4">{warningMessage}</p>
            <div className="text-center">
              <button 
                onClick={() => setShowWarning(false)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
        <div>
          <h1 className="text-xl font-bold">{exam.name}</h1>
          <p className="text-sm text-gray-400">{studentInfo.name} - {studentInfo.nim}</p>
        </div>
        
        <div className="flex items-center space-x-6">
          {/* Face Detection Status */}
          <div className="text-center">
            <div className="text-sm text-gray-400">Jumlah Wajah</div>
            <div className={`text-lg font-bold ${
              faceCount === 1 ? 'text-green-400' : 
              faceCount > 1 ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {isFaceDetectionActive ? faceCount : 'Tidak Aktif'}
            </div>
            <div className="text-xs text-gray-500">
              Max: {maxFaceCount}
            </div>
            {!isFaceDetectionActive && (
              <button
                onClick={refreshFaceDetection}
                className="mt-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
              >
                Refresh
              </button>
            )}
          </div>
          
          {/* Timer */}
          <div className="text-center">
            <div className="text-sm text-gray-400">Waktu Tersisa</div>
            <div className={`text-lg font-bold ${timeLeft < 300 ? 'text-red-400' : 'text-green-400'}`}>
              {formatTime(timeLeft)}
            </div>
          </div>
          
          {/* Violations */}
          <div className="text-center">
            <div className="text-sm text-gray-400">Pelanggaran</div>
            <div className={`text-lg font-bold ${violations > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {violations}/3
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Soal {currentQuestionIndex + 1} dari {questions.length}
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-4 py-2 rounded"
                >
                  ← Sebelumnya
                </button>
                <button
                  onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-4 py-2 rounded"
                >
                  Selanjutnya →
                </button>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <p className="text-lg mb-6">{currentQuestion.text}</p>

              {currentQuestion.type === 'mc' && currentQuestion.options && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => (
                    <label key={index} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-700 p-3 rounded">
                      <input
                        type="radio"
                        name={`question_${currentQuestion.id}`}
                        value={index}
                        checked={answers[currentQuestion.id] === index}
                        onChange={() => handleAnswerChange(currentQuestion.id, index)}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span>{String.fromCharCode(65 + index)}. {option}</span>
                    </label>
                  ))}
                </div>
              )}

              {currentQuestion.type === 'essay' && (
                <textarea
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="Tulis jawaban Anda di sini..."
                  className="w-full h-40 p-4 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>

            {/* Question Navigation */}
            <div className="mt-6 grid grid-cols-10 gap-2">
              {questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`p-2 rounded text-sm font-bold ${
                    index === currentQuestionIndex
                      ? 'bg-indigo-600 text-white'
                      : answers[questions[index].id] !== undefined && answers[questions[index].id] !== ''
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-300'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-3 px-8 rounded-lg"
              >
                {isSubmitting ? 'Mengirim...' : 'Selesaikan Ujian'}
              </button>
            </div>
          </div>
        </div>

        {/* Camera Feed */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-4">
          <h3 className="text-sm font-semibold mb-3">Monitoring Kamera</h3>
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video bg-gray-900 rounded-lg"
            />
            <canvas
              ref={canvasRef}
              className="hidden"
            />
            
            {/* Face Detection Overlay */}
            <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
              {isFaceDetectionActive ? (
                <span className={faceCount === 1 ? 'text-green-400' : faceCount > 1 ? 'text-red-400' : 'text-yellow-400'}>
                  {faceCount === 0 ? 'Tidak ada wajah' : 
                   faceCount === 1 ? '1 Wajah' : 
                   `${faceCount} Wajah`}
                </span>
              ) : (
                <span className="text-gray-400">Deteksi Tidak Aktif</span>
              )}
            </div>
            
            {lastFaceDetectionTime && (
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                {lastFaceDetectionTime.toLocaleTimeString()}
              </div>
            )}
          </div>
          
          <div className="mt-3 text-xs text-gray-400 space-y-1">
            <p>• Tetap di depan kamera</p>
            <p>• Jangan keluar dari fullscreen</p>
            <p>• Hindari aktivitas mencurigakan</p>
            <p>• Max wajah terdeteksi: {maxFaceCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentExam;