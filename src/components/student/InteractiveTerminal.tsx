import { useState, useRef, useEffect, useCallback } from 'react';

interface InteractiveTerminalProps {
  language: string;
  code: string;
  onClose: () => void;
}

interface TerminalLine {
  type: 'output' | 'input' | 'error' | 'system';
  text: string;
}

function detectInputCount(code: string): number {
  const cinMatches = code.match(/\bcin\s*>>/g) || [];
  const getlineMatches = code.match(/\bgetline\s*\(/g) || [];
  const scanfMatches = code.match(/\bscanf\s*\(/g) || [];
  return cinMatches.length + getlineMatches.length + scanfMatches.length;
}

function hasInputStatements(code: string): boolean {
  return /\bcin\s*>>|\bgetline\s*\(|\bscanf\s*\(/.test(code);
}

export default function InteractiveTerminal({ language, code, onClose }: InteractiveTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [stdinBuffer, setStdinBuffer] = useState<string[]>([]);
  const [isWaitingInput, setIsWaitingInput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [expectedInputs] = useState(() => detectInputCount(code));
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  useEffect(() => {
    if (isWaitingInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isWaitingInput]);

  const executeCode = useCallback(async (stdin: string) => {
    setIsRunning(true);
    setIsWaitingInput(false);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const pistonConfig: Record<string, { language: string; version: string }> = {
        python: { language: 'python', version: '3.10.0' },
        php: { language: 'php', version: '8.2.3' },
        cpp: { language: 'c++', version: '10.2.0' },
      };

      const config = pistonConfig[language];
      if (!config) {
        setLines(prev => [...prev, { type: 'error', text: 'Bahasa tidak didukung untuk mode interaktif.' }]);
        setIsRunning(false);
        setIsComplete(true);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(`${supabaseUrl}/functions/v1/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          language: config.language,
          version: config.version,
          files: [{ content: code }],
          stdin: stdin
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        setLines(prev => [...prev, { type: 'error', text: `Error: Server mengembalikan status ${response.status}` }]);
        setIsRunning(false);
        setIsComplete(true);
        return;
      }

      const data = await response.json();

      if (data.compile?.stderr?.trim()) {
        setLines(prev => [...prev, { type: 'error', text: 'Compilation Error:\n' + data.compile.stderr }]);
        setIsRunning(false);
        setIsComplete(true);
        return;
      }

      if (data.run?.signal === 'SIGKILL') {
        setLines(prev => [...prev, {
          type: 'error',
          text: 'Program dihentikan (timeout/memory limit).\nKemungkinan infinite loop atau input kurang.'
        }]);
        setIsRunning(false);
        setIsComplete(true);
        return;
      }

      const stdout = data.run?.stdout || '';
      const stderr = data.run?.stderr || '';

      if (stdout) {
        const outputLines = stdout.split('\n');
        setLines(prev => [...prev, ...outputLines.map((l: string) => ({ type: 'output' as const, text: l }))]);
      }

      if (stderr?.trim()) {
        setLines(prev => [...prev, { type: 'error', text: stderr }]);
      }

      if (!stdout && !stderr?.trim()) {
        setLines(prev => [...prev, { type: 'system', text: '(Program selesai tanpa output)' }]);
      }

      setIsRunning(false);
      setIsComplete(true);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setLines(prev => [...prev, {
          type: 'error',
          text: 'Timeout: Program membutuhkan waktu terlalu lama.\nPastikan input yang diberikan sudah cukup.'
        }]);
      } else {
        setLines(prev => [...prev, { type: 'error', text: 'Error: ' + (err.message || 'Koneksi gagal') }]);
      }
      setIsRunning(false);
      setIsComplete(true);
    }
  }, [code, language]);

  useEffect(() => {
    if (hasInputStatements(code)) {
      setLines([
        { type: 'system', text: `Program membutuhkan ${expectedInputs} input.` },
        { type: 'system', text: 'Masukkan semua input (satu per baris), lalu tekan "Run Program".' },
        { type: 'system', text: 'Atau masukkan input satu per satu dengan Enter.' },
      ]);
      setIsWaitingInput(true);
    } else {
      setLines([{ type: 'system', text: 'Menjalankan program...' }]);
      executeCode('');
    }
  }, [code, expectedInputs, executeCode]);

  const handleInputSubmit = useCallback(() => {
    if (!inputValue.trim() && !inputValue) return;

    const newInput = inputValue;
    setLines(prev => [...prev, { type: 'input', text: `> ${newInput}` }]);
    setStdinBuffer(prev => [...prev, newInput]);
    setInputValue('');

    const currentCount = stdinBuffer.length + 1;
    if (currentCount >= expectedInputs) {
      const allInputs = [...stdinBuffer, newInput].join('\n');
      setLines(prev => [...prev, { type: 'system', text: 'Menjalankan program...' }]);
      executeCode(allInputs);
    }
  }, [inputValue, stdinBuffer, expectedInputs, executeCode]);

  const handleRunWithCurrentInputs = useCallback(() => {
    const allInputs = stdinBuffer.join('\n');
    setLines(prev => [...prev, { type: 'system', text: 'Menjalankan program dengan input yang tersedia...' }]);
    executeCode(allInputs);
  }, [stdinBuffer, executeCode]);

  const handleReset = useCallback(() => {
    setLines([]);
    setStdinBuffer([]);
    setInputValue('');
    setIsComplete(false);
    setIsRunning(false);

    if (hasInputStatements(code)) {
      setLines([
        { type: 'system', text: `Program membutuhkan ${expectedInputs} input.` },
        { type: 'system', text: 'Masukkan semua input (satu per baris), lalu tekan "Run Program".' },
        { type: 'system', text: 'Atau masukkan input satu per satu dengan Enter.' },
      ]);
      setIsWaitingInput(true);
    } else {
      setLines([{ type: 'system', text: 'Menjalankan program...' }]);
      executeCode('');
    }
  }, [code, expectedInputs, executeCode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInputSubmit();
    }
  }, [handleInputSubmit]);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-600 shadow-xl">
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-600">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>
          <span className="text-sm font-mono text-gray-300">Interactive Terminal</span>
          {isRunning && <span className="text-xs text-yellow-400 animate-pulse ml-2">Running...</span>}
          {isComplete && <span className="text-xs text-green-400 ml-2">Selesai</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>

      <div
        ref={terminalRef}
        className="bg-gray-950 p-4 min-h-[200px] max-h-[400px] overflow-auto font-mono text-sm"
      >
        {lines.map((line, idx) => (
          <div key={idx} className={`leading-relaxed ${
            line.type === 'output' ? 'text-green-400' :
            line.type === 'input' ? 'text-cyan-300' :
            line.type === 'error' ? 'text-red-400' :
            'text-gray-500 italic'
          }`} style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
            {line.text}
          </div>
        ))}

        {isWaitingInput && !isRunning && !isComplete && (
          <div className="flex items-center gap-0 mt-1">
            <span className="text-cyan-400">&gt; </span>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-cyan-300 outline-none border-none font-mono text-sm caret-cyan-400"
              placeholder="Ketik input lalu tekan Enter..."
              autoFocus
            />
          </div>
        )}

        {isRunning && (
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-yellow-400 text-xs">Mengeksekusi...</span>
          </div>
        )}
      </div>

      {isWaitingInput && !isRunning && !isComplete && (
        <div className="bg-gray-800 px-4 py-2 border-t border-gray-600 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            Input: {stdinBuffer.length}/{expectedInputs}
          </div>
          <div className="flex items-center gap-2">
            {stdinBuffer.length > 0 && (
              <button
                onClick={handleRunWithCurrentInputs}
                className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded transition-colors"
              >
                Run Program ({stdinBuffer.length} input)
              </button>
            )}
            <span className="text-xs text-gray-500">Enter = tambah input</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { hasInputStatements, detectInputCount };
