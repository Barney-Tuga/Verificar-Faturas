import './style.css';
import { createIcons, Check, LayoutDashboard, History, Settings2, Sparkles, ChevronRight, CalendarDays, Plus, ArrowUpRight, FileCheck2, Clock3, PackageCheck, ArrowRight, FileText, Files, Search, Database, Download, Upload, Smartphone, ArrowLeft, RotateCcw, Trash2, ScanLine, Info, MessageSquareText, Package, Layers3 } from 'lucide';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseInvoicePages } from './pdf-parser.js';
import { describeDifference } from './difference.js';
import { formatElapsed, getVerification, setVerificationState, VERIFICATION_STATES } from './verification.js';
import { filterArticles, hasArticleDifferences, isArticleComplete, isArticleReconciled } from './article-list.js';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
const icons = { Check, LayoutDashboard, History, Settings2, Sparkles, ChevronRight, CalendarDays, Plus, ArrowUpRight, FileCheck2, Clock3, PackageCheck, ArrowRight, FileText, Files, Search, Database, Download, Upload, Smartphone, ArrowLeft, RotateCcw, Trash2, ScanLine, Info, MessageSquareText, Package, Layers3 };

const STORAGE_KEY = 'conferir.invoices.v1';
const app = document.querySelector('#app');
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.pdf,application/pdf';
fileInput.hidden = true;
document.body.append(fileInput);

let invoices = [];
let currentPage = 'inicio';
let currentId = null;
let search = '';
let articleSearch = '';
let articleFilter = '';
let deferredInstall = null;
let storageAvailable = true;

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error('Dados inválidos');
    invoices = parsed;
  }
} catch (error) {
  storageAvailable = false;
  alert('Não foi possível carregar os dados guardados neste dispositivo. Verifique o armazenamento do navegador antes de continuar.');
  console.error(error);
}

