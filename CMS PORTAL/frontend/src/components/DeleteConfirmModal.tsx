import React from 'react';

interface DeleteConfirmModalProps {
  open: boolean;
  itemName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  open,
  itemName,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
      aria-describedby="delete-confirm-description"
    >
      <div className="bg-white rounded-md shadow-lg p-6 max-w-sm w-full">
        <h2 id="delete-confirm-title" className="text-xl font-semibold mb-4 text-red-600">
          Confirm Delete
        </h2>
        <p id="delete-confirm-description" className="mb-6">
          Are you sure you want to delete{' '}
          <strong>{itemName || 'this item'}</strong>?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
