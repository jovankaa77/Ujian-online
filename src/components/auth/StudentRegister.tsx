import React, { useState, useRef, useCallback } from 'react';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';

interface StudentRegisterProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
}

const StudentRegister: React.FC<StudentRegisterProps> = ({ navigateTo, navigateBack }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    nim: '',
    username: '',
    password: '',
    confirmPassword: '',
    major: '',
    className: '',
    university: '',
    whatsapp: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [conflictInfo, setConflictInfo] = useState<{[key: string]: string}>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (validationErrors[e.target.name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[e.target.name];
        return newErrors;
      });
      setConflictInfo(prev => {
        const newConflicts = { ...prev };
        delete newConflicts[e.target.name];
        return newConflicts;
      });
    }
  };

  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
    } catch (err) {
      setError('Gagal mengakses kamera. Pastikan izin kamera diaktifkan.');
    }
  }, []);

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 300;
    ctx.drawImage(video, 0, 0, 400, 300);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setProfilePhoto(dataUrl);
    closeCamera();
  }, [closeCamera]);

  const retakePhoto = useCallback(() => {
    setProfilePhoto(null);
    openCamera();
  }, [openCamera]);

  const validateUniqueFields = async () => {
    const studentsRef = collection(db, `artifacts/${appId}/public/data/students`);
    const errors: {[key: string]: string} = {};
    const conflicts: {[key: string]: string} = {};

    const nimQuery = query(studentsRef, where("nim", "==", formData.nim));
    const nimSnapshot = await getDocs(nimQuery);
    if (!nimSnapshot.empty) {
      const existingStudent = nimSnapshot.docs[0].data();
      errors.nim = "NIM/NIS sudah terdaftar. Gunakan NIM/NIS yang berbeda.";
      conflicts.nim = existingStudent.whatsapp || 'Tidak tersedia';
    }

    const usernameQuery = query(studentsRef, where("username", "==", formData.username));
    const usernameSnapshot = await getDocs(usernameQuery);
    if (!usernameSnapshot.empty) {
      errors.username = "Username sudah digunakan. Pilih username yang berbeda.";
    }

    return { errors, conflicts };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});
    setIsLoading(true);

    if (!profilePhoto) {
      setError('Foto profil wajib diambil. Silakan ambil foto menggunakan kamera.');
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Password tidak cocok');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password minimal 6 karakter');
      setIsLoading(false);
      return;
    }

    try {
      const { errors: uniqueFieldErrors, conflicts } = await validateUniqueFields();
      if (Object.keys(uniqueFieldErrors).length > 0) {
        setValidationErrors(uniqueFieldErrors);
        setConflictInfo(conflicts);
        setIsLoading(false);
        return;
      }
    } catch (_error) {
      setError('Gagal memvalidasi data. Silakan coba lagi.');
      setIsLoading(false);
      return;
    }

    try {
      const studentId = `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const studentData = {
        fullName: formData.fullName,
        nim: formData.nim,
        username: formData.username,
        password: formData.password,
        major: formData.major,
        className: formData.className,
        university: formData.university,
        whatsapp: formData.whatsapp,
        profilePhoto: profilePhoto,
        createdAt: new Date(),
        role: 'student'
      };

      await setDoc(doc(db, `artifacts/${appId}/public/data/students`, studentId), studentData);

      await setDoc(doc(db, `artifacts/${appId}/public/data/users`, studentId), {
        ...studentData,
        password: '***',
        userId: studentId,
      });

      alert('Akun peserta ujian berhasil dibuat! Silakan login.');
      navigateTo('student_login');
    } catch (_error: any) {
      setError('Gagal membuat akun. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
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
      <h2 className="text-3xl font-bold mb-6 text-center">Daftar Akun Peserta Ujian</h2>
      <div className="w-full max-w-md mx-auto bg-gray-800 p-8 rounded-lg shadow-xl">
        <div className="mb-6 bg-blue-900 border border-blue-500 p-4 rounded-lg">
          <h3 className="text-blue-300 font-bold mb-2">Catatan Penting:</h3>
          <ul className="text-blue-200 text-sm space-y-1">
            <li>- NIM/NIS harus unik dan tidak boleh sama dengan yang sudah terdaftar</li>
            <li>- Username harus unik dan tidak boleh sama dengan yang sudah ada</li>
            <li>- Nomor WhatsApp akan ditampilkan jika terjadi konflik NIM/NIS</li>
            <li>- Password minimal 6 karakter</li>
            <li>- <strong>Kelas:</strong> Gunakan singkatan seperti A, B, C</li>
            <li>- <strong>Jurusan:</strong> Gunakan singkatan seperti RPL, TKJ, MM, TI, SI</li>
            <li>- <strong>Foto profil wajib diambil dari kamera</strong></li>
            <li>- Pastikan semua data yang dimasukkan benar dan valid</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-300 border-b border-gray-600 pb-2 mb-4">Foto Profil</h3>
            <div className="flex flex-col items-center">
              {profilePhoto ? (
                <div className="relative">
                  <img
                    src={profilePhoto}
                    alt="Foto profil"
                    className="w-40 h-40 rounded-full object-cover border-4 border-green-500"
                  />
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="mt-3 w-full bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors"
                  >
                    Ambil Ulang Foto
                  </button>
                </div>
              ) : isCameraOpen ? (
                <div className="w-full">
                  <div className="relative rounded-lg overflow-hidden border-2 border-gray-600">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full rounded-lg"
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                      Ambil Foto
                    </button>
                    <button
                      type="button"
                      onClick={closeCamera}
                      className="flex-1 bg-gray-600 hover:bg-gray-500 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openCamera}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Buka Kamera untuk Foto Profil
                </button>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-300 border-b border-gray-600 pb-2">Data Pribadi</h3>

              <div>
                <input
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Nama Lengkap"
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <input
                  name="major"
                  type="text"
                  value={formData.major}
                  onChange={handleChange}
                  placeholder="Program Studi/Jurusan"
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <input
                  name="className"
                  type="text"
                  value={formData.className}
                  onChange={handleChange}
                  placeholder="Kelas"
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <input
                  name="university"
                  type="text"
                  value={formData.university}
                  onChange={handleChange}
                  placeholder="Universitas/Sekolah"
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <input
                  name="whatsapp"
                  type="tel"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  placeholder="Nomor WhatsApp (contoh: 08123456789)"
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-300 border-b border-gray-600 pb-2">Data Akun</h3>

              <div>
                <input
                  name="nim"
                  type="text"
                  value={formData.nim}
                  onChange={handleChange}
                  placeholder="NIM/NIS (Nomor Induk)"
                  className={`w-full p-3 bg-gray-700 rounded-md border ${
                    validationErrors.nim ? 'border-red-500' : 'border-gray-600'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  required
                />
                {validationErrors.nim && (
                  <p className="text-red-400 text-xs mt-1">{validationErrors.nim}</p>
                )}
                {conflictInfo.nim && (
                  <div className="mt-2 p-2 bg-red-900 border border-red-500 rounded-md">
                    <p className="text-red-300 text-xs">
                      <strong>Konflik Data:</strong> NIM/NIS ini sudah digunakan oleh pengguna dengan WhatsApp:
                      <span className="font-mono ml-1">{conflictInfo.nim}</span>
                    </p>
                  </div>
                )}
              </div>

              <div>
                <input
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Username"
                  className={`w-full p-3 bg-gray-700 rounded-md border ${
                    validationErrors.username ? 'border-red-500' : 'border-gray-600'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  required
                />
                {validationErrors.username && (
                  <p className="text-red-400 text-xs mt-1">{validationErrors.username}</p>
                )}
              </div>

              <div>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Password (minimal 6 karakter)"
                    className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="relative">
                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Konfirmasi Password"
                    className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  >
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-blue-400"
          >
            {isLoading ? 'Mendaftar...' : 'Daftar'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={() => navigateTo('student_login')}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Sudah punya akun? Login di sini
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentRegister;
