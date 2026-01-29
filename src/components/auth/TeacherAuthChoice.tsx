import React from 'react';

interface TeacherAuthChoiceProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
}

const TeacherAuthChoice: React.FC<TeacherAuthChoiceProps> = ({ navigateTo, navigateBack }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen -mt-16 text-center p-4">
      <button 
        onClick={navigateBack} 
        className="absolute top-8 left-8 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>
      
      <h2 className="text-3xl font-bold mb-8">Portal Dosen</h2>
      <button 
        onClick={() => navigateTo('teacher_dashboard', { currentUser: { id: 'teacher_default', role: 'teacher' } })}
        className="w-64 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg"
      >
        Masuk ke Dashboard Dosen
      </button>
    </div>
  );
};

export default TeacherAuthChoice;