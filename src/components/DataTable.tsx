import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  flexRender,
} from '@tanstack/react-table';

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
  [key: string]: string | number | boolean | undefined;
}

interface DataTableProps {
  data: DataTableRow[];
  columns: DataTableColumn[];
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
}

export default function DataTable({ data, columns, searchPlaceholder = 'Search...' }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Sync URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sort = params.get('sort');
    const dir = params.get('dir');
    const q = params.get('q');
    if (sort) setSorting([{ id: sort, desc: dir === 'desc' }]);
    if (q) setGlobalFilter(q);

    const filters: ColumnFiltersState = [];
    columns.forEach(col => {
      if (col.filterable) {
        const val = params.get(col.key);
        if (val) filters.push({ id: col.key, value: val });
      }
    });
    if (filters.length) setColumnFilters(filters);
  }, []);

  // Update URL when filters change
  const updateUrl = useCallback((g: string, s: SortingState, f: ColumnFiltersState) => {
    const params = new URLSearchParams();
    if (g) params.set('q', g);
    if (s.length) {
      params.set('sort', s[0].id);
      if (s[0].desc) params.set('dir', 'desc');
    }
    f.forEach(filter => {
      if (filter.value) params.set(filter.id, String(filter.value));
    });
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? '?' + qs : '');
    window.history.replaceState(null, '', newUrl);
  }, []);

  // Extract unique values for filterable columns
  const filterOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    columns.forEach(col => {
      if (col.filterable) {
        const values = [...new Set(data.map(r => String(r[col.key] ?? '')).filter(Boolean))].sort();
        opts[col.key] = values;
      }
    });
    return opts;
  }, [data, columns]);

  const tableColumns = useMemo<ColumnDef<DataTableRow>[]>(() =>
    columns.map(col => ({
      id: col.key,
      accessorFn: (row: DataTableRow) => row[col.key] ?? '',
      header: col.label,
      enableSorting: col.sortable !== false,
      enableColumnFilter: col.filterable === true,
      filterFn: 'equalsString' as const,
      cell: ({ getValue, row }: { getValue: () => unknown; row: { original: DataTableRow } }) => {
        const val = String(getValue());
        if (col.isLink) {
          return (
            <a href={row.original.href} className="text-info no-underline hover:underline transition-colors duration-75">
              {val}
            </a>
          );
        }
        const display = val ? val.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';
        return <span>{display}</span>;
      },
    })),
    [columns]
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(next);
      updateUrl(globalFilter, next, columnFilters);
    },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      setColumnFilters(next);
      updateUrl(globalFilter, sorting, next);
    },
    onGlobalFilterChange: (val) => {
      setGlobalFilter(val);
      updateUrl(val, sorting, columnFilters);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const hasActiveFilters = globalFilter || columnFilters.length > 0;

  const clearAll = () => {
    setGlobalFilter('');
    setColumnFilters([]);
    setSorting([]);
    updateUrl('', [], []);
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mt-6 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={globalFilter}
            onChange={e => {
              setGlobalFilter(e.target.value);
              updateUrl(e.target.value, sorting, columnFilters);
            }}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none transition-colors duration-75 focus:border-accent focus:ring-1 focus:ring-accent-glow"
          />
        </div>

        {/* Column filters */}
        {columns.filter(c => c.filterable).map(col => {
          const currentVal = columnFilters.find(f => f.id === col.key)?.value as string || '';
          return (
            <select
              key={col.key}
              value={currentVal}
              onChange={e => {
                const val = e.target.value;
                const next = columnFilters.filter(f => f.id !== col.key);
                if (val) next.push({ id: col.key, value: val });
                setColumnFilters(next);
                updateUrl(globalFilter, sorting, next);
              }}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-75 focus:border-accent focus:ring-1 focus:ring-accent-glow"
            >
              <option value="">All {col.label.endsWith('y') ? col.label.slice(0, -1) + 'ies' : col.label.endsWith('s') ? col.label : col.label + 's'}</option>
              {filterOptions[col.key]?.map(opt => (
                <option key={opt} value={opt}>{opt.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          );
        })}

        {/* Result count + clear */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="font-mono text-xs text-text-muted">
            {filteredCount} {filteredCount === 1 ? 'result' : 'results'}
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors duration-75 hover:border-error/30 hover:text-error"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-void">
            <tr className="border-b text-left text-text-muted">
              {table.getHeaderGroups()[0].headers.map(header => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={`pb-2 pr-4 font-medium select-none ${canSort ? 'cursor-pointer hover:text-text-primary transition-colors duration-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent' : ''}`}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    {...(canSort ? {
                      tabIndex: 0,
                      role: 'button' as const,
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          header.column.getToggleSortingHandler()?.(e);
                        }
                      },
                    } : {})}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="text-[10px] inline-flex flex-col leading-none -space-y-0.5">
                          <span className={sorted === 'asc' ? 'text-info' : 'text-text-muted'}>▲</span>
                          <span className={sorted === 'desc' ? 'text-info' : 'text-text-muted'}>▼</span>
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                tabIndex={0}
                role="link"
                className="border-b border-border cursor-pointer hover:bg-elevated transition-colors duration-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                onClick={() => { window.location.href = row.original.href; }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    window.location.href = row.original.href;
                  }
                }}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="py-2.5 pr-4 text-text-secondary">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {filteredCount === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-text-muted">
                  No results match your filters.
                  <button onClick={clearAll} className="ml-2 text-info hover:underline">Clear all</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
