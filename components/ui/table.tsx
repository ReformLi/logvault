import { HTMLAttributes, TdHTMLAttributes, forwardRef } from 'react';

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className = '', children, ...props }, ref) => (
    <div className="w-full overflow-auto">
      <table ref={ref} className={`w-full caption-bottom text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', children, ...props }, ref) => (
    <thead ref={ref} className={`border-b border-neutral-200 dark:border-neutral-800 ${className}`} {...props}>
      {children}
    </thead>
  )
);
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <tbody ref={ref} className={className} {...props} />
  )
);
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className = '', ...props }, ref) => (
    <tr ref={ref} className={`border-b border-neutral-200 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900 ${className}`} {...props} />
  )
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, HTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', children, ...props }, ref) => (
    <th ref={ref} className={`h-12 px-4 text-left align-middle font-medium text-neutral-500 dark:text-neutral-400 ${className}`} {...props}>
      {children}
    </th>
  )
);
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => (
    <td ref={ref} className={`p-4 align-middle ${className}`} {...props} />
  )
);
TableCell.displayName = 'TableCell';
