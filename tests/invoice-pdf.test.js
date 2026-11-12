import test from 'node:test';
import assert from 'node:assert/strict';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { getInvoicePdfRows, createInvoicePdf } from '../src/invoice-pdf.js';

const invoice = {
  status: 'done',
  number: '2179',
  supplier: 'Triclo, S.A.',
  fileName: 'fatura.pdf',
  createdAt: '2026-11-12T10:00:00.000Z',
  articles: [{
    reference: 'REF-001',
    invoiced: 300,
    received: 299,
    systemStock: 10,
    shelfStock: 11,
    note: 'Prateleira do armazém',
    description: 'Descrição ignorada quando existe nota',
    verification: {
      state: 'done',
      startedAt: '2026-11-10T09:00:00.000Z',
      completedAt: '2026-11-12T10:30:00.000Z'
    }
  }]
};

test('prepara todas as colunas da fatura para a tabela PDF', () => {
  const rows = getInvoicePdfRows(invoice, Date.parse('2026-11-13T10:30:00.000Z'));
  assert.deepEqual(rows[0], [
    'REF-001', '300', '299', '-1', '10', '11', '+1',
    'Prateleira do armazém',
    '10/11/26, 09:00',
    '12/11/26, 10:30',
    '2 d 1 h 30 min'
  ]);
});

test('inclui artigos sem nota, durações em curso e referências sem datas', () => {
  const [row] = getInvoicePdfRows({
    ...invoice,
    articles: [{
      ...invoice.articles[0],
      note: '',
      description: 'Mola rápida',
      verification: { state: 'in-progress', startedAt: '2026-11-12T10:00:00.000Z', completedAt: null }
    }]
  }, Date.parse('2026-11-12T11:15:00.000Z'));
  assert.equal(row[7], 'Mola rápida');
  assert.equal(row[8], '12/11/26, 10:00');
  assert.equal(row[9], '');
  assert.equal(row[10], '1 h 15 min');

  const [untimed] = getInvoicePdfRows({
    ...invoice,
    articles: [{ ...invoice.articles[0], verification: null }]
  });
  assert.equal(untimed[8], '');
  assert.equal(untimed[9], '');
  assert.equal(untimed[10], '');
});

test('cria PDF horizontal em várias páginas e recusa faturas não concluídas', () => {
  const manyArticles = {
    ...invoice,
    articles: Array.from({ length: 100 }, (_, index) => ({
      ...invoice.articles[0],
      reference: `REF-${String(index).padStart(3, '0')}`
    }))
  };
  const { document, fileName } = createInvoicePdf(manyArticles);
  assert.equal(fileName, 'fatura-2179-triclo-s-a.pdf');
  assert.ok(document.internal.getNumberOfPages() > 1);
  assert.throws(() => createInvoicePdf({ ...invoice, status: 'ongoing' }), /concluir a verificação/);
});

test('o PDF contém os cabeçalhos, horários e texto português', async () => {
  const { document } = createInvoicePdf(invoice, Date.parse('2026-11-12T10:30:00.000Z'));
  const pdf = await getDocument({
    data: new Uint8Array(document.output('arraybuffer')),
    useSystemFonts: true
  }).promise;
  assert.equal(pdf.numPages, 1);
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.map((item) => item.str).join(' ');
  assert.match(text, /Referência/);
  assert.match(text, /Qtd\. faturada/);
  assert.match(text, /Dif\. recebida/);
  assert.match(text, /Conclusão da verificação/);
  assert.match(text, /Prateleira do armazém/);
  assert.match(text, /REF-001/);
});
