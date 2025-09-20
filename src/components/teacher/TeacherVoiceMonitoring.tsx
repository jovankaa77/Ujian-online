import React, { useState, useEffect } from 'react';
import { collection, getDocs, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import Modal from '../ui/Modal';

interface VoiceRecording {
  audioData: string;
  timestamp: string;
  duration: number;
  studentId: string;
  studentName: string;
}

interface Session {
  id: string;
  studentInfo: {
    name: string;
    nim: string;
    major: string;
    className: string;
  };
  status: string;
  [key: string]: any; // For dynamic voice recording fields
}

interface TeacherVoiceMonitoringProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  appState: any;
}

const TeacherVoiceMonitoring: React.FC<TeacherVoiceMonitoringProps> = ({ navigateTo, navigateBack, appState }) => {
  const { exam } = appState;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [voiceRecordings, setVoiceRecordings] = useState<Array<{
    id: string;
    recording: VoiceRecording;
    studentInfo: any;
    recordingKey: string;
  }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterJurusan, setFilterJurusan] = useState('');
  const [availableKelas, setAvailableKelas] = useState<string[]>([]);
  const [availableJurusan, setAvailableJurusan] = useState<string[]>([]);
  const [filteredRecordings, setFilteredRecordings] = useState<Array<{
    id: string;
    recording: VoiceRecording;
    studentInfo: any;
    recordingKey: string;
  }>>([]);
  const [selectedRecording, setSelectedRecording] = useState<{
    recording: VoiceRecording;
    studentInfo: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!exam?.id) return;
    
    const fetchSessions = async () => {
      try {
        const sessionsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`);
        
        // Set up real-time listener
        const unsubscribe = onSnapshot(
          query(sessionsRef, orderBy('startTime', 'desc'), limit(100)),
          (snapshot) => {
            const sessionsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Session));
            
            setSessions(sessionsData);
            
            // Extract voice recordings from all sessions
            const allRecordings: Array<{
              id: string;
              recording: VoiceRecording;
              studentInfo: any;
              recordingKey: string;
            }> = [];
            
            sessionsData.forEach(session => {
              Object.keys(session).forEach(key => {
                if (key.startsWith('voiceRecording_')) {
                  const recordingData = session[key];
                  if (recordingData && recordingData.audioData) {
                    allRecordings.push({
                      id: session.id,
                      recording: recordingData,
                      studentInfo: session.studentInfo,
                      recordingKey: key
                    });
                  }
                }
              });
            });
            
            // Sort recordings by timestamp (newest first)
            allRecordings.sort((a, b) => 
              new Date(b.recording.timestamp).getTime() - new Date(a.recording.timestamp).getTime()
            );
            
            setVoiceRecordings(allRecordings);
            
            // Update filter options
            const kelasSet = new Set<string>();
            const jurusanSet = new Set<string>();
            
            sessionsData.forEach(session => {
              if (session.studentInfo.className) kelasSet.add(session.studentInfo.className);
              if (session.studentInfo.major) jurusanSet.add(session.studentInfo.major);
            });
            
            setAvailableKelas(Array.from(kelasSet).sort());
            setAvailableJurusan(Array.from(jurusanSet).sort());
            
            setIsLoading(false);
          }
        );
        
        return () => unsubscribe();
        
      } catch (error) {
        console.error('Error fetching voice recordings:', error);
        setIsLoading(false);
      }
    };
    
    fetchSessions();
  }, [exam?.id]);

  // Filter recordings based on search term and filters
  useEffect(() => {
    let filtered = voiceRecordings;
    
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const name = (item.studentInfo.name || '').toLowerCase();
        const nim = (item.studentInfo.nim || '').toLowerCase();
        const major = (item.studentInfo.major || '').toLowerCase();
        const className = (item.studentInfo.className || '').toLowerCase();
        
        return name.includes(search) || 
               nim.includes(search) || 
               major.includes(search) || 
               className.includes(search);
      });
    }
    
    // Apply kelas filter
    if (filterKelas) {
      filtered = filtered.filter(item => item.studentInfo.className === filterKelas);
    }
    
    // Apply jurusan filter
    if (filterJurusan) {
      filtered = filtered.filter(item => item.studentInfo.major === filterJurusan);
    }
    
    setFilteredRecordings(filtered);
  }, [voiceRecordings, searchTerm, filterKelas, filterJurusan]);

  const playAudio = (recording: VoiceRecording, studentInfo: any) => {
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    try {
      const audio = new Audio(recording.audioData);
      audio.volume = 0.8;
      
      audio.onplay = () => {
        console.log("🔊 Playing audio recording");
      };
      
      audio.onended = () => {
        console.log("✅ Audio playback finished");
        setCurrentAudio(null);
      };
      
      audio.onerror = (error) => {
        console.error("❌ Audio playback error:", error);
        alert("Gagal memutar rekaman audio. Format audio mungkin tidak didukung.");
        setCurrentAudio(null);
      };
      
      setCurrentAudio(audio);
      audio.play();
      
    } catch (error) {
      console.error("❌ Failed to create audio element:", error);
      alert("Gagal memutar rekaman audio.");
    }
  };

  const openRecordingModal = (recording: VoiceRecording, studentInfo: any) => {
    setSelectedRecording({ recording, studentInfo });
  };

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-lg text-gray-300">Memuat data rekaman suara...</p>
      </div>
    );
  }

  if (!exam) {
    return <div className="text-center p-8">Memuat data ujian...</div>;
  }

  return (
    <div>
      <Modal 
        isOpen={!!selectedRecording} 
        title={`Rekaman Suara - ${selectedRecording?.studentInfo?.name || 'Siswa'}`}
        onCancel={() => {
          setSelectedRecording(null);
          if (currentAudio) {
            currentAudio.pause();
            setCurrentAudio(null);
          }
        }}
        cancelText="Tutup"
      >
        {selectedRecording && (
          <div className="text-center space-y-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <h4 className="font-bold text-lg text-white mb-2">{selectedRecording.studentInfo.name}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                <div><span className="font-bold">NIM:</span> {selectedRecording.studentInfo.nim}</div>
                <div><span className="font-bold">Kelas:</span> {selectedRecording.studentInfo.className}</div>
                <div><span className="font-bold">Jurusan:</span> {selectedRecording.studentInfo.major}</div>
                <div><span className="font-bold">Durasi:</span> {selectedRecording.recording.duration}s</div>
              </div>
            </div>
            
            <div className="bg-blue-900 border border-blue-500 p-4 rounded-lg">
              <div className="text-blue-300 font-bold mb-2">📅 Informasi Rekaman</div>
              <div className="text-blue-200 text-sm space-y-1">
                <div><span className="font-bold">Waktu:</span> {new Date(selectedRecording.recording.timestamp).toLocaleString('id-ID')}</div>
                <div><span className="font-bold">Durasi:</span> {selectedRecording.recording.duration} detik</div>
                <div><span className="font-bold">Status:</span> Terdeteksi aktivitas suara manusia</div>
              </div>
            </div>
            
            <button
              onClick={() => playAudio(selectedRecording.recording, selectedRecording.studentInfo)}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center"
            >
              🔊 Putar Rekaman ({selectedRecording.recording.duration}s)
            </button>
            
            {currentAudio && (
              <div className="bg-yellow-900 border border-yellow-500 p-3 rounded-lg">
                <p className="text-yellow-200 text-sm animate-pulse">
                  🔊 Sedang memutar rekaman audio...
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
      
      <button 
        onClick={navigateBack} 
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>
      
      <h2 className="text-3xl font-bold">Human Voice Detection</h2>
      <p className="text-lg text-indigo-400 mb-6">{exam.name} ({exam.code}) - Rekaman suara otomatis saat aktivitas bicara terdeteksi</p>
      
      {/* Search and Filter Section */}
      <div className="mb-6 bg-gray-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-bold mb-4">🔍 Filter & Pencarian</h3>
        
        {/* Search Bar */}
        <div className="mb-4">
          <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-2">
            Cari Siswa (Nama, NIM, Kelas, atau Jurusan)
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
        
        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="filterKelas" className="block text-sm font-medium text-gray-300 mb-2">
              Filter Kelas
            </label>
            <select
              id="filterKelas"
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Semua Kelas</option>
              {availableKelas.map(kelas => (
                <option key={kelas} value={kelas}>{kelas}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="filterJurusan" className="block text-sm font-medium text-gray-300 mb-2">
              Filter Jurusan
            </label>
            <select
              id="filterJurusan"
              value={filterJurusan}
              onChange={(e) => setFilterJurusan(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Semua Jurusan</option>
              {availableJurusan.map(jurusan => (
                <option key={jurusan} value={jurusan}>{jurusan}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterKelas('');
                setFilterJurusan('');
              }}
              className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg"
            >
              Reset Filter
            </button>
          </div>
        </div>
        
        {/* Filter Summary */}
        <div className="mt-4 flex justify-between items-center text-sm text-gray-400">
          <div>
            Menampilkan {filteredRecordings.length} dari {voiceRecordings.length} rekaman suara
            {(searchTerm || filterKelas || filterJurusan) && (
              <span className="ml-2 text-blue-400">
                (dengan filter)
              </span>
            )}
          </div>
          {(searchTerm || filterKelas || filterJurusan) && (
            <div className="text-xs">
              {searchTerm && <span className="bg-blue-600 px-2 py-1 rounded mr-1">Cari: "{searchTerm}"</span>}
              {filterKelas && <span className="bg-green-600 px-2 py-1 rounded mr-1">Kelas: {filterKelas}</span>}
              {filterJurusan && <span className="bg-purple-600 px-2 py-1 rounded mr-1">Jurusan: {filterJurusan}</span>}
            </div>
          )}
        </div>
      </div>
      
      {/* Statistics */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-600 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold">{sessions.length}</div>
          <div className="text-sm">Total Siswa</div>
        </div>
        <div className="bg-purple-600 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold">{voiceRecordings.length}</div>
          <div className="text-sm">Total Rekaman</div>
        </div>
        <div className="bg-green-600 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold">
            {sessions.filter(s => s.status === 'finished').length}
          </div>
          <div className="text-sm">Selesai Ujian</div>
        </div>
        <div className="bg-yellow-600 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold">
            {new Set(voiceRecordings.map(r => r.studentInfo.name)).size}
          </div>
          <div className="text-sm">Siswa Berbicara</div>
        </div>
      </div>
      
      {voiceRecordings.length === 0 ? (
        <div className="text-center mt-8 bg-gray-800 p-8 rounded-lg">
          <div className="text-6xl mb-4">🎤</div>
          <h3 className="text-xl font-bold text-gray-400 mb-2">Belum Ada Rekaman Suara</h3>
          <p className="text-gray-500">
            Rekaman suara akan muncul secara real-time ketika sistem mendeteksi aktivitas bicara dari siswa selama ujian.
          </p>
        </div>
      ) : filteredRecordings.length === 0 ? (
        <div className="text-center mt-8 bg-gray-800 p-6 rounded-lg">
          <p className="text-yellow-400 text-lg mb-2">🔍 Tidak ada hasil</p>
          <p className="text-gray-400">
            Tidak ditemukan rekaman suara dengan filter yang diterapkan
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterKelas('');
              setFilterJurusan('');
            }}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            Tampilkan Semua Rekaman
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Group recordings by student */}
          {(() => {
            // Group recordings by student
            const studentGroups = new Map();
            
            filteredRecordings.forEach(item => {
              const studentKey = `${item.studentInfo.name}_${item.studentInfo.nim}`;
              if (!studentGroups.has(studentKey)) {
                studentGroups.set(studentKey, {
                  studentInfo: item.studentInfo,
                  recordings: []
                });
              }
              studentGroups.get(studentKey).recordings.push(item);
            });
            
            // Convert to array and sort by latest recording
            const sortedGroups = Array.from(studentGroups.values()).sort((a, b) => {
              const latestA = Math.max(...a.recordings.map(r => new Date(r.recording.timestamp).getTime()));
              const latestB = Math.max(...b.recordings.map(r => new Date(r.recording.timestamp).getTime()));
              return latestB - latestA;
            });
            
            return sortedGroups.map((group, groupIndex) => (
              <div 
                key={`${group.studentInfo.name}_${group.studentInfo.nim}`}
                className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors"
              >
                {/* Student Info Header */}
                <div className="p-4 bg-gray-700 border-b border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold text-white">
                          {group.studentInfo.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-white">{group.studentInfo.name}</h4>
                        <p className="text-sm text-gray-300">NIM: {group.studentInfo.nim}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="px-3 py-1 bg-purple-600 text-white text-sm font-bold rounded-full">
                        🎤 {group.recordings.length} Rekaman
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div><span className="font-bold">Kelas:</span> {group.studentInfo.className || 'N/A'}</div>
                    <div><span className="font-bold">Jurusan:</span> {group.studentInfo.major || 'N/A'}</div>
                  </div>
                </div>
                
                {/* Voice Recordings List */}
                <div className="p-4">
                  <h5 className="text-sm font-bold text-gray-300 mb-3 flex items-center">
                    🎵 Daftar Rekaman Suara:
                    <span className="ml-2 px-2 py-1 bg-purple-600 text-white text-xs rounded-full">
                      {group.recordings.length}
                    </span>
                  </h5>
                  
                  {group.recordings.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <div className="text-3xl mb-2">🎤</div>
                      <p className="text-sm">Belum ada rekaman suara</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {group.recordings
                        .sort((a, b) => new Date(b.recording.timestamp).getTime() - new Date(a.recording.timestamp).getTime())
                        .map((item, index) => (
                        <div 
                          key={`${item.id}-${item.recordingKey}`}
                          className="bg-gray-700 p-3 rounded-lg border border-gray-600 hover:border-purple-400 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-grow">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full font-bold">
                                  #{group.recordings.length - index}
                                </span>
                                <span className="text-xs text-gray-400 font-mono">
                                  {new Date(item.recording.timestamp).toLocaleTimeString('id-ID')}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400">
                                📅 {new Date(item.recording.timestamp).toLocaleDateString('id-ID')}
                              </div>
                              <div className="text-xs text-purple-400 mt-1">
                                ⏱️ Durasi: {item.recording.duration} detik
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex space-x-2">
                            <button
                              onClick={() => playAudio(item.recording, item.studentInfo)}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 px-3 rounded flex items-center justify-center"
                            >
                              🔊 Putar ({item.recording.duration}s)
                            </button>
                            <button
                              onClick={() => openRecordingModal(item.recording, item.studentInfo)}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded flex items-center justify-center"
                            >
                              📋 Detail
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Summary Footer */}
                <div className="p-3 bg-gray-700 border-t border-gray-600">
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>
                      📊 Total: {group.recordings.length} rekaman
                    </span>
                    <span>
                      ⏱️ Total durasi: {group.recordings.reduce((sum, r) => sum + r.recording.duration, 0)}s
                    </span>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
};

export default TeacherVoiceMonitoring;