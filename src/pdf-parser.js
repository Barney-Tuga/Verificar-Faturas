function linesFromItems(items) {
  const lines = new Map();
  for (const item of items) {
    if (!item.str?.trim()) continue;
    const y = Math.round(item.transform[5]);
    if (!lines.has(y)) lines.set(y, []);
    lines.get(y).push({ x: item.transform[4], text: item.str.trim() });
  }
  return [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) => parts.sort((a, b) => a.x - b.x));
}

export function parsePortugueseNumber(value) {
  const normalized = value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function parseInvoicePages(pages) {
  const articles = [];
  let number = '';
  let supplier = '';
  for (const items of pages) {
    const lines = linesFromItems(items);
    for (let index = 0; index < lines.length; index++) {
      const parts = lines[index];
      const text = parts.map((part) => part.text).join(' ');
      if (!number) number = text.match(/^N[º°]\s*:\s*(.+)$/i)?.[1]?.trim() || '';
      if (!supplier && /N[º°]\s*Fornecedor/i.test(text)) {
        supplier = lines.slice(index + 1, index + 6).flat().find((part) => part.x >= parts[0].x - 5)?.text || '';
      }
      const codeHeader = parts.find((part) => /C[ÓO]D\.\s*ARTIGO/i.test(part.text));
      const descHeader = parts.find((part) => /DESCRI[ÇC][ÃA]O/i.test(part.text));
      const qtyHeader = parts.find((part) => /QUANT\./i.test(part.text));
      const unitHeader = parts.find((part) => /^UNI$/i.test(part.text));
      if (!codeHeader || !descHeader || !qtyHeader || !unitHeader) continue;

      const codeEnd = (codeHeader.x + descHeader.x) / 2;
      const qtyStart = qtyHeader.x - 25;
      const qtyEnd = unitHeader.x - 5;
      for (const row of lines.slice(index + 1)) {
        const code = row.filter((part) => part.x >= codeHeader.x - 5 && part.x < codeEnd).map((part) => part.text).join(' ');
        const quantityText = row.filter((part) => part.x >= qtyStart && part.x < qtyEnd).map((part) => part.text).join(' ');
        const quantity = parsePortugueseNumber(quantityText);
        const description = row.filter((part) => part.x >= codeEnd && part.x < qtyStart).map((part) => part.text).join(' ');
        if (code && quantity !== null && row.some((part) => part.x >= qtyEnd && part.x < unitHeader.x + 25 && /^UNI$/i.test(part.text))) {
          articles.push({ reference: code, description, invoiced: quantity });
        } else if (!code && description && articles.length && row.every((part) => part.x >= codeEnd && part.x < qtyStart)) {
          articles[articles.length - 1].description += ` ${description}`;
        }
      }
      break;
    }
  }
  return { number, supplier, articles };
}
