import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, updateDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
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
  const { sessionId, exam, studentInfo, maxFaceCount: initialMaxFaceCount } = appState;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [violations, setViolations] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [faceCount, setFaceCount] = useState(0);
  const [maxFaceCount, setMaxFaceCount] = useState(initialMaxFaceCount || 0);
  const [totalFacePhotos, setTotalFacePhotos] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const faceDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const attendanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastViolationTimeRef = useRef<number>(0);
  const examStartTimeRef = useRef<Date>(new Date());

  // Initialize camera and face detection
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240 }, 
          audio: true 
        });
        
        mediaStreamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            startFaceDetection();
            startAttendanceCapture();
          };
        }
      } catch (error) {
        console.error('Failed to access camera:', error);
      }
    };

    initializeCamera();
    
    return () => {
      // Cleanup
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
      if (attendanceIntervalRef.current) {
        clearInterval(attendanceIntervalRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startFaceDetection = () => {
    if (!videoRef.current || !faceDetectionService.isModelLoaded()) return;
    
    // Clear existing interval
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }
    
    // Start face detection every 3 seconds
    faceDetectionIntervalRef.current = setInterval(async () => {
      if (videoRef.current && faceDetectionService.isModelLoaded()) {
        try {
          const detectedFaces = await faceDetectionService.detectFacesInVideo(videoRef.current);
          setFaceCount(detectedFaces);
          
          // Track maximum face count
          if (detectedFaces > maxFaceCount) {
            setMaxFaceCount(detectedFaces);
          }
          
          // Take photo if faces detected (any number of faces)
          if (detectedFaces > 0) {
            await captureFacePhoto(detectedFaces);
          }
          
          console.log(`Detected ${detectedFaces} faces during exam`);
        } catch (error) {
          console.error("Face detection error during exam:", error);
        }
      }
    }, 3000);
  };

  const captureFacePhoto = async (faceCount: number) => {
    if (!videoRef.current) return;
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = videoRef.current.videoWidth || 320;
      canvas.height = videoRef.current.videoHeight || 240;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      const timestamp = new Date().toISOString();
      
      // Save face photo to session
      const sessionRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
      const photoKey = `facePhoto_${Date.now()}`;
      
      await updateDoc(sessionRef, {
        [photoKey]: {
          imageData: imageData,
          timestamp: timestamp,
          faceCount: faceCount,
          label: `${faceCount} wajah terdeteksi`
        }
      });
      
      setTotalFacePhotos(prev => prev + 1);
      console.log(`Face photo captured: ${faceCount} faces detected`);
      
    } catch (error) {
      console.error('Error capturing face photo:', error);
    }
  };

  const startAttendanceCapture = () => {
    examStartTimeRef.current = new Date();
    
    // Capture attendance photo every 5 minutes
    attendanceIntervalRef.current = setInterval(async () => {
      await captureAttendancePhoto();
    }, 5 * 60 * 1000); // 5 minutes
    
    // Capture initial photo
    setTimeout(() => captureAttendancePhoto(), 1000);
  };

  const captureAttendancePhoto = async () => {
    if (!videoRef.current) return;
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = videoRef.current.videoWidth || 320;
      canvas.height = videoRef.current.videoHeight || 240;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      const timestamp = new Date().toISOString();
      const elapsedMinutes = Math.floor((new Date().getTime() - examStartTimeRef.current.getTime()) / (1000 * 60));
      
      const sessionRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
      const photoKey = `attendancePhoto_${Date.now()}`;
      
      let label = `Menit ke-${elapsedMinutes}`;
      if (elapsedMinutes === 0) label = 'Mulai ujian';
      
      await updateDoc(sessionRef, {
        [photoKey]: {
          imageData: imageData,
          timestamp: timestamp,
          label: label
        }
      });
      
      console.log(`Attendance photo captured: ${label}`);
      
    } catch (error) {
      console.error('Error capturing attendance photo:', error);
    }
  };

  // Load questions
  useEffect(() => {
    if (!exam?.id) return;
    
    const loadQuestions = async () => {
      try {
        const questionsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/questions`);
        const questionsSnapshot = await getDocs(questionsRef);
        const questionsData = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setQuestions(questionsData);
      } catch (error) {
        console.error('Error loading questions:', error);
      }
    };
    
    loadQuestions();
  }, [exam?.id]);

  // Initialize timer
  useEffect(() => {
    if (!exam) return;
    
    const endTime = new Date(exam.endTime).getTime();
    const now = new Date().getTime();
    const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
    
    setTimeLeft(timeRemaining);
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [exam]);

  // Anti-cheat monitoring
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('Tab/Window Switch', 'Siswa beralih ke tab atau aplikasi lain');
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        recordViolation('Fullscreen Exit', 'Siswa keluar dari mode fullscreen');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block common cheating shortcuts
      const blockedKeys = [
        'F12', 'F11', 'F5',
        'PrintScreen', 'Insert',
        'ContextMenu'
      ];
      
      const blockedCombos = [
        { ctrl: true, key: 'c' },
        { ctrl: true, key: 'v' },
        { ctrl: true, key: 'a' },
        { ctrl: true, key: 's' },
        { ctrl: true, key: 'p' },
        { ctrl: true, key: 'u' },
        { ctrl: true, shift: true, key: 'I' },
        { ctrl: true, shift: true, key: 'J' },
        { ctrl: true, shift: true, key: 'C' },
        { alt: true, key: 'Tab' },
        { meta: true, key: 'c' },
        { meta: true, key: 'v' }
      ];
      
      if (blockedKeys.includes(e.key)) {
        e.preventDefault();
        recordViolation('Blocked Key', `Mencoba menggunakan tombol ${e.key}`);
        return;
      }
      
      for (const combo of blockedCombos) {
        if (
          (combo.ctrl && e.ctrlKey) &&
          (combo.shift ? e.shiftKey : true) &&
          (combo.alt ? e.altKey : true) &&
          (combo.meta ? e.metaKey : true) &&
          e.key.toLowerCase() === combo.key.toLowerCase()
        ) {
          e.preventDefault();
          recordViolation('Blocked Shortcut', `Mencoba menggunakan shortcut ${e.key}`);
          return;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    
    // Disable right-click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      recordViolation('Right Click', 'Mencoba membuka context menu');
    };
    
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const recordViolation = async (violationType: string, description: string) => {
    const now = Date.now();
    
    // Prevent spam violations (minimum 5 seconds between violations)
    if (now - lastViolationTimeRef.current < 5000) {
      return;
    }
    
    lastViolationTimeRef.current = now;
    
    const newViolationCount = violations + 1;
    setViolations(newViolationCount);
    
    // Show warning
    setWarningMessage(`⚠️ PELANGGARAN ${newViolationCount}/3: ${description}`);
    setShowWarning(true);
    
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(false);
    }, 5000);
    
    try {
      // Capture violation photo
      let violationImageData = '';
      if (videoRef.current) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = videoRef.current.videoWidth || 320;
          canvas.height = videoRef.current.videoHeight || 240;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          violationImageData = canvas.toDataURL('image/jpeg', 0.8);
        }
      }
      
      const sessionRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
      const updateData: any = {
        violations: newViolationCount,
        lastViolation: {
          reason: description,
          timestamp: new Date().toISOString(),
          hasSnapshot: !!violationImageData
        }
      };
      
      // Store violation snapshot
      if (violationImageData) {
        updateData[`violationSnapshot_${newViolationCount}`] = {
          imageData: violationImageData,
          timestamp: new Date().toISOString(),
          violationType: violationType
        };
      }
      
      await updateDoc(sessionRef, updateData);
      
      // Auto-disqualify after 3 violations
      if (newViolationCount >= 3) {
        await handleDisqualification();
      }
      
    } catch (error) {
      console.error('Error recording violation:', error);
    }
  };

  const handleDisqualification = async () => {
    try {
      const sessionRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
      await updateDoc(sessionRef, {
        status: 'disqualified',
        finishTime: new Date(),
        answers: answers,
        finalScore: 0
      });
      
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      
      // Stop media streams
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      alert('Anda telah didiskualifikasi karena melakukan 3 pelanggaran. Ujian berakhir.');
      navigateTo('student_dashboard', { currentUser: user, clearHistory: true });
      
    } catch (error) {
      console.error('Error handling disqualification:', error);
    }
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleAutoSubmit = async () => {
    await submitExam(true);
  };

  const handleManualSubmit = async () => {
    // Check for unanswered questions
    const unansweredQuestions = questions.filter(q => !answers[q.id]);
    
    if (unansweredQuestions.length > 0) {
      const confirmSubmit = window.confirm(
        `Anda memiliki ${unansweredQuestions.length} soal yang belum dijawab. Yakin ingin menyelesaikan ujian?`
      );
      
      if (!confirmSubmit) return;
    }
    
    await submitExam(false);
  };

  const submitExam = async (isAutoSubmit: boolean) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Calculate MC score
      let mcScore = 0;
      let mcQuestionCount = 0;
      
      questions.forEach(question => {
        if (question.type === 'mc') {
          mcQuestionCount++;
          const studentAnswer = answers[question.id];
          if (studentAnswer === question.correctAnswer) {
            mcScore++;
          }
        }
      });
      
      const mcPercentage = mcQuestionCount > 0 ? (mcScore / mcQuestionCount) * 100 : 0;
      
      // Capture final attendance photo
      await captureAttendancePhoto();
      
      const sessionRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
      await updateDoc(sessionRef, {
        status: 'finished',
        finishTime: new Date(),
        answers: answers,
        finalScore: mcPercentage,
        maxFaceCount: maxFaceCount,
        totalFacePhotos: totalFacePhotos,
        submissionType: isAutoSubmit ? 'auto' : 'manual'
      });
      
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      
      // Stop media streams
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Navigate to results
      navigateTo('student_dashboard', { currentUser: user, clearHistory: true });
      
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Gagal menyelesaikan ujian. Silakan coba lagi.');
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-300">Memuat soal ujian...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-red-900 bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-red-800 border-2 border-red-600 rounded-lg p-8 max-w-md text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-4">PERINGATAN!</h2>
            <p className="text-lg mb-4">{warningMessage}</p>
            <p className="text-sm text-red-200">
              {violations >= 3 ? 'Anda akan didiskualifikasi!' : `${3 - violations} pelanggaran lagi akan menyebabkan diskualifikasi.`}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex justify-between items-center">
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
                faceCount === 0 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {maxFaceCount} wajah
              </div>
              <div className="text-xs text-gray-500">
                (Saat ini: {faceCount})
              </div>
            </div>
            
            {/* Violations */}
            <div className="text-center">
              <div className="text-sm text-gray-400">Pelanggaran</div>
              <div className={`text-lg font-bold ${violations >= 2 ? 'text-red-400' : violations >= 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                {violations}/3
              </div>
            </div>
            
            {/* Timer */}
            <div className="text-center">
              <div className="text-sm text-gray-400">Waktu Tersisa</div>
              <div className={`text-lg font-bold ${timeLeft < 300 ? 'text-red-400' : 'text-white'}`}>
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-screen">
        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Question Navigation */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`w-10 h-10 rounded-lg font-bold ${
                    index === currentQuestionIndex
                      ? 'bg-indigo-600 text-white'
                      : answers[questions[index].id]
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-400">
              Soal {currentQuestionIndex + 1} dari {questions.length}
            </p>
          </div>

          {/* Current Question */}
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              {currentQuestionIndex + 1}. {currentQuestion.text}
            </h2>

            {currentQuestion.type === 'mc' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <label key={index} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-700 p-3 rounded-lg">
                    <input
                      type="radio"
                      name={`question_${currentQuestion.id}`}
                      value={index}
                      checked={answers[currentQuestion.id] === index}
                      onChange={() => handleAnswerChange(currentQuestion.id, index)}
                      className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600"
                    />
                    <span className="text-gray-300">{String.fromCharCode(65 + index)}. {option}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.type === 'essay' && (
              <textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                placeholder="Tulis jawaban Anda di sini..."
                className="w-full h-40 p-4 bg-gray-700 border border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-800 disabled:cursor-not-allowed"
            >
              ← Sebelumnya
            </button>
            
            <button
              onClick={handleManualSubmit}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-red-400"
            >
              {isSubmitting ? 'Menyelesaikan...' : 'Selesaikan Ujian'}
            </button>
            
            <button
              onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
              disabled={currentQuestionIndex === questions.length - 1}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-800 disabled:cursor-not-allowed"
            >
              Selanjutnya →
            </button>
          </div>
        </div>

        {/* Sidebar - Camera Feed */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-4">
          <h3 className="text-lg font-semibold mb-4">Monitoring Kamera</h3>
          
          <div className="mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video bg-gray-900 rounded-lg"
            />
          </div>
          
          {/* Face Detection Info */}
          <div className="bg-blue-900 border border-blue-500 p-3 rounded-lg mb-4">
            <h4 className="text-blue-300 font-bold mb-2">👤 Deteksi Wajah</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-200">Saat ini:</span>
                <span className={`font-bold ${
                  faceCount === 1 ? 'text-green-400' : 
                  faceCount === 0 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {faceCount} wajah
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-200">Maksimal:</span>
                <span className={`font-bold ${
                  maxFaceCount === 1 ? 'text-green-400' : 
                  maxFaceCount === 0 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {maxFaceCount} wajah
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-200">Total foto:</span>
                <span className="font-bold text-purple-400">
                  {totalFacePhotos} foto
                </span>
              </div>
            </div>
          </div>
          
          {/* Status Info */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className="text-green-400 font-bold">Aktif</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pelanggaran:</span>
              <span className={`font-bold ${violations >= 2 ? 'text-red-400' : violations >= 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                {violations}/3
              </span>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            <p>• Tetap di depan kamera</p>
            <p>• Jangan keluar dari fullscreen</p>
            <p>• Jangan beralih ke aplikasi lain</p>
            <p>• Foto otomatis saat wajah terdeteksi</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentExam;