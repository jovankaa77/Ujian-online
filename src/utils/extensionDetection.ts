// Extension Detection Utility
// Deteksi ekstensi browser yang dapat membantu dalam ujian

export interface ExtensionInfo {
  name: string;
  id: string;
  detected: boolean;
  risk: 'high' | 'medium' | 'low';
  description: string;
}

export interface ExtensionDetectionResult {
  hasRiskyExtensions: boolean;
  detectedExtensions: ExtensionInfo[];
  totalExtensions: number;
}

// Daftar ekstensi yang dilarang atau berisiko tinggi
const RISKY_EXTENSIONS = [
  // AI Assistants
  { name: 'Monica AI', patterns: ['monica', 'ai-assistant'], risk: 'high' as const, description: 'AI Assistant yang dapat membantu menjawab soal' },
  { name: 'ChatGPT Extension', patterns: ['chatgpt', 'openai'], risk: 'high' as const, description: 'AI Assistant ChatGPT' },
  { name: 'Grammarly', patterns: ['grammarly'], risk: 'medium' as const, description: 'Grammar checker yang dapat membantu essay' },
  { name: 'Google Translate', patterns: ['translate', 'translator'], risk: 'high' as const, description: 'Translator yang dapat membantu ujian bahasa' },
  { name: 'Bing AI', patterns: ['bing', 'copilot'], risk: 'high' as const, description: 'Microsoft AI Assistant' },
  { name: 'Claude AI', patterns: ['claude', 'anthropic'], risk: 'high' as const, description: 'Anthropic AI Assistant' },
  { name: 'Bard AI', patterns: ['bard', 'gemini'], risk: 'high' as const, description: 'Google AI Assistant' },
  
  // Screen capture and sharing
  { name: 'Loom', patterns: ['loom'], risk: 'high' as const, description: 'Screen recording yang dapat merekam soal' },
  { name: 'Awesome Screenshot', patterns: ['screenshot', 'capture'], risk: 'high' as const, description: 'Screenshot tool' },
  { name: 'Lightshot', patterns: ['lightshot'], risk: 'high' as const, description: 'Screenshot dan sharing tool' },
  
  // Note taking and productivity
  { name: 'Notion Web Clipper', patterns: ['notion'], risk: 'medium' as const, description: 'Note taking tool' },
  { name: 'Evernote Web Clipper', patterns: ['evernote'], risk: 'medium' as const, description: 'Note taking tool' },
  { name: 'OneNote Web Clipper', patterns: ['onenote'], risk: 'medium' as const, description: 'Microsoft note taking tool' },
  
  // Developer tools
  { name: 'React Developer Tools', patterns: ['react-developer'], risk: 'medium' as const, description: 'Developer tools' },
  { name: 'Vue.js devtools', patterns: ['vue-devtools'], risk: 'medium' as const, description: 'Developer tools' },
  { name: 'Web Developer', patterns: ['web-developer'], risk: 'medium' as const, description: 'Web development tools' },
  
  // Communication tools
  { name: 'WhatsApp Web', patterns: ['whatsapp'], risk: 'high' as const, description: 'Komunikasi yang dapat digunakan untuk menyontek' },
  { name: 'Telegram Web', patterns: ['telegram'], risk: 'high' as const, description: 'Komunikasi yang dapat digunakan untuk menyontek' },
  { name: 'Discord', patterns: ['discord'], risk: 'high' as const, description: 'Komunikasi yang dapat digunakan untuk menyontek' },
  
  // Search enhancers
  { name: 'Wolfram Alpha', patterns: ['wolfram'], risk: 'high' as const, description: 'Computational search engine' },
  { name: 'Symbolab', patterns: ['symbolab'], risk: 'high' as const, description: 'Math solver' },
  { name: 'Photomath', patterns: ['photomath'], risk: 'high' as const, description: 'Math problem solver' },
];

