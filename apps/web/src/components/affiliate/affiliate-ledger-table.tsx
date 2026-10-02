import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface AffiliateLedgerTableColumn<T extends Record<string, unknown>> {
  key: keyof T;
  header: string;
  align?: 'left' | 'right';
  render?: (value: T[keyof T], row: T) => ReactNode;
}

interface AffiliateLedgerTableProps<T extends Record<string, unknown>> {
  title: string;
  columns: Array<AffiliateLedgerTableColumn<T>>;
  rows: T[];
  emptyState: string;
}

export function AffiliateLedgerTable<T extends Record<string, unknown>>({
  title,
  columns,
  rows,
  emptyState,
}: AffiliateLedgerTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-none border border-border bg-card">
      <div className="border-b border-border bg-paper px-5 py-4">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    'px-5 py-3 text-left font-medium text-muted-foreground',
                    column.align === 'right' && 'text-right'
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyState}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/50 last:border-b-0">
                  {columns.map((column) => {
                    const value = row[column.key];
                    return (
                      <td
                        key={String(column.key)}
                        className={cn(
                          'px-5 py-3 text-foreground',
                          column.align === 'right' && 'text-right tabular-nums'
                        )}
                      >
                        {column.render ? column.render(value, row) : String(value ?? '')}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
