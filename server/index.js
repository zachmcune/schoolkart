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
  ".json": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
};

function safePublicFile(urlPath) {
  var raw = String(urlPath || "/").split("?")[0].split("#")[0];
  try {
    raw = decodeURIComponent(raw);
  } catch (e) {
    return null;
  }
  if (raw === "/" || raw === "") raw = "/index.html";
  if (
    !/^\/(index\.html|manifest\.json|sw\.js|apple-touch-icon\.png|icons\/[A-Za-z0-9._-]+\.png|js\/[A-Za-z0-9._-]+\.js|css\/[A-Za-z0-9._-]+\.css)$/.test(
      raw
    )
  ) {
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
var BOT_NAMES = [
  "BowieKnife99",
  "Hall Monitor",
  "Sub Teacher",
  "Library Kid",
  "Band Kid",
  "Lab Partner",
  "Detention",
  "Yearbook",
];

function cleanName(raw) {
  var s = String(raw || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > 14) s = s.slice(0, 14);
  return s || "House 7";
}

function clampSpeed(n) {
  n = +n;
  if (n === 0.75 || n === 1.25) return n;
  return 1;
}

function cleanHex(n, fallback) {
  n = +n;
  if (!isFinite(n) || n < 0 || n > 0xffffff) return fallback;
  return n | 0;
}

function cleanTrack(raw) {
  return String(raw || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 240);
}

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
      bot: !!p.bot,
      body: p.body,
      wing: p.wing,
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
    speed: room.speed || 1,
    track: room.track || "",
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
    return p.connected && !p.bot;
  });
  room.hostId = live.length ? live[0].id : null;
}

function pruneGhosts(room) {
  var now = Date.now();
  room.players = room.players.filter(function (p) {
    if (p.bot) return true;
    if (p.connected) return true;
    return now - p.leftAt < GHOST_MS;
  });
  var liveHuman = room.players.some(function (p) {
    return !p.bot && p.connected;
  });
  var ghostHuman = room.players.some(function (p) {
    return !p.bot && !p.connected && now - p.leftAt < GHOST_MS;
  });
  if (!liveHuman && !ghostHuman) {
    rooms.delete(room.code);
    return;
  }
  if (!liveHuman) {
    room.players = room.players.filter(function (p) {
      return !p.bot;
    });
  }
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
    speed: 1,
    track: "",
  };
  rooms.set(code, room);
  return room;
}

function slotPose(slot) {
  // Same 2-wide campus grid as js/game.js gridSlot. Host slot 0 stays.
  // Mate (Add Bowie / slot 1) shares X, sits further outside.
  var lat = slot % 2 ? -5.2 : -2.4;
  return { x: -6 - Math.floor(slot / 2) * 8, z: -80 + lat, h: 0 };
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
    bot: false,
    body: 0xf4f1ea,
    wing: 0x148f8c,
  };
}

function hasBowie(room) {
  return room.players.some(function (p) {
    return p.bot && p.name === "BowieKnife99";
  });
}

