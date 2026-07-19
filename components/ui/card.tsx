import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', children, noPadding, ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 ${noPadding ? '' : 'p-6'} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`mb-4 ${className}`} {...props}>
      {children}
    </div>
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', children, ...props }, ref) => (
    <h3 ref={ref} className={`text-lg font-semibold ${className}`} {...props}>
      {children}
    </h3>
  )
);
CardTitle.displayName = 'CardTitle';
