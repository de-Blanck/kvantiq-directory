import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  htmlToText, quoteFound, dateFound, amountInQuote, arxivFirstVersionDate, githubReleaseDate, hasSourceDate, sourceDate,
} from './page';

const fx = readFileSync(new URL('./fixtures/funding-release.html', import.meta.url), 'utf8');
test('text: hidden elements and scripts removed, entities decoded', () => {
  const t = htmlToText('<p>A&nbsp;&amp;&nbsp;B</p><div style="display:none">decoy</div><span aria-hidden="true">decoy</span><script>x</script>');
  assert.equal(t.replace(/ ¶ /g, '').trim(), 'A & B');
});
test('quote: typographic variants match; inline tags do not break it', () =>
  assert.ok(quoteFound('"We\'re thrilled" - CEO says', htmlToText('<p>“We’re <b>thrilled</b>” — CEO says</p>'))));
test('quote: text split across two blocks does not match', () =>
  assert.ok(!quoteFound('first sentence second sentence', htmlToText('<p>first sentence</p><p>second sentence</p>'))));
test('quote: hidden decoy does not match', () => assert.ok(!quoteFound('decoy text that is hidden here', htmlToText(fx))));
test('quote: empty or short quote never matches', () => { assert.ok(!quoteFound('', 'anything')); assert.ok(!quoteFound('short', 'short')); });
test('date: article metadata within ±3 days counts; related-story <time> and WebPage JSON-LD do not', () => {
  assert.ok(dateFound('2026-11-20', fx, htmlToText(fx)));
  assert.ok(!dateFound('2026-11-25', fx, htmlToText(fx)));
  assert.ok(!dateFound('2025-01-01', fx, htmlToText(fx)));
});
test('date: text formats count', () => {
  for (const s of ['on 2026-07-08', 'on 8 July 2026', 'on July 8, 2026', 'on 08.07.2026']) assert.ok(dateFound('2026-07-08', '<p></p>', s), s);
});
test('date: short month names count, as arXiv writes them', () => {
  for (const s of ['Submitted on 2 Apr 2025', '[v1] Wed, 2 Apr 2025 10:10:11 UTC', 'on 02 Apr. 2025', 'on Apr 2, 2025', 'on Apr. 2, 2025']) {
    assert.ok(dateFound('2025-04-02', '<p></p>', s), s);
  }
  for (const s of ['on 9 Sep 2025', 'on 9 Sept 2025', 'on Sept. 9, 2025']) assert.ok(dateFound('2025-09-09', '<p></p>', s), s);
});
test('date: short month names still need the right day, month and year', () => {
  for (const s of ['on 12 Apr 2025', 'on 2 Apr 2024', 'on 2 Mar 2025', 'on Apr 22, 2025', 'on 2 Aprx 2025']) {
    assert.ok(!dateFound('2025-04-02', '<p></p>', s), s);
  }
});
test('date: a date glued to a letter does not count', () => {
  for (const s of ['éApr 2, 2025', '2 Apr 2025é', 'é2025-04-02', '2 April 2025é', 'कि2025-04-02', '2025-04-02_foo']) {
    assert.ok(!dateFound('2025-04-02', '<p></p>', s), s);
  }
});
test('arXiv: first-version date is read from the submission line or the v1 history line', () => {
  assert.equal(arxivFirstVersionDate('Submitted on 2 Apr 2025 (v1), last revised 14 Jan 2026 (this version, v3)'), '2025-04-02');
  assert.equal(arxivFirstVersionDate('[Submitted on 9 Sep 2025]'), '2025-09-09');
  assert.equal(arxivFirstVersionDate('[v1] Wed, 2 Apr 2025 10:10:11 UTC (10,864 KB) [v2] Thu, 3 Apr 2025 08:00:00 UTC'), '2025-04-02');
  assert.equal(arxivFirstVersionDate('Resubmitted on 3 Apr 2025. [Submitted on 2 Apr 2025]'), '2025-04-02');
  assert.equal(arxivFirstVersionDate('Published 2 April 2025'), null);
});
const releasePage = [
  '<p>Last edited <relative-time datetime="2026-07-01T00:00:00Z"></relative-time></p>',
  '<a href="/qiskit-bot">qiskit-bot</a> released this',
  '  <relative-time datetime="2026-08-13T17:49:55Z" class="no-wrap"></relative-time>',
  '<p>Verified <relative-time datetime="2026-08-01 10:00:00 UTC"></relative-time></p>',
].join('\n');
test('GitHub release: the release date is read after "released this", not from earlier or later relative-time', () => {
  assert.equal(githubReleaseDate(releasePage), '2026-08-13');
});
test('GitHub release: the "YYYY-MM-DD HH:MM:SS UTC" form is accepted', () => {
  assert.equal(githubReleaseDate('released this <span><relative-time datetime="2026-08-13 17:49:43 UTC"></relative-time></span>'), '2026-08-13');
});
test('GitHub release: no "released this" gives null', () => {
  assert.equal(githubReleaseDate('<p>published <relative-time datetime="2026-08-13T17:49:55Z"></relative-time></p>'), null);
});
test('GitHub release: a relative-time more than 1000 characters after "released this" gives null', () => {
  const at = (gap: number) => githubReleaseDate(`released this${' '.repeat(gap)}<relative-time datetime="2026-08-13T17:49:55Z"></relative-time>`);
  assert.equal(at(1000), '2026-08-13');
  assert.equal(at(1001), null);
});
test('GitHub release: "released&nbsp;this" is a marker', () => {
  assert.equal(githubReleaseDate('qiskit-bot released&nbsp;this <relative-time datetime="2026-08-13T17:49:55Z"></relative-time>'), '2026-08-13');
});
test('GitHub release: a marker inside an attribute or a comment is skipped in favour of the real header', () => {
  const html = [
    '<!-- released this <relative-time datetime="2026-06-01T00:00:00Z"></relative-time> -->',
    '<div title="released this">Edited <relative-time datetime="2026-07-01T00:00:00Z"></relative-time></div>',
    '<a href="/qiskit-bot">qiskit-bot</a> released this <relative-time datetime="2026-08-13T17:49:55Z"></relative-time>',
  ].join('\n');
  assert.equal(githubReleaseDate(html), '2026-08-13');
});
test('GitHub release: text between the marker and the relative-time disqualifies it', () => {
  const html = '<div>qiskit-bot released this</div><p>Verified <relative-time datetime="2026-08-01 10:00:00 UTC"></relative-time></p>';
  assert.equal(githubReleaseDate(html), null);
});
test('source date: a GitHub release-tag URL is recognised and dated by its release', () => {
  const url = 'https://github.com/Qiskit/qiskit/releases/tag/2.5.2';
  assert.equal(hasSourceDate(url), true);
  assert.equal(sourceDate(url, releasePage, htmlToText(releasePage)), '2026-08-13');
});
test('source date: an uppercase host and a query string still make a release-tag URL', () => {
  assert.equal(hasSourceDate('https://GitHub.com/o/r/releases/tag/v1?x=1'), true);
  assert.equal(hasSourceDate('https://github.com/o/r/releases/tag/v1/'), true);
});
test('source date: a release tag containing slashes is a release-tag URL', () => {
  assert.equal(hasSourceDate('https://github.com/changesets/changesets/releases/tag/@changesets/cli@2.31.0'), true);
  assert.equal(hasSourceDate('https://github.com/o/r/releases/tag/release/2026.1'), true);
});
test('source date: a GitHub releases index, an empty tag, a gist and another host are not recognised', () => {
  for (const url of [
    'https://github.com/o/r/releases', 'https://github.com/o/r/releases/tag/', 'https://github.com/o/r/releases/tag',
    'https://gist.github.com/o/releases/tag/v1', 'https://example.com/o/r/releases/tag/v1',
  ]) {
    assert.equal(hasSourceDate(url), false, url);
    assert.equal(sourceDate(url, releasePage, htmlToText(releasePage)), null, url);
  }
});
test('source date: an arXiv abstract URL is recognised and dated by its first version', () => {
  const url = 'https://arxiv.org/abs/2504.01567';
  const text = 'Submitted on 2 Apr 2025 (v1), last revised 14 Jan 2026 (this version, v3)';
  assert.equal(hasSourceDate(url), true);
  assert.equal(sourceDate(url, `<p>${text}</p>`, text), '2025-04-02');
});
test('amount: currency-tied formats match', () => {
  assert.ok(amountInQuote(12_000_000, 'EUR', 'raised €12M in a seed round'));
  assert.ok(amountInQuote(12_000_000, 'EUR', 'EUR 12 million'));
  assert.ok(amountInQuote(1_200_000_000, 'USD', 'a $1.2bn round'));
  assert.ok(amountInQuote(12_500_000, 'DKK', 'rejste 12,5 mio. kr.'));
  assert.ok(amountInQuote(1_250_000, null, '€1,250,000'));
});
test('amount: wrong magnitude, wrong currency, or bare number does not match', () => {
  assert.ok(!amountInQuote(125_000_000, 'EUR', 'raised €12.5M'));
  assert.ok(!amountInQuote(12_000_000, 'USD', 'raised €12M'));
  assert.ok(!amountInQuote(12_000_000, 'EUR', 'hired 12 million users'));
});

for (const prefix of ['US$', 'US$ ', 'USD ']) {
  test(`amount: ${prefix} matches USD`, () => {
    assert.equal(amountInQuote(12_000_000, 'USD', `raised ${prefix}12M`), true);
  });
}

for (const prefix of ['A$', 'C$']) {
  test(`amount: ${prefix} matches an unspecified currency only`, () => {
    assert.equal(amountInQuote(12_000_000, 'USD', `raised ${prefix}12M`), false);
    assert.equal(amountInQuote(12_000_000, null, `raised ${prefix}12M`), true);
  });
}

test('date: metadata exactly three days away counts, four days away does not', () => {
  const html = '<meta property="article:published_time" content="2026-11-18">';
  for (const date of ['2026-11-15', '2026-11-21']) assert.equal(dateFound(date, html, ''), true);
  for (const date of ['2026-11-14', '2026-11-22']) assert.equal(dateFound(date, html, ''), false);
});
