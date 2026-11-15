/* Service worker GetErapor: agar aplikasi bisa dibuka offline.
   Naikkan nomor V setiap kali index.html diperbarui agar cache lama dibuang. */
const V = 'geterapor-v4';
const SHELL = ['./', 'manifest.json', 'icon-192.png', 'icon-512.png'];
const LIBS = [
  'https://cdn.jsdelivr.net/npm/sweetalert2@11.10.5/dist/sweetalert2.all.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await Promise.all([
      ...SHELL.map(u => c.add(u).catch(() => {})),
      // pustaka lintas-domain disimpan apa adanya (no-cors), cukup untuk <script src>
      ...LIBS.map(u => fetch(new Request(u, { mode: 'no-cors' })).then(r => c.put(u, r)).catch(() => {}))
    ]);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // data nilai (Google Apps Script) tidak pernah di-cache
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;

  // halaman aplikasi: ambil versi terbaru bila online, jika offline pakai salinan tersimpan
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r.ok && !r.redirected) { const c = await caches.open(V); c.put('./', r.clone()); }
        return r;
      } catch (err) {
        return (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // pustaka CDN: cache dulu
  if (LIBS.includes(req.url)) {
    e.respondWith((async () => {
      const hit = await caches.match(req.url);
      if (hit) return hit;
      const r = await fetch(req);
      const c = await caches.open(V); c.put(req.url, r.clone());
      return r;
    })());
    return;
  }

  // berkas lain satu domain (ikon, manifest): cache dulu, perbarui di belakang layar
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      const net = fetch(req).then(async r => { if (r.ok) { const c = await caches.open(V); c.put(req, r.clone()); } return r; }).catch(() => hit);
      return hit || net;
    })());
  }
});
