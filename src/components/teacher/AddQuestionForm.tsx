import React, { useState, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';

interface AddQuestionFormProps {
  examId: string;
}

interface OptionData {
  text: string;
  image: string | null;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

const SUPPORTED_LANGUAGES = ['javascript', 'php', 'cpp', 'python'] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  javascript: 'JavaScript',
  php: 'PHP',
  cpp: 'C++',
  python: 'Python'
};

const AddQuestionForm: React.FC<AddQuestionFormProps> = ({ examId }) => {
  const [questionText, setQuestionText] = useState('');
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState<'mc' | 'essay' | 'livecode'>('mc');
  const [options, setOptions] = useState<OptionData[]>([
    { text: '', image: null },
    { text: '', image: null },
    { text: '', image: null },
    { text: '', image: null }
  ]);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('javascript');
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

  const addQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() && !questionImage) {
      alert('Pertanyaan harus memiliki teks atau gambar.');
      return;
    }

    const questionsRef = collection(db, `artifacts/${appId}/public/data/exams/${examId}/questions`);
    const questionData: Record<string, unknown> = {
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
      questionData.options = options.map(opt => opt.text);
      questionData.optionImages = options.map(opt => opt.image);
      questionData.correctAnswer = correctAnswer;
    }

    if (questionType === 'livecode') {
      questionData.language = selectedLanguage;
    }

    await addDoc(questionsRef, questionData);
    setQuestionText('');
    setQuestionImage(null);
    setOptions([
      { text: '', image: null },
      { text: '', image: null },
      { text: '', image: null },
      { text: '', image: null }
    ]);
    setCorrectAnswer(0);
    if (questionImageRef.current) {
      questionImageRef.current.value = '';
    }
    optionImageRefs.current.forEach(ref => {
      if (ref) ref.value = '';
    });
  };

  return (
    <>
      <h3 className="text-xl font-semibold mb-4">Tambah Soal Baru</h3>
      <form onSubmit={addQuestion} className="space-y-4">
        <select
          value={questionType}
          onChange={(e) => setQuestionType(e.target.value as 'mc' | 'essay' | 'livecode')}
          className="w-full p-3 bg-gray-700 rounded-md border border-gray-600"
        >
          <option value="mc">Pilihan Ganda</option>
          <option value="essay">Esai</option>
          <option value="livecode">Live Code</option>
        </select>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Pertanyaan</label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Tulis pertanyaan di sini..."
            className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 h-24"
          />

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-md cursor-pointer text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Tambah Gambar
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
              Siswa akan menulis kode dalam bahasa {LANGUAGE_LABELS[selectedLanguage]} dan dapat menjalankannya untuk melihat output.
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
                    name="correctAnswer"
                    checked={correctAnswer === index}
                    onChange={() => setCorrectAnswer(index)}
                    className="mt-3 h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
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
                        placeholder={`Opsi ${String.fromCharCode(65 + index)}`}
                        className="flex-1 p-2 bg-gray-700 rounded-md border border-gray-600"
                      />
                    </div>

                    <div className="flex items-center gap-2 ml-8">
                      <label className="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded cursor-pointer text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Gambar
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

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg"
        >
          Tambah Soal
        </button>
      </form>
    </>
  );
};

export default AddQuestionForm;
