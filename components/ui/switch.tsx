'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, className = '', id, ...props }, ref) => (
    <div className={`flex items-center gap-3 ${className}`}>
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="peer sr-only"
          {...props}
        />
        <div className="h-6 w-11 rounded-full bg-neutral-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-900 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-neutral-500 peer-focus:ring-offset-2 dark:bg-neutral-700 dark:peer-checked:bg-neutral-100" />
      </label>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
      )}
    </div>
  )
);
Switch.displayName = 'Switch';
