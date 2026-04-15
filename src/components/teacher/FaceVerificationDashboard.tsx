import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';

interface FaceVerificationDashboardProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  appState: any;
}

interface FaceLog {
  id: string;
  studentId: string;
  fullName: string;
  kelas: string;
  jurusan: string;
  violationType: 'Wajah Ganda' | 'Wajah Tidak Dikenali';
  evidencePhotoUrl: string;
  baselinePhotoUrl: string;
  timestamp: any;
  examId: string;
  examCode: string;
}

interface BaselinePhoto {
  id: string;
  studentId: string;
  fullName: string;
  kelas: string;
  jurusan: string;
  faceBaselineUrl: string;
  faceVerifiedAt: string;
}

interface GroupedStudent {
  studentId: string;
  fullName: string;
  kelas: string;
  jurusan: string;
  baselinePhotoUrl: string;
  violations: FaceLog[];
}

interface SelectedPhoto {
  evidenceUrl: string;
  baselineUrl: string;
  violationType: string;
  timestamp: string;
  studentName: string;
}

const FaceVerificationDashboard: React.FC<FaceVerificationDashboardProps> = ({
  navigateBack,
  appState,
}) => {
  const { exam } = appState;
  const [logs, setLogs] = useState<FaceLog[]>([]);
  const [baselinePhotos, setBaselinePhotos] = useState<BaselinePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'violations' | 'baselines'>('violations');
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'violation'; logId: string } | { type: 'baseline'; sessionId: string; studentName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadLogs();
    loadBaselinePhotos();
  }, [exam?.id]);

  const loadLogs = async () => {
    if (!exam?.id) return;
    setIsLoading(true);
    try {
      const logsRef = collection(db, `artifacts/${appId}/public/data/face_verification_logs`);
      const q = query(
        logsRef,
        where('examId', '==', exam.id),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      const logsData: FaceLog[] = [];
      snapshot.forEach((doc) => {
        logsData.push({ id: doc.id, ...doc.data() } as FaceLog);
      });
      setLogs(logsData);
    } catch {
      const logsRef = collection(db, `artifacts/${appId}/public/data/face_verification_logs`);
      const q = query(logsRef, where('examId', '==', exam.id));
      try {
        const snapshot = await getDocs(q);
        const logsData: FaceLog[] = [];
        snapshot.forEach((doc) => {
          logsData.push({ id: doc.id, ...doc.data() } as FaceLog);
        });
        logsData.sort((a, b) => {
          const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp);
          const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp);
          return timeB.getTime() - timeA.getTime();
        });
        setLogs(logsData);
      } catch (err) {
        console.error('Fallback query also failed:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadBaselinePhotos = async () => {
    if (!exam?.id) return;
    try {
      const sessionsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`);
      const snapshot = await getDocs(sessionsRef);
      const photos: BaselinePhoto[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.faceBaselineUrl) {
          photos.push({
            id: docSnap.id,
            studentId: data.studentId || '',
            fullName: data.studentInfo?.fullName || data.studentInfo?.name || '',
            kelas: data.studentInfo?.className || '',
            jurusan: data.studentInfo?.major || '',
            faceBaselineUrl: data.faceBaselineUrl,
            faceVerifiedAt: data.faceVerifiedAt || data.startTime?.toDate?.()?.toISOString() || '',
          });
        }
      });
      setBaselinePhotos(photos);
    } catch (error) {
      console.error('Error loading baseline photos:', error);
    }
  };

  const handleDeleteViolation = async (logId: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/face_verification_logs`, logId));
      setLogs(prev => prev.filter(l => l.id !== logId));
    } catch (error) {
      console.error('Error deleting violation log:', error);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(null);
    }
  };

  const handleDeleteBaseline = async (sessionId: string) => {
    setIsDeleting(true);
    try {
      const sessionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, sessionId);
      await updateDoc(sessionDocRef, { faceBaselineUrl: '', faceDescriptor: [] });
      setBaselinePhotos(prev => prev.filter(p => p.id !== sessionId));
    } catch (error) {
      console.error('Error deleting baseline photo:', error);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(null);
    }
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '-';
    const date = timestamp?.toDate?.() || new Date(timestamp);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const groupedStudents = useMemo<GroupedStudent[]>(() => {
    const map = new Map<string, GroupedStudent>();
    for (const log of logs) {
      const key = log.studentId || log.fullName;
      if (!map.has(key)) {
        map.set(key, {
          studentId: log.studentId,
          fullName: log.fullName,
          kelas: log.kelas,
          jurusan: log.jurusan,
          baselinePhotoUrl: log.baselinePhotoUrl || '',
          violations: [],
        });
      }
      map.get(key)!.violations.push(log);
    }
    return Array.from(map.values());
  }, [logs]);

  const filteredGrouped = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return groupedStudents;
    return groupedStudents.filter(
      (s) =>
        s.fullName?.toLowerCase().includes(term) ||
        s.kelas?.toLowerCase().includes(term) ||
        s.jurusan?.toLowerCase().includes(term)
    );
  }, [groupedStudents, searchTerm]);

  const getFilteredBaselines = () => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return baselinePhotos;
    return baselinePhotos.filter(
      (photo) =>
        photo.fullName?.toLowerCase().includes(term) ||
        photo.kelas?.toLowerCase().includes(term) ||
        photo.jurusan?.toLowerCase().includes(term)
    );
  };

  const totalViolations = logs.length;

  return (
    <div className="min-h-screen">
      <button
        onClick={navigateBack}
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>

      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2">Verifikasi Wajah</h2>
        <p className="text-gray-400">
          Ujian: <span className="font-semibold text-white">{exam?.name}</span> (Kode: {exam?.code})
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setActiveTab('violations')}
          className={`px-4 py-2 rounded-lg font-bold transition-colors ${
            activeTab === 'violations'
              ? 'bg-red-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Pelanggaran Wajah ({totalViolations})
        </button>
        <button
          onClick={() => setActiveTab('baselines')}
          className={`px-4 py-2 rounded-lg font-bold transition-colors ${
            activeTab === 'baselines'
              ? 'bg-teal-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Foto Verifikasi Awal ({baselinePhotos.length})
        </button>
      </div>

      <div className="mb-6 bg-gray-800 p-4 rounded-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Cari (Nama/Kelas/Jurusan)
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ketik untuk mencari..."
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                loadLogs();
                loadBaselinePhotos();
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'violations' && (
        <>
          <div className="mb-4">
            <p className="text-gray-400">
              Menampilkan <span className="font-bold text-white">{filteredGrouped.length}</span> siswa
              {' '}dengan total <span className="font-bold text-white">{totalViolations}</span> pelanggaran
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
            </div>
          ) : filteredGrouped.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-lg text-gray-300">Tidak ada pelanggaran wajah terdeteksi</p>
              <p className="text-sm text-gray-500 mt-2">
                {searchTerm
                  ? 'Coba ubah kata kunci pencarian'
                  : 'Semua siswa mengikuti ujian dengan baik'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredGrouped.map((student) => (
                <StudentViolationCard
                  key={student.studentId || student.fullName}
                  student={student}
                  formatTimestamp={formatTimestamp}
                  onPhotoClick={(photo) => setSelectedPhoto(photo)}
                  onDeleteViolation={(logId) => setConfirmDelete({ type: 'violation', logId })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'baselines' && (
        <>
          <div className="mb-4">
            <p className="text-gray-400">
              Menampilkan <span className="font-bold text-white">{getFilteredBaselines().length}</span> dari{' '}
              <span className="font-bold text-white">{baselinePhotos.length}</span> foto verifikasi
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
            </div>
          ) : getFilteredBaselines().length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <p className="text-lg text-gray-300">Belum ada foto verifikasi</p>
              <p className="text-sm text-gray-500 mt-2">
                {searchTerm
                  ? 'Coba ubah kata kunci pencarian'
                  : 'Foto verifikasi akan muncul saat siswa memulai ujian'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {getFilteredBaselines().map((photo) => (
                <div
                  key={photo.id}
                  className="bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 hover:border-teal-500 transition-colors"
                >
                  <div className="aspect-square bg-gray-900 overflow-hidden relative">
                    <img
                      src={photo.faceBaselineUrl}
                      alt={photo.fullName}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() =>
                        setSelectedPhoto({
                          evidenceUrl: '',
                          baselineUrl: photo.faceBaselineUrl,
                          violationType: '',
                          timestamp: formatTimestamp(photo.faceVerifiedAt),
                          studentName: photo.fullName,
                        })
                      }
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete({ type: 'baseline', sessionId: photo.id, studentName: photo.fullName });
                      }}
                      className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg transition-colors"
                      title="Hapus foto verifikasi"
                    >
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-3">
                    <h4 className="font-bold text-white text-sm truncate">
                      {photo.fullName || 'Nama tidak tersedia'}
                    </h4>
                    <p className="text-xs text-gray-400 truncate">
                      {photo.kelas && <span>{photo.kelas}</span>}
                      {photo.kelas && photo.jurusan && <span> - </span>}
                      {photo.jurusan && <span>{photo.jurusan}</span>}
                    </p>
                    {photo.faceVerifiedAt && (
                      <p className="text-xs text-gray-500 mt-1">{formatTimestamp(photo.faceVerifiedAt)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {selectedPhoto && (
        <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-900/60 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Konfirmasi Hapus</h3>
                <p className="text-sm text-gray-400">
                  {confirmDelete.type === 'violation'
                    ? 'Hapus log pelanggaran ini?'
                    : `Hapus foto verifikasi ${confirmDelete.studentName}?`}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-5 bg-gray-700/50 rounded-lg p-3">
              {confirmDelete.type === 'violation'
                ? 'Data pelanggaran ini akan dihapus permanen dan tidak dapat dikembalikan.'
                : 'Foto verifikasi wajah siswa ini akan dihapus. Siswa perlu melakukan verifikasi ulang saat ujian berikutnya.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.type === 'violation') {
                    handleDeleteViolation(confirmDelete.logId);
                  } else {
                    handleDeleteBaseline(confirmDelete.sessionId);
                  }
                }}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60 flex items-center gap-2"
              >
                {isDeleting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                {isDeleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StudentViolationCard: React.FC<{
  student: GroupedStudent;
  formatTimestamp: (ts: any) => string;
  onPhotoClick: (photo: SelectedPhoto) => void;
  onDeleteViolation: (logId: string) => void;
}> = ({ student, formatTimestamp, onPhotoClick, onDeleteViolation }) => {
  const doubleCount = student.violations.filter((v) => v.violationType === 'Wajah Ganda').length;
  const unrecognizedCount = student.violations.filter((v) => v.violationType === 'Wajah Tidak Dikenali').length;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-gray-900 overflow-hidden flex-shrink-0 border-2 border-gray-600">
            {student.baselinePhotoUrl ? (
              <img
                src={student.baselinePhotoUrl}
                alt={student.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">
              {student.fullName || 'Nama tidak tersedia'}
            </h3>
            <p className="text-sm text-gray-400">
              {student.kelas && <span>{student.kelas}</span>}
              {student.kelas && student.jurusan && <span> | </span>}
              {student.jurusan && <span>{student.jurusan}</span>}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <span className="text-2xl font-bold text-red-400">{student.violations.length}</span>
            <p className="text-xs text-gray-500">pelanggaran</p>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          {doubleCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-red-900/60 text-red-300 border border-red-700/50">
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              Wajah Ganda ({doubleCount})
            </span>
          )}
          {unrecognizedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-yellow-900/60 text-yellow-300 border border-yellow-700/50">
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              Tidak Dikenali ({unrecognizedCount})
            </span>
          )}
        </div>

        <div className="relative">
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
            Foto Kejadian ({student.violations.length})
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {student.violations.map((v) => (
              <div key={v.id} className="flex-shrink-0 w-32 group">
                <div
                  className="w-32 h-32 rounded-lg overflow-hidden bg-gray-900 border border-gray-600 group-hover:border-teal-500 transition-colors relative cursor-pointer"
                  onClick={() =>
                    onPhotoClick({
                      evidenceUrl: v.evidencePhotoUrl,
                      baselineUrl: v.baselinePhotoUrl || student.baselinePhotoUrl,
                      violationType: v.violationType,
                      timestamp: formatTimestamp(v.timestamp),
                      studentName: student.fullName,
                    })
                  }
                >
                  {v.evidencePhotoUrl ? (
                    <img
                      src={v.evidencePhotoUrl}
                      alt="Bukti"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                      />
                    </svg>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteViolation(v.id);
                    }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Hapus pelanggaran ini"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="mt-1.5">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      v.violationType === 'Wajah Ganda'
                        ? 'bg-red-900/60 text-red-300'
                        : 'bg-yellow-900/60 text-yellow-300'
                    }`}
                  >
                    {v.violationType === 'Wajah Ganda' ? 'Ganda' : 'Tidak Dikenali'}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                    {formatTimestamp(v.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const PhotoModal: React.FC<{
  photo: SelectedPhoto;
  onClose: () => void;
}> = ({ photo, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black/90 flex justify-center items-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-white">{photo.studentName}</h3>
            <div className="flex items-center gap-3 mt-1">
              {photo.violationType && (
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    photo.violationType === 'Wajah Ganda'
                      ? 'bg-red-900/60 text-red-300'
                      : 'bg-yellow-900/60 text-yellow-300'
                  }`}
                >
                  {photo.violationType}
                </span>
              )}
              <span className="text-xs text-gray-400">{photo.timestamp}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {photo.evidenceUrl && photo.baselineUrl ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-center text-gray-400 mb-2 text-sm font-semibold">Foto Awal (Baseline)</p>
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                  <img src={photo.baselineUrl} alt="Baseline" className="w-full h-auto" />
                </div>
              </div>
              <div>
                <p className="text-center text-gray-400 mb-2 text-sm font-semibold">Foto Bukti Kejadian</p>
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                  <img src={photo.evidenceUrl} alt="Evidence" className="w-full h-auto" />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg overflow-hidden">
              <img
                src={photo.evidenceUrl || photo.baselineUrl}
                alt="Photo"
                className="w-full h-auto max-h-[70vh] object-contain mx-auto"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceVerificationDashboard;
