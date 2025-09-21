import React, { useState, useEffect } from 'react';
import { collection, getDocs, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import Modal from '../ui/Modal';

interface FacePhoto {
  imageData: string;
  timestamp: string;
  faceCount: number;
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
  maxFaceCount?: number;
  totalFacePhotos?: number;
  [key: string]: any; // For dynamic face photo fields
}

interface TeacherFaceMonitoringProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  appState: any;
}

const TeacherFaceMonitoring: React.FC<TeacherFaceMonitoringProps> = ({ navigateTo, navigateBack, appState }) => {
  const { exam } = appState;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [facePhotos, setFacePhotos] = useState<Array<{
    id: string;
    photo: FacePhoto;
    studentInfo: any;
    photoKey: string;
  }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterJurusan, setFilterJurusan] = useState('');
  const [availableKelas, setAvailableKelas] = useState<string[]>([]);
  const [availableJurusan, setAvailableJurusan] = useState<string[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Array<{
    id: string;
    photo: FacePhoto;
    studentInfo: any;
    photoKey: string;
  }>>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<{
    photo: FacePhoto;
    studentInfo: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
            
            // Extract face photos from all sessions
            const allPhotos: Array<{
              id: string;
              photo: FacePhoto;
              studentInfo: any;
              photoKey: string;
            }> = [];
            
            sessionsData.forEach(session => {
              Object.keys(session).forEach(key => {
                if (key.startsWith('facePhoto_')) {
                  const photoData = session[key];
                  if (photoData && photoData.imageData) {
                    allPhotos.push({
                      id: session.id,
                      photo: photoData,
                      studentInfo: session.studentInfo,
                      photoKey: key
                    });
                  }
                }
              });
            });
            
            // Sort photos by timestamp (newest first)
            allPhotos.sort((a, b) => 
              new Date(b.photo.timestamp).getTime() - new Date(a.photo.timestamp).getTime()
            );
            
            setFacePhotos(allPhotos);
            
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
        console.error('Error fetching face photos:', error);
        setIsLoading(false);
      }
    };
    
    fetchSessions();
  }, [exam?.id]);

  // Filter photos based on search term and filters
  useEffect(() => {
    let filtered = facePhotos;
    
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
    
    setFilteredPhotos(filtered);
  }, [facePhotos, searchTerm, filterKelas, filterJurusan]);

  const openPhotoModal = (photo: FacePhoto, studentInfo: any) => {
    setSelectedPhoto({ photo, studentInfo });
  };

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-lg text-gray-300">Memuat data deteksi wajah...</p>
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
        title={`Deteksi Wajah - ${selectedPhoto?.studentInfo?.name || 'Siswa'}`}
        onCancel={() => setSelectedPhoto(null)}
        cancelText="Tutup"
      >
        {selectedPhoto && (
          <div className="text-center space-y-4">
            <img 
              src={selectedPhoto.photo.imageData} 
              alt="Face Detection Photo" 
              className="w-full max-w-md mx-auto rounded-lg mb-4" 
            />
            
            <div className="bg-gray-700 p-4 rounded-lg">
              <h4 className="font-bold text-lg text-white mb-2">{selectedPhoto.studentInfo.name}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                <div><span className="font-bold">NIM:</span> {selectedPhoto.studentInfo.nim}</div>
                <div><span className="font-bold">Kelas:</span> {selectedPhoto.studentInfo.className}</div>
                <div><span className="font-bold">Jurusan:</span> {selectedPhoto.studentInfo.major}</div>
                <div><span className="font-bold">Wajah:</span> {selectedPhoto.photo.faceCount}</div>
              </div>
            </div>
            
            <div className="bg-blue-900 border border-blue-500 p-4 rounded-lg">
              <div className="text-blue-300 font-bold mb-2">📅 Informasi Foto</div>
              <div className="text-blue-200 text-sm space-y-1">
                <div><span className="font-bold">Waktu:</span> {new Date(selectedPhoto.photo.timestamp).toLocaleString('id-ID')}</div>
                <div><span className="font-bold">Jumlah Wajah:</span> {selectedPhoto.photo.faceCount} wajah</div>
                <div><span className="font-bold">Label:</span> {selectedPhoto.photo.label}</div>
              </div>
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
      
      <h2 className="text-3xl font-bold">Human Face Detection</h2>
      <p className="text-lg text-indigo-400 mb-6">{exam.name} ({exam.code}) - Foto otomatis saat wajah terdeteksi</p>
      
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
            Menampilkan {filteredPhotos.length} dari {facePhotos.length} foto deteksi wajah
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
          <div className="text-2xl font-bold">{facePhotos.length}</div>
          <div className="text-sm">Total Foto Wajah</div>
        </div>
        <div className="bg-green-600 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold">
            {sessions.filter(s => s.status === 'finished').length}
          </div>
          <div className="text-sm">Selesai Ujian</div>
        </div>
        <div className="bg-yellow-600 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold">
            {new Set(facePhotos.map(p => p.studentInfo.name)).size}
          </div>
          <div className="text-sm">Siswa Terdeteksi</div>
        </div>
      </div>
      
      {facePhotos.length === 0 ? (
        <div className="text-center mt-8 bg-gray-800 p-8 rounded-lg">
          <div className="text-6xl mb-4">👤</div>
          <h3 className="text-xl font-bold text-gray-400 mb-2">Belum Ada Foto Deteksi Wajah</h3>
          <p className="text-gray-500">
            Foto deteksi wajah akan muncul secara real-time ketika sistem mendeteksi wajah dari siswa selama ujian.
          </p>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="text-center mt-8 bg-gray-800 p-6 rounded-lg">
          <p className="text-yellow-400 text-lg mb-2">🔍 Tidak ada hasil</p>
          <p className="text-gray-400">
            Tidak ditemukan foto deteksi wajah dengan filter yang diterapkan
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterKelas('');
              setFilterJurusan('');
            }}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            Tampilkan Semua Foto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Group photos by student */}
          {(() => {
            // Group photos by student
            const studentGroups = new Map();
            
            filteredPhotos.forEach(item => {
              const studentKey = `${item.studentInfo.name}_${item.studentInfo.nim}`;
              if (!studentGroups.has(studentKey)) {
                studentGroups.set(studentKey, {
                  studentInfo: item.studentInfo,
                  photos: [],
                  maxFaceCount: 0,
                  totalPhotos: 0
                });
              }
              const group = studentGroups.get(studentKey);
              group.photos.push(item);
              group.totalPhotos++;
              if (item.photo.faceCount > group.maxFaceCount) {
                group.maxFaceCount = item.photo.faceCount;
              }
            });
            
            // Convert to array and sort by latest photo
            const sortedGroups = Array.from(studentGroups.values()).sort((a, b) => {
              const latestA = Math.max(...a.photos.map(p => new Date(p.photo.timestamp).getTime()));
              const latestB = Math.max(...b.photos.map(p => new Date(p.photo.timestamp).getTime()));
              return latestB - latestA;
            });
            
            return sortedGroups.map((group, groupIndex) => (
              <div 
                key={`${group.studentInfo.name}_${group.studentInfo.nim}`}
                className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700 hover:border-blue-500 transition-colors"
              >
                {/* Student Info Header */}
                <div className="p-4 bg-gray-700 border-b border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
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
                      <div className="px-3 py-1 bg-blue-600 text-white text-sm font-bold rounded-full">
                        👤 {group.totalPhotos} Foto
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div><span className="font-bold">Kelas:</span> {group.studentInfo.className || 'N/A'}</div>
                    <div><span className="font-bold">Jurusan:</span> {group.studentInfo.major || 'N/A'}</div>
                  </div>
                  
                  <div className="mt-2 bg-blue-900 border border-blue-500 p-2 rounded-md">
                    <div className="text-center">
                      <div className="text-blue-300 text-xs font-bold">Jumlah Wajah Maksimal</div>
                      <div className={`text-lg font-bold ${
                        group.maxFaceCount === 1 ? 'text-green-400' : 
                        group.maxFaceCount === 0 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {group.maxFaceCount} wajah
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Photo Gallery */}
                <div className="p-4">
                  <h5 className="text-sm font-bold text-gray-300 mb-3 flex items-center">
                    📸 Galeri Foto Wajah:
                    <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                      {group.photos.length}
                    </span>
                  </h5>
                  
                  {group.photos.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <div className="text-3xl mb-2">👤</div>
                      <p className="text-sm">Belum ada foto wajah</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                      {group.photos
                        .sort((a, b) => new Date(b.photo.timestamp).getTime() - new Date(a.photo.timestamp).getTime())
                        .slice(0, 12) // Show max 12 photos
                        .map((item, index) => (
                        <div 
                          key={`${item.id}-${item.photoKey}`}
                          className="relative cursor-pointer group"
                          onClick={() => openPhotoModal(item.photo, item.studentInfo)}
                        >
                          <img 
                            src={item.photo.imageData} 
                            alt={`Face detection ${item.photo.faceCount}`}
                            className="w-full h-20 object-cover rounded-md border-2 border-gray-600 group-hover:border-blue-500 transition-colors"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-md transition-opacity"></div>
                          
                          {/* Face count badge */}
                          <div className="absolute top-1 right-1">
                            <span className={`px-1 py-0.5 text-xs font-bold rounded ${
                              item.photo.faceCount === 1 ? 'bg-green-600 text-white' : 
                              item.photo.faceCount === 0 ? 'bg-yellow-600 text-white' : 'bg-red-600 text-white'
                            }`}>
                              {item.photo.faceCount}
                            </span>
                          </div>
                          
                          {/* Timestamp */}
                          <div className="absolute bottom-1 left-1 right-1">
                            <div className="bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded text-center">
                              {new Date(item.photo.timestamp).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {group.photos.length > 12 && (
                        <div className="col-span-3 text-center py-2">
                          <span className="text-xs text-gray-400">
                            +{group.photos.length - 12} foto lainnya
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Summary Footer */}
                <div className="p-3 bg-gray-700 border-t border-gray-600">
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>
                      📊 Total: {group.photos.length} foto
                    </span>
                    <span>
                      👤 Max: {group.maxFaceCount} wajah
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

export default TeacherFaceMonitoring;