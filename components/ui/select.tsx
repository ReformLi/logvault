'use client';

import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, label, className = '', ...props }, ref) => (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={`block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
);
Select.displayName = 'Select';
