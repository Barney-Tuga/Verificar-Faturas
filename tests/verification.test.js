import test from 'node:test';
import assert from 'node:assert/strict';
import { formatElapsed, getVerification, setVerificationState } from '../src/verification.js';

const start = '2026-11-10T09:00:00.000Z';

test('regista início, conclusão e reinício de uma referência', () => {
  const article = {};
  article.verification = setVerificationState(article, 'in-progress', start);
  assert.deepEqual(article.verification, { state: 'in-progress', startedAt: start, completedAt: null });
  article.verification = setVerificationState(article, 'done', '2026-11-12T10:30:00.000Z');
  assert.deepEqual(article.verification, {
    state: 'done',
    startedAt: start,
    completedAt: '2026-11-12T10:30:00.000Z'
  });
  article.verification = setVerificationState(article, 'in-progress', '2026-11-13T08:00:00.000Z');
  assert.deepEqual(article.verification, {
    state: 'in-progress',
    startedAt: '2026-11-13T08:00:00.000Z',
    completedAt: null
  });
});

test('mantém compatibilidade com artigos sem registo de verificação', () => {
  assert.deepEqual(getVerification({}), { state: 'not-started', startedAt: null, completedAt: null });
});

test('calcula o tempo decorrido e congela-o na conclusão', () => {
  assert.equal(formatElapsed(start, null, Date.parse('2026-11-12T10:30:00.000Z')), '2 d 1 h 30 min');
  assert.equal(formatElapsed(start, '2026-11-12T10:30:00.000Z', Date.parse('2026-11-15T10:30:00.000Z')), '2 d 1 h 30 min');
});
