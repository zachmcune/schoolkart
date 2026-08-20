/* SchoolKart — Campus Loop
   Creative lead: Zachary McUne
   Feel spec: Pit Crew Designer (fuel/tires/handling locked)

   Controls: W gas, Space brake, S reverse, A/D steer.
   Phones (landscape): right half = gas, left half = brake, tilt = steer.
   Pit: peel LEFT onto a split lane. Halfway in, the car is grabbed
   and serviced ~2.5s, then released to drive out. One service per visit.
   Start: PRE-START blue flash, five reds at 1s, hold 0.2–3s all ON,
   lights out = GO. Fuel starts then. Car is locked to the grid until GO.
   W is a timing game — climb through the green, lift to catch it.
   Hold to max dumps a spin on lights-out.
   Course: asphalt → kerbs → painted runoff → concrete + two-rail.
   Barriers both sides except the LEFT pit peel. Grass is infield patches only.
   FX lock: two fat launch puffs, thin grey worn streaks, short white
   slip, one spinout burst, one sharp hit spark. */
(function () {
  "use strict";

  if (!window.THREE) {
    document.body.innerHTML =
      "<p style='color:#fff;font-family:sans-serif;padding:24px'>SchoolKart needs Three.js. Check the network, then refresh.</p>";
    return;
  }

  var THREE = window.THREE;

  var LAPS = 5;
  var MAX_SPEED = 48;
  var ACCEL = 26;
  var BRAKE_DECEL = 26; // squeeze: weaker at wind-out, full bite when slow (hairpin)
  var COAST = 8;
  var REVERSE_ACCEL = 18;
  var REVERSE_MAX = 12;
  var LIMP_SPEED = 13;
  var LIMP_ACCEL = 6;
  var STEER_RATE = 2.35;
  var MAX_LAT = 28;
  // Burn is the clock. Retuned for measured TRACK_LEN (~1979). 5 laps
  // still force ONE box — a second stop should never be required.
  var IDLE_FUEL = 0.46;
  var THROTTLE_FUEL = 0.12;
  var PIT_HOLD = 2.5;
  var REV_SWEET_LO = 0.58;
  var REV_SWEET_HI = 0.8;
  var REV_GREAT_LO = 0.64;
  var REV_GREAT_HI = 0.74;
  var REV_CLIMB = 0.55;
  var REV_DROP = 0.72;
  var GETAWAY_T = 1.5;
  var ASPHALT = 8.6;
  var RUNOFF = 3.8;
  var KERB_NAMES = ["the90", "hairpin", "chicane", "sweeper", "kink"];
  var GRASS_MAX = 8.5;
  var GRASS_ROLL = 4;
  var GRASS_DUMP = 40;
  var TIRE_FLOOR = 22;
  var TEAL = 0x2ec8c3;
  var TEAL_DEEP = 0x148f8c;
  var HIT_RADIUS = 2.55;
  var WALLS = [];
  var FX_MAX = 18;

  var SF_Z = -80;
  var GRID_P2_X = -14;
  var GRID_P2_Z = SF_Z - 2.7;
  var SKINS = [
    { color: 0xf4f1ea, num: 7, name: "House 7" },
    { color: 0xd4a017, num: 12, name: "Hall Monitor" },
    { color: 0xb4532e, num: 21, name: "Sub Teacher" },
    { color: 0x3d8cff, num: 3, name: "Library Kid" },
    { color: 0x9b59b6, num: 9, name: "Band Kid" },
    { color: 0x2ecc71, num: 18, name: "Lab Partner" },
    { color: 0xe67e22, num: 5, name: "Detention" },
    { color: 0x1abc9c, num: 14, name: "Yearbook" },
  ];

  function gridSlot(i) {
    return { x: -6 - i * 8, z: SF_Z + (i % 2 ? -2.7 : 2.7) };
  }

  // F1 bypass, LEFT of the south S/F straight (infield / +Z).
  // Long peel, parallel lane, merge back. Grab HALFWAY IN the side lane.
  var PIT_LANE = { x0: 8, x1: 118, z0: -67.4, z1: -56.6 };
  var PIT_GRAB = { x0: 58, x1: 90, z0: -67.4, z1: -56.6 };
  var PIT_PAVE = [
    { x0: -90, x1: 36, z0: -74.0, z1: -58.0 },
    { x0: -20, x1: 50, z0: -71.6, z1: -56.0 },
    { x0: 8, x1: 118, z0: -71.6, z1: -56.0 },
    PIT_LANE,
    PIT_GRAB,
    { x0: 96, x1: 160, z0: -71.6, z1: -56.0 },
    { x0: 124, x1: 185, z0: -74.0, z1: -62.0 },
  ];

  var keys = Object.create(null);
  var touchCtl = {
    gas: false,
    brake: false,
    rev: false,
    steer: 0,
    pads: {},
    gyroOn: false,
    gyroNeedCal: true,
    gyroCenter: 0,
    hintShown: false,
    tiltAsked: false,
    tiltGranted: false,
    sawKeyboard: false,
  };
  var playerBody = 0xf4f1ea;
  var playerWing = TEAL_DEEP;
  var BODY_SWATCHES = [0xf4f1ea, 0xd4a017, 0xb4532e, 0x3d8cff, 0x9b59b6, 0x2ecc71, 0xe67e22, 0x1a1a1a];
  var WING_SWATCHES = [0x148f8c, 0x1a1a1a, 0xf4efe6, 0xff2a44, 0xffe566, 0x3d8cff];
  var trackCode = "";
  var trackRoot = null;
  var stampTrees = [];
  try {
    var pb = parseInt(localStorage.getItem("sk_body"), 10);
    var pw = parseInt(localStorage.getItem("sk_wing"), 10);
    if (isFinite(pb) && pb >= 0 && pb <= 0xffffff) playerBody = pb | 0;
    if (isFinite(pw) && pw >= 0 && pw <= 0xffffff) playerWing = pw | 0;
  } catch (e0) {}
  var state = "title";
  var startPhase = "prestart";
  var startT = 0;
  var redsOn = 0;
  var holdDelay = 1;
  var raceTime = 0;
  var didPit = false;
  var pitTimer = 0;
  var pitFlash = 0;
  var pitUsedVisit = false;
  var pitServicing = false;
  var lastTs = 0;
  var camYaw = 0.6;
  var camFollowH = 0;
  var revs = 0;
  var launchMul = 1;
  var launchT = 0;
  var launchCall = "";
  var launchCallT = 0;
  var audio = { ctx: null, osc: null, gain: null };
  var gantryReds = [];
  var gantryBlues = [];
  var mpMode = false;
  var remotes = {};
  var hostBots = {};
  var gameSpeed = 1;
  var lobbyPick = "";
  var SPEED_STEPS = [1, 1.25, 0.75];
  var lastNetSend = 0;
  var playerGridX = GRID_P2_X;
  var playerGridZ = GRID_P2_Z;
  var joining = false;
  var lateJoinT = 0;
  var net = window.SchoolKartNet;

  var canvas = document.getElementById("view");
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xe87834, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  function layoutCamera() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[0] *= -1;
  }

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf08a48, 260, 640);

  var camera = new THREE.PerspectiveCamera(
    62,
    window.innerWidth / window.innerHeight,
    0.3,
    680
  );
  layoutCamera();

  var hud = {
    root: document.getElementById("hud"),
    lap: document.getElementById("lap"),
    time: document.getElementById("time"),
    speed: document.getElementById("speed"),
    fuelFill: document.getElementById("fuel-fill"),
    tireFill: document.getElementById("tire-fill"),
    fuelNum: document.getElementById("fuel-num"),
    tireNum: document.getElementById("tire-num"),
    pitting: document.getElementById("pitting"),
    warn: document.getElementById("warn"),
    title: document.getElementById("title-screen"),
    countdown: document.getElementById("countdown"),
    startMsg: document.getElementById("start-msg"),
    finish: document.getElementById("finish-screen"),
    finishTime: document.getElementById("finish-time"),
    finishPit: document.getElementById("finish-pit"),
    finishPlace: document.getElementById("finish-place"),
    revWrap: document.getElementById("rev-wrap"),
    revFill: document.getElementById("rev-fill"),
    revNeedle: document.getElementById("rev-needle"),
    revHint: document.getElementById("rev-hint"),
    lobby: document.getElementById("lobby-screen"),
    roomCode: document.getElementById("room-code"),
    roster: document.getElementById("roster"),
    lobbyStatus: document.getElementById("lobby-status"),
    lobbyErr: document.getElementById("lobby-err"),
    gridBtn: document.getElementById("btn-grid"),
    bootStatus: document.getElementById("boot-status"),
    mini: document.getElementById("minimap"),
    raceNames: document.getElementById("race-names"),
    hostTools: document.getElementById("host-tools"),
    nameInput: document.getElementById("display-name"),
    speedBtn: document.getElementById("btn-speed"),
    bowieBtn: document.getElementById("btn-add-bowie"),
    circuit: document.getElementById("circuit-name"),
    touchLayer: document.getElementById("touch-layer"),
    revBtn: document.getElementById("rev-btn"),
    mobileHint: document.getElementById("mobile-hint"),
    tiltBtn: document.getElementById("tilt-btn"),
    rotateHint: document.getElementById("rotate-hint"),
    bodySwatches: document.getElementById("body-swatches"),
    wingSwatches: document.getElementById("wing-swatches"),
    trackScreen: document.getElementById("track-screen"),
    trackView: document.getElementById("track-code-view"),
    trackPaste: document.getElementById("track-paste"),
    tilePalette: document.getElementById("tile-palette"),
    tileBoard: document.getElementById("tile-board"),
    tileTrash: document.getElementById("tile-trash"),
    tileRot: document.getElementById("btn-tile-rot"),
    lights: [
      document.getElementById("rl0"),
      document.getElementById("rl1"),
      document.getElementById("rl2"),
      document.getElementById("rl3"),
      document.getElementById("rl4"),
    ],
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function cleanName(raw) {
    var s = String(raw == null ? "" : raw)
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (s.length > 14) s = s.slice(0, 14);
    return s || "House 7";
  }

  function readDisplayName() {
    var n = cleanName(hud.nameInput && hud.nameInput.value);
    if (hud.nameInput) hud.nameInput.value = n;
    try {
      sessionStorage.setItem("sk_name", n);
    } catch (e) {}
    if (net) {
      net.name = n;
      net.body = playerBody;
      net.wing = playerWing;
      net.track = trackCode;
    }
    player.name = n;
    paintNameTag(player);
    return n;
  }

  function applyGameSpeed(n) {
    n = +n;
    if (n !== 0.75 && n !== 1.25) n = 1;
    gameSpeed = n;
    if (net) net.speed = n;
    if (hud.speedBtn) {
      hud.speedBtn.textContent = n === 1.25 ? "1.25x" : n === 0.75 ? "0.75x" : "1x";
    }
  }

  function inRect(x, z, b) {
    return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  }

  function onPitPavement(x, z) {
    for (var i = 0; i < PIT_PAVE.length; i++) {
      if (inRect(x, z, PIT_PAVE[i])) return true;
    }
    return false;
  }

  function formatTime(t) {
    var m = Math.floor(t / 60);
    var s = t - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2);
  }

  function closestOnSeg(px, pz, ax, az, bx, bz) {
    var dx = bx - ax;
    var dz = bz - az;
    var l2 = dx * dx + dz * dz;
    var t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
    t = clamp(t, 0, 1);
    var qx = ax + dx * t;
    var qz = az + dz * t;
    var ex = px - qx;
    var ez = pz - qz;
    return { x: qx, z: qz, d2: ex * ex + ez * ez, t: t, h: Math.atan2(dz, dx) };
  }

  function closestOnArc(px, pz, cx, cz, r, a0, a1) {
    var ang = Math.atan2(pz - cz, px - cx);
    var lo = Math.min(a0, a1);
    var hi = Math.max(a0, a1);
    var a = ang;
    while (a < lo - Math.PI) a += Math.PI * 2;
    while (a > hi + Math.PI) a -= Math.PI * 2;
    if (a < lo || a > hi) {
      var d0 = Math.abs(Math.atan2(Math.sin(ang - a0), Math.cos(ang - a0)));
      var d1 = Math.abs(Math.atan2(Math.sin(ang - a1), Math.cos(ang - a1)));
      a = d0 < d1 ? a0 : a1;
    }
    var qx = cx + Math.cos(a) * r;
    var qz = cz + Math.sin(a) * r;
    var ex = px - qx;
    var ez = pz - qz;
    var span = a1 - a0;
    var t = span !== 0 ? (a - a0) / span : 0;
    var hd = a1 >= a0 ? a + Math.PI * 0.5 : a - Math.PI * 0.5;
    return { x: qx, z: qz, d2: ex * ex + ez * ez, t: t, h: hd };
  }

  var PATH = [];
  var TRACK_LEN = 0;
  var RIBBON_SEGS = 360;

  function cleanTrack(raw) {
    return String(raw || "").replace(/[^sSLRHCKPtrM0-9]/g, "").slice(0, 120);
  }

  function addLine(ax, az, bx, bz, name) {
    var len = Math.hypot(bx - ax, bz - az);
    PATH.push({
      type: "line",
      ax: ax,
      az: az,
      bx: bx,
      bz: bz,
      len: len,
      startS: TRACK_LEN,
      name: name,
    });
    TRACK_LEN += len;
  }

  function addArc(cx, cz, r, a0, a1, name) {
    var len = Math.abs(a1 - a0) * r;
    PATH.push({
      type: "arc",
      cx: cx,
      cz: cz,
      r: r,
      a0: a0,
      a1: a1,
      len: len,
      startS: TRACK_LEN,
      name: name,
    });
    TRACK_LEN += len;
  }

  var _x = -200;
  var _z = SF_Z;
  var _h = 0;

  function pathLine(dist, name) {
    var nx = _x + Math.cos(_h) * dist;
    var nz = _z + Math.sin(_h) * dist;
    addLine(_x, _z, nx, nz, name);
    _x = nx;
    _z = nz;
  }

  function pathArc(r, deg, name) {
    var rad = (deg * Math.PI) / 180;
    var side = deg > 0 ? 1 : -1;
    var cx = _x + Math.cos(_h + side * Math.PI * 0.5) * r;
    var cz = _z + Math.sin(_h + side * Math.PI * 0.5) * r;
    var a0 = Math.atan2(_z - cz, _x - cx);
    var a1 = a0 + rad;
    addArc(cx, cz, r, a0, a1, name);
    _h += rad;
    _x = cx + Math.cos(a1) * r;
    _z = cz + Math.sin(a1) * r;
  }

  function pathSnap(targetDeg, r, name) {
    var cur = (((_h * 180) / Math.PI) % 360 + 360) % 360;
    var d = targetDeg - cur;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    if (Math.abs(d) >= 0.4) pathArc(r, d, name);
  }

  var PIT_META = { ax: 8, az: -62, bx: 118, bz: -62, on: true };

  function resetPathCursor() {
    PATH = [];
    TRACK_LEN = 0;
    _x = -200;
    _z = SF_Z;
    _h = 0;
    stampTrees = [];
  }

  function setDefaultPit() {
    PIT_LANE.x0 = 8;
    PIT_LANE.x1 = 118;
    PIT_LANE.z0 = -67.4;
    PIT_LANE.z1 = -56.6;
    PIT_GRAB.x0 = 58;
    PIT_GRAB.x1 = 90;
    PIT_GRAB.z0 = -67.4;
    PIT_GRAB.z1 = -56.6;
    PIT_PAVE.length = 0;
    PIT_PAVE.push(
      { x0: -90, x1: 36, z0: -74.0, z1: -58.0 },
      { x0: -20, x1: 50, z0: -71.6, z1: -56.0 },
      { x0: 8, x1: 118, z0: -71.6, z1: -56.0 },
      PIT_LANE,
      PIT_GRAB,
      { x0: 96, x1: 160, z0: -71.6, z1: -56.0 },
      { x0: 124, x1: 185, z0: -74.0, z1: -62.0 }
    );
    PIT_META.ax = PIT_LANE.x0;
    PIT_META.az = (PIT_LANE.z0 + PIT_LANE.z1) * 0.5;
    PIT_META.bx = PIT_LANE.x1;
    PIT_META.bz = PIT_META.az;
    PIT_META.on = true;
  }

  function clearPit() {
    PIT_LANE.x0 = 9999;
    PIT_LANE.x1 = 10000;
    PIT_LANE.z0 = 9999;
    PIT_LANE.z1 = 10000;
    PIT_GRAB.x0 = 9999;
    PIT_GRAB.x1 = 10000;
    PIT_GRAB.z0 = 9999;
    PIT_GRAB.z1 = 10000;
    PIT_PAVE.length = 0;
    PIT_META.on = false;
  }

  function placePitHere() {
    var fx = Math.cos(_h);
    var fz = Math.sin(_h);
    var lx = Math.cos(_h + Math.PI * 0.5);
    var lz = Math.sin(_h + Math.PI * 0.5);
    var len = 110;
    var inset = 12;
    var half = 5.4;
    var xs = [];
    var zs = [];
    function add(x, z) {
      xs.push(x);
      zs.push(z);
    }
    add(_x + lx * (inset - half), _z + lz * (inset - half));
    add(_x + lx * (inset + half), _z + lz * (inset + half));
    add(_x + fx * len + lx * (inset - half), _z + fz * len + lz * (inset - half));
    add(_x + fx * len + lx * (inset + half), _z + fz * len + lz * (inset + half));
    var x0 = Math.min.apply(null, xs);
    var x1 = Math.max.apply(null, xs);
    var z0 = Math.min.apply(null, zs);
    var z1 = Math.max.apply(null, zs);
    PIT_LANE.x0 = x0;
    PIT_LANE.x1 = x1;
    PIT_LANE.z0 = z0;
    PIT_LANE.z1 = z1;
    PIT_META.ax = _x + lx * inset;
    PIT_META.az = _z + lz * inset;
    PIT_META.bx = _x + fx * len + lx * inset;
    PIT_META.bz = _z + fz * len + lz * inset;
    PIT_META.on = true;
    var gx = [];
    var gz = [];
    var t0 = 0.48;
    var t1 = 0.78;
    add = function (x, z) {
      gx.push(x);
      gz.push(z);
    };
    add(PIT_META.ax + (PIT_META.bx - PIT_META.ax) * t0 + lx * -half, PIT_META.az + (PIT_META.bz - PIT_META.az) * t0 + lz * -half);
    add(PIT_META.ax + (PIT_META.bx - PIT_META.ax) * t0 + lx * half, PIT_META.az + (PIT_META.bz - PIT_META.az) * t0 + lz * half);
    add(PIT_META.ax + (PIT_META.bx - PIT_META.ax) * t1 + lx * -half, PIT_META.az + (PIT_META.bz - PIT_META.az) * t1 + lz * -half);
    add(PIT_META.ax + (PIT_META.bx - PIT_META.ax) * t1 + lx * half, PIT_META.az + (PIT_META.bz - PIT_META.az) * t1 + lz * half);
    PIT_GRAB.x0 = Math.min.apply(null, gx);
    PIT_GRAB.x1 = Math.max.apply(null, gx);
    PIT_GRAB.z0 = Math.min.apply(null, gz);
    PIT_GRAB.z1 = Math.max.apply(null, gz);
    PIT_PAVE.length = 0;
    PIT_PAVE.push(PIT_LANE, PIT_GRAB);
  }

  function autoClosePath() {
    var dx = -200 - _x;
    var dz = SF_Z - _z;
    if (Math.hypot(dx, dz) < 8 && Math.abs(Math.atan2(Math.sin(-_h), Math.cos(-_h))) < 0.12) return;
    var want = (Math.atan2(dz, dx) * 180) / Math.PI;
    pathSnap(want, 20, "close");
    var left = Math.hypot(-200 - _x, SF_Z - _z);
    if (left > 2) pathLine(left, "close");
    pathSnap(0, 16, "close");
  }

  function buildCampusPath() {
    pathLine(430, "start");
    pathArc(40, 48, "the90");
    pathArc(13, 42, "the90");
    pathLine(320, "short");
    pathArc(12, 88, "chicane");
    pathLine(150, "chicane");
    pathArc(9, -100, "chicane");
    pathLine(18, "chicane");
    pathArc(13, 60, "chicane");
    pathSnap(180, 18, "chicane");
    pathLine(_x - -360, "north");
    pathArc(11, 180, "hairpin");
    pathLine(18, "exit");
    pathArc(16, -90, "kink");
    var sweepR = -200 - _x;
    var southLen = _z - sweepR - SF_Z;
    pathLine(southLen, "west");
    pathArc(sweepR, 90, "sweeper");
  }

  function buildCodePath(code) {
    var i;
    var hadPit = false;
    for (i = 0; i < code.length; i++) {
      var ch = code.charAt(i);
      if (ch === "s") pathLine(70, "short");
      else if (ch === "S") pathLine(160, "start");
      else if (ch === "L") pathArc(22, 90, "the90");
      else if (ch === "R") pathArc(22, -90, "the90");
      else if (ch === "H") pathArc(11, 180, "hairpin");
      else if (ch === "C") {
        pathArc(12, 88, "chicane");
        pathLine(40, "chicane");
        pathArc(9, -100, "chicane");
        pathLine(12, "chicane");
        pathArc(13, 60, "chicane");
      } else if (ch === "K") pathArc(16, -90, "kink");
      else if (ch === "P") {
        placePitHere();
        pathLine(110, "start");
        hadPit = true;
      } else if (ch === "t") {
        stampTrees.push({
          x: _x + Math.cos(_h + Math.PI * 0.5) * (ASPHALT + 8),
          z: _z + Math.sin(_h + Math.PI * 0.5) * (ASPHALT + 8),
        });
      }
    }
    if (!hadPit) clearPit();
    autoClosePath();
  }

  var MAP_W = 8;
  var MAP_H = 6;
  var MAP_CELL = 88;
  var MAP_DXY = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  var MAP_TYPES = {
    s: { ports: [0, 2], name: "straight" },
    r: { ports: [0, 1], name: "90" },
    H: { ports: [0, 1], name: "hairpin" },
    C: { ports: [0, 2], name: "chicane" },
    P: { ports: [0, 2], name: "pit" },
    t: { ports: [], name: "tree" },
  };

  function mapKey(x, y) {
    return x + "," + y;
  }

  function parseMap(code) {
    var pieces = [];
    if (!code || code.charAt(0) !== "M") return pieces;
    var i;
    for (i = 1; i + 3 < code.length; i += 4) {
      var t = code.charAt(i);
      var x = +code.charAt(i + 1);
      var y = +code.charAt(i + 2);
      var r = +code.charAt(i + 3);
      if (!MAP_TYPES[t]) continue;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H || r < 0 || r > 3 || isNaN(x) || isNaN(y) || isNaN(r)) continue;
      pieces.push({ t: t, x: x, y: y, r: r });
    }
    return pieces;
  }

  function encodeMap(pieces) {
    if (!pieces || !pieces.length) return "";
    var s = "M";
    var i;
    for (i = 0; i < pieces.length && s.length + 4 <= 120; i++) {
      s += pieces[i].t + pieces[i].x + pieces[i].y + pieces[i].r;
    }
    return s;
  }

  function portsFor(t, r) {
    var base = MAP_TYPES[t] && MAP_TYPES[t].ports;
    if (!base || !base.length) return [];
    return [(base[0] + r) & 3, (base[1] + r) & 3];
  }

  function portWorld(x, y, dir) {
    var cx = -200 + (x + 0.5) * MAP_CELL;
    var cz = SF_Z + (y + 0.5) * MAP_CELL;
    var h = MAP_CELL * 0.5;
    if (dir === 0) return { x: cx + h, z: cz };
    if (dir === 1) return { x: cx, z: cz + h };
    if (dir === 2) return { x: cx - h, z: cz };
    return { x: cx, z: cz - h };
  }

  function emitMapPiece(p, fromPort) {
    var ps = portsFor(p.t, p.r);
    var outPort = ps[0] === fromPort ? ps[1] : ps[0];
    var inH = (fromPort + 2) & 3;
    var turn = ((outPort - inH) + 4) & 3;
    var outDeg = outPort * 90;
    if (p.t === "P") {
      placePitHere();
      pathLine(MAP_CELL, "start");
    } else if (p.t === "s") {
      pathLine(MAP_CELL, "short");
    } else if (p.t === "r") {
      if (turn === 1) pathArc(MAP_CELL * 0.42, 90, "the90");
      else if (turn === 3) pathArc(MAP_CELL * 0.42, -90, "the90");
      else pathLine(MAP_CELL * 0.7, "short");
    } else if (p.t === "H") {
      pathArc(MAP_CELL * 0.2, turn === 1 || turn === 2 ? 180 : -180, "hairpin");
    } else if (p.t === "C") {
      pathArc(14, 62, "chicane");
      pathLine(16, "chicane");
      pathArc(11, -80, "chicane");
    } else {
      pathLine(MAP_CELL * 0.6, "short");
    }
    pathSnap(outDeg, 14, p.t === "H" ? "hairpin" : p.t === "C" ? "chicane" : "close");
  }

  function buildMapPath(code) {
    var pieces = parseMap(code);
    var by = {};
    var i;
    for (i = 0; i < pieces.length; i++) {
      by[mapKey(pieces[i].x, pieces[i].y)] = pieces[i];
      if (pieces[i].t === "t") {
        stampTrees.push({
          x: -200 + (pieces[i].x + 0.5) * MAP_CELL,
          z: SF_Z + (pieces[i].y + 0.5) * MAP_CELL,
        });
      }
    }
    var track = pieces.filter(function (p) {
      return p.t !== "t";
    });
    if (!track.length) {
      setDefaultPit();
      buildCampusPath();
      return;
    }
    var start = null;
    for (i = 0; i < track.length; i++) {
      if (track[i].t === "P") {
        start = track[i];
        break;
      }
    }
    if (!start) start = track[0];
    var ports = portsFor(start.t, start.r);
    var fromPort = ports[0];
    var enter = portWorld(start.x, start.y, fromPort);
    _x = enter.x;
    _z = enter.z;
    _h = ((fromPort + 2) & 3) * Math.PI * 0.5;
    var visited = {};
    var cur = start;
    var hadPit = false;
    var guard = 0;
    while (cur && guard++ < 64) {
      var k = mapKey(cur.x, cur.y);
      if (visited[k]) break;
      visited[k] = 1;
      emitMapPiece(cur, fromPort);
      if (cur.t === "P") hadPit = true;
      var ps = portsFor(cur.t, cur.r);
      var outPort = ps[0] === fromPort ? ps[1] : ps[0];
      if (outPort == null) break;
      var nx = cur.x + MAP_DXY[outPort][0];
      var ny = cur.y + MAP_DXY[outPort][1];
      var np = by[mapKey(nx, ny)];
      if (!np || np.t === "t") break;
      var back = (outPort + 2) & 3;
      if (portsFor(np.t, np.r).indexOf(back) === -1) break;
      fromPort = back;
      cur = np;
    }
    if (!hadPit) clearPit();
    autoClosePath();
  }

  function rebuildPath(code) {
    resetPathCursor();
    if (code) {
      if (code.charAt(0) === "M") buildMapPath(code);
      else buildCodePath(code);
    } else {
      setDefaultPit();
      buildCampusPath();
    }
    RIBBON_SEGS = Math.max(360, Math.round(TRACK_LEN / 2.4));
  }

  function pointOnSeg(seg, u) {
    if (seg.type === "line") {
      return {
        x: seg.ax + (seg.bx - seg.ax) * u,
        z: seg.az + (seg.bz - seg.az) * u,
        h: Math.atan2(seg.bz - seg.az, seg.bx - seg.ax),
        name: seg.name,
        r: 999,
      };
    }
    var a = seg.a0 + (seg.a1 - seg.a0) * u;
    return {
      x: seg.cx + Math.cos(a) * seg.r,
      z: seg.cz + Math.sin(a) * seg.r,
      h: seg.a1 >= seg.a0 ? a + Math.PI * 0.5 : a - Math.PI * 0.5,
      name: seg.name,
      r: seg.r,
    };
  }

  function centerlinePoint(s) {
    s = ((s % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
    for (var i = 0; i < PATH.length; i++) {
      var seg = PATH[i];
      if (s <= seg.startS + seg.len || i === PATH.length - 1) {
        return pointOnSeg(seg, clamp((s - seg.startS) / seg.len, 0, 1));
      }
    }
    return pointOnSeg(PATH[0], 0);
  }

  var miniPts = [];
  var miniBox = { x0: 0, z0: 0, x1: 0, z1: 0 };
  function bakeMini() {
    var n = 140;
    var i;
    var x0 = Infinity;
    var z0 = Infinity;
    var x1 = -Infinity;
    var z1 = -Infinity;
    miniPts.length = 0;
    for (i = 0; i <= n; i++) {
      var p = centerlinePoint((i / n) * TRACK_LEN);
      miniPts.push(p.x, p.z);
      if (p.x < x0) x0 = p.x;
      if (p.z < z0) z0 = p.z;
      if (p.x > x1) x1 = p.x;
      if (p.z > z1) z1 = p.z;
    }
    miniBox.x0 = x0;
    miniBox.z0 = z0;
    miniBox.x1 = x1;
    miniBox.z1 = z1;
  }

  rebuildPath("");
  bakeMini();

  function projectTrack(px, pz) {
    var best = null;
    var bestS = 0;
    for (var i = 0; i < PATH.length; i++) {
      var seg = PATH[i];
      var hit =
        seg.type === "line"
          ? closestOnSeg(px, pz, seg.ax, seg.az, seg.bx, seg.bz)
          : closestOnArc(px, pz, seg.cx, seg.cz, seg.r, seg.a0, seg.a1);
      if (!best || hit.d2 < best.d2) {
        best = hit;
        bestS = seg.startS + hit.t * seg.len;
        best.name = seg.name;
      }
    }
    var dist = Math.sqrt(best.d2);
    var inPit = inRect(px, pz, PIT_GRAB);
    var onPit = onPitPavement(px, pz);
    var onAsphalt = dist <= ASPHALT || onPit;
    var onKerb =
      !onPit &&
      KERB_NAMES.indexOf(best.name) !== -1 &&
      dist > ASPHALT - 0.12 &&
      dist < ASPHALT + 1.5;
    var onRunoff = !onAsphalt && dist <= ASPHALT + RUNOFF;
    return {
      x: best.x,
      z: best.z,
      dist: dist,
      h: best.h,
      s: bestS,
      name: best.name,
      onAsphalt: onAsphalt,
      inPit: inPit,
      kerb: onKerb,
      onRunoff: onRunoff,
      grass: !onAsphalt && !onRunoff && !onPit,
    };
  }

  function makeEdges(inset, halfW, y, color) {
    var segs = RIBBON_SEGS;
    var pos = [];
    var idx = [];
    var used = 0;
    for (var i = 0; i <= segs; i++) {
      var p = centerlinePoint((i / segs) * TRACK_LEN);
      var nx = -Math.sin(p.h);
      var nz = Math.cos(p.h);
      pos.push(p.x + nx * (inset + halfW), y, p.z + nz * (inset + halfW));
      pos.push(p.x + nx * (inset - halfW), y, p.z + nz * (inset - halfW));
      if (used > 0) {
        var a = (used - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      used += 1;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    var en = [];
    var ei;
    for (ei = 0; ei < pos.length; ei += 3) en.push(0, 1, 0);
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(en, 3));
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide }));
  }

  function ribbonMat(color) {
    if (color && typeof color === "object") return color;
    return new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide });
  }

  function makeRibbon(half, y, color, onlyNames, uvStep, offset) {
    var segs = RIBBON_SEGS;
    var pos = [];
    var idx = [];
    var uvs = uvStep ? [] : null;
    var used = 0;
    var off = offset || 0;
    var sided = offset != null && offset !== 0;
    for (var i = 0; i <= segs; i++) {
      var p = centerlinePoint((i / segs) * TRACK_LEN);
      if (onlyNames && onlyNames.indexOf(p.name) === -1) continue;
      var nx = -Math.sin(p.h);
      var nz = Math.cos(p.h);
      if (sided) {
        pos.push(p.x + nx * (off + half), y, p.z + nz * (off + half));
        pos.push(p.x + nx * (off - half), y, p.z + nz * (off - half));
      } else {
        pos.push(p.x + nx * half, y, p.z + nz * half);
        pos.push(p.x - nx * half, y, p.z - nz * half);
      }
      if (uvs) {
        uvs.push(used * uvStep, 1);
        uvs.push(used * uvStep, 0);
      }
      if (used > 0) {
        var a = (used - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      used += 1;
    }
    if (used < 2) return null;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    if (uvs) geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    var nrm = [];
    var ni;
    for (ni = 0; ni < pos.length; ni += 3) nrm.push(0, 1, 0);
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    return new THREE.Mesh(geo, ribbonMat(color));
  }

  var _kerbTex = null;
  function kerbTex() {
    if (_kerbTex) return _kerbTex;
    var c = document.createElement("canvas");
    c.width = 32;
    c.height = 8;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#ff2038";
    ctx.fillRect(0, 0, 16, 8);
    ctx.fillStyle = "#fff6ee";
    ctx.fillRect(16, 0, 16, 8);
    _kerbTex = new THREE.CanvasTexture(c);
    _kerbTex.wrapS = THREE.RepeatWrapping;
    _kerbTex.wrapT = THREE.ClampToEdgeWrapping;
    _kerbTex.magFilter = THREE.NearestFilter;
    _kerbTex.minFilter = THREE.NearestFilter;
    return _kerbTex;
  }

  function addBox(x, y, z, w, h, d, color, parent) {
    var mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide })
    );
    mesh.position.set(x, y, z);
    (parent || scene).add(mesh);
    return mesh;
  }

  function labelPlane(text, w, h, fg, bg) {
    var c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    var ctx = c.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 128);
    ctx.save();
    ctx.translate(256, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = fg;
    ctx.font = "bold 48px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 64);
    ctx.restore();
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide })
    );
    return mesh;
  }

  function paveRect(b, y, color) {
    var mesh = new THREE.Mesh(
      new THREE.BoxGeometry(b.x1 - b.x0, 0.1, b.z1 - b.z0),
      new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide })
    );
    mesh.position.set((b.x0 + b.x1) * 0.5, y, (b.z0 + b.z1) * 0.5);
    return mesh;
  }

  function disposeGroup(g) {
    if (!g) return;
    while (g.children.length) {
      var c = g.children[0];
      disposeGroup(c);
      g.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
  }

  function addTrackMesh() {
    gantryReds = [];
    gantryBlues = [];
    if (trackRoot) {
      scene.remove(trackRoot);
      disposeGroup(trackRoot);
    }
    trackRoot = new THREE.Group();
    scene.add(trackRoot);

    // Sand ONLY at the 180 and the chicane — discrete, not a beach around the lap.
    var sandH = makeRibbon(ASPHALT + RUNOFF + 1.45, 0.018, 0xe0c888, ["hairpin"]);
    var sandC = makeRibbon(ASPHALT + RUNOFF + 1.45, 0.018, 0xe0c888, ["chicane"]);
    if (sandH) trackRoot.add(sandH);
    if (sandC) trackRoot.add(sandC);
    // Painted runoff = lighter/cooler grey. Asphalt = darker. Must read apart.
    var runoffMat = new THREE.MeshLambertMaterial({
      color: 0x8d97a6,
      emissive: 0x2a3038,
      side: THREE.DoubleSide,
    });
    var runoff = makeRibbon(ASPHALT + RUNOFF, 0.03, runoffMat, null);
    if (runoff) trackRoot.add(runoff);

    var asphaltMat = new THREE.MeshLambertMaterial({
      color: 0x3a3e46,
      emissive: 0x101214,
      side: THREE.DoubleSide,
    });
    trackRoot.add(makeRibbon(ASPHALT, 0.055, asphaltMat, null));
    trackRoot.add(makeRibbon(0.42, 0.08, 0xd8d2c6, null));
    trackRoot.add(makeEdges(ASPHALT - 0.38, 0.22, 0.072, 0xf4efe6));
    trackRoot.add(makeEdges(-(ASPHALT - 0.38), 0.22, 0.072, 0xf4efe6));
    var kerbMat = new THREE.MeshBasicMaterial({
      map: kerbTex(),
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    var kn;
    for (kn = 0; kn < KERB_NAMES.length; kn++) {
      var names = [KERB_NAMES[kn]];
      var kL = makeRibbon(0.9, 0.09, kerbMat, names, 0.42, +(ASPHALT + 0.55));
      var kR = makeRibbon(0.9, 0.09, kerbMat, names, 0.42, -(ASPHALT + 0.55));
      if (kL) trackRoot.add(kL);
      if (kR) trackRoot.add(kR);
    }

    var p;
    for (p = 0; p < PIT_PAVE.length; p++) {
      var pv = paveRect(PIT_PAVE[p], 0.08, 0x3d4a5c);
      trackRoot.add(pv);
    }
    if (PIT_META.on) {
      var grab = paveRect(PIT_GRAB, 0.12, TEAL);
      trackRoot.add(grab);
      addBox((PIT_LANE.x0 + PIT_LANE.x1) * 0.5, 0.115, PIT_LANE.z0, PIT_LANE.x1 - PIT_LANE.x0, 0.03, 0.34, 0xffe566, trackRoot);
      addBox((PIT_LANE.x0 + PIT_LANE.x1) * 0.5, 0.115, PIT_LANE.z1, PIT_LANE.x1 - PIT_LANE.x0, 0.03, 0.34, 0x7cffd4, trackRoot);
    }
    if (!trackCode) {
      addBox(62, 0.82, -54.2, 70, 1.55, 0.62, 0x2a2018, trackRoot);
      addBox(62, 1.62, -54.2, 70, 0.12, 0.7, TEAL, trackRoot);
      var pitDecal = labelPlane("PIT", 7.2, 2.8, "#0a2a28", "#2ec8c3");
      pitDecal.rotation.x = -Math.PI * 0.5;
      pitDecal.position.set(72, 0.16, -62.0);
      trackRoot.add(pitDecal);
      var inDecal = labelPlane("IN", 5.4, 2.2, "#102018", "#ffe566");
      inDecal.rotation.x = -Math.PI * 0.5;
      inDecal.position.set(-20, 0.16, -66);
      trackRoot.add(inDecal);
      var outDecal = labelPlane("OUT", 5.8, 2.2, "#102018", "#7cffd4");
      outDecal.rotation.x = -Math.PI * 0.5;
      outDecal.position.set(148, 0.16, -66);
      trackRoot.add(outDecal);
      for (var hsh = 0; hsh < 5; hsh++) {
        addBox(62 + hsh * 3.6, 0.14, -62.0, 1.15, 0.02, 9.2, 0xffffff, trackRoot);
      }
    } else if (PIT_META.on) {
      var pitDecal2 = labelPlane("PIT", 7.2, 2.8, "#0a2a28", "#2ec8c3");
      pitDecal2.rotation.x = -Math.PI * 0.5;
      pitDecal2.position.set((PIT_GRAB.x0 + PIT_GRAB.x1) * 0.5, 0.16, (PIT_GRAB.z0 + PIT_GRAB.z1) * 0.5);
      trackRoot.add(pitDecal2);
    }

    var start = centerlinePoint(0);
    var stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.14, ASPHALT * 2),
      new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    stripe.position.set(trackCode ? start.x : 0, 0.1, trackCode ? start.z : SF_Z);
    stripe.rotation.y = trackCode ? -start.h : 0;
    trackRoot.add(stripe);

    var gxs = [-6, -14, -22];
    var gzs = [SF_Z + 2.7, SF_Z - 2.7, SF_Z + 2.7];
    for (var gb = 0; gb < 3; gb++) {
      addBox(gxs[gb], 0.09, gzs[gb], 5.2, 0.03, 2.6, 0xffffff, trackRoot);
      addBox(gxs[gb], 0.1, gzs[gb], 4.6, 0.02, 0.12, 0x111111, trackRoot);
    }

    var gy = SF_Z - ASPHALT - 1.1;
    addBox(0, 6.4, gy, 12, 0.35, 0.35, 0x2a2018, trackRoot);
    addBox(-5.2, 5.1, gy, 0.3, 6.4, 0.3, 0x2a2018, trackRoot);
    addBox(5.2, 5.1, gy, 0.3, 6.4, 0.3, 0x2a2018, trackRoot);
    gantryBlues.push(addBox(-4.4, 6.55, gy, 1.1, 0.7, 0.4, 0x1a3040, trackRoot));
    gantryBlues.push(addBox(4.4, 6.55, gy, 1.1, 0.7, 0.4, 0x1a3040, trackRoot));
    for (var li = 0; li < 5; li++) {
      gantryReds.push(addBox(-2.4 + li * 1.2, 6.55, gy, 0.7, 0.7, 0.4, 0x3a1010, trackRoot));
    }

    function cornerFlag(x, z, title) {
      addBox(x, 1.4, z, 0.2, 2.8, 0.2, 0x2a2018, trackRoot);
      var pl = labelPlane(title, 7.4, 2.2, "#f4efe6", "#148f8c");
      pl.position.set(x, 3.2, z);
      trackRoot.add(pl);
    }
    function flagOn(name, title, side) {
      var s = 0;
      var i;
      for (i = 0; i < PATH.length; i++) {
        if (PATH[i].name === name) {
          s = PATH[i].startS + PATH[i].len * 0.55;
          break;
        }
      }
      var fp = centerlinePoint(s);
      var nx = -Math.sin(fp.h);
      var nz = Math.cos(fp.h);
      var flagOff = ASPHALT + RUNOFF + 2.3;
      cornerFlag(fp.x + nx * flagOff * side, fp.z + nz * flagOff * side, title);
    }
    flagOn("the90", "THE 90", -1);
    flagOn("chicane", "CHICANE", 1);
    flagOn("hairpin", "HAIRPIN", -1);
    flagOn("sweeper", "SWEEPER", 1);

    for (var st = 0; st < stampTrees.length; st++) {
      var tree = stampTrees[st];
      var trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.5, 3, 5),
        new THREE.MeshLambertMaterial({ color: 0x6a4020, side: THREE.DoubleSide })
      );
      trunk.position.set(tree.x, 1.5, tree.z);
      trackRoot.add(trunk);
      var leaf = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 4.6, 6),
        new THREE.MeshLambertMaterial({ color: 0x3f7a30, side: THREE.DoubleSide })
      );
      leaf.position.set(tree.x, 4.8, tree.z);
      trackRoot.add(leaf);
    }

    placeWalls();
    drawWalls();
  }

  function wallSeg(ax, az, bx, bz, thick, kind, silent) {
    if (Math.hypot(bx - ax, bz - az) < 0.8) return;
    WALLS.push({
      ax: ax,
      az: az,
      bx: bx,
      bz: bz,
      thick: thick || 0.55,
      kind: kind || "low",
      silent: !!silent,
    });
  }

  function skipLeftBarrier(p) {
    if (!PIT_META.on) return false;
    var nx = -Math.sin(p.h);
    var nz = Math.cos(p.h);
    var wx = p.x + nx * (ASPHALT + RUNOFF + 0.4);
    var wz = p.z + nz * (ASPHALT + RUNOFF + 0.4);
    if (onPitPavement(wx, wz) || inRect(wx, wz, PIT_LANE) || inRect(wx, wz, PIT_GRAB)) return true;
    var ix = p.x + nx * (ASPHALT + 1.6);
    var iz = p.z + nz * (ASPHALT + 1.6);
    return onPitPavement(ix, iz);
  }

  function wallKindFor(p, side) {
    if (p.name !== "hairpin" && p.name !== "chicane" && p.name !== "sweeper") return "low";
    var i;
    for (i = 0; i < PATH.length; i++) {
      var seg = PATH[i];
      if (seg.type !== "arc" || seg.name !== p.name) continue;
      var dx = p.x - seg.cx;
      var dz = p.z - seg.cz;
      if (Math.abs(Math.hypot(dx, dz) - seg.r) > 3) continue;
      var nx = -Math.sin(p.h);
      var nz = Math.cos(p.h);
      var insideLeft = -dx * nx + -dz * nz > 0;
      var outside = insideLeft ? -1 : 1;
      return side === outside ? "tall" : "low";
    }
    return "low";
  }

  function placeWalls() {
    WALLS.length = 0;
    var OFF = ASPHALT + RUNOFF + 0.38;
    var STEP = 7.6;
    var lastL = null;
    var lastR = null;
    var s;
    for (s = 0; s <= TRACK_LEN + 0.01; s += STEP) {
      var p = centerlinePoint(s);
      var nx = -Math.sin(p.h);
      var nz = Math.cos(p.h);
      var lx = p.x + nx * OFF;
      var lz = p.z + nz * OFF;
      var rx = p.x - nx * OFF;
      var rz = p.z - nz * OFF;
      var kL = wallKindFor(p, 1);
      var kR = wallKindFor(p, -1);
      if (!skipLeftBarrier(p)) {
        if (lastL) wallSeg(lastL.x, lastL.z, lx, lz, 0.5, lastL.kind, false);
        lastL = { x: lx, z: lz, kind: kL };
      } else {
        lastL = null;
      }
      if (lastR) wallSeg(lastR.x, lastR.z, rx, rz, 0.5, lastR.kind, false);
      lastR = { x: rx, z: rz, kind: kR };
    }
  }

  function drawWalls() {
    var vis = [];
    var i;
    for (i = 0; i < WALLS.length; i++) {
      if (!WALLS[i].silent) vis.push(WALLS[i]);
    }
    if (!vis.length) return;
    var n = vis.length;
    var box = new THREE.BoxGeometry(1, 1, 1);
    var matC = new THREE.MeshLambertMaterial({ color: 0xd2d6dc, emissive: 0x3e4248 });
    var matR = new THREE.MeshLambertMaterial({ color: 0x14161a });
    var matP = new THREE.MeshLambertMaterial({ color: 0x1a1c20 });
    var concrete = new THREE.InstancedMesh(box, matC, n);
    var railLo = new THREE.InstancedMesh(box, matR, n);
    var railHi = new THREE.InstancedMesh(box, matR, n);
    var posts = new THREE.InstancedMesh(box, matP, n);
    var dummy = new THREE.Object3D();
    function stamp(im, idx, x, y, z, sx, sy, sz, rotY) {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      im.setMatrixAt(idx, dummy.matrix);
    }
    for (i = 0; i < n; i++) {
      var w = vis[i];
      var dx = w.bx - w.ax;
      var dz = w.bz - w.az;
      var len = Math.hypot(dx, dz);
      var rotY = -Math.atan2(dz, dx);
      var mx = (w.ax + w.bx) * 0.5;
      var mz = (w.az + w.bz) * 0.5;
      var tall = w.kind === "tall";
      var ch = tall ? 1.28 : 0.9;
      var cd = tall ? 0.64 : 0.58;
      stamp(concrete, i, mx, ch * 0.5, mz, len, ch, cd, rotY);
      var r0 = ch + 0.16;
      var r1 = ch + (tall ? 0.5 : 0.38);
      stamp(railLo, i, mx, r0, mz, len * 0.98, 0.08, 0.08, rotY);
      stamp(railHi, i, mx, r1, mz, len * 0.98, 0.08, 0.08, rotY);
      stamp(posts, i, w.ax, (r1 + 0.06) * 0.5, w.az, 0.1, r1 + 0.06, 0.1, rotY);
    }
    concrete.instanceMatrix.needsUpdate = true;
    railLo.instanceMatrix.needsUpdate = true;
    railHi.instanceMatrix.needsUpdate = true;
    posts.instanceMatrix.needsUpdate = true;
    trackRoot.add(concrete);
    trackRoot.add(railLo);
    trackRoot.add(railHi);
    trackRoot.add(posts);
  }

  function addWorld() {
    scene.add(new THREE.HemisphereLight(0xffe6c4, 0x2c2a28, 0.52));
    var sun = new THREE.DirectionalLight(0xfff4dc, 1.55);
    sun.position.set(72, 58, -42);
    scene.add(sun);
    var shade = new THREE.DirectionalLight(0x3a5470, 0.2);
    shade.position.set(-55, 16, 48);
    scene.add(shade);

    addBox(-40, -0.2, 80, 1100, 0.4, 900, 0x6a655c);
    addTrackMesh();

    addBox(8, 4.2, SF_Z - 17, 36, 6.4, 7, 0x8a4030);
    addBox(8, 7.6, SF_Z - 17, 38, 0.8, 8, 0xd8b48a);
    for (var row = -2; row <= 2; row++) {
      addBox(8 + row * 6, 4.4, SF_Z - 14.2, 5, 0.16, 0.16, 0xf4efe6);
    }

    addBox(-8, 5.4, -32, 16, 10.8, 12, 0xb4532e);
    addBox(-8, 11.2, -32, 18, 1, 14, 0x8a3a22);
    addBox(28, 4.8, -36, 14, 9.6, 16, 0xa34628);
    addBox(28, 10, -36, 16, 0.9, 18, 0x7a301c);
    addBox(-36, 3.8, -28, 18, 7.6, 10, 0xc4683a);
    var grassMat = new THREE.MeshBasicMaterial({ color: 0x7aee58, side: THREE.DoubleSide });
    var hallFoot = [
      { x0: -17, x1: 1, z0: -39, z1: -25 },
      { x0: 20, x1: 36, z0: -45, z1: -27 },
      { x0: -45, x1: -27, z0: -33, z1: -23 },
      { x0: 3.8, x1: 12.2, z0: -32.2, z1: -23.8 },
      { x0: -10, x1: 26, z0: -101, z1: -93.5 },
      { x0: -59, x1: -37, z0: 89, z1: 103 },
    ];
    function campusQuad(x, z, w, d) {
      var x0 = x - w * 0.5;
      var x1 = x + w * 0.5;
      var z0 = z - d * 0.5;
      var z1 = z + d * 0.5;
      var i;
      for (i = 0; i < hallFoot.length; i++) {
        var b = hallFoot[i];
        if (x0 < b.x1 && x1 > b.x0 && z0 < b.z1 && z1 > b.z0) return;
      }
      if (onPitPavement(x, z) || onPitPavement(x0, z0) || onPitPavement(x1, z1)) return;
      var h = 0.48;
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), grassMat);
      mesh.position.set(x, 0.2 + h * 0.5, z);
      scene.add(mesh);
    }
    campusQuad(10.5, -40.5, 18, 15);
    campusQuad(-21.5, -30.5, 9, 13);
    campusQuad(58, -47, 40, 14);
    addBox(-48, 4.4, 96, 22, 8.8, 14, 0xa34628);
    addBox(-48, 9.2, 96, 24, 0.8, 16, 0x7a301c);

    var towerX = 8;
    var towerZ = -28;
    addBox(towerX, 11, towerZ, 7.2, 22, 7.2, 0x9a3f2a);
    addBox(towerX, 22.6, towerZ, 8.4, 1.4, 8.4, 0xd8b48a);
    addBox(towerX, 25.2, towerZ, 3.2, 4.2, 3.2, 0x8a3a22);
    addBox(towerX, 28.2, towerZ, 0.5, 2.4, 0.5, 0x2a2018);
    var clock = document.createElement("canvas");
    clock.width = 128;
    clock.height = 128;
    var cctx = clock.getContext("2d");
    cctx.fillStyle = "#f4efe6";
    cctx.beginPath();
    cctx.arc(64, 64, 58, 0, Math.PI * 2);
    cctx.fill();
    cctx.strokeStyle = "#2a2018";
    cctx.lineWidth = 6;
    cctx.stroke();
    cctx.beginPath();
    cctx.moveTo(64, 64);
    cctx.lineTo(64, 28);
    cctx.moveTo(64, 64);
    cctx.lineTo(92, 64);
    cctx.stroke();
    var clockTex = new THREE.CanvasTexture(clock);
    for (var f = 0; f < 2; f++) {
      var face = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 3.4),
        new THREE.MeshBasicMaterial({ map: clockTex, side: THREE.DoubleSide })
      );
      face.position.set(towerX + (f ? 3.65 : -3.65), 18.4, towerZ);
      face.rotation.y = f ? Math.PI * 0.5 : -Math.PI * 0.5;
      scene.add(face);
    }

    for (var t = 0; t < 14; t++) {
      var tx = -80 + (t % 7) * 36;
      var tz = t < 7 ? 210 : -130;
      var trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.5, 3, 5),
        new THREE.MeshLambertMaterial({ color: 0x6a4020, side: THREE.DoubleSide })
      );
      trunk.position.set(tx, 1.5, tz);
      scene.add(trunk);
      var leaf = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 4.6, 6),
        new THREE.MeshLambertMaterial({ color: 0x3f7a30, side: THREE.DoubleSide })
      );
      leaf.position.set(tx, 4.8, tz);
      scene.add(leaf);
    }

    addSkyBits();
  }

  function circuitLabel() {
    if (hud.circuit) {
      hud.circuit.textContent = trackCode ? "Custom · #7" : "Campus Loop · #7";
    }
  }

  function persistTrackCode() {
    try {
      if (trackCode) localStorage.setItem("sk_track", trackCode);
      else localStorage.removeItem("sk_track");
    } catch (e) {}
  }

  function applyTrack(code, persist, force) {
    code = cleanTrack(code);
    if (!force && code === trackCode && trackRoot) {
      if (persist !== false) persistTrackCode();
      if (net) net.track = trackCode;
      circuitLabel();
      paintTrackEditor();
      return;
    }
    trackCode = code;
    if (persist !== false) persistTrackCode();
    if (net) net.track = trackCode;
    rebuildPath(trackCode);
    bakeMini();
    addTrackMesh();
    resetGrid();
    circuitLabel();
    paintTrackEditor();
  }

  function restoreCampusLoop() {
    if (trackCode) pushTrackUndo();
    tilePick = "";
    tileSel = "";
    if (hud.trackPaste) hud.trackPaste.value = "";
    applyTrack("", true, true);
    if (net) {
      net.track = "";
      if (net.active && net.isHost() && net.setTrack) net.setTrack("");
    }
  }

  function maybeApplyNetTrack(code) {
    code = cleanTrack(code || "");
    if (code === trackCode) return;
    if (state === "start" || state === "racing") return;
    applyTrack(code, false);
  }

  function adoptRoomTrack() {
    if (!net) return;
    var code = cleanTrack(net.track || "");
    if (code === trackCode && trackRoot) return;
    trackCode = code;
    if (net) net.track = trackCode;
    rebuildPath(trackCode);
    bakeMini();
    addTrackMesh();
    circuitLabel();
    paintTrackEditor();
  }

  function restoreLocalTrack() {
    var st = "";
    try {
      st = localStorage.getItem("sk_track") || "";
    } catch (e) {}
    applyTrack(st, false);
  }

  var TILE_LABEL = {
    s: "straight",
    r: "90",
    H: "hairpin",
    C: "chicane",
    P: "pit",
    t: "tree",
  };
  var trackUndo = [];
  var tilePick = "";
  var tileSel = "";
  var editorDrag = null;
  var _tileArt = {};

  function tileArt(type, rot, size) {
    var key = type + rot + ":" + size;
    if (_tileArt[key]) return _tileArt[key];
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#5a564e";
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size * 0.5, size * 0.5);
    ctx.rotate((rot || 0) * Math.PI * 0.5);
    ctx.translate(-size * 0.5, -size * 0.5);
    function asphaltBand(x, y, w, h) {
      ctx.fillStyle = "#8d97a6";
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      ctx.fillStyle = "#3a3e46";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#ff2038";
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = "#fff6ee";
      ctx.fillRect(x, y + h - 3, w, 3);
    }
    if (type === "t") {
      ctx.fillStyle = "#6a4020";
      ctx.fillRect(size * 0.44, size * 0.48, size * 0.12, size * 0.28);
      ctx.fillStyle = "#4ea03c";
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.4, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === "r") {
      asphaltBand(size * 0.5, size * 0.36, size * 0.5, size * 0.28);
      asphaltBand(size * 0.36, size * 0.5, size * 0.28, size * 0.5);
    } else if (type === "H") {
      ctx.strokeStyle = "#8d97a6";
      ctx.lineWidth = size * 0.36;
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.58, size * 0.28, Math.PI, 0);
      ctx.stroke();
      ctx.strokeStyle = "#3a3e46";
      ctx.lineWidth = size * 0.22;
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.58, size * 0.28, Math.PI, 0);
      ctx.stroke();
    } else if (type === "C") {
      ctx.strokeStyle = "#8d97a6";
      ctx.lineWidth = size * 0.34;
      ctx.beginPath();
      ctx.moveTo(0, size * 0.38);
      ctx.bezierCurveTo(size * 0.35, size * 0.1, size * 0.65, size * 0.9, size, size * 0.62);
      ctx.stroke();
      ctx.strokeStyle = "#3a3e46";
      ctx.lineWidth = size * 0.2;
      ctx.beginPath();
      ctx.moveTo(0, size * 0.38);
      ctx.bezierCurveTo(size * 0.35, size * 0.1, size * 0.65, size * 0.9, size, size * 0.62);
      ctx.stroke();
    } else {
      asphaltBand(0, size * 0.36, size, size * 0.28);
      if (type === "P") {
        ctx.fillStyle = "#2ec8c3";
        ctx.fillRect(size * 0.28, size * 0.12, size * 0.44, size * 0.2);
      }
    }
    ctx.restore();
    _tileArt[key] = c.toDataURL();
    return _tileArt[key];
  }

  function paintTrackEditor() {
    if (!hud.trackView) return;
    hud.trackView.textContent = trackCode || "Campus Loop";
    if (hud.trackPaste && document.activeElement !== hud.trackPaste) {
      hud.trackPaste.value = trackCode;
    }
    if (hud.tilePalette) {
      var pal = hud.tilePalette.querySelectorAll("[data-tile]");
      var pi;
      for (pi = 0; pi < pal.length; pi++) {
        var pt = pal[pi].getAttribute("data-tile");
        pal[pi].classList.toggle("picked", pt === tilePick);
        pal[pi].style.backgroundImage = "url(" + tileArt(pt, 0, 72) + ")";
        pal[pi].textContent = "";
        pal[pi].setAttribute("aria-label", TILE_LABEL[pt] || pt);
      }
    }
    if (!hud.tileBoard) return;
    var by = {};
    var pieces = parseMap(trackCode);
    var i;
    for (i = 0; i < pieces.length; i++) by[mapKey(pieces[i].x, pieces[i].y)] = pieces[i];
    var html = "";
    var y;
    var x;
    for (y = 0; y < MAP_H; y++) {
      for (x = 0; x < MAP_W; x++) {
        var k = mapKey(x, y);
        var p = by[k];
        var sel = tileSel === k;
        if (p) {
          html +=
            '<div class="tile-cell' +
            (sel ? " picked" : "") +
            '" data-x="' +
            x +
            '" data-y="' +
            y +
            '" data-tile="' +
            p.t +
            '" data-rot="' +
            p.r +
            '" role="button" tabindex="0" style="background-image:url(' +
            tileArt(p.t, p.r, 72) +
            ')"></div>';
        } else {
          html +=
            '<div class="tile-cell empty" data-x="' +
            x +
            '" data-y="' +
            y +
            '" role="button" tabindex="0"></div>';
        }
      }
    }
    if (trackCode && trackCode.charAt(0) !== "M") {
      html += '<div class="board-empty">Stamp code · Default Campus Loop or drop a piece</div>';
    } else if (!pieces.length) {
      html += '<div class="board-empty">Campus Loop · drop a piece</div>';
    }
    hud.tileBoard.innerHTML = html;
    if (hud.tileRot) hud.tileRot.disabled = !tileSel;
  }

  function pushTrackUndo() {
    trackUndo.push(trackCode);
    if (trackUndo.length > 40) trackUndo.shift();
  }

  function commitTrack(next) {
    next = cleanTrack(next);
    if (next === trackCode) {
      paintTrackEditor();
      return;
    }
    pushTrackUndo();
    applyTrack(next, true);
    if (net && net.active && net.isHost() && net.setTrack) net.setTrack(trackCode);
  }

  function placePiece(t, x, y, r) {
    if (!MAP_TYPES[t] || x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
    var pieces = parseMap(trackCode).filter(function (p) {
      return !(p.x === x && p.y === y);
    });
    pieces.push({ t: t, x: x, y: y, r: r || 0 });
    tileSel = mapKey(x, y);
    commitTrack(encodeMap(pieces));
  }

  function movePiece(x0, y0, x1, y1) {
    if (x0 === x1 && y0 === y1) return;
    var pieces = parseMap(trackCode);
    var moving = null;
    var occ = null;
    var i;
    for (i = 0; i < pieces.length; i++) {
      if (pieces[i].x === x0 && pieces[i].y === y0) moving = pieces[i];
      if (pieces[i].x === x1 && pieces[i].y === y1) occ = pieces[i];
    }
    if (!moving) return;
    if (occ) {
      occ.x = x0;
      occ.y = y0;
    }
    moving.x = x1;
    moving.y = y1;
    tileSel = mapKey(x1, y1);
    commitTrack(encodeMap(pieces));
  }

  function deletePiece(x, y) {
    var next = encodeMap(
      parseMap(trackCode).filter(function (p) {
        return !(p.x === x && p.y === y);
      })
    );
    if (tileSel === mapKey(x, y)) tileSel = "";
    commitTrack(next);
  }

  function rotatePiece(x, y) {
    var pieces = parseMap(trackCode);
    var i;
    for (i = 0; i < pieces.length; i++) {
      if (pieces[i].x === x && pieces[i].y === y) {
        pieces[i].r = (pieces[i].r + 1) & 3;
        tileSel = mapKey(x, y);
        commitTrack(encodeMap(pieces));
        return;
      }
    }
  }

  function rotateSelected() {
    if (!tileSel) return;
    var p = tileSel.split(",");
    rotatePiece(+p[0], +p[1]);
  }

  var sky = {
    blimp: null,
    plane: null,
    trail: null,
    trailPos: null,
    t: 0,
    planeU: -1,
    planeWait: 6,
    planeLap: 0,
    from: null,
    to: null,
  };

  function skyMat(color) {
    return new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
  }

  function skyExtrude(shape, thick, mat) {
    return new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, steps: 1 }),
      mat
    );
  }

  function blimpLetterTex() {
    var c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#148f8c";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.save();
    ctx.translate(1024, 0);
    ctx.scale(-1, 1);
    ctx.font = "bold 168px Trebuchet MS, Impact, Arial Black, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = "#0a2f2e";
    ctx.lineWidth = 18;
    ctx.strokeText("LIAM IS COOL", 512, 138);
    ctx.fillStyle = "#f4efe6";
    ctx.fillText("LIAM IS COOL", 512, 138);
    ctx.restore();
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  function makeBlimpMesh() {
    var g = new THREE.Group();
    var hullPts = [
      new THREE.Vector2(0.02, 11.2),
      new THREE.Vector2(1.8, 9.4),
      new THREE.Vector2(3.4, 6.6),
      new THREE.Vector2(4.5, 3.2),
      new THREE.Vector2(4.85, 0.2),
      new THREE.Vector2(4.35, -3.0),
      new THREE.Vector2(3.1, -6.0),
      new THREE.Vector2(1.6, -8.6),
      new THREE.Vector2(0.6, -10.8),
      new THREE.Vector2(0.02, -12.0),
    ];
    var hull = new THREE.Mesh(new THREE.LatheGeometry(hullPts, 10), skyMat(0x2ec8c3));
    hull.rotation.z = -Math.PI * 0.5;
    g.add(hull);
    var bandPts = [
      new THREE.Vector2(4.7, 1.5),
      new THREE.Vector2(5.05, 0.5),
      new THREE.Vector2(5.05, -0.6),
      new THREE.Vector2(4.7, -1.55),
    ];
    var band = new THREE.Mesh(new THREE.LatheGeometry(bandPts, 10), skyMat(0xf4efe6));
    band.rotation.z = -Math.PI * 0.5;
    g.add(band);

    var finShape = new THREE.Shape();
    finShape.moveTo(0.15, 0);
    finShape.lineTo(-5.1, 0.45);
    finShape.lineTo(-1.8, 5.4);
    finShape.closePath();
    var finMat = skyMat(0xff2d8a);
    function addFin(roll) {
      var fin = skyExtrude(finShape, 0.28, finMat);
      fin.position.set(-10.2, 0, -0.14);
      fin.rotation.x = roll;
      g.add(fin);
    }
    addFin(0);
    addFin(Math.PI);
    addFin(Math.PI * 0.5);
    addFin(-Math.PI * 0.5);

    var letterTex = blimpLetterTex();
    var letterMat = new THREE.MeshBasicMaterial({ map: letterTex, side: THREE.DoubleSide });
    var letterA = new THREE.Mesh(new THREE.PlaneGeometry(17.6, 4.6), letterMat);
    letterA.position.set(0.4, 0.15, 5.15);
    g.add(letterA);
    var letterB = letterA.clone();
    letterB.position.z = -5.15;
    letterB.rotation.y = Math.PI;
    g.add(letterB);

    var gond = new THREE.Group();
    var cabin = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.92, 4.0, 7), skyMat(0xf4efe6));
    cabin.rotation.z = Math.PI * 0.5;
    gond.add(cabin);
    var cabinNose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 6, 4), skyMat(0xf4efe6));
    cabinNose.position.x = 2.0;
    gond.add(cabinNose);
    var cabinTail = new THREE.Mesh(new THREE.SphereGeometry(0.92, 6, 4), skyMat(0xf4efe6));
    cabinTail.position.x = -2.0;
    gond.add(cabinTail);
    var windowMat = skyMat(0x1a3040);
    var w;
    for (w = -1; w <= 1; w++) {
      var pane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), windowMat);
      pane.position.set(w * 0.95, 0.1, 0.88);
      gond.add(pane);
    }
    var strutL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 4), skyMat(0x2a2018));
    strutL.position.set(0.8, 1.15, 0.35);
    gond.add(strutL);
    var strutR = strutL.clone();
    strutR.position.z = -0.35;
    gond.add(strutR);
    gond.position.set(1.8, -5.6, 0);
    g.add(gond);
    g.scale.setScalar(2.55);
    return g;
  }

  function makePlaneMesh() {
    var g = new THREE.Group();
    var body = skyMat(0xff2d8a);
    var paint = skyMat(0xf4efe6);
    var fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.88, 7.2, 8), paint);
    fuse.rotation.z = Math.PI * 0.5;
    g.add(fuse);
    var nose = new THREE.Mesh(new THREE.ConeGeometry(0.88, 2.4, 8), body);
    nose.rotation.z = -Math.PI * 0.5;
    nose.position.x = 4.75;
    g.add(nose);
    var tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.78, 2.1, 8), paint);
    tailCone.rotation.z = Math.PI * 0.5;
    tailCone.position.x = -4.6;
    g.add(tailCone);
    var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 4), skyMat(0x7ee0ff));
    canopy.scale.set(1.7, 0.78, 0.82);
    canopy.position.set(1.35, 0.72, 0);
    g.add(canopy);

    var wingSh = new THREE.Shape();
    wingSh.moveTo(0.7, 0);
    wingSh.lineTo(-0.85, 7.4);
    wingSh.lineTo(1.7, 7.4);
    wingSh.lineTo(2.5, 0);
    wingSh.closePath();
    var wingR = skyExtrude(wingSh, 0.22, paint);
    wingR.rotation.x = -Math.PI * 0.5;
    wingR.position.set(0.2, 0.11, 0);
    g.add(wingR);
    var wingL = wingR.clone();
    wingL.scale.z = -1;
    g.add(wingL);

    var stabSh = new THREE.Shape();
    stabSh.moveTo(0.2, 0);
    stabSh.lineTo(-0.45, 2.5);
    stabSh.lineTo(1.0, 2.5);
    stabSh.lineTo(1.35, 0);
    stabSh.closePath();
    var stabR = skyExtrude(stabSh, 0.16, paint);
    stabR.rotation.x = -Math.PI * 0.5;
    stabR.position.set(-3.7, 0.2, 0);
    g.add(stabR);
    var stabL = stabR.clone();
    stabL.scale.z = -1;
    g.add(stabL);

    var vSh = new THREE.Shape();
    vSh.moveTo(0.15, 0);
    vSh.lineTo(-1.85, 0.2);
    vSh.lineTo(-0.25, 2.8);
    vSh.closePath();
    var vFin = skyExtrude(vSh, 0.18, body);
    vFin.position.set(-3.85, 0.25, -0.09);
    g.add(vFin);

    g.scale.setScalar(2.85);
    return g;
  }

  function addSkyBits() {
    sky.blimp = makeBlimpMesh();
    scene.add(sky.blimp);
    sky.plane = makePlaneMesh();
    sky.plane.visible = false;
    scene.add(sky.plane);

    sky.trailPos = new Float32Array(14 * 3);
    var trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(sky.trailPos, 3));
    sky.trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0.72 })
    );
    sky.trail.visible = false;
    sky.trail.frustumCulled = false;
    scene.add(sky.trail);
  }

  function launchPlane() {
    // Cross the circuit in front of the chase cam — not a horizon speck.
    var north = Math.random() > 0.5;
    var x = 70 + Math.random() * 90;
    if (north) {
      sky.from = new THREE.Vector3(x - 20, 28, -190);
      sky.to = new THREE.Vector3(x + 40, 34, 170);
    } else {
      sky.from = new THREE.Vector3(x + 40, 30, 175);
      sky.to = new THREE.Vector3(x - 20, 34, -185);
    }
    sky.planeU = 0;
    sky.plane.visible = true;
    sky.trail.visible = true;
    paintPlaneTrail(0);
  }

  function paintPlaneTrail(u) {
    var dx = sky.to.x - sky.from.x;
    var dy = sky.to.y - sky.from.y;
    var dz = sky.to.z - sky.from.z;
    var ph = Math.atan2(dz, dx);
    var n = sky.trailPos.length / 3;
    var i;
    for (i = 0; i < n; i++) {
      var tu = u - i * 0.02;
      if (tu < 0) tu = 0;
      sky.trailPos[i * 3] = sky.from.x + dx * tu - Math.cos(ph) * 7.2;
      sky.trailPos[i * 3 + 1] = sky.from.y + dy * tu;
      sky.trailPos[i * 3 + 2] = sky.from.z + dz * tu - Math.sin(ph) * 7.2;
    }
    sky.trail.geometry.attributes.position.needsUpdate = true;
  }

  function updateSky(dt) {
    sky.t += dt;
    if (sky.blimp) {
      var a = sky.t * 0.06;
      var bx = -20 + Math.cos(a) * 118;
      var bz = -8 + Math.sin(a) * 72;
      var by = 32 + Math.sin(a * 2.1) * 2;
      sky.blimp.position.set(bx, by, bz);
      sky.blimp.rotation.set(0, -a - Math.PI * 0.5, Math.sin(a) * 0.05);
    }
    if (!sky.plane) return;
    if (sky.planeU < 0) {
      if (state === "racing" && !player.finished) {
        if (
          sky.planeLap !== player.lap &&
          player.z < SF_Z + 16 &&
          player.z > SF_Z - 16 &&
          player.x > -90 &&
          Math.cos(player.heading) > 0.35
        ) {
          launchPlane();
          sky.planeLap = player.lap;
        }
      } else if (state === "title" || state === "lobby") {
        sky.planeWait -= dt;
        if (sky.planeWait <= 0) {
          launchPlane();
          sky.planeWait = 18 + Math.random() * 10;
        }
      }
      return;
    }
    sky.planeU += dt / 9.5;
    if (sky.planeU >= 1) {
      sky.planeU = -1;
      sky.plane.visible = false;
      sky.trail.visible = false;
      return;
    }
    var u = sky.planeU;
    var px = sky.from.x + (sky.to.x - sky.from.x) * u;
    var py = sky.from.y + (sky.to.y - sky.from.y) * u;
    var pz = sky.from.z + (sky.to.z - sky.from.z) * u;
    sky.plane.position.set(px, py, pz);
    sky.plane.rotation.set(0, -Math.atan2(sky.to.z - sky.from.z, sky.to.x - sky.from.x), 0);
    paintPlaneTrail(u);
  }

  function numberDecal(n) {
    var c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#148f8c";
    ctx.fillRect(0, 0, 64, 64);
    ctx.save();
    ctx.translate(64, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 46px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), 32, 34);
    ctx.restore();
    return new THREE.CanvasTexture(c);
  }

  function carMat(color, glow) {
    return new THREE.MeshLambertMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: glow == null ? 0.06 : glow,
      side: THREE.DoubleSide,
    });
  }

  function makeCar(bodyColor, wingColor, num) {
    var g = new THREE.Group();
    var accent = wingColor || TEAL_DEEP;
    var body = carMat(bodyColor, 0.07);
    var wing = carMat(accent, 0.05);
    var halo = carMat(0xf4efe6, 0.1);
    body.userData.part = "body";
    wing.userData.part = "wing";

    var nose = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.22, 0.34), body);
    nose.position.set(1.85, 0.34, 0);
    g.add(nose);
    var tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.2), body);
    tip.position.set(3.15, 0.3, 0);
    g.add(tip);
    var tub = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.38, 0.62), body);
    tub.position.set(0.15, 0.42, 0);
    g.add(tub);
    var cover = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.36, 0.52), body);
    cover.position.set(-1.05, 0.5, 0);
    g.add(cover);
    var airbox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.36, 0.28), body);
    airbox.position.set(-0.55, 0.84, 0);
    g.add(airbox);
    var podL = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.32, 0.42), body);
    podL.position.set(-0.15, 0.36, 0.58);
    g.add(podL);
    var podR = podL.clone();
    podR.position.z = -0.58;
    g.add(podR);
    var inletL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.3), wing);
    inletL.position.set(0.55, 0.4, 0.58);
    g.add(inletL);
    var inletR = inletL.clone();
    inletR.position.z = -0.58;
    g.add(inletR);

    var fw = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 2.05), wing);
    fw.position.set(3.35, 0.18, 0);
    g.add(fw);
    var fw2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 1.7), wing);
    fw2.position.set(3.12, 0.26, 0);
    g.add(fw2);
    var endL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.08), wing);
    endL.position.set(3.32, 0.28, 1.02);
    g.add(endL);
    var endR = endL.clone();
    endR.position.z = -1.02;
    g.add(endR);
    var rw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 1.62), wing);
    rw.position.set(-1.95, 1.02, 0);
    g.add(rw);
    var rw2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 1.35), wing);
    rw2.position.set(-1.95, 1.12, 0);
    g.add(rw2);
    var pylonL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.07), wing);
    pylonL.position.set(-1.95, 0.72, 0.78);
    g.add(pylonL);
    var pylonR = pylonL.clone();
    pylonR.position.z = -0.78;
    g.add(pylonR);

    if (num) {
      var tex = numberDecal(num);
      var side = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 0.4),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
      );
      side.position.set(-0.15, 0.52, 0.8);
      g.add(side);
      var side2 = side.clone();
      side2.position.z = -0.8;
      side2.rotation.y = Math.PI;
      g.add(side2);
      var rear = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.32),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
      );
      rear.position.set(-1.96, 1.02, 0);
      rear.rotation.y = Math.PI * 0.5;
      g.add(rear);
    }

    var haloM = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.048, 6, 10, Math.PI), halo);
    haloM.rotation.x = Math.PI * 0.5;
    haloM.rotation.z = Math.PI * 0.5;
    haloM.position.set(0.2, 0.8, 0);
    g.add(haloM);

    var wheels = [];
    var spots = [
      [1.35, 0.28, 0.82, true],
      [1.35, 0.28, -0.82, true],
      [-1.25, 0.3, 0.86, false],
      [-1.25, 0.3, -0.86, false],
    ];
    var rubber = carMat(0x1a1a1a, 0.02);
    var sidewall = carMat(0xf2e6cc, 0.08);
    var rim = carMat(0xfff6e8, 0.12);
    for (var i = 0; i < spots.length; i++) {
      var holder = new THREE.Group();
      holder.position.set(spots[i][0], spots[i][1], spots[i][2]);
      var spinner = new THREE.Group();
      holder.add(spinner);
      var mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.26, 10), rubber);
      mesh.rotation.x = Math.PI * 0.5;
      spinner.add(mesh);
      var wall = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 6, 10), sidewall);
      spinner.add(wall);
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 8), rim);
      disc.rotation.x = Math.PI * 0.5;
      spinner.add(disc);
      var spoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), rim);
      spinner.add(spoke);
      g.add(holder);
      wheels.push({ holder: holder, spinner: spinner, front: spots[i][3] });
    }

    var blob = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 10),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    blob.rotation.x = -Math.PI * 0.5;
    blob.position.y = 0.03;
    g.add(blob);
    g.userData.wheels = wheels;
    g.userData.bodyMat = body;
    g.userData.wingMat = wing;
    return g;
  }

  function paintCar(mesh, bodyHex, wingHex) {
    if (!mesh || !mesh.userData) return;
    if (mesh.userData.bodyMat && bodyHex != null) {
      mesh.userData.bodyMat.color.setHex(bodyHex);
      mesh.userData.bodyMat.emissive.setHex(bodyHex);
    }
    if (mesh.userData.wingMat && wingHex != null) {
      mesh.userData.wingMat.color.setHex(wingHex);
      mesh.userData.wingMat.emissive.setHex(wingHex);
    }
  }

  function createRacer(kind, color, name, num, wing) {
    var wcol = wing != null ? wing : kind === "player" ? playerWing : 0x1a1a1a;
    var mesh = makeCar(color, wcol, num);
    scene.add(mesh);
    var racer = {
      kind: kind,
      name: name,
      mesh: mesh,
      x: 0,
      z: 0,
      heading: 0,
      speed: 0,
      slide: 0,
      fuel: 100,
      tires: 100,
      lap: 1,
      passedHalf: false,
      lastX: 0,
      s: 0,
      brakeHold: 0,
      finished: false,
      finishTime: 0,
    };
    attachNameTag(racer);
    return racer;
  }

  function playerTagLabel() {
    var raw = hud.nameInput ? String(hud.nameInput.value || "").replace(/[<>]/g, "").trim() : "";
    if (!raw) return "YOU";
    return cleanName(raw);
  }

  function tagLabel(r) {
    if (!r) return "YOU";
    if (r.kind === "player") return playerTagLabel();
    var n = String(r.name || "").trim();
    return n || (r.kind === "cpu" ? "CPU" : "YOU");
  }

  function attachNameTag(r) {
    var c = document.createElement("canvas");
    c.width = 384;
    c.height = 80;
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    var spr = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    // Sit above the halo (~0.8) so the chase cam can read it.
    spr.position.set(0, 2.62, 0);
    spr.scale.set(3.3, 0.82, 1);
    spr.renderOrder = 4;
    spr.userData.canvas = c;
    spr.userData.label = "";
    r.mesh.add(spr);
    r.tag = spr;
    paintNameTag(r);
  }

  function paintNameTag(r) {
    if (!r || !r.tag) return;
    var t = tagLabel(r).slice(0, 14);
    if (r.tag.userData.label === t) return;
    r.tag.userData.label = t;
    var c = r.tag.userData.canvas;
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 384, 80);
    ctx.fillStyle = r.kind === "player" ? "rgba(20,143,140,0.9)" : "rgba(16,10,8,0.84)";
    ctx.fillRect(16, 18, 352, 46);
    ctx.font = "bold 36px Trebuchet MS, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(8,6,4,0.95)";
    ctx.lineWidth = 6;
    ctx.fillStyle = "#f4efe6";
    ctx.strokeText(t, 192, 42);
    ctx.fillText(t, 192, 42);
    r.tag.material.map.needsUpdate = true;
  }

  function layoutNameTags() {
    var cam = camera.position;
    function one(r) {
      if (!r || !r.tag) return;
      var on = !!(r.mesh && r.mesh.visible);
      r.tag.visible = on;
      if (!on) return;
      var dist = Math.hypot(r.x - cam.x, 2.62 - cam.y, r.z - cam.z);
      var w = 3.25;
      var h = 0.82;
      if (dist < 6.2) {
        var close = (6.2 - dist) / 3.4;
        if (close > 1) close = 1;
        w *= 1 - 0.28 * close;
        h *= 1 - 0.28 * close;
      } else if (dist > 32) {
        var far = (dist - 32) / 50;
        if (far > 1) far = 1;
        w *= 1 - 0.38 * far;
        h *= 1 - 0.38 * far;
        r.tag.material.opacity = 1 - 0.62 * far;
      } else {
        r.tag.material.opacity = 1;
      }
      r.tag.scale.set(w, h, 1);
    }
    one(player);
    if (!mpMode) {
      one(cpus[0]);
      one(cpus[1]);
    }
    Object.keys(remotes).forEach(function (id) {
      one(remotes[id].r);
    });
    Object.keys(hostBots).forEach(function (id) {
      one(hostBots[id]);
    });
  }

  var player = createRacer("player", playerBody, "House 7", 7, playerWing);
  var cpus = [
    createRacer("cpu", 0xd4a017, "BowieKnife99", 12),
    createRacer("cpu", 0xb4532e, "Hall Monitor", 21),
  ];

  function resetRacer(r, x, z, heading, s) {
    r.x = x;
    r.z = z;
    r.heading = heading;
    r.speed = 0;
    r.slide = 0;
    r.fuel = 100;
    r.tires = 100;
    r.lap = 1;
    r.passedHalf = false;
    r.lastX = x;
    r.s = s;
    r.lastS = s;
    r.brakeHold = 0;
    r.finished = false;
    r.finishTime = 0;
    r.wantPit = false;
    r.didPit = false;
    r.pitServicing = false;
    r.pitTimer = 0;
    r.pitUsedVisit = false;
    r.launchMul = 1;
    r.launchT = 0;
    r.launchArmed = false;
    r.aiT = 0;
    r.mesh.position.set(x, 0, z);
    r.mesh.rotation.set(0, -heading, 0);
  }

  function resetGrid() {
    resetRacer(player, playerGridX, playerGridZ, 0, TRACK_LEN - 14);
    resetRacer(cpus[0], -6, SF_Z + 2.7, 0, TRACK_LEN - 6);
    resetRacer(cpus[1], -22, SF_Z + 2.7, 0, TRACK_LEN - 22);
    cpus[0].mesh.visible = !mpMode;
    cpus[1].mesh.visible = !mpMode;
    raceTime = 0;
    didPit = false;
    pitTimer = 0;
    pitFlash = 0;
    pitUsedVisit = false;
    pitServicing = false;
    revs = 0;
    launchMul = 1;
    launchT = 0;
    launchCall = "";
    launchCallT = 0;
    startPhase = "prestart";
    startT = 2;
    redsOn = 0;
    holdDelay = 0.2 + Math.random() * 2.8;
    sky.planeLap = 0;
  }

  function inPitLane(r) {
    if (trackCode) return PIT_META.on && (inRect(r.x, r.z, PIT_LANE) || onPitPavement(r.x, r.z));
    var leftOfRace = SF_Z + ASPHALT + 1;
    return (
      inRect(r.x, r.z, PIT_LANE) ||
      (r.x >= PIT_LANE.x0 - 4 &&
        r.x <= PIT_LANE.x1 + 8 &&
        r.z > leftOfRace &&
        r.z < PIT_LANE.z1 + 3)
    );
  }

  function inPitGrab(r) {
    if (trackCode) {
      if (!PIT_META.on || !onPitPavement(r.x, r.z)) return false;
      var dx = PIT_META.bx - PIT_META.ax;
      var dz = PIT_META.bz - PIT_META.az;
      var len2 = dx * dx + dz * dz || 1;
      var t = ((r.x - PIT_META.ax) * dx + (r.z - PIT_META.az) * dz) / len2;
      return t >= 0.5 && t <= 1.15;
    }
    var mid = (PIT_LANE.x0 + PIT_LANE.x1) * 0.5;
    var leftOfRace = SF_Z + ASPHALT + 1.2;
    // Off the racing line, into the LEFT split, past halfway — that is the box.
    return r.x >= mid && r.x <= PIT_LANE.x1 + 10 && r.z > leftOfRace && r.z < PIT_LANE.z1 + 4;
  }

  function updateLaps(r) {
    if (r.finished) return;
    if (trackCode) {
      var prev = r.lastS != null ? r.lastS : r.s;
      if (prev < TRACK_LEN * 0.5 && r.s >= TRACK_LEN * 0.5) r.passedHalf = true;
      if (r.passedHalf && prev > TRACK_LEN * 0.72 && r.s < TRACK_LEN * 0.28) {
        r.passedHalf = false;
        r.lap += 1;
        if (r.lap > LAPS) {
          r.finished = true;
          r.finishTime = raceTime;
          r.lap = LAPS;
        }
      }
      r.lastS = r.s;
      r.lastX = r.x;
      return;
    }
    if (r.z > 8 && r.lastX > 8 && r.x <= 8 && Math.cos(r.heading) < -0.15) {
      r.passedHalf = true;
    }
    if (
      r.z < SF_Z + ASPHALT + 3 &&
      r.z > SF_Z - ASPHALT - 4 &&
      r.lastX < 0 &&
      r.x >= 0 &&
      Math.cos(r.heading) > 0.25 &&
      r.passedHalf
    ) {
      r.passedHalf = false;
      r.lap += 1;
      if (r.lap > LAPS) {
        r.finished = true;
        r.finishTime = raceTime;
        r.lap = LAPS;
      }
    }
    r.lastX = r.x;
  }

  function applyMotion(r, steer, throttle, brake, reverse, dt, isPlayer) {
    var info = projectTrack(r.x, r.z);
    var surface = info.grass ? 0.5 : 1;
    var tire = clamp(r.tires / 100, 0, 1);
    // Tires = sloppy handling on asphalt, never a speed cap. Grass keeps
    // enough steer to crawl back to the pit even when the rears are gone.
    var tireFeel = info.grass ? 0.85 : 0.38 + 0.62 * tire;
    var empty = r.fuel <= 0;
    var maxV = empty ? LIMP_SPEED : MAX_SPEED;
    var accel = empty ? LIMP_ACCEL : ACCEL;
    if (isPlayer && state === "racing" && raceTime > GETAWAY_T) {
      launchT = 0;
      launchMul = 1;
    }
    if (isPlayer && launchT > 0 && r.speed < 20) accel *= launchMul;
    else if (isPlayer) {
      launchMul = 1;
      if (r.speed >= 20) launchT = 0;
    } else {
      if (state === "racing" && raceTime > GETAWAY_T) {
        r.launchT = 0;
        r.launchMul = 1;
      }
      if (r.launchT > 0 && r.speed < 20) accel *= r.launchMul || 1;
      else if (r.speed >= 20) r.launchT = 0;
    }

    if (state === "racing") {
      r.fuel -= IDLE_FUEL * dt;
      if (throttle && !empty && r.speed >= 0) r.fuel -= THROTTLE_FUEL * dt;
      if (r.fuel < 0) r.fuel = 0;
    }

    if (brake) {
      r.brakeHold = Math.min(1, (r.brakeHold || 0) + dt / 0.2);
      var v01 = clamp(Math.abs(r.speed) / MAX_SPEED, 0, 1);
      // Modulate: tap/wind-out is a squeeze. Hairpin speed still bites.
      var decel = BRAKE_DECEL * (0.4 + 0.6 * r.brakeHold) * (1.16 - 0.5 * v01);
      if (r.speed > 0) r.speed -= decel * dt;
      else if (r.speed < 0) r.speed += decel * dt;
      if (Math.abs(r.speed) < 0.35) r.speed = 0;
    } else if (throttle) {
      r.brakeHold = 0;
      r.speed += accel * dt;
    } else if (reverse) {
      r.brakeHold = 0;
      r.speed -= REVERSE_ACCEL * dt;
    } else if (r.speed > 0) {
      r.brakeHold = 0;
      r.speed -= COAST * dt;
      if (r.speed < 0) r.speed = 0;
    } else if (r.speed < 0) {
      r.brakeHold = 0;
      r.speed += COAST * dt;
      if (r.speed > 0) r.speed = 0;
    } else {
      r.brakeHold = 0;
    }

    if (info.grass) {
      if (r.speed > GRASS_MAX) {
        r.speed -= GRASS_DUMP * dt;
        if (r.speed < GRASS_MAX) r.speed = GRASS_MAX;
      }
      if (r.speed < -GRASS_MAX) r.speed = -GRASS_MAX;
      if (r.speed > 0 && r.speed < GRASS_ROLL) r.speed = GRASS_ROLL;
      if (r.speed > 0) r.tires -= 6.2 * dt;
    } else if (r.speed >= 0) {
      r.speed = clamp(r.speed, 0, maxV);
    } else {
      r.speed = clamp(r.speed, -REVERSE_MAX, 0);
    }

    var speed01 = Math.abs(r.speed) / MAX_SPEED;
    var steerScale = 1 - 0.58 * speed01;
    var maxYaw = STEER_RATE * steerScale * tireFeel * surface;
    var latDemand = Math.abs(steer) * Math.abs(r.speed) * 0.155;
    var maxLat = MAX_LAT * tireFeel * surface;
    if (info.name === "hairpin" && !info.grass) {
      var hpOk = 17;
      if (r.speed > hpOk) {
        var over = (r.speed - hpOk) / 14;
        maxYaw *= 1 / (1 + over * 5);
        r.slide += (steer !== 0 ? steer : 1) * over * 22 * dt;
        if (over > 0.3) r.tires -= 2.8 * dt * over;
      }
    }
    if (latDemand > maxLat && Math.abs(steer) > 0.05) {
      var slip = (latDemand - maxLat) / Math.max(6, maxLat);
      maxYaw *= 1 / (1 + slip * 2.1);
      r.slide += steer * slip * 12 * dt;
      r.tires -= 3.6 * dt * (0.4 + slip);
    } else if (Math.abs(steer) > 0.45 && r.speed > 22) {
      r.tires -= 0.85 * dt * speed01;
    }
    if (r.tires < TIRE_FLOOR) r.tires = TIRE_FLOOR;
    if (tire < 0.45) r.slide += (Math.random() - 0.5) * 4.2 * dt;
    if (info.kerb) {
      var dive = Math.abs(r.speed) / 36;
      var bite = clamp((info.dist - (ASPHALT - 0.2)) / 1.1, 0.18, 1);
      var wob = bite * dive;
      r.slide += Math.sin((raceTime + r.x * 0.05) * 28) * 14 * wob * dt;
      r.heading += Math.sin((raceTime + r.z * 0.04) * 17) * 0.7 * wob * dt;
    }

    r.heading += steer * maxYaw * dt * (r.speed < 0 ? -1 : 1);
    r.x += Math.cos(r.heading) * r.speed * dt;
    r.z += Math.sin(r.heading) * r.speed * dt;
    r.x += -Math.sin(r.heading) * r.slide * dt;
    r.z += Math.cos(r.heading) * r.slide * dt;
    r.slide *= Math.pow(0.07, dt);

    r.mesh.position.set(r.x, 0, r.z);
    r.mesh.rotation.set(0, -r.heading, 0);
    r.mesh.rotation.x = 0;
    r.mesh.rotation.z = 0;
    var wheels = r.mesh.userData.wheels;
    if (wheels) {
      var spin = r.speed * dt * 2.4;
      var turn = steer * 0.42;
      for (var i = 0; i < wheels.length; i++) {
        wheels[i].spinner.rotation.z -= spin;
        wheels[i].holder.rotation.y = wheels[i].front ? turn : 0;
      }
    }
  }

  var AI_AGGRO = {
    pace: 0.97,
    look: 0.86,
    brake: 0.76,
    hairpin: 16.8,
    chicane: 24,
    the90: 28,
    sweeper: 40,
    tight: 0.94,
    lineOff: -0.15,
    pitLap: 3,
    pitFuel: 18,
    pitTires: 26,
    launch: 0.88,
    wobble: 0.06,
    overshoot: 1,
    hunter: 1,
  };
  var AI_TIDY = {
    pace: 0.91,
    look: 1.02,
    brake: 1.08,
    hairpin: 15.4,
    chicane: 19,
    the90: 24,
    sweeper: 35,
    tight: 0.82,
    lineOff: 0.1,
    pitLap: 3,
    pitFuel: 22,
    pitTires: 38,
    launch: 1.02,
    wobble: 0,
    overshoot: 0,
  };
  var AI_MESSY = {
    pace: 0.89,
    look: 0.96,
    brake: 0.9,
    hairpin: 16.5,
    chicane: 24,
    the90: 27,
    sweeper: 37,
    tight: 0.88,
    lineOff: 0.85,
    pitLap: 4,
    pitFuel: 16,
    pitTires: 30,
    launch: 0.56,
    wobble: 0.18,
    overshoot: 0,
    wideEntry: 1,
  };
  var _scan = { dHair: 999, dChi: 999, dSweep: 999, d90: 999, dKink: 999, dTight: 999, tightR: 99 };

  function aiOf(r) {
    if (r && r.name === "BowieKnife99") return AI_AGGRO;
    if (r && r.name === "Hall Monitor") return AI_TIDY;
    return AI_MESSY;
  }

  function scanAhead(s, meters) {
    _scan.dHair = 999;
    _scan.dChi = 999;
    _scan.dSweep = 999;
    _scan.d90 = 999;
    _scan.dKink = 999;
    _scan.dTight = 999;
    _scan.tightR = 99;
    var d;
    for (d = 0; d <= meters; d += 8) {
      var p = centerlinePoint(s + d);
      if (p.name === "hairpin" && d < _scan.dHair) _scan.dHair = d;
      else if (p.name === "chicane" && d < _scan.dChi) _scan.dChi = d;
      else if (p.name === "sweeper" && d < _scan.dSweep) _scan.dSweep = d;
      else if (p.name === "the90" && d < _scan.d90) _scan.d90 = d;
      else if (p.name === "kink" && d < _scan.dKink) _scan.dKink = d;
      if (p.r < 22 && d < _scan.dTight) {
        _scan.dTight = d;
        _scan.tightR = p.r;
      }
    }
    return _scan;
  }

  function approachWant(base, dist, window, apex) {
    if (dist >= window) return base;
    var t = dist / window;
    return apex + (base - apex) * t * t;
  }

  function eachRival(self, fn) {
    function one(o) {
      if (!o || o === self || !o.mesh || !o.mesh.visible || o.finished) return;
      fn(o);
    }
    one(player);
    if (!mpMode) {
      one(cpus[0]);
      one(cpus[1]);
    }
    var id;
    for (id in remotes) {
      if (Object.prototype.hasOwnProperty.call(remotes, id)) one(remotes[id].r);
    }
    for (id in hostBots) {
      if (Object.prototype.hasOwnProperty.call(hostBots, id)) one(hostBots[id]);
    }
  }

  function avoidRams(r, steer) {
    var fx = Math.cos(r.heading);
    var fz = Math.sin(r.heading);
    eachRival(r, function (o) {
      var rx = o.x - r.x;
      var rz = o.z - r.z;
      var fwd = rx * fx + rz * fz;
      var lat = -rx * fz + rz * fx;
      if (fwd > 0.4 && fwd < 8.5 && Math.abs(lat) < 2.7) {
        steer += lat >= 0 ? -0.42 : 0.42;
      }
    });
    return clamp(steer, -1, 1);
  }

  var _prey = { r: null, d: 999, fwd: 0, lat: 0 };
  var _hunt = { on: false, tx: 0, tz: 0, want: 0, noLift: false, dive: false };

  function pickPrey(hunter) {
    _prey.r = null;
    _prey.d = 999;
    _prey.fwd = 0;
    _prey.lat = 0;
    var fx = Math.cos(hunter.heading);
    var fz = Math.sin(hunter.heading);
    var best = 1e9;
    eachRival(hunter, function (o) {
      if (o.pitServicing) return;
      var rx = o.x - hunter.x;
      var rz = o.z - hunter.z;
      var d = Math.hypot(rx, rz);
      if (d < 0.7 || d > 36) return;
      var fwd = rx * fx + rz * fz;
      var lat = -rx * fz + rz * fx;
      var score = d;
      if (fwd < -6) score += 16;
      if (o.kind === "player" && d < 28 && fwd > -8) score -= 12;
      if (score < best) {
        best = score;
        _prey.r = o;
        _prey.d = d;
        _prey.fwd = fwd;
        _prey.lat = lat;
      }
    });
    return _prey;
  }

  function planHunt(r, p, want) {
    _hunt.on = false;
    _hunt.noLift = false;
    _hunt.dive = false;
    _hunt.want = want;
    if (!p.hunter) return _hunt;
    var prey = pickPrey(r);
    if (!prey.r) return _hunt;
    var lead = prey.d * 0.14;
    if (lead > 3.2) lead = 3.2;
    if (lead < 0.45) lead = 0.45;
    _hunt.tx = prey.r.x + Math.cos(prey.r.heading) * lead;
    _hunt.tz = prey.r.z + Math.sin(prey.r.heading) * lead;
    var close = Math.min(MAX_SPEED * 0.98, (prey.r.speed || 0) + 8);
    if (close < want) close = want;
    _hunt.want = close;
    _hunt.on = true;
    if (prey.fwd > -2.2 && prey.fwd < 15 && Math.abs(prey.lat) < 4.4) {
      _hunt.tx = prey.r.x;
      _hunt.tz = prey.r.z;
      _hunt.noLift = true;
      _hunt.want = MAX_SPEED * 0.98;
    }
    return _hunt;
  }

  function updateCpu(r, dt) {
    if (r.finished) {
      applyMotion(r, 0, false, true, false, dt, false);
      return;
    }
    var p = aiOf(r);
    if (!r.launchArmed) applyCpuLaunch(r, p);
    var proj = projectTrack(r.x, r.z);
    r.s = proj.s;

    if (r.pitServicing) {
      r.speed = 0;
      r.slide = 0;
      r.pitTimer += dt;
      if (r.pitTimer >= PIT_HOLD) {
        r.fuel = 100;
        r.tires = 100;
        r.didPit = true;
        r.wantPit = false;
        r.pitServicing = false;
        r.pitUsedVisit = true;
        r.pitTimer = 0;
      }
      poseCar(r);
      return;
    }
    if (!inPitLane(r) && !r.pitServicing) {
      r.pitTimer = 0;
      r.pitUsedVisit = false;
    }
    if (!r.pitServicing && !r.pitUsedVisit && inPitGrab(r)) {
      r.pitServicing = true;
      r.pitTimer = 0;
      r.speed = 0;
      r.slide = 0;
      poseCar(r);
      return;
    }
    if (!r.didPit && !r.wantPit) {
      if (r.lap >= p.pitLap || r.fuel < p.pitFuel || r.tires < p.pitTires) r.wantPit = true;
    }

    var scan = scanAhead(r.s, 140 * p.brake);
    var look = (12 + r.speed * 0.3) * p.look;
    if (scan.dTight < 64) look = Math.min(look, 8 + scan.dTight * 0.22);
    if (scan.dChi < 36) look = Math.min(look, 13);
    var want = MAX_SPEED * p.pace;
    var hpApex = p.hairpin;
    var hotHair = p.overshoot && (r.lap % 2) === 0;
    if (hotHair) hpApex = 18.8;
    want = Math.min(want, approachWant(want, scan.dHair, 130 * p.brake, hpApex));
    if (scan.tightR < 22) {
      var cap = Math.sqrt(MAX_LAT * scan.tightR) * p.tight;
      if (hotHair && scan.dHair < 90) cap = Math.max(cap, 18.5);
      if (cap < 12) cap = 12;
      want = Math.min(want, approachWant(want, scan.dTight, (42 + scan.tightR * 4) * p.brake, cap));
    }
    if (scan.dChi > 0 && scan.dChi < 900) {
      want = Math.min(want, approachWant(want, scan.dChi, 52 * p.brake, p.chicane));
    }
    want = Math.min(want, approachWant(want, scan.d90, 62 * p.brake, p.the90));
    want = Math.min(want, approachWant(want, scan.dSweep, 80 * p.brake, p.sweeper));
    want = Math.min(want, approachWant(want, scan.dKink, 50 * p.brake, 24));
    if (r.fuel <= 0) want = Math.min(want, LIMP_SPEED);

    var hunt = planHunt(r, p, want);
    if (p.hunter && hunt.on && (scan.dHair < 88 || proj.name === "hairpin")) {
      hunt.dive = true;
      hunt.noLift = true;
      hunt.want = Math.max(hunt.want, 22);
      want = hunt.want;
    }

    var target = centerlinePoint(r.s + look);
    var nx = -Math.sin(target.h);
    var nz = Math.cos(target.h);
    var off = p.lineOff;
    if (p.wideEntry && scan.dTight > 14 && scan.dTight < 52) off -= 1.45;
    var tx = target.x + nx * off;
    var tz = target.z + nz * off;
    if (hunt.on) {
      tx = hunt.tx;
      tz = hunt.tz;
      want = hunt.want;
    }
    var peeling = false;
    var midHit = hunt.on && hunt.noLift && _prey.d < 8;
    if (r.wantPit && !r.didPit && PIT_META.on && !midHit) {
      var east = Math.cos(r.heading) > 0.25;
      var onSf = Math.abs(r.z - SF_Z) < 24 && r.x > -70 && r.x < PIT_GRAB.x1 + 2;
      if (east && onSf) {
        peeling = true;
        tx = clamp(r.x + 28, PIT_LANE.x0 + 4, (PIT_GRAB.x0 + PIT_GRAB.x1) * 0.5);
        tz = (PIT_LANE.z0 + PIT_LANE.z1) * 0.5;
        want = Math.min(want, 18);
      }
    }
    if (inPitLane(r) && !r.pitServicing) {
      if (r.wantPit && !r.didPit && !midHit) {
        peeling = true;
        tx = clamp(r.x + 22, PIT_GRAB.x0 + 2, (PIT_GRAB.x0 + PIT_GRAB.x1) * 0.5);
        tz = (PIT_LANE.z0 + PIT_LANE.z1) * 0.5;
        want = Math.min(want, 16);
      } else if (!midHit) {
        tx = Math.min(r.x + 28, PIT_LANE.x1 + 24);
        tz = SF_Z + 2;
        want = Math.min(want, 20);
      }
    }

    var desiredH = Math.atan2(tz - r.z, tx - r.x);
    var err = Math.atan2(Math.sin(desiredH - r.heading), Math.cos(desiredH - r.heading));
    var steer = clamp(err * (hunt.on ? 2.05 : 1.5), -1, 1);
    var recover = proj.grass || proj.dist > 4.6;
    var keepHit = p.hunter && hunt.on && hunt.noLift && !proj.grass;
    if (recover && !peeling && !keepHit) {
      var home = Math.atan2(proj.z - r.z, proj.x - r.x);
      var herr = Math.atan2(Math.sin(home - r.heading), Math.cos(home - r.heading));
      steer = clamp(steer * 0.18 + herr * 1.55, -1, 1);
      want = Math.min(want, proj.grass ? 9 : 14);
      if (proj.dist > 8) want = Math.min(want, 7);
    }
    r.aiT = (r.aiT || 0) + dt;
    if (p.wobble && (r.aiT % 3.6) < 0.28) {
      steer = clamp(steer + Math.sin(r.aiT * 9 + (r.s || 0)) * p.wobble, -1, 1);
    }
    if (!p.hunter) steer = avoidRams(r, steer);

    var reverse = false;
    if (recover && proj.grass && r.speed < 5 && proj.dist > 7 && !keepHit) {
      var out = Math.cos(r.heading) * (proj.x - r.x) + Math.sin(r.heading) * (proj.z - r.z);
      if (out < -0.15) reverse = true;
    }
    var throttle = !reverse && r.speed < want - 0.4;
    var brake = !reverse && r.speed > want + 2.2;
    if (hunt.on && hunt.noLift) {
      throttle = !reverse;
      brake = false;
    }
    applyMotion(r, steer, throttle, brake, reverse, dt, false);
    updateLaps(r);
  }

  function bashCars(a, b) {
    var dx = b.x - a.x;
    var dz = b.z - a.z;
    var d = Math.hypot(dx, dz);
    if (d < 0.0001) {
      dx = 1;
      dz = 0;
      d = 1;
    }
    if (d >= HIT_RADIUS) return;
    var nx = dx / d;
    var nz = dz / d;
    var push = (HIT_RADIUS - d) * 0.5;
    a.x -= nx * push;
    a.z -= nz * push;
    b.x += nx * push;
    b.z += nz * push;

    var avx = Math.cos(a.heading) * a.speed + -Math.sin(a.heading) * a.slide;
    var avz = Math.sin(a.heading) * a.speed + Math.cos(a.heading) * a.slide;
    var bvx = Math.cos(b.heading) * b.speed + -Math.sin(b.heading) * b.slide;
    var bvz = Math.sin(b.heading) * b.speed + Math.cos(b.heading) * b.slide;
    var rel = (avx - bvx) * nx + (avz - bvz) * nz;
    if (rel >= 0) {
      poseCar(a);
      poseCar(b);
      return;
    }
    var j = -rel * 0.72;
    avx += j * nx;
    avz += j * nz;
    bvx -= j * nx;
    bvz -= j * nz;
    var impact = Math.abs(rel);
    a.speed = Math.hypot(avx, avz) * (a.speed < 0 ? -1 : 1) * 0.82;
    b.speed = Math.hypot(bvx, bvz) * (b.speed < 0 ? -1 : 1) * 0.82;
    if (Math.hypot(avx, avz) > 0.6) a.heading = Math.atan2(avz, avx);
    if (Math.hypot(bvx, bvz) > 0.6) b.heading = Math.atan2(bvz, bvx);
    var spin = clamp(impact * 0.045, 0, 0.9);
    a.heading += (Math.random() - 0.5) * spin;
    b.heading -= (Math.random() - 0.5) * spin;
    a.slide += -nz * impact * 0.18;
    b.slide += nz * impact * 0.18;
    if (impact > 10) {
      a.speed *= 0.7;
      b.speed *= 0.7;
    }
    poseCar(a);
    poseCar(b);
    if (impact > 4 && !(a.hitFxT > 0) && !(b.hitFxT > 0)) {
      a.hitFxT = 0.16;
      b.hitFxT = 0.16;
      puffHit((a.x + b.x) * 0.5, (a.z + b.z) * 0.5, nx, nz);
    }
  }

  function bashWall(r, w) {
    var hit = closestOnSeg(r.x, r.z, w.ax, w.az, w.bx, w.bz);
    var rad = 1.35 + (w.thick || 0.55) * 0.5;
    var d = Math.sqrt(hit.d2);
    if (d >= rad) return 0;
    var nx;
    var nz;
    if (d < 0.0001) {
      var sx = w.bz - w.az;
      var sz = -(w.bx - w.ax);
      var sl = Math.hypot(sx, sz) || 1;
      nx = sx / sl;
      nz = sz / sl;
    } else {
      nx = (r.x - hit.x) / d;
      nz = (r.z - hit.z) / d;
    }
    var push = rad - d;
    r.x += nx * push;
    r.z += nz * push;
    var vx = Math.cos(r.heading) * r.speed + -Math.sin(r.heading) * r.slide;
    var vz = Math.sin(r.heading) * r.speed + Math.cos(r.heading) * r.slide;
    var rel = vx * nx + vz * nz;
    if (rel >= 0) {
      poseCar(r);
      return 0;
    }
    var j = -rel * 0.72;
    vx += j * nx;
    vz += j * nz;
    var impact = Math.abs(rel);
    r.speed = Math.hypot(vx, vz) * (r.speed < 0 ? -1 : 1) * 0.82;
    if (Math.hypot(vx, vz) > 0.6) r.heading = Math.atan2(vz, vx);
    r.heading += (Math.random() - 0.5) * clamp(impact * 0.045, 0, 0.9);
    r.slide += -nz * impact * 0.18;
    if (impact > 10) r.speed *= 0.7;
    poseCar(r);
    if (impact > 4 && !(r.hitFxT > 0)) {
      r.hitFxT = 0.16;
      puffHit(r.x, r.z, nx, nz);
    }
    return impact;
  }

  function bashAllWalls(r) {
    if (!r) return 0;
    if (r.hitFxT > 0) r.hitFxT -= 0.016;
    var best = 0;
    var i;
    for (i = 0; i < WALLS.length; i++) {
      var imp = bashWall(r, WALLS[i]);
      if (imp > best) best = imp;
    }
    return best;
  }

  var fxPool = [];
  var fxN = 0;

  function initFx() {
    var geo = new THREE.PlaneGeometry(1, 1);
    var i;
    for (i = 0; i < FX_MAX; i++) {
      var mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      fxPool.push({
        mesh: mesh,
        life: 0,
        max: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        grow: 1,
        kind: "",
      });
    }
  }

  function spawnFx(kind, x, y, z, vx, vy, vz) {
    if (!fxPool.length) return;
    var p = fxPool[fxN % FX_MAX];
    fxN += 1;
    p.kind = kind;
    p.life =
      kind === "spark" ? 0.11 : kind === "slip" ? 0.18 : kind === "streak" ? 0.2 : kind === "puff" ? 0.34 : 0.36;
    p.max = p.life;
    p.vx = vx || 0;
    p.vy = vy || 0;
    p.vz = vz || 0;
    p.grow = kind === "puff" || kind === "burst" ? 1.4 : 0;
    p.mesh.position.set(x, y, z);
    p.mesh.visible = true;
    var col =
      kind === "spark"
        ? 0xfff3a0
        : kind === "slip"
          ? 0xf4efe6
          : kind === "streak"
            ? 0x8a8a88
            : kind === "puff"
              ? 0xcbb79a
              : 0xb08958;
    p.mesh.material.color.setHex(col);
    p.mesh.material.opacity = kind === "spark" ? 1 : 0.82;
    if (kind === "spark") p.mesh.scale.set(0.72, 0.07, 1);
    else if (kind === "streak") p.mesh.scale.set(1.55, 0.1, 1);
    else if (kind === "slip") p.mesh.scale.set(0.62, 0.2, 1);
    else if (kind === "puff") p.mesh.scale.set(1.35, 1.05, 1);
    else p.mesh.scale.set(1.5, 1.15, 1);
  }

  function puffHit(x, z, nx, nz) {
    spawnFx("spark", x, 0.42, z, (nx || 0) * 5, 0.8, (nz || 0) * 5);
  }

  function launchPuffs(r) {
    if (!r) return;
    var a = wheelWorld(r, -1, -1);
    var b = wheelWorld(r, -1, 1);
    var back = -Math.cos(r.heading);
    var side = -Math.sin(r.heading);
    spawnFx("puff", a.x, 0.24, a.z, back * 2.2, 0.35, side * 2.2);
    spawnFx("puff", b.x, 0.24, b.z, back * 2.2, 0.35, side * 2.2);
  }

  function wheelWorld(r, along, side) {
    var c = Math.cos(r.heading);
    var s = Math.sin(r.heading);
    var lx = along < 0 ? -1.2 : 1.3;
    var lz = side * 0.82;
    return { x: r.x + c * lx - s * lz, z: r.z + s * lx + c * lz };
  }

  function nearPlayer(r) {
    var dx = r.x - player.x;
    var dz = r.z - player.z;
    return dx * dx + dz * dz < 2500;
  }

  function emitRacerFx(r, inp, dt, isPlayer) {
    if (!r || r.finished) return;
    if (!isPlayer && !nearPlayer(r)) return;
    if (r.hitFxT > 0) r.hitFxT -= dt;
    r.fxT = (r.fxT || 0) + dt;
    var spd = Math.abs(r.speed);
    var sl = Math.abs(r.slide);
    var steer = inp ? inp.steer : 0;
    var worn = r.tires < 42 && spd > 8;
    var spinning = sl > 5.2;
    var hard = Math.abs(steer) > 0.55 && spd > 20 && sl > 0.85;
    var back = -Math.cos(r.heading);
    var side = -Math.sin(r.heading);
    if (spinning) {
      if (!r.spinFx) {
        r.spinFx = true;
        spawnFx("burst", r.x, 0.28, r.z, back * 0.8, 0.9, side * 0.8);
      }
    } else {
      r.spinFx = false;
    }
    if (r.fxT < 0.16) return;
    r.fxT = 0;
    if (worn) {
      var wr = wheelWorld(r, -1, -1);
      var wl = wheelWorld(r, -1, 1);
      spawnFx("streak", wr.x, 0.14, wr.z, back * 5.5, 0.05, side * 5.5);
      spawnFx("streak", wl.x, 0.14, wl.z, back * 5.5, 0.05, side * 5.5);
    } else if (hard) {
      var out = wheelWorld(r, -1, steer > 0 ? 1 : -1);
      spawnFx("slip", out.x, 0.16, out.z, back * 2.4, 0.2, side * 2.4);
    }
  }

  function updateFx(dt) {
    var drive = state === "start" || state === "racing";
    var i;
    for (i = 0; i < fxPool.length; i++) {
      var p = fxPool[i];
      if (!p.mesh.visible) continue;
      if (!drive) {
        p.mesh.visible = false;
        p.life = 0;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      var u = 1 - p.life / p.max;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.kind === "puff" || p.kind === "burst") {
        p.mesh.scale.x = Math.min(p.mesh.scale.x * (1 + p.grow * dt), 2.1);
        p.mesh.scale.y = Math.min(p.mesh.scale.y * (1 + p.grow * dt), 1.8);
      }
      p.mesh.material.opacity = (1 - u) * (p.kind === "spark" ? 1 : 0.8);
      p.mesh.quaternion.copy(camera.quaternion);
    }
  }

  function poseCar(r) {
    r.mesh.position.set(r.x, 0, r.z);
    r.mesh.rotation.set(0, -r.heading, 0);
    r.mesh.rotation.x = 0;
    r.mesh.rotation.z = 0;
  }

  function playerInput() {
    var up = keys.ArrowUp || keys.KeyW;
    var down = keys.ArrowDown || keys.KeyS;
    var left = keys.ArrowLeft || keys.KeyA;
    var right = keys.ArrowRight || keys.KeyD;
    var steer = 0;
    if (left) steer += 1;
    if (right) steer -= 1;
    // Designer lock: Chromebooks / any keyboard machine stay WASD/Space only.
    if (!isPhoneLike()) {
      return {
        steer: steer,
        throttle: !!up,
        reverse: !!down,
        brake: !!keys.Space,
      };
    }
    var keySteer = !!(left || right);
    return {
      steer: keySteer ? steer : touchCtl.steer || 0,
      throttle: !!(up || touchCtl.gas),
      reverse: !!(down || touchCtl.rev),
      brake: !!(keys.Space || touchCtl.brake),
    };
  }

  function setScreen(which) {
    hud.title.classList.toggle("hidden", which !== "title");
    if (hud.lobby) hud.lobby.classList.toggle("hidden", which !== "lobby");
    if (hud.trackScreen) hud.trackScreen.classList.toggle("hidden", which !== "track");
    hud.countdown.classList.toggle("hidden", which !== "start");
    hud.finish.classList.toggle("hidden", which !== "finish");
    hud.root.classList.toggle("hidden", which === "title" || which === "lobby" || which === "track");
    hud.revWrap.classList.toggle("hidden", which !== "start");
    syncMobileUi();
  }

  function paintLights(n, blue) {
    var i;
    for (i = 0; i < 5; i++) {
      hud.lights[i].classList.toggle("on", i < n);
      if (gantryReds[i]) gantryReds[i].material.color.set(i < n ? 0xff1a1a : 0x3a1010);
    }
    var flash = blue && Math.floor(performance.now() / 160) % 2 === 0;
    for (i = 0; i < gantryBlues.length; i++) {
      gantryBlues[i].material.color.set(flash ? 0x44c8ff : 0x1a3040);
    }
    hud.countdown.classList.toggle("blue-flash", !!blue);
  }

  function ensureAudio() {
    if (audio.ctx || !window.AudioContext && !window.webkitAudioContext) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new AC();
    audio.osc = audio.ctx.createOscillator();
    audio.gain = audio.ctx.createGain();
    audio.osc.type = "sawtooth";
    audio.gain.gain.value = 0;
    audio.osc.connect(audio.gain);
    audio.gain.connect(audio.ctx.destination);
    audio.osc.start();
  }

  function setRevSound(on) {
    if (!audio.ctx) return;
    audio.osc.frequency.setValueAtTime(72 + revs * 260, audio.ctx.currentTime);
    audio.gain.gain.setTargetAtTime(on ? 0.035 + revs * 0.05 : 0, audio.ctx.currentTime, 0.05);
  }

  function paintRevs() {
    var pct = Math.round(revs * 100);
    if (hud.revFill) hud.revFill.style.width = pct + "%";
    if (hud.revNeedle) hud.revNeedle.style.left = pct + "%";
    if (hud.revWrap) {
      hud.revWrap.classList.toggle("sweet", revs >= REV_SWEET_LO && revs <= REV_SWEET_HI);
      hud.revWrap.classList.toggle("hot", revs > REV_SWEET_HI);
    }
  }

  function gradeLaunch(rev) {
    if (rev > REV_SWEET_HI) return "DUMP";
    if (rev >= REV_GREAT_LO && rev <= REV_GREAT_HI) return "GREAT";
    if (rev >= REV_SWEET_LO && rev <= REV_SWEET_HI) return "GOOD";
    return "SLUGGISH";
  }

  function dumpLaunch(r) {
    if (!r) return;
    var dir = Math.random() < 0.5 ? -1 : 1;
    r.slide += dir * 10.5;
    r.heading += dir * 0.62;
    r.speed = 0;
    r.spinFx = true;
    var back = -Math.cos(r.heading);
    var side = -Math.sin(r.heading);
    spawnFx("burst", r.x, 0.28, r.z, back * 0.8, 0.9, side * 0.8);
  }

  function applyLaunch() {
    launchMul = 1;
    launchT = GETAWAY_T;
    launchCall = gradeLaunch(revs);
    if (launchCall === "GREAT") launchMul = 1.2;
    else if (launchCall === "GOOD") launchMul = 1.08;
    else if (launchCall === "DUMP") {
      launchMul = 0.5;
      dumpLaunch(player);
    } else {
      launchMul = 0.55;
    }
    launchCallT = 2;
    if (launchCall !== "DUMP") launchPuffs(player);
  }

  function applyCpuLaunch(r, p) {
    r.launchArmed = true;
    r.launchT = GETAWAY_T;
    var roll = Math.random();
    var kind;
    if (p && p.hunter) {
      if (roll < 0.24) kind = "DUMP";
      else if (roll < 0.42) kind = "SLUGGISH";
      else if (roll < 0.72) kind = "GOOD";
      else kind = "GREAT";
    } else if (p && p.launch >= 1) {
      if (roll < 0.1) kind = "SLUGGISH";
      else if (roll < 0.18) kind = "DUMP";
      else if (roll < 0.55) kind = "GOOD";
      else kind = "GREAT";
    } else {
      if (roll < 0.28) kind = "SLUGGISH";
      else if (roll < 0.48) kind = "DUMP";
      else if (roll < 0.86) kind = "GOOD";
      else kind = "GREAT";
    }
    if (kind === "GREAT") r.launchMul = 1.2;
    else if (kind === "GOOD") r.launchMul = 1.08;
    else if (kind === "DUMP") {
      r.launchMul = 0.5;
      dumpLaunch(r);
    } else {
      r.launchMul = 0.55;
    }
  }

  function persistMe() {
    if (!mpMode || !net || !net.room) return;
    if (state !== "racing" && state !== "start") return;
    try {
      sessionStorage.setItem(
        "sk_me",
        JSON.stringify({
          room: String(net.room).toUpperCase(),
          slot: player.slot,
          x: player.x,
          z: player.z,
          h: player.heading,
          spd: player.speed,
          slide: player.slide,
          lap: player.lap,
          fuel: player.fuel,
          tires: player.tires,
          pit: pitServicing ? 1 : 0,
          finished: player.finished ? 1 : 0,
          raceTime: raceTime,
        })
      );
    } catch (e) {}
  }

  function loadMe(code) {
    try {
      var me = JSON.parse(sessionStorage.getItem("sk_me") || "null");
      if (me && code && me.room === String(code).toUpperCase()) return me;
    } catch (e) {}
    return null;
  }

  function clearMe() {
    try {
      sessionStorage.removeItem("sk_me");
    } catch (e) {}
  }

  function applyYou(you) {
    if (!you) return;
    if (you.x != null && isFinite(+you.x)) player.x = +you.x;
    if (you.z != null && isFinite(+you.z)) player.z = +you.z;
    if (you.h != null && isFinite(+you.h)) player.heading = +you.h;
    if (you.spd != null && isFinite(+you.spd)) player.speed = +you.spd;
    if (you.slide != null && isFinite(+you.slide)) player.slide = +you.slide;
    if (you.lap != null && isFinite(+you.lap)) player.lap = +you.lap;
    if (you.fuel != null && isFinite(+you.fuel)) player.fuel = +you.fuel;
    if (you.tires != null && isFinite(+you.tires)) player.tires = +you.tires;
    player.finished = !!you.finished;
    poseCar(player);
  }

  function beenRacing(you) {
    if (!you) return false;
    var slot = you.slot != null ? you.slot : 1;
    var g = gridSlot(slot);
    var dx = (+you.x || 0) - g.x;
    var dz = (+you.z || 0) - g.z;
    return (
      you.lap > 1 ||
      (you.fuel != null && +you.fuel < 99) ||
      (you.tires != null && +you.tires < 99) ||
      (you.raceTime != null && +you.raceTime > 1) ||
      Math.hypot(dx, dz) > 6
    );
  }

  function startSequence() {
    if (joining) return;
    if (net && net.active && mpMode) return;
    mpMode = false;
    lateJoinT = 0;
    playerGridX = GRID_P2_X;
    playerGridZ = GRID_P2_Z;
    clearRemotes();
    clearHostBots();
    applyGameSpeed(1);
    clearMe();
    if (net) net.leave();
    resetGrid();
    touchCtl.gyroNeedCal = true;
    state = "start";
    setScreen("start");
    hud.startMsg.textContent = "PRE-START";
    hud.startMsg.className = "start-msg";
    paintLights(0, true);
    ensureAudio();
  }

  function finishRace() {
    state = "finished";
    setScreen("finish");
    setRevSound(false);
    hud.finishTime.textContent = formatTime(player.finishTime || raceTime);
    hud.finishPit.textContent = didPit
      ? "Pit stop: yes — you took the box"
      : "Pit stop: no — you skipped it and limped";
    var place = 1;
    if (mpMode) {
      Object.keys(remotes).forEach(function (id) {
        var r = remotes[id].r;
        if (r.finished && r.finishTime && r.finishTime < player.finishTime) place += 1;
      });
      Object.keys(hostBots).forEach(function (id) {
        var r = hostBots[id];
        if (r.finished && r.finishTime && r.finishTime < player.finishTime) place += 1;
      });
      hud.finishPlace.textContent = place + " · room " + (net && net.room ? net.room : "");
    } else {
      if (cpus[0].finished && cpus[0].finishTime < player.finishTime) place += 1;
      if (!cpus[0].finished && !player.finished) place += 1;
      if (cpus[1].finished && cpus[1].finishTime < player.finishTime) place += 1;
      var names = ["1st", "2nd", "3rd"];
      hud.finishPlace.textContent = names[place - 1] + " · vs BowieKnife99 & Hall Monitor";
    }
  }

  function updateHud() {
    hud.lap.textContent = player.lap + "/" + LAPS;
    hud.time.textContent = formatTime(raceTime);
    hud.speed.textContent = String(Math.round(Math.abs(player.speed) * 3.15));
    var fuel = clamp(player.fuel, 0, 100);
    var tires = clamp(player.tires, 0, 100);
    hud.fuelFill.style.transform = "scaleX(" + fuel / 100 + ")";
    hud.tireFill.style.transform = "scaleX(" + tires / 100 + ")";
    hud.fuelNum.textContent = String(Math.round(fuel));
    hud.tireNum.textContent = String(Math.round(tires));
    hud.fuelFill.style.background = fuel < 28 ? "linear-gradient(90deg,#7a1010,#ff4d4d)" : "";
    hud.tireFill.style.background = tires < 40 ? "linear-gradient(90deg,#8a5a10,#ffd36a)" : "";
    paintRevs();

    var pitting = state === "racing" && (pitServicing || inPitLane(player));
    var pct = Math.min(100, Math.round((pitTimer / PIT_HOLD) * 100));
    hud.pitting.classList.toggle("hidden", !pitting && pitFlash <= 0);
    if (pitFlash > 0) hud.pitting.textContent = "SERVICED";
    else if (pitServicing) hud.pitting.textContent = "PITTING  " + pct + "%";
    else if (inPitLane(player) && pitUsedVisit) hud.pitting.textContent = "SERVICED — drive out";
    else if (inPitLane(player)) hud.pitting.textContent = "PIT LANE";

    var warn = "";
    if (lateJoinT > 0) warn = "RACE ALREADY GOING — you dropped in mid-race";
    else if (launchCallT > 0) warn = launchCall;
    else if (state === "racing" && player.fuel <= 0) warn = "EMPTY — LIMP HOME";
    else if (state === "racing" && player.tires < 40) warn = "TIRES LOOSE — don't carry the sweeper";
    else if (state === "racing" && player.fuel < 38) warn = "PIT WINDOW — peel LEFT into the teal lane";
    hud.warn.textContent = warn;
    hud.warn.classList.toggle("hidden", !warn);
    hud.warn.classList.toggle("late", lateJoinT > 0);
    hud.warn.classList.toggle("launch", launchCallT > 0 && launchCall !== "DUMP");
    hud.warn.classList.toggle("dump", launchCallT > 0 && launchCall === "DUMP");
    paintMini();
    paintRaceNames();
  }

  function miniXY(x, z, w, h, pad) {
    var bw = miniBox.x1 - miniBox.x0 || 1;
    var bh = miniBox.z1 - miniBox.z0 || 1;
    var s = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
    var cx = (miniBox.x0 + miniBox.x1) * 0.5;
    var cz = (miniBox.z0 + miniBox.z1) * 0.5;
    return {
      x: w * 0.5 + (x - cx) * s,
      y: h * 0.5 - (z - cz) * s,
    };
  }

  function paintMiniDot(ctx, x, z, color, r) {
    var p = miniXY(x, z, ctx.canvas.width, ctx.canvas.height, 10);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintMini() {
    if (!hud.mini) return;
    var ctx = hud.mini.getContext("2d");
    if (!ctx) return;
    var w = hud.mini.width;
    var h = hud.mini.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(18, 12, 8, 0.72)";
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, w * 0.5 - 1, 0, Math.PI * 2);
    ctx.fill();
    if (miniPts.length >= 4) {
      ctx.beginPath();
      var i;
      for (i = 0; i < miniPts.length; i += 2) {
        var p = miniXY(miniPts[i], miniPts[i + 1], w, h, 8);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.strokeStyle = "#0a2a28";
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = "#2ec8c3";
      ctx.lineWidth = 3.4;
      ctx.stroke();
    }
    var pitA = miniXY(PIT_LANE.x0, (PIT_LANE.z0 + PIT_LANE.z1) * 0.5, w, h, 8);
    var pitB = miniXY(PIT_LANE.x1, (PIT_LANE.z0 + PIT_LANE.z1) * 0.5, w, h, 8);
    ctx.strokeStyle = "#e8b86d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pitA.x, pitA.y);
    ctx.lineTo(pitB.x, pitB.y);
    ctx.stroke();
    if (!mpMode) {
      paintMiniDot(ctx, cpus[0].x, cpus[0].z, "#d4a017", 4);
      paintMiniDot(ctx, cpus[1].x, cpus[1].z, "#b4532e", 4);
    } else {
      Object.keys(remotes).forEach(function (id) {
        var r = remotes[id].r;
        var slot = 1;
        if (net && net.players) {
          for (var n = 0; n < net.players.length; n++) {
            if (net.players[n].id === id) slot = net.players[n].slot;
          }
        }
        var hex = (SKINS[slot % SKINS.length].color | 0).toString(16);
        while (hex.length < 6) hex = "0" + hex;
        paintMiniDot(ctx, r.x, r.z, "#" + hex, 4);
      });
      Object.keys(hostBots).forEach(function (id) {
        var br = hostBots[id];
        paintMiniDot(ctx, br.x, br.z, "#d4a017", 4);
      });
    }
    var you = miniXY(player.x, player.z, w, h, 10);
    ctx.save();
    ctx.translate(you.x, you.y);
    ctx.rotate(-player.heading);
    ctx.fillStyle = "#2ec8c3";
    ctx.beginPath();
    ctx.moveTo(5.2, 0);
    ctx.lineTo(-3.4, 3.2);
    ctx.lineTo(-3.4, -3.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function chaseCamera(dt) {
    var turn = Math.atan2(
      Math.sin(player.heading - camFollowH),
      Math.cos(player.heading - camFollowH)
    );
    camFollowH += turn * (1 - Math.pow(0.018, dt));
    var back = 5.15;
    var up = 2.12;
    var fx = Math.cos(camFollowH);
    var fz = Math.sin(camFollowH);
    var desired = new THREE.Vector3(player.x - fx * back, up, player.z - fz * back);
    desired.y = up;
    var lx = Math.cos(player.heading);
    var lz = Math.sin(player.heading);
    var look = new THREE.Vector3(player.x + lx * 24, 1.05, player.z + lz * 24);
    camera.up.set(0, 1, 0);
    if (camera.position.y > 10 || camera.position.distanceToSquared(desired) > 220) {
      camera.position.copy(desired);
      camFollowH = player.heading;
    } else {
      camera.position.lerp(desired, 1 - Math.pow(0.00035, dt));
    }
    camera.position.y = up;
    camera.lookAt(look);
  }

  function titleCamera(dt) {
    camYaw += dt * 0.16;
    camera.position.set(8 + Math.cos(camYaw) * 120, 40, -20 + Math.sin(camYaw) * 120);
    camera.lookAt(8, 8, -20);
  }

  function pinGrid(r, x, z) {
    r.speed = 0;
    r.slide = 0;
    r.x = x;
    r.z = z;
    r.heading = 0;
    poseCar(r);
  }

  function tickStart(dt) {
    var input = playerInput();
    if (input.throttle) {
      revs = clamp(revs + dt * REV_CLIMB, 0, 1);
    } else {
      revs = clamp(revs - dt * REV_DROP, 0, 1);
    }
    setRevSound(true);
    paintRevs();

    // Locked to the grid until lights-out. W only moves the rev needle.
    pinGrid(player, playerGridX, playerGridZ);
    var wheels = player.mesh.userData.wheels;
    if (wheels) {
      var spin = revs * dt * 16;
      for (var w = 0; w < wheels.length; w++) wheels[w].spinner.rotation.z -= spin;
    }

    if (mpMode && net && net.active) {
      startPhase = net.startPhase || startPhase;
      redsOn = net.redsOn;
      holdDelay = net.holdDelay || holdDelay;
    } else {
    startT -= dt;
    if (startPhase === "prestart") {
      hud.startMsg.textContent = "PRE-START";
      hud.startMsg.className = "start-msg";
      paintLights(0, true);
      if (startT <= 0) {
        startPhase = "reds";
        startT = 1;
        redsOn = 1;
      }
    } else if (startPhase === "reds") {
      hud.startMsg.textContent = "LIGHTS";
      hud.startMsg.className = "start-msg reds";
      paintLights(redsOn, false);
      if (startT <= 0) {
        redsOn += 1;
        if (redsOn >= 5) {
          redsOn = 5;
          startPhase = "hold";
          startT = holdDelay;
        } else {
          startT = 1;
        }
      }
    } else if (startPhase === "hold") {
      hud.startMsg.textContent = "LIGHTS";
      hud.startMsg.className = "start-msg reds";
      paintLights(5, false);
      if (startT <= 0) {
        paintLights(0, false);
        hud.startMsg.textContent = "GO";
        hud.startMsg.className = "start-msg go";
        applyLaunch();
        state = "racing";
        setScreen("racing");
        setRevSound(false);
      }
    }
    }

    if (mpMode) {
      if (startPhase === "prestart") {
        hud.startMsg.textContent = "PRE-START";
        hud.startMsg.className = "start-msg";
        paintLights(0, true);
      } else if (startPhase === "reds" || startPhase === "hold") {
        hud.startMsg.textContent = "LIGHTS";
        hud.startMsg.className = "start-msg reds";
        paintLights(redsOn, false);
      }
    }
    if (!mpMode) {
      pinGrid(cpus[0], -6, SF_Z + 2.7);
      pinGrid(cpus[1], -22, SF_Z + 2.7);
    }
    chaseCamera(dt);
  }

  function lerpAng(a, b, t) {
    var d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + d * t;
  }

  function clearRemotes() {
    Object.keys(remotes).forEach(function (id) {
      scene.remove(remotes[id].r.mesh);
    });
    remotes = {};
  }

  function clearHostBots() {
    Object.keys(hostBots).forEach(function (id) {
      scene.remove(hostBots[id].mesh);
    });
    hostBots = {};
  }

  function adoptHostBots() {
    if (!mpMode || !net || !net.isHost()) {
      clearHostBots();
      return;
    }
    var keep = {};
    (net.players || []).forEach(function (p) {
      if (!p.bot) return;
      keep[p.id] = true;
      if (!hostBots[p.id]) {
        var skin = SKINS[p.slot % SKINS.length];
        var g = gridSlot(p.slot);
        var r = createRacer("cpu", skin.color, p.name || skin.name, skin.num);
        resetRacer(r, g.x, g.z, 0, TRACK_LEN - 6 - p.slot * 8);
        hostBots[p.id] = r;
      }
      if (p.name && hostBots[p.id].name !== p.name) {
        hostBots[p.id].name = p.name;
        paintNameTag(hostBots[p.id]);
      } else if (p.name) {
        hostBots[p.id].name = p.name;
      }
    });
    Object.keys(hostBots).forEach(function (id) {
      if (!keep[id]) {
        scene.remove(hostBots[id].mesh);
        delete hostBots[id];
      }
    });
  }

  function sendBotStates() {
    if (!net || !net.sendBots) return;
    var cars = [];
    Object.keys(hostBots).forEach(function (id) {
      var r = hostBots[id];
      cars.push({
        id: id,
        x: r.x,
        z: r.z,
        h: r.heading,
        spd: r.speed,
        slide: r.slide,
        lap: r.lap,
        fuel: r.fuel,
        tires: r.tires,
        finished: r.finished ? 1 : 0,
      });
    });
    net.sendBots(cars);
  }

  function tickHostBots(dt) {
    if (!mpMode || !net || !net.isHost()) return;
    adoptHostBots();
    var ids = Object.keys(hostBots);
    var i;
    var j;
    if (state === "start") {
      for (i = 0; i < ids.length; i++) {
        var meta = null;
        for (j = 0; j < (net.players || []).length; j++) {
          if (net.players[j].id === ids[i]) meta = net.players[j];
        }
        var g = gridSlot(meta ? meta.slot : 0);
        pinGrid(hostBots[ids[i]], g.x, g.z);
      }
    } else if (state === "racing") {
      for (i = 0; i < ids.length; i++) {
        updateCpu(hostBots[ids[i]], dt);
        updateLaps(hostBots[ids[i]]);
        bashCars(player, hostBots[ids[i]]);
        bashAllWalls(hostBots[ids[i]]);
        emitRacerFx(hostBots[ids[i]], null, dt, false);
      }
      bashAllWalls(player);
      for (i = 0; i < ids.length; i++) {
        for (j = i + 1; j < ids.length; j++) bashCars(hostBots[ids[i]], hostBots[ids[j]]);
        Object.keys(remotes).forEach(function (rid) {
          bashCars(hostBots[ids[i]], remotes[rid].r);
        });
      }
    }
    sendBotStates();
  }

  function ensureRemote(id, slot, name, body, wing) {
    if (remotes[id]) {
      if (name && remotes[id].r.name !== name) {
        remotes[id].r.name = name;
        paintNameTag(remotes[id].r);
      } else if (name) {
        remotes[id].r.name = name;
      }
      if (body != null || wing != null) paintCar(remotes[id].r.mesh, body, wing);
      return remotes[id];
    }
    var skin = SKINS[slot % SKINS.length];
    var col = body != null ? body : skin.color;
    var wcol = wing != null ? wing : 0x1a1a1a;
    var r = createRacer("net", col, name || skin.name, skin.num, wcol);
    remotes[id] = { r: r, from: null, to: null, at: 0, ghost: false };
    return remotes[id];
  }

  function ingestSnap(cars) {
    var seen = {};
    var now = performance.now();
    (cars || []).forEach(function (c) {
      if (c.id === (net && net.id)) return;
      if (hostBots[c.id]) return;
      seen[c.id] = true;
      var rem = ensureRemote(c.id, c.slot || 0, c.name, c.body, c.wing);
      rem.ghost = !!c.ghost;
      rem.r.mesh.visible = true;
      rem.r.mesh.traverse(function (ch) {
        if (ch.isSprite) return;
        if (ch.material && ch.material.opacity !== undefined) {
          ch.material.transparent = !!c.ghost;
          if (ch.material.transparent) ch.material.opacity = 0.45;
        }
      });
      rem.from = rem.to;
      rem.to = { x: c.x, z: c.z, h: c.h, spd: c.spd, t: now };
      rem.at = now;
      rem.r.lap = c.lap;
      rem.r.finished = !!c.finished;
      rem.r.finishTime = rem.r.finished ? rem.r.finishTime || raceTime : 0;
    });
    Object.keys(remotes).forEach(function (id) {
      if (!seen[id]) {
        scene.remove(remotes[id].r.mesh);
        delete remotes[id];
      }
    });
  }

  function poseRemotes() {
    var now = performance.now();
    Object.keys(remotes).forEach(function (id) {
      var rem = remotes[id];
      var r = rem.r;
      if (rem.from && rem.to) {
        var span = Math.max(16, rem.to.t - rem.from.t);
        var u = clamp((now - rem.to.t) / span, 0, 1);
        r.x = rem.from.x + (rem.to.x - rem.from.x) * u;
        r.z = rem.from.z + (rem.to.z - rem.from.z) * u;
        r.heading = lerpAng(rem.from.h, rem.to.h, u);
        r.speed = rem.to.spd;
      } else if (rem.to) {
        r.x = rem.to.x;
        r.z = rem.to.z;
        r.heading = rem.to.h;
        r.speed = rem.to.spd;
      }
      poseCar(r);
      var wheels = r.mesh.userData.wheels;
      if (wheels) {
        var spin = r.speed * 0.04;
        for (var i = 0; i < wheels.length; i++) wheels[i].spinner.rotation.z -= spin;
      }
    });
  }

  function bashRemotes() {
    Object.keys(remotes).forEach(function (id) {
      bashCars(player, remotes[id].r);
    });
  }

  function sendNetState() {
    if (!mpMode || !net || !net.active || !net.connected) return;
    var now = performance.now();
    if (now - lastNetSend < 80) return;
    lastNetSend = now;
    persistMe();
    net.sendState({
      x: player.x,
      z: player.z,
      h: player.heading,
      spd: player.speed,
      slide: player.slide,
      lap: player.lap,
      fuel: player.fuel,
      tires: player.tires,
      pit: pitServicing ? 1 : 0,
      finished: player.finished ? 1 : 0,
    });
  }

  function paintRoster() {
    if (!hud.roster || !net) return;
    if (net.speed != null) applyGameSpeed(net.speed);
    hud.roomCode.textContent = net.room || "-----";
    hud.lobbyStatus.textContent = net.isHost()
      ? "You are host · Enter to grid up"
      : "Waiting for host to grid up";
    hud.lobbyErr.textContent = net.err || "";
    if (hud.hostTools) hud.hostTools.classList.toggle("hidden", !net.isHost());
    if (hud.gridBtn) hud.gridBtn.classList.toggle("hidden", !net.isHost());
    var bowieIn = (net.players || []).some(function (p) {
      return p.bot && p.name === "BowieKnife99";
    });
    if (hud.bowieBtn) hud.bowieBtn.disabled = !net.isHost() || bowieIn;
    var still = false;
    (net.players || []).forEach(function (p) {
      if (p.id === lobbyPick) still = true;
    });
    if (!still) lobbyPick = "";
    hud.roster.innerHTML = "";
    (net.players || []).forEach(function (p) {
      var li = document.createElement("li");
      var skin = SKINS[p.slot % SKINS.length];
      li.setAttribute("data-id", p.id);
      var star = document.createElement("span");
      star.className = "star";
      star.textContent = p.id === net.hostId ? "★" : "";
      var who = document.createElement("span");
      who.className = "who";
      who.textContent =
        (p.id === net.id ? "YOU · " : p.bot ? "CPU · " : "") +
        (p.name || skin.name) +
        "  #" +
        skin.num +
        (p.ghost || (!p.connected && !p.bot) ? " · ghost" : "");
      li.appendChild(star);
      li.appendChild(who);
      if (p.ghost || (!p.connected && !p.bot)) li.classList.add("ghost");
      if (p.bot) li.classList.add("bot");
      if (p.id === lobbyPick) li.classList.add("pick");
      hud.roster.appendChild(li);
      if (p.id !== net.id && !p.bot && remotes[p.id]) {
        paintCar(remotes[p.id].r.mesh, p.body, p.wing);
      }
    });
    paintRaceNames();
  }

  function paintRaceNames() {
    if (!hud.raceNames) return;
    hud.raceNames.innerHTML = "";
    if (!mpMode || !net) return;
    (net.players || []).forEach(function (p) {
      var li = document.createElement("li");
      var skin = SKINS[p.slot % SKINS.length];
      li.textContent = (p.id === net.hostId ? "★ " : "") + (p.name || skin.name) + " #" + skin.num;
      if (p.id === net.id) li.className = "me";
      else if (p.bot) li.className = "bot";
      hud.raceNames.appendChild(li);
    });
  }

  function beginOnlineStart() {
    mpMode = true;
    var mine = (net.players || []).filter(function (p) {
      return p.id === net.id;
    })[0];
    var slot = mine ? mine.slot : 1;
    var g = gridSlot(slot);
    playerGridX = g.x;
    playerGridZ = g.z;
    adoptRoomTrack();
    resetGrid();
    touchCtl.gyroNeedCal = true;
    state = "start";
    setScreen("start");
    hud.startMsg.textContent = "PRE-START";
    hud.startMsg.className = "start-msg";
    paintLights(0, true);
    ensureAudio();
    sendNetState();
  }

  function goOnline() {
    if (state === "start") {
      paintLights(0, false);
      hud.startMsg.textContent = "GO";
      hud.startMsg.className = "start-msg go";
      applyLaunch();
      state = "racing";
      setScreen("racing");
      setRevSound(false);
    }
  }

  function enterOnlineRace(msg) {
    joining = false;
    mpMode = true;
    var you = (msg && msg.you) || {};
    var localMe = loadMe(net && net.room);
    var slot = you.slot != null ? you.slot : localMe && localMe.slot != null ? localMe.slot : 1;
    var g = gridSlot(slot);
    playerGridX = g.x;
    playerGridZ = g.z;
    adoptRoomTrack();
    resetGrid();
    var restore = null;
    if (msg && msg.rejoin && beenRacing(you)) restore = you;
    else if (beenRacing(you)) restore = you;
    else if (beenRacing(localMe)) restore = localMe;
    else if (msg && msg.rejoin && you && (you.x != null || you.fuel != null)) restore = you;
    else if (localMe) restore = localMe;
    if (restore) applyYou(restore);
    if (msg && msg.raceTime != null && isFinite(+msg.raceTime) && +msg.raceTime > 0) {
      raceTime = +msg.raceTime;
    } else if (restore && restore.raceTime != null && isFinite(+restore.raceTime)) {
      raceTime = +restore.raceTime;
    }
    ingestSnap((msg && msg.cars) || (net && net.snap) || []);
    var isLate = !!(msg && msg.late) || (!restore && (!msg || msg.phase === "racing"));
    if (isLate) lateJoinT = 8;
    state = "racing";
    setScreen("racing");
    setRevSound(false);
    persistMe();
    sendNetState();
  }

  function handleEnter(msg) {
    joining = false;
    if (hud.bootStatus) {
      hud.bootStatus.textContent = "";
      hud.bootStatus.classList.remove("err");
    }
    if (!msg) return;
    if (msg.speed != null) applyGameSpeed(msg.speed);
    else if (net && net.speed != null) applyGameSpeed(net.speed);
    if (state === "racing" && mpMode && msg.phase === "racing") {
      if (msg.rejoin || beenRacing(msg.you)) applyYou(msg.you);
      if (msg.raceTime != null && isFinite(+msg.raceTime) && +msg.raceTime > 0) {
        raceTime = +msg.raceTime;
      }
      if (msg.late && !msg.rejoin && !beenRacing(msg.you)) lateJoinT = 8;
      ingestSnap(msg.cars || (net && net.snap) || []);
      persistMe();
      return;
    }
    if (state === "start" && mpMode && msg.phase === "start") {
      ingestSnap(msg.cars || (net && net.snap) || []);
      return;
    }
    if (msg.phase === "lobby" || msg.phase === "finish") {
      state = "lobby";
      setScreen("lobby");
      paintRoster();
      if (msg.phase === "finish" && hud.lobbyStatus) {
        hud.lobbyStatus.textContent = "That race is over — host can grid up again";
      }
      return;
    }
    if (msg.phase === "start") {
      beginOnlineStart();
      ingestSnap(msg.cars || (net && net.snap) || []);
      return;
    }
    if (msg.phase === "racing") {
      enterOnlineRace(msg);
      return;
    }
    state = "lobby";
    setScreen("lobby");
    paintRoster();
    if (hud.lobbyErr) hud.lobbyErr.textContent = "Race already going — wait for the host";
  }

  function tick(ts) {
    var dt = lastTs ? (ts - lastTs) / 1000 : 0.016;
    lastTs = ts;
    dt = clamp(dt, 0, 0.05);
    var simDt = dt;
    if ((state === "start" || state === "racing") && mpMode) simDt = dt * gameSpeed;
    if (pitFlash > 0) pitFlash -= dt;
    if (launchT > 0) {
      launchT -= dt;
      if (launchT <= 0) {
        launchT = 0;
        launchMul = 1;
      }
    }
    if (launchCallT > 0) launchCallT -= dt;
    if (lateJoinT > 0) lateJoinT -= dt;

    if (state === "title" || state === "lobby") {
      titleCamera(dt);
      setRevSound(false);
    } else if (state === "start") {
      tickStart(simDt);
      if (mpMode) {
        poseRemotes();
        tickHostBots(simDt);
        sendNetState();
      }
    } else if (state === "racing") {
      raceTime += simDt;
      revs = 0;
      var input = playerInput();
      if (!inPitLane(player) && !pitServicing) {
        pitTimer = 0;
        pitUsedVisit = false;
      }
      if (pitServicing) {
        input = { steer: 0, throttle: false, reverse: false, brake: true };
        player.speed = 0;
        player.slide = 0;
        pitTimer += simDt;
        if (pitTimer >= PIT_HOLD) {
          player.fuel = 100;
          player.tires = 100;
          didPit = true;
          pitUsedVisit = true;
          pitServicing = false;
          pitTimer = 0;
          pitFlash = 1.2;
        }
      }
      applyMotion(player, input.steer, input.throttle, input.brake, input.reverse, simDt, true);
      bashAllWalls(player);
      emitRacerFx(player, input, simDt, true);
      if (!pitServicing && !pitUsedVisit && inPitGrab(player)) {
        pitServicing = true;
        pitTimer = 0;
        player.speed = 0;
        player.slide = 0;
        poseCar(player);
      }
      updateLaps(player);
      if (mpMode) {
        poseRemotes();
        tickHostBots(simDt);
        bashRemotes();
        bashRemotes();
        sendNetState();
      } else {
        updateCpu(cpus[0], simDt);
        updateCpu(cpus[1], simDt);
        bashCars(player, cpus[0]);
        bashCars(player, cpus[1]);
        bashCars(cpus[0], cpus[1]);
        bashCars(player, cpus[0]);
        bashCars(player, cpus[1]);
        bashCars(cpus[0], cpus[1]);
        bashAllWalls(player);
        bashAllWalls(cpus[0]);
        bashAllWalls(cpus[1]);
        emitRacerFx(cpus[0], null, simDt, false);
        emitRacerFx(cpus[1], null, simDt, false);
      }
      chaseCamera(dt);
      if (player.finished) finishRace();
    } else {
      chaseCamera(dt);
      setRevSound(false);
    }

    updateSky(dt);
    updateFx(dt);
    layoutNameTags();
    updateHud();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  function isChromeOS() {
    var ua = navigator.userAgent || "";
    var plat = "";
    try {
      plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    } catch (e) {
      plat = navigator.platform || "";
    }
    return /CrOS/i.test(ua) || /Chromebook/i.test(ua) || /Chrome OS/i.test(String(plat));
  }

  function isPhoneLike() {
    // Designer lock: Chromebooks are WASD/Space only — even a touchscreen
    // lid does not get the phone overlay.
    if (isChromeOS() || touchCtl.sawKeyboard) return false;
    var touch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    if (!touch) return false;
    var fine = false;
    var hover = false;
    try {
      fine = window.matchMedia("(pointer: fine)").matches;
      hover = window.matchMedia("(hover: hover)").matches;
    } catch (e) {}
    if (fine && hover) return false;
    var ua = navigator.userAgent || "";
    var phoneUA = /iPhone|iPod|Android.+Mobile|Windows Phone|IEMobile/i.test(ua);
    var tabletUA = /iPad|Android(?!.*Mobile)/i.test(ua);
    if (phoneUA || tabletUA) return true;
    var coarse = false;
    var noHover = false;
    try {
      coarse = window.matchMedia("(pointer: coarse)").matches;
      noHover = window.matchMedia("(hover: none)").matches;
    } catch (e2) {}
    return coarse && noHover && Math.min(screen.width, screen.height) <= 920;
  }

  function clearTouchDrive() {
    touchCtl.pads = {};
    touchCtl.gas = false;
    touchCtl.brake = false;
    touchCtl.rev = false;
    touchCtl.steer = 0;
  }

  function isLandscape() {
    return window.innerWidth >= window.innerHeight;
  }

  function needsTiltTap() {
    return (
      typeof window.DeviceOrientationEvent !== "undefined" &&
      typeof window.DeviceOrientationEvent.requestPermission === "function" &&
      !touchCtl.tiltGranted
    );
  }

  function showFirstMobileHint() {
    if (!hud.mobileHint || !isPhoneLike()) return;
    var seen = false;
    try {
      seen = localStorage.getItem("sk_mobile_hint") === "1";
    } catch (e) {}
    if (seen) return;
    hud.mobileHint.classList.remove("hidden");
    touchCtl.hintShown = true;
    try {
      localStorage.setItem("sk_mobile_hint", "1");
    } catch (e2) {}
    setTimeout(function () {
      if (hud.mobileHint) hud.mobileHint.classList.add("hidden");
    }, 5600);
  }

  function syncMobileUi() {
    var phone = isPhoneLike();
    var drive = state === "start" || state === "racing";
    if (!phone) clearTouchDrive();
    if (hud.touchLayer) hud.touchLayer.classList.toggle("hidden", !(phone && drive));
    if (hud.rotateHint) {
      hud.rotateHint.classList.toggle("hidden", !(phone && drive && !isLandscape()));
    }
    if (hud.tiltBtn) {
      hud.tiltBtn.classList.toggle("hidden", !(phone && drive && needsTiltTap()));
    }
    if (hud.revHint && phone) {
      hud.revHint.textContent = "HOLD the right half to climb — lift to catch the green. Past the mark dumps.";
    }
    if (phone && !touchCtl.hintShown) showFirstMobileHint();
  }

  function screenAngle() {
    if (window.screen && screen.orientation && typeof screen.orientation.angle === "number") {
      return screen.orientation.angle;
    }
    if (typeof window.orientation === "number") return window.orientation;
    return isLandscape() ? 90 : 0;
  }

  function tiltRaw(e) {
    var ang = screenAngle();
    if (ang === 90) return Number(e.beta) || 0;
    if (ang === -90 || ang === 270) return -(Number(e.beta) || 0);
    if (ang === 180) return -(Number(e.gamma) || 0);
    return Number(e.gamma) || 0;
  }

  function applyGyro(raw) {
    if (touchCtl.gyroNeedCal) {
      touchCtl.gyroCenter = raw;
      touchCtl.gyroNeedCal = false;
    }
    var d = raw - touchCtl.gyroCenter;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    var dead = 18;
    if (Math.abs(d) < dead) {
      touchCtl.steer = 0;
      return;
    }
    var mag = clamp((Math.abs(d) - dead) / 34, 0, 1);
    // Match keyboard: A / left = +steer, D / right = -steer.
    touchCtl.steer = (d > 0 ? -1 : 1) * mag;
  }

  function onOrient(e) {
    if (!isPhoneLike()) return;
    if (state !== "start" && state !== "racing") return;
    if (!isLandscape()) {
      touchCtl.steer = 0;
      return;
    }
    applyGyro(tiltRaw(e));
  }

  function askTiltPermission() {
    if (!isPhoneLike()) return;
    if (touchCtl.tiltAsked && touchCtl.tiltGranted) return;
    touchCtl.tiltAsked = true;
    if (
      typeof window.DeviceOrientationEvent !== "undefined" &&
      typeof window.DeviceOrientationEvent.requestPermission === "function"
    ) {
      window.DeviceOrientationEvent.requestPermission()
        .then(function (s) {
          touchCtl.tiltGranted = s === "granted";
          if (touchCtl.tiltGranted) {
            window.addEventListener("deviceorientation", onOrient, true);
            touchCtl.gyroNeedCal = true;
          }
          syncMobileUi();
        })
        .catch(function () {
          touchCtl.tiltGranted = false;
          syncMobileUi();
        });
      return;
    }
    touchCtl.tiltGranted = true;
    window.addEventListener("deviceorientation", onOrient, true);
    touchCtl.gyroNeedCal = true;
    syncMobileUi();
  }

  function syncPads() {
    var gas = false;
    var brake = false;
    var id;
    for (id in touchCtl.pads) {
      if (!Object.prototype.hasOwnProperty.call(touchCtl.pads, id)) continue;
      if (touchCtl.pads[id] === "gas") gas = true;
      if (touchCtl.pads[id] === "brake") brake = true;
    }
    touchCtl.gas = gas;
    touchCtl.brake = brake;
  }

  function bindMobile() {
    var layer = hud.touchLayer;
    if (!layer) return;
    layer.addEventListener("pointerdown", function (e) {
      if (!isPhoneLike()) return;
      if (e.target && e.target.id === "rev-btn") return;
      e.preventDefault();
      var half = e.clientX >= window.innerWidth * 0.5 ? "gas" : "brake";
      touchCtl.pads[e.pointerId] = half;
      syncPads();
      try {
        layer.setPointerCapture(e.pointerId);
      } catch (err) {}
    });
    function endPad(e) {
      delete touchCtl.pads[e.pointerId];
      syncPads();
    }
    layer.addEventListener("pointerup", endPad);
    layer.addEventListener("pointercancel", endPad);
    layer.addEventListener("pointerleave", endPad);
    if (hud.revBtn) {
      hud.revBtn.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        touchCtl.rev = true;
        hud.revBtn.classList.add("held");
      });
      function endRev(e) {
        e.stopPropagation();
        touchCtl.rev = false;
        hud.revBtn.classList.remove("held");
      }
      hud.revBtn.addEventListener("pointerup", endRev);
      hud.revBtn.addEventListener("pointercancel", endRev);
      hud.revBtn.addEventListener("pointerleave", endRev);
    }
    if (hud.tiltBtn) {
      hud.tiltBtn.addEventListener("click", function (e) {
        e.preventDefault();
        askTiltPermission();
      });
    }
    if (isPhoneLike() && !needsTiltTap()) {
      window.addEventListener("deviceorientation", onOrient, true);
      touchCtl.tiltGranted = true;
    }
  }

  function hexCss(n) {
    return "#" + ("000000" + (n | 0).toString(16)).slice(-6);
  }

  function persistPaint() {
    try {
      localStorage.setItem("sk_body", String(playerBody));
      localStorage.setItem("sk_wing", String(playerWing));
    } catch (e) {}
    if (net) {
      net.body = playerBody;
      net.wing = playerWing;
    }
    paintCar(player.mesh, playerBody, playerWing);
    paintGarage();
  }

  function paintGarage() {
    function fill(el, list, cur, which) {
      if (!el) return;
      el.innerHTML = "";
      list.forEach(function (hex) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "swatch" + (hex === cur ? " on" : "");
        b.style.background = hexCss(hex);
        b.setAttribute("aria-label", which + " " + hexCss(hex));
        b.addEventListener("click", function () {
          if (which === "body") playerBody = hex;
          else playerWing = hex;
          persistPaint();
        });
        el.appendChild(b);
      });
    }
    fill(hud.bodySwatches, BODY_SWATCHES, playerBody, "body");
    fill(hud.wingSwatches, WING_SWATCHES, playerWing, "wing");
  }

  function typingField(el) {
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
  }

  function onKey(e, down) {
    if (typingField(e.target)) {
      if (down && e.code === "Enter" && e.target.id === "join-code") {
        openFriends("join", e.target.value);
        e.preventDefault();
      }
      return;
    }
    keys[e.code] = down;
    if (down) {
      if (
        e.code === "KeyW" ||
        e.code === "KeyA" ||
        e.code === "KeyS" ||
        e.code === "KeyD" ||
        e.code === "ArrowUp" ||
        e.code === "ArrowDown" ||
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight" ||
        e.code === "Space"
      ) {
        touchCtl.sawKeyboard = true;
        clearTouchDrive();
        syncMobileUi();
      }
    }
    if (down) ensureAudio();
    if (down && (e.code === "Space" || e.code === "Enter")) {
      if (state === "title") {
        if (!joining) startSequence();
      }
      else if (state === "lobby" && e.code === "Enter" && net && net.isHost()) net.start();
      else if (state === "finished" && !mpMode) startSequence();
      else if (state === "finished" && mpMode) {
        state = "lobby";
        setScreen("lobby");
        paintRoster();
      }
      e.preventDefault();
    }
    if (
      e.code === "ArrowUp" ||
      e.code === "ArrowDown" ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight" ||
      e.code === "Space"
    ) {
      e.preventDefault();
    }
  }

  window.addEventListener("keydown", function (e) {
    onKey(e, true);
  });
  window.addEventListener("keyup", function (e) {
    onKey(e, false);
  });
  window.addEventListener("blur", function () {
    keys = Object.create(null);
    touchCtl.pads = {};
    touchCtl.gas = false;
    touchCtl.brake = false;
    touchCtl.rev = false;
    // pitTimer stays on blur. Leave the pit lane to reset a visit.
  });
  window.addEventListener("resize", function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    layoutCamera();
    syncMobileUi();
  });

  function showBoot(text, isErr) {
    if (!hud.bootStatus) return;
    hud.bootStatus.textContent = text || "";
    hud.bootStatus.classList.toggle("err", !!isErr);
  }

  function openFriends(action, code) {
    if (!net) {
      showBoot("Net script missing — solo still works", true);
      if (hud.lobbyErr) hud.lobbyErr.textContent = "Net script missing — solo still works";
      return;
    }
    joining = true;
    readDisplayName();
    showBoot(action === "create" ? "Creating room…" : "Joining " + String(code || "").toUpperCase() + "…", false);
    if (hud.lobbyErr) hud.lobbyErr.textContent = "";
    net.connect(function (err) {
      if (err) {
        joining = false;
        showBoot("Server offline — play solo", true);
        if (hud.lobbyErr) hud.lobbyErr.textContent = "Server offline — play solo";
        return;
      }
      if (action === "create") net.create(readDisplayName());
      else net.join(code, readDisplayName());
    });
  }

  if (net) {
    net.on("enter", handleEnter);
    net.on("room", function (msg) {
      if (net.phase === "lobby" || net.phase === "finish") {
        joining = false;
        if (state === "title" || state === "lobby" || state === "finished") {
          state = "lobby";
          setScreen("lobby");
        }
        if (net.phase === "finish" && hud.lobbyStatus) {
          hud.lobbyStatus.textContent = "That race is over — host can grid up again";
        }
      } else if (
        (net.phase === "start" || net.phase === "racing") &&
        (state === "title" || state === "lobby")
      ) {
        handleEnter({
          phase: net.phase,
          startPhase: net.startPhase,
          redsOn: net.redsOn,
          holdDelay: net.holdDelay,
          raceTime: (msg && msg.raceTime) || 0,
          you: loadMe(net.room) || {},
          cars: net.snap || [],
          late: net.phase === "racing" && !beenRacing(loadMe(net.room)),
          rejoin: beenRacing(loadMe(net.room)),
        });
      }
      if (msg && msg.track != null) maybeApplyNetTrack(msg.track);
      paintRoster();
    });
    net.on("lights", function () {
      if (state === "lobby" || state === "title") beginOnlineStart();
    });
    net.on("go", goOnline);
    net.on("snap", function (msg) {
      ingestSnap(msg.cars);
      if (
        mpMode &&
        state === "racing" &&
        msg.raceTime != null &&
        isFinite(+msg.raceTime) &&
        Math.abs(raceTime - msg.raceTime) > 1
      ) {
        raceTime = +msg.raceTime;
      }
    });
    net.on("kicked", function () {
      mpMode = false;
      joining = false;
      lateJoinT = 0;
      clearMe();
      clearRemotes();
      clearHostBots();
      applyGameSpeed(1);
      if (net) {
        try {
          sessionStorage.removeItem("sk_room");
        } catch (e) {}
        net.leave();
      }
      restoreLocalTrack();
      state = "title";
      setScreen("title");
      showBoot("Host kicked you", true);
    });
    net.on("err", function (text) {
      joining = false;
      showBoot(text || net.err || "Could not join", true);
      paintRoster();
    });
    net.on("drop", function () {
      persistMe();
      if (!mpMode || !net.room) return;
      net.connect(function (err) {
        if (!err) net.join(net.room, readDisplayName());
      });
    });
  }

  var btnSolo = document.getElementById("btn-solo");
  var btnCreate = document.getElementById("btn-create");
  var btnJoin = document.getElementById("btn-join");
  var btnGrid = document.getElementById("btn-grid");
  var btnLeave = document.getElementById("btn-leave");
  var btnAddBot = document.getElementById("btn-add-bot");
  var btnRemoveBot = document.getElementById("btn-remove-bot");
  var btnKick = document.getElementById("btn-kick");
  var joinCode = document.getElementById("join-code");
  if (hud.roster) {
    hud.roster.addEventListener("click", function (e) {
      var t = e.target;
      while (t && t !== hud.roster && (!t.getAttribute || !t.getAttribute("data-id"))) t = t.parentNode;
      if (!t || t === hud.roster) return;
      lobbyPick = t.getAttribute("data-id") || "";
      paintRoster();
    });
  }
  if (btnKick) {
    btnKick.addEventListener("click", function () {
      if (!net || !net.isHost()) return;
      var id = lobbyPick;
      var p;
      if (id) {
        for (var i = 0; i < (net.players || []).length; i++) {
          if (net.players[i].id === id) p = net.players[i];
        }
      }
      if (!p || p.bot || p.id === net.hostId) {
        p = null;
        for (var j = 0; j < (net.players || []).length; j++) {
          var cand = net.players[j];
          if (!cand.bot && cand.id !== net.hostId) {
            p = cand;
            break;
          }
        }
      }
      if (p) net.kick(p.id);
    });
  }
  if (btnAddBot) {
    btnAddBot.addEventListener("click", function () {
      if (net && net.isHost()) net.addBot();
    });
  }
  if (hud.bowieBtn) {
    hud.bowieBtn.addEventListener("click", function () {
      if (net && net.isHost() && !hud.bowieBtn.disabled) net.addBowie();
    });
  }
  if (btnRemoveBot) {
    btnRemoveBot.addEventListener("click", function () {
      if (!net || !net.isHost()) return;
      var bot = null;
      for (var i = 0; i < (net.players || []).length; i++) {
        if (net.players[i].bot && net.players[i].id === lobbyPick) bot = net.players[i];
      }
      if (!bot) {
        for (var j = (net.players || []).length - 1; j >= 0; j--) {
          if (net.players[j].bot) {
            bot = net.players[j];
            break;
          }
        }
      }
      if (bot) net.removeBot(bot.id);
    });
  }
  if (hud.speedBtn) {
    hud.speedBtn.addEventListener("click", function () {
      if (!net || !net.isHost()) return;
      var i = SPEED_STEPS.indexOf(gameSpeed);
      if (i < 0) i = 0;
      net.setSpeed(SPEED_STEPS[(i + 1) % SPEED_STEPS.length]);
    });
  }
  if (hud.nameInput) {
    try {
      var savedName = sessionStorage.getItem("sk_name") || "";
      if (savedName) hud.nameInput.value = savedName;
    } catch (eName) {}
    readDisplayName();
    hud.nameInput.addEventListener("change", readDisplayName);
    hud.nameInput.addEventListener("blur", readDisplayName);
  }
  if (joinCode) {
    function keepJoinFocus() {
      joinCode.focus();
    }
    joinCode.addEventListener("pointerdown", keepJoinFocus);
    joinCode.addEventListener("mousedown", keepJoinFocus);
    joinCode.addEventListener("touchstart", keepJoinFocus, { passive: true });
    joinCode.addEventListener("input", function () {
      var caret = joinCode.selectionStart;
      var next = String(joinCode.value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);
      if (next !== joinCode.value) {
        joinCode.value = next;
        try {
          joinCode.setSelectionRange(caret, caret);
        } catch (e) {}
      }
    });
  }
  if (btnSolo) {
    btnSolo.addEventListener("click", function () {
      joining = false;
      lateJoinT = 0;
      clearMe();
      if (net) net.leave();
      startSequence();
    });
  }
  if (btnCreate) {
    btnCreate.addEventListener("click", function () {
      openFriends("create");
    });
  }
  if (btnJoin) {
    btnJoin.addEventListener("click", function () {
      openFriends("join", joinCode && joinCode.value);
    });
  }
  if (btnGrid) {
    btnGrid.addEventListener("click", function () {
      if (net && net.isHost()) net.start();
    });
  }
  if (btnLeave) {
    btnLeave.addEventListener("click", function () {
      mpMode = false;
      joining = false;
      lateJoinT = 0;
      clearMe();
      if (net) net.leave();
      clearRemotes();
      clearHostBots();
      applyGameSpeed(1);
      restoreLocalTrack();
      state = "title";
      setScreen("title");
      showBoot("");
    });
  }

  var btnTrack = document.getElementById("btn-track");
  var btnTrackUndo = document.getElementById("btn-track-undo");
  var btnTrackCampus = document.getElementById("btn-track-campus");
  var btnTrackCopy = document.getElementById("btn-track-copy");
  var btnTrackDone = document.getElementById("btn-track-done");
  if (btnTrack) {
    btnTrack.addEventListener("click", function () {
      if (state !== "title") return;
      state = "track";
      tilePick = "";
      tileSel = "";
      editorDrag = null;
      setScreen("track");
      paintTrackEditor();
    });
  }

  function tileFromNode(el) {
    while (el && el !== document.body) {
      if (el.getAttribute) {
        if (el.id === "tile-trash") return { kind: "trash", el: el };
        if (el.id === "btn-tile-rot") return { kind: "rot", el: el };
        if (el.hasAttribute("data-x") && el.hasAttribute("data-y")) {
          return {
            kind: "cell",
            el: el,
            x: +el.getAttribute("data-x"),
            y: +el.getAttribute("data-y"),
            ch: el.getAttribute("data-tile") || "",
            rot: +(el.getAttribute("data-rot") || 0),
          };
        }
        if (el.hasAttribute("data-tile") && el.classList.contains("palette-tile")) {
          return { kind: "palette", el: el, ch: el.getAttribute("data-tile") };
        }
      }
      el = el.parentNode;
    }
    return null;
  }

  function clearDropMarks() {
    var marks = document.querySelectorAll(".tile-cell.drop, .tile-trash.drop");
    var i;
    for (i = 0; i < marks.length; i++) marks[i].classList.remove("drop");
  }

  function killGhost() {
    if (editorDrag && editorDrag.ghost && editorDrag.ghost.parentNode) {
      editorDrag.ghost.parentNode.removeChild(editorDrag.ghost);
    }
  }

  function hitAt(x, y) {
    return tileFromNode(document.elementFromPoint(x, y));
  }

  function isEditorChrome(el) {
    while (el && el !== document.body) {
      if (el.id === "track-paste" || el.id === "btn-tile-rot") return true;
      if (el.classList && (el.classList.contains("lobby-btn") || el.classList.contains("lobby-row") || el.classList.contains("tile-rot"))) return true;
      el = el.parentNode;
    }
    return false;
  }

  function startEditorDrag(e, hit) {
    if (!hit || (hit.kind !== "palette" && hit.kind !== "cell")) return;
    if (hit.kind === "cell" && !hit.ch) return;
    var ghost = document.createElement("div");
    ghost.className = "tile-ghost";
    ghost.style.backgroundImage = "url(" + tileArt(hit.ch, hit.rot || 0, 72) + ")";
    document.body.appendChild(ghost);
    ghost.style.left = e.clientX + "px";
    ghost.style.top = e.clientY + "px";
    editorDrag = {
      from: hit.kind,
      ch: hit.ch,
      rot: hit.rot || 0,
      x: hit.x,
      y: hit.y,
      ghost: ghost,
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      live: false,
    };
    try {
      hit.el.setPointerCapture(e.pointerId);
    } catch (err) {}
  }

  function moveEditorDrag(e) {
    if (!editorDrag || e.pointerId !== editorDrag.pointerId) return;
    var dx = e.clientX - editorDrag.x0;
    var dy = e.clientY - editorDrag.y0;
    if (!editorDrag.live && dx * dx + dy * dy > 36) editorDrag.live = true;
    if (!editorDrag.ghost) return;
    editorDrag.ghost.style.left = e.clientX + "px";
    editorDrag.ghost.style.top = e.clientY + "px";
    if (!editorDrag.live) return;
    clearDropMarks();
    var over = hitAt(e.clientX, e.clientY);
    if (over && over.el && (over.kind === "cell" || over.kind === "trash")) over.el.classList.add("drop");
  }

  function endEditorDrag(e) {
    if (!editorDrag || (e && e.pointerId !== editorDrag.pointerId && e.pointerId != null)) return;
    var x = e && e.clientX != null ? e.clientX : editorDrag.x0;
    var y = e && e.clientY != null ? e.clientY : editorDrag.y0;
    var live = editorDrag.live;
    var from = editorDrag.from;
    var ch = editorDrag.ch;
    var rot = editorDrag.rot;
    var sx = editorDrag.x;
    var sy = editorDrag.y;
    killGhost();
    clearDropMarks();
    editorDrag = null;
    var over = hitAt(x, y);
    if (!live) {
      if (from === "palette") {
        tilePick = tilePick === ch ? "" : ch;
        paintTrackEditor();
      } else if (from === "cell") {
        var key = mapKey(sx, sy);
        if (tilePick && !ch) placePiece(tilePick, sx, sy, 0);
        else if (tileSel === key && ch) rotatePiece(sx, sy);
        else {
          tileSel = ch ? key : "";
          if (tilePick && !ch) placePiece(tilePick, sx, sy, 0);
          else paintTrackEditor();
        }
      }
      return;
    }
    if (from === "palette") {
      if (over && over.kind === "cell") placePiece(ch, over.x, over.y, 0);
      return;
    }
    if (from === "cell") {
      if (over && over.kind === "cell") movePiece(sx, sy, over.x, over.y);
      else if (over && over.kind === "trash") deletePiece(sx, sy);
      else if (isEditorChrome(document.elementFromPoint(x, y))) return;
      else deletePiece(sx, sy);
    }
  }

  function bindTrackEditor() {
    var root = hud.trackScreen;
    if (!root) return;
    root.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      if (e.target && (e.target.tagName === "INPUT" || (e.target.closest && e.target.closest("input,button.lobby-btn")))) return;
      var hit = tileFromNode(e.target);
      if (hit && hit.kind === "rot") {
        e.preventDefault();
        rotateSelected();
        return;
      }
      if (!hit || (hit.kind !== "palette" && hit.kind !== "cell")) return;
      e.preventDefault();
      startEditorDrag(e, hit);
    });
    root.addEventListener("pointermove", function (e) {
      if (editorDrag) {
        e.preventDefault();
        moveEditorDrag(e);
      }
    });
    root.addEventListener("pointerup", endEditorDrag);
    root.addEventListener("pointercancel", endEditorDrag);
    document.addEventListener(
      "touchmove",
      function (e) {
        if (editorDrag) e.preventDefault();
      },
      { passive: false }
    );
    if (hud.tileBoard) {
      hud.tileBoard.addEventListener("click", function (e) {
        if (editorDrag) return;
        var hit = tileFromNode(e.target);
        if (hit && hit.kind === "cell" && tilePick && !hit.ch) placePiece(tilePick, hit.x, hit.y, 0);
      });
    }
    if (hud.tileRot) {
      hud.tileRot.addEventListener("click", function (e) {
        e.preventDefault();
        rotateSelected();
      });
    }
  }
  bindTrackEditor();

  if (btnTrackUndo) {
    btnTrackUndo.addEventListener("click", function () {
      if (!trackUndo.length) {
        if (trackCode.charAt(0) === "M") return;
        applyTrack(trackCode.slice(0, -1), true);
        return;
      }
      applyTrack(trackUndo.pop(), true);
      if (net && net.active && net.isHost() && net.setTrack) net.setTrack(trackCode);
    });
  }
  if (btnTrackCampus) {
    btnTrackCampus.addEventListener("click", function () {
      restoreCampusLoop();
    });
  }
  if (btnTrackCopy) {
    btnTrackCopy.addEventListener("click", function () {
      var s = trackCode || "";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(s).catch(function () {});
      }
      if (hud.trackPaste) {
        hud.trackPaste.value = s;
        hud.trackPaste.select();
      }
    });
  }
  if (btnTrackDone) {
    btnTrackDone.addEventListener("click", function () {
      if (net && net.active && net.isHost() && net.setTrack) net.setTrack(trackCode);
      killGhost();
      tilePick = "";
      editorDrag = null;
      state = "title";
      setScreen("title");
    });
  }
  if (hud.trackPaste) {
    hud.trackPaste.addEventListener("change", function () {
      commitTrack(hud.trackPaste.value);
    });
  }

  addWorld();
  initFx();
  bindMobile();
  paintGarage();
  persistPaint();
  try {
    var savedTrack = localStorage.getItem("sk_track") || "";
    if (savedTrack) applyTrack(savedTrack, false);
  } catch (eTrack) {}
  resetGrid();
  setScreen("title");

  var savedRoom = "";
  try {
    savedRoom = sessionStorage.getItem("sk_room") || "";
  } catch (e) {}
  if (savedRoom && net) {
    if (joinCode) joinCode.value = savedRoom;
    showBoot("Rejoining " + savedRoom + "…", false);
    openFriends("join", savedRoom);
  }

  window.addEventListener("pagehide", persistMe);
  window.addEventListener("beforeunload", persistMe);

  requestAnimationFrame(tick);
})();
