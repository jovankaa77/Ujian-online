export const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  python: 'Pemograman Python',
  php: 'Pemograman PHP',
  cpp: 'C++',
  htmlcss: 'HTML, CSS Dan Javascript',
};

export const PISTON_CONFIG: Record<string, { language: string; version: string }> = {
  python: { language: 'python', version: '3.10.0' },
  php: { language: 'php', version: '8.2.3' },
  cpp: { language: 'c++', version: '10.2.0' },
};

export type TermLineType = 'system' | 'output' | 'error' | 'input' | 'prompt';
export interface TermLine { text: string; type: TermLineType }

export interface RunResult {
  stdout: string;
  stderr: string;
  compileErr: string;
  signal: string | null;
  httpErr: string | null;
}

export async function callPiston(language: string, code: string, stdin: string): Promise<RunResult> {
  const cfg = PISTON_CONFIG[language];
  if (!cfg) return { stdout: '', stderr: '', compileErr: '', signal: null, httpErr: 'Bahasa tidak didukung.' };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/run-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({ language: cfg.language, version: cfg.version, files: [{ content: code }], stdin }),
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
}

export function buildTerminalLines(result: RunResult): TermLine[] {
  const lines: TermLine[] = [];

  if (result.httpErr) {
    lines.push({ text: 'Error: ' + result.httpErr, type: 'error' });
    return lines;
  }
  if (result.compileErr.trim()) {
    lines.push({ text: result.compileErr.trim(), type: 'error' });
    return lines;
  }
  if (result.signal === 'SIGKILL') {
    lines.push({ text: 'Program dihentikan paksa (timeout / memory limit). Periksa infinite loop.', type: 'error' });
    return lines;
  }

  const out = result.stdout.trimEnd();
  if (out) lines.push({ text: out, type: 'output' });
  if (result.stderr.trim()) {
    if (out) lines.push({ text: '', type: 'output' });
    lines.push({ text: result.stderr.trim(), type: 'error' });
  }
  if (!out && !result.stderr.trim()) {
    lines.push({ text: '(Program selesai tanpa output)', type: 'system' });
  }
  return lines;
}

const JS_WORKER_CODE = `
self.onmessage = function(e) {
  const code = e.data.code;
  const logs = [];
  const errors = [];

  const fakeConsole = {
    log: function() {
      const args = Array.prototype.slice.call(arguments);
      logs.push(args.map(function(a) {
        if (typeof a === 'object') {
          try { return JSON.stringify(a, null, 2); } catch(err) { return String(a); }
        }
        return String(a);
      }).join(' '));
    },
    error: function() { errors.push(Array.prototype.slice.call(arguments).map(String).join(' ')); },
    warn: function() { logs.push('[WARN] ' + Array.prototype.slice.call(arguments).map(String).join(' ')); },
    info: function() { logs.push('[INFO] ' + Array.prototype.slice.call(arguments).map(String).join(' ')); },
  };

  const blocked = '[DIBLOKIR] Fungsi ini diblokir untuk keamanan ujian.';
  const fakeWindow = {
    alert: function() { logs.push(blocked + ' (alert)'); },
    confirm: function() { logs.push(blocked + ' (confirm)'); return false; },
    prompt: function() { logs.push(blocked + ' (prompt)'); return null; },
    open: function() { logs.push(blocked + ' (window.open)'); return null; },
    close: function() { logs.push(blocked + ' (window.close)'); },
    print: function() { logs.push(blocked + ' (print)'); },
    location: { href: '', assign: function() {}, replace: function() {}, reload: function() {} },
    document: { write: function() {}, writeln: function() {}, cookie: '' },
    localStorage: { getItem: function() { return null; }, setItem: function() {}, removeItem: function() {}, clear: function() {} },
    sessionStorage: { getItem: function() { return null; }, setItem: function() {}, removeItem: function() {}, clear: function() {} },
    fetch: function() { return Promise.reject(new Error('fetch diblokir')); },
    XMLHttpRequest: function() {},
  };

  try {
    const fn = new Function('fakeConsole', 'fakeWindow', 'document', 'alert', 'confirm', 'prompt', 'fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage',
      '(function(console, window, document, alert, confirm, prompt, fetch, XMLHttpRequest, localStorage, sessionStorage) {' + code + '\\n})(fakeConsole, fakeWindow, fakeWindow.document, fakeWindow.alert, fakeWindow.confirm, fakeWindow.prompt, fakeWindow.fetch, fakeWindow.XMLHttpRequest, fakeWindow.localStorage, fakeWindow.sessionStorage);'
    );
    fn(fakeConsole, fakeWindow, fakeWindow.document, fakeWindow.alert, fakeWindow.confirm, fakeWindow.prompt, fakeWindow.fetch, fakeWindow.XMLHttpRequest, fakeWindow.localStorage, fakeWindow.sessionStorage);
    self.postMessage({ success: true, output: logs.join('\\n'), errors: errors.join('\\n') });
  } catch(err) {
    self.postMessage({ success: false, output: logs.join('\\n'), errors: err.toString() });
  }
};
`;

export function executeJavaScriptInWorker(code: string, timeout = 3000): Promise<{ output: string; error: boolean }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([JS_WORKER_CODE], { type: 'application/javascript' }));
    const worker = new Worker(url);

    const timer = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ output: 'Error: Waktu eksekusi habis (Timeout 3 detik).\nKemungkinan kode Anda memiliki perulangan tanpa henti (Infinite Loop).', error: true });
    }, timeout);

    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      const { success, output, errors } = e.data;
      if (success) {
        resolve(errors
          ? { output: output + (output ? '\n' : '') + 'Errors:\n' + errors, error: true }
          : { output: output || '(Eksekusi berhasil tanpa output)', error: false }
        );
      } else {
        resolve({ output: (output ? output + '\n' : '') + 'Error: ' + errors, error: true });
      }
    };

    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ output: 'Worker Error: ' + e.message, error: true });
    };

    worker.postMessage({ code });
  });
}
