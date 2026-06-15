import React, { useState, useEffect } from 'react';

interface StudentExamStatusCheckProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  appState: any;
}

const StudentExamStatusCheck: React.FC<StudentExamStatusCheckProps> = ({ navigateTo, navigateBack, appState }) => {
  const { exam, studentInfo } = appState;
  const [statusMessage, setStatusMessage] = useState('Memeriksa status ujian...');

  useEffect(() => {
    const checkStatus = () => {
      const now = new Date();
      const startTime = new Date(exam.startTime);
      const endTime = new Date(exam.endTime);

      console.log("Status check:");
      console.log("Current time:", now.toISOString());
      console.log("Exam start:", startTime.toISOString());
      console.log("Exam end:", endTime.toISOString());
      console.log("Exam status:", exam.status);
      if (exam.status !== 'published') {
        setStatusMessage(`Ujian "${exam.name}" belum dipublikasikan oleh pengawas.`);
      } else if (now < startTime) {
        setStatusMessage(`Ujian belum dimulai. Ujian akan dibuka pada ${startTime.toLocaleString('id-ID')}.`);
      } else if (now > endTime) {
        setStatusMessage('Waktu untuk mengikuti ujian ini telah berakhir.');
      } else {
        console.log("Exam is ready to start, navigating to precheck...");
        navigateTo('student_precheck', { exam: exam, studentInfo: studentInfo });
      }
    };
    checkStatus();
  }, [exam, navigateTo]);

  return (
    <div className="flex flex-col items-center justify-center h-screen -mt-16 text-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl">
        <h2 className="text-3xl font-bold text-yellow-400 mb-4">Informasi Ujian</h2>
        <p className="text-lg text-gray-300">
          Halo, <span className="font-bold">{studentInfo.name}</span>.
        </p>
        <p className="text-lg text-gray-300 mt-2">{statusMessage}</p>
        <button 
          onClick={navigateBack} 
          className="mt-8 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg"
        >
          Kembali
        </button>
      </div>
    </div>
  );
};

export default StudentExamStatusCheck;