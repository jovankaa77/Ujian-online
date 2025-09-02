import React, { useState, useEffect } from 'react';
import HomePage from './pages/HomePage';
import TeacherAuthChoice from './components/auth/TeacherAuthChoice';
import TeacherRegister from './components/auth/TeacherRegister';
import TeacherLogin from './components/auth/TeacherLogin';
import StudentAuthChoice from './components/auth/StudentAuthChoice';
import StudentRegister from './components/auth/StudentRegister';
import StudentLogin from './components/auth/StudentLogin';
import StudentDashboard from './components/student/StudentDashboard';
import StudentJoinExam from './components/student/StudentJoinExam';
import StudentWaitingRoom from './components/student/StudentWaitingRoom';
import StudentConfirmation from './components/teacher/StudentConfirmation';
import TeacherDashboard from './components/teacher/TeacherDashboard';
import QuestionManager from './components/teacher/QuestionManager';
import TeacherProctoringDashboard from './components/teacher/TeacherProctoringDashboard';
import TeacherResultsDashboard from './components/teacher/TeacherResultsDashboard';
import StudentJoin from './components/student/StudentJoin';
import StudentIdentity from './components/student/StudentIdentity';
import StudentExamStatusCheck from './components/student/StudentExamStatusCheck';
import StudentPreCheck from './components/student/StudentPreCheck';
import StudentExam from './components/student/StudentExam';
import TeacherAttendanceDashboard from './components/teacher/TeacherAttendanceDashboard';

function App() {
  // Block mobile devices at app level
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
                     window.screen.width < 1024;
    
    if (isMobile) {
      document.body.innerHTML = `
        <div style="
          display: flex; 
          justify-content: center; 
          align-items: center; 
          height: 100vh; 
          background: #111827; 
          color: #ef4444; 
          font-family: sans-serif;
          text-align: center;
          padding: 20px;
        ">
          <div>
            <h1 style="font-size: 2rem; margin-bottom: 1rem;">🚫 Akses Ditolak</h1>
            <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">Platform ujian ini hanya dapat diakses dari:</p>
            <ul style="list-style: none; padding: 0; font-size: 1.1rem;">
              <li>💻 Laptop atau Desktop</li>
              <li>🖥️ Layar minimal 1024px</li>
              <li>🌐 Browser Desktop</li>
            </ul>
            <p style="margin-top: 1rem; color: #fbbf24;">Silakan gunakan perangkat yang sesuai untuk mengikuti ujian.</p>
          </div>
        </div>
      `;
      return;
    }
  }, []);
  
  const [page, setPage] = useState('home');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [appState, setAppState] = useState<any>({});
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['home']);

  const navigateTo = (pageName: string, data = {}) => {
    setPage(pageName);
    setAppState(currentState => {
      const newState = { ...currentState, ...data };
      if (data.currentUser) {
        setCurrentUser(data.currentUser);
      }
      return newState;
    });
    setNavigationHistory(prev => [...prev, pageName]);
  };

  const navigateBack = () => {
    if (navigationHistory.length > 1) {
      const newHistory = [...navigationHistory];
      newHistory.pop(); // Remove current page
      const previousPage = newHistory[newHistory.length - 1];
      setNavigationHistory(newHistory);
      setPage(previousPage);
    }
  };

  const renderPage = () => {
    const props = { navigateTo, navigateBack, appState, user: currentUser, canGoBack: navigationHistory.length > 1 };
    
    switch (page) {
      case 'home':
        return <HomePage {...props} />;
      case 'teacher_auth_choice':
        return <TeacherAuthChoice {...props} />;
      case 'teacher_register':
        return <TeacherRegister {...props} />;
      case 'teacher_login':
        return <TeacherLogin {...props} />;
      case 'student_auth_choice':
        return <StudentAuthChoice {...props} />;
      case 'student_register':
        return <StudentRegister {...props} />;
      case 'student_login':
        return <StudentLogin {...props} />;
      case 'student_dashboard':
        return <StudentDashboard {...props} />;
      case 'student_join_exam':
        return <StudentJoinExam {...props} />;
      case 'student_waiting_room':
        return <StudentWaitingRoom {...props} />;
      case 'student_confirmation':
        return <StudentConfirmation {...props} />;
      case 'teacher_dashboard':
        return <TeacherDashboard {...props} />;
      case 'question_manager':
        return <QuestionManager {...props} />;
      case 'student_join':
        return <StudentJoin {...props} user={currentUser} />;
      case 'student_identity':
        return <StudentIdentity {...props} />;
      case 'student_status_check':
        return <StudentExamStatusCheck {...props} />;
      case 'student_precheck':
        return <StudentPreCheck {...props} />;
      case 'student_exam':
        return <StudentExam {...props} />;
      case 'teacher_proctoring':
        return <TeacherProctoringDashboard {...props} />;
      case 'teacher_results':
        return <TeacherResultsDashboard {...props} />;
      case 'teacher_attendance':
        return <TeacherAttendanceDashboard {...props} />;
      default:
        return <HomePage {...props} />;
    }
  };

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans">
      <div className="container mx-auto p-4 md:p-8">
        {renderPage()}
      </div>
    </div>
  );
}

export default App;