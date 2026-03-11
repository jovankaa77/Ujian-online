import React, { useState, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import Editor from '@monaco-editor/react';

const LANGUAGE_LABELS: Record<string, string> = {
  php: 'PHP',
  cpp: 'C++',
  python: 'Python',
  csharp: 'C#',
  htmlcss: 'HTML & CSS'
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

const WEB_SEPARATOR = '\n<!--__WEB_TAB_SEPARATOR__-->\n';

type WebTab = 'html' | 'css' | 'js';
type PreviewMode = 'desktop' | 'mobile';

function deserializeWebTabs(combined: string): { html: string; css: string; js: string } {
  const parts = combined.split(WEB_SEPARATOR);
  return {
    html: parts[0] || '',
    css: parts[1] || '',
    js: parts[2] || '',
  };
}

function extractBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1];
  const hasHtml = /<html/i.test(html);
  if (hasHtml) {
    return html
      .replace(/<html[^>]*>/i, '')
      .replace(/<\/html>/i, '')
      .replace(/<head[\s\S]*?<\/head>/i, '')
      .replace(/<body[^>]*>/i, '')
      .replace(/<\/body>/i, '');
  }
  return html;
}

function buildPreviewHtml(html: string, css: string, js: string): string {
  return `<html>
<head>
<style>${css}</style>
</head>
<body>
${extractBody(html)}
<script>${js}<\/script>
</body>
</html>`;
}

