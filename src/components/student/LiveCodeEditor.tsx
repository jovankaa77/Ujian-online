import React, { useRef, useCallback } from 'react';
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
  cpp: 'cpp',
  csharp: 'csharp'
};

const PISTON_VERSION_MAP: Record<string, string> = {
  python: '3.10.0',
  php: '8.2.3',
  cpp: '10.2.0',
  csharp: '6.12.0'
};

const PISTON_FILENAME_MAP: Record<string, string> = {
  python: 'main.py',
  php: 'main.php',
  cpp: 'main.cpp',
  csharp: 'Main.cs'
};

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
  const [codeOutput, setCodeOutput] = React.useState<{ output: string; error: boolean } | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [htmlPreview, setHtmlPreview] = React.useState(false);

  const currentCode = currentDraft !== undefined ? currentDraft : (savedAnswer || '');
  const showTemplate = !currentCode.trim();
  const displayCode = showTemplate ? (CODE_TEMPLATES[language] || '') : currentCode;

  const hasUnsavedChanges = currentDraft !== undefined && currentDraft !== (savedAnswer || '');

  React.useEffect(() => {
    if (showTemplate && currentDraft === undefined) {
      const template = CODE_TEMPLATES[language] || '';
      if (template) {
        onDraftChange(questionId, template);
      }
    }
  }, [showTemplate, currentDraft, language, questionId, onDraftChange]);

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

    if (language === 'htmlcss') {
      setHtmlPreview(true);
      setCodeOutput(null);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsRunning(true);
    setCodeOutput({ output: 'Running...', error: false });

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          language: PISTON_LANGUAGE_MAP[language],
          version: PISTON_VERSION_MAP[language],
          files: [{ name: PISTON_FILENAME_MAP[language], content: code }],
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

      let output = '';
      let hasError = false;

      if (result.compile && result.compile.stderr) {
        output = 'Compilation Error:\n' + result.compile.stderr;
        hasError = true;
      } else if (result.run) {
        if (result.run.stderr && result.run.stderr.trim()) {
          if (result.run.stdout && result.run.stdout.trim()) {
            output = result.run.stdout + '\n\nStderr:\n' + result.run.stderr;
          } else {
            output = 'Error:\n' + result.run.stderr;
          }
          hasError = !result.run.stdout || !result.run.stdout.trim();
        } else if (result.run.stdout && result.run.stdout.trim()) {
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

      setCodeOutput({ output, error: hasError });
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setCodeOutput({ output: 'Execution stopped by user.', error: true });
      } else {
        setCodeOutput({
          output: 'Error: ' + e.message + '\n\nPastikan koneksi internet Anda stabil.',
          error: true
        });
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  }, [currentDraft, savedAnswer, language]);

  const monacoLang = MONACO_LANGUAGE_MAP[language] || 'plaintext';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm bg-teal-600 text-white px-3 py-1 rounded">
            {LANGUAGE_LABELS[language] || language}
          </span>
          <button
            onClick={() => {
              const template = CODE_TEMPLATES[language] || '';
              onDraftChange(questionId, template);
            }}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded"
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

      <div className="rounded-lg overflow-hidden border border-gray-600 shadow-lg">
        <Editor
          height="400px"
          language={monacoLang}
          value={displayCode}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            cursorStyle: 'line',
            mouseStyle: 'text',
            fontSize: 14,
            lineHeight: 22,
            padding: { top: 12, bottom: 12 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            wordWrap: 'on',
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

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onSave(questionId)}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Simpan Kode
        </button>
        <button
          onClick={() => onCancel(questionId)}
          className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Batalkan Perubahan
        </button>
        {isRunning ? (
          <button
            onClick={stopRunning}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded animate-pulse transition-colors"
          >
            Stop Running
          </button>
        ) : (
          <button
            onClick={runCode}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            {language === 'htmlcss' ? 'Preview' : 'Run Code'}
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

      {codeOutput && (
        <div className="rounded-lg overflow-hidden border border-gray-600">
          <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-600">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-yellow-400 animate-pulse' : codeOutput.error ? 'bg-red-400' : 'bg-green-400'}`} />
              <span className="text-sm font-mono text-gray-300">Terminal Output</span>
            </div>
            <button
              onClick={() => setCodeOutput(null)}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              Tutup
            </button>
          </div>
          <div className="bg-gray-950 p-4 min-h-[80px] max-h-[300px] overflow-auto">
            <pre className={`text-sm font-mono whitespace-pre-wrap leading-relaxed ${codeOutput.error ? 'text-red-400' : 'text-green-400'}`}>
              {codeOutput.output}
            </pre>
          </div>
        </div>
      )}

      {language === 'htmlcss' && htmlPreview && (
        <div className="rounded-lg border border-gray-500 overflow-hidden">
          <div className="flex items-center justify-between bg-gray-700 px-4 py-2">
            <span className="text-sm font-bold text-gray-300">Preview HTML & CSS</span>
            <button
              onClick={() => setHtmlPreview(false)}
              className="text-gray-400 hover:text-white text-sm"
            >
              Tutup
            </button>
          </div>
          <div className="bg-white">
            <iframe
              srcDoc={currentDraft || savedAnswer || ''}
              title={`HTML Preview ${questionId}`}
              sandbox="allow-scripts"
              className="w-full border-0"
              style={{ minHeight: '300px', height: '400px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
