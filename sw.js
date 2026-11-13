// Service Worker: App-Dateien offline verfügbar machen, aber immer zuerst die aktuelle Version laden.
// Die Daten selbst laufen über Firebase (Live-Sync, Websocket) und werden hier NICHT zwischengespeichert.
const CACHE = 'ff-christdorf-v11';
const DATEIEN = ['./', 'index.html', 'css/style.css?v=20261113b', 'js/kern.js?v=20261113b', 'js/cloud.js?v=20261113b', 'js/kennzahlen.js?v=20261113b', 'js/kalender.js?v=20261113b', 'js/uebersicht.js?v=20261113b', 'js/dienstbuch.js?v=20261113b', 'js/atemschutz.js?v=20261113b', 'js/lehrgaenge.js?v=20261113b', 'js/mannschaft.js?v=20261113b', 'js/bericht.js?v=20261113b', 'js/kraefte.js?v=20261113b', 'js/verwaltung.js?v=20261113b', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  // Alle App-Dateien frisch vom Server holen (nicht aus dem normalen Browser-Zwischenspeicher, der bis zu 10 Minuten alte Dateien behält)
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(DATEIEN.map((u) => fetch(u, { cache: 'reload' }).then((r) => { if (!r.ok) throw new Error(u); return c.put(u, r); }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Nur eigene Dateien und das Firebase-Skript (für Offline-Start) zwischenspeichern; Datenverkehr zu Firebase nie anfassen
  const istFirebaseSdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (url.origin !== self.location.origin && !istFirebaseSdk) return;

  // Network-first: bei Verbindung immer die neueste Version, sonst Zwischenspeicher
  // (Eine Seitenanfrage "navigate" darf nicht mit Zusatzoptionen kopiert werden, deshalb dort neu aus der Adresse bauen)
  const anfrage = req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache' }) : new Request(req, { cache: 'no-cache' });
  e.respondWith(
    fetch(anfrage)
      .then((res) => {
        const kopie = res.clone();
        caches.open(CACHE).then((c) => c.put(req, kopie));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
