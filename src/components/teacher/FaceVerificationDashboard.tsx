import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
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

const FaceVerificationDashboard: React.FC<FaceVerificationDashboardProps> = ({
  navigateBack,
  appState,
}) => {
  const { exam } = appState;
  const [logs, setLogs] = useState<FaceLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<FaceLog[]>([]);
  const [baselinePhotos, setBaselinePhotos] = useState<BaselinePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ baseline: string; evidence: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'violations' | 'baselines'>('violations');

  useEffect(() => {
    loadLogs();
    loadBaselinePhotos();
  }, [exam?.id]);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, activeTab, baselinePhotos]);

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
        logsData.push({
          id: doc.id,
          ...doc.data(),
        } as FaceLog);
      });

      setLogs(logsData);
    } catch (error) {
      console.error('Error loading face verification logs:', error);
      const logsRef = collection(db, `artifacts/${appId}/public/data/face_verification_logs`);
      const q = query(logsRef, where('examId', '==', exam.id));

      try {
        const snapshot = await getDocs(q);
        const logsData: FaceLog[] = [];
        snapshot.forEach((doc) => {
          logsData.push({
            id: doc.id,
            ...doc.data(),
          } as FaceLog);
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

      const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
      const usersSnapshot = await getDocs(usersRef);

      usersSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.faceBaselineUrl) {
          const existingIndex = photos.findIndex(p => p.studentId === data.id);
          if (existingIndex === -1) {
            photos.push({
              id: docSnap.id,
              studentId: data.id || '',
              fullName: data.fullName || data.name || '',
              kelas: data.kelas || data.className || '',
              jurusan: data.jurusan || data.major || '',
              faceBaselineUrl: data.faceBaselineUrl,
              faceVerifiedAt: data.faceVerifiedAt || '',
            });
          }
        }
      });

      setBaselinePhotos(photos);
    } catch (error) {
      console.error('Error loading baseline photos:', error);
    }
  };

  const filterLogs = () => {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
      setFilteredLogs(logs);
      return;
    }

    const filtered = logs.filter((log) => {
      return (
        log.fullName?.toLowerCase().includes(term) ||
        log.kelas?.toLowerCase().includes(term) ||
        log.jurusan?.toLowerCase().includes(term)
      );
    });

    setFilteredLogs(filtered);
  };

  const getFilteredBaselines = () => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return baselinePhotos;

    return baselinePhotos.filter((photo) => {
      return (
        photo.fullName?.toLowerCase().includes(term) ||
        photo.kelas?.toLowerCase().includes(term) ||
        photo.jurusan?.toLowerCase().includes(term)
      );
    });
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

  const getViolationBadge = (type: string) => {
    if (type === 'Wajah Ganda') {
      return (
        <span className="px-2 py-1 text-xs font-bold rounded bg-red-600 text-white">
          Wajah Ganda
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-bold rounded bg-yellow-600 text-white">
        Wajah Tidak Dikenali
      </span>
    );
  };

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
          Pelanggaran Wajah ({logs.length})
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
              onClick={() => { loadLogs(); loadBaselinePhotos(); }}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'violations' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-gray-400">
              Menampilkan <span className="font-bold text-white">{filteredLogs.length}</span> dari{' '}
              <span className="font-bold text-white">{logs.length}</span> pelanggaran
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <div className="text-gray-400 mb-2">
                <svg
                  className="w-16 h-16 mx-auto mb-4 opacity-50"
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
              </div>
              <p className="text-lg text-gray-300">Tidak ada pelanggaran wajah terdeteksi</p>
              <p className="text-sm text-gray-500 mt-2">
                {searchTerm
                  ? 'Coba ubah kata kunci pencarian'
                  : 'Semua siswa mengikuti ujian dengan baik'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  {getViolationBadge(log.violationType)}
                  <span className="text-xs text-gray-500">{formatTimestamp(log.timestamp)}</span>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">{log.fullName || 'Nama tidak tersedia'}</h3>
                <p className="text-sm text-gray-400 mb-3">
                  {log.kelas && <span className="mr-2">Kelas: {log.kelas}</span>}
                  {log.jurusan && <span>| Jurusan: {log.jurusan}</span>}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1 text-center">Foto Awal</p>
                    <div className="aspect-square bg-gray-900 rounded overflow-hidden">
                      {log.baselinePhotoUrl ? (
                        <img
                          src={log.baselinePhotoUrl}
                          alt="Baseline"
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() =>
                            setSelectedImage({
                              baseline: log.baselinePhotoUrl,
                              evidence: log.evidencePhotoUrl,
                              name: log.fullName,
                            })
                          }
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1 text-center">Foto Bukti</p>
                    <div className="aspect-square bg-gray-900 rounded overflow-hidden">
                      {log.evidencePhotoUrl ? (
                        <img
                          src={log.evidencePhotoUrl}
                          alt="Evidence"
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() =>
                            setSelectedImage({
                              baseline: log.baselinePhotoUrl,
                              evidence: log.evidencePhotoUrl,
                              name: log.fullName,
                            })
                          }
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'baselines' && (
        <>
          <div className="mb-4 flex items-center justify-between">
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
              <div className="text-gray-400 mb-2">
                <svg
                  className="w-16 h-16 mx-auto mb-4 opacity-50"
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
              </div>
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
                  <div className="aspect-square bg-gray-900 overflow-hidden">
                    <img
                      src={photo.faceBaselineUrl}
                      alt={photo.fullName}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() =>
                        setSelectedImage({
                          baseline: photo.faceBaselineUrl,
                          evidence: '',
                          name: photo.fullName,
                        })
                      }
                    />
                  </div>
                  <div className="p-3">
                    <h4 className="font-bold text-white text-sm truncate">{photo.fullName || 'Nama tidak tersedia'}</h4>
                    <p className="text-xs text-gray-400 truncate">
                      {photo.kelas && <span>{photo.kelas}</span>}
                      {photo.kelas && photo.jurusan && <span> - </span>}
                      {photo.jurusan && <span>{photo.jurusan}</span>}
                    </p>
                    {photo.faceVerifiedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(photo.faceVerifiedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex justify-center items-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold">Perbandingan Foto - {selectedImage.name}</h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                x
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-center text-gray-400 mb-2 font-semibold">Foto Awal (Baseline)</p>
                  <div className="bg-gray-900 rounded-lg overflow-hidden">
                    {selectedImage.baseline ? (
                      <img
                        src={selectedImage.baseline}
                        alt="Baseline"
                        className="w-full h-auto"
                      />
                    ) : (
                      <div className="aspect-video flex items-center justify-center text-gray-600">
                        Foto tidak tersedia
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-center text-gray-400 mb-2 font-semibold">Foto Bukti Kejadian</p>
                  <div className="bg-gray-900 rounded-lg overflow-hidden">
                    {selectedImage.evidence ? (
                      <img
                        src={selectedImage.evidence}
                        alt="Evidence"
                        className="w-full h-auto"
                      />
                    ) : (
                      <div className="aspect-video flex items-center justify-center text-gray-600">
                        Foto tidak tersedia
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceVerificationDashboard;