const EssayGradingView: React.FC<EssayGradingViewProps> = ({ session, questions, examId, navigateBack, onBack }) => {
  const essayQuestions = questions.filter(q => q.type === 'essay');
  const livecodeQuestions = questions.filter(q => q.type === 'livecode');
  const [essayScores, setEssayScores] = useState<{ [key: string]: number }>(session.essayScores || {});
  const [livecodeScores, setLivecodeScores] = useState<{ [key: string]: number }>(session.livecodeScores || {});
  const [isSaving, setIsSaving] = useState(false);
  const [codeOutputs, setCodeOutputs] = useState<{ [key: string]: { output: string; error: boolean } }>({});
  const [runningCode, setRunningCode] = useState<{ [key: string]: boolean }>({});
  const [htmlPreviews, setHtmlPreviews] = useState<{ [key: string]: boolean }>({});
  const [htmlActiveTabs, setHtmlActiveTabs] = useState<{ [key: string]: WebTab }>({});
  const [htmlPreviewModes, setHtmlPreviewModes] = useState<{ [key: string]: PreviewMode }>({});
  const abortControllersRef = useRef<{ [key: string]: AbortController }>({});

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

  const stopRunningCode = (questionId: string) => {
    const controller = abortControllersRef.current[questionId];
    if (controller) {
      controller.abort();
    }
    setRunningCode(prev => ({ ...prev, [questionId]: false }));
    setCodeOutputs(prev => ({
      ...prev,
      [questionId]: { output: 'Execution stopped by user.', error: true }
    }));
    delete abortControllersRef.current[questionId];
  };

  const runStudentCode = async (questionId: string, language: string) => {
    const code = session.answers[questionId] || '';
    if (!code.trim()) {
      setCodeOutputs(prev => ({ ...prev, [questionId]: { output: 'Error: Kode kosong!', error: true } }));
      return;
    }

    if (language === 'htmlcss') {
      setHtmlPreviews(prev => ({ ...prev, [questionId]: true }));
      setCodeOutputs(prev => {
        const newOutputs = { ...prev };
        delete newOutputs[questionId];
        return newOutputs;
      });
      return;
    }

    const abortController = new AbortController();
    abortControllersRef.current[questionId] = abortController;

    setRunningCode(prev => ({ ...prev, [questionId]: true }));
    setCodeOutputs(prev => ({ ...prev, [questionId]: { output: 'Compiling and running...', error: false } }));

    try {
      let output = '';
      let hasError = false;

      if (language === 'python' || language === 'php' || language === 'cpp' || language === 'csharp') {
        const pistonLanguageMap: Record<string, string> = {
          python: 'python',
          php: 'php',
          cpp: 'cpp',
          csharp: 'csharp'
        };

        const pistonVersionMap: Record<string, string> = {
          python: '3.10.0',
          php: '8.2.3',
          cpp: '10.2.0',
          csharp: '6.12.0'
        };

        const fileNameMap: Record<string, string> = {
          python: 'main.py',
          php: 'main.php',
          cpp: 'main.cpp',
          csharp: 'Main.cs'
        };

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/run-code`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
              language: pistonLanguageMap[language],
              version: pistonVersionMap[language],
              files: [
                {
                  name: fileNameMap[language],
                  content: code
                }
              ],
              stdin: '',
              args: [],
              compile_timeout: 10000,
              run_timeout: 5000
            }),
            signal: abortController.signal
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`HTTP error! status: ${response.status}${errorText ? ' - ' + errorText : ''}`);
          }

          const result = await response.json();

          if (result.compile && result.compile.stderr) {
            output = 'Compilation Error:\n' + result.compile.stderr;
            hasError = true;
          } else if (result.run) {
            if (result.run.stderr) {
              output = 'Runtime Error:\n' + result.run.stderr;
              hasError = true;
            } else if (result.run.stdout) {
              output = result.run.stdout;
            } else {
              output = '(No output)';
            }

            if (result.run.signal === 'SIGKILL') {
              output = 'Error: Program dihentikan karena timeout atau menggunakan memori berlebihan.\nKemungkinan infinite loop atau recursion tanpa batas.';
              hasError = true;
            }
          } else {
            output = 'Execution completed with no output';
          }
        } catch (e: any) {
          if (e.name === 'AbortError') {
            output = 'Execution stopped by user.';
          } else {
            output = 'Compiler Error: ' + e.message + '\n\nPastikan koneksi internet Anda stabil.';
          }
          hasError = true;
        }
      } else {
        output = 'Bahasa pemrograman tidak didukung untuk eksekusi langsung.';
        hasError = true;
      }

      setCodeOutputs(prev => ({ ...prev, [questionId]: { output, error: hasError } }));
    } catch (e: any) {
      setCodeOutputs(prev => ({ ...prev, [questionId]: { output: 'Error: ' + e.message, error: true } }));
    } finally {
      setRunningCode(prev => ({ ...prev, [questionId]: false }));
      delete abortControllersRef.current[questionId];
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

  const getActiveTab = (qId: string): WebTab => htmlActiveTabs[qId] || 'html';
  const getPreviewMode = (qId: string): PreviewMode => htmlPreviewModes[qId] || 'desktop';

  const tabEditorLanguage: Record<WebTab, string> = { html: 'html', css: 'css', js: 'javascript' };

  const tabConfig: { key: WebTab; label: string; icon: string }[] = [
    { key: 'html', label: 'HTML', icon: 'H' },
    { key: 'css', label: 'CSS', icon: 'C' },
    { key: 'js', label: 'JS', icon: 'J' },
  ];

  const tabColorMap: Record<WebTab, string> = {
    html: 'text-orange-400',
    css: 'text-blue-400',
    js: 'text-yellow-400',
  };

  const renderHtmlCssPreview = (q: Question) => {
    const rawAnswer = session.answers[q.id] || '';
    const { html, css, js } = deserializeWebTabs(rawAnswer);
    const activeTab = getActiveTab(q.id);
    const previewMode = getPreviewMode(q.id);

    const editorValues: Record<WebTab, string> = { html, css, js };

    return (
      <div className="mt-3 rounded-lg border border-gray-600 overflow-hidden bg-gray-900">
        <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-600">
          <span className="text-sm font-bold text-gray-300">Preview HTML & CSS</span>
          <button
            onClick={() => setHtmlPreviews(prev => {
              const newPreviews = { ...prev };
              delete newPreviews[q.id];
              return newPreviews;
            })}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Tutup
          </button>
        </div>

        <div className="flex" style={{ height: '500px' }}>
          <div className="w-1/2 flex flex-col border-r border-gray-600">
            <div className="flex bg-gray-850 border-b border-gray-600 shrink-0">
              {tabConfig.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setHtmlActiveTabs(prev => ({ ...prev, [q.id]: tab.key }))}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.key
                      ? `bg-gray-900 ${tabColorMap[tab.key]} border-current`
                      : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  <span className={`text-xs font-bold w-5 h-5 rounded flex items-center justify-center ${
                    activeTab === tab.key ? 'bg-gray-700' : 'bg-gray-700/50'
                  } ${tabColorMap[tab.key]}`}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                language={tabEditorLanguage[activeTab]}
                value={editorValues[activeTab]}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 8 },
                }}
              />
            </div>
          </div>

          <div className="w-1/2 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-600 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
                <span className="text-xs font-bold text-gray-400">Live Preview</span>
              </div>
              <div className="flex bg-gray-700 rounded overflow-hidden">
                <button
                  onClick={() => setHtmlPreviewModes(prev => ({ ...prev, [q.id]: 'desktop' }))}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    previewMode === 'desktop' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Desktop
                </button>
                <button
                  onClick={() => setHtmlPreviewModes(prev => ({ ...prev, [q.id]: 'mobile' }))}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    previewMode === 'mobile' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Mobile
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 flex justify-center overflow-auto">
              <iframe
                srcDoc={buildPreviewHtml(html, css, js)}
                title={`HTML Preview ${q.id}`}
                sandbox="allow-scripts"
                className="border-0 bg-white transition-all duration-300"
                style={{
                  width: previewMode === 'mobile' ? '375px' : '100%',
                  height: '100%',
                  minHeight: '100%',
                  ...(previewMode === 'mobile' ? {
                    boxShadow: '0 0 0 8px #1f2937, 0 0 0 10px #374151, 0 8px 32px rgba(0,0,0,0.3)',
                    borderRadius: '12px',
                    margin: '12px 0',
                  } : {}),
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

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
            {essayQuestions.map((q) => {
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
            {livecodeQuestions.map((q) => {
              const qIndex = questions.findIndex(question => question.id === q.id);
              const isHtmlCss = q.language === 'htmlcss';
              return (
                <div key={q.id} className="bg-gray-800 p-6 rounded-lg mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <p className="font-semibold">
                      <span className="text-teal-400">#{qIndex + 1}</span> {q.text || '(Soal bergambar)'}
                    </p>
                    <span className="text-xs bg-teal-600 text-white px-2 py-1 rounded">
                      {LANGUAGE_LABELS[q.language || 'php']}
                    </span>
                  </div>
                  {q.image && (
                    <img src={q.image} alt="Soal" className="max-h-40 mt-2 rounded" />
                  )}

                  {!isHtmlCss && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-400 mb-2">Kode Siswa:</p>
                      {session.answers[q.id] ? (
                        <div className="rounded-lg overflow-hidden border border-gray-500 shadow-lg">
                          <div className="flex">
                            <div className="bg-slate-800 text-gray-500 text-right pr-3 py-4 select-none font-mono text-sm border-r border-gray-600" style={{ lineHeight: '1.5', minWidth: '3rem' }}>
                              {session.answers[q.id].split('\n').map((_: string, i: number) => (
                                <div key={i} className="px-2">{i + 1}</div>
                              ))}
                            </div>
                            <pre
                              className="flex-1 p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap text-gray-200"
                              style={{
                                lineHeight: '1.5',
                                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                              }}
                            >
                              {session.answers[q.id]}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <p className="p-4 bg-gray-900 rounded-md text-gray-500">(Tidak dijawab)</p>
                      )}
                    </div>
                  )}

                  {session.answers[q.id] && (
                    <div className="mt-3">
                      <div className="flex gap-2">
                        {runningCode[q.id] ? (
                          <button
                            onClick={() => stopRunningCode(q.id)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded animate-pulse"
                          >
                            Stop Running
                          </button>
                        ) : (
                          <button
                            onClick={() => runStudentCode(q.id, q.language || 'php')}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                          >
                            {isHtmlCss ? (htmlPreviews[q.id] ? 'Refresh Preview' : 'Preview') : 'Run Code'}
                          </button>
                        )}
                      </div>

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

                      {isHtmlCss && htmlPreviews[q.id] && renderHtmlCssPreview(q)}
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
