/* SchoolKart rooms — in-memory WebSocket. No DB.
   Railway: npm start  |  PORT from env  */
"use strict";

var fs = require("fs");
var http = require("http");
var path = require("path");
var { WebSocketServer } = require("ws");

var ROOT = path.resolve(__dirname, "..");
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function safePublicFile(urlPath) {
  var raw = String(urlPath || "/").split("?")[0].split("#")[0];
  try {
    raw = decodeURIComponent(raw);
  } catch (e) {
    return null;
  }
  if (raw === "/" || raw === "") raw = "/index.html";
  if (!/^\/(index\.html|js\/[A-Za-z0-9._-]+\.js|css\/[A-Za-z0-9._-]+\.css)$/.test(raw)) {
    return null;
  }
  var abs = path.resolve(ROOT, raw.slice(1));
  if (abs !== ROOT && abs.indexOf(ROOT + path.sep) !== 0) return null;
  return abs;
}

var PORT = Number(process.env.PORT || 8787);
var MAX = 8;
var GHOST_MS = 120000;
var ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
var HIT = 2.55;

var rooms = new Map();

function code5() {
  var s = "";
  for (var i = 0; i < 5; i++) s += ALPHA[(Math.random() * ALPHA.length) | 0];
  return s;
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function roster(room) {
  return room.players.map(function (p) {
    return {
      id: p.id,
      name: p.name,
      slot: p.slot,
      connected: p.connected,
      ghost: p.ghost,
    };
  });
}

function broadcast(room, obj, exceptId) {
  var raw = JSON.stringify(obj);
  room.players.forEach(function (p) {
    if (exceptId && p.id === exceptId) return;
    if (p.ws && p.ws.readyState === 1) p.ws.send(raw);
  });
}

function roomMsg(room) {
  return {
    t: "room",
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    startPhase: room.startPhase,
    redsOn: room.redsOn,
    holdDelay: room.holdDelay,
    raceTime: room.raceTime || 0,
    players: roster(room),
  };
}

function findRoom(code) {
  return rooms.get(String(code || "").toUpperCase());
}

function playerById(room, id) {
  for (var i = 0; i < room.players.length; i++) {
    if (room.players[i].id === id) return room.players[i];
  }
  return null;
}

function nextSlot(room) {
  var used = {};
  room.players.forEach(function (p) {
    used[p.slot] = true;
  });
  for (var s = 0; s < MAX; s++) if (!used[s]) return s;
  return -1;
}

function promoteHost(room) {
  var live = room.players.filter(function (p) {
    return p.connected;
  });
  room.hostId = live.length ? live[0].id : room.players[0] ? room.players[0].id : null;
}

function pruneGhosts(room) {
  var now = Date.now();
  room.players = room.players.filter(function (p) {
    if (p.connected) return true;
    return now - p.leftAt < GHOST_MS;
  });
  if (!room.players.length) rooms.delete(room.code);
  else promoteHost(room);
}

function unstack(cars) {
  var i, j;
  for (i = 0; i < cars.length; i++) {
    for (j = i + 1; j < cars.length; j++) {
      var a = cars[i];
      var b = cars[j];
      var dx = b.x - a.x;
      var dz = b.z - a.z;
      var d = Math.hypot(dx, dz);
      if (d < 0.0001) {
        dx = 1;
        d = 1;
      }
      if (d >= HIT) continue;
      var nx = dx / d;
      var nz = dz / d;
      var push = (HIT - d) * 0.5;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
    }
  }
}

function makeRoom() {
  var code = code5();
  while (rooms.has(code)) code = code5();
  var room = {
    code: code,
    hostId: null,
    phase: "lobby",
    startPhase: "prestart",
    redsOn: 0,
    startT: 0,
    holdDelay: 1,
    players: [],
    raceTime: 0,
  };
  rooms.set(code, room);
  return room;
}

function slotPose(slot) {
  return { x: -6 - slot * 8, z: -80 + (slot % 2 ? -2.7 : 2.7) };
}

function blankCar(id, name, slot, ws) {
  var g = slotPose(slot);
  return {
    id: id,
    name: name,
    slot: slot,
    ws: ws,
    connected: true,
    ghost: false,
    leftAt: 0,
    x: g.x,
    z: g.z,
    h: 0,
    spd: 0,
    slide: 0,
    lap: 1,
    fuel: 100,
    tires: 100,
    pit: 0,
    finished: 0,
  };
}

function youState(p) {
  return {
    slot: p.slot,
    x: p.x,
    z: p.z,
    h: p.h,
    spd: p.spd,
    slide: p.slide,
    lap: p.lap,
    fuel: p.fuel,
    tires: p.tires,
    pit: p.pit,
    finished: p.finished,
  };
}

function carList(room) {
  return room.players.map(function (p) {
    return {
      id: p.id,
      slot: p.slot,
      x: p.x,
      z: p.z,
      h: p.h,
      spd: p.spd,
      slide: p.slide,
      lap: p.lap,
      fuel: p.fuel,
      tires: p.tires,
      pit: p.pit,
      finished: p.finished,
      ghost: p.ghost,
      connected: p.connected,
    };
  });
}

function sendEnter(ws, room, p, flags) {
  flags = flags || {};
  send(ws, {
    t: "enter",
    phase: room.phase,
    startPhase: room.startPhase,
    redsOn: room.redsOn,
    holdDelay: room.holdDelay,
    raceTime: room.raceTime || 0,
    you: youState(p),
    cars: carList(room),
    late: !!flags.late,
    rejoin: !!flags.rejoin,
  });
  if (room.phase === "start") {
    send(ws, {
      t: "lights",
      phase: room.startPhase,
      redsOn: room.redsOn,
      holdDelay: room.holdDelay,
    });
  }
}

function startLights(room) {
  room.phase = "start";
  room.startPhase = "prestart";
  room.redsOn = 0;
  room.startT = 2;
  room.raceTime = 0;
  room.holdDelay = 0.2 + Math.random() * 2.8;
  broadcast(room, roomMsg(room));
  broadcast(room, {
    t: "lights",
    phase: room.startPhase,
    redsOn: room.redsOn,
    holdDelay: room.holdDelay,
  });
}

function tickLights(room, dt) {
  if (room.phase !== "start") return;
  room.startT -= dt;
  if (room.startPhase === "prestart") {
    if (room.startT <= 0) {
      room.startPhase = "reds";
      room.startT = 1;
      room.redsOn = 1;
    }
  } else if (room.startPhase === "reds") {
    if (room.startT <= 0) {
      room.redsOn += 1;
      if (room.redsOn >= 5) {
        room.redsOn = 5;
        room.startPhase = "hold";
        room.startT = room.holdDelay;
      } else {
        room.startT = 1;
      }
    }
  } else if (room.startPhase === "hold") {
    if (room.startT <= 0) {
      room.phase = "racing";
      room.startPhase = "go";
      room.redsOn = 0;
      broadcast(room, { t: "go" });
    }
  }
  if (room.phase === "start") {
    broadcast(room, {
      t: "lights",
      phase: room.startPhase,
      redsOn: room.redsOn,
      holdDelay: room.holdDelay,
    });
  } else if (room.phase === "racing") {
    broadcast(room, roomMsg(room));
  }
}

var httpServer = http.createServer(function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  var url = String((req && req.url) || "/");
  var pathname = url.split("?")[0];
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  var file = safePublicFile(url);
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  fs.readFile(file, function (err, buf) {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    var ext = path.extname(file);
    var headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
    if (ext === ".html") {
      headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
    } else {
      headers["Cache-Control"] = "no-cache";
    }
    res.writeHead(200, headers);
    res.end(buf);
  });
});

