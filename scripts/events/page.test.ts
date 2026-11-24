import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { htmlToText, quoteFound, dateFound, amountInQuote } from './page';

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
  for (const s of ['éApr 2, 2025', '2 Apr 2025é', 'é2025-04-02', '2 April 2025é']) assert.ok(!dateFound('2025-04-02', '<p></p>', s), s);
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