function save() {
  try {
    if (!storageAvailable) throw new Error('O armazenamento não está disponível');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
    return true;
  } catch (error) {
    console.error(error);
    alert('Não foi possível guardar as alterações. Verifique o espaço e as permissões de armazenamento do navegador.');
    return false;
  }
}

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = (name, size = 18) => `<i data-lucide="${name}" width="${size}" height="${size}"></i>`;
const fmt = (n) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(n);
const date = (value) => new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const dateTime = (value) => new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const today = () => new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
const newArticle = (data = {}) => ({ id: crypto.randomUUID(), reference: '', description: '', invoiced: '', received: '', systemStock: '', shelfStock: '', note: '', verification: { state: 'not-started', startedAt: null, completedAt: null }, ...data });
const hasNumber = (value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0;
const checked = isArticleComplete;
const difference = hasArticleDifferences;
const progress = (invoice) => invoice.articles.filter(checked).length;
const initials = (name) => (name || 'F').trim().slice(0, 2).toUpperCase();

function layout(content) {
  const active = currentId ? '' : currentPage;
  return `<div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#" data-action="home"><span class="brand-mark">${icon('check', 23)}</span><span>conferir<span class="brand-dot">.</span><small>FATURAS & STOCK</small></span></a>
      <div class="nav-caption">MENU PRINCIPAL</div>
      <nav class="navigation" aria-label="Menu principal">
        <button class="nav-item ${active === 'inicio' ? 'active' : ''}" data-page="inicio">${icon('layout-dashboard')}<span>Início</span></button>
        <button class="nav-item ${active === 'historico' ? 'active' : ''}" data-page="historico">${icon('history')}<span>Histórico</span></button>
        <button class="nav-item ${active === 'definicoes' ? 'active' : ''}" data-page="definicoes">${icon('settings-2')}<span>Definições</span></button>
      </nav>
      <div class="sidebar-bottom"><div class="side-tip"><span class="tip-icon">${icon('sparkles', 17)}</span><strong>Mais controlo,<br>menos surpresas.</strong><p>As suas conferências, sempre organizadas.</p></div><div class="local-status"><span></span> Dados neste dispositivo</div></div>
    </aside>
    <div class="workspace"><header class="topbar"><div class="breadcrumb"><span>Área de trabalho</span>${icon('chevron-right', 14)}<strong>${currentId ? 'Verificação de fatura' : ({ inicio: 'Início', historico: 'Histórico', definicoes: 'Definições' })[currentPage]}</strong></div><div class="top-right"><span>${icon('calendar-days', 16)} ${esc(today())}</span><div class="avatar">C</div></div></header>
      <main class="content">${content}</main><footer>CONFERIR <span>·</span> Feito para simplificar o seu dia.</footer></div>
    <nav class="mobile-nav" aria-label="Menu móvel"><button data-page="inicio" class="${active === 'inicio' ? 'active' : ''}">${icon('layout-dashboard')}<span>Início</span></button><button data-page="historico" class="${active === 'historico' ? 'active' : ''}">${icon('history')}<span>Histórico</span></button><button data-page="definicoes" class="${active === 'definicoes' ? 'active' : ''}">${icon('settings-2')}<span>Definições</span></button></nav>
  </div>`;
}

function stat(label, value, detail, iconName, color) {
  return `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${color}">${icon(iconName, 19)}</span></div><strong>${fmt(value)}</strong><small>${detail}</small></div>`;
}

function invoiceCard(invoice) {
  const done = progress(invoice);
  const total = invoice.articles.length;
  const percent = total ? Math.round(done / total * 100) : 0;
  return `<button class="invoice-card" data-action="open" data-id="${esc(invoice.id)}">
    <div class="invoice-icon">${icon('file-text', 21)}</div><div class="invoice-main"><div class="invoice-title">${esc(invoice.supplier || 'Fornecedor não identificado')} <span class="status ${invoice.status === 'done' ? 'done' : ''}"><span></span>${invoice.status === 'done' ? 'Concluída' : 'Em verificação'}</span></div><p>Fatura ${esc(invoice.number || 'sem número')} <span>·</span> ${date(invoice.createdAt)}</p><div class="progress-row"><div class="progress-track"><div style="width:${percent}%"></div></div><span>${done}/${total} artigos</span></div></div><span class="card-arrow">${icon('arrow-up-right', 18)}</span>
  </button>`;
}

function empty(title, text, action = false) {
  return `<div class="empty-state"><div class="empty-icon">${icon('files', 24)}</div><h3>${title}</h3><p>${text}</p>${action ? '<button class="text-button" data-action="import">Importar a primeira fatura ' + icon('arrow-right', 15) + '</button>' : ''}</div>`;
}

function dashboard() {
  const ongoing = invoices.filter((invoice) => invoice.status !== 'done');
  const complete = invoices.filter((invoice) => invoice.status === 'done');
  const articles = invoices.reduce((sum, invoice) => sum + progress(invoice), 0);
  return `<div class="page-heading"><div><div class="eyebrow"><span></span> VISÃO GERAL</div><h1>Olá, bem-vindo de volta <span class="wave">✳</span></h1><p>O seu espaço para conferir faturas com tranquilidade.</p></div><button class="button button-dark desktop-new" data-action="import">${icon('plus', 18)} Nova verificação</button></div>
    <section class="hero"><div class="hero-copy"><div class="hero-label">${icon('sparkles', 14)} TUDO SOB CONTROLO</div><h2>Boas conferências<br>começam aqui<span>.</span></h2><p>Importe uma fatura, confirme os artigos e mantenha o seu stock em dia. Simples assim.</p><button class="button button-light" data-action="import">${icon('plus', 18)} Verificar nova fatura ${icon('arrow-up-right', 16)}</button></div><div class="hero-art" aria-hidden="true"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-sheet"><div class="art-sheet-top"><span></span><i></i></div><div class="art-lines"><b></b><b></b><b></b></div><div class="art-table"><span></span><span></span><span></span></div><div class="art-table"><span></span><span></span><span></span></div><div class="art-table"><span></span><span></span><span></span></div></div><div class="art-check">${icon('check', 32)}</div><div class="art-sparkle">${icon('sparkles', 27)}</div><div class="art-mini">${icon('package-check', 20)}</div></div></section>
    <div class="section-label"><div><div class="eyebrow">O SEU PROGRESSO</div><h2>Um olhar rápido</h2></div><span>Atualizado agora</span></div>
    <section class="stats">${stat('Faturas concluídas', complete.length, 'Conferências terminadas', 'file-check-2', 'mint')}${stat('Em verificação', ongoing.length, 'Faturas em progresso', 'clock-3', 'peach')}${stat('Artigos conferidos', articles, 'Em todas as faturas', 'package-check', 'lavender')}</section>
    <section class="list-section"><div class="section-label"><div><div class="eyebrow">CONTINUE DE ONDE PAROU</div><h2>Em verificação <span class="count">${ongoing.length}</span></h2></div><button class="subtle-link" data-page="historico">Ver histórico ${icon('arrow-right', 16)}</button></div>${ongoing.length ? `<div class="invoice-list">${ongoing.map(invoiceCard).join('')}</div>` : empty('Ainda não há faturas em verificação', 'Quando começar uma nova conferência, ela aparece aqui.', true)}</section>`;
}

function historyPage() {
  const term = search.trim().toLocaleLowerCase('pt-PT');
  const filtered = invoices.filter((invoice) => `${invoice.number} ${invoice.supplier} ${invoice.fileName}`.toLocaleLowerCase('pt-PT').includes(term));
  return `<div class="page-heading"><div><div class="eyebrow"><span></span> AS SUAS FATURAS</div><h1>Histórico</h1><p>Todas as suas verificações, num só lugar.</p></div><button class="button button-dark" data-action="import">${icon('plus', 18)} Nova verificação</button></div>
    <div class="history-toolbar"><div><h2>Faturas <span class="count">${filtered.length}</span></h2><p>Consulte ou retome uma conferência.</p></div><label class="search">${icon('search', 18)}<input id="search" type="search" placeholder="Pesquisar faturas..." value="${esc(search)}" aria-label="Pesquisar faturas"></label></div>
    ${filtered.length ? `<div class="invoice-list">${filtered.map(invoiceCard).join('')}</div>` : empty(term ? 'Nenhuma fatura encontrada' : 'O seu histórico está vazio', term ? 'Experimente pesquisar por outro nome ou número.' : 'As suas faturas vão aparecer aqui assim que começar.', !term)}`;
}

function settingsPage() {
  return `<div class="page-heading"><div><div class="eyebrow"><span></span> PREFERÊNCIAS</div><h1>Definições</h1><p>Um espaço simples, à sua medida.</p></div></div>
    <section class="settings-card"><div class="settings-heading"><span class="stat-icon mint">${icon('database', 20)}</span><div><h2>Os seus dados</h2><p>Privacidade e armazenamento</p></div></div><div class="setting-row"><div><strong>Guardados neste dispositivo</strong><p>As faturas e alterações ficam no navegador. Limpar os dados do navegador pode apagá-las; faça uma cópia de segurança regularmente.</p></div></div><div class="setting-row"><div><strong>Cópia de segurança</strong><p>Exporte as suas verificações para um ficheiro JSON ou restaure uma cópia. O PDF original não é guardado.</p></div><div class="setting-actions"><button class="button button-outline" data-action="export">${icon('download', 16)} Exportar</button><button class="button button-outline" data-action="restore">${icon('upload', 16)} Restaurar</button></div></div><div class="setting-row"><div><strong>Apagar todas as faturas</strong><p>Esta ação é permanente. Exporte uma cópia antes de continuar.</p></div><button class="button button-danger" data-action="clear">Apagar dados</button></div></section>
    <section class="settings-card"><div class="settings-heading"><span class="stat-icon peach">${icon('smartphone', 20)}</span><div><h2>Instalar aplicação</h2><p>Tenha o Conferir sempre à mão</p></div></div><div class="setting-row"><div><strong>Use como aplicação</strong><p>Depois da primeira visita, pode utilizar a aplicação sem internet. Para instalar, utilize o menu do seu navegador${deferredInstall ? ' ou o botão ao lado' : ''}.</p></div>${deferredInstall ? '<button class="button button-outline" data-action="install">Instalar</button>' : ''}</div></section>`;
}

function articleCard(article, index, readonly) {
  const complete = checked(article);
  const mismatch = difference(article);
  const reconciled = isArticleReconciled(article);
  const verification = getVerification(article);
  const verificationStateLabels = { 'not-started': 'Não iniciada', 'in-progress': 'A verificar', done: 'Verificada' };
  const verificationControls = VERIFICATION_STATES.map((state) => `<button class="verification-step ${verification.state === state ? `selected ${state}` : ''}" data-action="set-verification" data-state="${state}" aria-pressed="${verification.state === state}" ${readonly ? 'disabled' : ''}>${verificationStateLabels[state]}</button>`).join('');
  const verificationLog = verification.startedAt
    ? `<div class="verification-log"><strong>Registo de verificação</strong><span>Início: ${esc(dateTime(verification.startedAt))}</span>${verification.completedAt ? `<span>Concluída: ${esc(dateTime(verification.completedAt))}</span>` : ''}<span class="verification-elapsed" data-started-at="${esc(verification.startedAt)}" ${verification.completedAt ? `data-completed-at="${esc(verification.completedAt)}"` : ''}>Tempo: ${esc(formatElapsed(verification.startedAt, verification.completedAt))}</span></div>`
    : '';
  const differenceBadge = (actual, expected, label) => {
    const result = describeDifference(actual, expected);
    if (!result) return `<strong class="difference-value unavailable" aria-label="Diferença ${label} indisponível" title="Diferença ${label} indisponível">—</strong>`;
    return `<strong class="difference-value ${result.kind}" aria-label="Diferença ${label}: ${esc(result.text)}, ${result.description}" title="Diferença ${label}: ${esc(result.text)}">${esc(result.text)}</strong>`;
  };
  const input = (field, label, placeholder = '—', badge = '') => `<label><span class="field-label">${label}${badge}</span><input type="number" min="0" step="any" inputmode="decimal" data-field="${field}" value="${esc(article[field])}" placeholder="${placeholder}" ${readonly ? 'disabled' : ''}></label>`;
  return `<article class="article-card ${readonly ? 'is-completed' : ''}" data-article="${esc(article.id)}"><div class="article-top"><div class="article-heading"><span class="article-number">${String(index + 1).padStart(2, '0')}</span><div><input class="reference-input" data-field="reference" value="${esc(article.reference)}" placeholder="Introduza a referência" aria-label="Referência do artigo" ${readonly ? 'disabled' : ''}></div></div><div class="article-actions">${readonly ? `<label class="reconcile-check"><input type="checkbox" data-action="toggle-reconciled" ${reconciled ? 'checked' : ''}><span>Check</span></label>` : ''}<span class="article-status ${mismatch ? 'mismatch' : complete ? 'verified' : ''}">${mismatch ? 'Com diferenças' : complete ? 'Conferido' : 'Por conferir'}</span><button class="icon-button ${article.note ? 'has-note' : ''}" data-action="note" title="Adicionar ou editar nota" aria-label="Adicionar ou editar nota">${icon('message-square-text', 18)}</button>${!readonly ? `<button class="icon-button remove" data-action="remove-article" title="Remover artigo" aria-label="Remover artigo">${icon('trash-2', 17)}</button>` : ''}</div></div>
    <div class="verification-control" role="group" aria-label="Estado da verificação desta referência">${verificationControls}</div>
    <div class="article-fields"><div class="field-group"><div class="field-group-title">${icon('package', 15)} QUANTIDADES</div><div class="field-pair">${input('invoiced', 'Faturada', '0')}${input('received', 'Recebida', 'Introduzir', readonly ? differenceBadge(article.received, article.invoiced, 'recebida − faturada') : '')}</div></div><div class="field-divider"></div><div class="field-group"><div class="field-group-title">${icon('layers-3', 15)} STOCK</div><div class="field-pair">${input('systemStock', 'No sistema', 'Introduzir')}${input('shelfStock', 'Na prateleira', 'Introduzir', readonly ? differenceBadge(article.shelfStock, article.systemStock, 'prateleira − sistema') : '')}</div></div></div>
    <div class="note-area ${article.note || verification.startedAt ? '' : 'hidden'}"><label>NOTA / DESCRIÇÃO<textarea data-field="note" placeholder="Adicione uma nota sobre este artigo..." ${readonly ? 'disabled' : ''}>${esc(article.note)}</textarea></label>${verificationLog}</div></article>`;
}

function detailPage(invoice) {
  const total = invoice.articles.length;
  const done = progress(invoice);
  const differences = invoice.articles.filter(difference).length;
  const percent = total ? Math.round(done / total * 100) : 0;
  const readonly = invoice.status === 'done';
  const filteredArticles = filterArticles(invoice.articles, {
    query: articleSearch,
    verificationState: readonly ? '' : articleFilter,
    reconciliation: readonly ? articleFilter : ''
  });
  const articleFilterOptions = readonly
    ? `<option value="" ${articleFilter === '' ? 'selected' : ''}>Sem filtro</option><option value="reconciled" ${articleFilter === 'reconciled' ? 'selected' : ''}>Acertadas / check</option><option value="unreconciled" ${articleFilter === 'unreconciled' ? 'selected' : ''}>Não acertadas / não check</option>`
    : `<option value="" ${articleFilter === '' ? 'selected' : ''}>Sem filtro</option><option value="not-started" ${articleFilter === 'not-started' ? 'selected' : ''}>Não iniciada</option><option value="in-progress" ${articleFilter === 'in-progress' ? 'selected' : ''}>A verificar</option><option value="done" ${articleFilter === 'done' ? 'selected' : ''}>Verificada</option>`;
  return `<button class="back-link" data-action="back">${icon('arrow-left', 16)} Voltar</button><div class="detail-heading"><div><div class="eyebrow"><span></span> ${readonly ? 'CONFERÊNCIA CONCLUÍDA' : 'CONFERÊNCIA EM CURSO'}</div><h1>${esc(invoice.supplier || 'Nova fatura')}</h1><p>Fatura ${esc(invoice.number || 'sem número')} <span>·</span> ${date(invoice.createdAt)} <span>·</span> ${esc(invoice.fileName || 'Adicionada manualmente')}</p></div><div class="detail-buttons">${readonly ? '<button class="button button-outline" data-action="download-pdf">' + icon('download', 16) + ' Descarregar PDF</button><button class="button button-outline" data-action="reopen">' + icon('rotate-ccw', 16) + ' Reabrir</button>' : '<button class="button button-dark" data-action="finish">' + icon('check', 18) + ' Concluir verificação</button>'}<button class="icon-button delete-invoice" data-action="delete" title="Eliminar fatura" aria-label="Eliminar fatura">${icon('trash-2', 18)}</button></div></div>
    <div class="invoice-meta"><label>Fornecedor<input data-invoice-field="supplier" value="${esc(invoice.supplier)}" placeholder="Nome do fornecedor" ${readonly ? 'disabled' : ''}></label><label>Número da fatura<input data-invoice-field="number" value="${esc(invoice.number)}" placeholder="Número da fatura" ${readonly ? 'disabled' : ''}></label></div>
    <div class="detail-summary"><div><span>PROGRESSO DA VERIFICAÇÃO</span><strong class="summary-count">${done} <small>de ${total} artigos conferidos</small></strong></div><div class="summary-progress"><div class="progress-track"><div style="width:${percent}%"></div></div><span>${percent}%</span></div><div class="summary-difference"><span class="diff-icon">${icon('scan-line', 18)}</span><div><strong>${differences}</strong><small>com diferenças</small></div></div></div>
    <div class="section-label article-list-heading"><div><div class="eyebrow">HORA DE CONFERIR</div><h2>Artigos da fatura <span class="count">${total}</span></h2><p>Confirme as quantidades e o stock de cada artigo.</p></div>${readonly ? '' : '<button class="button button-outline" data-action="add-article">' + icon('plus', 17) + ' Adicionar artigo</button>'}</div>
    <div class="article-toolbar"><label class="search">${icon('search', 18)}<input id="article-search" type="search" placeholder="Pesquisar referências..." value="${esc(articleSearch)}" aria-label="Pesquisar referências"></label><label class="article-filter">${icon('settings-2', 16)}<span class="visually-hidden">Filtrar referências</span><select id="article-filter" aria-label="Filtrar referências">${articleFilterOptions}</select></label></div>
    ${invoice.importWarning ? `<div class="notice">${icon('info', 18)} <span>${esc(invoice.importWarning)}</span></div>` : ''}
    <div class="articles">${filteredArticles.length ? filteredArticles.map((article) => articleCard(article, invoice.articles.indexOf(article), readonly)).join('') : empty(total ? 'Nenhuma referência encontrada' : 'Ainda não há artigos', total ? 'Ajuste a pesquisa ou o filtro para ver referências.' : 'Adicione os artigos manualmente para começar.')}</div>
    ${!readonly && total ? '<div class="detail-bottom"><span>As alterações são guardadas neste dispositivo.</span><button class="button button-dark" data-action="finish">' + icon('check', 18) + ' Concluir verificação</button></div>' : ''}`;
}

function render() {
  const invoice = invoices.find((item) => item.id === currentId);
  if (currentId && !invoice) currentId = null;
  app.innerHTML = layout(invoice ? detailPage(invoice) : currentPage === 'historico' ? historyPage() : currentPage === 'definicoes' ? settingsPage() : dashboard());
  createIcons({ icons });
}

async function importPdf(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Selecione um ficheiro PDF.');
    return;
  }
  const button = document.querySelector('[data-action="import"]');
  if (button) button.disabled = true;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pages = [];
    for (let page = 1; page <= pdf.numPages; page++) {
      pages.push((await (await pdf.getPage(page)).getTextContent()).items);
    }
    const parsed = parseInvoicePages(pages);
    const invoice = {
      id: crypto.randomUUID(), fileName: file.name, number: parsed.number, supplier: parsed.supplier,
      createdAt: new Date().toISOString(), status: 'ongoing',
      articles: parsed.articles.map((article) => newArticle(article)),
      importWarning: parsed.articles.length
        ? 'Confirme as referências e quantidades importadas com o PDF antes de concluir.'
        : 'Não foi possível identificar artigos neste PDF. Se for digitalizado ou tiver outro formato, adicione-os manualmente.'
    };
    invoices.unshift(invoice);
    if (!save()) { invoices.shift(); return; }
    currentId = invoice.id;
    render();
  } catch (error) {
    console.error(error);
    alert('Não foi possível ler o PDF. Verifique se o ficheiro é válido e não está protegido por palavra-passe.');
  } finally {
    if (button) button.disabled = false;
    fileInput.value = '';
  }
}

