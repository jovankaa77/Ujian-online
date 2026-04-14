import React, { useState, useEffect } from 'react';
import { collection, getDocs, onSnapshot, query, limit, startAfter, orderBy, DocumentSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import EssayGradingView from './EssayGradingView';

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  php: 'PHP',
  htmlcss: 'HTML, CSS Dan Javascript'
};

interface Question {
  id: string;
  text: string;
  type: 'mc' | 'essay' | 'livecode';
  options?: string[];
  optionImages?: (string | null)[];
  correctAnswer?: number;
  image?: string | null;
  language?: string;
}

interface Session {
  id: string;
  studentInfo: {
    name: string;
    nim: string;
    major: string;
    className: string;
    fullName?: string;
  };
  status: string;
  violations: number;
  finalScore?: number;
  essayScores?: { [key: string]: number };
  livecodeScores?: { [key: string]: number };
  scoreReduction?: number;
  answers?: { [questionId: string]: number | string };
}

interface TeacherResultsDashboardProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack: () => void;
  appState: any;
}

const TeacherResultsDashboard: React.FC<TeacherResultsDashboardProps> = ({ navigateTo, navigateBack, appState }) => {
  const { exam, parentExam } = appState;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterJurusan, setFilterJurusan] = useState('');
  const [availableKelas, setAvailableKelas] = useState<string[]>([]);
  const [availableJurusan, setAvailableJurusan] = useState<string[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);
  const SESSIONS_PER_PAGE = 50;
  const [editingScoreSession, setEditingScoreSession] = useState<Session | null>(null);
  const [scoreReduction, setScoreReduction] = useState(0);
  const [isUpdatingScore, setIsUpdatingScore] = useState(false);
  const [scoreError, setScoreError] = useState('');
  const [historySession, setHistorySession] = useState<Session | null>(null);
  const [editingAnswers, setEditingAnswers] = useState<{ [questionId: string]: number | string }>({});
  const [isEditingAnswers, setIsEditingAnswers] = useState(false);
  const [isSavingAnswers, setIsSavingAnswers] = useState(false);

  const handleBackNavigation = () => {
    navigateBack();
  };

  useEffect(() => {
    if (!exam?.id) return;
    
    // Load questions with real-time updates
    const questionsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/questions`);
    const unsubscribeQuestions = onSnapshot(query(questionsRef, limit(100)), (snapshot) => {
      setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
    });
    
    // Load first page of sessions with real-time updates
    loadSessions(true);
    
    // Set up auto-refresh every 30 seconds for real-time monitoring
    const refreshInterval = setInterval(() => {
      if (!isLoadingMore) {
        loadSessions(true);
      }
    }, 30000);
    
    return () => {
      unsubscribeQuestions();
      clearInterval(refreshInterval);
    };
  }, [exam?.id]);

  const loadSessions = async (isFirstLoad = false) => {
    if (!exam?.id) return;
    
    if (!isFirstLoad && !hasMoreData) return;
    
    setIsLoadingMore(true);
    
    try {
      const sessionsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`);
      let sessionsQuery = query(
        sessionsRef, 
        orderBy('startTime', 'desc'),
        limit(SESSIONS_PER_PAGE)
      );
      
      if (!isFirstLoad && lastDoc) {
        sessionsQuery = query(
          sessionsRef,
          orderBy('startTime', 'desc'),
          startAfter(lastDoc),
          limit(SESSIONS_PER_PAGE)
        );
      }
      
      const snapshot = await getDocs(sessionsQuery);
      const newSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      
      if (isFirstLoad) {
        setSessions(newSessions);
        setCurrentPage(1);
      } else {
        setSessions(prev => [...prev, ...newSessions]);
        setCurrentPage(prev => prev + 1);
      }
      
      // Update pagination state
      setHasMoreData(snapshot.docs.length === SESSIONS_PER_PAGE);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      
      // Update filter options
      const allSessions = isFirstLoad ? newSessions : [...sessions, ...newSessions];
      const kelasSet = new Set<string>();
      const jurusanSet = new Set<string>();
      
      allSessions.forEach(session => {
        if (session.studentInfo.className) kelasSet.add(session.studentInfo.className);
        if (session.studentInfo.major) jurusanSet.add(session.studentInfo.major);
      });
      
      setAvailableKelas(Array.from(kelasSet).sort());
      setAvailableJurusan(Array.from(jurusanSet).sort());
      
      if (isFirstLoad) {
        setTotalSessions(allSessions.length);
      }
      
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Filter and search logic
  useEffect(() => {
    let filtered = sessions;
    
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(session => {
        const name = (session.studentInfo.name || session.studentInfo.fullName || '').toLowerCase();
        const nim = (session.studentInfo.nim || '').toLowerCase();
        const major = (session.studentInfo.major || '').toLowerCase();
        const className = (session.studentInfo.className || '').toLowerCase();
        
        return name.includes(search) || 
               nim.includes(search) || 
               major.includes(search) || 
               className.includes(search);
      });
    }
    
    // Apply kelas filter
    if (filterKelas) {
      filtered = filtered.filter(session => session.studentInfo.className === filterKelas);
    }
    
    // Apply jurusan filter
    if (filterJurusan) {
      filtered = filtered.filter(session => session.studentInfo.major === filterJurusan);
    }
    
    setFilteredSessions(filtered);
  }, [sessions, searchTerm, filterKelas, filterJurusan]);
  const calculateTotalScore = (session: Session) => {
    const mcScore = session.finalScore || 0;
    const mcQuestionCount = questions.filter(q => q.type === 'mc').length;
    const essayQuestions = questions.filter(q => q.type === 'essay');
    const livecodeQuestions = questions.filter(q => q.type === 'livecode');

    const reduction = session.scoreReduction || 0;

    let avgEssayScore = 0;
    if (session.essayScores && essayQuestions.length > 0) {
      const essayScoreValues = Object.values(session.essayScores);
      if (essayScoreValues.length > 0) {
        const totalEssayScore = essayScoreValues.reduce((sum, s) => sum + (s || 0), 0);
        avgEssayScore = totalEssayScore / essayScoreValues.length;
      }
    }

    let avgLivecodeScore = 0;
    if (session.livecodeScores && livecodeQuestions.length > 0) {
      const livecodeScoreValues = Object.values(session.livecodeScores);
      if (livecodeScoreValues.length > 0) {
        const totalLivecodeScore = livecodeScoreValues.reduce((sum, s) => sum + (s || 0), 0);
        avgLivecodeScore = totalLivecodeScore / livecodeScoreValues.length;
      }
    }

    const hasMC = mcQuestionCount > 0;
    const hasEssay = essayQuestions.length > 0;
    const hasLivecode = livecodeQuestions.length > 0;

    let baseScore = 0;

    if (hasMC && hasEssay && hasLivecode) {
      baseScore = (mcScore * 0.34) + (avgEssayScore * 0.33) + (avgLivecodeScore * 0.33);
    } else if (hasMC && hasEssay) {
      baseScore = (mcScore * 0.5) + (avgEssayScore * 0.5);
    } else if (hasMC && hasLivecode) {
      baseScore = (mcScore * 0.5) + (avgLivecodeScore * 0.5);
    } else if (hasEssay && hasLivecode) {
      baseScore = (avgEssayScore * 0.5) + (avgLivecodeScore * 0.5);
    } else if (hasMC) {
      baseScore = mcScore;
    } else if (hasEssay) {
      baseScore = avgEssayScore;
    } else if (hasLivecode) {
      baseScore = avgLivecodeScore;
    }

    const finalScore = Math.max(0, baseScore - reduction);
    return finalScore.toFixed(2);
  };

  const handleOpenHistory = (session: Session) => {
    setHistorySession(session);
    setEditingAnswers({ ...(session.answers || {}) });
    setIsEditingAnswers(false);
  };

  const handleSaveEditedAnswers = async () => {
    if (!historySession) return;
    setIsSavingAnswers(true);
    try {
      const mcQuestions = questions.filter(q => q.type === 'mc');
      let correct = 0;
      mcQuestions.forEach(q => {
        if (editingAnswers[q.id] === q.correctAnswer) correct++;
      });
      const newFinalScore = mcQuestions.length > 0 ? (correct / mcQuestions.length) * 100 : 0;

      const sessionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, historySession.id);
      await updateDoc(sessionDocRef, {
        answers: editingAnswers,
        finalScore: newFinalScore,
      });

      const updatedSession = { ...historySession, answers: editingAnswers, finalScore: newFinalScore };
      setSessions(prev => prev.map(s => s.id === historySession.id ? updatedSession : s));
      setHistorySession(updatedSession);
      setIsEditingAnswers(false);
    } catch (error) {
      console.error('Error saving edited answers:', error);
      alert('Gagal menyimpan jawaban. Silakan coba lagi.');
    } finally {
      setIsSavingAnswers(false);
    }
  };

  const handleEditScore = (session: Session) => {
    setEditingScoreSession(session);
    setScoreReduction(session.scoreReduction || 0);
    setScoreError('');
  };

  const handleSaveScoreReduction = async () => {
    if (!editingScoreSession) return;
    
    setIsUpdatingScore(true);
    setScoreError('');
    
    try {
      // Validate score reduction
      if (scoreReduction < 0 || scoreReduction > 100) {
        setScoreError('Pengurangan nilai harus antara 0-100');
        setIsUpdatingScore(false);
        return;
      }
      
      // Calculate if final score would be negative
      const currentTotalScore = parseFloat(calculateTotalScore(editingScoreSession));
      const originalScore = currentTotalScore + (editingScoreSession.scoreReduction || 0);
      const newFinalScore = originalScore - scoreReduction;
      
      if (newFinalScore < 0) {
        setScoreError(`Pengurangan terlalu besar. Nilai akhir akan menjadi ${newFinalScore.toFixed(2)}. Maksimal pengurangan: ${originalScore.toFixed(2)}`);
        setIsUpdatingScore(false);
        return;
      }
      
      // Update session with score reduction
      const sessionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, editingScoreSession.id);
      await updateDoc(sessionDocRef, { 
        scoreReduction: scoreReduction 
      });
      
      // Update local state
      setSessions(prev => prev.map(session => 
        session.id === editingScoreSession.id 
          ? { ...session, scoreReduction: scoreReduction }
          : session
      ));
      
      setEditingScoreSession(null);
      setScoreReduction(0);
      alert('Pengurangan nilai berhasil disimpan!');
      
    } catch (error) {
      console.error('Error updating score reduction:', error);
      setScoreError('Gagal menyimpan pengurangan nilai. Silakan coba lagi.');
    } finally {
      setIsUpdatingScore(false);
    }
  };

  const downloadResultsPDF = () => {
    const sessionsToExport = filteredSessions;
    const pdfDoc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = pdfDoc.internal.pageSize.getWidth();

    pdfDoc.setFillColor(30, 41, 59);
    pdfDoc.rect(0, 0, pageWidth, 32, 'F');

    pdfDoc.setFontSize(16);
    pdfDoc.setTextColor(255, 255, 255);
    pdfDoc.text(`Laporan Hasil Ujian`, 14, 14);

    pdfDoc.setFontSize(10);
    pdfDoc.setTextColor(200, 210, 230);
    pdfDoc.text(`${exam.name} | Kode: ${exam.code}`, 14, 22);
    pdfDoc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 28);
    pdfDoc.text(`Total Peserta: ${sessionsToExport.length}`, pageWidth - 14, 14, { align: 'right' });

    if (searchTerm || filterKelas || filterJurusan) {
      const filters: string[] = [];
      if (searchTerm) filters.push(`Cari: "${searchTerm}"`);
      if (filterKelas) filters.push(`Kelas: ${filterKelas}`);
      if (filterJurusan) filters.push(`Jurusan: ${filterJurusan}`);
      pdfDoc.text(`Filter: ${filters.join(' | ')}`, pageWidth - 14, 22, { align: 'right' });
    }

    const tableBody = sessionsToExport.map((session, idx) => {
      const essayQ = questions.filter(q => q.type === 'essay');
      let essayVal = 'N/A';
      if (essayQ.length > 0) {
        if (!session.essayScores) {
          essayVal = 'Belum';
        } else {
          const vals = Object.values(session.essayScores);
          if (vals.length === 0) {
            essayVal = 'Belum';
          } else {
            essayVal = (vals.reduce((s, v) => s + (v || 0), 0) / vals.length).toFixed(2);
          }
        }
      }

      const lcQ = questions.filter(q => q.type === 'livecode');
      let lcVal = 'N/A';
      if (lcQ.length > 0) {
        if (!session.livecodeScores) {
          lcVal = 'Belum';
        } else {
          const vals = Object.values(session.livecodeScores);
          if (vals.length === 0) {
            lcVal = 'Belum';
          } else {
            lcVal = (vals.reduce((s, v) => s + (v || 0), 0) / vals.length).toFixed(2);
          }
        }
      }

      return [
        (idx + 1).toString(),
        session.studentInfo.name || session.studentInfo.fullName || '-',
        session.studentInfo.nim || '-',
        session.studentInfo.major || '-',
        session.studentInfo.className || '-',
        session.status || '-',
        session.violations.toString(),
        session.finalScore?.toFixed(2) ?? '-',
        essayVal,
        lcVal,
        `-${session.scoreReduction || 0}`,
        calculateTotalScore(session),
      ];
    });

    autoTable(pdfDoc, {
      startY: 36,
      head: [['No', 'Nama', 'NIM', 'Jurusan', 'Kelas', 'Status', 'Warn', 'PG', 'Essay', 'Code', 'Mines', 'Akhir']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [30, 30, 30],
      },
      alternateRowStyles: {
        fillColor: [241, 245, 249],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 22 },
        3: { cellWidth: 28 },
        4: { cellWidth: 18 },
        5: { halign: 'center', cellWidth: 22 },
        6: { halign: 'center', cellWidth: 14 },
        7: { halign: 'center', cellWidth: 16 },
        8: { halign: 'center', cellWidth: 16 },
        9: { halign: 'center', cellWidth: 16 },
        10: { halign: 'center', cellWidth: 16 },
        11: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      },
      styles: {
        lineColor: [200, 210, 220],
        lineWidth: 0.3,
        overflow: 'linebreak',
      },
      willDrawCell: (data: any) => {
        if (data.section === 'body') {
          if (data.column.index === 5) {
            const val = data.cell.raw as string;
            if (val === 'Diskualifikasi') {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            } else if (val === 'Selesai') {
              data.cell.styles.textColor = [21, 128, 61];
            } else if (val === 'Sedang Ujian') {
              data.cell.styles.textColor = [29, 78, 216];
            }
          }
          if (data.column.index === 6) {
            const num = parseInt(data.cell.raw as string);
            if (num >= 5) {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            } else if (num >= 3) {
              data.cell.styles.textColor = [194, 120, 3];
            }
          }
          if (data.column.index === 11) {
            const score = parseFloat(data.cell.raw as string);
            if (score < 50) {
              data.cell.styles.textColor = [185, 28, 28];
            } else if (score >= 80) {
              data.cell.styles.textColor = [21, 128, 61];
            }
          }
        }
      },
      didDrawPage: (data: any) => {
        const pageCount = pdfDoc.getNumberOfPages();
        pdfDoc.setFontSize(7);
        pdfDoc.setTextColor(150, 150, 150);
        pdfDoc.text(
          `Halaman ${data.pageNumber} dari ${pageCount}`,
          pageWidth / 2,
          pdfDoc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
        pdfDoc.text(
          `${exam.name} - ${exam.code}`,
          14,
          pdfDoc.internal.pageSize.getHeight() - 8
        );
      },
    });

    const filterSuffix = (searchTerm || filterKelas || filterJurusan) ? '_filtered' : '';
    pdfDoc.save(`Hasil_Ujian_${exam.code}_${new Date().toISOString().split('T')[0]}${filterSuffix}.pdf`);
  };
  if (selectedSession) {
    return (
      <EssayGradingView 
        session={selectedSession} 
        questions={questions}
        examId={exam.id}
        navigateBack={handleBackNavigation}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  if (!exam) {
    return <div className="text-center p-8">Memuat data hasil...</div>;
  }

  return (
    <div>
      <button 
        onClick={handleBackNavigation} 
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Hasil Ujian: {exam.name}</h2>
        <div className="flex space-x-3">
          <button 
            onClick={() => loadSessions(true)}
            disabled={isLoadingMore}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-blue-400 flex items-center"
          >
            {isLoadingMore ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Refreshing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Data
              </>
            )}
          </button>
          <button 
            onClick={downloadResultsPDF}
            disabled={filteredSessions.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>
      
      {/* Search and Filter Section */}
      <div className="mb-6 bg-gray-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-bold mb-4">🔍 Filter & Pencarian</h3>
        
        {/* Search Bar */}
        <div className="mb-4">
          <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-2">
            Cari Siswa (Nama, NIM, Kelas, atau Jurusan)
          </label>
          <input
            id="search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ketik nama, NIM, kelas, atau jurusan siswa..."
            className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        
        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="filterKelas" className="block text-sm font-medium text-gray-300 mb-2">
              Filter Kelas
            </label>
            <select
              id="filterKelas"
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Semua Kelas</option>
              {availableKelas.map(kelas => (
                <option key={kelas} value={kelas}>{kelas}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="filterJurusan" className="block text-sm font-medium text-gray-300 mb-2">
              Filter Jurusan
            </label>
            <select
              id="filterJurusan"
              value={filterJurusan}
              onChange={(e) => setFilterJurusan(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Semua Jurusan</option>
              {availableJurusan.map(jurusan => (
                <option key={jurusan} value={jurusan}>{jurusan}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterKelas('');
                setFilterJurusan('');
              }}
              className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg"
            >
              Reset Filter
            </button>
          </div>
        </div>
        
        {/* Filter Summary */}
        <div className="mt-4 flex justify-between items-center text-sm text-gray-400">
          <div>
            Menampilkan {filteredSessions.length} dari {sessions.length} siswa
            {hasMoreData && (
              <span className="ml-2 text-yellow-400">
                (Halaman {currentPage}, ada data lainnya)
              </span>
            )}
            {(searchTerm || filterKelas || filterJurusan) && (
              <span className="ml-2 text-blue-400">
                (dengan filter)
              </span>
            )}
          </div>
          {(searchTerm || filterKelas || filterJurusan) && (
            <div className="text-xs">
              {searchTerm && <span className="bg-blue-600 px-2 py-1 rounded mr-1">Cari: "{searchTerm}"</span>}
              {filterKelas && <span className="bg-green-600 px-2 py-1 rounded mr-1">Kelas: {filterKelas}</span>}
              {filterJurusan && <span className="bg-purple-600 px-2 py-1 rounded mr-1">Jurusan: {filterJurusan}</span>}
            </div>
          )}
        </div>
      </div>
      
      {/* Answer History Modal */}
      {historySession && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <div>
                <h3 className="text-xl font-bold">History Pengerjaan PG</h3>
                <p className="text-gray-400 text-sm mt-1">
                  {historySession.studentInfo.name || historySession.studentInfo.fullName} - {historySession.studentInfo.nim}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!isEditingAnswers ? (
                  <button
                    onClick={() => setIsEditingAnswers(true)}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold py-1.5 px-4 rounded-lg"
                  >
                    Edit Jawaban
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsEditingAnswers(false);
                        setEditingAnswers({ ...(historySession.answers || {}) });
                      }}
                      className="bg-gray-600 hover:bg-gray-500 text-white text-sm font-bold py-1.5 px-4 rounded-lg"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveEditedAnswers}
                      disabled={isSavingAnswers}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-1.5 px-4 rounded-lg disabled:bg-green-400"
                    >
                      {isSavingAnswers ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setHistorySession(null);
                    setIsEditingAnswers(false);
                  }}
                  className="text-gray-400 hover:text-white text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            {isEditingAnswers && (
              <div className="px-6 py-3 bg-orange-900/30 border-b border-orange-700 text-orange-300 text-sm">
                Mode edit aktif — pilih jawaban yang ingin diubah. Nilai PG akan dihitung ulang otomatis setelah disimpan.
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const mcQuestions = questions.filter(q => q.type === 'mc');
                const activeAnswers = isEditingAnswers ? editingAnswers : (historySession.answers || {});

                const correctAnswers: Question[] = [];
                const wrongAnswers: Question[] = [];
                const unanswered: Question[] = [];

                mcQuestions.forEach(q => {
                  const studentAnswer = activeAnswers[q.id];
                  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') {
                    unanswered.push(q);
                  } else if (studentAnswer === q.correctAnswer) {
                    correctAnswers.push(q);
                  } else {
                    wrongAnswers.push(q);
                  }
                });

                const renderOptions = (q: Question) => {
                  if (!isEditingAnswers) return null;
                  const currentAnswer = editingAnswers[q.id];
                  return (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-gray-400 mb-2">Ubah jawaban:</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            const updated = { ...editingAnswers };
                            delete updated[q.id];
                            setEditingAnswers(updated);
                          }}
                          className={`px-3 py-1 rounded text-xs font-bold border ${
                            currentAnswer === undefined || currentAnswer === null || currentAnswer === ''
                              ? 'bg-gray-500 border-gray-400 text-white'
                              : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Kosong
                        </button>
                        {q.options?.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => setEditingAnswers(prev => ({ ...prev, [q.id]: idx }))}
                            className={`px-3 py-1 rounded text-xs font-bold border ${
                              currentAnswer === idx
                                ? idx === q.correctAnswer
                                  ? 'bg-green-600 border-green-400 text-white'
                                  : 'bg-red-600 border-red-400 text-white'
                                : idx === q.correctAnswer
                                  ? 'bg-gray-700 border-green-600 text-green-300 hover:bg-green-900/40'
                                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}{idx === q.correctAnswer ? ' ✓' : ''}
                            {opt ? ` - ${opt.length > 30 ? opt.substring(0, 30) + '…' : opt}` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-green-900 border border-green-500 p-4 rounded-lg">
                        <div className="text-3xl font-bold text-green-400">{correctAnswers.length}</div>
                        <div className="text-green-300 text-sm">Benar</div>
                      </div>
                      <div className="bg-red-900 border border-red-500 p-4 rounded-lg">
                        <div className="text-3xl font-bold text-red-400">{wrongAnswers.length}</div>
                        <div className="text-red-300 text-sm">Salah</div>
                      </div>
                      <div className="bg-gray-700 border border-gray-500 p-4 rounded-lg">
                        <div className="text-3xl font-bold text-gray-400">{unanswered.length}</div>
                        <div className="text-gray-300 text-sm">Tidak Dijawab</div>
                      </div>
                    </div>

                    {isEditingAnswers && (
                      <div className="bg-gray-700 border border-gray-500 p-3 rounded-lg text-center">
                        <span className="text-gray-300 text-sm">Preview nilai PG setelah edit: </span>
                        <span className="text-white font-bold text-lg ml-2">
                          {mcQuestions.length > 0
                            ? ((correctAnswers.length / mcQuestions.length) * 100).toFixed(2)
                            : '0.00'}
                        </span>
                      </div>
                    )}

                    {/* All MC questions in edit mode */}
                    {isEditingAnswers && (
                      <div>
                        <h4 className="text-lg font-bold text-orange-400 mb-3">Semua Soal PG ({mcQuestions.length})</h4>
                        <div className="space-y-3">
                          {mcQuestions.map(q => {
                            const qIndex = questions.findIndex(question => question.id === q.id);
                            const currentAnswer = editingAnswers[q.id];
                            const isEmpty = currentAnswer === undefined || currentAnswer === null || currentAnswer === '';
                            const isCorrect = !isEmpty && currentAnswer === q.correctAnswer;
                            return (
                              <div key={q.id} className={`border p-4 rounded-lg ${
                                isEmpty ? 'bg-gray-700/50 border-gray-600'
                                : isCorrect ? 'bg-green-900/30 border-green-700'
                                : 'bg-red-900/30 border-red-700'
                              }`}>
                                <div className="flex items-start gap-3">
                                  <span className={`text-white text-sm font-bold px-2 py-1 rounded ${
                                    isEmpty ? 'bg-gray-600' : isCorrect ? 'bg-green-600' : 'bg-red-600'
                                  }`}>
                                    #{qIndex + 1}
                                  </span>
                                  <div className="flex-1">
                                    <p className="font-medium mb-1">{q.text || '(Soal bergambar)'}</p>
                                    {q.image && <img src={q.image} alt="Soal" className="max-h-24 rounded mb-2" />}
                                    <div className="text-sm">
                                      {isEmpty ? (
                                        <span className="text-gray-400">Belum dijawab</span>
                                      ) : (
                                        <span className={isCorrect ? 'text-green-300' : 'text-red-300'}>
                                          Jawaban: <span className="font-bold">{String.fromCharCode(65 + (currentAnswer as number))}</span>
                                          {q.options?.[currentAnswer as number] && ` - ${q.options[currentAnswer as number]}`}
                                        </span>
                                      )}
                                    </div>
                                    {renderOptions(q)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* View mode: grouped by correct/wrong/unanswered */}
                    {!isEditingAnswers && (
                      <>
                        {correctAnswers.length > 0 && (
                          <div>
                            <h4 className="text-lg font-bold text-green-400 mb-3 flex items-center gap-2">
                              <span className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-sm">V</span>
                              Jawaban Benar ({correctAnswers.length})
                            </h4>
                            <div className="space-y-3">
                              {correctAnswers.map(q => {
                                const qIndex = questions.findIndex(question => question.id === q.id);
                                const studentAnswer = activeAnswers[q.id] as number;
                                return (
                                  <div key={q.id} className="bg-green-900/30 border border-green-700 p-4 rounded-lg">
                                    <div className="flex items-start gap-3">
                                      <span className="bg-green-600 text-white text-sm font-bold px-2 py-1 rounded">
                                        #{qIndex + 1}
                                      </span>
                                      <div className="flex-1">
                                        <p className="font-medium mb-2">{q.text || '(Soal bergambar)'}</p>
                                        {q.image && <img src={q.image} alt="Soal" className="max-h-24 rounded mb-2" />}
                                        <div className="text-sm text-green-300">
                                          Jawaban: <span className="font-bold">{String.fromCharCode(65 + studentAnswer)}</span>
                                          {q.options?.[studentAnswer] && ` - ${q.options[studentAnswer]}`}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {wrongAnswers.length > 0 && (
                          <div>
                            <h4 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
                              <span className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-sm">X</span>
                              Jawaban Salah ({wrongAnswers.length})
                            </h4>
                            <div className="space-y-3">
                              {wrongAnswers.map(q => {
                                const qIndex = questions.findIndex(question => question.id === q.id);
                                const studentAnswer = activeAnswers[q.id] as number;
                                return (
                                  <div key={q.id} className="bg-red-900/30 border border-red-700 p-4 rounded-lg">
                                    <div className="flex items-start gap-3">
                                      <span className="bg-red-600 text-white text-sm font-bold px-2 py-1 rounded">
                                        #{qIndex + 1}
                                      </span>
                                      <div className="flex-1">
                                        <p className="font-medium mb-2">{q.text || '(Soal bergambar)'}</p>
                                        {q.image && <img src={q.image} alt="Soal" className="max-h-24 rounded mb-2" />}
                                        <div className="text-sm space-y-1">
                                          <div className="text-red-300">
                                            Jawaban Siswa: <span className="font-bold">{String.fromCharCode(65 + studentAnswer)}</span>
                                            {q.options?.[studentAnswer] && ` - ${q.options[studentAnswer]}`}
                                          </div>
                                          <div className="text-green-300">
                                            Jawaban Benar: <span className="font-bold">{String.fromCharCode(65 + (q.correctAnswer || 0))}</span>
                                            {q.options?.[q.correctAnswer || 0] && ` - ${q.options[q.correctAnswer || 0]}`}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {unanswered.length > 0 && (
                          <div>
                            <h4 className="text-lg font-bold text-gray-400 mb-3 flex items-center gap-2">
                              <span className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-sm">-</span>
                              Tidak Dijawab ({unanswered.length})
                            </h4>
                            <div className="space-y-3">
                              {unanswered.map(q => {
                                const qIndex = questions.findIndex(question => question.id === q.id);
                                return (
                                  <div key={q.id} className="bg-gray-700/50 border border-gray-600 p-4 rounded-lg">
                                    <div className="flex items-start gap-3">
                                      <span className="bg-gray-600 text-white text-sm font-bold px-2 py-1 rounded">
                                        #{qIndex + 1}
                                      </span>
                                      <div className="flex-1">
                                        <p className="font-medium mb-2">{q.text || '(Soal bergambar)'}</p>
                                        {q.image && <img src={q.image} alt="Soal" className="max-h-24 rounded mb-2" />}
                                        <div className="text-sm text-gray-400">
                                          Jawaban Benar: <span className="font-bold text-green-400">{String.fromCharCode(65 + (q.correctAnswer || 0))}</span>
                                          {q.options?.[q.correctAnswer || 0] && ` - ${q.options[q.correctAnswer || 0]}`}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {mcQuestions.length === 0 && (
                          <div className="text-center text-gray-400 py-8">
                            Tidak ada soal pilihan ganda dalam ujian ini.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => {
                  setHistorySession(null);
                  setIsEditingAnswers(false);
                }}
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score Reduction Modal */}
      {editingScoreSession && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Edit Pengurangan Nilai</h3>
              <button
                onClick={() => {
                  setEditingScoreSession(null);
                  setScoreReduction(0);
                  setScoreError('');
                }}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-700 p-3 rounded-lg">
                <h4 className="font-bold text-lg text-white text-center">{editingScoreSession.studentInfo.name || editingScoreSession.studentInfo.fullName || 'N/A'}</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-blue-900 border border-blue-500 p-3 rounded-lg">
                  <div className="text-blue-300 font-bold mb-1">Nilai PG</div>
                  <div className="text-white font-bold text-lg">{editingScoreSession.finalScore?.toFixed(2) || 'N/A'}</div>
                </div>
                <div className="bg-purple-900 border border-purple-500 p-3 rounded-lg">
                  <div className="text-purple-300 font-bold mb-1">Nilai Essay</div>
                  <div className="text-white font-bold text-lg">
                    {(() => {
                      const essayQuestions = questions.filter(q => q.type === 'essay');
                      if (essayQuestions.length > 0) {
                        if (editingScoreSession.essayScores) {
                          const essayScoreValues = Object.values(editingScoreSession.essayScores);
                          if (essayScoreValues.length > 0) {
                            const totalEssayScore = essayScoreValues.reduce((sum, s) => sum + (s || 0), 0);
                            const avgEssayScore = totalEssayScore / essayScoreValues.length;
                            return avgEssayScore.toFixed(2);
                          }
                        }
                        return 'Belum dinilai';
                      }
                      return 'N/A';
                    })()}
                  </div>
                </div>
                <div className="bg-red-900 border border-red-500 p-3 rounded-lg">
                  <div className="text-red-300 font-bold mb-1">Pengurangan</div>
                  <div className="text-white font-bold text-lg">-{editingScoreSession.scoreReduction || 0}</div>
                </div>
                <div className="bg-green-900 border border-green-500 p-3 rounded-lg">
                  <div className="text-green-300 font-bold mb-1">Nilai Akhir</div>
                  <div className="text-white font-bold text-lg">{calculateTotalScore(editingScoreSession)}</div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Pengurangan Nilai (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scoreReduction}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setScoreReduction(Math.max(0, Math.min(100, value)));
                    setScoreError('');
                  }}
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Masukkan nilai pengurangan"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Nilai akan dikurangi dari total nilai akhir
                </p>
              </div>
              
              {/* Preview New Score */}
              {scoreReduction > 0 && (
                <div className="bg-yellow-900 border border-yellow-500 p-3 rounded-lg text-center">
                  <div className="text-yellow-300 font-bold mb-2">🔍 Preview Nilai Baru</div>
                  <div className="text-2xl font-bold text-green-400">
                    {Math.max(0, (parseFloat(calculateTotalScore(editingScoreSession)) + (editingScoreSession.scoreReduction || 0)) - scoreReduction).toFixed(2)}
                  </div>
                  <div className="text-xs text-yellow-200 mt-1">
                    {(parseFloat(calculateTotalScore(editingScoreSession)) + (editingScoreSession.scoreReduction || 0)).toFixed(2)} - {scoreReduction} = Nilai Baru
                  </div>
                </div>
              )}
              
              {scoreError && (
                <div className="bg-red-900 border border-red-500 p-3 rounded-md">
                  <p className="text-red-200 text-sm">{scoreError}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setEditingScoreSession(null);
                    setScoreReduction(0);
                    setScoreError('');
                  }}
                  className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveScoreReduction}
                  disabled={isUpdatingScore}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-orange-400"
                >
                  {isUpdatingScore ? 'Menyimpan...' : 'Simpan Pengurangan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-6 bg-gray-800 rounded-lg shadow-xl overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-700">
            <tr>
              <th className="p-4">Nama Lengkap</th>
              <th className="p-4">NIM</th>
              <th className="p-4">Program Studi</th>
              <th className="p-4">Kelas</th>
              <th className="p-4">Status</th>
              <th className="p-4">Pelanggaran</th>
              <th className="p-4">Nilai PG</th>
              <th className="p-4">Nilai Essay</th>
              <th className="p-4">Nilai Live Code</th>
              <th className="p-4">Nilai Akhir</th>
              <th className="p-4">Pengurangan</th>
              <th className="p-4">History</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center p-8 text-gray-400">
                  {sessions.length === 0 
                    ? "Belum ada siswa yang menyelesaikan ujian."
                    : "Tidak ada siswa yang sesuai dengan filter."
                  }
                </td>
              </tr>
            ) : (
              filteredSessions.map(session => (
                <tr key={session.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="p-4 font-semibold">{session.studentInfo.name || session.studentInfo.fullName || 'N/A'}</td>
                  <td className="p-4 text-gray-300">{session.studentInfo.nim}</td>
                  <td className="p-4 text-gray-300">{session.studentInfo.major}</td>
                  <td className="p-4 text-gray-300">{session.studentInfo.className}</td>
                  <td className="p-4">{session.status}</td>
                  <td className="p-4">{session.violations}</td>
                  <td className="p-4">{session.finalScore?.toFixed(2) ?? 'N/A'}</td>
                  <td className="p-4">
                    {(() => {
                      const essayQuestions = questions.filter(q => q.type === 'essay');
                      if (essayQuestions.length === 0) return 'N/A';
                      
                      if (!session.essayScores) return 'Belum dinilai';
                      
                      const essayScoreValues = Object.values(session.essayScores);
                      if (essayScoreValues.length === 0) return 'Belum dinilai';
                      
                      const totalEssayScore = essayScoreValues.reduce((sum, s) => sum + (s || 0), 0);
                      const avgEssayScore = totalEssayScore / essayScoreValues.length;
                      return avgEssayScore.toFixed(2);
                    })()}
                  </td>
                  <td className="p-4">
                    {(() => {
                      const livecodeQuestions = questions.filter(q => q.type === 'livecode');
                      if (livecodeQuestions.length === 0) return 'N/A';

                      if (!session.livecodeScores) return 'Belum dinilai';

                      const livecodeScoreValues = Object.values(session.livecodeScores);
                      if (livecodeScoreValues.length === 0) return 'Belum dinilai';

                      const totalLivecodeScore = livecodeScoreValues.reduce((sum, s) => sum + (s || 0), 0);
                      const avgLivecodeScore = totalLivecodeScore / livecodeScoreValues.length;
                      return avgLivecodeScore.toFixed(2);
                    })()}
                  </td>
                  <td className="p-4 font-bold">{calculateTotalScore(session)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded ${
                      (session.scoreReduction || 0) > 0
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-600 text-gray-300'
                    }`}>
                      -{session.scoreReduction || 0}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleOpenHistory(session)}
                      disabled={questions.filter(q => q.type === 'mc').length === 0}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-1 px-2 rounded disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                      Lihat
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => setSelectedSession(session)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-2 rounded"
                        disabled={questions.filter(q => q.type === 'essay' || q.type === 'livecode').length === 0}
                      >
                        Nilai Manual
                      </button>
                      <button
                        onClick={() => handleEditScore(session)}
                        className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-1 px-2 rounded"
                      >
                        Edit Nilai
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        {hasMoreData && (
          <div className="p-6 bg-gray-700 border-t border-gray-600">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-400">
                Menampilkan {sessions.length} siswa (Halaman {currentPage})
                <button
                  onClick={() => loadSessions(true)}
                  className="ml-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded"
                >
                  🔄 Refresh Data
                </button>
              </div>
              <button
                onClick={() => loadSessions(false)}
                disabled={isLoadingMore}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-indigo-400 flex items-center"
              >
                {isLoadingMore ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Memuat...
                  </>
                ) : (
                  <>
                    📄 Muat Lebih Banyak ({SESSIONS_PER_PAGE} siswa)
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherResultsDashboard;