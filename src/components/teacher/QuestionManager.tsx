import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import { PublishIcon, EditIcon, TrashIcon } from '../ui/Icons';
import Modal from '../ui/Modal';
import AddQuestionForm from './AddQuestionForm';
import EditQuestionForm from './EditQuestionForm';

interface Question {
  id: string;
  text: string;
  type: 'mc' | 'essay';
  options?: string[];
  optionImages?: (string | null)[];
  correctAnswer?: number;
  image?: string | null;
}

interface QuestionManagerProps {
  navigateTo: (page: string, data?: unknown) => void;
  navigateBack: () => void;
  appState: Record<string, unknown>;
}

const QuestionManager: React.FC<QuestionManagerProps> = ({ navigateBack, appState }) => {
  const exam = appState.exam as { id: string; name?: string; code?: string; status?: string };
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [currentExam, setCurrentExam] = useState(exam);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);

  const handleBackNavigation = () => {
    navigateBack();
  };

  const questionsRef = collection(db, `artifacts/${appId}/public/data/exams/${exam.id}/questions`);
  const examDocRef = doc(db, `artifacts/${appId}/public/data/exams`, exam.id);

  useEffect(() => {
    const unsubQuestions = onSnapshot(questionsRef, (snapshot) => {
      setQuestions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
    });

    const unsubExam = onSnapshot(examDocRef, (d) => {
      setCurrentExam({ id: d.id, ...d.data() } as typeof exam);
    });

    return () => {
      unsubQuestions();
      unsubExam();
    };
  }, [exam.id]);

  const handleUpdateQuestion = async (updatedQuestion: Question) => {
    const { id, ...dataToUpdate } = updatedQuestion;
    const questionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/questions`, id);
    await updateDoc(questionDocRef, dataToUpdate);
    setEditingQuestion(null);
  };

  const confirmDelete = (question: Question) => {
    setQuestionToDelete(question);
    setShowDeleteModal(true);
  };

  const handleDeleteQuestion = async () => {
    if (!questionToDelete) return;
    const questionDocRef = doc(db, `artifacts/${appId}/public/data/exams/${exam.id}/questions`, questionToDelete.id);
    await deleteDoc(questionDocRef);
    setShowDeleteModal(false);
    setQuestionToDelete(null);
  };

  const publishExam = async () => {
    if (questions.length === 0) {
      alert("Tidak bisa mempublikasikan ujian tanpa soal.");
      return;
    }
    await updateDoc(examDocRef, { status: 'published' });
  };

  return (
    <div>
      <Modal
        isOpen={showDeleteModal}
        title="Hapus Soal?"
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteQuestion}
        confirmText="Ya, Hapus"
        confirmColor="red"
      >
        <p>Apakah Anda yakin ingin menghapus soal ini secara permanen?</p>
        <p className="mt-2 p-2 bg-gray-700 rounded-md text-sm">"{questionToDelete?.text || '(Soal bergambar)'}"</p>
      </Modal>

      <button
        onClick={handleBackNavigation}
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
      >
        &larr; Kembali
      </button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-3xl font-bold mb-2">
            Kelola Soal: <span className="text-blue-400">{currentExam.name}</span>
          </h2>
          <p className="text-lg text-gray-400">
            Kode: <span className="font-mono bg-gray-700 px-2 py-1 rounded">{currentExam.code}</span>
          </p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold px-3 py-1 rounded-full ${
            currentExam.status === 'published'
              ? 'bg-green-600 text-white'
              : 'bg-yellow-500 text-gray-900'
          }`}>
            Status: {currentExam.status}
          </p>
          {currentExam.status === 'draft' && (
            <>
              <div className="mt-2 bg-yellow-900 border border-yellow-500 text-yellow-300 text-xs p-2 rounded-md">
                **Penting:** Ujian belum bisa diakses siswa. Klik "Publikasikan" jika semua soal sudah siap.
              </div>
              <button
                onClick={publishExam}
                disabled={questions.length === 0}
                className="mt-2 flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
              >
                <PublishIcon /> Publikasikan
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
          {editingQuestion ? (
            <EditQuestionForm
              key={editingQuestion.id}
              question={editingQuestion}
              onSave={handleUpdateQuestion}
              onCancel={() => setEditingQuestion(null)}
            />
          ) : (
            <AddQuestionForm examId={exam.id} />
          )}
        </div>

        <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
          <h3 className="text-xl font-semibold mb-4">Daftar Soal ({questions.length})</h3>
          <ul className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {questions.map((q, index) => (
              <li key={q.id} className="bg-gray-700 p-3 rounded-md">
                <div className="flex justify-between items-start">
                  <div className="flex-grow mr-2">
                    <p className="font-semibold">{index + 1}. {q.text || '(Soal bergambar)'}</p>
                    {q.image && (
                      <div className="mt-2">
                        <img
                          src={q.image}
                          alt="Gambar soal"
                          className="max-h-32 rounded-md border border-gray-600"
                        />
                      </div>
                    )}
                    {q.type === 'mc' && q.options && (
                      <ul className="mt-2 space-y-1">
                        {q.options.map((opt, i) => (
                          <li
                            key={i}
                            className={`text-sm flex items-start gap-2 ${i === q.correctAnswer ? 'text-green-400 font-bold' : ''}`}
                          >
                            <span className="flex-shrink-0">{String.fromCharCode(65 + i)}.</span>
                            <div className="flex-1">
                              <span>{opt || '(Gambar)'}</span>
                              {q.optionImages?.[i] && (
                                <img
                                  src={q.optionImages[i]!}
                                  alt={`Opsi ${String.fromCharCode(65 + i)}`}
                                  className="mt-1 max-h-16 rounded border border-gray-600"
                                />
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.type === 'essay' && (
                      <span className="text-xs text-gray-400 mt-1 inline-block">(Esai)</span>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 space-x-2">
                    <button
                      onClick={() => setEditingQuestion(q)}
                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white"
                    >
                      <EditIcon />
                    </button>
                    <button
                      onClick={() => confirmDelete(q)}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded-md text-white"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default QuestionManager;
