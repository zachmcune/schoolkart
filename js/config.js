/* SchoolKart server pointer.
   Default is the live Railway room server. ?server= still overrides.
   If the server is down, the game falls back to solo. */
window.SCHOOLKART_SERVER =
  window.SCHOOLKART_SERVER || "wss://server-production-d6c9.up.railway.app";
(function () {
  try {
    var q = new URLSearchParams(window.location.search).get("server");
    if (q) window.SCHOOLKART_SERVER = q;
  } catch (e) {}
})();
