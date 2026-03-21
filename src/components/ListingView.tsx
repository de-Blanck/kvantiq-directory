import { useState } from 'react';
import DataTable, { type DataTableColumn, type DataTableRow } from './DataTable';
import CardGrid, { type CardItem } from './CardGrid';

interface ListingViewProps {
  tableData: DataTableRow[];
  tableColumns: DataTableColumn[];
  cardItems: CardItem[];
  searchPlaceholder?: string;
}

export default function ListingView({ tableData, tableColumns, cardItems, searchPlaceholder }: ListingViewProps) {
  const [view, setView] = useState<'table' | 'cards'>('table');

  return (
    <div>
      <div className="flex justify-end mb-4 mt-6">
        <div className="flex rounded-lg border border-border bg-base p-0.5">
          <button
            onClick={() => setView('table')}
            className={`rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors ${
              view === 'table' ? 'bg-surface text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            &#9776; Table
          </button>
          <button
            onClick={() => setView('cards')}
            className={`rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors ${
              view === 'cards' ? 'bg-surface text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            &#9744; Cards
          </button>
        </div>
      </div>
      {view === 'table' ? (
        <DataTable data={tableData} columns={tableColumns} searchPlaceholder={searchPlaceholder} />
      ) : (
        <CardGrid items={cardItems} />
      )}
    </div>
  );
}
