/* SchoolKart server pointer.
   Edit this after Railway deploy, or pass ?server=wss://your-app.up.railway.app
   Leave empty to play solo (offline fallback). */
window.SCHOOLKART_SERVER = window.SCHOOLKART_SERVER || "";
(function () {
  try {
    var q = new URLSearchParams(window.location.search).get("server");
    if (q) window.SCHOOLKART_SERVER = q;
  } catch (e) {}
})();
