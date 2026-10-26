/* Diario SBD offline – service worker. Cambia VERSION a ogni aggiornamento dell'app. */
const VERSION = 'sbd-v13-1';
const FONTS = 'sbd-fonts';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(CORE.map(u => new Request(u, {cache: 'reload'}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // Font di Google: dalla cache, scaricati una volta sola
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(r);
      if (hit) return hit;
      try { const res = await fetch(r); c.put(r, res.clone()); return res; }
      catch (err) { return Response.error(); }
    }));
    return;
  }
  if (u.origin !== self.location.origin) return;
  // App: subito dalla cache (funziona offline), aggiornamento in background
  e.respondWith(caches.open(VERSION).then(async c => {
    const key = r.mode === 'navigate' ? './index.html' : r;
    const hit = await c.match(key, {ignoreSearch: true});
    const net = fetch(r).then(res => { if (res && res.ok && res.type === 'basic') c.put(key, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    return res || new Response('Offline', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
  }));
});
