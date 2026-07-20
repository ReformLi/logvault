'use client';

import { useEffect, useCallback, HTMLAttributes } from 'react';

interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  title?: string;
  titleExtra?: React.ReactNode;
}

export function Dialog({ open, onClose, title, titleExtra, children, className = '' }: DialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative z-10 mx-auto max-h-[85vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-950 ${className}`}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">{title}</h2>
            <div className="flex items-center gap-1">
              {titleExtra}
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
