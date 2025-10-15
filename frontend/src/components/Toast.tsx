import React, { useEffect } from 'react';
import '../styles/Toast.css';

interface ToastProps {
  message: string;
  type: 'error' | 'success' | 'info';
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const icons = {
    error: '⚠️',
    success: '✅',
    info: 'ℹ️',
  };

  return (
    <div className={`toast toast-${type}`} onClick={onClose}>
      <span className="toast-icon">{icons[type]}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={(e) => { e.stopPropagation(); onClose(); }}>
        ✕
      </button>
    </div>
  );
};

export default Toast;
