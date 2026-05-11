import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, deleteDoc, query, where, limit, startAfter, orderBy, DocumentSnapshot, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import Modal from '../ui/Modal';

interface Application {
  id: string;
  studentId: string;
  studentData: {
    fullName: string;
    username: string;
    major: string;
    className: string;
    university: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: Date;
}

interface StudentConfirmationProps {
  navigateBack: () => void;
  appState: any;
}

const StudentConfirmation: React.FC<StudentConfirmationProps> = ({ navigateBack, appState }) => {
  const { exam, parentExam } = appState;
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const APPLICATIONS_PER_PAGE = 50;
  const [editingApplication, setEditingApplication] = useState<Application | null>(null);
  const [newStatus, setNewStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [confirmDeleteApp, setConfirmDeleteApp] = useState<Application | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  const handleBackNavigation = () => {
    navigateBack();
  };

  useEffect(() => {
    if (!exam?.id) return;
    
    // Load first page of applications
    loadApplications(true);
    
    // Set up real-time listener for applications
    const applicationsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`);
    const unsubscribe = onSnapshot(
      query(applicationsRef, orderBy('appliedAt', 'desc'), limit(APPLICATIONS_PER_PAGE)),
      (snapshot) => {
        const newApplications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          appliedAt: doc.data().appliedAt?.toDate() || new Date()
        } as Application));
        
        setApplications(newApplications);
        setSelectedStudents(new Set()); // Reset selection on real-time update
        
        // Update pagination state
        setHasMoreData(snapshot.docs.length === APPLICATIONS_PER_PAGE);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        setCurrentPage(1);
      }
    );
    
    // Fallback refresh every 30 seconds for pagination data
    const refreshInterval = setInterval(() => {
      if (!isLoadingMore) {
        loadApplications(true);
      }
    }, 45000); // Longer interval since we have real-time updates
    
    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [exam?.id]);

  const loadApplications = async (isFirstLoad = false) => {
    if (!exam?.id) return;
    
    if (!isFirstLoad && !hasMoreData) return;
    
    setIsLoadingMore(true);
    
    try {
      const applicationsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`);
      let applicationsQuery = query(
        applicationsRef, 
        orderBy('appliedAt', 'desc'),
        limit(APPLICATIONS_PER_PAGE)
      );
      
      if (!isFirstLoad && lastDoc) {
        applicationsQuery = query(
          applicationsRef,
          orderBy('appliedAt', 'desc'),
          startAfter(lastDoc),
          limit(APPLICATIONS_PER_PAGE)
        );
      }
      
      const snapshot = await getDocs(applicationsQuery);
      const newApplications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        appliedAt: doc.data().appliedAt?.toDate() || new Date()
      } as Application));
      
      if (isFirstLoad) {
        setApplications(newApplications);
        setCurrentPage(1);
        setSelectedStudents(new Set()); // Reset selection on refresh
      } else {
        setApplications(prev => [...prev, ...newApplications]);
        setCurrentPage(prev => prev + 1);
      }
      
