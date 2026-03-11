import { useRef, useCallback, useState, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

const LANGUAGE_LABELS: Record<string, string> = {
  php: 'PHP',
  cpp: 'C++',
  python: 'Python',
  csharp: 'C#',
  htmlcss: 'HTML & CSS'
};

const CODE_TEMPLATES: Record<string, string> = {
  php: `<?php
// PHP Hello World
echo "Hello, World!";
?>`,
  cpp: `// C++ Hello World
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`,
  python: `# Python Hello World
print("Hello, World!")`,
  csharp: `// C# Hello World
using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello, World!");
    }
}`,
  htmlcss: `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f0f0f0;
    }
    h1 {
      color: #333;
    }
  </style>
</head>
<body>
  <h1>Hello, World!</h1>
</body>
</html>`
};

const MONACO_LANGUAGE_MAP: Record<string, string> = {
  php: 'php',
  cpp: 'cpp',
  python: 'python',
  csharp: 'csharp',
  htmlcss: 'html'
};

const PISTON_LANGUAGE_MAP: Record<string, string> = {
  python: 'python',
  php: 'php',
  cpp: 'c++',
  csharp: 'csharp'
};

const PISTON_VERSION_MAP: Record<string, string> = {
  python: '3.10.0',
  php: '8.2.3',
  cpp: '10.2.0',
  csharp: '6.12.0'
};

function buildSecureHtml(studentCode: string): string {
  const securityScript = `<script>
window.alert = function(msg) { window.parent.postMessage({type:'BLOCKED_ACTION', msg:'Alert diblokir: ' + msg}, '*'); };
window.confirm = function() { window.parent.postMessage({type:'BLOCKED_ACTION', msg:'Confirm diblokir'}, '*'); return false; };
window.prompt = function() { window.parent.postMessage({type:'BLOCKED_ACTION', msg:'Prompt diblokir'}, '*'); return null; };
window.open = function() { window.parent.postMessage({type:'BLOCKED_ACTION', msg:'Membuka tab baru diblokir demi keamanan!'}, '*'); return null; };
window.print = function() { window.parent.postMessage({type:'BLOCKED_ACTION', msg:'Fitur Print diblokir!'}, '*'); };
var logCount = 0;
var origLog = console.log;
console.log = function() {
  if (logCount < 50) { logCount++; origLog.apply(console, arguments); }
};
</script>
<style>body { font-family: sans-serif; word-wrap: break-word; }</style>`;

  const hasHtmlStructure = /<html/i.test(studentCode);

  if (hasHtmlStructure) {
    const hasHead = /<head([^>]*)>/i.test(studentCode);
    if (hasHead) {
      return studentCode.replace(/<head([^>]*)>/i, `<head$1>${securityScript}`);
    }
    return studentCode.replace(/<html([^>]*)>/i, `<html$1><head>${securityScript}</head>`);
  }

  return `<html><head>${securityScript}</head><body>${studentCode}</body></html>`;
}

interface LiveCodeEditorProps {
  questionId: string;
  language: string;
  currentDraft: string | undefined;
  savedAnswer: string | undefined;
  onDraftChange: (questionId: string, code: string) => void;
  onSave: (questionId: string) => void;
  onCancel: (questionId: string) => void;
  onPerformCancel: (questionId: string) => void;
  showCancelConfirm: string | null;
  setShowCancelConfirm: (val: string | null) => void;
  codeMessage: { text: string; type: 'success' | 'error' | 'warning' } | undefined;
}

export default function LiveCodeEditor({
  questionId,
  language,
  currentDraft,
  savedAnswer,
  onDraftChange,
  onSave,
  onCancel,
  onPerformCancel,
  showCancelConfirm,
  setShowCancelConfirm,
  codeMessage,
}: LiveCodeEditorProps) {
  const editorRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [codeOutput, setCodeOutput] = useState<{ output: string; error: boolean } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [htmlPreview, setHtmlPreview] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const currentCode = currentDraft !== undefined ? currentDraft : (savedAnswer || '');
  const showTemplate = !currentCode.trim();
  const displayCode = showTemplate ? (CODE_TEMPLATES[language] || '') : currentCode;
  const hasUnsavedChanges = currentDraft !== undefined && currentDraft !== (savedAnswer || '');
  const isHtml = language === 'htmlcss';

  useEffect(() => {
    if (showTemplate && currentDraft === undefined) {
      const template = CODE_TEMPLATES[language] || '';
      if (template) {
        onDraftChange(questionId, template);
      }
    }
  }, [showTemplate, currentDraft, language, questionId, onDraftChange]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BLOCKED_ACTION') {
        setToastMsg(event.data.msg);
        setTimeout(() => setToastMsg(''), 3000);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  const handleEditorChange = useCallback((value: string | undefined) => {
    onDraftChange(questionId, value || '');
  }, [questionId, onDraftChange]);

  const stopRunning = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
    setCodeOutput({ output: 'Execution stopped by user.', error: true });
    abortControllerRef.current = null;
  }, []);

  const runCode = useCallback(async () => {
    const code = currentDraft !== undefined ? currentDraft : (savedAnswer || '');
    if (!code.trim()) {
      setCodeOutput({ output: 'Error: Kode kosong!', error: true });
      return;
    }

    if (isHtml) {
      setHtmlPreview(true);
      setCodeOutput(null);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsRunning(true);
    setCodeOutput({ output: 'Running...', error: false });

    try {
      const mappedLanguage = PISTON_LANGUAGE_MAP[language];
      const mappedVersion = PISTON_VERSION_MAP[language];

      if (!mappedLanguage || !mappedVersion) {
        setCodeOutput({ output: 'Error: Bahasa pemrograman tidak didukung.', error: true });
        setIsRunning(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          language: mappedLanguage,
          version: mappedVersion,
          files: [{ content: code }]
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error('Koneksi ke server eksekusi gagal.');
      }

      const data = await response.json();

      if (data.compile && data.compile.stderr && data.compile.stderr.trim()) {
        setCodeOutput({
          output: 'Compilation Error:\n' + String(data.compile.stderr),
          error: true
        });
        return;
      }

      let finalOutput = data.run?.stderr && data.run.stderr.trim()
        ? data.run.stderr
        : data.run?.stdout;

      if (typeof finalOutput === 'object' && finalOutput !== null) {
        finalOutput = JSON.stringify(finalOutput, null, 2);
      }

      if (data.run?.signal === 'SIGKILL') {
        setCodeOutput({
          output: 'Error: Program dihentikan karena timeout atau menggunakan memori berlebihan.\nKemungkinan infinite loop atau recursion tanpa batas.',
          error: true
        });
        return;
      }

      const hasStderr = data.run?.stderr && data.run.stderr.trim();
      const hasStdout = data.run?.stdout && data.run.stdout.trim();

      if (hasStderr && hasStdout) {
        setCodeOutput({
          output: String(data.run.stdout) + '\n\nStderr:\n' + String(data.run.stderr),
          error: false
        });
      } else if (hasStderr) {
        setCodeOutput({
          output: 'Error:\n' + String(data.run.stderr),
          error: true
        });
      } else {
        setCodeOutput({
          output: finalOutput ? String(finalOutput) : 'Eksekusi berhasil tanpa output.',
          error: false
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setCodeOutput({ output: 'Execution stopped by user.', error: true });
      } else {
        setCodeOutput({
          output: 'Error: ' + (err.message || 'Terjadi kesalahan yang tidak diketahui.') + '\n\nPastikan koneksi internet Anda stabil.',
          error: true
        });
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  }, [currentDraft, savedAnswer, language, isHtml]);

  const monacoLang = MONACO_LANGUAGE_MAP[language] || 'plaintext';
  const showHtmlSplitView = isHtml && htmlPreview;

  return (
    <div className="space-y-3">
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-600 text-white px-5 py-3 rounded-lg shadow-2xl text-sm font-semibold animate-pulse border border-red-400">
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm bg-teal-600 text-white px-3 py-1 rounded font-medium">
            {LANGUAGE_LABELS[language] || language}
          </span>
          <button
            onClick={() => {
              const template = CODE_TEMPLATES[language] || '';
              onDraftChange(questionId, template);
            }}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition-colors"
            title="Load Hello World template"
          >
            Reset Template
          </button>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-sm text-yellow-400 animate-pulse">
              * Perubahan belum disimpan
            </span>
          )}
          {savedAnswer && !hasUnsavedChanges && (
            <span className="text-sm text-green-400">
              Tersimpan
            </span>
          )}
        </div>
      </div>

      <div className={showHtmlSplitView ? 'flex gap-3' : ''} style={showHtmlSplitView ? { minHeight: '480px' } : undefined}>
        <div className={showHtmlSplitView ? 'w-1/2 flex flex-col' : ''}>
          <div className="rounded-lg overflow-hidden border border-gray-600 shadow-lg flex-1">
            <Editor
              height={showHtmlSplitView ? '480px' : '400px'}
              language={monacoLang}
              value={displayCode}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                wordWrap: 'on',
                cursorStyle: 'line',
                mouseStyle: 'text',
                fontSize: 14,
                lineHeight: 22,
                padding: { top: 12, bottom: 12 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                renderLineHighlight: 'line',
                selectOnLineNumbers: true,
                roundedSelection: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                contextmenu: false,
                folding: true,
                lineNumbersMinChars: 3,
                glyphMargin: false,
                suggest: { showSnippets: false, showWords: false },
                quickSuggestions: false,
                parameterHints: { enabled: false },
              }}
            />
          </div>
        </div>

        {showHtmlSplitView && (
          <div className="w-1/2 flex flex-col">
            <div className="rounded-lg border border-gray-500 overflow-hidden flex-1 flex flex-col">
              <div className="flex items-center justify-between bg-gray-700 px-4 py-2 border-b border-gray-600 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm font-bold text-gray-300">Live Preview</span>
                </div>
                <button
                  onClick={() => setHtmlPreview(false)}
                  className="text-gray-400 hover:text-white text-xs transition-colors"
                >
                  Tutup
                </button>
              </div>
              <div className="bg-white flex-1 relative">
                <iframe
                  srcDoc={buildSecureHtml(currentDraft || savedAnswer || '')}
                  title={`HTML Preview ${questionId}`}
                  sandbox="allow-scripts"
                  className="w-full h-full border-0"
                  style={{ minHeight: '440px', pointerEvents: 'none' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onSave(questionId)}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
        >
          Simpan Kode
        </button>
        <button
          onClick={() => onCancel(questionId)}
          className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
        >
          Batalkan Perubahan
        </button>
        {isRunning ? (
          <button
            onClick={stopRunning}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded animate-pulse transition-colors text-sm"
          >
            Stop Running
          </button>
        ) : (
          <button
            onClick={runCode}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
          >
            {isHtml ? (htmlPreview ? 'Refresh Preview' : 'Preview') : 'Run Code'}
          </button>
        )}
      </div>

      {codeMessage && (
        <div className={`p-3 rounded-md text-sm font-medium ${
          codeMessage.type === 'success' ? 'bg-green-800 text-green-200 border border-green-500' :
          codeMessage.type === 'error' ? 'bg-red-800 text-red-200 border border-red-500' :
          'bg-yellow-800 text-yellow-200 border border-yellow-500'
        }`}>
          {codeMessage.text}
        </div>
      )}

      {showCancelConfirm === questionId && (
        <div className="bg-yellow-900 border border-yellow-500 p-4 rounded-md">
          <p className="text-yellow-200 mb-3">Kode belum disimpan. Apakah Anda yakin ingin membatalkan perubahan?</p>
          <div className="flex gap-2">
            <button
              onClick={() => onPerformCancel(questionId)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm"
            >
              Ya, Batalkan
            </button>
            <button
              onClick={() => setShowCancelConfirm(null)}
              className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded text-sm"
            >
              Tidak, Kembali
            </button>
          </div>
        </div>
      )}

      {!savedAnswer && (
        <div className="bg-yellow-900 border border-yellow-500 p-3 rounded-md">
          <p className="text-yellow-300 text-sm">
            Kode belum tersimpan. Klik "Simpan Kode" untuk menyimpan jawaban Anda.
            Jika tidak disimpan, soal ini dianggap tidak dijawab.
          </p>
        </div>
      )}

      {codeOutput && !isHtml && (
        <div className="rounded-lg overflow-hidden border border-gray-600">
          <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-600">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-yellow-400 animate-pulse' : codeOutput.error ? 'bg-red-400' : 'bg-green-400'}`} />
              <span className="text-sm font-mono text-gray-300">Terminal Output</span>
            </div>
            <button
              onClick={() => setCodeOutput(null)}
              className="text-gray-400 hover:text-white text-xs transition-colors"
            >
              Tutup
            </button>
          </div>
          <div className="bg-gray-950 p-4 min-h-[80px] max-h-[300px] overflow-auto">
            <div
              className={`text-sm font-mono leading-relaxed ${codeOutput.error ? 'text-red-400' : 'text-green-400'}`}
              style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
            >
              {codeOutput.output}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
