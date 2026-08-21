/* SchoolKart net client. No-op if SCHOOLKART_SERVER is empty / unreachable. */
(function (global) {
  "use strict";

  function uid() {
    var id = "";
    try {
      id = sessionStorage.getItem("sk_id") || "";
    } catch (e) {}
    if (!id) {
      id = "p" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      try {
        sessionStorage.setItem("sk_id", id);
      } catch (e2) {}
    }
    return id;
  }

  function toWs(url) {
    if (!url) return "";
    url = String(url).trim();
    if (url.indexOf("http://") === 0) return "ws://" + url.slice(7);
    if (url.indexOf("https://") === 0) return "wss://" + url.slice(8);
    return url;
  }

  var net = {
    url: toWs(global.SCHOOLKART_SERVER || ""),
    id: uid(),
    name: "House 7",
    body: 0xf4f1ea,
    wing: 0x148f8c,
    track: "",
    ws: null,
    connected: false,
    active: false,
    room: null,
    hostId: null,
    phase: "lobby",
    startPhase: "prestart",
    redsOn: 0,
    holdDelay: 1,
    players: [],
    snap: [],
    lastSnapAt: 0,
    speed: 1,
    err: "",
    status: "",
    handlers: {},
  };

  net.isHost = function () {
    return net.hostId && net.hostId === net.id;
  };

  net.on = function (ev, fn) {
    net.handlers[ev] = fn;
  };

  function emit(ev, data) {
    if (net.handlers[ev]) net.handlers[ev](data);
  }

  function send(obj) {
    if (net.ws && net.ws.readyState === 1) net.ws.send(JSON.stringify(obj));
  }

  net.sendState = function (s) {
    send({
      t: "state",
      x: s.x,
      z: s.z,
      h: s.h,
      spd: s.spd,
      slide: s.slide,
      lap: s.lap,
      fuel: s.fuel,
      tires: s.tires,
      pit: s.pit,
      finished: s.finished,
    });
  };

  net.start = function () {
    send({ t: "start" });
  };

  net.kick = function (id) {
    send({ t: "kick", id: id });
  };

  net.addBot = function () {
    send({ t: "bot", op: "add" });
  };

  net.addBowie = function () {
    send({ t: "bot", op: "bowie" });
  };

  net.removeBot = function (id) {
    send({ t: "bot", op: "remove", id: id });
  };

  net.setSpeed = function (n) {
    send({ t: "speed", n: n });
  };

  net.sendBots = function (cars) {
    send({ t: "bots", cars: cars });
  };

  net.setTrack = function (code) {
    send({ t: "track", code: String(code || "").slice(0, 240) });
  };

  function applyRoom(msg) {
    net.room = msg.code;
    net.hostId = msg.hostId;
    net.phase = msg.phase;
    net.startPhase = msg.startPhase || net.startPhase;
    net.redsOn = msg.redsOn || 0;
    net.holdDelay = msg.holdDelay || net.holdDelay;
    net.players = msg.players || [];
    net.speed = msg.speed == null ? net.speed : msg.speed;
    if (msg.track != null) net.track = String(msg.track || "");
    try {
      sessionStorage.setItem("sk_room", net.room);
    } catch (e) {}
    emit("room", msg);
  }

  net.connect = function (cb) {
    net.err = "";
    if (!net.url) {
      net.status = "offline";
      if (cb) cb(new Error("no server"));
      return;
    }
    var ws;
    try {
      ws = new WebSocket(net.url);
    } catch (e) {
      net.status = "offline";
      if (cb) cb(e);
      return;
    }
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      try {
        ws.close();
      } catch (e2) {}
      net.status = "offline";
      if (cb) cb(new Error("timeout"));
    }, 2500);
    ws.onopen = function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      net.ws = ws;
      net.connected = true;
      net.status = "online";
      send({
        t: "hello",
        id: net.id,
        name: net.name || "House 7",
        body: net.body,
        wing: net.wing,
      });
      if (cb) cb(null);
    };
    ws.onerror = function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      net.status = "offline";
      if (cb) cb(new Error("ws error"));
    };
    ws.onclose = function () {
      net.connected = false;
      if (net.active) emit("drop");
    };
    ws.onmessage = function (ev) {
      var msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      if (msg.t === "welcome") net.id = msg.id;
      if (msg.t === "room") {
        net.active = true;
        applyRoom(msg);
      }
      if (msg.t === "lights") {
        net.startPhase = msg.phase;
        net.redsOn = msg.redsOn;
        net.holdDelay = msg.holdDelay;
        emit("lights", msg);
      }
      if (msg.t === "go") emit("go");
      if (msg.t === "enter") {
        net.active = true;
        net.phase = msg.phase;
        net.startPhase = msg.startPhase || net.startPhase;
        net.redsOn = msg.redsOn || 0;
        net.holdDelay = msg.holdDelay || net.holdDelay;
        net.snap = msg.cars || [];
        if (msg.speed != null) net.speed = msg.speed;
        emit("enter", msg);
      }
      if (msg.t === "snap") {
        net.snap = msg.cars || [];
        net.lastSnapAt = performance.now();
        emit("snap", msg);
      }
      if (msg.t === "kicked") {
        emit("kicked");
        net.active = false;
        net.room = null;
      }
      if (msg.t === "err") {
        net.err = msg.msg;
        emit("err", msg.msg);
      }
      if (msg.t === "pong") emit("pong", msg);
    };
  };

  net.create = function (name) {
    net.name = name || net.name;
    send({
      t: "create",
      name: net.name,
      body: net.body,
      wing: net.wing,
      track: net.track || "",
    });
  };

  net.join = function (code, name) {
    net.name = name || net.name;
    send({
      t: "join",
      code: String(code || "").toUpperCase(),
      name: net.name,
      body: net.body,
      wing: net.wing,
    });
  };

  net.leave = function () {
    net.active = false;
    net.room = null;
    try {
      sessionStorage.removeItem("sk_room");
    } catch (e) {}
    if (net.ws) {
      try {
        net.ws.close();
      } catch (e) {}
    }
    net.ws = null;
    net.connected = false;
  };

  global.SchoolKartNet = net;
})(window);
