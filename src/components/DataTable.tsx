import { useMemo } from 'react';
import type { SortState } from './ListingView';

export interface DataTableColumn {
  key: string;
  label: string;
  filterable?: boolean;
  sortable?: boolean;
  /** If true, render as a link using the `href` field on each row */
  isLink?: boolean;
}

export interface DataTableRow {
  href: string;
  external?: boolean;
  [key: string]: string | number | boolean | undefined;
}

interface DataTableProps {
  rows: DataTableRow[];
  columns: DataTableColumn[];
  sort: SortState;
  onSortChange: (colKey: string) => void;
  onClearFilters: () => void;
  /** Optional: row field to group rows by. When set, rows are split into sections per unique value. */
  groupBy?: string;
  /** Display label for the active groupBy field (e.g. "Country"). */
  groupByLabel?: string;
}

function titleCase(val: string): string {
  return val ? val.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
}

function CellContent({ col, row }: { col: DataTableColumn; row: DataTableRow }) {
  const val = String(row[col.key] ?? '');
  if (col.isLink) {
    const ext = row.external === true;
    return (
      <a
        href={row.href}
        className="text-accent no-underline hover:underline"
        {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {val}
      </a>
    );
  }
  return <span>{val ? titleCase(val) : '—'}</span>;
}

export default function DataTable({
  rows,
  columns,
  sort,
  onSortChange,
  onClearFilters,
  groupBy,
}: DataTableProps) {
  // Bucket pre-sorted rows by groupBy value. Groups sort alphabetically by group name;
  // within a group, the existing (already-sorted) order is preserved.
  const groupedRows = useMemo(() => {
    if (!groupBy) return null;
    const buckets = new Map<string, DataTableRow[]>();
    for (const row of rows) {
      const raw = row[groupBy];
      const key = raw === undefined || raw === null || raw === '' ? '—' : String(raw);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(row);
    }
    return Array.from(buckets.entries())
      .filter(([, list]) => list.length > 0)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [rows, groupBy]);

  const handleNavigate = (row: DataTableRow) => {
    if (row.external) {
      window.open(row.href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = row.href;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10 bg-void">
          <tr className="border-b border-border text-left text-text-muted">
            {columns.map(col => {
              const canSort = col.sortable !== false;
              const sortedDir = sort?.id === col.key ? (sort.desc ? 'desc' : 'asc') : null;
              return (
                <th
                  key={col.key}
                  className={`pb-2 pr-4 font-medium select-none ${canSort ? 'cursor-pointer hover:text-text-primary transition-colors duration-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent' : ''}`}
                  onClick={canSort ? () => onSortChange(col.key) : undefined}
                  {...(canSort
                    ? {
                        tabIndex: 0,
                        role: 'button' as const,
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSortChange(col.key);
                          }
                        },
                      }
                    : {})}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {canSort && (
                      <span className="text-xs inline-flex flex-col leading-none -space-y-0.5">
                        <span className={sortedDir === 'asc' ? 'text-accent' : 'text-text-muted'}>▲</span>
                        <span className={sortedDir === 'desc' ? 'text-accent' : 'text-text-muted'}>▼</span>
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        {groupedRows ? (
          groupedRows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-text-muted">
                  No results match your filters.
                  <button onClick={onClearFilters} className="ml-2 text-accent hover:underline">
                    Clear all
                  </button>
                </td>
              </tr>
            </tbody>
          ) : (
            groupedRows.map(([groupKey, groupRows]) => (
              <tbody key={groupKey}>
                <tr className="border-b border-border bg-elevated/40">
                  <td colSpan={columns.length} className="py-3 pr-4">
                    <span className="h-sm text-text-primary">{titleCase(groupKey)}</span>
                    <span className="eyebrow ml-3 text-text-muted">
                      {groupRows.length} {groupRows.length === 1 ? 'item' : 'items'}
                    </span>
                  </td>
                </tr>
                {groupRows.map((row, i) => (
                  <tr
                    key={`${groupKey}-${i}-${row.href}`}
                    tabIndex={0}
                    role="link"
                    className="border-b border-border cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    onClick={() => handleNavigate(row)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNavigate(row);
                      }
                    }}
                  >
                    {columns.map(col => (
                      <td key={col.key} className="py-2.5 pr-4 text-text-secondary">
                        <CellContent col={col} row={row} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))
          )
        ) : (
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${i}-${row.href}`}
                tabIndex={0}
                role="link"
                className="border-b border-border cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                onClick={() => handleNavigate(row)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNavigate(row);
                  }
                }}
              >
                {columns.map(col => (
                  <td key={col.key} className="py-2.5 pr-4 text-text-secondary">
                    <CellContent col={col} row={row} />
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-text-muted">
                  No results match your filters.
                  <button onClick={onClearFilters} className="ml-2 text-accent hover:underline">
                    Clear all
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        )}
      </table>
    </div>
  );
}
