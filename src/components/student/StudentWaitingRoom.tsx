import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';

interface StudentWaitingRoomProps {
  user: User;
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  appState: any;
}

const StudentWaitingRoom: React.FC<StudentWaitingRoomProps> = ({ user, navigateTo, navigateBack, appState }) => {
  const { examCode } = appState;
  const [applicationStatus, setApplicationStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [examData, setExamData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!examCode) return;

    const checkApplicationStatus = async () => {
      try {
        // Find exam by code
        const examsRef = collection(db, `artifacts/${appId}/public/data/exams`);
        const examQuery = query(examsRef, where("code", "==", examCode));
        const examSnapshot = await getDocs(examQuery);
        
        if (!examSnapshot.empty) {
          const examDoc = examSnapshot.docs[0];
          const examInfo = { id: examDoc.id, ...examDoc.data() };
          setExamData(examInfo);

          // Listen to application status
          const applicationsRef = collection(db, `artifacts/${appId}/public/data/exams/${examDoc.id}/applications`);
          const applicationQuery = query(applicationsRef, where("studentId", "==", user.id));
          
          const unsubscribe = onSnapshot(applicationQuery, (snapshot) => {
            if (!snapshot.empty) {
              const applicationDoc = snapshot.docs[0];
              const status = applicationDoc.data().status;
              setApplicationStatus(status);
              
              if (status === 'approved') {
                // Check if exam is ready to start
                const now = new Date();
                const startTime = new Date(examInfo.startTime);
                const endTime = new Date(examInfo.endTime);
                
                // Don't auto-navigate to precheck, let student manually start exam
                // This prevents automatic redirection when bulk approval happens
              }
            }
            setIsLoading(false);
          });

          return () => unsubscribe();
        }
      } catch (error) {
        console.error('Error checking application status:', error);
        setIsLoading(false);
      }
    };

    checkApplicationStatus();
  }, [examCode, user.uid, navigateTo]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen -mt-16 text-center p-4">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-300">Memeriksa status aplikasi...</p>
        </div>
      </div>
    );
  }

  const renderStatusMessage = () => {
    if (applicationStatus === 'pending') {
      return (
        <div className="bg-yellow-800 border border-yellow-500 p-6 rounded-lg">
          <h3 className="text-xl font-bold text-yellow-400 mb-2">⏳ Menunggu Konfirmasi</h3>
          <p className="text-gray-300">
            Aplikasi Anda untuk ujian "<span className="font-bold">{examData?.name}</span>" 
            sedang menunggu konfirmasi dari pengawas.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Silakan tunggu hingga pengawas mengkonfirmasi aplikasi Anda.
          </p>
        </div>
      );
    }

    if (applicationStatus === 'rejected') {
      return (
        <div className="bg-red-800 border border-red-500 p-6 rounded-lg">
          <h3 className="text-xl font-bold text-red-400 mb-2">❌ Aplikasi Ditolak</h3>
          <p className="text-gray-300">
            Maaf, aplikasi Anda untuk ujian "<span className="font-bold">{examData?.name}</span>" 
            telah ditolak oleh pengawas.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Silakan hubungi pengawas untuk informasi lebih lanjut.
          </p>
        </div>
      );
    }

    if (applicationStatus === 'approved') {
      const now = new Date();
      const startTime = new Date(examData?.startTime);
      const endTime = new Date(examData?.endTime);

      if (examData?.status !== 'published') {
        return (
          <div className="bg-blue-800 border border-blue-500 p-6 rounded-lg">
            <h3 className="text-xl font-bold text-blue-400 mb-2">✅ Aplikasi Disetujui</h3>
            <p className="text-gray-300">
              Aplikasi Anda untuk ujian "<span className="font-bold">{examData?.name}</span>" 
              telah disetujui!
            </p>
            <p className="text-sm text-yellow-400 mt-2">
              Ujian belum dipublikasikan oleh pengawas. Silakan tunggu hingga ujian siap dimulai.
            </p>
          </div>
        );
      }

      if (now < startTime) {
        return (
          <div className="bg-blue-800 border border-blue-500 p-6 rounded-lg">
            <h3 className="text-xl font-bold text-blue-400 mb-2">✅ Aplikasi Disetujui</h3>
            <p className="text-gray-300 mb-4">
              Aplikasi Anda untuk ujian "<span className="font-bold">{examData?.name}</span>" 
              telah disetujui!
            </p>
            <div className="bg-gray-700 p-4 rounded-md">
              <p className="text-sm text-gray-300">
                <span className="font-bold">Waktu Mulai:</span> {startTime.toLocaleString('id-ID')}
              </p>
              <p className="text-sm text-gray-300">
                <span className="font-bold">Waktu Selesai:</span> {endTime.toLocaleString('id-ID')}
              </p>
            </div>
            <p className="text-sm text-yellow-400 mt-2">
              Ujian akan dimulai pada waktu yang telah ditentukan.
            </p>
          </div>
        );
      }

      if (now > endTime) {
        return (
          <div className="bg-gray-800 border border-gray-500 p-6 rounded-lg">
            <h3 className="text-xl font-bold text-gray-400 mb-2">⏰ Ujian Berakhir</h3>
            <p className="text-gray-300">
              Waktu untuk mengikuti ujian "<span className="font-bold">{examData?.name}</span>" 
              telah berakhir.
            </p>
          </div>
        );
      }

      // Exam is ready to start
      return (
        <div className="bg-green-800 border border-green-500 p-6 rounded-lg">
          <h3 className="text-xl font-bold text-green-400 mb-2">🎯 Ujian Siap Dimulai!</h3>
          <p className="text-gray-300 mb-4">
            Ujian "<span className="font-bold">{examData?.name}</span>" sudah bisa dimulai.
          </p>
          <button
            onClick={() => navigateTo('student_precheck', { exam: examData, currentUser: user })}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg"
          >
            Mulai Ujian
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen -mt-16 text-center p-4">
      <button 
        onClick={navigateBack} 
        className="absolute top-8 left-8 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>
      
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-3xl font-bold text-indigo-400 mb-6">Status Aplikasi Ujian</h2>
        {renderStatusMessage()}
      </div>
    </div>
  );
};

export default StudentWaitingRoom;