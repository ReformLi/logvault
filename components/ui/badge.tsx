interface BadgeProps {
  variant?: 'active' | 'deleted' | 'failed' | 'default';
  children: React.ReactNode;
}

const variantMap: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  deleted: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  failed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  default: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300',
};

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantMap[variant]}`}
    >
      {children}
    </span>
  );
}
