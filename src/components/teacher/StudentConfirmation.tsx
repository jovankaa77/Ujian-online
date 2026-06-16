import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, updateDoc, doc, deleteDoc, query, where, limit, startAfter, orderBy, DocumentSnapshot, getCountFromServer } from 'firebase/firestore';
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

const APPLICATIONS_PER_PAGE = 50;

const StudentConfirmation: React.FC<StudentConfirmationProps> = ({ navigateBack, appState }) => {
  const { exam } = appState;
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [totalRejected, setTotalRejected] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [pageCursors, setPageCursors] = useState<(DocumentSnapshot | null)[]>([null]);
  const [editingApplication, setEditingApplication] = useState<Application | null>(null);
  const [newStatus, setNewStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [confirmDeleteApp, setConfirmDeleteApp] = useState<Application | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  const totalPages = Math.ceil(totalCount / APPLICATIONS_PER_PAGE);

  const loadCounts = useCallback(async () => {
    if (!exam?.id) return;
    const applicationsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`);
    const [all, approved, rejected, pending] = await Promise.all([
      getCountFromServer(query(applicationsRef)),
      getCountFromServer(query(applicationsRef, where('status', '==', 'approved'))),
      getCountFromServer(query(applicationsRef, where('status', '==', 'rejected'))),
      getCountFromServer(query(applicationsRef, where('status', '==', 'pending'))),
    ]);
    setTotalCount(all.data().count);
    setTotalApproved(approved.data().count);
    setTotalRejected(rejected.data().count);
    setTotalPending(pending.data().count);
  }, [exam?.id]);

  const loadPage = useCallback(async (page: number, cursors: (DocumentSnapshot | null)[]) => {
    if (!exam?.id) return;
    setIsPageLoading(true);
    try {
      const applicationsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`);
      const cursor = cursors[page - 1] ?? null;
      let q = query(applicationsRef, orderBy('appliedAt', 'desc'), limit(APPLICATIONS_PER_PAGE));
      if (cursor) q = query(applicationsRef, orderBy('appliedAt', 'desc'), startAfter(cursor), limit(APPLICATIONS_PER_PAGE));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        appliedAt: d.data().appliedAt?.toDate() || new Date()
      } as Application));
      setApplications(data);
      setSelectedStudents(new Set());
      if (snapshot.docs.length > 0) {
        setPageCursors(prev => {
          const updated = [...prev];
          updated[page] = snapshot.docs[snapshot.docs.length - 1];
          return updated;
        });
      }
    } catch (err) {
      console.error('Error loading applications:', err);
    } finally {
      setIsPageLoading(false);
    }
  }, [exam?.id]);

  useEffect(() => {
    if (!exam?.id) return;
    loadCounts();
    loadPage(1, [null]);
  }, [exam?.id]);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    loadPage(page, pageCursors);
  };

  const handleSelectStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) newSelected.delete(studentId);
    else newSelected.add(studentId);
    setSelectedStudents(newSelected);
  };

  const handleSelectAll = () => {
    const pendingApps = applications.filter(app => app.status === 'pending');
    if (selectedStudents.size === pendingApps.length) setSelectedStudents(new Set());
    else setSelectedStudents(new Set(pendingApps.map(app => app.id)));
  };

  const handleApproveSelected = async () => {
    const size = selectedStudents.size;
    setIsLoading(true);
    try {
      await Promise.all(Array.from(selectedStudents).map(id =>
        updateDoc(doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`, id), { status: 'approved' })
      ));
      setSelectedStudents(new Set());
      alert(`${size} peserta ujian berhasil disetujui!`);
      await loadCounts();
      await loadPage(currentPage, pageCursors);
    } catch {
      alert('Gagal menyetujui peserta ujian. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectSelected = async () => {
    const size = selectedStudents.size;
    setIsLoading(true);
    try {
      await Promise.all(Array.from(selectedStudents).map(id =>
        updateDoc(doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`, id), { status: 'rejected' })
      ));
      setSelectedStudents(new Set());
      alert(`${size} peserta ujian berhasil ditolak!`);
      await loadCounts();
      await loadPage(currentPage, pageCursors);
    } catch {
      alert('Gagal menolak peserta ujian. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIndividualAction = async (applicationId: string, action: 'approve' | 'reject') => {
    await updateDoc(
      doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`, applicationId),
      { status: action === 'approve' ? 'approved' : 'rejected' }
    );
    await loadCounts();
    await loadPage(currentPage, pageCursors);
  };

  const handleDeleteStudent = async (app: Application) => {
    setIsDeletingStudent(true);
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`, app.id));
      const sessionsSnap = await getDocs(query(
        collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`),
        where('studentId', '==', app.studentId)
      ));
      await Promise.all(sessionsSnap.docs.map(d => deleteDoc(d.ref)));
      const faceLogsSnap = await getDocs(query(
        collection(db, `artifacts/${appId}/public/data/face_verification_logs`),
        where('examId', '==', exam.id), where('studentId', '==', app.studentId)
      ));
      await Promise.all(faceLogsSnap.docs.map(d => deleteDoc(d.ref)));
      setConfirmDeleteApp(null);
      setPageCursors([null]);
      setCurrentPage(1);
      await loadCounts();
      await loadPage(1, [null]);
    } catch (err) {
      console.error('Error deleting student:', err);
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
      await updateDoc(
        doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/applications`, editingApplication.id),
        { status: newStatus }
      );
      setEditingApplication(null);
      await loadCounts();
      await loadPage(currentPage, pageCursors);
      alert(`Status peserta ujian ${editingApplication.studentData.fullName} berhasil diubah menjadi ${
        newStatus === 'pending' ? 'Menunggu' : newStatus === 'approved' ? 'Disetujui' : 'Ditolak'
      }!`);
    } catch {
      alert('Gagal mengubah status. Silakan coba lagi.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const pendingApplications = applications.filter(app => app.status === 'pending');
  const startItem = totalCount > 0 ? (currentPage - 1) * APPLICATIONS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * APPLICATIONS_PER_PAGE, totalCount);

  const PaginationBar = () => (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-700 border-t border-gray-600 flex-wrap gap-2">
      <div className="text-sm text-gray-400">
        {totalCount > 0 ? `${startItem}–${endItem} dari ${totalCount} data` : 'Tidak ada data'}
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <button onClick={() => goToPage(1)} disabled={currentPage === 1 || isPageLoading}
          className="px-2 py-1 rounded text-sm bg-gray-600 hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed">«</button>
        <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1 || isPageLoading}
          className="px-3 py-1 rounded text-sm bg-gray-600 hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed">‹ Sebelumnya</button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let page: number;
          if (totalPages <= 7) page = i + 1;
          else if (currentPage <= 4) page = i + 1;
          else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
          else page = currentPage - 3 + i;
          return (
            <button key={page} onClick={() => goToPage(page)} disabled={isPageLoading}
              className={`px-3 py-1 rounded text-sm font-medium disabled:cursor-not-allowed ${
                currentPage === page ? 'bg-indigo-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
              }`}>{page}</button>
          );
        })}
        <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages || isPageLoading}
          className="px-3 py-1 rounded text-sm bg-gray-600 hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed">Berikutnya ›</button>
        <button onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages || isPageLoading}
          className="px-2 py-1 rounded text-sm bg-gray-600 hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed">»</button>
      </div>
    </div>
  );

  return (
    <div>
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
              <button onClick={() => setConfirmDeleteApp(null)} disabled={isDeletingStudent}
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60">Batal</button>
              <button onClick={() => handleDeleteStudent(confirmDeleteApp)} disabled={isDeletingStudent}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60 flex items-center gap-2">
                {isDeletingStudent && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                {isDeletingStudent ? 'Menghapus...' : 'Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={!!editingApplication} title="Edit Status Peserta Ujian"
        onCancel={() => setEditingApplication(null)} onConfirm={handleSaveStatus}
        confirmText={isUpdatingStatus ? 'Menyimpan...' : 'Simpan Status'} confirmColor="green">
        {editingApplication && (
          <div className="space-y-4">
            <div className="bg-gray-700 p-3 rounded-lg text-center">
              <h4 className="font-bold text-lg text-white">{editingApplication.studentData.fullName}</h4>
              <p className="text-sm text-gray-300">{editingApplication.studentData.username}</p>
              <p className="text-sm text-gray-300">{editingApplication.studentData.major} - {editingApplication.studentData.className}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Pilih Status Baru:</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as any)}
                className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="pending">⏳ Menunggu</option>
                <option value="approved">✅ Disetujui</option>
                <option value="rejected">❌ Ditolak</option>
              </select>
            </div>
            <div className="bg-blue-900 border border-blue-500 p-3 rounded-md">
              <p className="text-blue-300 text-sm">
                💡 <strong>Info:</strong> Mengubah status akan langsung mempengaruhi akses peserta ujian ke ujian.
              </p>
            </div>
          </div>
        )}
      </Modal>

      <button onClick={navigateBack} className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">
        &larr; Kembali
      </button>

      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2">Konfirmasi Peserta Ujian</h2>
        <p className="text-lg text-indigo-400 mb-4">{exam.name} ({exam.code})</p>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-yellow-600 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">{totalPending}</div>
            <div className="text-sm">Menunggu Konfirmasi</div>
            <div className="text-xs opacity-75 mt-1">Total keseluruhan</div>
          </div>
          <div className="bg-green-600 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">{totalApproved}</div>
            <div className="text-sm">Disetujui</div>
            <div className="text-xs opacity-75 mt-1">Total keseluruhan</div>
          </div>
          <div className="bg-red-600 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">{totalRejected}</div>
            <div className="text-sm">Ditolak</div>
            <div className="text-xs opacity-75 mt-1">Total keseluruhan</div>
          </div>
        </div>
      </div>

      {pendingApplications.length > 0 && (
        <div className="mb-4 bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <button onClick={handleSelectAll}
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg text-sm">
                {selectedStudents.size === pendingApplications.length ? 'Batal Pilih Semua' : 'Pilih Semua di Halaman Ini'}
              </button>
              <span className="text-gray-400 text-sm">{selectedStudents.size} dipilih</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedStudents.size > 0 && (
                <>
                  <button onClick={handleApproveSelected} disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-sm">
                    Setujui Terpilih
                  </button>
                  <button onClick={handleRejectSelected} disabled={isLoading}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-sm">
                    Tolak Terpilih
                  </button>
                </>
              )}
              <button onClick={() => { loadCounts(); loadPage(currentPage, pageCursors); }} disabled={isPageLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-sm flex items-center gap-1">
                {isPageLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '🔄'} Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {isPageLoading && applications.length === 0 ? (
          <div className="flex items-center justify-center p-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
            <span className="ml-3 text-gray-400">Memuat data...</span>
          </div>
        ) : totalCount === 0 ? (
          <div className="text-center p-8 text-gray-400">
            Belum ada peserta ujian yang mengajukan untuk ujian ini.
          </div>
        ) : (
          <>
            <PaginationBar />
            <div className={`overflow-x-auto transition-opacity ${isPageLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
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
                          <input type="checkbox" checked={selectedStudents.has(app.id)}
                            onChange={() => handleSelectStudent(app.id)}
                            className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" />
                        )}
                      </td>
                      <td className="p-4">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{app.studentData.fullName.charAt(0).toUpperCase()}</span>
                        </div>
                      </td>
                      <td className="p-4 font-semibold">{app.studentData.fullName}</td>
                      <td className="p-4 text-gray-400">{app.studentData.username}</td>
                      <td className="p-4">{app.studentData.major}</td>
                      <td className="p-4">{app.studentData.className}</td>
                      <td className="p-4">{app.studentData.university}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                          app.status === 'pending' ? 'bg-yellow-600 text-white'
                          : app.status === 'approved' ? 'bg-green-600 text-white'
                          : 'bg-red-600 text-white'
                        }`}>
                          {app.status === 'pending' ? 'Menunggu' : app.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {app.status === 'pending' && (
                            <>
                              <button onClick={() => handleIndividualAction(app.id, 'approve')}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1 px-3 rounded">Setujui</button>
                              <button onClick={() => handleIndividualAction(app.id, 'reject')}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded">Tolak</button>
                            </>
                          )}
                          {app.status !== 'pending' && (
                            <button onClick={() => handleEditStatus(app)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded">Edit Status</button>
                          )}
                          <button onClick={() => setConfirmDeleteApp(app)}
                            className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded"
                            title="Hapus peserta ujian beserta semua riwayatnya">Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar />
          </>
        )}
      </div>
    </div>
  );
};

export default StudentConfirmation;
