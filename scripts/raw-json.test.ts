import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { appendToTopLevelArray, duplicateKeys, topLevelArrays } from './raw-json';

const duplicateNews = String.raw`{"news":[{"url":"a"}],
"x":{"news":[1]},"s":"\"news\": [2]","news":[{"url":"b"}]}`;

test('reads only top-level arrays in file order, including with CRLF', () => {
  const expected = [[{ url: 'a' }], [{ url: 'b' }]];
  assert.deepEqual(topLevelArrays(duplicateNews, 'news'), expected);
  assert.deepEqual(topLevelArrays(duplicateNews.replaceAll('\n', '\r\n'), 'news'), expected);
});

test('reports duplicate keys at any nesting depth', () => {
  assert.deepEqual(duplicateKeys(duplicateNews), [{ path: '$', key: 'news', count: 2 }]);
  assert.deepEqual(duplicateKeys('{"a":{"k":1,"k":2}}'), [{ path: '$.a', key: 'k', count: 2 }]);
  assert.deepEqual(duplicateKeys(String.raw`{"news":[{"k":1,"\u006b":2,"k":3}]}`),
    [{ path: '$.news[0]', key: 'k', count: 3 }]);
});

test('appends with existing indentation and line endings, preserving other bytes', () => {
  const prefix = '{\r\n    "a" :1,\r\n    "sources": [\r\n        {"url":"a"}';
  const suffix = '],\r\n    "b":2\r\n}\r\n';
  const raw = prefix + '\r\n    ' + suffix;
  const result = appendToTopLevelArray(raw, 'sources', [{ url: 'b' }]);
  assert.equal(result, prefix + ',\r\n        {\r\n          "url": "b"\r\n        }\r\n    ' + suffix);
  assert.deepEqual(JSON.parse(result).sources, [{ url: 'a' }, { url: 'b' }]);
});

test('appends to an empty array and rejects missing or repeated keys', () => {
  assert.equal(appendToTopLevelArray('{\n    "sources": []\n}', 'sources', [1]),
    '{\n    "sources": [\n      1\n    ]\n}');
  assert.throws(() => appendToTopLevelArray('{}', 'sources', [1]));
  assert.throws(() => appendToTopLevelArray('{"sources":null,"sources":[]}', 'sources', [1]));
});

test.skip('content JSON has no duplicate keys', () => {
  const root = new URL('../src/content/', import.meta.url);
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const path = join(entry.parentPath, entry.name);
    assert.deepEqual(duplicateKeys(readFileSync(path, 'utf8')), [], path);
  }
});
