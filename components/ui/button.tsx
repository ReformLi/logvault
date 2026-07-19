import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<string, string> = {
  default: 'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200',
  destructive: 'bg-red-600 text-white hover:bg-red-500',
  outline: 'border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800',
  ghost: 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
};

const sizeStyles: Record<string, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'md', className = '', disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = 'Button';
