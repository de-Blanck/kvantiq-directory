import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../..');

function findTests(rel: string): string[] {
  const dir = join(root, rel);
  try {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter(d => d.isFile() && d.name.endsWith('.test.ts'))
      .map(d => join(d.parentPath, d.name));
  } catch {
    return [];
  }
}

const files = [...findTests('scripts'), ...findTests('src/lib')];

if (files.length === 0) {
  console.log('No test files found.');
  process.exit(0);
}

const result = spawnSync('node', ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit',
  shell: false,
  cwd: root,
});
process.exit(result.status ?? 1);