// Deteksi ekstensi melalui berbagai metode
export const detectExtensions = async (): Promise<ExtensionDetectionResult> => {
  const detectedExtensions: ExtensionInfo[] = [];
  let totalExtensions = 0;

  try {
    // Method 1: Deteksi melalui Chrome Extension API (jika tersedia)
    if (typeof chrome !== 'undefined' && chrome.management) {
      try {
        const extensions = await new Promise<chrome.management.ExtensionInfo[]>((resolve, reject) => {
          chrome.management.getAll((extensions) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(extensions);
            }
          });
        });

        totalExtensions = extensions.filter(ext => ext.enabled && ext.type === 'extension').length;

        for (const ext of extensions) {
          if (!ext.enabled || ext.type !== 'extension') continue;

          const extName = ext.name.toLowerCase();
          const extId = ext.id.toLowerCase();

          for (const riskyExt of RISKY_EXTENSIONS) {
            const isMatch = riskyExt.patterns.some(pattern => 
              extName.includes(pattern.toLowerCase()) || 
              extId.includes(pattern.toLowerCase())
            );

            if (isMatch) {
              detectedExtensions.push({
                name: riskyExt.name,
                id: ext.id,
                detected: true,
                risk: riskyExt.risk,
                description: riskyExt.description
              });
              break;
            }
          }
        }
      } catch (error) {
        console.warn('Chrome management API not accessible:', error);
      }
    }

    // Method 2: Deteksi melalui DOM injection dan script detection
    await detectExtensionsByDOMInjection(detectedExtensions);

    // Method 3: Deteksi melalui network requests dan resource loading
    await detectExtensionsByResourceLoading(detectedExtensions);

    // Method 4: Deteksi melalui global objects yang diinjeksi ekstensi
    detectExtensionsByGlobalObjects(detectedExtensions);

  } catch (error) {
    console.error('Error detecting extensions:', error);
  }

  const hasRiskyExtensions = detectedExtensions.some(ext => ext.risk === 'high') || 
                           detectedExtensions.filter(ext => ext.risk === 'medium').length > 2;

  return {
    hasRiskyExtensions,
    detectedExtensions,
    totalExtensions
  };
};

// Deteksi ekstensi melalui DOM injection
const detectExtensionsByDOMInjection = async (detectedExtensions: ExtensionInfo[]): Promise<void> => {
  // Deteksi Grammarly
  if (document.querySelector('grammarly-extension') || 
      document.querySelector('[data-grammarly-extension]') ||
      (window as any).grammarly) {
    addDetectedExtension(detectedExtensions, 'Grammarly', 'grammarly-detected', 'medium', 'Grammar checker detected via DOM');
  }

  // Deteksi Monica AI
  if (document.querySelector('[data-monica]') || 
      document.querySelector('.monica-widget') ||
      (window as any).monica) {
    addDetectedExtension(detectedExtensions, 'Monica AI', 'monica-detected', 'high', 'Monica AI detected via DOM');
  }

  // Deteksi Google Translate
  if (document.querySelector('.goog-te-combo') || 
      document.querySelector('#google_translate_element') ||
      (window as any).google?.translate) {
    addDetectedExtension(detectedExtensions, 'Google Translate', 'translate-detected', 'high', 'Google Translate detected');
  }

  // Deteksi ChatGPT extensions
  if (document.querySelector('[data-chatgpt]') || 
      document.querySelector('.chatgpt-extension') ||
      (window as any).chatgpt) {
    addDetectedExtension(detectedExtensions, 'ChatGPT Extension', 'chatgpt-detected', 'high', 'ChatGPT extension detected');
  }
};

// Deteksi ekstensi melalui resource loading
const detectExtensionsByResourceLoading = async (detectedExtensions: ExtensionInfo[]): Promise<void> => {
  const testUrls = [
    { url: 'chrome-extension://cfhdojbkjhnklbpkdaibdccddilifddb/icon.png', name: 'Adblock Plus', risk: 'low' as const },
    { url: 'chrome-extension://gighmmpiobklfepjocnamgkkbiglidom/icon.png', name: 'AdBlock', risk: 'low' as const },
    { url: 'chrome-extension://kbfnbcaeplbcioakkpcpgfkobkghlhen/icon.png', name: 'Grammarly', risk: 'medium' as const },
    { url: 'chrome-extension://aapbdbdomjkkjkaonfhkkikfgjllcleb/icon.png', name: 'Google Translate', risk: 'high' as const },
  ];

  for (const testUrl of testUrls) {
    try {
      const response = await fetch(testUrl.url, { method: 'HEAD' });
      if (response.ok) {
        addDetectedExtension(detectedExtensions, testUrl.name, 'resource-detected', testUrl.risk, `${testUrl.name} detected via resource loading`);
      }
    } catch (error) {
      // Extension not present or blocked
    }
  }
};