var wss = new WebSocketServer({ server: httpServer });

wss.on("connection", function (ws) {
  var self = { id: null, room: null, ws: ws };

  ws.on("message", function (buf) {
    var msg;
    try {
      msg = JSON.parse(String(buf));
    } catch (e) {
      return;
    }
    if (!msg || !msg.t) return;

    if (msg.t === "hello") {
      self.id = String(msg.id || "").slice(0, 40);
      if (!self.id) self.id = "p" + Math.random().toString(36).slice(2, 10);
      send(ws, { t: "welcome", id: self.id });
      return;
    }

    if (msg.t === "ping") {
      send(ws, { t: "pong", n: msg.n, now: Date.now() });
      return;
    }

    if (!self.id) return;

    if (msg.t === "create") {
      var created = makeRoom();
      var slot = 0;
      created.hostId = self.id;
      created.players.push(
        blankCar(self.id, String(msg.name || "House 7").slice(0, 18), slot, ws)
      );
      self.room = created;
      send(ws, roomMsg(created));
      sendEnter(ws, created, created.players[0]);
      return;
    }

    if (msg.t === "join") {
      var room = findRoom(msg.code);
      if (!room) {
        send(ws, { t: "err", msg: "No room with that code" });
        return;
      }
      pruneGhosts(room);
      var existing = playerById(room, self.id);
      if (existing) {
        existing.ws = ws;
        existing.connected = true;
        existing.ghost = false;
        existing.leftAt = 0;
        if (msg.name) existing.name = String(msg.name).slice(0, 18);
        self.room = room;
        broadcast(room, roomMsg(room));
        sendEnter(ws, room, existing, { rejoin: true });
        return;
      }
      if (room.players.filter(function (p) { return p.connected || p.ghost; }).length >= MAX) {
        send(ws, { t: "err", msg: "Room is full (8)" });
        return;
      }
      var ns = nextSlot(room);
      if (ns < 0) {
        send(ws, { t: "err", msg: "Room is full (8)" });
        return;
      }
      var newbie = blankCar(self.id, String(msg.name || "Car").slice(0, 18), ns, ws);
      room.players.push(newbie);
      self.room = room;
      broadcast(room, roomMsg(room));
      sendEnter(ws, room, newbie, { late: room.phase === "racing" });
      return;
    }

    var room = self.room;
    if (!room) return;

    if (msg.t === "start") {
      if (self.id !== room.hostId) {
        send(ws, { t: "err", msg: "Only the host can grid up" });
        return;
      }
      if (room.phase !== "lobby" && room.phase !== "finish") {
        send(ws, { t: "err", msg: "Race already rolling" });
        return;
      }
      startLights(room);
      return;
    }

    if (msg.t === "state" && (room.phase === "start" || room.phase === "racing")) {
      var p = playerById(room, self.id);
      if (!p) return;
      p.x = +msg.x || 0;
      p.z = +msg.z || 0;
      p.h = +msg.h || 0;
      p.spd = +msg.spd || 0;
      p.slide = +msg.slide || 0;
      p.lap = +msg.lap || 1;
      if (msg.fuel != null && isFinite(+msg.fuel)) p.fuel = +msg.fuel;
      if (msg.tires != null && isFinite(+msg.tires)) p.tires = +msg.tires;
      p.pit = msg.pit ? 1 : 0;
      p.finished = msg.finished ? 1 : 0;
      return;
    }
  });

  ws.on("close", function () {
    var room = self.room;
    if (!room || !self.id) return;
    var p = playerById(room, self.id);
    if (!p) return;
    p.connected = false;
    p.ghost = true;
    p.leftAt = Date.now();
    p.ws = null;
    promoteHost(room);
    broadcast(room, roomMsg(room));
  });
});

var lastTick = Date.now();
setInterval(function () {
  var now = Date.now();
  var dt = Math.min(0.05, (now - lastTick) / 1000);
  lastTick = now;
  rooms.forEach(function (room) {
    pruneGhosts(room);
    tickLights(room, dt);
    if (room.phase === "racing") room.raceTime += dt;
    if (room.phase === "start" || room.phase === "racing") {
      var cars = carList(room);
      unstack(cars);
      for (var i = 0; i < cars.length; i++) {
        var src = playerById(room, cars[i].id);
        if (src && src.ghost) {
          src.x = cars[i].x;
          src.z = cars[i].z;
        }
      }
      broadcast(room, { t: "snap", now: now, raceTime: room.raceTime || 0, cars: cars });
    }
  });
}, 80);

httpServer.listen(PORT, function () {
  console.log("SchoolKart game + rooms on :" + PORT);
});
