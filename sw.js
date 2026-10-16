// Service Worker: App-Dateien offline verfügbar machen, aber immer zuerst die aktuelle Version laden.
// Die Daten selbst laufen über Firebase (Live-Sync, Websocket) und werden hier NICHT zwischengespeichert.
const CACHE = 'ff-christdorf-v2';
const DATEIEN = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
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
  e.respondWith(
    fetch(req)
      .then((res) => {
        const kopie = res.clone();
        caches.open(CACHE).then((c) => c.put(req, kopie));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
  );
});
