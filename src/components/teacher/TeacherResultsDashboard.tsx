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
  cpp: 'C++',
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
  const [scoreError, setScoreError] = useState('');
  const [historySession, setHistorySession] = useState<Session | null>(null);
  const [editModalTab, setEditModalTab] = useState<'pg' | 'essay' | 'status'>('pg');
  const [editingAnswers, setEditingAnswers] = useState<{ [key: string]: any }>({});
  const [editingEssayAnswers, setEditingEssayAnswers] = useState<{ [key: string]: string }>({});
  const [editingStatus, setEditingStatus] = useState<string>('finished');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSuccess, setEditSuccess] = useState('');

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

  const handleEditScore = (session: Session) => {
    setEditingScoreSession(session);
    setScoreReduction(session.scoreReduction || 0);
    setScoreError('');
    setEditModalTab('pg');
    setEditSuccess('');

    const pgAnswers: { [key: string]: any } = {};
    const essayAnswers: { [key: string]: string } = {};
    questions.forEach(q => {
      if (q.type === 'mc') {
        pgAnswers[q.id] = session.answers?.[q.id] ?? null;
      } else if (q.type === 'essay') {
        essayAnswers[q.id] = (session.answers?.[q.id] as string) || '';
      }
    });
    setEditingAnswers(pgAnswers);
    setEditingEssayAnswers(essayAnswers);
    setEditingStatus(session.status || 'finished');
  };

  const recalcMCScore = (answers: { [key: string]: any }) => {
    const mcQuestions = questions.filter(q => q.type === 'mc');
    if (mcQuestions.length === 0) return 0;
    let correct = 0;
    mcQuestions.forEach(q => {
      if (answers[q.id] !== null && answers[q.id] !== undefined && answers[q.id] === q.correctAnswer) {
        correct++;
      }
    });
    return (correct / mcQuestions.length) * 100;
  };

  const handleSaveAllEdits = async () => {
    if (!editingScoreSession) return;
    setIsSavingEdit(true);
    setScoreError('');
    setEditSuccess('');

    try {
      if (scoreReduction < 0 || scoreReduction > 100) {
        setScoreError('Pengurangan nilai harus antara 0-100');
        setIsSavingEdit(false);
        return;
      }

      const newMCScore = recalcMCScore(editingAnswers);

      const mergedAnswers = { ...(editingScoreSession.answers || {}) };
      questions.forEach(q => {
        if (q.type === 'mc') {
          if (editingAnswers[q.id] !== null && editingAnswers[q.id] !== undefined) {
            mergedAnswers[q.id] = editingAnswers[q.id];
          } else {
            delete mergedAnswers[q.id];
          }
        } else if (q.type === 'essay') {
          mergedAnswers[q.id] = editingEssayAnswers[q.id] || '';
        }
      });

      const sessionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/sessions`, editingScoreSession.id);
      await updateDoc(sessionDocRef, {
        scoreReduction,
        finalScore: newMCScore,
        answers: mergedAnswers,
        status: editingStatus,
      });

      setSessions(prev => prev.map(s =>
        s.id === editingScoreSession.id
          ? { ...s, scoreReduction, finalScore: newMCScore, answers: mergedAnswers, status: editingStatus }
          : s
      ));

      setEditSuccess('Perubahan berhasil disimpan!');
    } catch (error) {
      console.error('Error saving edits:', error);
      setScoreError('Gagal menyimpan perubahan. Silakan coba lagi.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveScoreReduction = handleSaveAllEdits;

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
      {historySession && (() => {
        const liveHistorySession = sessions.find(s => s.id === historySession.id) || historySession;
        return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <div>
                <h3 className="text-xl font-bold">History Pengerjaan</h3>
                <p className="text-gray-400 text-sm mt-1">
                  {liveHistorySession.studentInfo.name || liveHistorySession.studentInfo.fullName} - {liveHistorySession.studentInfo.nim}
                </p>
              </div>
              <button
                onClick={() => setHistorySession(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const mcQuestions = questions.filter(q => q.type === 'mc');
                const correctAnswers: Question[] = [];
                const wrongAnswers: Question[] = [];
                const unanswered: Question[] = [];

                mcQuestions.forEach(q => {
                  const studentAnswer = liveHistorySession.answers?.[q.id];
                  if (studentAnswer === undefined || studentAnswer === null) {
                    unanswered.push(q);
                  } else if (studentAnswer === q.correctAnswer) {
                    correctAnswers.push(q);
                  } else {
                    wrongAnswers.push(q);
                  }
                });

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

                    {correctAnswers.length > 0 && (
                      <div>
                        <h4 className="text-lg font-bold text-green-400 mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-sm">V</span>
                          Jawaban Benar ({correctAnswers.length})
                        </h4>
                        <div className="space-y-3">
                          {correctAnswers.map((q) => {
                            const qIndex = questions.findIndex(question => question.id === q.id);
                            const studentAnswer = liveHistorySession.answers?.[q.id] as number;
                            return (
                              <div key={q.id} className="bg-green-900/30 border border-green-700 p-4 rounded-lg">
                                <div className="flex items-start gap-3">
                                  <span className="bg-green-600 text-white text-sm font-bold px-2 py-1 rounded">
                                    #{qIndex + 1}
                                  </span>
                                  <div className="flex-1">
                                    <p className="font-medium mb-2">{q.text || '(Soal bergambar)'}</p>
                                    {q.image && (
                                      <img src={q.image} alt="Soal" className="max-h-24 rounded mb-2" />
                                    )}
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
                          {wrongAnswers.map((q) => {
                            const qIndex = questions.findIndex(question => question.id === q.id);
                            const studentAnswer = liveHistorySession.answers?.[q.id] as number;
                            return (
                              <div key={q.id} className="bg-red-900/30 border border-red-700 p-4 rounded-lg">
                                <div className="flex items-start gap-3">
                                  <span className="bg-red-600 text-white text-sm font-bold px-2 py-1 rounded">
                                    #{qIndex + 1}
                                  </span>
                                  <div className="flex-1">
                                    <p className="font-medium mb-2">{q.text || '(Soal bergambar)'}</p>
                                    {q.image && (
                                      <img src={q.image} alt="Soal" className="max-h-24 rounded mb-2" />
                                    )}
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
                          {unanswered.map((q) => {
                            const qIndex = questions.findIndex(question => question.id === q.id);
                            return (
                              <div key={q.id} className="bg-gray-700/50 border border-gray-600 p-4 rounded-lg">
                                <div className="flex items-start gap-3">
                                  <span className="bg-gray-600 text-white text-sm font-bold px-2 py-1 rounded">
                                    #{qIndex + 1}
                                  </span>
                                  <div className="flex-1">
                                    <p className="font-medium mb-2">{q.text || '(Soal bergambar)'}</p>
                                    {q.image && (
                                      <img src={q.image} alt="Soal" className="max-h-24 rounded mb-2" />
                                    )}
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
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => setHistorySession(null)}
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Comprehensive Edit Modal */}
      {editingScoreSession && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[92vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-gray-700 bg-gray-750">
              <div>
                <h3 className="text-xl font-bold">Edit Data Ujian</h3>
                <p className="text-gray-400 text-sm mt-0.5">
                  {editingScoreSession.studentInfo.name || editingScoreSession.studentInfo.fullName} &mdash; {editingScoreSession.studentInfo.nim}
                </p>
              </div>
              <button
                onClick={() => { setEditingScoreSession(null); setScoreError(''); setEditSuccess(''); }}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700 bg-gray-800">
              {[
                { key: 'pg', label: 'Jawaban PG' },
                { key: 'essay', label: 'Jawaban Essay' },
                { key: 'status', label: 'Status & Nilai' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setEditModalTab(tab.key as any)}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                    editModalTab === tab.key
                      ? 'border-b-2 border-blue-400 text-blue-300'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5">

              {/* PG Answers Tab */}
              {editModalTab === 'pg' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">Ubah jawaban pilihan ganda. Nilai PG akan dihitung ulang otomatis.</p>
                  {questions.filter(q => q.type === 'mc').length === 0 && (
                    <p className="text-center text-gray-500 py-8">Tidak ada soal pilihan ganda.</p>
                  )}
                  {questions.filter(q => q.type === 'mc').map((q) => {
                    const qIndex = questions.findIndex(x => x.id === q.id);
                    const currentVal = editingAnswers[q.id];
                    return (
                      <div key={q.id} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-3">
                          <span className="bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded shrink-0">#{qIndex + 1}</span>
                          <p className="text-sm font-medium">{q.text || '(Soal bergambar)'}</p>
                        </div>
                        {q.image && <img src={q.image} alt="Soal" className="max-h-20 rounded mb-3 ml-8" />}
                        <div className="grid grid-cols-2 gap-2 ml-8">
                          {(q.options || []).map((opt, i) => {
                            const isCorrect = q.correctAnswer === i;
                            const isSelected = currentVal === i;
                            return (
                              <button
                                key={i}
                                onClick={() => setEditingAnswers(prev => ({ ...prev, [q.id]: i }))}
                                className={`text-left text-xs p-2 rounded border transition-all ${
                                  isSelected && isCorrect
                                    ? 'border-green-500 bg-green-900/50 text-green-200'
                                    : isSelected && !isCorrect
                                    ? 'border-red-500 bg-red-900/50 text-red-200'
                                    : isCorrect
                                    ? 'border-green-700 bg-green-900/20 text-green-400'
                                    : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400'
                                }`}
                              >
                                <span className="font-bold mr-1">{String.fromCharCode(65 + i)}.</span>
                                {opt}
                                {isCorrect && <span className="ml-1 text-green-400">(kunci)</span>}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setEditingAnswers(prev => ({ ...prev, [q.id]: null }))}
                            className={`text-xs p-2 rounded border col-span-2 transition-all ${
                              currentVal === null || currentVal === undefined
                                ? 'border-gray-400 bg-gray-600 text-white'
                                : 'border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-500'
                            }`}
                          >
                            Kosongkan (tidak dijawab)
                          </button>
                        </div>
                        <div className="ml-8 mt-2 text-xs">
                          {currentVal !== null && currentVal !== undefined ? (
                            currentVal === q.correctAnswer
                              ? <span className="text-green-400">Benar</span>
                              : <span className="text-red-400">Salah (kunci: {String.fromCharCode(65 + (q.correctAnswer ?? 0))})</span>
                          ) : (
                            <span className="text-gray-500">Tidak dijawab</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {questions.filter(q => q.type === 'mc').length > 0 && (
                    <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-3 text-center">
                      <span className="text-blue-300 text-sm font-semibold">
                        Preview Nilai PG: {recalcMCScore(editingAnswers).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Essay Answers Tab */}
              {editModalTab === 'essay' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">Edit jawaban essay siswa. Perubahan akan tersimpan ke database.</p>
                  {questions.filter(q => q.type === 'essay').length === 0 && (
                    <p className="text-center text-gray-500 py-8">Tidak ada soal essay.</p>
                  )}
                  {questions.filter(q => q.type === 'essay').map((q) => {
                    const qIndex = questions.findIndex(x => x.id === q.id);
                    return (
                      <div key={q.id} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-3">
                          <span className="bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded shrink-0">#{qIndex + 1}</span>
                          <p className="text-sm font-medium">{q.text || '(Soal bergambar)'}</p>
                        </div>
                        {q.image && <img src={q.image} alt="Soal" className="max-h-20 rounded mb-3 ml-8" />}
                        <textarea
                          value={editingEssayAnswers[q.id] || ''}
                          onChange={e => setEditingEssayAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          rows={4}
                          className="w-full p-3 bg-gray-800 rounded border border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                          placeholder="Jawaban essay siswa..."
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Status & Score Reduction Tab */}
              {editModalTab === 'status' && (
                <div className="space-y-5">
                  {/* Status */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Status Ujian</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'finished', label: 'Selesai', color: 'green' },
                        { value: 'started', label: 'Sedang Ujian', color: 'blue' },
                        { value: 'disqualified', label: 'Diskualifikasi', color: 'red' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setEditingStatus(opt.value)}
                          className={`py-3 px-4 rounded-lg border-2 text-sm font-bold transition-all ${
                            editingStatus === opt.value
                              ? opt.color === 'green'
                                ? 'border-green-500 bg-green-900/50 text-green-200'
                                : opt.color === 'blue'
                                ? 'border-blue-500 bg-blue-900/50 text-blue-200'
                                : 'border-red-500 bg-red-900/50 text-red-200'
                              : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Score Reduction */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Pengurangan Nilai (0–100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoreReduction}
                      onChange={e => {
                        setScoreReduction(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)));
                        setScoreError('');
                      }}
                      className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Dikurangi dari total nilai akhir.</p>
                  </div>

                  {/* Score Summary */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-blue-900/40 border border-blue-700 p-3 rounded-lg">
                      <div className="text-blue-300 text-xs font-bold mb-1">Nilai PG (setelah edit)</div>
                      <div className="text-white font-bold text-lg">{recalcMCScore(editingAnswers).toFixed(2)}</div>
                    </div>
                    <div className="bg-red-900/40 border border-red-700 p-3 rounded-lg">
                      <div className="text-red-300 text-xs font-bold mb-1">Pengurangan</div>
                      <div className="text-white font-bold text-lg">-{scoreReduction}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-700 bg-gray-800">
              {scoreError && (
                <div className="mb-3 bg-red-900/50 border border-red-600 rounded-lg p-3 text-sm text-red-300">{scoreError}</div>
              )}
              {editSuccess && (
                <div className="mb-3 bg-green-900/50 border border-green-600 rounded-lg p-3 text-sm text-green-300">{editSuccess}</div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setEditingScoreSession(null); setScoreError(''); setEditSuccess(''); }}
                  className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-5 rounded-lg"
                >
                  Tutup
                </button>
                <button
                  onClick={handleSaveAllEdits}
                  disabled={isSavingEdit}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg disabled:opacity-60"
                >
                  {isSavingEdit ? 'Menyimpan...' : 'Simpan Semua Perubahan'}
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
                      onClick={() => setHistorySession(session)}
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