fileInput.addEventListener('change', () => importPdf(fileInput.files[0]));

app.addEventListener('change', (event) => {
  const input = event.target;
  if (input.id === 'article-filter') {
    articleFilter = input.value;
    render();
    return;
  }
  if (input.dataset.action === 'toggle-reconciled') {
    const invoice = invoices.find((item) => item.id === currentId);
    const article = invoice?.articles.find((item) => item.id === input.closest('[data-article]').dataset.article);
    if (!invoice || invoice.status !== 'done' || !article) return;
    const hadSavedValue = typeof article.reconciled === 'boolean';
    const previous = article.reconciled;
    article.reconciled = !isArticleReconciled({ ...article, reconciled: previous });
    if (!save()) {
      if (hadSavedValue) article.reconciled = previous;
      else delete article.reconciled;
      input.checked = isArticleReconciled(article);
      return;
    }
    render();
    return;
  }
  const card = input.closest('[data-article]');
  const invoice = invoices.find((item) => item.id === currentId);
  if (invoice && invoice.status !== 'done' && ['supplier', 'number'].includes(input.dataset.invoiceField)) {
    const field = input.dataset.invoiceField;
    const old = invoice[field];
    invoice[field] = input.value;
    if (!save()) invoice[field] = old;
    render();
    return;
  }
  if (!card || !invoice || invoice.status === 'done' || !input.dataset.field) return;
  const article = invoice.articles.find((item) => item.id === card.dataset.article);
  if (!article) return;
  if (input.type === 'number' && input.value !== '' && (!input.validity.valid || Number(input.value) < 0)) {
    alert('Introduza uma quantidade válida, igual ou superior a zero.');
    input.value = article[input.dataset.field];
    return;
  }
  const old = article[input.dataset.field];
  article[input.dataset.field] = input.value;
  if (!save()) {
    article[input.dataset.field] = old;
    input.value = old;
    return;
  }
  const status = card.querySelector('.article-status');
  const complete = checked(article);
  const mismatch = difference(article);
  status.className = `article-status ${mismatch ? 'mismatch' : complete ? 'verified' : ''}`;
  status.textContent = mismatch ? 'Com diferenças' : complete ? 'Conferido' : 'Por conferir';
  card.querySelector('[data-action="note"]').classList.toggle('has-note', Boolean(article.note));
  const done = progress(invoice);
  const total = invoice.articles.length;
  const percent = total ? Math.round(done / total * 100) : 0;
  document.querySelector('.summary-count').innerHTML = `${done} <small>de ${total} artigos conferidos</small>`;
  document.querySelector('.summary-progress .progress-track > div').style.width = `${percent}%`;
  document.querySelector('.summary-progress > span').textContent = `${percent}%`;
  document.querySelector('.summary-difference strong').textContent = invoice.articles.filter(difference).length;
});

