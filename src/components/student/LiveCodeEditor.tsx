import { useRef, useCallback, useState, useEffect, useLayoutEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  python: 'Pemograman Python',
  php: 'Pemograman PHP',
  cpp: 'C++',
  htmlcss: 'HTML, CSS Dan Javascript'
};

const CODE_TEMPLATES: Record<string, string> = {
  javascript: `// JavaScript Hello World\nconsole.log("Hello, World!");`,
  python: `# Python Hello World\nprint("Hello, World!")`,
  php: `<?php\n// PHP Hello World\necho "Hello, World!";\n?>`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`
};

const WEB_DEFAULT_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kerangka Sederhana</title>
</head>
<body>
  <h1>Hello world!</h1>
</body>
</html>`;

const WEB_DEFAULT_CSS = `/* Reset dasar untuk menghilangkan margin dan padding default */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* Mengatur body secara keseluruhan */
body {
  font-family: 'Arial', sans-serif;
  line-height: 1.6;
  background-color: #f4f4f4;
  color: #333;
  min-height: 100vh;
}

@media (max-width: 768px) {

}`;

const WEB_DEFAULT_JS = `// JavaScript\nconsole.log("Hello from script.js");`;

const MONACO_LANGUAGE_MAP: Record<string, string> = {
  javascript: 'javascript',
  python: 'python',
  php: 'php',
  cpp: 'cpp',
  htmlcss: 'html'
};

const PISTON_CONFIG: Record<string, { language: string; version: string }> = {
  python: { language: 'python', version: '3.10.0' },
  php: { language: 'php', version: '8.2.3' },
  cpp: { language: 'c++', version: '10.2.0' }
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
  const securityScript = `
(function() {
  var WARNING_DURATION = 4000;
  var warningEl = null;
  var warningTimeout = null;

  function showNavigationWarning(msg) {
    if (warningEl) { warningEl.remove(); clearTimeout(warningTimeout); }
    warningEl = document.createElement('div');
    warningEl.textContent = msg || 'Element yang anda klik menyebabkan keluar halaman';
    warningEl.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#dc2626;color:#fff;padding:10px 16px;font-size:14px;font-family:sans-serif;font-weight:600;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    document.body.appendChild(warningEl);
    warningTimeout = setTimeout(function() { if (warningEl) { warningEl.remove(); warningEl = null; } }, WARNING_DURATION);
  }

  function showInPageDialog(type, message, defaultVal) {
    return new Promise(function(resolve) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-family:sans-serif;';
      var box = document.createElement('div');
      box.style.cssText = 'background:#fff;border-radius:8px;padding:20px 24px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
      var titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-size:11px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;';
      titleEl.textContent = type === 'alert' ? 'Alert' : type === 'confirm' ? 'Confirm' : 'Prompt';
      box.appendChild(titleEl);
      var msgEl = document.createElement('div');
      msgEl.style.cssText = 'font-size:14px;color:#333;margin-bottom:16px;white-space:pre-wrap;word-break:break-word;';
      msgEl.textContent = message || '';
      box.appendChild(msgEl);

      var input = null;
      if (type === 'prompt') {
        input = document.createElement('input');
        input.type = 'text';
        input.value = defaultVal != null ? String(defaultVal) : '';
        input.style.cssText = 'width:100%;padding:8px 10px;border:1px solid #ccc;border-radius:4px;font-size:14px;margin-bottom:12px;box-sizing:border-box;outline:none;';
        input.addEventListener('focus', function() { input.style.borderColor = '#3b82f6'; });
        input.addEventListener('blur', function() { input.style.borderColor = '#ccc'; });
        box.appendChild(input);
      }

      var btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';

      if (type === 'alert') {
        var okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.cssText = 'padding:6px 20px;background:#3b82f6;color:#fff;border:none;border-radius:4px;font-size:13px;cursor:pointer;';
        okBtn.onclick = function() { overlay.remove(); resolve(undefined); };
        btnRow.appendChild(okBtn);
      } else {
        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding:6px 16px;background:#e5e7eb;color:#333;border:none;border-radius:4px;font-size:13px;cursor:pointer;';
        cancelBtn.onclick = function() { overlay.remove(); resolve(type === 'confirm' ? false : null); };
        btnRow.appendChild(cancelBtn);
        var okBtn2 = document.createElement('button');
        okBtn2.textContent = 'OK';
        okBtn2.style.cssText = 'padding:6px 20px;background:#3b82f6;color:#fff;border:none;border-radius:4px;font-size:13px;cursor:pointer;';
        okBtn2.onclick = function() { overlay.remove(); resolve(type === 'confirm' ? true : (input ? input.value : '')); };
        btnRow.appendChild(okBtn2);
      }

      box.appendChild(btnRow);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      if (input) input.focus();
    });
  }

  window.alert = function(msg) {
    showInPageDialog('alert', msg != null ? String(msg) : '');
  };
  window.confirm = function(msg) {
    showInPageDialog('confirm', msg != null ? String(msg) : '');
    return false;
  };
  window.prompt = function(msg, def) {
    showInPageDialog('prompt', msg != null ? String(msg) : '', def);
    return null;
  };

  window.open = function(url) {
    if (url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('//'))) {
      showNavigationWarning();
    }
    return null;
  };
  window.print = function() {};

  var locDesc = Object.getOwnPropertyDescriptor(window, 'location');
  var fakeLocation = {
    get href() { return ''; },
    set href(v) { showNavigationWarning(); },
    assign: function() { showNavigationWarning(); },
    replace: function() { showNavigationWarning(); },
    reload: function() {}
  };
  try {
    Object.defineProperty(window, 'location', {
      get: function() { return fakeLocation; },
      set: function() { showNavigationWarning(); },
      configurable: true
    });
  } catch(e) {}

  var origDocWrite = document.write.bind(document);
  document.write = function(content) {
    if (typeof content === 'string' && (content.indexOf('http-equiv') !== -1 || content.indexOf('url=') !== -1 || content.indexOf('location') !== -1)) {
      showNavigationWarning();
      return;
    }
    origDocWrite(content);
  };
  document.writeln = document.write;

  document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target !== document.body) {
      if (target.tagName === 'A') {
        var href = target.getAttribute('href');
        if (href && href !== '#' && !href.startsWith('#') && !href.startsWith('javascript:void')) {
          e.preventDefault();
          e.stopPropagation();
          showNavigationWarning();
          return;
        }
      }
      target = target.parentElement;
    }
  }, true);

  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form && form.tagName === 'FORM') {
      var action = (form.getAttribute('action') || '').trim();
      if (action && action !== '#' && !action.startsWith('#')) {
        e.preventDefault();
        e.stopPropagation();
        showNavigationWarning();
        return;
      }
    }
  }, true);

  document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target !== document.body) {
      if (target.tagName === 'BUTTON' || target.tagName === 'INPUT') {
        var onclickAttr = target.getAttribute('onclick') || '';
        if (onclickAttr) {
          var dangerous = /(window\\.open|window\\.location|document\\.location|location\\.href|location\\.assign|location\\.replace|document\\.write|closeModal|openModal)/.test(onclickAttr);
          if (dangerous) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            showNavigationWarning();
            return;
          }
        }
      }
      target = target.parentElement;
    }
  }, true);

  var origAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'click' && typeof listener === 'function') {
      var wrappedListener = function(e) {
        var result = listener.call(this, e);
        return result;
      };
      return origAddEventListener.call(this, type, wrappedListener, options);
    }
    return origAddEventListener.call(this, type, listener, options);
  };

  var allMetas = document.querySelectorAll('meta[http-equiv="refresh"]');
  for (var i = 0; i < allMetas.length; i++) { allMetas[i].remove(); }
  new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.tagName === 'META' && node.getAttribute && node.getAttribute('http-equiv') === 'refresh') {
          node.remove();
          showNavigationWarning();
        }
        if (node.tagName === 'A') {
          var href = node.getAttribute('href');
          if (href && href !== '#' && !href.startsWith('#') && !href.startsWith('javascript:void')) {
            node.addEventListener('click', function(e) { e.preventDefault(); showNavigationWarning(); });
          }
        }
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

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
})();`;

  return `<html>
<head>
<script>${securityScript}<\/script>
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

function createJSWorkerCode(): string {
  return `
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

      const blockedMsg = '[DIBLOKIR] Fungsi ini diblokir untuk keamanan ujian.';
      const fakeWindow = {
        alert: function() { logs.push(blockedMsg + ' (alert)'); },
        confirm: function() { logs.push(blockedMsg + ' (confirm)'); return false; },
        prompt: function() { logs.push(blockedMsg + ' (prompt)'); return null; },
        open: function() { logs.push(blockedMsg + ' (window.open)'); return null; },
        close: function() { logs.push(blockedMsg + ' (window.close)'); },
        print: function() { logs.push(blockedMsg + ' (print)'); },
        location: {
          href: '',
          assign: function() { logs.push(blockedMsg + ' (location.assign)'); },
          replace: function() { logs.push(blockedMsg + ' (location.replace)'); },
          reload: function() { logs.push(blockedMsg + ' (location.reload)'); }
        },
        document: {
          write: function() { logs.push(blockedMsg + ' (document.write)'); },
          writeln: function() { logs.push(blockedMsg + ' (document.writeln)'); },
          cookie: ''
        },
        localStorage: {
          getItem: function() { return null; },
          setItem: function() { logs.push(blockedMsg + ' (localStorage)'); },
          removeItem: function() {},
          clear: function() {}
        },
        sessionStorage: {
          getItem: function() { return null; },
          setItem: function() { logs.push(blockedMsg + ' (sessionStorage)'); },
          removeItem: function() {},
          clear: function() {}
        },
        fetch: function() { logs.push(blockedMsg + ' (fetch)'); return Promise.reject(new Error('fetch diblokir')); },
        XMLHttpRequest: function() { logs.push(blockedMsg + ' (XMLHttpRequest)'); },
        safeEval: function() { logs.push(blockedMsg + ' (eval)'); },
        SafeFunction: function() { logs.push(blockedMsg + ' (Function constructor)'); }
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
}

function executeJavaScriptInWorker(code: string, timeout: number = 3000): Promise<{ output: string; error: boolean }> {
  return new Promise((resolve) => {
    const blob = new Blob([createJSWorkerCode()], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    const timeoutId = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      resolve({
        output: 'Error: Waktu eksekusi habis (Timeout 3 detik).\nKemungkinan kode Anda memiliki perulangan tanpa henti (Infinite Loop).\nHarap periksa kembali logika loop Anda.',
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

// Terminal line types:
// 'system'  — dim gray  — compile/run commands like "$ g++ ..."
// 'output'  — white     — program stdout
// 'error'   — red       — errors/stderr
// 'input'   — cyan      — echoed user input (after submission)
// 'prompt'  — white     — live prompt text waiting for input (rendered inline with input field)
type TermLineType = 'system' | 'output' | 'error' | 'input' | 'prompt';
interface TermLine { text: string; type: TermLineType }

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
  const [isRunning, setIsRunning] = useState(false);
  const [htmlPreview, setHtmlPreview] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // ── Terminal state ──────────────────────────────────────────────
  const [termOpen, setTermOpen] = useState(false);
  const [termLines, setTermLines] = useState<TermLine[]>([]);
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [termInput, setTermInput] = useState('');
  // Remaining prompt texts queued for collection
  const pendingPrompts = useRef<string[]>([]);
  // Accumulated [prompt, value] pairs for final merge
  const collectedPairs = useRef<{ prompt: string; value: string }[]>([]);
  const termInputRef = useRef<HTMLInputElement>(null);
  const termEndRef = useRef<HTMLDivElement>(null);
  // ────────────────────────────────────────────────────────────────

  const isWebMode = language === 'htmlcss';
  const isJavaScript = language === 'javascript';

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

  // Auto-scroll terminal to bottom
  useLayoutEffect(() => {
    termEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [termLines, awaitingInput]);

  // Focus input when awaiting
  useEffect(() => {
    if (awaitingInput) termInputRef.current?.focus();
  }, [awaitingInput]);

  // ── Helpers ─────────────────────────────────────────────────────
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

  // Merge typed values back into stdout to produce realistic terminal output.
  // Piston doesn't echo stdin — we reconstruct by finding each prompt string in
  // stdout and appending the typed value right after it on the same line.
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
      // No prompt text or not found — just echo the value on its own line
      parts.push(value + '\n');
    }
    const tail = remaining.replace(/^\n/, '').trimEnd();
    if (tail) parts.push(tail);
    return parts.join('');
  }

  function addLines(lines: TermLine[]) {
    setTermLines(prev => [...prev, ...lines]);
  }

  function replaceLoadingLine(lines: TermLine[]) {
    setTermLines(prev => {
      const filtered = prev.filter(l => l.text !== '...');
      return [...filtered, ...lines];
    });
  }
  // ────────────────────────────────────────────────────────────────

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

  // ── Core execute call ────────────────────────────────────────────
  const callRunCode = useCallback(async (code: string, stdin: string): Promise<{
    stdout: string; stderr: string; compileErr: string; signal: string | null; httpErr: string | null;
  }> => {
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
        const msg = res.status === 429 ? 'Terlalu banyak request, tunggu sebentar.'
          : res.status >= 500 ? 'Server eksekusi sedang bermasalah.'
          : `Server error ${res.status}`;
        return { stdout: '', stderr: '', compileErr: '', signal: null, httpErr: msg };
      }
      const data = await res.json();
      return {
        stdout: String(data.run?.stdout || ''),
        stderr: String(data.run?.stderr || ''),
        compileErr: String(data.compile?.stderr || ''),
        signal: data.run?.signal ?? null,
        httpErr: null,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const msg = err.name === 'AbortError' ? 'Timeout (20 detik). Kemungkinan infinite loop.'
        : err.name === 'TypeError' ? 'Tidak dapat terhubung ke server.'
        : err.message || 'Terjadi kesalahan tidak diketahui.';
      return { stdout: '', stderr: '', compileErr: '', signal: null, httpErr: msg };
    }
  }, [language]);

  // ── Build final terminal output after execution ──────────────────
  const buildTerminalOutput = useCallback((
    stdout: string,
    stderr: string,
    compileErr: string,
    signal: string | null,
    httpErr: string | null,
    pairs: { prompt: string; value: string }[]
  ): TermLine[] => {
    const lines: TermLine[] = [];
    if (httpErr) {
      lines.push({ text: 'Error: ' + httpErr, type: 'error' });
      return lines;
    }
    if (compileErr.trim()) {
      lines.push({ text: compileErr.trim(), type: 'error' });
      return lines;
    }
    if (signal === 'SIGKILL') {
      lines.push({ text: 'Program dihentikan paksa (timeout / memory limit). Periksa infinite loop.', type: 'error' });
      return lines;
    }
    const merged = pairs.length > 0 ? mergeStdinIntoOutput(stdout, pairs) : stdout;
    const finalOut = merged.trimEnd();
    if (finalOut) lines.push({ text: finalOut, type: 'output' });
    if (stderr.trim()) {
      if (finalOut) lines.push({ text: '', type: 'output' });
      lines.push({ text: stderr.trim(), type: 'error' });
    }
    if (!finalOut && !stderr.trim()) {
      lines.push({ text: '(Program selesai tanpa output)', type: 'system' });
    }
    return lines;
  }, []);

  // ── Main run handler ─────────────────────────────────────────────
  const runCode = useCallback(async () => {
    if (isWebMode) { setHtmlPreview(true); return; }

    const code = currentDraft !== undefined ? currentDraft : (savedAnswer || '');
    if (!code.trim()) {
      setTermOpen(true);
      setTermLines([{ text: 'Error: Kode kosong!', type: 'error' }]);
      return;
    }

    // Reset terminal
    setTermOpen(true);
    setTermLines([]);
    setTermInput('');
    setAwaitingInput(false);
    pendingPrompts.current = [];
    collectedPairs.current = [];
    setIsRunning(true);

    if (isJavaScript) {
      setTermLines([{ text: 'Running JavaScript...', type: 'system' }]);
      const result = await executeJavaScriptInWorker(code, 3000);
      setTermLines([
        { text: 'Running JavaScript...', type: 'system' },
        { text: result.output, type: result.error ? 'error' : 'output' },
      ]);
      setIsRunning(false);
      return;
    }

    const pistonConfig = PISTON_CONFIG[language];
    if (!pistonConfig) {
      setTermLines([{ text: 'Bahasa tidak didukung.', type: 'error' }]);
      setIsRunning(false);
      return;
    }

    const langLabel = language === 'cpp' ? 'C++' : language;
    const cinCount = detectCinCount(code, language);

    // Show compile animation
    setTermLines([{ text: `Compiling ${langLabel}...`, type: 'system' }]);
    await new Promise(r => setTimeout(r, 300));

    if (cinCount > 0) {
      // Needs input — collect before running
      const prompts = extractPromptTexts(code, language);
      pendingPrompts.current = prompts.slice(1);
      setTermLines([
        { text: `Compiling ${langLabel}...`, type: 'system' },
        { text: `Running...`, type: 'system' },
        { text: prompts[0], type: 'prompt' },
      ]);
      setAwaitingInput(true);
      setIsRunning(false);
    } else {
      // No input needed — run directly
      setTermLines([
        { text: `Compiling ${langLabel}...`, type: 'system' },
        { text: `Running...`, type: 'system' },
        { text: '...', type: 'system' },
      ]);
      const result = await callRunCode(code, '');
      const outLines = buildTerminalOutput(result.stdout, result.stderr, result.compileErr, result.signal, result.httpErr, []);
      setTermLines([
        { text: `Compiling ${langLabel}...`, type: 'system' },
        { text: `Running...`, type: 'system' },
        ...outLines,
      ]);
      setIsRunning(false);
    }
  }, [isWebMode, isJavaScript, currentDraft, savedAnswer, language, callRunCode, buildTerminalOutput]);

  // ── Handle stdin submission ──────────────────────────────────────
  const handleTerminalSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const value = termInput;
    const code = currentDraft !== undefined ? currentDraft : (savedAnswer || '');

    // Grab current prompt text from last 'prompt' line
    setTermLines(prev => {
      const lastPromptIdx = [...prev].map(l => l.type).lastIndexOf('prompt');
      if (lastPromptIdx === -1) return [...prev, { text: value, type: 'input' as TermLineType }];
      const updated = [...prev];
      // Echo: prompt text + typed value on same line as 'input'
      updated[lastPromptIdx] = { text: updated[lastPromptIdx].text + value, type: 'input' };
      return updated;
    });
    setTermInput('');

    collectedPairs.current = [
      ...collectedPairs.current,
      {
        prompt: termLines.slice().reverse().find(l => l.type === 'prompt')?.text ?? '',
        value,
      },
    ];

    if (pendingPrompts.current.length > 0) {
      const next = pendingPrompts.current.shift()!;
      setTermLines(prev => [...prev, { text: next, type: 'prompt' }]);
    } else {
      // All inputs collected — execute
      setAwaitingInput(false);
      setIsRunning(true);
      const stdinString = collectedPairs.current.map(p => p.value).join('\n') + '\n';
      addLines([{ text: '...', type: 'system' }]);

      const langLabel = language === 'cpp' ? 'C++' : language;
      const result = await callRunCode(code, stdinString);
      const outLines = buildTerminalOutput(result.stdout, result.stderr, result.compileErr, result.signal, result.httpErr, collectedPairs.current);
      setTermLines(prev => {
        const filtered = prev.filter(l => l.text !== '...' || l.type !== 'system');
        return [...filtered, ...outLines];
      });
      setIsRunning(false);
      // Show exit line
      setTermLines(prev => [...prev, { text: `\n[Program selesai, exit code 0]`, type: 'system' }]);
    }
  }, [termInput, termLines, language, currentDraft, savedAnswer, callRunCode, buildTerminalOutput]);

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
          {isJavaScript && (
            <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">
              Client-side
            </span>
          )}
          {(language === 'python' || language === 'php' || language === 'cpp') && (
            <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
              Server-side
            </span>
          )}
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

      <div className="flex gap-2 flex-wrap items-center">
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
        {!isWebMode && (
          <button
            onClick={runCode}
            disabled={isRunning || awaitingInput}
            className={`flex items-center gap-2 font-bold py-2 px-5 rounded transition-all text-sm shadow ${
              isRunning || awaitingInput
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
                Run
              </>
            )}
          </button>
        )}
        {isWebMode && (
          <button
            onClick={runCode}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
          >
            {htmlPreview ? 'Refresh Preview' : 'Preview'}
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

      {termOpen && !isWebMode && (
        <div className="rounded-lg overflow-hidden border border-gray-700 shadow-xl">
          {/* Terminal header — mimics OnlineGDB */}
          <div className="flex items-center justify-between bg-[#1a1a1a] px-4 py-2 border-b border-gray-700">
            <div className="flex items-center gap-3">
              {/* macOS-style traffic lights */}
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500 opacity-80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500 opacity-80" />
                <span className="w-3 h-3 rounded-full bg-green-500 opacity-80" />
              </div>
              <span className="text-xs font-mono text-gray-400 select-none">
                {language === 'cpp' ? 'C++ Terminal' : language === 'python' ? 'Python Terminal' : 'Terminal'}
              </span>
              {isRunning && (
                <span className="flex items-center gap-1 text-xs text-yellow-400 font-mono">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  running
                </span>
              )}
              {awaitingInput && !isRunning && (
                <span className="text-xs text-cyan-400 font-mono animate-pulse">● stdin</span>
              )}
            </div>
            <button
              onClick={() => {
                setTermOpen(false);
                setTermLines([]);
                setTermInput('');
                setAwaitingInput(false);
                pendingPrompts.current = [];
                collectedPairs.current = [];
                setIsRunning(false);
              }}
              className="text-gray-500 hover:text-gray-200 transition-colors text-xs px-2 py-0.5 rounded hover:bg-gray-700"
              title="Tutup terminal"
            >
              ✕
            </button>
          </div>

          {/* Terminal body */}
          <div
            className="bg-[#0d0d0d] font-mono text-sm leading-relaxed overflow-auto"
            style={{ minHeight: '160px', maxHeight: '340px', padding: '12px 16px' }}
            onClick={() => awaitingInput && termInputRef.current?.focus()}
          >
            {termLines.map((line, i) => {
              const colorClass =
                line.type === 'system'  ? 'text-gray-500' :
                line.type === 'error'   ? 'text-red-400' :
                line.type === 'input'   ? 'text-cyan-300' :
                line.type === 'prompt'  ? 'text-gray-100' :
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

            {/* Inline input row — appears right after the last prompt line */}
            {awaitingInput && (
              <form onSubmit={handleTerminalSubmit} className="flex items-center mt-0">
                <input
                  ref={termInputRef}
                  type="text"
                  value={termInput}
                  onChange={e => setTermInput(e.target.value)}
                  className="bg-transparent border-none outline-none text-cyan-200 font-mono text-sm flex-1 caret-cyan-400"
                  style={{ minWidth: 0 }}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder=""
                />
                <span className="text-cyan-400 animate-[blink_1s_step-end_infinite] ml-0.5 select-none">█</span>
              </form>
            )}

            <div ref={termEndRef} />
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
            <iframe
              srcDoc={buildSecureWebPreview(webHtml, webCss, webJs)}
              title={`Web Preview ${questionId}`}
              sandbox="allow-scripts"
              className="border-0 bg-white transition-all duration-300"
              style={{
                width: previewMode === 'mobile' ? '375px' : '100%',
                height: '100%',
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
