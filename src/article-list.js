import { getVerification } from './verification.js';

const validNumber = (value) => value !== '' && value !== null && value !== undefined
  && Number.isFinite(Number(value)) && Number(value) >= 0;

export function isArticleComplete(article) {
  return Boolean(article.reference.trim())
    && ['invoiced', 'received', 'systemStock', 'shelfStock'].every((field) => validNumber(article[field]));
}

export function hasArticleDifferences(article) {
  return isArticleComplete(article)
    && (Number(article.invoiced) !== Number(article.received)
      || Number(article.systemStock) !== Number(article.shelfStock));
}

export function getArticleVisualState(article) {
  if (isArticleReconciled(article)) return 'checked';
  if (!isArticleComplete(article)) return 'neutral';
  if (Number(article.received) !== Number(article.invoiced)) {
    return Number(article.received) > Number(article.invoiced) ? 'positive' : 'negative';
  }
  if (Number(article.shelfStock) !== Number(article.systemStock)) {
    return Number(article.shelfStock) > Number(article.systemStock) ? 'positive' : 'negative';
  }
  return 'neutral';
}

export function isArticleReconciled(article) {
  return typeof article.reconciled === 'boolean' ? article.reconciled : !hasArticleDifferences(article);
}

export function filterArticles(articles, { query = '', verificationState = '', reconciliation = '' } = {}) {
  const term = query.trim().toLocaleLowerCase('pt-PT');
  return articles.filter((article) => {
    if (term && !article.reference.toLocaleLowerCase('pt-PT').includes(term)) return false;
    if (verificationState && getVerification(article).state !== verificationState) return false;
    if (reconciliation === 'reconciled' && !isArticleReconciled(article)) return false;
    if (reconciliation === 'unreconciled' && isArticleReconciled(article)) return false;
    return true;
  });
}
