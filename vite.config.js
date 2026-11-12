import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.VITE_BASE_PATH
  || (process.env.GITHUB_ACTIONS === 'true' && repositoryName && !repositoryName.endsWith('.github.io')
    ? `/${repositoryName}/`
    : '/');
let basePath = base;

export default defineConfig({
  base,
  plugins: [{
    name: 'offline-worker',
    configResolved(config) {
      basePath = config.base;
    },
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).map((name) => `${basePath}${name}`);
      const files = [basePath, `${basePath}index.html`, `${basePath}manifest.webmanifest`, `${basePath}icon.svg`, `${basePath}icon-maskable.svg`, ...assets];
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const CACHE = 'conferir-${Date.now()}';\nconst FILES = ${JSON.stringify(files)};\nself.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));\nself.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('conferir-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));\nself.addEventListener('fetch', event => { if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return; event.respondWith(caches.match(event.request, { ignoreVary: true }).then(response => response || fetch(event.request))); });`
      });
    }
  }]
});
