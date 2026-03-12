import React from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'red' | 'green';
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  title, 
  children, 
  onConfirm, 
  onCancel, 
  confirmText, 
  cancelText, 
  confirmColor = 'red' 
}) => {
  if (!isOpen) return null;
  
  const colorClasses = { 
    red: 'bg-red-600 hover:bg-red-700', 
    green: 'bg-green-600 hover:bg-green-700' 
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center" style={{ zIndex: 9999 }}>
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4 relative" style={{ zIndex: 10000 }}>
        <h3 className="text-xl font-bold mb-4">{title}</h3>
        <div className="text-gray-300 mb-6">{children}</div>
        <div className="flex justify-end space-x-4">
          {onCancel && (
            <button 
              onClick={onCancel} 
              className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg"
            >
              {cancelText || 'Batal'}
            </button>
          )}
          {onConfirm && (
            <button 
              onClick={onConfirm} 
              className={`${colorClasses[confirmColor]} text-white font-bold py-2 px-4 rounded-lg`}
            >
              {confirmText || 'Konfirmasi'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;