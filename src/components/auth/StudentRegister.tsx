import React, { useState } from 'react';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, appId } from '../../config/firebase';
import { getStorage } from 'firebase/storage';

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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [conflictInfo, setConflictInfo] = useState<{[key: string]: string}>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear validation error when user starts typing
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
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('File harus berupa gambar (JPG, PNG, GIF, dll.)');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Ukuran file maksimal 5MB');
        return;
      }
      
      setProfileImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const uploadProfileImage = async (studentId: string): Promise<string | null> => {
    if (!profileImage) return null;
    
    try {
      setIsUploadingImage(true);
      
      // Compress image before upload
      const compressedImage = await compressImage(profileImage);
      
      const storage = getStorage();
      const imageRef = ref(storage, `profile-images/${studentId}/${Date.now()}_profile.jpg`);
      
      const snapshot = await uploadBytes(imageRef, compressedImage);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      // Don't throw error, just return null to continue registration
      setError('Gagal mengupload gambar profil, tapi akun tetap dibuat');
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions (max 400x400)
        const maxSize = 400;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          resolve(blob || file);
        }, 'image/jpeg', 0.8);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };</parameter>

  const validateUniqueFields = async () => {
    const studentsRef = collection(db, `artifacts/${appId}/public/data/students`);
    const errors: {[key: string]: string} = {};
    const conflicts: {[key: string]: string} = {};
    
    // Check for duplicate NIM
    const nimQuery = query(studentsRef, where("nim", "==", formData.nim));
    const nimSnapshot = await getDocs(nimQuery);
    if (!nimSnapshot.empty) {
      const existingStudent = nimSnapshot.docs[0].data();
      errors.nim = "NIM/NIS sudah terdaftar. Gunakan NIM/NIS yang berbeda.";
      conflicts.nim = existingStudent.whatsapp || 'Tidak tersedia';
    }
    
    // Check for duplicate username
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
      // Validate unique fields
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
      // Generate unique ID for student
      const studentId = `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Upload profile image if exists (with timeout)
      let profilePhotoURL = '';
      if (profileImage) {
        try {
          // Set timeout for image upload (10 seconds)
          const uploadPromise = uploadProfileImage(studentId);
          const timeoutPromise = new Promise<string | null>((_, reject) => 
            setTimeout(() => reject(new Error('Upload timeout')), 10000)
          );
          
          profilePhotoURL = await Promise.race([uploadPromise, timeoutPromise]) || '';
        } catch (uploadError) {
          console.error('Image upload failed or timed out:', uploadError);
          setError('Upload gambar gagal, tapi akun tetap akan dibuat');
          profilePhotoURL = '';
        }
      }
      
      await setDoc(doc(db, `artifacts/${appId}/public/data/students`, studentId), {
        fullName: formData.fullName,
        nim: formData.nim,
        username: formData.username,
        password: formData.password, // In production, hash this password
        major: formData.major,
        className: formData.className,
        university: formData.university,
        whatsapp: formData.whatsapp,
        profilePhoto: profilePhotoURL,
        createdAt: new Date(),
        role: 'student'
      });

      const message = profilePhotoURL 
        ? 'Akun siswa berhasil dibuat dengan foto profil! Silakan login.'
        : 'Akun siswa berhasil dibuat! Foto profil dapat diupload nanti di edit profil.';
      alert(message);
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
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>
      <h2 className="text-3xl font-bold mb-6 text-center">Daftar Akun Siswa</h2>
      <div className="w-full max-w-md mx-auto bg-gray-800 p-8 rounded-lg shadow-xl">
        {/* Important Notes */}
        <div className="mb-6 bg-blue-900 border border-blue-500 p-4 rounded-lg">
          <h3 className="text-blue-300 font-bold mb-2">📋 Catatan Penting:</h3>
          <ul className="text-blue-200 text-sm space-y-1">
            <li>• NIM/NIS harus unik dan tidak boleh sama dengan yang sudah terdaftar</li>
            <li>• Username harus unik dan tidak boleh sama dengan yang sudah ada</li>
            <li>• Nomor WhatsApp akan ditampilkan jika terjadi konflik NIM/NIS</li>
            <li>• Password minimal 6 karakter</li>
            <li>• <strong>Kelas:</strong> Gunakan singkatan seperti A, B, C</li>
            <li>• <strong>Jurusan:</strong> Gunakan singkatan seperti RPL, TKJ, MM, TI, SI</li>
            <li>• Pastikan semua data yang dimasukkan benar dan valid</li>
          </ul>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-300 border-b border-gray-600 pb-2">Data Pribadi</h3>
              
              <div>
                <input 
                  name="fullName" 
                  type="text"
                  value={formData.fullName}
                  onChange={handleChange} 
                  placeholder="Nama Lengkap" 
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
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
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
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
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
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
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
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
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  required 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Foto Profil (Opsional)
                </label>
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {profileImagePreview ? (
                      <img
                        src={profileImagePreview}
                        alt="Preview"
                        className="w-20 h-20 rounded-full object-cover border-2 border-gray-600"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center border-2 border-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-grow">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Format: JPG, PNG, GIF. Maksimal 5MB.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Column */}
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
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
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
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
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
                    className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-12" 
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
                    className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-12" 
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
            disabled={isLoading || isUploadingImage}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-indigo-400"
          >
            {isLoading ? (
              isUploadingImage ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Mengupload gambar...
                </div>
              ) : 'Mendaftar...'
            ) : 'Daftar'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button 
            onClick={() => navigateTo('student_login')}
            className="text-indigo-400 hover:text-indigo-300 text-sm"
          >
            Sudah punya akun? Login di sini
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentRegister;