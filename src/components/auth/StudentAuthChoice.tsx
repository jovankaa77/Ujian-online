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
        className="absolute top-8 left-8 btn-secondary"
      >
        &larr; Kembali
      </button>

      <h2 className="text-3xl font-bold mb-8 theme-text">Portal Peserta Ujian</h2>
      <div className="flex space-x-4">
        <button
          onClick={() => navigateTo('student_login')}
          className="w-64 btn-primary"
        >
          Login
        </button>
        <button
          onClick={() => navigateTo('student_register')}
          className="w-64 btn-secondary"
        >
          Daftar Akun Baru
        </button>
      </div>
    </div>
  );
};

export default StudentAuthChoice;