app.addEventListener('input', (event) => {
  if (!['search', 'article-search'].includes(event.target.id)) return;
  if (event.target.id === 'search') search = event.target.value;
  else articleSearch = event.target.value;
  const position = event.target.selectionStart;
  render();
  const field = document.getElementById(event.target.id);
  field.focus();
  field.setSelectionRange(position, position);
});

app.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action], [data-page]');
  if (!target) return;
  if (target.dataset.page) {
    currentPage = target.dataset.page;
    currentId = null;
    search = '';
    render();
    return;
  }
  const action = target.dataset.action;
  const invoice = invoices.find((item) => item.id === currentId);
  if (action === 'download-pdf' && invoice) {
    try {
      const { downloadInvoicePdf } = await import('./invoice-pdf.js');
      downloadInvoicePdf(invoice);
    } catch (error) {
      console.error('Não foi possível gerar o PDF da fatura:', error);
      alert(error.message || 'Não foi possível gerar o PDF desta fatura.');
    }
  }
  if (action === 'home') { event.preventDefault(); currentPage = 'inicio'; currentId = null; render(); }
  if (action === 'import') fileInput.click();
  if (action === 'open') { currentId = target.dataset.id; articleSearch = ''; articleFilter = ''; render(); window.scrollTo(0, 0); }
  if (action === 'back') { currentId = null; articleSearch = ''; articleFilter = ''; render(); window.scrollTo(0, 0); }
  if (action === 'note') {
    const area = target.closest('.article-card').querySelector('.note-area');
    area.classList.toggle('hidden');
    if (!area.classList.contains('hidden')) area.querySelector('textarea').focus();
  }
  if (action === 'set-verification' && invoice && invoice.status !== 'done') {
    const article = invoice.articles.find((item) => item.id === target.closest('[data-article]').dataset.article);
    if (!article) return;
    const previous = getVerification(article);
    const next = target.dataset.state;
    if (previous.state === next) return;
    if (next === 'not-started' && previous.startedAt && !confirm('Repor a verificação? As horas de início e de conclusão deste artigo serão apagadas.')) return;
    article.verification = setVerificationState(article, next);
    if (!save()) article.verification = previous;
    render();
  }
  if (action === 'add-article' && invoice) { invoice.articles.push(newArticle()); if (!save()) invoice.articles.pop(); render(); }
  if (action === 'remove-article' && invoice && confirm('Remover este artigo da fatura?')) {
    const index = invoice.articles.findIndex((item) => item.id === target.closest('[data-article]').dataset.article);
    const removed = invoice.articles.splice(index, 1);
    if (!save()) invoice.articles.splice(index, 0, ...removed);
    render();
  }
  if (action === 'finish' && invoice) {
    if (!invoice.articles.length || progress(invoice) !== invoice.articles.length) {
      alert('Preencha a referência e todas as quantidades de cada artigo antes de concluir.');
      return;
    }
    const count = invoice.articles.filter(difference).length;
    if (count && !confirm(`Existem ${count} artigo(s) com diferenças. Deseja concluir mesmo assim?`)) return;
    const previousChecks = invoice.articles.map((article) => article.reconciled);
    const previousFilter = articleFilter;
    invoice.status = 'done';
    articleFilter = '';
    invoice.articles.forEach((article) => { article.reconciled = !difference(article); });
    if (!save()) {
      invoice.status = 'ongoing';
      articleFilter = previousFilter;
      invoice.articles.forEach((article, index) => {
        if (typeof previousChecks[index] === 'boolean') article.reconciled = previousChecks[index];
        else delete article.reconciled;
      });
    }
    render();
  }
  if (action === 'reopen' && invoice) {
    invoice.status = 'ongoing';
    const previousFilter = articleFilter;
    articleFilter = '';
    if (!save()) {
      invoice.status = 'done';
      articleFilter = previousFilter;
    }
    render();
  }
  if (action === 'delete' && invoice && confirm('Eliminar esta fatura e todos os seus dados?')) {
    const index = invoices.indexOf(invoice);
    invoices.splice(index, 1);
    if (!save()) invoices.splice(index, 0, invoice); else currentId = null;
    render();
  }
  if (action === 'clear' && confirm('Apagar todas as faturas guardadas neste dispositivo? Esta ação não pode ser desfeita.')) {
    const previous = invoices;
    invoices = [];
    if (!save()) invoices = previous;
    render();
  }
  if (action === 'export') {
    const blob = new Blob([JSON.stringify({ version: 1, invoices }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'conferir-copia-seguranca.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (action === 'restore') {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      if (!input.files[0]) return;
      try {
        const data = JSON.parse(await input.files[0].text());
        const valid = data.version === 1 && Array.isArray(data.invoices) && data.invoices.every((item) =>
          typeof item.id === 'string' && typeof item.createdAt === 'string' && !Number.isNaN(Date.parse(item.createdAt)) &&
          ['ongoing', 'done'].includes(item.status) && typeof item.number === 'string' && typeof item.supplier === 'string' &&
          typeof item.fileName === 'string' && Array.isArray(item.articles) && item.articles.every((article) =>
            typeof article.id === 'string' && typeof article.reference === 'string' && typeof article.description === 'string' &&
            typeof article.note === 'string' && (article.reconciled === undefined || typeof article.reconciled === 'boolean') && ['invoiced', 'received', 'systemStock', 'shelfStock'].every((key) => article[key] === '' || hasNumber(article[key])) &&
            (!article.verification || (
              VERIFICATION_STATES.includes(article.verification.state) &&
              (article.verification.startedAt === null || (typeof article.verification.startedAt === 'string' && !Number.isNaN(Date.parse(article.verification.startedAt)))) &&
              (article.verification.completedAt === null || (typeof article.verification.completedAt === 'string' && !Number.isNaN(Date.parse(article.verification.completedAt))))
            ))));
        if (!valid) throw new Error('Formato inválido');
        if (!confirm('Restaurar esta cópia? Todas as faturas atuais serão substituídas.')) return;
        const previous = invoices;
        invoices = data.invoices;
        if (!save()) invoices = previous;
        render();
        setInterval(() => {
          for (const timer of document.querySelectorAll('.verification-elapsed:not([data-completed-at])')) {
            timer.textContent = `Tempo: ${formatElapsed(timer.dataset.startedAt)}`;
          }
        }, 30_000);
      } catch (error) {
        console.error(error);
        alert('Não foi possível restaurar a cópia. Verifique se o ficheiro foi exportado pelo Conferir.');
      }
    });
    input.click();
  }
  if (action === 'install' && deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; render(); }
});

window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstall = event; if (currentPage === 'definicoes' && !currentId) render(); });
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => console.error('Não foi possível ativar o funcionamento offline:', error));
}
render();
