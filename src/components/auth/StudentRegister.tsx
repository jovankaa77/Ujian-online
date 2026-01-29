import React, { useState } from 'react';
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
    } catch (error) {
      setError('Gagal memvalidasi data. Silakan coba lagi.');
      setIsLoading(false);
      return;
    }

    try {
      const studentId = `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await setDoc(doc(db, `artifacts/${appId}/public/data/students`, studentId), {
        fullName: formData.fullName,
        nim: formData.nim,
        username: formData.username,
        password: formData.password,
        major: formData.major,
        className: formData.className,
        university: formData.university,
        whatsapp: formData.whatsapp,
        createdAt: new Date(),
        role: 'student'
      });

      alert('Akun siswa berhasil dibuat! Silakan login.');
      navigateTo('student_login');
    } catch (error: any) {
      setError('Gagal membuat akun. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={navigateBack}
        className="mb-6 btn-secondary"
      >
        &larr; Kembali
      </button>
      <h2 className="text-3xl font-bold mb-6 text-center theme-text">Daftar Akun Siswa</h2>
      <div className="w-full max-w-md mx-auto card">
        <div className="mb-6 theme-bg-secondary theme-border border p-4 rounded-lg">
          <h3 className="theme-text font-bold mb-2">Catatan Penting:</h3>
          <ul className="theme-text-secondary text-sm space-y-1">
            <li>NIM/NIS harus unik dan tidak boleh sama dengan yang sudah terdaftar</li>
            <li>Username harus unik dan tidak boleh sama dengan yang sudah ada</li>
            <li>Nomor WhatsApp akan ditampilkan jika terjadi konflik NIM/NIS</li>
            <li>Password minimal 6 karakter</li>
            <li><strong>Kelas:</strong> Gunakan singkatan seperti A, B, C</li>
            <li><strong>Jurusan:</strong> Gunakan singkatan seperti RPL, TKJ, MM, TI, SI</li>
            <li>Pastikan semua data yang dimasukkan benar dan valid</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold theme-text-secondary theme-border border-b pb-2">Data Pribadi</h3>

              <input
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Nama Lengkap"
                className="input-field"
                required
              />

              <input
                name="major"
                type="text"
                value={formData.major}
                onChange={handleChange}
                placeholder="Program Studi/Jurusan"
                className="input-field"
                required
              />

              <input
                name="className"
                type="text"
                value={formData.className}
                onChange={handleChange}
                placeholder="Kelas"
                className="input-field"
                required
              />

              <input
                name="university"
                type="text"
                value={formData.university}
                onChange={handleChange}
                placeholder="Universitas/Sekolah"
                className="input-field"
                required
              />

              <input
                name="whatsapp"
                type="tel"
                value={formData.whatsapp}
                onChange={handleChange}
                placeholder="Nomor WhatsApp (contoh: 08123456789)"
                className="input-field"
                required
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold theme-text-secondary theme-border border-b pb-2">Data Akun</h3>

              <div>
                <input
                  name="nim"
                  type="text"
                  value={formData.nim}
                  onChange={handleChange}
                  placeholder="NIM/NIS (Nomor Induk)"
                  className={`input-field ${validationErrors.nim ? 'border-red-500' : ''}`}
                  required
                />
                {validationErrors.nim && (
                  <p className="text-red-400 text-xs mt-1">{validationErrors.nim}</p>
                )}
                {conflictInfo.nim && (
                  <div className="mt-2 p-2 bg-red-900/50 border border-red-500 rounded-md">
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
                  className={`input-field ${validationErrors.username ? 'border-red-500' : ''}`}
                  required
                />
                {validationErrors.username && (
                  <p className="text-red-400 text-xs mt-1">{validationErrors.username}</p>
                )}
              </div>

              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password (minimal 6 karakter)"
                  className="input-field pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center theme-text-muted"
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

              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Konfirmasi Password"
                  className="input-field pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center theme-text-muted"
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

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary disabled:opacity-50"
          >
            {isLoading ? 'Mendaftar...' : 'Daftar'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={() => navigateTo('student_login')}
            className="theme-text-muted hover:theme-text text-sm underline"
          >
            Sudah punya akun? Login di sini
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentRegister;
