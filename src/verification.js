export const VERIFICATION_STATES = ['not-started', 'in-progress', 'done'];

export function getVerification(article) {
  const verification = article.verification;
  if (!verification || !VERIFICATION_STATES.includes(verification.state)) {
    return { state: 'not-started', startedAt: null, completedAt: null };
  }
  return {
    state: verification.state,
    startedAt: verification.startedAt || null,
    completedAt: verification.completedAt || null
  };
}

export function setVerificationState(article, state, now = new Date().toISOString()) {
  if (!VERIFICATION_STATES.includes(state)) throw new Error(`Estado de verificação inválido: ${state}`);
  const previous = getVerification(article);
  if (state === previous.state) return previous;
  if (state === 'not-started') return { state, startedAt: null, completedAt: null };
  if (state === 'in-progress') {
    return {
      state,
      startedAt: now,
      completedAt: null
    };
  }
  return {
    state,
    startedAt: previous.startedAt || now,
    completedAt: now
  };
}

export function formatElapsed(startedAt, completedAt = null, now = Date.now()) {
  const start = Date.parse(startedAt);
  const end = completedAt ? Date.parse(completedAt) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '';
  const minutes = Math.floor((end - start) / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  if (days) return `${days} d ${hours} h ${remainder} min`;
  if (hours) return `${hours} h ${remainder} min`;
  return `${remainder} min`;
}
