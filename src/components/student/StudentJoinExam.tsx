import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, doc, getDoc, limit } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';

interface StudentJoinExamProps {
  user: User;
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  canGoBack?: boolean;
}

const StudentJoinExam: React.FC<StudentJoinExamProps> = ({ user, navigateTo, navigateBack, canGoBack = true }) => {
  const [examCode, setExamCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleJoinExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    
    if (!examCode.trim()) {
      setError('Kode ujian tidak boleh kosong.');
      setIsLoading(false);
      return;
    }
    
    try {
      // Find exam by code
      const examsRef = collection(db, `artifacts/${appId}/public/data/exams`);
      const q = query(examsRef, where("code", "==", examCode.toUpperCase()), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('Kode ujian tidak ditemukan atau tidak valid.');
        setIsLoading(false);
        return;
      }

      const examDoc = querySnapshot.docs[0];
      const examData = examDoc.data();

      // Check if student has already taken this exam
      const sessionsRef = collection(db, `artifacts/${appId}/public/data/exams/${examDoc.id}/sessions`);
      const sessionsQuery = query(sessionsRef, where("studentId", "==", user.id), limit(5));
      const sessionsSnapshot = await getDocs(sessionsQuery);
      
      if (!sessionsSnapshot.empty) {
        const sessionData = sessionsSnapshot.docs[0].data();
        if (['finished', 'disqualified'].includes(sessionData.status)) {
          setError('Anda sudah mengikuti ujian dengan kode ini dan tidak dapat mengaksesnya lagi.');
          setIsLoading(false);
          return;
        } else {
          setError('Anda sudah mengikuti ujian dengan kode ini. Tidak dapat mengikuti ujian yang sama dua kali.');
          setIsLoading(false);
          return;
        }
      }

      // Get student profile
      const studentDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/students`, user.id));
      if (!studentDoc.exists()) {
        setError('Profil peserta ujian tidak ditemukan. Silakan logout dan login kembali.');
        setIsLoading(false);
        return;
      }

      const studentData = studentDoc.data();

      // Check if already applied
      const applicationsRef = collection(db, `artifacts/${appId}/public/data/exams/${examDoc.id}/applications`);
      const existingQuery = query(applicationsRef, where("studentId", "==", user.id));
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        navigateTo('student_waiting_room', { examCode: examCode.toUpperCase(), currentUser: user });
        setIsLoading(false);
        return;
      }

      // Create application
      await addDoc(applicationsRef, {
        studentId: user.id,
        studentData: {
          fullName: studentData.fullName,
          username: studentData.username,
          major: studentData.major,
          className: studentData.className,
          university: studentData.university
        },
        examId: examDoc.id,
        examName: examData.name,
        status: 'pending',
        appliedAt: new Date()
      });

      navigateTo('student_waiting_room', { examCode: examCode.toUpperCase(), currentUser: user });
    } catch (err) {
      setError('Terjadi kesalahan saat mengajukan ujian.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {canGoBack && (
        <button 
          onClick={navigateBack} 
          className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
        >
          &larr; Kembali
        </button>
      )}
      <h2 className="text-3xl font-bold mb-6 text-center">Ajukan Ikut Ujian</h2>
      <div className="w-full max-w-sm mx-auto bg-gray-800 p-8 rounded-lg shadow-xl">
        <form onSubmit={handleJoinExam}>
          <div className="mb-4">
            <label htmlFor="examCode" className="block text-gray-300 text-sm font-bold mb-2">
              Masukkan Kode Ujian
            </label>
            <input 
              id="examCode" 
              type="text" 
              value={examCode} 
              onChange={(e) => setExamCode(e.target.value)} 
              placeholder="e.g., A7B3K2" 
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase" 
            />
          </div>
          {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
          {success && <p className="text-green-500 text-xs italic mb-4">{success}</p>}
          <button 
            type="submit" 
            disabled={isLoading} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-indigo-400"
          >
            {isLoading ? 'Mengajukan...' : 'Ajukan Ikut Ujian'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StudentJoinExam;