// Deteksi ekstensi melalui global objects
const detectExtensionsByGlobalObjects = (detectedExtensions: ExtensionInfo[]): void => {
  const globalChecks = [
    { check: () => (window as any).grammarly, name: 'Grammarly', risk: 'medium' as const },
    { check: () => (window as any).monica, name: 'Monica AI', risk: 'high' as const },
    { check: () => (window as any).chatgpt, name: 'ChatGPT Extension', risk: 'high' as const },
    { check: () => (window as any).google?.translate, name: 'Google Translate', risk: 'high' as const },
    { check: () => (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__, name: 'React Developer Tools', risk: 'medium' as const },
    { check: () => (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__, name: 'Vue.js devtools', risk: 'medium' as const },
  ];

  for (const globalCheck of globalChecks) {
    try {
      if (globalCheck.check()) {
        addDetectedExtension(detectedExtensions, globalCheck.name, 'global-detected', globalCheck.risk, `${globalCheck.name} detected via global object`);
      }
    } catch (error) {
      // Check failed, extension likely not present
    }
  }
};

// Helper function untuk menambah ekstensi yang terdeteksi
const addDetectedExtension = (
  detectedExtensions: ExtensionInfo[], 
  name: string, 
  id: string, 
  risk: 'high' | 'medium' | 'low', 
  description: string
): void => {
  // Avoid duplicates
  if (!detectedExtensions.find(ext => ext.name === name)) {
    detectedExtensions.push({
      name,
      id,
      detected: true,
      risk,
      description
    });
  }
};

// Deteksi ekstensi secara berkala
export const startExtensionMonitoring = (
  callback: (result: ExtensionDetectionResult) => void,
  interval: number = 10000 // 10 seconds
): (() => void) => {
  let isMonitoring = true;
  
  const monitor = async () => {
    if (!isMonitoring) return;
    
    try {
      const result = await detectExtensions();
      callback(result);
    } catch (error) {
      console.error('Extension monitoring error:', error);
    }
    
    if (isMonitoring) {
      setTimeout(monitor, interval);
    }
  };
  
  // Start monitoring
  monitor();
  
  // Return cleanup function
  return () => {
    isMonitoring = false;
  };
};

// Deteksi ekstensi yang dapat membantu dalam matematika
export const detectMathExtensions = async (): Promise<string[]> => {
  const mathExtensions = [];
  
  // Deteksi Wolfram Alpha
  if ((window as any).WolframAlpha || document.querySelector('[data-wolfram]')) {
    mathExtensions.push('Wolfram Alpha');
  }
  
  // Deteksi Symbolab
  if ((window as any).Symbolab || document.querySelector('[data-symbolab]')) {
    mathExtensions.push('Symbolab');
  }
  
  // Deteksi Photomath
  if ((window as any).Photomath || document.querySelector('[data-photomath]')) {
    mathExtensions.push('Photomath');
  }
  
  return mathExtensions;
};

// Deteksi ekstensi komunikasi
export const detectCommunicationExtensions = async (): Promise<string[]> => {
  const commExtensions = [];
  
  // Deteksi WhatsApp Web
  if (document.querySelector('[data-whatsapp]') || (window as any).WhatsApp) {
    commExtensions.push('WhatsApp Web');
  }
  
  // Deteksi Telegram
  if (document.querySelector('[data-telegram]') || (window as any).Telegram) {
    commExtensions.push('Telegram Web');
  }
  
  // Deteksi Discord
  if (document.querySelector('[data-discord]') || (window as any).Discord) {
    commExtensions.push('Discord');
  }
  
  return commExtensions;
};