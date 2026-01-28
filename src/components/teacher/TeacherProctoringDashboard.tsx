import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, limit, startAfter, orderBy, DocumentSnapshot } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';

interface ViolationInfo {
  timestamp: string;
  violationType: string;
}

interface Session {
  id: string;
  studentInfo: {
    name: string;
    nim: string;
    major?: string;
    className?: string;
  };
  status: string;
  violations: number;
  violationSnapshot_1?: ViolationInfo;
  violationSnapshot_2?: ViolationInfo;
  violationSnapshot_3?: ViolationInfo;
  [key: string]: unknown;
}

interface TeacherProctoringDashboardProps {
  navigateBack: () => void;
  appState: any;
}

const TeacherProctoringDashboard: React.FC<TeacherProctoringDashboardProps> = ({ navigateBack, appState }) => {
  const { exam } = appState;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const SESSIONS_PER_PAGE = 30;

  const handleBackNavigation = () => {
    navigateBack();
  };

  useEffect(() => {
    if (!exam?.id) return;
    
    // Load first page of sessions
    loadSessions(true);
    
    // Set up auto-refresh every 30 seconds for real-time monitoring
    const refreshInterval = setInterval(() => {
      if (!isLoadingMore) {
        loadSessions(true);
      }
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, [exam?.id]);

  const loadSessions = async (isFirstLoad = false) => {
    if (!exam?.id) return;
    
    if (!isFirstLoad && !hasMoreData) return;
    
    setIsLoadingMore(true);
    
    try {
      const sessionsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`);
      let sessionsQuery = query(
        sessionsRef, 
        orderBy('startTime', 'desc'),
        limit(SESSIONS_PER_PAGE)
      );
      
      if (!isFirstLoad && lastDoc) {
        sessionsQuery = query(
          sessionsRef,
          orderBy('startTime', 'desc'),
          startAfter(lastDoc),
          limit(SESSIONS_PER_PAGE)
        );
      }
      
      const snapshot = await getDocs(sessionsQuery);
      const newSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      
      if (isFirstLoad) {
        setSessions(newSessions);
        setCurrentPage(1);
      } else {
        setSessions(prev => [...prev, ...newSessions]);
        setCurrentPage(prev => prev + 1);
      }
      
      // Update pagination state
      setHasMoreData(snapshot.docs.length === SESSIONS_PER_PAGE);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Filter sessions based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSessions(sessions);
    } else {
      const filtered = sessions.filter(session => {
        const name = session.studentInfo.name.toLowerCase();
        const nim = session.studentInfo.nim.toLowerCase();
        const major = (session.studentInfo.major || '').toLowerCase();
        const className = (session.studentInfo.className || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        
        return name.includes(search) || 
               nim.includes(search) || 
               major.includes(search) || 
               className.includes(search);
      });
      setFilteredSessions(filtered);
    }
  }, [sessions, searchTerm]);

  const getViolationsList = (session: Session): ViolationInfo[] => {
    const violationCount = Math.min(session.violations || 0, 3);
    const violations: ViolationInfo[] = [];

    for (let i = 1; i <= violationCount; i++) {
      const snapshotKey = `violationSnapshot_${i}` as keyof Session;
      const snapshot = session[snapshotKey] as ViolationInfo | undefined;

      if (snapshot && snapshot.violationType) {
        violations.push(snapshot);
      } else {
        violations.push({
          timestamp: new Date().toISOString(),
          violationType: `Pelanggaran ${i}`
        });
      }
    }

    return violations;
  };

  const formatViolationType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'tab_switch': 'Pindah Tab',
      'focus_lost': 'Keluar dari Window',
      'fullscreen_exit': 'Keluar Fullscreen',
      'keyboard_shortcut': 'Shortcut Keyboard Terlarang',
      'copy_paste': 'Copy/Paste Terdeteksi',
      'devtools': 'Developer Tools Dibuka',
      'extension_detected': 'Ekstensi Terlarang Terdeteksi',
      'screenshot_attempt': 'Percobaan Screenshot',
      'right_click': 'Klik Kanan Terdeteksi'
    };
    return typeMap[type] || type;
  };

  if (!exam) {
    return <div className="text-center p-8">Memuat data ujian...</div>;
  }

  return (
    <div>
      <button 
        onClick={handleBackNavigation} 
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>
      
      <h2 className="text-3xl font-bold">Awasi Ujian</h2>
      <p className="text-lg text-blue-400 mb-6">{exam.name} ({exam.code}) - Monitoring pelanggaran siswa</p>
      
      {/* Search Bar */}
      <div className="mb-6 bg-gray-800 p-4 rounded-lg shadow-lg">
        <div className="flex items-center space-x-4">
          <div className="flex-grow">
            <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-2">
              Cari Siswa (Nama, NIM, Kelas, atau Jurusan)
            </label>
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ketik nama, NIM, kelas, atau jurusan siswa..."
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-6 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => loadSessions(true)}
            disabled={isLoadingMore}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-blue-400"
          >
            Refresh
          </button>
        </div>
        {searchTerm && (
          <div className="mt-3 text-sm text-gray-400">
            Menampilkan {filteredSessions.length} dari {sessions.length} siswa
            {filteredSessions.length > 0 && (
              <span className="ml-2 text-blue-400">
                untuk "{searchTerm}"
              </span>
            )}
          </div>
        )}
        {hasMoreData && (
          <div className="mt-3 text-sm text-yellow-400">
            Menampilkan {sessions.length} siswa (Halaman {currentPage}) - Ada data lainnya
          </div>
        )}
      </div>
      
      {sessions.length === 0 ? (
        <p className="text-gray-400 text-center mt-8 bg-gray-800 p-6 rounded-lg">
          Belum ada siswa yang bergabung dalam ujian ini.
        </p>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center mt-8 bg-gray-800 p-6 rounded-lg">
          <p className="text-yellow-400 text-lg mb-2">Tidak ada hasil</p>
          <p className="text-gray-400">
            Tidak ditemukan siswa dengan nama, NIM, kelas, atau jurusan "{searchTerm}"
          </p>
          <button
            onClick={() => setSearchTerm('')}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            Tampilkan Semua Siswa
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map(session => {
              const violationsList = getViolationsList(session);
              const violationCount = Math.min(session.violations || 0, 3);
              return (
                <div
                  key={session.id}
                  className={`bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 ${
                    session.status === 'disqualified'
                      ? 'border-red-600'
                      : violationCount > 0
                      ? 'border-yellow-500'
                      : 'border-gray-700'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-lg">{session.studentInfo.name}</h4>
                        <p className="text-sm text-gray-400">{session.studentInfo.nim}</p>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full ${
                          session.status === 'started'
                            ? 'bg-blue-600'
                            : session.status === 'finished'
                            ? 'bg-green-600'
                            : 'bg-red-600'
                        }`}
                      >
                        {session.status === 'started' ? 'Sedang Ujian' : session.status === 'finished' ? 'Selesai' : 'Diskualifikasi'}
                      </span>
                    </div>

                    <div className="space-y-1 mb-3">
                      <p className="text-xs text-gray-500">
                        Jurusan: {session.studentInfo.major || 'Tidak tersedia'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Kelas: {session.studentInfo.className || 'Tidak tersedia'}
                      </p>
                    </div>

                    <div className={`p-3 rounded-lg mb-3 ${
                      violationCount > 0 ? 'bg-yellow-900/30' : 'bg-green-900/30'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">Jumlah Pelanggaran</span>
                        <span className={`text-xl font-bold ${
                          violationCount >= 3 ? 'text-red-400' :
                          violationCount > 0 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {violationCount}/3
                        </span>
                      </div>

                      {violationCount === 0 ? (
                        <p className="text-sm text-green-400">Tidak ada pelanggaran terdeteksi</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-400 font-medium">Daftar Pelanggaran:</p>
                          {violationsList.map((violation, index) => (
                            <div key={index} className="bg-gray-800 p-2 rounded text-xs">
                              <div className="flex justify-between items-center">
                                <span className="text-yellow-400 font-medium">
                                  #{index + 1} {formatViolationType(violation.violationType)}
                                </span>
                              </div>
                              <p className="text-gray-500 mt-1">
                                {new Date(violation.timestamp).toLocaleString('id-ID')}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-sm text-blue-400">
                      Rekaman Suara: {Object.keys(session).filter((key: string) => key.startsWith('voiceRecording_')).length}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Pagination Controls */}
          {hasMoreData && (
            <div className="mt-8 bg-gray-800 p-6 rounded-lg text-center">
              <div className="mb-4 text-sm text-gray-400">
                Menampilkan {sessions.length} siswa dari total yang ada (Halaman {currentPage})
              </div>
              <button
                onClick={() => loadSessions(false)}
                disabled={isLoadingMore}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg disabled:bg-blue-400 flex items-center mx-auto"
              >
                {isLoadingMore ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Memuat Data...
                  </>
                ) : (
                  <>
                    Muat Lebih Banyak Siswa ({SESSIONS_PER_PAGE} siswa)
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TeacherProctoringDashboard;