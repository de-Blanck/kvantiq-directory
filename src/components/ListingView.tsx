import { useState, useEffect, useCallback } from 'react';
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

const NONE = 'none';

export default function ListingView({
  tableData,
  tableColumns,
  cardItems,
  searchPlaceholder,
  groupByOptions = [],
}: ListingViewProps) {
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [groupBy, setGroupBy] = useState<string>(NONE);

  // Sync from URL on mount (keeps parity with DataTable's ?sort/?q/?dir pattern)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get('groupBy');
    if (g && groupByOptions.some(o => o.key === g)) {
      setGroupBy(g);
    }
  }, []);

  const handleGroupByChange = useCallback((value: string) => {
    setGroupBy(value);
    const params = new URLSearchParams(window.location.search);
    if (value && value !== NONE) {
      params.set('groupBy', value);
    } else {
      params.delete('groupBy');
    }
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? '?' + qs : '');
    window.history.replaceState(null, '', newUrl);
  }, []);

  const activeGroupBy = groupBy !== NONE && groupByOptions.some(o => o.key === groupBy) ? groupBy : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-3 mt-6 mb-4">
        {groupByOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="groupby-select" className="eyebrow text-text-muted">
              Group by
            </label>
            <select
              id="groupby-select"
              value={groupBy}
              onChange={(e) => handleGroupByChange(e.target.value)}
              className={`eyebrow rounded-md border border-border bg-base px-2.5 py-1.5 outline-none transition-colors duration-75 focus:border-accent focus:ring-1 focus:ring-accent-glow ${
                activeGroupBy ? 'text-accent' : 'text-text-secondary'
              }`}
            >
              <option value={NONE}>None</option>
              {groupByOptions.map((opt) => (
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
          data={tableData}
          columns={tableColumns}
          searchPlaceholder={searchPlaceholder}
          groupBy={activeGroupBy}
          groupByLabel={groupByOptions.find(o => o.key === activeGroupBy)?.label}
        />
      ) : (
        <CardGrid
          items={cardItems}
          groupBy={activeGroupBy}
          groupByLabel={groupByOptions.find(o => o.key === activeGroupBy)?.label}
        />
      )}
    </div>
  );
}
