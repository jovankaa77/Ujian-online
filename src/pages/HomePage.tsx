import React from 'react';
import { LockIcon, UserIcon } from '../components/ui/Icons';

interface HomePageProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack?: () => void;
  canGoBack?: boolean;
}

const HomePage: React.FC<HomePageProps> = ({ navigateTo, navigateBack, canGoBack }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen -my-16">
      {canGoBack && navigateBack && (
        <button
          onClick={navigateBack}
          className="absolute top-8 left-8 btn-secondary"
        >
          &larr; Kembali
        </button>
      )}
      <h1 className="text-4xl md:text-6xl font-bold theme-text mb-4 text-center tracking-tight">
        Platform Sistem Deteksi Ujian Online
      </h1>
      <p className="text-lg theme-text-muted mb-12 text-center max-w-xl">
        Lingkungan ujian online dengan pengawasan anti-curang
      </p>
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-6">
        <button
          onClick={() => navigateTo('teacher_auth_choice')}
          className="flex items-center justify-center btn-primary shadow-lg transition-transform transform hover:scale-105"
        >
          <LockIcon /> Saya Dosen
        </button>
        <button
          onClick={() => navigateTo('student_auth_choice')}
          className="flex items-center justify-center btn-secondary shadow-lg transition-transform transform hover:scale-105"
        >
          <UserIcon /> Saya Siswa
        </button>
      </div>
    </div>
  );
};

export default HomePage;
