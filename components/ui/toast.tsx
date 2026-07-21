'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string | null;
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div
      className={`fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-neutral-800 px-4 py-2.5 text-sm text-white shadow-lg transition-all duration-300 dark:bg-neutral-200 dark:text-neutral-900 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      style={{ pointerEvents: 'none' }}
    >
      {message}
    </div>
  );
}
