import React, { useState, useRef } from 'react';

const SUPPORTED_LANGUAGES = ['php', 'cpp', 'python', 'csharp'] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  php: 'PHP',
  cpp: 'C++',
  python: 'Python',
  csharp: 'C#'
};

interface Question {
  id: string;
  text: string;
  type: 'mc' | 'essay' | 'livecode';
  options?: string[];
  optionImages?: (string | null)[];
  correctAnswer?: number;
  image?: string | null;
  language?: SupportedLanguage;
}

interface OptionData {
  text: string;
  image: string | null;
}

interface EditQuestionFormProps {
  question: Question;
  onSave: (question: Question) => void;
  onCancel: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

const EditQuestionForm: React.FC<EditQuestionFormProps> = ({ question, onSave, onCancel }) => {
  const [questionText, setQuestionText] = useState(question.text);
  const [questionImage, setQuestionImage] = useState<string | null>(question.image || null);
  const [questionType] = useState(question.type);

  const initialOptions: OptionData[] = question.type === 'mc' && question.options
    ? question.options.map((text, i) => ({
        text,
        image: question.optionImages?.[i] || null
      }))
    : [
        { text: '', image: null },
        { text: '', image: null },
        { text: '', image: null },
        { text: '', image: null }
      ];

  const [options, setOptions] = useState<OptionData[]>(initialOptions);
  const [correctAnswer, setCorrectAnswer] = useState(question.type === 'mc' ? question.correctAnswer || 0 : 0);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(question.language || 'php');
  const questionImageRef = useRef<HTMLInputElement>(null);
  const optionImageRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Format file tidak didukung. Gunakan JPG, JPEG, atau PNG.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Ukuran file maksimal 5 MB.';
    }
    return null;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleQuestionImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      alert(error);
      e.target.value = '';
      return;
    }

    const base64 = await fileToBase64(file);
    setQuestionImage(base64);
  };

  const handleOptionImageChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      alert(error);
      e.target.value = '';
      return;
    }

    const base64 = await fileToBase64(file);
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], image: base64 };
    setOptions(newOptions);
  };

  const removeQuestionImage = () => {
    setQuestionImage(null);
    if (questionImageRef.current) {
      questionImageRef.current.value = '';
    }
  };

  const removeOptionImage = (index: number) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], image: null };
    setOptions(newOptions);
    if (optionImageRefs.current[index]) {
      optionImageRefs.current[index]!.value = '';
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!questionText.trim() && !questionImage) {
      alert('Pertanyaan harus memiliki teks atau gambar.');
      return;
    }

    const updatedData: Question = {
      id: question.id,
      text: questionText,
      type: questionType,
      image: questionImage
    };

    if (questionType === 'mc') {
      const hasEmptyOption = options.some(opt => !opt.text.trim() && !opt.image);
      if (hasEmptyOption) {
        alert("Semua opsi pilihan ganda harus memiliki teks atau gambar.");
        return;
      }
      updatedData.options = options.map(opt => opt.text);
      updatedData.optionImages = options.map(opt => opt.image);
      updatedData.correctAnswer = correctAnswer;
    }

    if (questionType === 'livecode') {
      updatedData.language = selectedLanguage;
    }

    onSave(updatedData);
  };

  return (
    <>
      <h3 className="text-xl font-semibold mb-4">Edit Soal</h3>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Pertanyaan</label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 h-24"
          />

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-md cursor-pointer text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {questionImage ? 'Ganti Gambar' : 'Tambah Gambar'}
              <input
                ref={questionImageRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={handleQuestionImageChange}
                className="hidden"
              />
            </label>
            <span className="text-xs text-gray-400">Max 5MB (JPG, PNG)</span>
          </div>

          {questionImage && (
            <div className="relative inline-block">
              <img
                src={questionImage}
                alt="Preview pertanyaan"
                className="max-h-32 rounded-md border border-gray-600"
              />
              <button
                type="button"
                onClick={removeQuestionImage}
                className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
              >
                X
              </button>
            </div>
          )}
        </div>

        {questionType === 'livecode' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Bahasa Pemrograman</label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as SupportedLanguage)}
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600"
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang} value={lang}>{LANGUAGE_LABELS[lang]}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400">
              Siswa akan menulis kode dalam bahasa {LANGUAGE_LABELS[selectedLanguage]} dan dapat menjalankannya.
            </p>
          </div>
        )}

        {questionType === 'mc' && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-300">Pilihan Jawaban</label>
            {options.map((opt, index) => (
              <div key={index} className="bg-gray-750 p-3 rounded-md border border-gray-600">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name={`edit_correct_${question.id}`}
                    checked={correctAnswer === index}
                    onChange={() => setCorrectAnswer(index)}
                    className="mt-3 h-5 w-5 text-blue-600 bg-gray-700 border-gray-600"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-400 w-6">{String.fromCharCode(65 + index)}.</span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const newOpt = [...options];
                          newOpt[index] = { ...newOpt[index], text: e.target.value };
                          setOptions(newOpt);
                        }}
                        className="flex-1 p-2 bg-gray-700 rounded-md border border-gray-600"
                      />
                    </div>

                    <div className="flex items-center gap-2 ml-8">
                      <label className="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded cursor-pointer text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {opt.image ? 'Ganti' : 'Gambar'}
                        <input
                          ref={el => optionImageRefs.current[index] = el}
                          type="file"
                          accept=".jpg,.jpeg,.png"
                          onChange={(e) => handleOptionImageChange(index, e)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {opt.image && (
                      <div className="relative inline-block ml-8">
                        <img
                          src={opt.image}
                          alt={`Preview opsi ${String.fromCharCode(65 + index)}`}
                          className="max-h-24 rounded-md border border-gray-600"
                        />
                        <button
                          type="button"
                          onClick={() => removeOptionImage(index)}
                          className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        >
                          X
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg"
          >
            Batal
          </button>
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg"
          >
            Simpan Perubahan
          </button>
        </div>
      </form>
    </>
  );
};

export default EditQuestionForm;
