export function describeDifference(actual, expected) {
  const valid = (value) => value !== '' && value !== null && value !== undefined
    && Number.isFinite(Number(value)) && Number(value) >= 0;
  if (!valid(actual) || !valid(expected)) return null;

  const value = Number(actual) - Number(expected);
  const formatted = new Intl.NumberFormat('pt-PT', { maximumSignificantDigits: 15 }).format(value);
  if (value < 0) return { text: formatted, kind: 'negative', description: 'em falta' };
  if (value > 0) return { text: `+${formatted}`, kind: 'positive', description: 'a mais' };
  return { text: '0', kind: 'zero', description: 'sem diferença' };
}
