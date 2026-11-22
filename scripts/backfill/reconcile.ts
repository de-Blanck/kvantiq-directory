import { readHeldList } from '../events/run';
import { scanLegacy } from './legacy';
import { buildMatcher, loadAliases, loadEventRecords } from './match';
import type { Collection, Harvest } from './types';

export type ReconcileRow = {
  entity: string;
  url: string;
  origin: 'legacy' | 'harvest';
  status: 'event' | 'held' | 'missing';
  eventId?: string;
  reason?: string;
};

export function reconcile(root: string, harvest: Harvest | null, collection?: Collection): {
  rows: ReconcileRow[];
  counts: { event: number; held: number; missing: number };
  changes: Array<{ entity: string; field: string; to: unknown; status: 'deferred' | 'superseded' }>;
} {
  const match = buildMatcher(loadEventRecords(root), readHeldList(root), loadAliases(root));
  const items = [
    ...scanLegacy(root).map(item => ({ ...item, origin: 'legacy' as const })),
    ...(harvest?.news ?? []).map(item => ({ ...item, origin: 'harvest' as const })),
  ];
  const counts = { event: 0, held: 0, missing: 0 };
  const rows: ReconcileRow[] = [];
  for (const item of items) {
    if (collection && item.collection !== collection) continue;
    const { entity, url, origin } = item;
    const result = match(entity, url) ?? { status: 'missing' as const };
    rows.push({ entity, url, origin, ...result });
    counts[result.status]++;
  }

  const changes = (harvest?.changes ?? [])
    .filter(({ entity }) => !collection || entity.startsWith(collection + '/'))
    .flatMap(({ entity, field, to, superseded }) => [
      { entity, field, to, status: 'deferred' as const },
      ...superseded.map(value => ({ entity, field, to: value.to, status: 'superseded' as const })),
    ]);
  return { rows, counts, changes };
}
