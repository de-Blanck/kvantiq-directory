import type { ScoreResult } from './probe-types.ts';

const DIRECTORY_HOST = 'directory.kvantiq.studio';
const BRAND_PATTERNS = [/kvantiq\s+directory/i, /kvantiq\s+studio/i, /kvantiq\.studio/i];

export function scoreResponse(responseText: string): ScoreResult {
  const text = responseText ?? '';

  if (text.toLowerCase().includes(DIRECTORY_HOST)) {
    return {
      label: 'cited',
      points: 2,
      reason: `Response contains ${DIRECTORY_HOST}`,
    };
  }

  if (BRAND_PATTERNS.some(p => p.test(text))) {
    return {
      label: 'mentioned',
      points: 1,
      reason: 'Response references Kvantiq by name without directory URL',
    };
  }

  return {
    label: 'absent',
    points: 0,
    reason: 'No mention or URL found',
  };
}
