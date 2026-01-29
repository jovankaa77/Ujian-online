import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, updateDoc, doc, query, limit } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import { AlertIcon } from '../ui/Icons';
import Modal from '../ui/Modal';

const LANGUAGE_LABELS: Record<string, string> = {
  php: 'PHP',
  cpp: 'C++',
  python: 'Python',
  csharp: 'C#'
};

const CODE_TEMPLATES: Record<string, string> = {
  php: `<?php
// PHP Hello World
echo "Hello, World!";
?>`,
  cpp: `// C++ Hello World
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`,
  python: `# Python Hello World
print("Hello, World!")`,
  csharp: `// C# Hello World
using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello, World!");
    }
}`
};

const SYNTAX_COLORS: Record<string, Record<string, string>> = {
  php: {
    keywords: 'text-purple-400',
    strings: 'text-green-400',
    comments: 'text-gray-500',
    numbers: 'text-orange-400',
    functions: 'text-yellow-400',
    variables: 'text-red-400'
  },
  cpp: {
    keywords: 'text-purple-400',
    strings: 'text-green-400',
    comments: 'text-gray-500',
    numbers: 'text-orange-400',
    preprocessor: 'text-pink-400',
    types: 'text-cyan-400'
  },
  python: {
    keywords: 'text-purple-400',
    strings: 'text-green-400',
    comments: 'text-gray-500',
    numbers: 'text-orange-400',
    functions: 'text-yellow-400',
    decorators: 'text-pink-400'
  },
  csharp: {
    keywords: 'text-purple-400',
    strings: 'text-green-400',
    comments: 'text-gray-500',
    numbers: 'text-orange-400',
    types: 'text-cyan-400',
    preprocessor: 'text-pink-400'
  }
};

