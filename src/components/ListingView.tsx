import { useState, useEffect, useCallback, useMemo } from 'react';
import DataTable, { type DataTableColumn, type DataTableRow } from './DataTable';
import CardGrid, { type CardItem } from './CardGrid';

export interface GroupByOption {
  /** Field key to group by. Must exist on tableData rows and (ideally) on card items via the matching field name. */
  key: string;
  /** Display label for the option (e.g. "Country", "Category"). */
  label: string;
}

interface ListingViewProps {
  tableData: DataTableRow[];
  tableColumns: DataTableColumn[];
  cardItems: CardItem[];
  searchPlaceholder?: string;
  /** Available "Group by" fields. If provided, the group-by control is shown. */
  groupByOptions?: GroupByOption[];
}

export type SortState = { id: string; desc: boolean } | null;
export type ColumnFilters = Record<string, string>;

const NONE = 'none';

function titleCase(val: string): string {
  return val ? val.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
}

function pluralLabel(label: string): string {
  if (label.endsWith('y')) return label.slice(0, -1) + 'ies';
  if (label.endsWith('s')) return label;
  return label + 's';
}

export default function ListingView({
  tableData,
  tableColumns,
  cardItems,
  searchPlaceholder = 'Search...',
  groupByOptions = [],
}: ListingViewProps) {
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [groupBy, setGroupBy] = useState<string>(NONE);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<SortState>(null);

  // Hydrate state from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const g = params.get('groupBy');
    if (g && groupByOptions.some(o => o.key === g)) setGroupBy(g);

    const q = params.get('q');
    if (q) setGlobalFilter(q);

    const s = params.get('sort');
    const d = params.get('dir');
    if (s) setSort({ id: s, desc: d === 'desc' });

    const filters: ColumnFilters = {};
    tableColumns.forEach(col => {
      if (col.filterable) {
        const val = params.get(col.key);
        if (val) {
          // Canonicalize URL value to the actual data casing so the
          // <select> renders the active option correctly.
          const dataValues = [...new Set(tableData.map(r => String(r[col.key] ?? '')).filter(Boolean))];
          const match = dataValues.find(v => v.toLowerCase() === val.toLowerCase());
          filters[col.key] = match ?? val;
        }
      }
    });
    if (Object.keys(filters).length) setColumnFilters(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateUrl = useCallback(
    (g: string, gFilter: string, s: SortState, f: ColumnFilters) => {
      const params = new URLSearchParams();
      if (gFilter) params.set('q', gFilter);
      if (s) {
        params.set('sort', s.id);
        if (s.desc) params.set('dir', 'desc');
      }
      Object.entries(f).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      if (g && g !== NONE) params.set('groupBy', g);
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
    },
    []
  );

  const handleGroupByChange = useCallback(
    (value: string) => {
      setGroupBy(value);
      updateUrl(value, globalFilter, sort, columnFilters);
    },
    [globalFilter, sort, columnFilters, updateUrl]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setGlobalFilter(value);
      updateUrl(groupBy, value, sort, columnFilters);
    },
    [groupBy, sort, columnFilters, updateUrl]
  );

  const handleColumnFilterChange = useCallback(
    (colKey: string, value: string) => {
      const next = { ...columnFilters };
      if (value) next[colKey] = value;
      else delete next[colKey];
      setColumnFilters(next);
      updateUrl(groupBy, globalFilter, sort, next);
    },
    [columnFilters, groupBy, globalFilter, sort, updateUrl]
  );

  const handleSortChange = useCallback(
    (colKey: string) => {
      let next: SortState;
      if (!sort || sort.id !== colKey) next = { id: colKey, desc: false };
      else if (!sort.desc) next = { id: colKey, desc: true };
      else next = null;
      setSort(next);
      updateUrl(groupBy, globalFilter, next, columnFilters);
    },
    [sort, groupBy, globalFilter, columnFilters, updateUrl]
  );

  const clearAll = useCallback(() => {
    setGlobalFilter('');
    setColumnFilters({});
    setSort(null);
    updateUrl(groupBy, '', null, {});
  }, [groupBy, updateUrl]);

  // Unique values per filterable column (for the dropdown options)
  const filterOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    tableColumns.forEach(col => {
      if (col.filterable) {
        const values = [...new Set(tableData.map(r => String(r[col.key] ?? '')).filter(Boolean))].sort();
        opts[col.key] = values;
      }
    });
    return opts;
  }, [tableData, tableColumns]);

  // Apply filter + sort once, share across both views by zipping tableData/cardItems indices.
  const { filteredRows, filteredItems } = useMemo(() => {
    const searchLower = globalFilter.toLowerCase().trim();
    const filterEntries = Object.entries(columnFilters).filter(([, v]) => v);
    const colKeys = tableColumns.map(c => c.key);

    const matches = (row: DataTableRow) => {
      for (const [key, val] of filterEntries) {
        // Case-insensitive equals so `?country=germany` and `?country=Germany`
        // both match data values like "Germany".
        if (String(row[key] ?? '').toLowerCase() !== val.toLowerCase()) return false;
      }
      if (searchLower) {
        const haystack = colKeys.map(k => String(row[k] ?? '').toLowerCase()).join(' ');
        if (!haystack.includes(searchLower)) return false;
      }
      return true;
    };

    const zipped = tableData.map((row, i) => ({ row, item: cardItems[i] }));
    const filtered = zipped.filter(({ row }) => matches(row));

    if (sort) {
      const dir = sort.desc ? -1 : 1;
      filtered.sort((a, b) => {
        const av = String(a.row[sort.id] ?? '');
        const bv = String(b.row[sort.id] ?? '');
        return av.localeCompare(bv, undefined, { numeric: true }) * dir;
      });
    }

    return {
      filteredRows: filtered.map(x => x.row),
      filteredItems: filtered.map(x => x.item).filter((x): x is CardItem => !!x),
    };
  }, [tableData, cardItems, columnFilters, globalFilter, sort, tableColumns]);

  const activeGroupBy =
    groupBy !== NONE && groupByOptions.some(o => o.key === groupBy) ? groupBy : undefined;
  const groupByLabel = groupByOptions.find(o => o.key === activeGroupBy)?.label;
  const hasActiveFilters = globalFilter !== '' || Object.keys(columnFilters).length > 0 || sort !== null;
  const filteredCount = filteredRows.length;

  return (
    <div>
      {/* Filter bar — shared across both views */}
      <div className="flex flex-wrap items-center gap-3 mt-6 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={globalFilter}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none transition-colors duration-75 focus:border-accent focus:ring-1 focus:ring-accent-glow"
          />
        </div>

        {tableColumns
          .filter(c => c.filterable)
          .map(col => {
            const currentVal = columnFilters[col.key] || '';
            return (
              <select
                key={col.key}
                value={currentVal}
                onChange={e => handleColumnFilterChange(col.key, e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-75 focus:border-accent focus:ring-1 focus:ring-accent-glow"
              >
                <option value="">All {pluralLabel(col.label)}</option>
                {filterOptions[col.key]?.map(opt => (
                  <option key={opt} value={opt}>
                    {titleCase(opt)}
                  </option>
                ))}
              </select>
            );
          })}

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

      {/* Group-by + view toggle */}
      <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
        {groupByOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="groupby-select" className="eyebrow text-text-muted">
              Group by
            </label>
            <select
              id="groupby-select"
              value={groupBy}
              onChange={e => handleGroupByChange(e.target.value)}
              className={`eyebrow rounded-md border border-border bg-base px-2.5 py-1.5 outline-none transition-colors duration-75 focus:border-accent focus:ring-1 focus:ring-accent-glow ${
                activeGroupBy ? 'text-accent' : 'text-text-secondary'
              }`}
            >
              <option value={NONE}>None</option>
              {groupByOptions.map(opt => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex rounded-lg border border-border bg-base p-0.5">
          <button
            onClick={() => setView('table')}
            className={`eyebrow rounded-md px-3 py-1.5 transition-colors ${
              view === 'table' ? 'bg-elevated text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            &#9776; Table
          </button>
          <button
            onClick={() => setView('cards')}
            className={`eyebrow rounded-md px-3 py-1.5 transition-colors ${
              view === 'cards' ? 'bg-elevated text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            &#9744; Cards
          </button>
        </div>
      </div>

      {view === 'table' ? (
        <DataTable
          rows={filteredRows}
          columns={tableColumns}
          sort={sort}
          onSortChange={handleSortChange}
          onClearFilters={clearAll}
          groupBy={activeGroupBy}
          groupByLabel={groupByLabel}
        />
      ) : (
        <CardGrid items={filteredItems} groupBy={activeGroupBy} groupByLabel={groupByLabel} />
      )}
    </div>
  );
}
