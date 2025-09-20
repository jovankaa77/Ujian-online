import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { collection, getDocs, query, where, doc, updateDoc, limit } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import CreateExamForm from './CreateExamForm';
import StudentConfirmation from './StudentConfirmation';
import TeacherResultsDashboard from './TeacherResultsDashboard';
import TeacherProctoringDashboard from './TeacherProctoringDashboard';
import QuestionManager from './QuestionManager';
import TeacherAttendanceRecap from './TeacherAttendanceRecap';
import TeacherVoiceMonitoring from './TeacherVoiceMonitoring';

interface TeacherDashboardProps {
  user?: any;
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  canGoBack: boolean;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, navigateTo, navigateBack, canGoBack }) => {
  const [view, setView] = useState('search');
  const [currentView, setCurrentView] = useState<'main' | 'student_confirmation' | 'teacher_results' | 'teacher_proctoring' | 'question_manager' | 'attendance_recap'>('main');
  const [currentView, setCurrentView] = useState<'main' | 'student_confirmation' | 'teacher_results' | 'teacher_proctoring' | 'question_manager' | 'attendance_recap' | 'voice_monitoring'>('main');
  const [searchCode, setSearchCode] = useState('');
  const [foundExam, setFoundExam] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [showInputPassword, setShowInputPassword] = useState(false);
  const [currentExam, setCurrentExam] = useState<any>(null);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showEditSchedule, setShowEditSchedule] = useState(false);
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  const handleSearchExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setFoundExam(null);
    setIsVerified(false);
    setInputPassword('');
    
    const examsRef = collection(db, `artifacts/${appId}/public/data/exams`);
    const q = query(examsRef, where("code", "==", searchCode.toUpperCase()), limit(1));
    
    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setError('Ujian dengan kode tersebut tidak ditemukan.');
      } else {
        const examDoc = querySnapshot.docs[0];
        setFoundExam({ id: examDoc.id, ...examDoc.data() });
      }
    } catch (err) {
      setError('Gagal mencari ujian. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPassword === foundExam.password) {
      setIsVerified(true);
      setCurrentExam(foundExam);
      setError('');
    } else {
      setError('Password salah.');
    }
  };

  const handleNavigateToFeature = (page: string, data: any) => {
    // Navigate to different views within the dashboard
    switch (page) {
      case 'student_confirmation':
        setCurrentView('student_confirmation');
        break;
      case 'teacher_results':
        setCurrentView('teacher_results');
        break;
      case 'teacher_proctoring':
        setCurrentView('teacher_proctoring');
        break;
      case 'question_manager':
        setCurrentView('question_manager');
        break;
      case 'attendance_recap':
        setCurrentView('attendance_recap');
        break;
      case 'voice_monitoring':
        setCurrentView('voice_monitoring');
        break;
      default:
        navigateTo(page, data);
    }
  };

  const handleBackToMain = () => {
    setCurrentView('main');
  };

  const handleEditPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setError('Password tidak boleh kosong');
      return;
    }
    
    setIsUpdatingPassword(true);
    setError('');
    
    try {
      const examDocRef = doc(db, `artifacts/${appId}/public/data/exams`, currentExam.id);
      await updateDoc(examDocRef, { password: newPassword });
      
      // Update local state
      setCurrentExam({ ...currentExam, password: newPassword });
      setFoundExam({ ...foundExam, password: newPassword });
      
      setShowEditPassword(false);
      setNewPassword('');
      alert('Password ujian berhasil diperbarui!');
    } catch (error) {
      console.error('Error updating password:', error);
      setError('Gagal memperbarui password. Silakan coba lagi.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleEditSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStartTime.trim() || !newEndTime.trim()) {
      setScheduleError('Waktu mulai dan selesai harus diisi');
      return;
    }
    
    if (new Date(newStartTime) >= new Date(newEndTime)) {
      setScheduleError('Waktu selesai harus setelah waktu mulai');
      return;
    }
    
    setIsUpdatingSchedule(true);
    setScheduleError('');
    
    try {
      const examDocRef = doc(db, `artifacts/${appId}/public/data/exams`, currentExam.id);
      await updateDoc(examDocRef, { 
        startTime: newStartTime,
        endTime: newEndTime
      });
      
      // Update local state
      const updatedExam = { 
        ...currentExam, 
        startTime: newStartTime, 
        endTime: newEndTime 
      };
      setCurrentExam(updatedExam);
      setFoundExam(updatedExam);
      
      setShowEditSchedule(false);
      setNewStartTime('');
      setNewEndTime('');
      alert('Jadwal ujian berhasil diperbarui!');
    } catch (error) {
      console.error('Error updating schedule:', error);
      setScheduleError('Gagal memperbarui jadwal. Silakan coba lagi.');
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  // Render different views based on currentView
  if (currentView === 'student_confirmation') {
    return (
      <StudentConfirmation 
        navigateBack={handleBackToMain}
        appState={{ exam: currentExam }}
      />
    );
  }

  if (currentView === 'teacher_results') {
    return (
      <TeacherResultsDashboard 
        navigateTo={navigateTo}
        navigateBack={handleBackToMain}
        appState={{ exam: currentExam }}
      />
    );
  }

  if (currentView === 'teacher_proctoring') {
    return (
      <TeacherProctoringDashboard 
        navigateTo={navigateTo}
        navigateBack={handleBackToMain}
        appState={{ exam: currentExam }}
      />
    );
  }

  if (currentView === 'question_manager') {
    return (
      <QuestionManager 
        navigateTo={navigateTo}
        navigateBack={handleBackToMain}
        appState={{ exam: currentExam }}
      />
    );
  }

  if (currentView === 'attendance_recap') {
    return (
      <TeacherAttendanceRecap 
        navigateTo={navigateTo}
        navigateBack={handleBackToMain}
        appState={{ exam: currentExam }}
      />
    );
  }

  if (currentView === 'voice_monitoring') {
    return (
      <TeacherVoiceMonitoring 
        navigateTo={navigateTo}
        navigateBack={handleBackToMain}
        appState={{ exam: currentExam }}
      />
    );
  }

  // Main dashboard view
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
      <h2 className="text-3xl font-bold mb-6">Dasbor Dosen</h2>
      <div className="flex space-x-4 mb-6 border-b border-gray-700">
        <button 
          onClick={() => setView('search')} 
          className={`py-2 px-4 ${view === 'search' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400'}`}
        >
          Cari Ujian
        </button>
        <button 
          onClick={() => setView('create')} 
          className={`py-2 px-4 ${view === 'create' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400'}`}
        >
          Buat Ujian Baru
        </button>
      </div>

      {view === 'create' && <CreateExamForm user={user} navigateTo={navigateTo} />}

      {view === 'search' && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
          <h3 className="text-xl font-semibold mb-4">Cari Ruang Ujian</h3>
          <form onSubmit={handleSearchExam} className="flex space-x-2">
            <input 
              type="text" 
              value={searchCode} 
              onChange={(e) => setSearchCode(e.target.value)} 
              placeholder="Masukkan Kode Ujian..." 
              className="flex-grow p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase" 
              required 
            />
            <button 
              type="submit" 
              disabled={isLoading} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-indigo-400"
            >
              {isLoading ? 'Mencari...' : 'Cari'}
            </button>
          </form>
          
          {foundExam && !isVerified && (
            <form onSubmit={handleVerifyPassword} className="mt-6">
              <h4 className="font-bold text-lg">Verifikasi Akses untuk: {foundExam.name}</h4>
              <div className="flex space-x-2 mt-2">
                <div className="relative flex-grow">
                  <input 
                    type={showInputPassword ? "text" : "password"}
                    value={inputPassword} 
                    onChange={(e) => setInputPassword(e.target.value)} 
                    placeholder="Masukkan Password Ujian" 
                    className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 pr-12" 
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowInputPassword(!showInputPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  >
                    {showInputPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <button 
                  type="submit" 
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg"
                >
                  Verifikasi
                </button>
              </div>
            </form>
          )}

          {error && <p className="text-red-500 mt-4">{error}</p>}

          {foundExam && isVerified && (
            <div className="mt-6 bg-gray-700 p-4 rounded-md">
              <h4 className="font-bold text-lg">{foundExam.name}</h4>
              <p className="text-sm text-gray-400">
                Kode: <span className="font-mono bg-gray-600 px-2 py-1 rounded">{foundExam.code}</span>
              </p>
              <div className="mt-2 flex items-center space-x-2">
                <p className="text-sm text-gray-400">
                  Password: <span className="font-mono bg-gray-600 px-2 py-1 rounded">{"*".repeat(foundExam.password.length)}</span>
                </p>
                <button
                  onClick={() => setShowEditPassword(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-2 rounded"
                >
                  Edit Password
                </button>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-400">
                  Waktu Mulai: <span className="font-mono bg-gray-600 px-2 py-1 rounded">
                    {new Date(foundExam.startTime).toLocaleString('id-ID')}
                  </span>
                </p>
                <p className="text-sm text-gray-400">
                  Waktu Selesai: <span className="font-mono bg-gray-600 px-2 py-1 rounded">
                    {new Date(foundExam.endTime).toLocaleString('id-ID')}
                  </span>
                  <button
                    onClick={() => {
                      setNewStartTime(foundExam.startTime);
                      setNewEndTime(foundExam.endTime);
                      setShowEditSchedule(true);
                    }}
                    className="ml-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1 px-2 rounded"
                  >
                    Edit Jadwal
                  </button>
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button 
                  onClick={() => handleNavigateToFeature('student_confirmation', { exam: foundExam })} 
                  className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-2 px-3 rounded-lg"
                >
                  Konfirmasi Siswa
                </button>
                <button 
                  onClick={() => handleNavigateToFeature('teacher_results', { exam: foundExam })} 
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-3 rounded-lg"
                >
                  Lihat Hasil
                </button>
                <button 
                  onClick={() => handleNavigateToFeature('teacher_proctoring', { exam: foundExam })} 
                  className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-bold py-2 px-3 rounded-lg"
                >
                  Awasi Ujian
                </button>
                <button 
                  onClick={() => handleNavigateToFeature('question_manager', { exam: foundExam })} 
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-3 rounded-lg"
                >
                  Kelola Soal
                </button>
                <button 
                  onClick={() => handleNavigateToFeature('attendance_recap', { exam: foundExam })} 
                  className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-2 px-3 rounded-lg"
                >
                  Rekap Absen
                </button>
                <button 
                  onClick={() => handleNavigateToFeature('voice_monitoring', { exam: foundExam })} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2 px-3 rounded-lg"
                >
                  Human Voice
                </button>
              </div>
            </div>
          )}
          
          {/* Edit Password Modal */}
          {showEditPassword && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Edit Password Ujian</h3>
                  <button
                    onClick={() => {
                      setShowEditPassword(false);
                      setNewPassword('');
                      setError('');
                    }}
                    className="text-gray-400 hover:text-white text-2xl"
                  >
                    ×
                  </button>
                </div>
                
                <form onSubmit={handleEditPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password Baru untuk: {foundExam.name}
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Masukkan password baru"
                        className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                      >
                        {showNewPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-900 border border-yellow-500 p-3 rounded-md">
                    <p className="text-yellow-300 text-sm">
                      ⚠️ <strong>Peringatan:</strong> Mengubah password akan mempengaruhi akses ke ujian ini. 
                      Pastikan untuk memberitahu siswa jika diperlukan.
                    </p>
                  </div>
                  
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  
                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditPassword(false);
                        setNewPassword('');
                        setError('');
                      }}
                      className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-blue-400"
                    >
                      {isUpdatingPassword ? 'Menyimpan...' : 'Simpan Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          
          {/* Edit Schedule Modal */}
          {showEditSchedule && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Edit Jadwal Ujian</h3>
                  <button
                    onClick={() => {
                      setShowEditSchedule(false);
                      setNewStartTime('');
                      setNewEndTime('');
                      setScheduleError('');
                    }}
                    className="text-gray-400 hover:text-white text-2xl"
                  >
                    ×
                  </button>
                </div>
                
                <form onSubmit={handleEditSchedule} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Ujian: {foundExam.name}
                    </label>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Waktu Mulai Baru
                    </label>
                    <input
                      type="datetime-local"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Waktu Selesai Baru
                    </label>
                    <input
                      type="datetime-local"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  
                  <div className="bg-yellow-900 border border-yellow-500 p-3 rounded-md">
                    <p className="text-yellow-300 text-sm">
                      ⚠️ <strong>Peringatan:</strong> Mengubah jadwal ujian akan mempengaruhi akses siswa. 
                      Pastikan untuk memberitahu siswa tentang perubahan jadwal.
                    </p>
                  </div>
                  
                  <div className="bg-blue-900 border border-blue-500 p-3 rounded-md">
                    <p className="text-blue-300 text-sm">
                      💡 <strong>Tips:</strong>
                    </p>
                    <ul className="text-blue-200 text-xs mt-1 space-y-1">
                      <li>• Siswa hanya bisa mengakses ujian pada waktu yang telah ditentukan</li>
                      <li>• Jika ujian sedang berlangsung, perubahan akan berlaku segera</li>
                      <li>• Pastikan durasi ujian cukup untuk siswa menyelesaikan soal</li>
                    </ul>
                  </div>
                  
                  {scheduleError && <p className="text-red-500 text-sm">{scheduleError}</p>}
                  
                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditSchedule(false);
                        setNewStartTime('');
                        setNewEndTime('');
                        setScheduleError('');
                      }}
                      className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdatingSchedule}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-green-400"
                    >
                      {isUpdatingSchedule ? 'Menyimpan...' : 'Simpan Jadwal'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;