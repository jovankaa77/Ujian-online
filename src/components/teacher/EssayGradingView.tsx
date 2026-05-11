import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import Editor from '@monaco-editor/react';

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  php: 'PHP',
  cpp: 'C++',
  htmlcss: 'HTML, CSS Dan Javascript'
};

const PISTON_CONFIG: Record<string, { language: string; version: string }> = {
  python: { language: 'python', version: '3.10.0' },
  php: { language: 'php', version: '8.2.3' },
  cpp: { language: 'c++', version: '10.2.0' }
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
<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SCROLL_PREVIEW') {
    window.scrollBy(0, e.data.deltaY);
  }
});
</script>
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

  // Terminal state (keyed by questionId)
  type TLine = { text: string; type: 'system' | 'output' | 'error' | 'input' | 'prompt' };
  const [termOpen, setTermOpen] = useState<{ [key: string]: boolean }>({});
  const [termLines, setTermLines] = useState<{ [key: string]: TLine[] }>({});
  const [termInputs, setTermInputs] = useState<{ [key: string]: string }>({});
  const [awaitingInput, setAwaitingInput] = useState<{ [key: string]: boolean }>({});
  const pendingPromptsRef = useRef<{ [key: string]: string[] }>({});
  const collectedPairs = useRef<{ [key: string]: { prompt: string; value: string }[] }>({});
  const termInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const termEndRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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

  const executeJavaScriptInWorker = (code: string, timeout: number = 3000): Promise<{ output: string; error: boolean }> => {
    return new Promise((resolve) => {
      const workerCode = `
        self.onmessage = function(e) {
          const code = e.data.code;
          const logs = [];
          const errors = [];

          const fakeConsole = {
            log: function() {
              const args = Array.prototype.slice.call(arguments);
              logs.push(args.map(function(a) {
                if (typeof a === 'object') {
                  try { return JSON.stringify(a, null, 2); }
                  catch(err) { return String(a); }
                }
                return String(a);
              }).join(' '));
            },
            error: function() {
              const args = Array.prototype.slice.call(arguments);
              errors.push(args.map(String).join(' '));
            },
            warn: function() {
              const args = Array.prototype.slice.call(arguments);
              logs.push('[WARN] ' + args.map(String).join(' '));
            },
            info: function() {
              const args = Array.prototype.slice.call(arguments);
              logs.push('[INFO] ' + args.map(String).join(' '));
            }
          };

          const blockedMsg = '[DIBLOKIR] Fungsi ini diblokir untuk keamanan.';
          const fakeWindow = {
            alert: function() { logs.push(blockedMsg + ' (alert)'); },
            confirm: function() { logs.push(blockedMsg + ' (confirm)'); return false; },
            prompt: function() { logs.push(blockedMsg + ' (prompt)'); return null; },
            open: function() { logs.push(blockedMsg + ' (window.open)'); return null; },
            close: function() { logs.push(blockedMsg + ' (window.close)'); },
            print: function() { logs.push(blockedMsg + ' (print)'); },
            location: { href: '', assign: function() {}, replace: function() {}, reload: function() {} },
            document: { write: function() {}, writeln: function() {}, cookie: '' },
            localStorage: { getItem: function() { return null; }, setItem: function() {}, removeItem: function() {}, clear: function() {} },
            sessionStorage: { getItem: function() { return null; }, setItem: function() {}, removeItem: function() {}, clear: function() {} },
            fetch: function() { return Promise.reject(new Error('fetch diblokir')); },
            XMLHttpRequest: function() {},
            safeEval: function() {},
            SafeFunction: function() {}
          };

          try {
            const wrappedCode = '(function(console, window, document, alert, confirm, prompt, fetch, XMLHttpRequest, localStorage, sessionStorage) {' +
              code +
              '\\n})(fakeConsole, fakeWindow, fakeWindow.document, fakeWindow.alert, fakeWindow.confirm, fakeWindow.prompt, fakeWindow.fetch, fakeWindow.XMLHttpRequest, fakeWindow.localStorage, fakeWindow.sessionStorage);';

            const fn = new Function('fakeConsole', 'fakeWindow', wrappedCode);
            fn(fakeConsole, fakeWindow);

            self.postMessage({
              success: true,
              output: logs.join('\\n'),
              errors: errors.join('\\n')
            });
          } catch(err) {
            self.postMessage({
              success: false,
              output: logs.join('\\n'),
              errors: err.toString()
            });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      const timeoutId = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve({
          output: 'Error: Waktu eksekusi habis (Timeout 3 detik).\nKemungkinan kode memiliki perulangan tanpa henti (Infinite Loop).',
          error: true
        });
      }, timeout);

      worker.onmessage = (e) => {
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);

        const { success, output, errors } = e.data;
        if (success) {
          if (errors) {
            resolve({ output: output + (output ? '\n' : '') + 'Errors:\n' + errors, error: true });
          } else {
            resolve({ output: output || '(Eksekusi berhasil tanpa output)', error: false });
          }
        } else {
          resolve({ output: (output ? output + '\n' : '') + 'Error: ' + errors, error: true });
        }
      };

      worker.onerror = (e) => {
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve({ output: 'Worker Error: ' + e.message, error: true });
      };

      worker.postMessage({ code });
    });
  };

  function detectCinCount(code: string, lang: string): number {
    if (lang === 'cpp') return (code.match(/\bcin\s*>>/g) || []).length;
    if (lang === 'python') return (code.match(/\binput\s*\(/g) || []).length;
    if (lang === 'php') return (code.match(/\bfgets\s*\(|\breadline\s*\(|\bfscanf\s*\(/g) || []).length;
    return 0;
  }

  function extractPromptTexts(code: string, lang: string): string[] {
    const prompts: string[] = [];
    if (lang === 'cpp') {
      const re = /cout\s*<<\s*((?:"[^"]*"|'[^']*'|\s*<<\s*(?:"[^"]*"|'[^']*'))*)\s*;?\s*cin\s*>>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) {
        const raw = m[1].replace(/<<\s*/g, '').replace(/\s*endl\b/g, '').replace(/\\n/g, '').replace(/["']/g, '').trim();
        prompts.push(raw || '');
      }
      const cinCount = (code.match(/\bcin\s*>>/g) || []).length;
      while (prompts.length < cinCount) prompts.push('');
    } else if (lang === 'python') {
      const re = /\binput\s*\(\s*(["'])(.*?)\1\s*\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) prompts.push(m[2] || '');
      const inputCount = (code.match(/\binput\s*\(/g) || []).length;
      while (prompts.length < inputCount) prompts.push('');
    } else {
      const count = detectCinCount(code, lang);
      for (let i = 0; i < count; i++) prompts.push('');
    }
    return prompts;
  }

  function mergeStdinIntoOutput(stdout: string, pairs: { prompt: string; value: string }[]): string {
    if (!pairs.length) return stdout;
    let remaining = stdout;
    const parts: string[] = [];
    for (const { prompt, value } of pairs) {
      if (prompt) {
        const idx = remaining.indexOf(prompt);
        if (idx !== -1) {
          if (idx > 0) parts.push(remaining.slice(0, idx));
          parts.push(prompt + value + '\n');
          remaining = remaining.slice(idx + prompt.length);
          continue;
        }
      }
      parts.push(value + '\n');
    }
    const tail = remaining.replace(/^\n/, '').trimEnd();
    if (tail) parts.push(tail);
    return parts.join('');
  }

  function buildTerminalOutput(
    stdout: string, stderr: string, compileErr: string, signal: string | null, httpErr: string | null,
    pairs: { prompt: string; value: string }[]
  ): TLine[] {
    const lines: TLine[] = [];
    if (httpErr) { lines.push({ text: 'Error: ' + httpErr, type: 'error' }); return lines; }
    if (compileErr.trim()) { lines.push({ text: compileErr.trim(), type: 'error' }); return lines; }
    if (signal === 'SIGKILL') { lines.push({ text: 'Program dihentikan paksa (timeout/memory limit). Periksa infinite loop.', type: 'error' }); return lines; }
    const merged = pairs.length > 0 ? mergeStdinIntoOutput(stdout, pairs) : stdout;
    const finalOut = merged.trimEnd();
    if (finalOut) lines.push({ text: finalOut, type: 'output' });
    if (stderr.trim()) {
      if (finalOut) lines.push({ text: '', type: 'output' });
      lines.push({ text: stderr.trim(), type: 'error' });
    }
    if (!finalOut && !stderr.trim()) lines.push({ text: '(Program selesai tanpa output)', type: 'system' });
    return lines;
  }

  const callRunCodeForQ = async (language: string, code: string, stdin: string) => {
    const pistonConfig = PISTON_CONFIG[language];
    if (!pistonConfig) return { stdout: '', stderr: '', compileErr: '', signal: null, httpErr: 'Bahasa tidak didukung.' };
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/run-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ language: pistonConfig.language, version: pistonConfig.version, files: [{ content: code }], stdin }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const msg = res.status === 429 ? 'Terlalu banyak request.' : res.status >= 500 ? 'Server bermasalah.' : `Error ${res.status}`;
        return { stdout: '', stderr: '', compileErr: '', signal: null, httpErr: msg };
      }
      const data = await res.json();
      return {
        stdout: String(data.run?.stdout || ''), stderr: String(data.run?.stderr || ''),
        compileErr: String(data.compile?.stderr || ''), signal: data.run?.signal ?? null, httpErr: null,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return { stdout: '', stderr: '', compileErr: '', signal: null, httpErr: err.name === 'AbortError' ? 'Timeout.' : (err.message || 'Error.') };
    }
  };

  const runStudentCode = async (questionId: string, language: string) => {
    const code = session.answers[questionId] || '';
    if (!code.trim()) {
      setTermOpen(prev => ({ ...prev, [questionId]: true }));
      setTermLines(prev => ({ ...prev, [questionId]: [{ text: 'Error: Kode kosong!', type: 'error' }] }));
      return;
    }

    if (language === 'htmlcss') {
      setHtmlPreviews(prev => ({ ...prev, [questionId]: true }));
      setCodeOutputs(prev => { const n = { ...prev }; delete n[questionId]; return n; });
      return;
    }

    // Reset
    setTermOpen(prev => ({ ...prev, [questionId]: true }));
    setTermLines(prev => ({ ...prev, [questionId]: [] }));
    setTermInputs(prev => ({ ...prev, [questionId]: '' }));
    setAwaitingInput(prev => ({ ...prev, [questionId]: false }));
    pendingPromptsRef.current[questionId] = [];
    collectedPairs.current[questionId] = [];
    setCodeOutputs(prev => { const n = { ...prev }; delete n[questionId]; return n; });
    setRunningCode(prev => ({ ...prev, [questionId]: true }));

    if (language === 'javascript') {
      setTermLines(prev => ({ ...prev, [questionId]: [{ text: 'Running JavaScript...', type: 'system' }] }));
      const result = await executeJavaScriptInWorker(code, 3000);
      setTermLines(prev => ({ ...prev, [questionId]: [
        { text: 'Running JavaScript...', type: 'system' },
        { text: result.output, type: result.error ? 'error' : 'output' },
      ]}));
      setRunningCode(prev => ({ ...prev, [questionId]: false }));
      return;
    }

    const langLabel = language === 'cpp' ? 'C++' : language;
    const cinCount = detectCinCount(code, language);

    setTermLines(prev => ({ ...prev, [questionId]: [{ text: `Compiling ${langLabel}...`, type: 'system' }] }));
    await new Promise(r => setTimeout(r, 300));

    if (cinCount > 0) {
      const prompts = extractPromptTexts(code, language);
      pendingPromptsRef.current[questionId] = prompts.slice(1);
      setTermLines(prev => ({ ...prev, [questionId]: [
        { text: `Compiling ${langLabel}...`, type: 'system' },
        { text: 'Running...', type: 'system' },
        { text: prompts[0], type: 'prompt' },
      ]}));
      setAwaitingInput(prev => ({ ...prev, [questionId]: true }));
      setRunningCode(prev => ({ ...prev, [questionId]: false }));
      setTimeout(() => termInputRefs.current[questionId]?.focus(), 50);
    } else {
      setTermLines(prev => ({ ...prev, [questionId]: [
        { text: `Compiling ${langLabel}...`, type: 'system' },
        { text: 'Running...', type: 'system' },
        { text: '...', type: 'system' },
      ]}));
      const result = await callRunCodeForQ(language, code, '');
      const outLines = buildTerminalOutput(result.stdout, result.stderr, result.compileErr, result.signal, result.httpErr, []);
      setTermLines(prev => ({ ...prev, [questionId]: [
        { text: `Compiling ${langLabel}...`, type: 'system' },
        { text: 'Running...', type: 'system' },
        ...outLines,
        { text: '\n[Program selesai]', type: 'system' },
      ]}));
      setRunningCode(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleTerminalSubmit = async (e: React.FormEvent, questionId: string, language: string) => {
    e.preventDefault();
    const value = termInputs[questionId] || '';
    const code = session.answers[questionId] || '';
    const lines = termLines[questionId] || [];

    const currentPrompt = lines.slice().reverse().find(l => l.type === 'prompt')?.text ?? '';
    collectedPairs.current[questionId] = [...(collectedPairs.current[questionId] || []), { prompt: currentPrompt, value }];

    setTermLines(prev => {
      const prevLines = prev[questionId] || [];
      const updated = [...prevLines];
      const lastPromptIdx = updated.map(l => l.type).lastIndexOf('prompt');
      if (lastPromptIdx !== -1) {
        updated[lastPromptIdx] = { text: updated[lastPromptIdx].text + value, type: 'input' };
      } else {
        updated.push({ text: value, type: 'input' });
      }
      return { ...prev, [questionId]: updated };
    });
    setTermInputs(prev => ({ ...prev, [questionId]: '' }));

    const pending = pendingPromptsRef.current[questionId] || [];
    const allValues = collectedPairs.current[questionId].map(p => p.value);

    if (pending.length > 0) {
      const next = pending.shift()!;
      setTermLines(prev => ({ ...prev, [questionId]: [...(prev[questionId] || []), { text: next, type: 'prompt' }] }));
      setTimeout(() => termInputRefs.current[questionId]?.focus(), 30);
    } else {
      setAwaitingInput(prev => ({ ...prev, [questionId]: false }));
      setRunningCode(prev => ({ ...prev, [questionId]: true }));
      const stdinString = allValues.join('\n') + '\n';
      setTermLines(prev => ({ ...prev, [questionId]: [...(prev[questionId] || []), { text: '...', type: 'system' }] }));
      const result = await callRunCodeForQ(language, code, stdinString);
      const outLines = buildTerminalOutput(result.stdout, result.stderr, result.compileErr, result.signal, result.httpErr, collectedPairs.current[questionId] || []);
      setTermLines(prev => {
        const filtered = (prev[questionId] || []).filter(l => !(l.text === '...' && l.type === 'system'));
        return { ...prev, [questionId]: [...filtered, ...outLines, { text: '\n[Program selesai]', type: 'system' }] };
      });
      setRunningCode(prev => ({ ...prev, [questionId]: false }));
    }
  };

  useLayoutEffect(() => {
    Object.keys(termEndRefs.current).forEach(qId => {
      termEndRefs.current[qId]?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [termLines, awaitingInput]);

  useEffect(() => {
    Object.keys(awaitingInput).forEach(qId => {
      if (awaitingInput[qId]) termInputRefs.current[qId]?.focus();
    });
  }, [awaitingInput]);

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
      <div className="mt-3 space-y-3">
        <div className="rounded-lg border border-gray-600 overflow-hidden bg-gray-900">
          <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-600">
            <span className="text-sm font-bold text-gray-300">Kode Siswa - HTML, CSS Dan Javascript</span>
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
          <div style={{ height: '350px' }}>
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

        <div className="rounded-lg border border-gray-500 overflow-hidden flex flex-col bg-gray-800">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-600 shrink-0">
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
          <div className="bg-gray-100 flex justify-center relative" style={{ height: '480px', overflow: 'hidden' }}>
            <div
              className="absolute inset-0"
              style={{ zIndex: 50, background: 'transparent', cursor: 'default' }}
              onWheel={(e) => {
                e.preventDefault();
                const iframe = e.currentTarget.parentElement?.querySelector('iframe') as HTMLIFrameElement | null;
                if (iframe?.contentWindow) {
                  iframe.contentWindow.postMessage({ type: 'SCROLL_PREVIEW', deltaY: e.deltaY }, '*');
                }
              }}
              onClick={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
            />
            <iframe
              srcDoc={buildPreviewHtml(html, css, js)}
              title={`HTML Preview ${q.id}`}
              sandbox="allow-scripts"
              className="border-0 bg-white transition-all duration-300"
              style={{
                width: previewMode === 'mobile' ? '375px' : '100%',
                height: '100%',
                pointerEvents: 'none',
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
                      {LANGUAGE_LABELS[q.language || 'javascript']}
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
                          <Editor
                            height="300px"
                            language={q.language === 'cpp' ? 'cpp' : q.language === 'python' ? 'python' : q.language === 'php' ? 'php' : 'javascript'}
                            value={session.answers[q.id] || ''}
                            theme="vs-dark"
                            options={{
                              readOnly: true,
                              minimap: { enabled: false },
                              fontSize: 13,
                              lineNumbers: 'on',
                              scrollBeyondLastLine: false,
                              wordWrap: 'on',
                              padding: { top: 8 },
                              contextmenu: false,
                              folding: true,
                            }}
                          />
                        </div>
                      ) : (
                        <p className="p-4 bg-gray-900 rounded-md text-gray-500">(Tidak dijawab)</p>
                      )}
                    </div>
                  )}

                  {session.answers[q.id] && (
                    <div className="mt-3">
                      <div className="flex gap-2">
                        {!isHtmlCss ? (
                          <button
                            onClick={() => runStudentCode(q.id, q.language || 'javascript')}
                            disabled={runningCode[q.id] || awaitingInput[q.id]}
                            className={`flex items-center gap-2 font-bold py-2 px-5 rounded text-sm shadow ${
                              runningCode[q.id] || awaitingInput[q.id]
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {runningCode[q.id] ? (
                              <>
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                                Running...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                                Run
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => runStudentCode(q.id, q.language || 'javascript')}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm"
                          >
                            {htmlPreviews[q.id] ? 'Refresh Preview' : 'Preview'}
                          </button>
                        )}
                      </div>

                      {termOpen[q.id] && !isHtmlCss && (
                        <div className="mt-3 rounded-lg overflow-hidden border border-gray-700 shadow-xl">
                          <div className="flex items-center justify-between bg-[#1a1a1a] px-4 py-2 border-b border-gray-700">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-red-500 opacity-80" />
                                <span className="w-3 h-3 rounded-full bg-yellow-500 opacity-80" />
                                <span className="w-3 h-3 rounded-full bg-green-500 opacity-80" />
                              </div>
                              <span className="text-xs font-mono text-gray-400 select-none">
                                {q.language === 'cpp' ? 'C++ Terminal' : q.language === 'python' ? 'Python Terminal' : 'Terminal'}
                              </span>
                              {runningCode[q.id] && (
                                <span className="flex items-center gap-1 text-xs text-yellow-400 font-mono">
                                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                  </svg>
                                  running
                                </span>
                              )}
                              {awaitingInput[q.id] && !runningCode[q.id] && (
                                <span className="text-xs text-cyan-400 font-mono animate-pulse">● stdin</span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setTermOpen(prev => ({ ...prev, [q.id]: false }));
                                setTermLines(prev => { const n = { ...prev }; delete n[q.id]; return n; });
                                setAwaitingInput(prev => ({ ...prev, [q.id]: false }));
                                pendingPromptsRef.current[q.id] = [];
                                collectedPairs.current[q.id] = [];
                                setRunningCode(prev => ({ ...prev, [q.id]: false }));
                              }}
                              className="text-gray-500 hover:text-gray-200 text-xs px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                          <div
                            className="bg-[#0d0d0d] font-mono text-sm leading-relaxed overflow-auto"
                            style={{ minHeight: '120px', maxHeight: '300px', padding: '12px 16px' }}
                            onClick={() => awaitingInput[q.id] && termInputRefs.current[q.id]?.focus()}
                          >
                            {(termLines[q.id] || []).map((line, i) => {
                              const colorClass =
                                line.type === 'system'  ? 'text-gray-500' :
                                line.type === 'error'   ? 'text-red-400' :
                                line.type === 'input'   ? 'text-cyan-300' :
                                'text-gray-100';
                              return (
                                <div key={i} className={colorClass} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {line.type === 'system' && line.text === '...' ? (
                                    <span className="inline-flex gap-1">
                                      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                                      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                                      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                                    </span>
                                  ) : line.text}
                                </div>
                              );
                            })}
                            {awaitingInput[q.id] && (
                              <form onSubmit={(e) => handleTerminalSubmit(e, q.id, q.language || 'cpp')} className="flex items-center">
                                <input
                                  ref={el => { termInputRefs.current[q.id] = el; }}
                                  type="text"
                                  value={termInputs[q.id] || ''}
                                  onChange={e => setTermInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                                  className="bg-transparent border-none outline-none text-cyan-200 font-mono text-sm flex-1 caret-cyan-400"
                                  style={{ minWidth: 0 }}
                                  autoComplete="off"
                                  spellCheck={false}
                                />
                                <span className="text-cyan-400 animate-[blink_1s_step-end_infinite] ml-0.5 select-none">█</span>
                              </form>
                            )}
                            <div ref={el => { termEndRefs.current[q.id] = el; }} />
                          </div>
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
