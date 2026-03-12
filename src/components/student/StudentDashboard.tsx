import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc, limit } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';

interface CustomUser {
  id: string;
  username: string;
  role: string;
  [key: string]: any;
}

interface StudentDashboardProps {
  user: CustomUser;
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
}

interface ExamResult {
  id: string;
  examName: string;
  examCode?: string;
  finalScore: number;
  essayScore?: number;
  livecodeScore?: number;
  totalScore?: number;
  finishTime: Date;
  status: string;
  scoreReduction?: number;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, navigateTo, navigateBack }) => {
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableExams, setAvailableExams] = useState<any[]>([]);
  const [pendingApplications, setPendingApplications] = useState<any[]>([]);
  const [rejectedApplications, setRejectedApplications] = useState<any[]>([]);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    nim: '',
    major: '',
    className: '',
    university: '',
    whatsapp: '',
    password: '',
    confirmPassword: ''
  });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [editError, setEditError] = useState('');
  const [editValidationErrors, setEditValidationErrors] = useState<{[key: string]: string}>({});
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Early return if no user
    if (!user || !user.id) {
      setIsLoading(false);
      return;
    }

    // Fetch all exam data and applications
    const fetchData = async () => {
      try {
        // Fetch student profile first
        const studentDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/students`, user.id));
        
        if (studentDoc.exists()) {
          const profileData = studentDoc.data();
          setStudentProfile(profileData);
          setEditFormData({
            fullName: profileData.fullName || '',
            nim: profileData.nim || '',
            major: profileData.major || '',
            className: profileData.className || '',
            university: profileData.university || '',
            whatsapp: profileData.whatsapp || '',
            password: '',
            confirmPassword: ''
          });
        }

        // Fetch all exams
        const examsSnapshot = await getDocs(query(
          collection(db, `artifacts/${appId}/public/data/exams`), 
          limit(100)
        ));
        
        console.log(`Found ${examsSnapshot.docs.length} total exams`);
        
        // Initialize arrays
        const results: ExamResult[] = [];
        const available: any[] = [];
        const pending: any[] = [];
        const rejected: any[] = [];
        
        // Process each exam
        for (const examDoc of examsSnapshot.docs) {
          const examData = examDoc.data();
          const examId = examDoc.id;
          
          console.log(`Processing exam: ${examData.name} (${examId})`);
          
          try {
            // Check for completed sessions first
            const sessionsSnapshot = await getDocs(query(
              collection(db, `artifacts/${appId}/public/data/exams/${examId}/sessions`),
              where('studentId', '==', user.id),
              limit(5)
            ));
            
            let hasCompletedSession = false;
            
            const questionsRefForCalc = collection(db, `artifacts/${appId}/public/data/exams/${examId}/questions`);
            const qSnapshot = await getDocs(query(questionsRefForCalc, limit(100)));
            const examQuestions = qSnapshot.docs.map(d => d.data());
            const hasMC = examQuestions.some(q => q.type === 'mc');
            const hasEssay = examQuestions.some(q => q.type === 'essay');
            const hasLivecode = examQuestions.some(q => q.type === 'livecode');

            sessionsSnapshot.forEach(sessionDoc => {
              const sessionData = sessionDoc.data();

              if (['finished', 'disqualified'].includes(sessionData.status)) {
                hasCompletedSession = true;

                const mcScore = sessionData.finalScore || 0;
                const reduction = sessionData.scoreReduction || 0;

                let essayScore: number | undefined;
                if (sessionData.essayScores) {
                  const vals = Object.values(sessionData.essayScores) as number[];
                  if (vals.length > 0) {
                    essayScore = vals.reduce((sum, s) => sum + (s || 0), 0) / vals.length;
                  }
                }

                let livecodeScore: number | undefined;
                if (sessionData.livecodeScores) {
                  const vals = Object.values(sessionData.livecodeScores) as number[];
                  if (vals.length > 0) {
                    livecodeScore = vals.reduce((sum, s) => sum + (s || 0), 0) / vals.length;
                  }
                }

                let baseScore = mcScore;
                if (hasMC && hasEssay && hasLivecode) {
                  baseScore = (mcScore * 0.34) + ((essayScore ?? 0) * 0.33) + ((livecodeScore ?? 0) * 0.33);
                } else if (hasMC && hasEssay) {
                  baseScore = (mcScore * 0.5) + ((essayScore ?? 0) * 0.5);
                } else if (hasMC && hasLivecode) {
                  baseScore = (mcScore * 0.5) + ((livecodeScore ?? 0) * 0.5);
                } else if (hasEssay && hasLivecode) {
                  baseScore = ((essayScore ?? 0) * 0.5) + ((livecodeScore ?? 0) * 0.5);
                } else if (hasMC) {
                  baseScore = mcScore;
                } else if (hasEssay) {
                  baseScore = essayScore ?? 0;
                } else if (hasLivecode) {
                  baseScore = livecodeScore ?? 0;
                }

                const totalScore = Math.max(0, baseScore - reduction);

                results.push({
                  id: sessionDoc.id,
                  examName: examData.name || 'Unknown Exam',
                  examCode: examData.code,
                  finalScore: mcScore,
                  essayScore,
                  livecodeScore,
                  totalScore,
                  finishTime: sessionData.finishTime?.toDate() || new Date(),
                  status: sessionData.status,
                  scoreReduction: reduction
                });
              }
            });
            
            // Check for applications regardless of completed sessions
            const applicationsSnapshot = await getDocs(query(
              collection(db, `artifacts/${appId}/public/data/exams/${examId}/applications`),
              where('studentId', '==', user.id),
              limit(5)
            ));
            
            console.log(`Found ${applicationsSnapshot.docs.length} applications for exam ${examId}`);
            
            // Process applications
            applicationsSnapshot.forEach(appDoc => {
              const appData = appDoc.data();
              console.log(`Application status: ${appData.status} for exam ${examData.name}`);
              
              const examWithApp = {
                id: examId,
                name: examData.name,
                code: examData.code,
                applicationStatus: appData.status,
                appliedAt: appData.appliedAt?.toDate() || new Date(),
                startTime: examData.startTime,
                endTime: examData.endTime,
                status: examData.status,
                hasCompletedSession,
                ...examData
              };
              
              // Categorize based on application status
              if (appData.status === 'pending') {
                pending.push(examWithApp);
                console.log(`Added to pending: ${examData.name}`);
              } else if (appData.status === 'approved') {
                // Only add to available if no completed session and published
                if (!hasCompletedSession) {
                  if (examData.status === 'published') {
                    available.push(examWithApp);
                    console.log(`Added to available: ${examData.name}`);
                  } else {
                    // Add to rejected array with special status for approved but unpublished
                    const approvedUnpublishedExam = {
                      ...examWithApp,
                      specialStatus: 'approved_unpublished',
                      displayStatus: 'approved_unpublished'
                    };
                    rejected.push(approvedUnpublishedExam);
                    console.log(`Added to approved_unpublished: ${examData.name}`);
                  }
                } else {
                  console.log(`Skipped available (completed): ${examData.name}`);
                }
              } else if (appData.status === 'rejected') {
                rejected.push(examWithApp);
                console.log(`Added to rejected: ${examData.name}`);
              }
            });
            
          } catch (examError) {
            console.warn(`Error processing exam ${examId}:`, examError);
          }
        }
        
        console.log(`Final counts - Pending: ${pending.length}, Available: ${available.length}, Rejected: ${rejected.length}, Results: ${results.length}`);
        
        // Set all results
        setExamResults(results.sort((a, b) => {
          if (!a.finishTime && !b.finishTime) return 0;
          if (!a.finishTime) return -1;
          if (!b.finishTime) return 1;
          return b.finishTime.getTime() - a.finishTime.getTime();
        }));
        
        setAvailableExams(available);
        setPendingApplications(pending.sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime()));
        setRejectedApplications(rejected.sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime()));
        
      } catch (error) {
        console.error('Error fetching exam results:', error);
        setExamResults([]);
        setAvailableExams([]);
        setPendingApplications([]);
        setRejectedApplications([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
    // Clear validation error when user starts typing
    if (editValidationErrors[e.target.name]) {
      setEditValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[e.target.name];
        return newErrors;
      });
    }
  };

  const validateUniqueNIM = async () => {
    // Only validate if NIM has changed
    if (editFormData.nim === studentProfile?.nim) {
      return {};
    }

    const studentsRef = collection(db, `artifacts/${appId}/public/data/students`);
    const errors: {[key: string]: string} = {};
    
    // Check for duplicate NIM (excluding current user)
    const nimQuery = query(studentsRef, where("nim", "==", editFormData.nim));
    const nimSnapshot = await getDocs(nimQuery);
    
    // Check if any document found is not the current user
    const duplicateNIM = nimSnapshot.docs.find(doc => doc.id !== user.id);
    if (duplicateNIM) {
      errors.nim = "NIM/NIS sudah terdaftar oleh siswa lain. Gunakan NIM/NIS yang berbeda.";
    }
    
    return errors;
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setEditValidationErrors({});
    setIsUpdating(true);

    // Validate password if provided
    if (editFormData.password && editFormData.password !== editFormData.confirmPassword) {
      setEditError('Password tidak cocok');
      setIsUpdating(false);
      return;
    }

    if (editFormData.password && editFormData.password.length < 6) {
      setEditError('Password minimal 6 karakter');
      setIsUpdating(false);
      return;
    }

    try {
      // Validate unique NIM
      const uniqueFieldErrors = await validateUniqueNIM();
      if (Object.keys(uniqueFieldErrors).length > 0) {
        setEditValidationErrors(uniqueFieldErrors);
        setIsUpdating(false);
        return;
      }

      // Prepare update data
      const updateData: any = {
        fullName: editFormData.fullName,
        nim: editFormData.nim,
        major: editFormData.major,
        className: editFormData.className,
        university: editFormData.university,
        whatsapp: editFormData.whatsapp,
        updatedAt: new Date()
      };

      // Only update password if provided
      if (editFormData.password) {
        updateData.password = editFormData.password;
      }

      // Update in Firestore
      await updateDoc(doc(db, `artifacts/${appId}/public/data/students`, user.id), updateData);

      // Update local state
      const updatedProfile = { ...studentProfile, ...updateData };
      setStudentProfile(updatedProfile);
      
      // Reset form
      setEditFormData({
        ...editFormData,
        whatsapp: updatedProfile.whatsapp || '',
        password: '',
        confirmPassword: ''
      });
      
      setShowEditProfile(false);
      alert('Profil berhasil diperbarui!');
    } catch (error: any) {
      setEditError('Gagal memperbarui profil. Silakan coba lagi.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return <div className="text-center p-8">Memuat dashboard...</div>;
  }

  if (!user || !user.id) {
    return <div className="text-center p-8 text-red-400">Error: User data tidak valid</div>;
  }

  return (
    <div>
      <div className="flex justify-end items-center mb-6">
        <button 
          onClick={() => navigateTo('home')} 
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
        >
          Logout
        </button>
      </div>
      
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-4">Dashboard Siswa</h2>
        {studentProfile && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {studentProfile.fullName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">{studentProfile.fullName}</h3>
                  <p className="text-gray-400">{studentProfile.major} - {studentProfile.className}</p>
                  <p className="text-gray-400">NIM/NIS: {studentProfile.nim || 'N/A'}</p>
                  <p className="text-gray-400">{studentProfile.university}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditProfile(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
              >
                Edit Profil
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">Edit Profil</h3>
              <button
                onClick={() => {
                  setShowEditProfile(false);
                  setEditError('');
                  setEditValidationErrors({});
                }}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Important Notes */}
            <div className="mb-6 bg-yellow-900 border border-yellow-500 p-4 rounded-lg">
              <h4 className="text-yellow-300 font-bold mb-2">⚠️ Catatan Penting:</h4>
              <ul className="text-yellow-200 text-sm space-y-1">
                <li>• NIM/NIS harus unik dan tidak boleh sama dengan siswa lain</li>
                <li>• Username tidak dapat diubah setelah registrasi</li>
                <li>• Password baru minimal 6 karakter (kosongkan jika tidak ingin mengubah)</li>
                <li>• Pastikan semua data yang dimasukkan benar dan valid</li>
              </ul>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Personal Data */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-300 border-b border-gray-600 pb-2">Data Pribadi</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Nama Lengkap</label>
                    <input 
                      name="fullName" 
                      type="text"
                      value={editFormData.fullName}
                      onChange={handleEditChange} 
                      className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Program Studi/Jurusan</label>
                    <input 
                      name="major" 
                      type="text"
                      value={editFormData.major}
                      onChange={handleEditChange} 
                      className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Kelas</label>
                    <input 
                      name="className" 
                      type="text"
                      value={editFormData.className}
                      onChange={handleEditChange} 
                      className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Universitas/Sekolah</label>
                    <input 
                      name="university" 
                      type="text"
                      value={editFormData.university}
                      onChange={handleEditChange} 
                      className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Nomor WhatsApp</label>
                    <input 
                      name="whatsapp" 
                      type="tel"
                      value={editFormData.whatsapp}
                      onChange={handleEditChange} 
                      placeholder="08123456789"
                      className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                      required 
                    />
                  </div>
                </div>
                
                {/* Right Column - Account Data */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-300 border-b border-gray-600 pb-2">Data Akun</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">NIM/NIS (Nomor Induk)</label>
                    <input 
                      name="nim" 
                      type="text"
                      value={editFormData.nim}
                      onChange={handleEditChange} 
                      className={`w-full p-3 bg-gray-700 rounded-md border ${
                        editValidationErrors.nim ? 'border-red-500' : 'border-gray-600'
                      } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                      required 
                    />
                    {editValidationErrors.nim && (
                      <p className="text-red-400 text-xs mt-1">{editValidationErrors.nim}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                    <input 
                      type="text"
                      value={user.username}
                      disabled
                      className="w-full p-3 bg-gray-600 rounded-md border border-gray-500 text-gray-400 cursor-not-allowed" 
                    />
                    <p className="text-xs text-gray-500 mt-1">Username tidak dapat diubah</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Password Baru (Opsional)</label>
                    <div className="relative">
                      <input 
                        name="password" 
                        type={showEditPassword ? "text" : "password"}
                        value={editFormData.password}
                        onChange={handleEditChange} 
                        placeholder="Kosongkan jika tidak ingin mengubah"
                        className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-12" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                      >
                        {showEditPassword ? (
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
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Konfirmasi Password Baru</label>
                    <div className="relative">
                      <input 
                        name="confirmPassword" 
                        type={showEditConfirmPassword ? "text" : "password"}
                        value={editFormData.confirmPassword}
                        onChange={handleEditChange} 
                        placeholder="Ulangi password baru"
                        className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-12" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                      >
                        {showEditConfirmPassword ? (
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
                </div>
              </div>

              {editError && (
                <div className="bg-red-900 border border-red-500 p-3 rounded-md">
                  <p className="text-red-200 text-sm">{editError}</p>
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-6">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEditProfile(false);
                    setEditError('');
                    setEditValidationErrors({});
                  }}
                  className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isUpdating}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg disabled:bg-indigo-400"
                >
                  {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Aplikasi Ujian Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold">Status Aplikasi Ujian</h3>
          <button 
            onClick={() => navigateTo('student_join_exam', { currentUser: user })}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            + Ajukan Ujian Baru
          </button>
        </div>

        {/* Ujian Siap Dimulai (Approved & Active) */}
        {availableExams.length > 0 && (
          <div className="mb-6 bg-green-800 border border-green-500 p-6 rounded-lg shadow-lg">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">{availableExams.length > 1 ? '📚' : '🎯'}</span>
              </div>
              <div>
                <h4 className="text-xl font-bold text-green-400">
                  {availableExams.length > 1 ? `${availableExams.length} Ujian Siap Dimulai` : 'Ujian Siap Dimulai'}
                </h4>
                <p className="text-green-200 text-sm">
                  {availableExams.length > 1 
                    ? 'Beberapa ujian sudah disetujui dan bisa dimulai sekarang' 
                    : 'Ujian yang sudah disetujui dan bisa dimulai sekarang'
                  }
                </p>
              </div>
            </div>
            <div className={`grid gap-4 ${
              availableExams.length === 1 
                ? 'grid-cols-1' 
                : availableExams.length === 2 
                ? 'grid-cols-1 md:grid-cols-2' 
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {availableExams.map(exam => (
                <div key={exam.id} className="bg-gray-700 p-4 rounded-lg border border-green-400 hover:bg-gray-600 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-grow">
                      <h5 className="font-bold text-lg text-white">{exam.name}</h5>
                      <p className="text-gray-300 text-sm">Kode: <span className="font-mono bg-gray-600 px-2 py-1 rounded">{exam.code}</span></p>
                      <div className="mt-2 text-xs text-gray-400">
                        <p>📅 Mulai: {new Date(exam.startTime).toLocaleString('id-ID')}</p>
                        <p>⏰ Selesai: {new Date(exam.endTime).toLocaleString('id-ID')}</p>
                        <p>⏱️ Durasi: {Math.round((new Date(exam.endTime).getTime() - new Date(exam.startTime).getTime()) / (1000 * 60))} menit</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-600 text-white">
                      ✅ DISETUJUI
                    </span>
                  </div>
                  
                  {/* Exam Status Check */}
                  {(() => {
                    const now = new Date();
                    const startTime = new Date(exam.startTime);
                    const endTime = new Date(exam.endTime);
                    
                    if (now < startTime) {
                      return (
                        <div className="bg-blue-900 border border-blue-600 p-3 rounded-md mb-3">
                          <p className="text-blue-200 text-sm text-center">
                            ⏰ Ujian akan dimulai pada:<br/>
                            <span className="font-bold">{startTime.toLocaleString('id-ID')}</span>
                          </p>
                        </div>
                      );
                    } else if (now > endTime) {
                      return (
                        <div className="bg-gray-900 border border-gray-600 p-3 rounded-md mb-3">
                          <p className="text-gray-400 text-sm text-center">
                            ⏰ Ujian telah berakhir
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  <button
                    onClick={() => navigateTo('student_precheck', { exam, currentUser: user })}
                    disabled={(() => {
                      const now = new Date();
                      const startTime = new Date(exam.startTime);
                      const endTime = new Date(exam.endTime);
                      return exam.status !== 'published' || now < startTime || now > endTime;
                    })()}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center disabled:bg-gray-500 disabled:cursor-not-allowed"
                  >
                    {(() => {
                      const now = new Date();
                      const startTime = new Date(exam.startTime);
                      const endTime = new Date(exam.endTime);
                      
                      if (exam.status !== 'published') {
                        return '📝 Belum Dipublikasi';
                      }
                      if (exam.status !== 'published') {
                        return (
                          <div className="bg-yellow-900 border border-yellow-600 p-3 rounded-md mb-3">
                            <p className="text-yellow-200 text-sm text-center">
                              📝 Ujian belum dipublikasi oleh dosen
                            </p>
                          </div>
                        );
                      }
                      
                      if (now < startTime) {
                        return '⏰ Belum Dimulai';
                      } else if (now > endTime) {
                        return '⏰ Sudah Berakhir';
                      } else {
                        return '🚀 Mulai Ujian Sekarang';
                      }
                    })()}
                  </button>
                </div>
              ))}
            </div>
            
            {/* Summary Info */}
            {availableExams.length > 1 && (
              <div className="mt-4 bg-green-900 border border-green-600 p-3 rounded-md">
                <p className="text-green-200 text-sm text-center">
                  💡 <strong>Tips:</strong> Anda memiliki {availableExams.length} ujian yang disetujui. 
                  Pastikan untuk mengerjakan semua ujian sesuai jadwal yang ditentukan.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Aplikasi Disetujui tapi Belum Dipublikasi (Purple) */}
        {rejectedApplications.filter(app => app.specialStatus === 'approved_unpublished').length > 0 && (
          <div className="mb-6 bg-purple-800 border border-purple-500 p-6 rounded-lg shadow-lg">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <h4 className="text-xl font-bold text-purple-400">Aplikasi Disetujui</h4>
                <p className="text-purple-200 text-sm">
                  Aplikasi disetujui, menunggu publikasi ujian oleh dosen
                </p>
              </div>
            </div>
            <div className={`grid gap-4 ${
              rejectedApplications.filter(app => app.specialStatus === 'approved_unpublished').length === 1 
                ? 'grid-cols-1' 
                : rejectedApplications.filter(app => app.specialStatus === 'approved_unpublished').length === 2 
                ? 'grid-cols-1 md:grid-cols-2' 
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {rejectedApplications.filter(app => app.specialStatus === 'approved_unpublished').map(exam => (
                <div key={exam.id} className="bg-gray-700 p-4 rounded-lg border border-purple-400">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-grow">
                      <h5 className="font-bold text-lg text-white">{exam.name}</h5>
                      <p className="text-gray-300 text-sm">Kode: <span className="font-mono bg-gray-600 px-2 py-1 rounded">{exam.code}</span></p>
                      <div className="mt-2 text-xs text-gray-400">
                        <p>📅 Diajukan: {exam.appliedAt.toLocaleString('id-ID')}</p>
                        <p>📅 Mulai: {new Date(exam.startTime).toLocaleString('id-ID')}</p>
                        <p>⏰ Selesai: {new Date(exam.endTime).toLocaleString('id-ID')}</p>
                        <p>⏱️ Durasi: {Math.round((new Date(exam.endTime).getTime() - new Date(exam.startTime).getTime()) / (1000 * 60))} menit</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-600 text-white">
                      ✅ DISETUJUI
                    </span>
                  </div>
                  <div className="bg-purple-900 border border-purple-600 p-3 rounded-md">
                    <p className="text-purple-200 text-sm text-center">
                      📝 Aplikasi Anda untuk ujian "<strong>{exam.name}</strong>" telah disetujui!
                      <br/><br/>
                      Ujian belum dipublikasikan oleh dosen. Silakan tunggu hingga ujian siap dimulai.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aplikasi Menunggu Konfirmasi (Yellow) */}
        {pendingApplications.length > 0 && (
          <div className="mb-6 bg-yellow-800 border border-yellow-500 p-6 rounded-lg shadow-lg">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">⏳</span>
              </div>
              <div>
                <h4 className="text-xl font-bold text-yellow-400">
                  {pendingApplications.length === 1 ? 'Menunggu Konfirmasi Dosen' : `${pendingApplications.length} Ujian Menunggu Konfirmasi`}
                </h4>
                <p className="text-yellow-200 text-sm">
                  {pendingApplications.length === 1 
                    ? 'Aplikasi ujian yang sedang menunggu persetujuan dosen'
                    : 'Beberapa aplikasi ujian sedang menunggu persetujuan dosen'}
                </p>
              </div>
            </div>
            <div className={`grid gap-4 ${
              pendingApplications.length === 1 
                ? 'grid-cols-1' 
                : pendingApplications.length === 2 
                ? 'grid-cols-1 md:grid-cols-2' 
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {pendingApplications.map(exam => (
                <div key={exam.id} className="bg-gray-700 p-4 rounded-lg border border-yellow-400">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-grow">
                      <h5 className="font-bold text-lg text-white">{exam.name}</h5>
                      <p className="text-gray-300 text-sm">Kode: <span className="font-mono bg-gray-600 px-2 py-1 rounded">{exam.code}</span></p>
                      <div className="mt-2 text-xs text-gray-400">
                        <p>📅 Diajukan: {exam.appliedAt.toLocaleString('id-ID')}</p>
                        <p>📅 Mulai: {new Date(exam.startTime).toLocaleString('id-ID')}</p>
                        <p>⏰ Selesai: {new Date(exam.endTime).toLocaleString('id-ID')}</p>
                        <p>⏱️ Durasi: {Math.round((new Date(exam.endTime).getTime() - new Date(exam.startTime).getTime()) / (1000 * 60))} menit</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-yellow-600 text-white">
                      ⏳ MENUNGGU
                    </span>
                  </div>
                  <div className="bg-yellow-900 border border-yellow-600 p-3 rounded-md">
                    <p className="text-yellow-200 text-sm text-center">
                      💡 Menunggu persetujuan dari dosen. Silakan tunggu konfirmasi.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aplikasi Ditolak (Red) */}
        {rejectedApplications.filter(app => app.specialStatus !== 'approved_unpublished').length > 0 && (
          <div className="mb-6 bg-red-800 border border-red-500 p-6 rounded-lg shadow-lg">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">❌</span>
              </div>
              <div>
                <h4 className="text-xl font-bold text-red-400">
                  {rejectedApplications.filter(app => app.specialStatus !== 'approved_unpublished').length === 1 
                    ? 'Aplikasi Ditolak' 
                    : `${rejectedApplications.filter(app => app.specialStatus !== 'approved_unpublished').length} Aplikasi Ditolak`}
                </h4>
                <p className="text-red-200 text-sm">
                  {rejectedApplications.filter(app => app.specialStatus !== 'approved_unpublished').length === 1
                    ? 'Aplikasi ujian yang ditolak oleh dosen'
                    : 'Beberapa aplikasi ujian ditolak oleh dosen'}
                </p>
              </div>
            </div>
            <div className={`grid gap-4 ${
              rejectedApplications.filter(app => app.specialStatus !== 'approved_unpublished').length === 1 
                ? 'grid-cols-1' 
                : rejectedApplications.filter(app => app.specialStatus !== 'approved_unpublished').length === 2 
                ? 'grid-cols-1 md:grid-cols-2' 
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {rejectedApplications.filter(app => app.specialStatus !== 'approved_unpublished').map(exam => (
                <div key={exam.id} className="bg-gray-700 p-4 rounded-lg border border-red-400">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-grow">
                      <h5 className="font-bold text-lg text-white">{exam.name}</h5>
                      <p className="text-gray-300 text-sm">Kode: <span className="font-mono bg-gray-600 px-2 py-1 rounded">{exam.code}</span></p>
                      <div className="mt-2 text-xs text-gray-400">
                        <p>📅 Diajukan: {exam.appliedAt.toLocaleString('id-ID')}</p>
                        <p>📅 Mulai: {new Date(exam.startTime).toLocaleString('id-ID')}</p>
                        <p>⏰ Selesai: {new Date(exam.endTime).toLocaleString('id-ID')}</p>
                        <p>⏱️ Durasi: {Math.round((new Date(exam.endTime).getTime() - new Date(exam.startTime).getTime()) / (1000 * 60))} menit</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-600 text-white">
                      ❌ DITOLAK
                    </span>
                  </div>
                  <div className="bg-red-900 border border-red-600 p-3 rounded-md">
                    <p className="text-red-200 text-sm text-center">
                      💬 Hubungi dosen untuk informasi lebih lanjut
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {availableExams.length === 0 && pendingApplications.length === 0 && rejectedApplications.filter(app => app.specialStatus === 'approved_unpublished').length === 0 && rejectedApplications.filter(app => app.specialStatus !== 'approved_unpublished').length === 0 && (
          <div className="bg-gray-800 border border-gray-600 p-8 rounded-lg text-center">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📝</span>
            </div>
            <h4 className="text-xl font-bold text-gray-400 mb-2">Belum Ada Aplikasi Ujian</h4>
            <p className="text-gray-500 mb-4">
              Anda belum mengajukan ujian apapun. Mulai dengan mengajukan ujian pertama Anda.
            </p>
            <button 
              onClick={() => navigateTo('student_join_exam', { currentUser: user })}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg"
            >
              🚀 Ajukan Ujian Pertama
            </button>
          </div>
        )}
      </div>

      {/* Riwayat Ujian Section */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold">Riwayat Ujian Selesai</h3>
      </div>
      
      <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {examResults.length === 0 ? (
          <div className="text-center p-8 text-gray-400">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📊</span>
            </div>
            <p className="text-lg mb-2">Belum ada riwayat ujian yang selesai</p>
            <p className="text-sm text-gray-500">Riwayat ujian akan muncul setelah Anda menyelesaikan ujian</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-700">
              <tr>
                <th className="p-4">Nama Ujian</th>
                <th className="p-4">Kode Ujian</th>
                <th className="p-4">Nilai PG</th>
                <th className="p-4">Nilai Essay</th>
                <th className="p-4">Nilai Live Code</th>
                <th className="p-4">Pengurangan</th>
                <th className="p-4">Nilai Akhir</th>
                <th className="p-4">Status</th>
                <th className="p-4">Waktu Selesai</th>
              </tr>
            </thead>
            <tbody>
              {examResults.map(result => {
                const totalDisplay = result.totalScore ?? result.finalScore;
                return (
                  <tr key={result.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="p-4 font-semibold">{result.examName}</td>
                    <td className="p-4 text-gray-400 font-mono">{result.examCode || 'N/A'}</td>
                    <td className="p-4">
                      <span className={`font-bold ${
                        result.status === 'disqualified'
                          ? 'text-red-400'
                          : result.finalScore >= 70
                          ? 'text-green-400'
                          : result.finalScore >= 60
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}>
                        {result.finalScore.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-300">
                        {result.essayScore !== undefined ? result.essayScore.toFixed(2) : 'N/A'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-300">
                        {result.livecodeScore !== undefined ? result.livecodeScore.toFixed(2) : 'N/A'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded ${
                        (result.scoreReduction || 0) > 0
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-600 text-gray-300'
                      }`}>
                        -{result.scoreReduction || 0}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`font-bold ${
                        result.status === 'disqualified'
                          ? 'text-red-400'
                          : totalDisplay >= 70
                          ? 'text-green-400'
                          : totalDisplay >= 60
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}>
                        {totalDisplay.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        result.status === 'finished'
                          ? 'bg-green-600 text-white'
                          : result.status === 'disqualified'
                          ? 'bg-red-600 text-white'
                          : 'bg-yellow-600 text-white'
                      }`}>
                        {result.status === 'finished' ? 'Selesai' :
                         result.status === 'disqualified' ? 'Diskualifikasi' :
                         result.status === 'started' ? 'Sedang Berlangsung' : 'Pending'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400">
                      {result.finishTime ? result.finishTime.toLocaleString('id-ID') : 'Belum selesai'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;