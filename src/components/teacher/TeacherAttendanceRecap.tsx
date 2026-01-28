import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import Modal from '../ui/Modal';

interface AttendancePhoto {
  imageData: string;
  timestamp: string;
  label: string;
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
  [key: string]: any; // For dynamic attendance photo fields
}

interface TeacherAttendanceRecapProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  appState: any;
}

const TeacherAttendanceRecap: React.FC<TeacherAttendanceRecapProps> = ({ navigateTo, navigateBack, appState }) => {
  const { exam } = appState;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<{
    imageData: string;
    label: string;
    timestamp: string;
    studentName: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!exam?.id) return;
    
    const fetchSessions = async () => {
      try {
        const sessionsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`);
        const sessionsSnapshot = await getDocs(sessionsRef);
        
        const sessionsData = sessionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Session));
        
        setSessions(sessionsData);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching sessions:', error);
        setIsLoading(false);
      }
    };
    
    fetchSessions();
  }, [exam?.id]);

  // Filter sessions based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSessions(sessions);
    } else {
      const filtered = sessions.filter(session => {
        const name = (session.studentInfo.name || '').toLowerCase();
        const nim = (session.studentInfo.nim || '').toLowerCase();
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

  // Extract attendance photos from session data
  const getAttendancePhotos = (session: Session): AttendancePhoto[] => {
    const photos: AttendancePhoto[] = [];

    // Define the expected photo schedule - updated to match new intervals
    const expectedPhotoTimes = [1, 5, 15, 30, 60, 120];
    const expectedLabels = [...expectedPhotoTimes.map(time => `Menit ke-${time}`), 'Selesai'];

    Object.keys(session).forEach(key => {
      if (key.startsWith('attendancePhoto_')) {
        const photoData = session[key];
        if (photoData && photoData.imageData) {
          photos.push({
            imageData: photoData.imageData,
            timestamp: photoData.timestamp,
            label: photoData.label
          });
        }
      }
    });

    // Sort photos by expected order
    const sortOrder = expectedLabels;

    photos.sort((a, b) => {
      const indexA = sortOrder.indexOf(a.label);
      const indexB = sortOrder.indexOf(b.label);
      // If label not found in sortOrder, put it at the end
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return photos;
  };

  const viewPhoto = (photo: AttendancePhoto, studentName: string) => {
    setSelectedPhoto({
      ...photo,
      studentName
    });
  };

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-lg text-gray-300">Memuat data rekap absen...</p>
      </div>
    );
  }

  if (!exam) {
    return <div className="text-center p-8">Memuat data ujian...</div>;
  }

  return (
    <div>
      <Modal 
        isOpen={!!selectedPhoto} 
        title={`Foto Absen - ${selectedPhoto?.studentName || 'Siswa'}`}
        onCancel={() => setSelectedPhoto(null)}
        cancelText="Tutup"
      >
        {selectedPhoto && (
          <div className="text-center">
            <img 
              src={selectedPhoto.imageData} 
              alt="Attendance Photo" 
              className="w-full max-w-md mx-auto rounded-lg mb-4" 
            />
            <div className="bg-gray-700 p-3 rounded-md text-left">
              <p className="text-sm text-gray-300 mb-1">
                <span className="font-bold text-blue-400">Waktu:</span> {selectedPhoto.label}
              </p>
              <p className="text-sm text-gray-300">
                <span className="font-bold text-green-400">Timestamp:</span> {new Date(selectedPhoto.timestamp).toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        )}
      </Modal>
      
      <button 
        onClick={navigateBack} 
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>
      
      <h2 className="text-3xl font-bold">Rekap Absen Foto</h2>
      <p className="text-lg text-indigo-400 mb-6">{exam.name} ({exam.code}) - Foto absensi otomatis selama ujian</p>
      
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
      </div>
      
      {/* Statistics */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-600 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold">{sessions.length}</div>
          <div className="text-sm">Total Siswa</div>
        </div>
        <div className="bg-green-600 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold">
            {sessions.filter(s => s.status === 'finished').length}
          </div>
          <div className="text-sm">Selesai Ujian</div>
        </div>
        <div className="bg-yellow-600 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold">
            {sessions.reduce((total, session) => {
              return total + getAttendancePhotos(session).length;
            }, 0)}
          </div>
          <div className="text-sm">Total Foto Absen</div>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSessions.map(session => {
            const attendancePhotos = getAttendancePhotos(session);
            
            return (
              <div 
                key={session.id} 
                className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700"
              >
                {/* Student Info Header */}
                <div className="p-4 bg-gray-700 space-y-2">
                  <h4 className="font-bold text-lg text-white">{session.studentInfo.name || session.studentInfo.fullName || 'Nama tidak tersedia'}</h4>
                  <p className="text-sm text-gray-300">NIM: {session.studentInfo.nim}</p>
                  <p className="text-sm text-gray-300">Kelas: {session.studentInfo.className || 'Tidak tersedia'}</p>
                  <p className="text-sm text-gray-300">Jurusan: {session.studentInfo.major || 'Tidak tersedia'}</p>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-600">
                    <span 
                      className={`px-2 py-1 text-xs font-bold rounded-full ${
                        session.status === 'started' 
                          ? 'bg-blue-600' 
                          : session.status === 'finished' 
                          ? 'bg-green-600' 
                          : 'bg-red-600'
                      }`}
                    >
                      {session.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {attendancePhotos.length} foto
                    </span>
                  </div>
                </div>
                
                {/* Photo Gallery */}
                <div className="p-4">
                  <h5 className="text-sm font-bold text-gray-300 mb-3">Galeri Foto Absen:</h5>
                  {attendancePhotos.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">📷</div>
                      <p className="text-sm">Belum ada foto absen</p>
                    </div>
                  ) : (
                    <div className="flex space-x-2 overflow-x-auto pb-2">
                      {attendancePhotos.map((photo, index) => (
                        <div 
                          key={index}
                          className="flex-shrink-0 cursor-pointer group"
                          onClick={() => viewPhoto(photo, session.studentInfo.name)}
                        >
                          <div className="relative">
                            <img 
                              src={photo.imageData} 
                              alt={`Attendance ${photo.label}`}
                              className="w-24 h-20 object-cover rounded-md border-2 border-gray-600 group-hover:border-indigo-500 transition-colors"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-md transition-opacity"></div>
                          </div>
                          <div className="mt-1 text-center">
                            <p className="text-xs text-gray-400 font-medium">
                              {photo.label}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(photo.timestamp).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeacherAttendanceRecap;