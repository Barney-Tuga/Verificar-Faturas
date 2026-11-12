import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInvoicePages, parsePortugueseNumber } from '../src/pdf-parser.js';

test('interpreta quantidades no formato português', () => {
  assert.equal(parsePortugueseNumber('3 000,00'), 3000);
  assert.equal(parsePortugueseNumber('1.234,50'), 1234.5);
  assert.equal(parsePortugueseNumber('não é quantidade'), null);
});

test('importa artigos de todas as páginas sem dados de faturas reais', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
  const header = (y) => [
    item('CÓD. ARTIGO', 10, y),
    item('DESCRIÇÃO', 100, y),
    item('QUANT.', 300, y),
    item('UNI', 400, y)
  ];
  const pages = [
    [
      [item('Nº: 123', 10, 200)],
      [item('Nº Fornecedor: 1', 10, 180)],
      [item('Fornecedor Exemplo', 10, 170)],
      header(150),
      [item('REF-001', 10, 140), item('Artigo de teste', 100, 140), item('3 000,00', 300, 140), item('UNI', 400, 140)]
    ].flat(),
    [
      header(150),
      [item('REF-002', 10, 140), item('Segundo artigo', 100, 140), item('2,50', 300, 140), item('UNI', 400, 140)]
    ].flat()
  ];
  const result = parseInvoicePages(pages);
  assert.equal(result.number, '123');
  assert.equal(result.supplier, 'Fornecedor Exemplo');
  assert.deepEqual(result.articles, [
    { reference: 'REF-001', description: 'Artigo de teste', invoiced: 3000 },
    { reference: 'REF-002', description: 'Segundo artigo', invoiced: 2.5 }
  ]);
});

test('não inventa artigos em documentos sem tabela reconhecida', () => {
  assert.deepEqual(parseInvoicePages([[{ str: 'Fatura digitalizada', transform: [1, 0, 0, 1, 20, 20] }]]).articles, []);
});
