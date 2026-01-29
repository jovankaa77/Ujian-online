import React, { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';

interface TeacherLoginProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
}

const TeacherLogin: React.FC<TeacherLoginProps> = ({ navigateTo, navigateBack }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const teachersRef = collection(db, `artifacts/${appId}/public/data/teachers`);
      const q = query(
        teachersRef,
        where("username", "==", formData.username),
        where("password", "==", formData.password)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const teacherDoc = querySnapshot.docs[0];
        const teacherData = { id: teacherDoc.id, ...teacherDoc.data() };
        navigateTo('teacher_dashboard', { currentUser: teacherData });
      } else {
        setError('Username atau password salah');
      }
    } catch (error: any) {
      setError('Gagal login. Silakan coba lagi.');
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
      <h2 className="text-3xl font-bold mb-6 text-center theme-text">Login Dosen</h2>
      <div className="w-full max-w-md mx-auto card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="username"
            type="text"
            value={formData.username}
            onChange={handleChange}
            placeholder="Username"
            className="input-field"
            required
          />
          <div className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              className="input-field pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center theme-text-muted hover:theme-text"
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
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary disabled:opacity-50"
          >
            {isLoading ? 'Login...' : 'Login'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={() => navigateTo('teacher_register')}
            className="theme-text-muted hover:theme-text text-sm underline"
          >
            Belum punya akun? Daftar di sini
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherLogin;
