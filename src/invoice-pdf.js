import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { describeDifference } from './difference.js';
import { formatElapsed, getVerification } from './verification.js';

const COLUMN_WIDTHS = [29, 21, 21, 19, 23, 23, 18, 91, 49, 49, 28];
const TABLE_WIDTH = COLUMN_WIDTHS.reduce((total, width) => total + width, 0);

const quantity = (value) => value === '' || value === null || value === undefined
  ? ''
  : new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(Number(value));

const timestamp = (value) => value
  ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '';

function difference(actual, expected) {
  return describeDifference(actual, expected)?.text ?? '';
}

export function getInvoicePdfRows(invoice, now = Date.now()) {
  return invoice.articles.map((article) => {
    const verification = getVerification(article);
    return [
      article.reference || '',
      quantity(article.invoiced),
      quantity(article.received),
      difference(article.received, article.invoiced),
      quantity(article.systemStock),
      quantity(article.shelfStock),
      difference(article.shelfStock, article.systemStock),
      article.note || article.description || '',
      timestamp(verification.startedAt),
      timestamp(verification.completedAt),
      verification.startedAt ? formatElapsed(verification.startedAt, verification.completedAt, now) : ''
    ];
  });
}

export function createInvoicePdf(invoice, now = Date.now()) {
  if (invoice.status !== 'done') {
    throw new Error('Só é possível descarregar uma fatura depois de concluir a verificação.');
  }
  if (!invoice.articles.length) {
    throw new Error('A fatura não tem artigos para exportar.');
  }

  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageWidth = document.internal.pageSize.getWidth();
  document.setFont('helvetica', 'bold');
  document.setFontSize(18);
  document.setTextColor(33, 69, 54);
  document.text('Relatório de verificação', 10, 14);

  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.setTextColor(81, 101, 87);
  document.text(`Fornecedor: ${invoice.supplier || '—'}    Fatura: ${invoice.number || '—'}`, 10, 21);
  document.text(`Ficheiro: ${invoice.fileName || 'Adicionada manualmente'}    Data: ${timestamp(invoice.createdAt) || '—'}`, 10, 27);

  autoTable(document, {
    startY: 33,
    head: [[
      'Referência',
      'Qtd. faturada',
      'Qtd. recebida',
      'Dif. recebida',
      'Qtd. no sistema',
      'Qtd. prateleira',
      'Dif. stock',
      'Nota / descrição',
      'Início da verificação',
      'Conclusão da verificação',
      'Tempo'
    ]],
    body: getInvoicePdfRows(invoice, now),
    theme: 'grid',
    margin: { left: 10, right: 10, top: 33, bottom: 14 },
    tableWidth: TABLE_WIDTH,
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 2,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [220, 229, 220],
      textColor: [48, 65, 53]
    },
    headStyles: {
      fillColor: [35, 76, 61],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    alternateRowStyles: { fillColor: [244, 248, 242] },
    columnStyles: {
      0: { cellWidth: 29, fontStyle: 'bold' },
      1: { cellWidth: 21, halign: 'right' },
      2: { cellWidth: 21, halign: 'right' },
      3: { cellWidth: 19, halign: 'center' },
      4: { cellWidth: 23, halign: 'right' },
      5: { cellWidth: 23, halign: 'right' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 91 },
      8: { cellWidth: 49, halign: 'center' },
      9: { cellWidth: 49, halign: 'center' },
      10: { cellWidth: 28, halign: 'center' }
    },
    didParseCell(data) {
      if (data.section !== 'body' || (data.column.index !== 3 && data.column.index !== 6)) return;
      const value = String(data.cell.raw);
      if (value.startsWith('-')) data.cell.styles.textColor = [180, 62, 62];
      else if (value.startsWith('+')) data.cell.styles.textColor = [38, 115, 62];
      else if (value === '0') data.cell.styles.textColor = [38, 105, 164];
      else return;
      data.cell.styles.fontStyle = 'bold';
    }
  });

  const pageCount = document.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    document.setPage(page);
    document.setFont('helvetica', 'normal');
    document.setFontSize(8);
    document.setTextColor(130, 145, 132);
    document.text(`Conferir · ${invoice.number || 'Fatura'} · Página ${page} de ${pageCount}`, pageWidth - 10, document.internal.pageSize.getHeight() - 6, { align: 'right' });
  }

  const safeName = `${invoice.number || 'fatura'}-${invoice.supplier || 'verificada'}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return { document, fileName: `fatura-${safeName || 'verificada'}.pdf` };
}

export function downloadInvoicePdf(invoice, now = Date.now()) {
  const { document, fileName } = createInvoicePdf(invoice, now);
  document.save(fileName);
}
