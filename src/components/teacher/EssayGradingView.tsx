import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';

const LANGUAGE_LABELS: Record<string, string> = {
  html: 'HTML',
  javascript: 'JavaScript',
  php: 'PHP',
  cpp: 'C++',
  python: 'Python'
};

interface Question {
  id: string;
  text: string;
  type: 'mc' | 'essay' | 'livecode';
  language?: string;
  image?: string | null;
}

interface Session {
  id: string;
  studentInfo: {
    name: string;
    fullName?: string;
  };
  answers: { [key: string]: any };
  essayScores?: { [key: string]: number };
  livecodeScores?: { [key: string]: number };
}

interface EssayGradingViewProps {
  session: Session;
  questions: Question[];
  examId: string;
  navigateBack: () => void;
  onBack: () => void;
}

const EssayGradingView: React.FC<EssayGradingViewProps> = ({ session, questions, examId, navigateBack, onBack }) => {
  const essayQuestions = questions.filter(q => q.type === 'essay');
  const livecodeQuestions = questions.filter(q => q.type === 'livecode');
  const [essayScores, setEssayScores] = useState<{ [key: string]: number }>(session.essayScores || {});
  const [livecodeScores, setLivecodeScores] = useState<{ [key: string]: number }>(session.livecodeScores || {});
  const [isSaving, setIsSaving] = useState(false);
  const [codeOutputs, setCodeOutputs] = useState<{ [key: string]: { output: string; error: boolean } }>({});
  const [runningCode, setRunningCode] = useState<{ [key: string]: boolean }>({});

  const handleEssayScoreChange = (questionId: string, score: string) => {
    const newScores = { ...essayScores };
    newScores[questionId] = parseInt(score, 10) || 0;
    setEssayScores(newScores);
  };

  const handleLivecodeScoreChange = (questionId: string, score: string) => {
    const newScores = { ...livecodeScores };
    newScores[questionId] = parseInt(score, 10) || 0;
    setLivecodeScores(newScores);
  };

  const runStudentCode = async (questionId: string, language: string) => {
    const code = session.answers[questionId] || '';
    if (!code.trim()) {
      setCodeOutputs(prev => ({ ...prev, [questionId]: { output: 'Error: Kode kosong!', error: true } }));
      return;
    }

    setRunningCode(prev => ({ ...prev, [questionId]: true }));
    setCodeOutputs(prev => ({ ...prev, [questionId]: { output: 'Running...', error: false } }));

    try {
      let output = '';
      let hasError = false;

      if (language === 'javascript') {
        try {
          const logs: string[] = [];
          const originalLog = console.log;
          console.log = (...args) => {
            logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
          };

          const result = new Function(code)();
          console.log = originalLog;

          if (logs.length > 0) {
            output = logs.join('\n');
          }
          if (result !== undefined) {
            output += (output ? '\n' : '') + 'Return: ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
          }
          if (!output) {
            output = '(No output)';
          }
        } catch (e: any) {
          output = 'Error: ' + e.message;
          hasError = true;
        }
      } else if (language === 'html') {
        output = '[HTML Preview]\n' + code.substring(0, 1000) + (code.length > 1000 ? '...' : '');
      } else if (language === 'python' || language === 'php' || language === 'cpp') {
        output = `[${LANGUAGE_LABELS[language]}]\nKode tidak dapat dijalankan langsung di browser.\n\nKode siswa:\n${code}`;
      } else {
        output = 'Bahasa pemrograman tidak didukung untuk eksekusi langsung.';
        hasError = true;
      }

      setCodeOutputs(prev => ({ ...prev, [questionId]: { output, error: hasError } }));
    } catch (e: any) {
      setCodeOutputs(prev => ({ ...prev, [questionId]: { output: 'Error: ' + e.message, error: true } }));
    } finally {
      setRunningCode(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleSaveAllScores = async () => {
    setIsSaving(true);
    const sessionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${examId}/sessions`, session.id);

    try {
      const updateData: any = {};
      if (essayQuestions.length > 0) {
        updateData.essayScores = essayScores;
      }
      if (livecodeQuestions.length > 0) {
        updateData.livecodeScores = livecodeScores;
      }

      await updateDoc(sessionDocRef, updateData);
      alert("Semua nilai berhasil disimpan!");
      onBack();
    } catch (error) {
      console.error("Gagal menyimpan nilai:", error);
      alert("Gagal menyimpan nilai. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  const studentName = session.studentInfo.name || session.studentInfo.fullName || 'N/A';

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>

      <h3 className="text-2xl font-bold">Penilaian Manual: {studentName}</h3>
      <p className="text-gray-400 mt-1">
        Esai: {essayQuestions.length} soal | Live Code: {livecodeQuestions.length} soal
      </p>

      <div className="mt-6 space-y-6">
        {essayQuestions.length > 0 && (
          <div>
            <h4 className="text-xl font-bold text-blue-400 mb-4">Soal Esai</h4>
            {essayQuestions.map((q, idx) => {
              const qIndex = questions.findIndex(question => question.id === q.id);
              return (
                <div key={q.id} className="bg-gray-800 p-6 rounded-lg mb-4">
                  <p className="font-semibold">
                    <span className="text-blue-400">#{qIndex + 1}</span> {q.text || '(Soal bergambar)'}
                  </p>
                  {q.image && (
                    <img src={q.image} alt="Soal" className="max-h-40 mt-2 rounded" />
                  )}
                  <div className="mt-3 p-4 bg-gray-900 rounded-md">
                    <p className="text-sm text-gray-400 mb-1">Jawaban Siswa:</p>
                    <p className="whitespace-pre-wrap">
                      {session.answers[q.id] || '(Tidak dijawab)'}
                    </p>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300">
                      Nilai Esai (0-100)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={essayScores[q.id] || ''}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (isNaN(value) || value < 0 || value > 100) {
                          if (e.target.value === '') {
                            handleEssayScoreChange(q.id, '');
                          }
                          return;
                        }
                        handleEssayScoreChange(q.id, e.target.value);
                      }}
                      className="p-2 bg-gray-700 rounded-md mt-1 w-32"
                      placeholder="0-100"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {livecodeQuestions.length > 0 && (
          <div>
            <h4 className="text-xl font-bold text-teal-400 mb-4">Soal Live Code</h4>
            {livecodeQuestions.map((q, idx) => {
              const qIndex = questions.findIndex(question => question.id === q.id);
              return (
                <div key={q.id} className="bg-gray-800 p-6 rounded-lg mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <p className="font-semibold">
                      <span className="text-teal-400">#{qIndex + 1}</span> {q.text || '(Soal bergambar)'}
                    </p>
                    <span className="text-xs bg-teal-600 text-white px-2 py-1 rounded">
                      {LANGUAGE_LABELS[q.language || 'javascript']}
                    </span>
                  </div>
                  {q.image && (
                    <img src={q.image} alt="Soal" className="max-h-40 mt-2 rounded" />
                  )}

                  <div className="mt-3">
                    <p className="text-sm text-gray-400 mb-1">Kode Siswa:</p>
                    {session.answers[q.id] ? (
                      <pre className="p-4 bg-gray-900 rounded-md text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                        {session.answers[q.id]}
                      </pre>
                    ) : (
                      <p className="p-4 bg-gray-900 rounded-md text-gray-500">(Tidak dijawab)</p>
                    )}
                  </div>

                  {session.answers[q.id] && (
                    <div className="mt-3">
                      <button
                        onClick={() => runStudentCode(q.id, q.language || 'javascript')}
                        disabled={runningCode[q.id]}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-blue-400"
                      >
                        {runningCode[q.id] ? 'Running...' : 'Run Code'}
                      </button>

                      {codeOutputs[q.id] && (
                        <div className={`mt-3 p-4 rounded-md border ${codeOutputs[q.id].error ? 'bg-red-900 border-red-500' : 'bg-gray-900 border-gray-600'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-gray-300">Output:</span>
                            <button
                              onClick={() => setCodeOutputs(prev => {
                                const newOutputs = { ...prev };
                                delete newOutputs[q.id];
                                return newOutputs;
                              })}
                              className="text-gray-400 hover:text-white text-sm"
                            >
                              Tutup
                            </button>
                          </div>
                          <pre className={`text-sm font-mono whitespace-pre-wrap ${codeOutputs[q.id].error ? 'text-red-300' : 'text-green-300'}`}>
                            {codeOutputs[q.id].output}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300">
                      Nilai Live Code (0-100)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={livecodeScores[q.id] || ''}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (isNaN(value) || value < 0 || value > 100) {
                          if (e.target.value === '') {
                            handleLivecodeScoreChange(q.id, '');
                          }
                          return;
                        }
                        handleLivecodeScoreChange(q.id, e.target.value);
                      }}
                      className="p-2 bg-gray-700 rounded-md mt-1 w-32"
                      placeholder="0-100"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {essayQuestions.length === 0 && livecodeQuestions.length === 0 && (
          <p className="text-gray-400">Tidak ada soal esai atau live code untuk dinilai.</p>
        )}
      </div>

      {(essayQuestions.length > 0 || livecodeQuestions.length > 0) && (
        <div className="mt-8">
          <div className="bg-gray-700 p-4 rounded-lg mb-4">
            <h5 className="font-bold text-lg mb-2">Rumus Nilai Akhir:</h5>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>- Hanya PG: 100% nilai PG</li>
              <li>- Hanya Essay: 100% nilai Essay</li>
              <li>- Hanya Live Code: 100% nilai Live Code</li>
              <li>- PG + Essay: 50% PG + 50% Essay</li>
              <li>- PG + Live Code: 50% PG + 50% Live Code</li>
              <li>- Essay + Live Code: 50% Essay + 50% Live Code</li>
              <li>- PG + Essay + Live Code: 34% PG + 33% Essay + 33% Live Code</li>
            </ul>
          </div>
          <button
            onClick={handleSaveAllScores}
            disabled={isSaving}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-green-400"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Semua Nilai'}
          </button>
        </div>
      )}
    </div>
  );
};

export default EssayGradingView;
