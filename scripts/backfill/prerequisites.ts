import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadAliases } from './match';

export function checkPrerequisites(root: string, step: string): void {
  if (['worklist', 'apply', 'reconcile'].includes(step) && !existsSync(join(root, '.backfill/harvest.json'))) {
    throw new Error('Run the harvest step first: .backfill/harvest.json is missing');
  }
  if (step === 'worklist' && Object.keys(loadAliases(root)).length > 0 &&
      !existsSync(join(root, '.backfill/homepage-resolved.json'))) {
    throw new Error('Restore the homepage resolutions first: .backfill/homepage-resolved.json is missing while data/legacy-url-aliases.json is non-empty');
  }
}
