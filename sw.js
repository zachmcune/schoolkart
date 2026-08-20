/* SchoolKart SW — installable chrome only. Network-first. Offline not required.
   BUILD must match window.SK_BUILD / ?v= so a new deploy kills the old worker. */
var BUILD = "mp33";

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (k) {
            return caches.delete(k);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  if (req.headers.get("upgrade") === "websocket") return;
  var dest = req.destination;
  var mode = req.mode;
  var want =
    mode === "navigate" ||
    dest === "document" ||
    dest === "script" ||
    dest === "style" ||
    dest === "manifest";
  if (!want) return;
  event.respondWith(
    fetch(req, { cache: "no-store" }).catch(function () {
      return fetch(req);
    })
  );
});
