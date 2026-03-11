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
  php: `<?php\n// PHP Hello World\necho "Hello, World!";\n?>`,
  cpp: `// C++ Hello World\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
  python: `# Python Hello World\nprint("Hello, World!")`,
  csharp: `// C# Hello World\nusing System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}`
};

const WEB_DEFAULT_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kerangka Sederhana</title>
</head>
<body>
  <header>
    <h1>Website Anda</h1>
    <nav>
      <ul>
        <li><a href="#">Home</a></li>
        <li><a href="#">Tentang</a></li>
        <li><a href="#">Layanan</a></li>
        <li><a href="#">Kontak</a></li>
      </ul>
    </nav>
  </header>

  <div class="main-content">
    <aside class="sidebar">
      <h3>Menu Samping</h3>
      <ul>
        <li><a href="#">Link 1</a></li>
        <li><a href="#">Link 2</a></li>
        <li><a href="#">Link 3</a></li>
      </ul>
    </aside>

    <section class="content">
      <h2>Konten Utama</h2>
      <p>Ini adalah konten utama halaman web Anda.</p>
    </section>
  </div>

  <footer>
    <p>&copy; 2026 Website Anda</p>
  </footer>
</body>
</html>`;

const WEB_DEFAULT_CSS = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Arial', sans-serif;
  line-height: 1.6;
  background-color: #f4f4f4;
  color: #333;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

header {
  background-color: #333;
  color: #fff;
  padding: 20px 0;
  text-align: center;
}

header h1 {
  font-size: 2rem;
  margin-bottom: 10px;
}

nav ul {
  list-style: none;
  padding: 0;
}

nav ul li {
  display: inline-block;
  margin-right: 20px;
}

nav ul li a {
  color: #fff;
  text-decoration: none;
  font-size: 1.1rem;
  transition: color 0.3s ease;
}

nav ul li a:hover {
  color: #ddd;
}

.main-content {
  display: flex;
  flex-wrap: wrap;
  margin-top: 20px;
  gap: 20px;
  justify-content: space-between;
  flex: 1;
}

.sidebar {
  flex: 0 0 25%;
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.sidebar h3 {
  font-size: 1.4rem;
  margin-bottom: 10px;
}

.sidebar ul {
  list-style: none;
}

.sidebar ul li {
  margin-bottom: 10px;
}

.sidebar ul li a {
  color: #333;
  text-decoration: none;
  font-size: 1rem;
}

.sidebar ul li a:hover {
  color: #007BFF;
  text-decoration: underline;
}

.content {
  flex: 0 0 70%;
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.content h2 {
  font-size: 1.8rem;
  margin-bottom: 20px;
}

.content p {
  font-size: 1rem;
  line-height: 1.8;
}

footer {
  background-color: #333;
  color: #fff;
  text-align: center;
  padding: 15px;
  font-size: 0.9rem;
  position: relative;
  width: 100%;
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }

  .sidebar {
    flex: 0 0 100%;
  }

  .content {
    flex: 0 0 100%;
  }
}`;

const WEB_DEFAULT_JS = `// JavaScript\nconsole.log("Hello from script.js");`;

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

const WEB_SEPARATOR = '\n<!--__WEB_TAB_SEPARATOR__-->\n';

type WebTab = 'html' | 'css' | 'js';

function serializeWebTabs(html: string, css: string, js: string): string {
  return html + WEB_SEPARATOR + css + WEB_SEPARATOR + js;
}

function deserializeWebTabs(combined: string): { html: string; css: string; js: string } {
  const parts = combined.split(WEB_SEPARATOR);
  return {
    html: parts[0] || WEB_DEFAULT_HTML,
    css: parts[1] || WEB_DEFAULT_CSS,
    js: parts[2] || WEB_DEFAULT_JS,
  };
}

