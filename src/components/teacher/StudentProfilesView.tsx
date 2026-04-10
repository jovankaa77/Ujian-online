import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';

interface Student {
  id: string;
  username: string;
  fullName: string;
  nim: string;
  className: string;
  major: string;
  university: string;
  whatsapp: string;
  profilePhoto: string | null;
  createdAt: any;
}

interface StudentProfilesViewProps {
  navigateBack: () => void;
}

const StudentProfilesView: React.FC<StudentProfilesViewProps> = ({ navigateBack }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const studentsRef = collection(db, `artifacts/${appId}/public/data/students`);
        const snapshot = await getDocs(studentsRef);
        const studentList: Student[] = snapshot.docs.map(doc => ({
          id: doc.id,
          username: doc.data().username || '',
          fullName: doc.data().fullName || '',
          nim: doc.data().nim || '',
          className: doc.data().className || '',
          major: doc.data().major || '',
          university: doc.data().university || '',
          whatsapp: doc.data().whatsapp || '',
          profilePhoto: doc.data().profilePhoto || null,
          createdAt: doc.data().createdAt
        }));
        studentList.sort((a, b) => a.fullName.localeCompare(b.fullName));
        setStudents(studentList);
        setFilteredStudents(studentList);
      } catch (error) {
        console.error('Failed to fetch students:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStudents(students);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = students.filter(s =>
      s.fullName.toLowerCase().includes(q) ||
      s.major.toLowerCase().includes(q) ||
      s.nim.toLowerCase().includes(q) ||
      s.className.toLowerCase().includes(q) ||
      s.university.toLowerCase().includes(q) ||
      s.username.toLowerCase().includes(q)
    );
    setFilteredStudents(filtered);
  }, [searchQuery, students]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-400">Memuat data peserta...</span>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={navigateBack}
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
      >
        &larr; Kembali
      </button>

      <h2 className="text-2xl font-bold mb-6">Profil Peserta Ujian</h2>

      <div className="mb-6">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama, jurusan, NIM/NIS, kelas, universitas, atau username..."
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Menampilkan {filteredStudents.length} dari {students.length} peserta
        </p>
      </div>

      {filteredStudents.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-gray-400 text-lg">
            {searchQuery ? 'Tidak ada peserta yang cocok dengan pencarian.' : 'Belum ada peserta ujian terdaftar.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredStudents.map(student => (
            <div
              key={student.id}
              className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-500 transition-colors"
            >
              <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-4 flex items-center gap-4">
                {student.profilePhoto ? (
                  <button
                    onClick={() => {
                      setSelectedPhoto(student.profilePhoto);
                      setSelectedStudent(student);
                    }}
                    className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
                  >
                    <img
                      src={student.profilePhoto}
                      alt={student.fullName}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-500 hover:border-blue-400 transition-colors cursor-pointer"
                    />
                  </button>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 border-2 border-gray-500">
                    <span className="text-2xl font-bold text-gray-400">
                      {student.fullName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-base truncate">{student.fullName}</h3>
                  <p className="text-sm text-gray-400 truncate">@{student.username}</p>
                </div>
              </div>

              <div className="p-4 space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 text-sm w-24 flex-shrink-0">NIM/NIS</span>
                  <span className="text-gray-200 text-sm font-mono">{student.nim}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 text-sm w-24 flex-shrink-0">Kelas</span>
                  <span className="text-gray-200 text-sm">{student.className}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 text-sm w-24 flex-shrink-0">Jurusan</span>
                  <span className="text-gray-200 text-sm">{student.major}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 text-sm w-24 flex-shrink-0">Universitas</span>
                  <span className="text-gray-200 text-sm">{student.university}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 text-sm w-24 flex-shrink-0">No. WA</span>
                  <span className="text-gray-200 text-sm font-mono">{student.whatsapp}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 p-4"
          onClick={() => { setSelectedPhoto(null); setSelectedStudent(null); }}
        >
          <div
            className="bg-gray-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">
                {selectedStudent?.fullName || 'Foto Profil'}
              </h3>
              <button
                onClick={() => { setSelectedPhoto(null); setSelectedStudent(null); }}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-4 flex justify-center">
              <img
                src={selectedPhoto}
                alt={selectedStudent?.fullName || 'Foto profil'}
                className="max-w-full max-h-[60vh] rounded-lg object-contain"
              />
            </div>
            {selectedStudent && (
              <div className="p-4 border-t border-gray-700 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Username:</span> <span className="text-gray-200">@{selectedStudent.username}</span></div>
                <div><span className="text-gray-500">NIM/NIS:</span> <span className="text-gray-200">{selectedStudent.nim}</span></div>
                <div><span className="text-gray-500">Kelas:</span> <span className="text-gray-200">{selectedStudent.className}</span></div>
                <div><span className="text-gray-500">Jurusan:</span> <span className="text-gray-200">{selectedStudent.major}</span></div>
                <div><span className="text-gray-500">Universitas:</span> <span className="text-gray-200">{selectedStudent.university}</span></div>
                <div><span className="text-gray-500">No. WA:</span> <span className="text-gray-200">{selectedStudent.whatsapp}</span></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProfilesView;
