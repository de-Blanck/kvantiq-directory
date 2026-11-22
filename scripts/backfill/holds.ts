import type { HoldReason } from '../events/check';
import { mergeHeld } from '../events/held';
import { readHeldList, writeHeldList } from '../events/run';
import { buildMatcher, loadAliases, loadEventRecords } from './match';

export function recordHolds(
  root: string,
  holds: Array<{ entities: string[]; sourceUrl: string; reason: HoldReason }>,
  today: string,
): { added: number; total: number } {
  const previous = readHeldList(root);
  const match = buildMatcher(loadEventRecords(root), [], loadAliases(root));
  const unresolved = holds.filter(hold => !hold.entities.every(entity => match(entity, hold.sourceUrl)?.status === 'event'));
  const merged = mergeHeld(previous, unresolved, new Set(), today);
  writeHeldList(root, merged);
  return { added: merged.length - previous.length, total: merged.length };
}
