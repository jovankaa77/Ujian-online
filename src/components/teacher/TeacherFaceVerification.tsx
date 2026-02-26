import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';

interface FaceLog {
  id: string;
  userId: string;
  fullName: string;
  kelas: string;
  jurusan: string;
  violationType: 'Wajah Ganda' | 'Wajah Tidak Dikenali';
  evidencePhotoUrl: string;
  baselinePhotoUrl: string;
  timestamp: any;
  examId: string;
}

interface TeacherFaceVerificationProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  appState: any;
}

const TeacherFaceVerification: React.FC<TeacherFaceVerificationProps> = ({ navigateBack, appState }) => {
  const [logs, setLogs] = useState<FaceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const logsRef = collection(db, `artifacts/${appId}/public/data/face_verification_logs`);
      const q = query(logsRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FaceLog[];

      const examId = appState?.exam?.id;
      const filtered = examId ? data.filter(log => log.examId === examId) : data;
      setLogs(filtered);
    } catch (error) {
      console.error('Failed to fetch face verification logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.fullName?.toLowerCase().includes(term) ||
      log.kelas?.toLowerCase().includes(term) ||
      log.jurusan?.toLowerCase().includes(term)
    );
  });

  const formatTimestamp = (ts: any): string => {
    if (!ts) return '-';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  return (
    <div>
      <button
        onClick={navigateBack}
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>

      <h2 className="text-2xl font-bold mb-6">Verifikasi Wajah</h2>

      <div className="mb-6 bg-gray-800 p-4 rounded-lg">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Cari berdasarkan Nama / Kelas / Jurusan..."
          className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500 text-white placeholder-gray-400"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center text-gray-400">
            <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full mr-3"></div>
            Memuat data verifikasi wajah...
          </div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <p className="text-gray-400 text-lg">
            {searchTerm ? 'Tidak ada hasil yang cocok.' : 'Belum ada insiden verifikasi wajah.'}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-400">
            Menampilkan {filteredLogs.length} insiden
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLogs.map(log => (
              <div key={log.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-500 transition-colors">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                      log.violationType === 'Wajah Ganda'
                        ? 'bg-red-900 text-red-300 border border-red-700'
                        : 'bg-yellow-900 text-yellow-300 border border-yellow-700'
                    }`}>
                      {log.violationType}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>

                  <h3 className="font-bold text-lg text-white mb-1">{log.fullName || 'Tanpa Nama'}</h3>
                  <div className="flex gap-3 text-sm text-gray-400 mb-4">
                    {log.kelas && <span>Kelas: {log.kelas}</span>}
                    {log.jurusan && <span>Jurusan: {log.jurusan}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1 font-medium">Foto Awal (Baseline)</p>
                      <div
                        className="aspect-[4/3] bg-gray-900 rounded-md overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border border-gray-700"
                        onClick={() => log.baselinePhotoUrl && setSelectedImage({ url: log.baselinePhotoUrl, title: 'Foto Awal (Baseline)' })}
                      >
                        {log.baselinePhotoUrl ? (
                          <img src={log.baselinePhotoUrl} alt="Baseline" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">Tidak tersedia</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1 font-medium">Foto Bukti Kejadian</p>
                      <div
                        className="aspect-[4/3] bg-gray-900 rounded-md overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border border-gray-700"
                        onClick={() => log.evidencePhotoUrl && setSelectedImage({ url: log.evidencePhotoUrl, title: 'Foto Bukti Kejadian' })}
                      >
                        {log.evidencePhotoUrl ? (
                          <img src={log.evidencePhotoUrl} alt="Evidence" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">Tidak tersedia</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-gray-700">
                <h3 className="font-bold text-white">{selectedImage.title}</h3>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="text-gray-400 hover:text-white text-2xl leading-none"
                >
                  &times;
                </button>
              </div>
              <div className="p-4">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.title}
                  className="w-full rounded-md"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherFaceVerification;