const highlightCode = (code: string, language: string): JSX.Element[] => {
  const lines = code.split('\n');

  const highlightLine = (line: string, lang: string): JSX.Element => {
    let highlighted = line;
    const elements: JSX.Element[] = [];
    let key = 0;

    const patterns: { regex: RegExp; className: string }[] = [];

    if (lang === 'php') {
      patterns.push(
        { regex: /(\/\/.*$|#.*$)/gm, className: 'text-gray-500 italic' },
        { regex: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
        { regex: /(<\?php|\?>)/g, className: 'text-red-500 font-bold' },
        { regex: /\b(echo|print|function|return|if|else|elseif|for|foreach|while|class|public|private|protected|static|new|use|namespace|require|include)\b/g, className: 'text-purple-400 font-semibold' },
        { regex: /(\$[a-zA-Z_][a-zA-Z0-9_]*)/g, className: 'text-red-400' },
        { regex: /\b(\d+\.?\d*)\b/g, className: 'text-orange-400' }
      );
    } else if (lang === 'cpp') {
      patterns.push(
        { regex: /(\/\/.*$)/gm, className: 'text-gray-500 italic' },
        { regex: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
        { regex: /(#include|#define|#ifdef|#ifndef|#endif|#pragma)/g, className: 'text-pink-400' },
        { regex: /(<[a-zA-Z]+>)/g, className: 'text-green-300' },
        { regex: /\b(int|char|float|double|void|bool|string|auto|const|static|class|struct|public|private|protected|return|if|else|for|while|do|switch|case|break|continue|new|delete|using|namespace|template|typename)\b/g, className: 'text-purple-400 font-semibold' },
        { regex: /\b(cout|cin|endl|std|vector|map|set|pair)\b/g, className: 'text-cyan-400' },
        { regex: /\b(\d+\.?\d*)\b/g, className: 'text-orange-400' }
      );
    } else if (lang === 'python') {
      patterns.push(
        { regex: /(#.*$)/gm, className: 'text-gray-500 italic' },
        { regex: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
        { regex: /("""[\s\S]*?"""|'''[\s\S]*?''')/g, className: 'text-green-400' },
        { regex: /\b(def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|lambda|pass|break|continue|and|or|not|in|is|None|True|False|self)\b/g, className: 'text-purple-400 font-semibold' },
        { regex: /\b(print|input|len|range|str|int|float|list|dict|set|tuple|open|type)\b/g, className: 'text-yellow-400' },
        { regex: /(@\w+)/g, className: 'text-pink-400' },
        { regex: /\b(\d+\.?\d*)\b/g, className: 'text-orange-400' }
      );
    } else if (lang === 'csharp') {
      patterns.push(
        { regex: /(\/\/.*$)/gm, className: 'text-gray-500 italic' },
        { regex: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'text-green-400' },
        { regex: /\b(using|namespace|class|struct|interface|enum|public|private|protected|internal|static|void|int|string|bool|float|double|decimal|char|byte|object|var|new|return|if|else|for|foreach|while|do|switch|case|break|continue|try|catch|finally|throw|async|await|this|base|null|true|false|readonly|const|virtual|override|abstract|sealed)\b/g, className: 'text-purple-400 font-semibold' },
        { regex: /\b(Console|String|Math|Array|List|Dictionary|Convert|DateTime|Exception|Task)\b/g, className: 'text-cyan-400' },
        { regex: /\b(WriteLine|ReadLine|Write|Parse|ToString|GetType)\b/g, className: 'text-yellow-400' },
        { regex: /\b(\d+\.?\d*)\b/g, className: 'text-orange-400' }
      );
    }

    if (patterns.length === 0) {
      return <span key={key}>{line}</span>;
    }

    let lastIndex = 0;
    const matches: { start: number; end: number; text: string; className: string }[] = [];

    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      while ((match = regex.exec(line)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          className: pattern.className
        });
      }
    }

    matches.sort((a, b) => a.start - b.start);

    const filteredMatches: typeof matches = [];
    for (const match of matches) {
      if (filteredMatches.length === 0 || match.start >= filteredMatches[filteredMatches.length - 1].end) {
        filteredMatches.push(match);
      }
    }

    for (const match of filteredMatches) {
      if (match.start > lastIndex) {
        elements.push(<span key={key++}>{line.slice(lastIndex, match.start)}</span>);
      }
      elements.push(<span key={key++} className={match.className}>{match.text}</span>);
      lastIndex = match.end;
    }

    if (lastIndex < line.length) {
      elements.push(<span key={key++}>{line.slice(lastIndex)}</span>);
    }

    if (elements.length === 0) {
      return <span key={0}>{line}</span>;
    }

    return <>{elements}</>;
  };

  return lines.map((line, index) => (
    <div key={index} className="flex">
      <span className="w-8 text-gray-600 text-right pr-3 select-none flex-shrink-0">{index + 1}</span>
      <span className="flex-1">{highlightLine(line, language)}</span>
    </div>
  ));
};

interface Question {
  id: string;
  text: string;
  type: 'mc' | 'essay' | 'livecode';
  options?: string[];
  optionImages?: (string | null)[];
  correctAnswer?: number;
  image?: string | null;
  language?: string;
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
  const [liveCodeDrafts, setLiveCodeDrafts] = useState<{ [key: string]: string }>({});
  const [codeOutputs, setCodeOutputs] = useState<{ [key: string]: { output: string; error: boolean } }>({});
  const [runningCode, setRunningCode] = useState<{ [key: string]: boolean }>({});
  const [codeMessages, setCodeMessages] = useState<{ [key: string]: { text: string; type: 'success' | 'error' | 'warning' } }>({});
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);
  const [codeAbortControllers, setCodeAbortControllers] = useState<{ [key: string]: AbortController }>({});
  const jsWorkerRef = useRef<Worker | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [vadInstance, setVadInstance] = useState<MicVAD | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const isRecordingAudioRef = useRef(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioRecordingCount, setAudioRecordingCount] = useState(0);
  const audioRecordingCountRef = useRef(0);
  const [vadError, setVadError] = useState<string | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechStartTimeRef = useRef<number | null>(null);
  const speechDetectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isRestartingAudio, setIsRestartingAudio] = useState(false);
  const vadHealthCheckRef = useRef<NodeJS.Timeout | null>(null);
  const lastVadActivityRef = useRef<number>(Date.now());
  const vadInstanceRef = useRef<MicVAD | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const isFinishedRef = useRef(false);

  const sessionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
  const attendancePhotoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const attendancePhotoTimestamps = [1, 5, 15, 30, 60, 120];
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

  const initializeVAD = async (isRetry = false) => {
    if (isFinishedRef.current || audioRecordingCountRef.current >= 10) {
      console.log("VAD init skipped - exam finished or max recordings reached");
      return;
    }

    try {
      if (typeof window === 'undefined' || !(window as any).vad) {
        throw new Error('VAD library not loaded');
      }

      if (vadInstanceRef.current) {
        try {
          vadInstanceRef.current.pause();
          vadInstanceRef.current.destroy();
        } catch (e) {
          console.log("Error destroying old VAD:", e);
        }
        vadInstanceRef.current = null;
        setVadInstance(null);
      }

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
        setAudioStream(null);
      }

      if (isRetry) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      if (!stream.active || stream.getAudioTracks().length === 0) {
        throw new Error('Audio stream not active');
      }

      audioStreamRef.current = stream;
      setAudioStream(stream);

      const vad = await (window as any).vad.MicVAD.new({
        stream: stream,
        positiveSpeechThreshold: 0.5,
        negativeSpeechThreshold: 0.35,
        redemptionFrames: 8,
        preSpeechPadFrames: 1,
        minSpeechFrames: 3,
        onSpeechStart: () => {
          lastVadActivityRef.current = Date.now();
          console.log("Speech detected!");

          if (audioRecordingCountRef.current >= 10) {
            console.log("Max recordings reached (10), ignoring speech");
            return;
          }

          if (isRecordingAudioRef.current) {
            console.log("Already recording, ignoring new speech start");
            return;
          }

          speechStartTimeRef.current = Date.now();

          if (speechDetectionTimeoutRef.current) {
            clearTimeout(speechDetectionTimeoutRef.current);
          }

          speechDetectionTimeoutRef.current = setTimeout(() => {
            if (speechStartTimeRef.current && audioRecordingCountRef.current < 10 && !isRecordingAudioRef.current && audioStreamRef.current?.active) {
              console.log("1 second of speech detected, starting recording...");
              startAudioRecording(audioStreamRef.current);
            }
          }, 1000);
        },
        onSpeechEnd: () => {
          lastVadActivityRef.current = Date.now();
          console.log("Speech ended");
          speechStartTimeRef.current = null;

          if (speechDetectionTimeoutRef.current) {
            clearTimeout(speechDetectionTimeoutRef.current);
            speechDetectionTimeoutRef.current = null;
          }
        },
        onFrameProcessed: (probs: { isSpeech: number }) => {
          lastVadActivityRef.current = Date.now();
        },
        onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
        baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.27/dist/"
      });

      vadInstanceRef.current = vad;
      setVadInstance(vad);
      vad.start();
      lastVadActivityRef.current = Date.now();
      setVadError(null);
      console.log("VAD initialized and started");

      setTimeout(() => {
        if (vadInstanceRef.current && audioStreamRef.current?.active) {
          console.log("VAD verification: running");
        } else {
          console.log("VAD verification failed, retrying...");
          initializeVAD(true);
        }
      }, 2000);

    } catch (error: any) {
      console.error("Failed to initialize VAD:", error);
      setVadError(`Audio monitoring failed: ${error.message}`);

      setTimeout(() => {
        if (!isFinishedRef.current && audioRecordingCountRef.current < 10) {
          console.log("Auto-retrying VAD initialization...");
          initializeVAD(true);
        }
      }, 3000);
    }
  };

  useEffect(() => {
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
    
    return () => {
      if (vadInstanceRef.current) {
        try {
          vadInstanceRef.current.destroy();
        } catch (e) {}
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (speechDetectionTimeoutRef.current) {
        clearTimeout(speechDetectionTimeoutRef.current);
      }
      if (vadHealthCheckRef.current) {
        clearInterval(vadHealthCheckRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log("Camera track stopped");
        });
      }
    };
  }, []);

  useEffect(() => {
    if (isFinished || isLoading || questions.length === 0) return;

    if (!vadInstanceRef.current) {
      console.log("VAD not initialized, starting now...");
      initializeVAD();
    }

    vadHealthCheckRef.current = setInterval(() => {
      if (isFinishedRef.current || audioRecordingCountRef.current >= 10) {
        if (vadHealthCheckRef.current) {
          clearInterval(vadHealthCheckRef.current);
        }
        return;
      }

      const now = Date.now();
      const timeSinceLastActivity = now - lastVadActivityRef.current;
      const streamActive = audioStreamRef.current?.active;
      const vadRunning = vadInstanceRef.current !== null;
      const audioTracksAlive = audioStreamRef.current?.getAudioTracks().every(t => t.readyState === 'live');

      if (timeSinceLastActivity > 10000 || !streamActive || !vadRunning || !audioTracksAlive) {
        console.log("VAD health check failed, auto-restarting...", {
          timeSinceLastActivity,
          streamActive,
          vadRunning,
          audioTracksAlive
        });
        initializeVAD(true);
      }
    }, 5000);

    return () => {
      if (vadHealthCheckRef.current) {
        clearInterval(vadHealthCheckRef.current);
      }
    };
  }, [isFinished, isLoading, questions.length]);

  const startAudioRecording = (stream: MediaStream) => {
    if (isRecordingAudioRef.current) {
      console.log("Already recording, skipping");
      return;
    }

    if (audioRecordingCountRef.current >= 10) {
      console.log("Max recordings reached (10), skipping");
      return;
    }

    if (!stream || !stream.active) {
      console.log("Stream not available or inactive");
      return;
    }

    try {
      isRecordingAudioRef.current = true;
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
        console.log("Audio recording stopped, processing...");

        const currentCount = audioRecordingCountRef.current;
        if (audioChunksRef.current.length > 0 && currentCount < 10) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;

            const audioData = {
              [`voiceRecording_${Date.now()}`]: {
                audioData: base64Audio,
                timestamp: new Date().toISOString(),
                duration: 4,
                studentId: user.id,
                studentName: studentInfo.name
              }
            };

            try {
              await updateDoc(sessionDocRef, audioData);
              setAudioRecordingCount(prev => {
                const newCount = prev + 1;
                audioRecordingCountRef.current = newCount;
                console.log(`Audio recording saved. Count: ${newCount}/10`);
                return newCount;
              });
            } catch (error) {
              console.error("Failed to save audio recording:", error);
            }

            isRecordingAudioRef.current = false;
            setIsRecordingAudio(false);
            setMediaRecorder(null);
          };

          reader.readAsDataURL(audioBlob);
        } else {
          isRecordingAudioRef.current = false;
          setIsRecordingAudio(false);
          setMediaRecorder(null);
        }
      };

      setMediaRecorder(recorder);
      recorder.start();

      // Stop recording after exactly 4 seconds
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }

      recordingTimeoutRef.current = setTimeout(() => {
        if (recorder && recorder.state === 'recording') {
          console.log("4 seconds elapsed, stopping recording");
          recorder.stop();
        }
      }, 4000);

      console.log("Started 4-second audio recording");

    } catch (error) {
      console.error("Failed to start audio recording:", error);
      isRecordingAudioRef.current = false;
      setIsRecordingAudio(false);
      setMediaRecorder(null);
    }
  };

  const restartAudioMonitoring = async () => {
    if (isRestartingAudio) return;

    setIsRestartingAudio(true);
    console.log("Manually restarting audio monitoring...");

    try {
      isRecordingAudioRef.current = false;
      setIsRecordingAudio(false);
      setMediaRecorder(null);

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (speechDetectionTimeoutRef.current) {
        clearTimeout(speechDetectionTimeoutRef.current);
      }

      await initializeVAD(true);
      console.log("Audio monitoring restarted successfully");

    } catch (error: any) {
      console.error("Failed to restart audio monitoring:", error);
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

  // Simple photo capture function with compression
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

      // Resize image to reduce file size - max 640x480
      const maxWidth = 640;
      const maxHeight = 480;
      let width = video.videoWidth;
      let height = video.videoHeight;

      // Calculate aspect ratio
      const aspectRatio = width / height;

      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }

      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }

      // Set canvas dimensions to resized dimensions
      canvas.width = width;
      canvas.height = height;

      // Clear canvas first
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Draw video frame to canvas with reduced size
      context.drawImage(video, 0, 0, width, height);

      // Convert to base64 with reduced quality (0.5 instead of 0.9)
      const imageData = canvas.toDataURL('image/jpeg', 0.5);

      // Check if image is not just black/empty
      if (imageData.length < 5000) { // Very small image likely means it's black
        console.log("⚠️ Captured image seems too small/black");
        return null;
      }

      console.log("✅ Photo captured successfully:", canvas.width, "x", canvas.height, "- compressed");
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
    if (isFinished || violations >= 3) {
      console.log("Violation ignored - exam finished or max violations reached");
      return;
    }

    const newViolations = Math.min(violations + 1, 3);
    setViolations(newViolations);
    setViolationReason(reason);

    console.log("Violation detected:", reason, "- Count:", newViolations);

    const photoData = capturePhoto();

    const violationData: any = {
      violations: newViolations,
      lastViolation: {
        reason,
        timestamp: new Date().toISOString()
      }
    };

    violationData[`violationSnapshot_${newViolations}`] = {
      timestamp: new Date().toISOString(),
      violationType: reason
    };

    updateDoc(sessionDocRef, violationData).catch(error => {
      console.error("Failed to save violation data:", error);
    });

    playWarningSound();

    if (newViolations >= 3) {
      finishExam(`Diskualifikasi: ${reason}`);
    } else {
      setShowViolationModal(true);

      setTimeout(() => {
        setShowViolationModal(false);
        setTimeout(() => {
          if (!isFinished && !isInFullscreen()) {
            enterFullscreen();
          }
        }, 100);
      }, 3000);
    }
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);
    updateDoc(sessionDocRef, { answers: newAnswers });
  };

  const handleLiveCodeDraftChange = (questionId: string, code: string) => {
    setLiveCodeDrafts(prev => ({ ...prev, [questionId]: code }));
  };

  const showCodeMessage = (questionId: string, text: string, type: 'success' | 'error' | 'warning') => {
    setCodeMessages(prev => ({ ...prev, [questionId]: { text, type } }));
    setTimeout(() => {
      setCodeMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[questionId];
        return newMessages;
      });
    }, 3000);
  };

  const handleSaveLiveCode = (questionId: string) => {
    const code = liveCodeDrafts[questionId];
    if (!code || !code.trim()) {
      showCodeMessage(questionId, 'Kode tidak boleh kosong!', 'error');
      return;
    }
    handleAnswerChange(questionId, code);
    showCodeMessage(questionId, 'Kode berhasil disimpan!', 'success');
  };

  const handleCancelLiveCode = (questionId: string) => {
    const hasUnsavedChanges = liveCodeDrafts[questionId] && liveCodeDrafts[questionId] !== (answers[questionId] || '');
    if (hasUnsavedChanges) {
      setShowCancelConfirm(questionId);
      return;
    }
    performCancelLiveCode(questionId);
  };

  const performCancelLiveCode = (questionId: string) => {
    setLiveCodeDrafts(prev => ({ ...prev, [questionId]: answers[questionId] || '' }));
    setCodeOutputs(prev => {
      const newOutputs = { ...prev };
      delete newOutputs[questionId];
      return newOutputs;
    });
    setShowCancelConfirm(null);
    showCodeMessage(questionId, 'Perubahan dibatalkan', 'warning');
  };

  const stopRunningCode = (questionId: string) => {
    const controller = codeAbortControllers[questionId];
    if (controller) {
      controller.abort();
    }
    setRunningCode(prev => ({ ...prev, [questionId]: false }));
    setCodeOutputs(prev => ({
      ...prev,
      [questionId]: { output: 'Execution stopped by user.', error: true }
    }));
    setCodeAbortControllers(prev => {
      const newControllers = { ...prev };
      delete newControllers[questionId];
      return newControllers;
    });
  };

  const runLiveCode = async (questionId: string, language: string) => {
    const code = liveCodeDrafts[questionId] || answers[questionId] || '';
    if (!code.trim()) {
      setCodeOutputs(prev => ({ ...prev, [questionId]: { output: 'Error: Kode kosong!', error: true } }));
      return;
    }

    const abortController = new AbortController();
    setCodeAbortControllers(prev => ({ ...prev, [questionId]: abortController }));
    setRunningCode(prev => ({ ...prev, [questionId]: true }));
    setCodeOutputs(prev => ({ ...prev, [questionId]: { output: 'Compiling and running...', error: false } }));

    try {
      let output = '';
      let hasError = false;

      if (language === 'python' || language === 'php' || language === 'cpp' || language === 'csharp') {
        const pistonLanguageMap: Record<string, string> = {
          python: 'python',
          php: 'php',
          cpp: 'cpp',
          csharp: 'csharp'
        };

        const pistonVersionMap: Record<string, string> = {
          python: '3.10.0',
          php: '8.2.3',
          cpp: '10.2.0',
          csharp: '6.12.0'
        };

        const fileNameMap: Record<string, string> = {
          python: 'main.py',
          php: 'main.php',
          cpp: 'main.cpp',
          csharp: 'Main.cs'
        };

        try {
          const response = await fetch('https://emkc.org/api/v2/piston/execute', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              language: pistonLanguageMap[language],
              version: pistonVersionMap[language],
              files: [
                {
                  name: fileNameMap[language],
                  content: code
                }
              ],
              stdin: '',
              args: [],
              compile_timeout: 10000,
              run_timeout: 5000
            }),
            signal: abortController.signal
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = await response.json();

          if (result.compile && result.compile.stderr) {
            output = 'Compilation Error:\n' + result.compile.stderr;
            hasError = true;
          } else if (result.run) {
            if (result.run.stderr) {
              output = 'Runtime Error:\n' + result.run.stderr;
              hasError = true;
            } else if (result.run.stdout) {
              output = result.run.stdout;
            } else {
              output = '(No output)';
            }

            if (result.run.signal === 'SIGKILL') {
              output = 'Error: Program dihentikan karena timeout atau menggunakan memori berlebihan.\nKemungkinan infinite loop atau recursion tanpa batas.';
              hasError = true;
            }
          } else {
            output = 'Execution completed with no output';
          }
        } catch (e: any) {
          if (e.name === 'AbortError') {
            output = 'Execution stopped by user.';
          } else {
            output = 'Compiler Error: ' + e.message + '\n\nPastikan koneksi internet Anda stabil.';
          }
          hasError = true;
        }
      } else {
        output = 'Bahasa pemrograman tidak didukung untuk eksekusi langsung.';
        hasError = true;
      }

      setCodeOutputs(prev => ({ ...prev, [questionId]: { output, error: hasError } }));
    } catch (e: any) {
      setCodeOutputs(prev => ({ ...prev, [questionId]: { output: 'Error: ' + e.message, error: true } }));
    } finally {
      setRunningCode(prev => ({ ...prev, [questionId]: false }));
      setCodeAbortControllers(prev => {
        const newControllers = { ...prev };
        delete newControllers[questionId];
        return newControllers;
      });
    }
  };

  const hasUnsavedLiveCode = (questionId: string) => {
    const draft = liveCodeDrafts[questionId];
    const saved = answers[questionId];
    return draft !== undefined && draft !== (saved || '');
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

    isFinishedRef.current = true;
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
              Nilai esai dan live code (jika ada) akan diperiksa oleh dosen.
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
          🎤 Human Voice: {audioRecordingCount}/10
        </div>
        
        {isRecordingAudio && (
          <div className="text-xs text-red-400 mb-2 animate-pulse">
            🔴 Recording Audio... (4s)
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
                <div className="text-purple-400">🎤 Suara Manusia: {audioRecordingCount}/10</div>
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
              <p className="font-semibold text-lg mb-2">{index + 1}. {q.text || '(Soal bergambar)'}</p>
              {q.image && (
                <div className="mb-4">
                  <img
                    src={q.image}
                    alt="Gambar soal"
                    className="max-w-full max-h-80 rounded-md border border-gray-600"
                  />
                </div>
              )}

              {q.type === 'mc' && q.options && (
                <div className="space-y-3">
                  {q.options.map((opt, i) => (
                    <label
                      key={i}
                      className={`block p-3 rounded-md cursor-pointer transition-colors ${
                        answers[q.id] === i
                          ? 'bg-blue-600'
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
                      <div className="flex items-start gap-2">
                        <span className="font-medium">{String.fromCharCode(65 + i)}.</span>
                        <div className="flex-1">
                          {opt && <span>{opt}</span>}
                          {q.optionImages?.[i] && (
                            <img
                              src={q.optionImages[i]!}
                              alt={`Opsi ${String.fromCharCode(65 + i)}`}
                              className="mt-2 max-h-40 rounded border border-gray-500"
                            />
                          )}
                        </div>
                      </div>
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

              {q.type === 'livecode' && (() => {
                const currentCode = liveCodeDrafts[q.id] !== undefined ? liveCodeDrafts[q.id] : (answers[q.id] || '');
                const showTemplate = !currentCode.trim();
                const displayCode = showTemplate ? CODE_TEMPLATES[q.language || 'javascript'] : currentCode;

                if (showTemplate && liveCodeDrafts[q.id] === undefined) {
                  setTimeout(() => handleLiveCodeDraftChange(q.id, CODE_TEMPLATES[q.language || 'javascript']), 0);
                }

                return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm bg-teal-600 text-white px-3 py-1 rounded">
                        {LANGUAGE_LABELS[q.language || 'javascript']}
                      </span>
                      <button
                        onClick={() => {
                          const template = CODE_TEMPLATES[q.language || 'javascript'] || '';
                          handleLiveCodeDraftChange(q.id, template);
                        }}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded"
                        title="Load Hello World template"
                      >
                        Reset Template
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasUnsavedLiveCode(q.id) && (
                        <span className="text-sm text-yellow-400 animate-pulse">
                          * Perubahan belum disimpan
                        </span>
                      )}
                      {answers[q.id] && !hasUnsavedLiveCode(q.id) && (
                        <span className="text-sm text-green-400">
                          Tersimpan
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute top-0 left-0 right-0 bottom-0 overflow-auto bg-gray-950 rounded-md border border-gray-600 p-4 font-mono text-sm pointer-events-none whitespace-pre-wrap" style={{ lineHeight: '1.5' }}>
                      {highlightCode(displayCode, q.language || 'javascript')}
                    </div>
                    <textarea
                      value={displayCode}
                      onChange={(e) => handleLiveCodeDraftChange(q.id, e.target.value)}
                      placeholder={`Tulis kode ${LANGUAGE_LABELS[q.language || 'javascript']} Anda di sini...`}
                      className="w-full p-4 pl-12 bg-transparent rounded-md border border-gray-600 h-64 font-mono text-sm text-transparent caret-white resize-none"
                      spellCheck={false}
                      style={{ lineHeight: '1.5' }}
                    />
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleSaveLiveCode(q.id)}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    >
                      Simpan Kode
                    </button>
                    <button
                      onClick={() => handleCancelLiveCode(q.id)}
                      className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded"
                    >
                      Batalkan Perubahan
                    </button>
                    {runningCode[q.id] ? (
                      <button
                        onClick={() => stopRunningCode(q.id)}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded animate-pulse"
                      >
                        Stop Running
                      </button>
                    ) : (
                      <button
                        onClick={() => runLiveCode(q.id, q.language || 'javascript')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                      >
                        Run Code
                      </button>
                    )}
                  </div>

                  {codeMessages[q.id] && (
                    <div className={`p-3 rounded-md text-sm font-medium ${
                      codeMessages[q.id].type === 'success' ? 'bg-green-800 text-green-200 border border-green-500' :
                      codeMessages[q.id].type === 'error' ? 'bg-red-800 text-red-200 border border-red-500' :
                      'bg-yellow-800 text-yellow-200 border border-yellow-500'
                    }`}>
                      {codeMessages[q.id].text}
                    </div>
                  )}

                  {showCancelConfirm === q.id && (
                    <div className="bg-yellow-900 border border-yellow-500 p-4 rounded-md">
                      <p className="text-yellow-200 mb-3">Kode belum disimpan. Apakah Anda yakin ingin membatalkan perubahan?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => performCancelLiveCode(q.id)}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm"
                        >
                          Ya, Batalkan
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(null)}
                          className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded text-sm"
                        >
                          Tidak, Kembali
                        </button>
                      </div>
                    </div>
                  )}

                  {!answers[q.id] && (
                    <div className="bg-yellow-900 border border-yellow-500 p-3 rounded-md">
                      <p className="text-yellow-300 text-sm">
                        Kode belum tersimpan. Klik "Simpan Kode" untuk menyimpan jawaban Anda.
                        Jika tidak disimpan, soal ini dianggap tidak dijawab.
                      </p>
                    </div>
                  )}

                  {codeOutputs[q.id] && (
                    <div className={`p-4 rounded-md border ${codeOutputs[q.id].error ? 'bg-red-900 border-red-500' : 'bg-gray-900 border-gray-600'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-300">Output:</span>
                        <button
                          onClick={() => setCodeOutputs(prev => {
                            const newOutputs = { ...prev };
                            delete newOutputs[q.id];
                            return newOutputs;
                          })}
                          className="text-gray-400 hover:text-white text-sm"
                        >
                          Tutup
                        </button>
                      </div>
                      <pre className={`text-sm font-mono whitespace-pre-wrap ${codeOutputs[q.id].error ? 'text-red-300' : 'text-green-300'}`}>
                        {codeOutputs[q.id].output}
                      </pre>
                    </div>
                  )}
                </div>
                );
              })()}
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