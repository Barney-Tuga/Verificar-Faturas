import test from 'node:test';
import assert from 'node:assert/strict';
import { describeDifference } from '../src/difference.js';

test('assinala quantidades inferiores, iguais e superiores', () => {
  assert.deepEqual(describeDifference(299, 300), { text: '-1', kind: 'negative', description: 'em falta' });
  assert.deepEqual(describeDifference(300, 300), { text: '0', kind: 'zero', description: 'sem diferença' });
  assert.deepEqual(describeDifference(301, 300), { text: '+1', kind: 'positive', description: 'a mais' });
});

test('formata diferenças decimais em português sem artefactos de precisão', () => {
  assert.equal(describeDifference('0.3', '0.1').text, '+0,2');
  assert.equal(describeDifference('1.5', '2').text, '-0,5');
  assert.equal(describeDifference('1500', '0').text, '+1500');
});

test('não transforma valores em falta ou inválidos em diferenças', () => {
  for (const value of ['', null, undefined, 'abc', -1]) {
    assert.equal(describeDifference(value, 0), null);
    assert.equal(describeDifference(0, value), null);
  }
});