function addBot(room, forcedName) {
  if (room.players.length >= MAX) return null;
  var ns = nextSlot(room);
  if (ns < 0) return null;
  if (forcedName === "BowieKnife99") {
    if (hasBowie(room)) return "exists";
    var hunter = blankCar("bot-" + Math.random().toString(36).slice(2, 10), "BowieKnife99", ns, null);
    hunter.bot = true;
    hunter.connected = true;
    room.players.push(hunter);
    return hunter;
  }
  var nBots = room.players.filter(function (p) {
    return p.bot;
  }).length;
  var name = BOT_NAMES[nBots % BOT_NAMES.length];
  if (name === "BowieKnife99" && hasBowie(room)) {
    name = BOT_NAMES[(nBots + 1) % BOT_NAMES.length];
  }
  var car = blankCar("bot-" + Math.random().toString(36).slice(2, 10), name, ns, null);
  car.bot = true;
  car.connected = true;
  room.players.push(car);
  return car;
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
      name: p.name,
      bot: !!p.bot,
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
      body: p.body,
      wing: p.wing,
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
    speed: room.speed || 1,
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
  room.players.forEach(function (p) {
    var g = slotPose(p.slot);
    p.x = g.x;
    p.z = g.z;
    p.h = g.h != null ? g.h : 0;
    p.spd = 0;
    p.slide = 0;
    p.lap = 1;
    p.fuel = 100;
    p.tires = 100;
    p.pit = 0;
    p.finished = 0;
  });
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
    if (ext === ".html" || ext === ".js" || ext === ".css" || ext === ".json") {
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
      created.track = cleanTrack(msg.track);
      var hostCar = blankCar(self.id, cleanName(msg.name), slot, ws);
      hostCar.body = cleanHex(msg.body, hostCar.body);
      hostCar.wing = cleanHex(msg.wing, hostCar.wing);
      created.players.push(hostCar);
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
        if (msg.name) existing.name = cleanName(msg.name);
        if (msg.body != null) existing.body = cleanHex(msg.body, existing.body);
        if (msg.wing != null) existing.wing = cleanHex(msg.wing, existing.wing);
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
      var newbie = blankCar(self.id, cleanName(msg.name), ns, ws);
      newbie.body = cleanHex(msg.body, newbie.body);
      newbie.wing = cleanHex(msg.wing, newbie.wing);
      room.players.push(newbie);
      self.room = room;
      broadcast(room, roomMsg(room));
      sendEnter(ws, room, newbie, { late: room.phase === "racing" });
      return;
    }

    var room = self.room;
    if (!room) return;

    if (msg.t === "kick") {
      if (self.id !== room.hostId) {
        send(ws, { t: "err", msg: "Only the host can kick" });
        return;
      }
      var kid = String(msg.id || "");
      if (!kid || kid === room.hostId) {
        send(ws, { t: "err", msg: "Can't kick the host" });
        return;
      }
      var victim = playerById(room, kid);
      if (!victim) return;
      if (victim.ws) send(victim.ws, { t: "kicked" });
      room.players = room.players.filter(function (p) {
        return p.id !== kid;
      });
      broadcast(room, roomMsg(room));
      return;
    }

    if (msg.t === "bot") {
      if (self.id !== room.hostId) {
        send(ws, { t: "err", msg: "Only the host can change CPUs" });
        return;
      }
      if (room.phase !== "lobby" && room.phase !== "finish") {
        send(ws, { t: "err", msg: "Add CPUs in the lobby" });
        return;
      }
      if (msg.op === "add") {
        if (!addBot(room)) {
          send(ws, { t: "err", msg: "Room is full (8)" });
          return;
        }
      } else if (msg.op === "bowie") {
        var bowie = addBot(room, "BowieKnife99");
        if (!bowie) {
          send(ws, { t: "err", msg: "Room is full (8)" });
          return;
        }
      } else if (msg.op === "remove") {
        var bid = String(msg.id || "");
        room.players = room.players.filter(function (p) {
          return !(p.bot && p.id === bid);
        });
      }
      broadcast(room, roomMsg(room));
      return;
    }

    if (msg.t === "speed") {
      if (self.id !== room.hostId) {
        send(ws, { t: "err", msg: "Only the host can set speed" });
        return;
      }
      room.speed = clampSpeed(msg.n);
      broadcast(room, roomMsg(room));
      return;
    }

    if (msg.t === "track") {
      if (self.id !== room.hostId) {
        send(ws, { t: "err", msg: "Only the host can set the track" });
        return;
      }
      if (room.phase !== "lobby" && room.phase !== "finish") return;
      room.track = cleanTrack(msg.code);
      broadcast(room, roomMsg(room));
      return;
    }

    if (msg.t === "bots" && self.id === room.hostId) {
      (msg.cars || []).forEach(function (c) {
        if (!c || !c.id) return;
        var bp = playerById(room, c.id);
        if (!bp || !bp.bot) return;
        bp.x = +c.x || 0;
        bp.z = +c.z || 0;
        bp.h = +c.h || 0;
        bp.spd = +c.spd || 0;
        bp.slide = +c.slide || 0;
        bp.lap = +c.lap || 1;
        if (c.fuel != null && isFinite(+c.fuel)) bp.fuel = +c.fuel;
        if (c.tires != null && isFinite(+c.tires)) bp.tires = +c.tires;
        bp.finished = c.finished ? 1 : 0;
      });
      return;
    }

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
    var pace = clampSpeed(room.speed);
    tickLights(room, dt * pace);
    if (room.phase === "racing") room.raceTime += dt * pace;
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