function buildSecureWebPreview(html: string, css: string, js: string): string {
  return `<html>
<head>
<script>
window.alert = function(msg) { window.parent.postMessage({type:'BLOCKED_ACTION', msg:'Alert diblokir: ' + msg}, '*'); };
window.confirm = function() { window.parent.postMessage({type:'BLOCKED_ACTION', msg:'Confirm diblokir'}, '*'); return false; };
window.prompt = function() { window.parent.postMessage({type:'BLOCKED_ACTION', msg:'Prompt diblokir'}, '*'); return null; };
window.open = function() { window.parent.postMessage({type:'BLOCKED_ACTION', msg:'Membuka tab baru diblokir demi keamanan ujian!'}, '*'); return null; };
window.print = function() { window.parent.postMessage({type:'BLOCKED_ACTION', msg:'Fitur Print diblokir!'}, '*'); };
var logCount = 0;
var origLog = console.log;
console.log = function() {
  if (logCount < 50) { logCount++; origLog.apply(console, arguments); }
};
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

function extractBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1];
  const hasHtml = /<html/i.test(html);
  if (hasHtml) {
    const stripped = html
      .replace(/<html[^>]*>/i, '')
      .replace(/<\/html>/i, '')
      .replace(/<head[\s\S]*?<\/head>/i, '')
      .replace(/<body[^>]*>/i, '')
      .replace(/<\/body>/i, '');
    return stripped;
  }
  return html;
}

function buildSecureSingleHtml(studentCode: string): string {
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

  const isWebMode = language === 'htmlcss';

  const [webActiveTab, setWebActiveTab] = useState<WebTab>('html');
  const [webHtml, setWebHtml] = useState(WEB_DEFAULT_HTML);
  const [webCss, setWebCss] = useState(WEB_DEFAULT_CSS);
  const [webJs, setWebJs] = useState(WEB_DEFAULT_JS);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const webInitialized = useRef(false);

  useEffect(() => {
    if (!isWebMode || webInitialized.current) return;
    webInitialized.current = true;

    const source = currentDraft ?? savedAnswer ?? '';
    if (source.includes(WEB_SEPARATOR)) {
      const parsed = deserializeWebTabs(source);
      setWebHtml(parsed.html);
      setWebCss(parsed.css);
      setWebJs(parsed.js);
    } else if (!source.trim()) {
      const serialized = serializeWebTabs(WEB_DEFAULT_HTML, WEB_DEFAULT_CSS, WEB_DEFAULT_JS);
      onDraftChange(questionId, serialized);
    }
  }, [isWebMode, currentDraft, savedAnswer, questionId, onDraftChange]);

  const currentCode = !isWebMode ? (currentDraft !== undefined ? currentDraft : (savedAnswer || '')) : '';
  const showTemplate = !isWebMode && !currentCode.trim();
  const displayCode = showTemplate ? (CODE_TEMPLATES[language] || '') : currentCode;
  const hasUnsavedChanges = currentDraft !== undefined && currentDraft !== (savedAnswer || '');

  useEffect(() => {
    if (!isWebMode && showTemplate && currentDraft === undefined) {
      const template = CODE_TEMPLATES[language] || '';
      if (template) onDraftChange(questionId, template);
    }
  }, [isWebMode, showTemplate, currentDraft, language, questionId, onDraftChange]);

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

  const handleWebEditorChange = useCallback((value: string | undefined) => {
    const v = value || '';
    let newHtml = webHtml;
    let newCss = webCss;
    let newJs = webJs;

    if (webActiveTab === 'html') { newHtml = v; setWebHtml(v); }
    else if (webActiveTab === 'css') { newCss = v; setWebCss(v); }
    else { newJs = v; setWebJs(v); }

    onDraftChange(questionId, serializeWebTabs(newHtml, newCss, newJs));
  }, [questionId, onDraftChange, webActiveTab, webHtml, webCss, webJs]);

  const getWebEditorValue = (): string => {
    if (webActiveTab === 'html') return webHtml;
    if (webActiveTab === 'css') return webCss;
    return webJs;
  };

  const getWebEditorLanguage = (): string => {
    if (webActiveTab === 'html') return 'html';
    if (webActiveTab === 'css') return 'css';
    return 'javascript';
  };

  const stopRunning = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsRunning(false);
    setCodeOutput({ output: 'Execution stopped by user.', error: true });
    abortControllerRef.current = null;
  }, []);

  const runCode = useCallback(async () => {
    if (isWebMode) {
      setHtmlPreview(true);
      setCodeOutput(null);
      return;
    }

    const code = currentDraft !== undefined ? currentDraft : (savedAnswer || '');
    if (!code.trim()) {
      setCodeOutput({ output: 'Error: Kode kosong!', error: true });
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

      if (!response.ok) throw new Error('Koneksi ke server eksekusi gagal.');

      const data = await response.json();

      if (data.compile?.stderr?.trim()) {
        setCodeOutput({ output: 'Compilation Error:\n' + String(data.compile.stderr), error: true });
        return;
      }

      if (data.run?.signal === 'SIGKILL') {
        setCodeOutput({
          output: 'Error: Program dihentikan karena timeout atau menggunakan memori berlebihan.\nKemungkinan infinite loop atau recursion tanpa batas.',
          error: true
        });
        return;
      }

      const hasStderr = data.run?.stderr?.trim();
      const hasStdout = data.run?.stdout?.trim();

      if (hasStderr && hasStdout) {
        setCodeOutput({ output: String(data.run.stdout) + '\n\nStderr:\n' + String(data.run.stderr), error: false });
      } else if (hasStderr) {
        setCodeOutput({ output: 'Error:\n' + String(data.run.stderr), error: true });
      } else {
        const out = data.run?.stdout;
        setCodeOutput({ output: out ? String(out) : 'Eksekusi berhasil tanpa output.', error: !out });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setCodeOutput({ output: 'Execution stopped by user.', error: true });
      } else {
        setCodeOutput({
          output: 'Error: ' + (err.message || 'Terjadi kesalahan.') + '\n\nPastikan koneksi internet Anda stabil.',
          error: true
        });
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  }, [isWebMode, currentDraft, savedAnswer, language]);

  const monacoLang = MONACO_LANGUAGE_MAP[language] || 'plaintext';
  const showPreviewPanel = isWebMode && htmlPreview;

  const webTabItems: { key: WebTab; label: string; icon: string }[] = [
    { key: 'html', label: 'index.html', icon: 'H' },
    { key: 'css', label: 'style.css', icon: 'C' },
    { key: 'js', label: 'script.js', icon: 'J' },
  ];

  const tabColorMap: Record<WebTab, string> = {
    html: 'text-orange-400',
    css: 'text-blue-400',
    js: 'text-yellow-400',
  };

  const editorOptions = {
    minimap: { enabled: false },
    wordWrap: 'on' as const,
    cursorStyle: 'line' as const,
    mouseStyle: 'text' as const,
    fontSize: 14,
    lineHeight: 22,
    padding: { top: 12, bottom: 12 },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    renderLineHighlight: 'line' as const,
    selectOnLineNumbers: true,
    roundedSelection: true,
    cursorBlinking: 'smooth' as const,
    cursorSmoothCaretAnimation: 'on' as const,
    smoothScrolling: true,
    contextmenu: false,
    folding: true,
    lineNumbersMinChars: 3,
    glyphMargin: false,
    suggest: { showSnippets: false, showWords: false },
    quickSuggestions: false,
    parameterHints: { enabled: false },
  };

  const resetWebTemplate = useCallback(() => {
    setWebHtml(WEB_DEFAULT_HTML);
    setWebCss(WEB_DEFAULT_CSS);
    setWebJs(WEB_DEFAULT_JS);
    onDraftChange(questionId, serializeWebTabs(WEB_DEFAULT_HTML, WEB_DEFAULT_CSS, WEB_DEFAULT_JS));
  }, [questionId, onDraftChange]);

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
              if (isWebMode) {
                resetWebTemplate();
              } else {
                onDraftChange(questionId, CODE_TEMPLATES[language] || '');
              }
            }}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition-colors"
          >
            Reset Template
          </button>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-sm text-yellow-400 animate-pulse">* Perubahan belum disimpan</span>
          )}
          {savedAnswer && !hasUnsavedChanges && (
            <span className="text-sm text-green-400">Tersimpan</span>
          )}
        </div>
      </div>

      {isWebMode ? (
        <WebModeLayout
          showPreview={showPreviewPanel}
          webTabItems={webTabItems}
          webActiveTab={webActiveTab}
          setWebActiveTab={setWebActiveTab}
          tabColorMap={tabColorMap}
          editorValue={getWebEditorValue()}
          editorLanguage={getWebEditorLanguage()}
          editorOptions={editorOptions}
          onEditorChange={handleWebEditorChange}
          onEditorMount={handleEditorMount}
          previewMode={previewMode}
          setPreviewMode={setPreviewMode}
          webHtml={webHtml}
          webCss={webCss}
          webJs={webJs}
          questionId={questionId}
          setHtmlPreview={setHtmlPreview}
        />
      ) : (
        <div>
          <div className="rounded-lg overflow-hidden border border-gray-600 shadow-lg">
            <Editor
              height="400px"
              language={monacoLang}
              value={displayCode}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={editorOptions}
            />
          </div>
        </div>
      )}

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
            {isWebMode ? (htmlPreview ? 'Refresh Preview' : 'Preview') : 'Run Code'}
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

      {codeOutput && !isWebMode && (
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

function WebModeLayout({
  showPreview,
  webTabItems,
  webActiveTab,
  setWebActiveTab,
  tabColorMap,
  editorValue,
  editorLanguage,
  editorOptions,
  onEditorChange,
  onEditorMount,
  previewMode,
  setPreviewMode,
  webHtml,
  webCss,
  webJs,
  questionId,
  setHtmlPreview,
}: {
  showPreview: boolean;
  webTabItems: { key: WebTab; label: string; icon: string }[];
  webActiveTab: WebTab;
  setWebActiveTab: (tab: WebTab) => void;
  tabColorMap: Record<WebTab, string>;
  editorValue: string;
  editorLanguage: string;
  editorOptions: any;
  onEditorChange: (value: string | undefined) => void;
  onEditorMount: OnMount;
  previewMode: 'desktop' | 'mobile';
  setPreviewMode: (mode: 'desktop' | 'mobile') => void;
  webHtml: string;
  webCss: string;
  webJs: string;
  questionId: string;
  setHtmlPreview: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex border-b border-gray-600 bg-gray-800 rounded-t-lg overflow-hidden">
          {webTabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setWebActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                webActiveTab === tab.key
                  ? `bg-gray-900 ${tabColorMap[tab.key]} border-current`
                  : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-750'
              }`}
            >
              <span className={`text-xs font-bold w-5 h-5 rounded flex items-center justify-center ${
                webActiveTab === tab.key ? 'bg-gray-700' : 'bg-gray-700/50'
              } ${tabColorMap[tab.key]}`}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="rounded-b-lg overflow-hidden border border-t-0 border-gray-600 shadow-lg">
          <Editor
            height="400px"
            language={editorLanguage}
            value={editorValue}
            onChange={onEditorChange}
            onMount={onEditorMount}
            theme="vs-dark"
            options={editorOptions}
          />
        </div>
      </div>

      {showPreview && (
        <div className="rounded-lg border border-gray-500 overflow-hidden flex flex-col bg-gray-800">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-600 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </div>
              <span className="text-sm font-bold text-gray-300">Live Preview</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-700 rounded overflow-hidden">
                <button
                  onClick={() => setPreviewMode('desktop')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    previewMode === 'desktop' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Desktop
                </button>
                <button
                  onClick={() => setPreviewMode('mobile')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    previewMode === 'mobile' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Mobile
                </button>
              </div>
              <button
                onClick={() => setHtmlPreview(false)}
                className="text-gray-400 hover:text-white text-xs transition-colors ml-1"
              >
                Tutup
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
              srcDoc={buildSecureWebPreview(webHtml, webCss, webJs)}
              title={`Web Preview ${questionId}`}
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
      )}
    </div>
  );
}
