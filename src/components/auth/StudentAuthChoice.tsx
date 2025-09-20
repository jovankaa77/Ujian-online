import React from 'react';

interface StudentAuthChoiceProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
}

const StudentAuthChoice: React.FC<StudentAuthChoiceProps> = ({ navigateTo, navigateBack }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen -mt-16 text-center p-4">
      <button 
        onClick={navigateBack} 
        className="absolute top-8 left-8 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>
      
      <h2 className="text-3xl font-bold mb-8">Portal Peserta Ujian</h2>
      <div className="flex space-x-4">
        <button 
          onClick={() => navigateTo('student_login')}
          className="w-64 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg"
        >
          Login
        </button>
        <button 
          onClick={() => navigateTo('student_register')}
          className="w-64 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg"
        >
          Daftar Akun Baru
        </button>
      </div>
    </div>
  );
};

export default StudentAuthChoice;