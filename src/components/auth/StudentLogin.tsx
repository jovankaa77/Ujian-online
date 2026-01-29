import React, { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';

interface StudentLoginProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
}

const StudentLogin: React.FC<StudentLoginProps> = ({ navigateTo, navigateBack }) => {
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
      // Query student by username and password
      const studentsRef = collection(db, `artifacts/${appId}/public/data/students`);
      const q = query(
        studentsRef, 
        where("username", "==", formData.username),
        where("password", "==", formData.password)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const studentDoc = querySnapshot.docs[0];
        const studentData = { id: studentDoc.id, ...studentDoc.data() };
        
        // Store student info in app state
        navigateTo('student_dashboard', { currentUser: studentData });
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
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>
      <h2 className="text-3xl font-bold mb-6 text-center">Login Siswa</h2>
      <div className="w-full max-w-md mx-auto bg-gray-800 p-8 rounded-lg shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            name="username" 
            type="text"
            value={formData.username}
            onChange={handleChange} 
            placeholder="Username" 
            className="w-full p-3 bg-gray-700 rounded-md border border-gray-600" 
            required 
          />
          <div className="relative">
            <input 
              name="password" 
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={handleChange} 
              placeholder="Password" 
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 pr-12" 
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
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-indigo-400"
          >
            {isLoading ? 'Login...' : 'Login'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button 
            onClick={() => navigateTo('student_register')}
            className="text-indigo-400 hover:text-indigo-300 text-sm"
          >
            Belum punya akun? Daftar di sini
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;