      // Update pagination state
      setHasMoreData(snapshot.docs.length === APPLICATIONS_PER_PAGE);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSelectStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleSelectAll = () => {
    const pendingApplications = applications.filter(app => app.status === 'pending');
    if (selectedStudents.size === pendingApplications.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(pendingApplications.map(app => app.id)));
    }
  };

  const handleApproveSelected = async () => {
    setIsLoading(true);
    try {
      const promises = Array.from(selectedStudents).map(applicationId => {
        const appRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`, applicationId);
        return updateDoc(appRef, { status: 'approved' });
      });
      
      await Promise.all(promises);
      setSelectedStudents(new Set());
      
      // Show success message
      alert(`${selectedStudents.size} siswa berhasil disetujui!`);
    } catch (error) {
      console.error('Error approving students:', error);
      alert('Gagal menyetujui siswa. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectSelected = async () => {
    setIsLoading(true);
    try {
      const promises = Array.from(selectedStudents).map(applicationId => {
        const appRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`, applicationId);
        return updateDoc(appRef, { status: 'rejected' });
      });
      
      await Promise.all(promises);
      setSelectedStudents(new Set());
      
      // Show success message
      alert(`${selectedStudents.size} siswa berhasil ditolak!`);
    } catch (error) {
      console.error('Error rejecting students:', error);
      alert('Gagal menolak siswa. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIndividualAction = async (applicationId: string, action: 'approve' | 'reject') => {
    const appRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`, applicationId);
    await updateDoc(appRef, { 
      status: action === 'approve' ? 'approved' : 'rejected' 
    });
  };

  const handleDeleteStudent = async (app: Application) => {
    setIsDeletingStudent(true);
    try {
      // 1. Delete the application document
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`, app.id));

      // 2. Delete session documents for this student
      const sessionsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`);
      const sessionsSnap = await getDocs(query(sessionsRef, where('studentId', '==', app.studentId)));
      await Promise.all(sessionsSnap.docs.map(d => deleteDoc(d.ref)));

      // 3. Delete face verification logs for this student in this exam
      const faceLogsRef = collection(db, `artifacts/${appId}/public/data/face_verification_logs`);
      const faceLogsSnap = await getDocs(
        query(faceLogsRef, where('examId', '==', exam.id), where('studentId', '==', app.studentId))
      );
      await Promise.all(faceLogsSnap.docs.map(d => deleteDoc(d.ref)));

      setApplications(prev => prev.filter(a => a.id !== app.id));
      setConfirmDeleteApp(null);
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Gagal menghapus peserta. Silakan coba lagi.');
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const handleEditStatus = (application: Application) => {
    setEditingApplication(application);
    setNewStatus(application.status);
  };

  const handleSaveStatus = async () => {
    if (!editingApplication) return;
    
    setIsUpdatingStatus(true);
    
    try {
      const appRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`, editingApplication.id);
      await updateDoc(appRef, { status: newStatus });
      
      setEditingApplication(null);
      alert(`Status siswa ${editingApplication.studentData.fullName} berhasil diubah menjadi ${
        newStatus === 'pending' ? 'Menunggu' :
        newStatus === 'approved' ? 'Disetujui' : 'Ditolak'
      }!`);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Gagal mengubah status. Silakan coba lagi.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const pendingApplications = applications.filter(app => app.status === 'pending');
  const approvedCount = applications.filter(app => app.status === 'approved').length;
  const rejectedCount = applications.filter(app => app.status === 'rejected').length;

  return (
    <div>
      {/* Delete Confirmation Modal */}
      {confirmDeleteApp && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-900/60 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Hapus Peserta Ujian</h3>
                <p className="text-sm text-gray-400">{confirmDeleteApp.studentData.fullName}</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-2">Data berikut akan dihapus permanen:</p>
            <ul className="text-sm text-gray-400 mb-5 bg-gray-700/50 rounded-lg p-3 space-y-1 list-disc list-inside">
              <li>Pendaftaran ujian peserta ini</li>
              <li>Riwayat/sesi ujian (jawaban, nilai, pelanggaran)</li>
              <li>Log verifikasi wajah</li>
            </ul>
            <p className="text-xs text-yellow-400 mb-5">Peserta dapat mendaftar ulang menggunakan kode ujian yang sama setelah dihapus.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteApp(null)}
                disabled={isDeletingStudent}
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteStudent(confirmDeleteApp)}
                disabled={isDeletingStudent}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60 flex items-center gap-2"
              >
                {isDeletingStudent && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                {isDeletingStudent ? 'Menghapus...' : 'Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!editingApplication}
        title="Edit Status Siswa"
        onCancel={() => setEditingApplication(null)}
        onConfirm={handleSaveStatus}
        confirmText={isUpdatingStatus ? 'Menyimpan...' : 'Simpan Status'}
        confirmColor="green"
      >
        {editingApplication && (
          <div className="space-y-4">
            <div className="bg-gray-700 p-3 rounded-lg text-center">
              <h4 className="font-bold text-lg text-white">{editingApplication.studentData.fullName}</h4>
              <p className="text-sm text-gray-300">{editingApplication.studentData.username}</p>
              <p className="text-sm text-gray-300">{editingApplication.studentData.major} - {editingApplication.studentData.className}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Pilih Status Baru:
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as 'pending' | 'approved' | 'rejected')}
                className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="pending">⏳ Menunggu</option>
                <option value="approved">✅ Disetujui</option>
                <option value="rejected">❌ Ditolak</option>
              </select>
            </div>
            
            <div className="bg-blue-900 border border-blue-500 p-3 rounded-md">
              <p className="text-blue-300 text-sm">
                💡 <strong>Info:</strong> Mengubah status akan langsung mempengaruhi akses siswa ke ujian.
              </p>
            </div>
          </div>
        )}
      </Modal>
      
      <button 
        onClick={handleBackNavigation} 
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>
      
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2">Konfirmasi Siswa</h2>
        <p className="text-lg text-indigo-400 mb-4">{exam.name} ({exam.code})</p>
        
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-yellow-600 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">{pendingApplications.length}</div>
            <div className="text-sm">Menunggu Konfirmasi</div>
          </div>
          <div className="bg-green-600 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">{approvedCount}</div>
            <div className="text-sm">Disetujui</div>
          </div>
          <div className="bg-red-600 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">{rejectedCount}</div>
            <div className="text-sm">Ditolak</div>
          </div>
        </div>
        
        {hasMoreData && (
          <div className="mb-4 bg-blue-900 border border-blue-500 p-3 rounded-lg">
            <p className="text-blue-300 text-sm">
              📄 Menampilkan {applications.length} aplikasi (Halaman {currentPage}) - Ada data lainnya
            </p>
          </div>
        )}
      </div>

      {pendingApplications.length > 0 && (
        <div className="mb-6 bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleSelectAll}
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg"
              >
                {selectedStudents.size === pendingApplications.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
              </button>
              <span className="text-gray-400">
                {selectedStudents.size} dari {pendingApplications.length} dipilih
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              {selectedStudents.size > 0 && (
                <>
                  <button
                    onClick={handleApproveSelected}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-green-400"
                  >
                    Setujui Terpilih
                  </button>
                  <button
                    onClick={handleRejectSelected}
                    disabled={isLoading}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-red-400"
                  >
                    Tolak Terpilih
                  </button>
                </>
              )}
              
              <button
                onClick={() => loadApplications(true)}
                disabled={isLoadingMore}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-blue-400"
              >
                {isLoadingMore ? '🔄' : '🔄'} Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {applications.length === 0 ? (
          <div className="text-center p-8 text-gray-400">
            Belum ada siswa yang mengajukan untuk ujian ini.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-4">Pilih</th>
                    <th className="p-4">Foto</th>
                    <th className="p-4">Nama Lengkap</th>
                    <th className="p-4">Username</th>
                    <th className="p-4">Program Studi</th>
                    <th className="p-4">Kelas</th>
                    <th className="p-4">Universitas</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(app => (
                    <tr key={app.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                      <td className="p-4">
                        {app.status === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selectedStudents.has(app.id)}
                            onChange={() => handleSelectStudent(app.id)}
                            className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                          />
                        )}
                      </td>
                      <td className="p-4">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-white">
                            {app.studentData.fullName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-semibold">{app.studentData.fullName}</td>
                      <td className="p-4 text-gray-400">{app.studentData.username}</td>
                      <td className="p-4">{app.studentData.major}</td>
                      <td className="p-4">{app.studentData.className}</td>
                      <td className="p-4">{app.studentData.university}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                          app.status === 'pending' 
                            ? 'bg-yellow-600 text-white' 
                            : app.status === 'approved'
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}>
                          {app.status === 'pending' ? 'Menunggu' : 
                           app.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {app.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleIndividualAction(app.id, 'approve')}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1 px-3 rounded"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => handleIndividualAction(app.id, 'reject')}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded"
                              >
                                Tolak
                              </button>
                            </>
                          )}
                          {app.status !== 'pending' && (
                            <button
                              onClick={() => handleEditStatus(app)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded"
                            >
                              Edit Status
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmDeleteApp(app)}
                            className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded"
                            title="Hapus peserta ujian beserta semua riwayatnya"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {hasMoreData && (
              <div className="p-6 bg-gray-700 border-t border-gray-600">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-400">
                    Menampilkan {applications.length} aplikasi (Halaman {currentPage})
                  </div>
                  <button
                    onClick={() => loadApplications(false)}
                    disabled={isLoadingMore}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-indigo-400 flex items-center"
                  >
                    {isLoadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Memuat...
                      </>
                    ) : (
                      <>
                        📄 Muat Lebih Banyak ({APPLICATIONS_PER_PAGE} aplikasi)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StudentConfirmation;