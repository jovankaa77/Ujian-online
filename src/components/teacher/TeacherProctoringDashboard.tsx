import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, limit, startAfter, orderBy, DocumentSnapshot } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import Modal from '../ui/Modal';

interface Session {
  id: string;
  studentInfo: {
    name: string;
    nim: string;
  };
  status: string;
  violations: number;
  violationSnapshot_1?: {
    imageData: string;
    timestamp: string;
    violationType: string;
  };
  violationSnapshot_2?: {
    imageData: string;
    timestamp: string;
    violationType: string;
  };
  violationSnapshot_3?: {
    imageData: string;
    timestamp: string;
    violationType: string;
  };
}

interface TeacherProctoringDashboardProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  appState: any;
}

const TeacherProctoringDashboard: React.FC<TeacherProctoringDashboardProps> = ({ navigateTo, navigateBack, appState }) => {
  const { exam, parentExam } = appState;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<{
    imageData: string;
    timestamp: string;
    violationType: string;
    studentName: string;
    violationNumber: number;
  } | null>(null);
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

  const viewSnapshot = (snapshot: any, studentName: string, violationNumber: number) => {
    setSelectedSnapshot({
      ...snapshot,
      studentName,
      violationNumber
    });
  };

  if (!exam) {
    return <div className="text-center p-8">Memuat data ujian...</div>;
  }

  return (
    <div>
      <Modal 
        isOpen={!!selectedSnapshot} 
        title={`Foto Pelanggaran ${selectedSnapshot?.violationNumber} - ${selectedSnapshot?.studentName}`}
        onCancel={() => setSelectedSnapshot(null)}
        cancelText="Tutup"
      >
        {selectedSnapshot && (
          <div className="text-center">
            <img src={selectedSnapshot.imageData} alt="Violation Snapshot" className="w-full max-w-md mx-auto rounded-lg mb-4" />
            <div className="bg-gray-700 p-3 rounded-md text-left">
              <p className="text-sm text-gray-300 mb-1">
                <span className="font-bold text-red-400">Jenis Pelanggaran:</span> {selectedSnapshot.violationType}
              </p>
              <p className="text-sm text-gray-300 mb-1">
                <span className="font-bold text-blue-400">Waktu:</span> {new Date(selectedSnapshot.timestamp).toLocaleString('id-ID')}
              </p>
              <p className="text-sm text-gray-300">
                <span className="font-bold text-yellow-400">Pelanggaran ke:</span> {selectedSnapshot.violationNumber}
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
      
      <h2 className="text-3xl font-bold">Snapshot Pelanggaran</h2>
      <p className="text-lg text-indigo-400 mb-6">{exam.name} ({exam.code}) - Foto diambil saat pelanggaran terdeteksi</p>
      
      {/* Search Bar */}
      <div className="mb-6 bg-gray-800 p-4 rounded-lg shadow-lg">
        <div className="flex items-center space-x-4">
          <div className="flex-grow">
            <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-2">
              🔍 Cari Siswa (Nama, NIM, Kelas, atau Jurusan)
            </label>
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ketik nama, NIM, kelas, atau jurusan siswa..."
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
            {isLoadingMore ? '🔄' : '🔄'} Refresh
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
            📄 Menampilkan {sessions.length} siswa (Halaman {currentPage}) - Ada data lainnya
          </div>
        )}
      </div>
      
      {sessions.length === 0 ? (
        <p className="text-gray-400 text-center mt-8 bg-gray-800 p-6 rounded-lg">
          Belum ada siswa yang bergabung dalam ujian ini.
        </p>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center mt-8 bg-gray-800 p-6 rounded-lg">
          <p className="text-yellow-400 text-lg mb-2">🔍 Tidak ada hasil</p>
          <p className="text-gray-400">
            Tidak ditemukan siswa dengan nama, NIM, kelas, atau jurusan "{searchTerm}"
          </p>
          <button
            onClick={() => setSearchTerm('')}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            Tampilkan Semua Siswa
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map(session => (
              <div 
                key={session.id} 
                className={`bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 ${
                  session.violations > 0 
                    ? 'border-yellow-500' 
                    : 'border-gray-700'
                } ${
                  session.status === 'disqualified' 
                    ? 'border-red-600' 
                    : ''
                }`}
              >
                <div className="w-full aspect-video bg-gray-900 relative">
                  {session.violations > 0 ? (
                    <div className="w-full h-full relative">
                      {/* Show latest violation photo as background */}
                      {(session.violationSnapshot_3 || session.violationSnapshot_2 || session.violationSnapshot_1) && (
                        <img 
                          src={(session.violationSnapshot_3 || session.violationSnapshot_2 || session.violationSnapshot_1)?.imageData} 
                          alt="Latest Violation" 
                          className="w-full h-full object-cover"
                        />
                      )}
                      {/* Overlay with violation info */}
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="text-center p-4">
                          <div className="text-yellow-400 mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <p className="text-sm text-yellow-400 font-bold">⚠️ {session.violations} Pelanggaran!</p>
                          <p className="text-xs text-gray-300">Foto Pelanggaran Terdeteksi</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center p-4">
                        <div className="text-green-400 mb-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-sm text-green-400 font-bold">✅ Tidak Ada Pelanggaran</p>
                        <p className="text-xs text-gray-400">Siswa mengerjakan dengan baik</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h4 className="font-bold text-lg">{session.studentInfo.name}</h4>
                  <p className="text-sm text-gray-400">{session.studentInfo.nim}</p>
                  <div className="mt-1 space-y-1">
                    <p className="text-xs text-gray-500">
                      📚 {session.studentInfo.major || 'Jurusan tidak tersedia'}
                    </p>
                    <p className="text-xs text-gray-500">
                      🏫 {session.studentInfo.className || 'Kelas tidak tersedia'}
                    </p>
                  </div>
                  <div className="mt-3 flex justify-between items-center">
                    <span 
                      className={`px-3 py-1 text-xs font-bold rounded-full ${
                        session.status === 'started' 
                          ? 'bg-blue-600' 
                          : session.status === 'finished' 
                          ? 'bg-green-600' 
                          : 'bg-red-600'
                      }`}
                    >
                      {session.status}
                    </span>
                    <span 
                      className={`font-bold text-lg ${
                        session.violations > 0 ? 'text-yellow-400' : ''
                      }`}
                    >
                      Jumlah Pelanggaran: {session.violations}/3
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-sm text-purple-400">
                      🎤 Human Voice: {Object.keys(session).filter(key => key.startsWith('voiceRecording_')).length}
                    </span>
                  </div>
                  {session.violations > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-1">
                      {session.violationSnapshot_1 && (
                        <button 
                          onClick={() => viewSnapshot(session.violationSnapshot_1!, session.studentInfo.name, 1)}
                          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold py-2 px-2 rounded flex items-center justify-center"
                        >
                          📷 Foto Pelanggaran 1
                        </button>
                      )}
                      {session.violationSnapshot_2 && (
                        <button 
                          onClick={() => viewSnapshot(session.violationSnapshot_2!, session.studentInfo.name, 2)}
                          className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2 px-2 rounded flex items-center justify-center"
                        >
                          📷 Foto Pelanggaran 2
                        </button>
                      )}
                      {session.violationSnapshot_3 && (
                        <button 
                          onClick={() => viewSnapshot(session.violationSnapshot_3!, session.studentInfo.name, 3)}
                          className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-2 rounded flex items-center justify-center"
                        >
                          📷 Foto Pelanggaran 3
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg disabled:bg-indigo-400 flex items-center mx-auto"
              >
                {isLoadingMore ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Memuat Data...
                  </>
                ) : (
                  <>
                    📄 Muat Lebih Banyak Siswa ({SESSIONS_PER_PAGE} siswa)
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