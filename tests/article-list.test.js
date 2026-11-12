import test from 'node:test';
import assert from 'node:assert/strict';
import { filterArticles, hasArticleDifferences, isArticleReconciled } from '../src/article-list.js';

const article = (overrides = {}) => ({
  id: 'item-1',
  reference: 'REF-001',
  invoiced: 10,
  received: 10,
  systemStock: 5,
  shelfStock: 5,
  verification: { state: 'not-started', startedAt: null, completedAt: null },
  ...overrides
});

test('assinala automaticamente referências sem diferenças e deixa diferenças positivas e negativas por acertar', () => {
  const correct = article();
  assert.equal(hasArticleDifferences(correct), false);
  assert.equal(isArticleReconciled(correct), true);

  for (const mismatch of [
    { shelfStock: 4 },
    { shelfStock: 6 },
    { received: 9 },
    { received: 11 }
  ]) {
    const item = article(mismatch);
    assert.equal(hasArticleDifferences(item), true);
    assert.equal(isArticleReconciled(item), false);
  }
});

test('preserva checks definidos manualmente', () => {
  assert.equal(isArticleReconciled(article({ shelfStock: 6, reconciled: true })), true);
  assert.equal(isArticleReconciled(article({ reconciled: false })), false);
});

test('filtra por referência, estado de verificação e estado do check', () => {
  const items = [
    article({ id: 'done', reference: 'ABC-01', verification: { state: 'done' } }),
    article({ id: 'progress', reference: 'XYZ-02', verification: { state: 'in-progress' } }),
    article({ id: 'unmatched', reference: 'ABC-03', shelfStock: 6 })
  ];

  assert.deepEqual(filterArticles(items, { query: 'abc' }).map((item) => item.id), ['done', 'unmatched']);
  assert.deepEqual(filterArticles(items, { verificationState: 'in-progress' }).map((item) => item.id), ['progress']);
  assert.deepEqual(filterArticles(items, { reconciliation: 'reconciled' }).map((item) => item.id), ['done', 'progress']);
  assert.deepEqual(filterArticles(items, { reconciliation: 'unreconciled' }).map((item) => item.id), ['unmatched']);
});
