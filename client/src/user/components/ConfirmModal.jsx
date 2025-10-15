import React from "react";
import { FaExclamationTriangle, FaTimes, FaCheck, FaTrash, FaInfoCircle } from "react-icons/fa";

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger", // 'danger', 'warning', 'info'
  loading = false,
  children
}) => {
  if (!isOpen) return null;

  const getTypeConfig = () => {
    switch (type) {
      case 'danger':
        return {
          icon: FaTrash,
          iconColor: 'text-red-500',
          buttonColor: 'bg-red-600 hover:bg-red-700',
          borderColor: 'border-red-500'
        };
      case 'warning':
        return {
          icon: FaExclamationTriangle,
          iconColor: 'text-yellow-500',
          buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
          borderColor: 'border-yellow-500'
        };
      case 'info':
        return {
          icon: FaInfoCircle,
          iconColor: 'text-blue-500',
          buttonColor: 'bg-blue-600 hover:bg-blue-700',
          borderColor: 'border-blue-500'
        };
      default:
        return {
          icon: FaExclamationTriangle,
          iconColor: 'text-gray-500',
          buttonColor: 'bg-gray-600 hover:bg-gray-700',
          borderColor: 'border-gray-500'
        };
    }
  };

  const typeConfig = getTypeConfig();
  const IconComponent = typeConfig.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700 transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className={`p-6 border-b ${typeConfig.borderColor} border-opacity-20`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-opacity-10 ${typeConfig.iconColor} bg-current`}>
              <IconComponent className="text-lg" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              {message && (
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                  {message}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <FaTimes size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {children ? (
            <div className="text-gray-700 dark:text-gray-300">
              {children}
            </div>
          ) : message ? null : (
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Are you sure you want to proceed with this action?
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-3 ${typeConfig.buttonColor} text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </>
            ) : (
              <>
                <FaCheck size={14} />
                {confirmText}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;