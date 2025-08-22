// Versão do SW - altere quando quiser forçar atualização no mobile
const SW_VERSION = 'v4-2025-08-20';

self.addEventListener('install', (event) => {
  console.log('Service Worker instalado', SW_VERSION);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker ativado', SW_VERSION);
  clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass-through (sem cache offline por enquanto)
});
