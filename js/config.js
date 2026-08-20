/* SchoolKart server pointer.
   Railway / npm start: same-origin WSS (one URL, no ?server=).
   GitHub Pages: fall back to the live Railway host.
   ?server= still overrides. Solo still works if the socket is down. */
(function () {
  var railway = "wss://zachf1.up.railway.app";
  function sameOrigin() {
    try {
      var proto = location.protocol === "https:" ? "wss://" : "ws://";
      return proto + location.host;
    } catch (e) {
      return railway;
    }
  }
  function defaultServer() {
    try {
      if (!location.hostname || location.protocol === "file:") return railway;
      if (/\.github\.io$/i.test(location.hostname)) return railway;
      return sameOrigin();
    } catch (e) {
      return railway;
    }
  }
  window.SCHOOLKART_SERVER = window.SCHOOLKART_SERVER || defaultServer();
  try {
    var q = new URLSearchParams(window.location.search).get("server");
    if (q) window.SCHOOLKART_SERVER = q;
  } catch (e) {}
})();
