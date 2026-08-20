/* SchoolKart — Campus Loop
   Creative lead: Zachary McUne
   Feel spec: Pit Crew Designer (fuel/tires/handling locked)

   Controls: W gas, Space brake, S reverse, A/D steer.
   Pit: peel LEFT onto a split lane. Halfway in, the car is grabbed
   and serviced ~2.5s, then released to drive out. One service per visit.
   Start: PRE-START blue flash, five reds at 1s, hold 0.2–3s all ON,
   lights out = GO. Fuel starts then. Car is locked to the grid until GO.
   W is a timing game — land the needle in the green for a launch. */
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
  var ASPHALT = 8.6;
  var GRASS_MAX = 8.5;
  var GRASS_ROLL = 4;
  var GRASS_DUMP = 40;
  var TIRE_FLOOR = 22;
  var TEAL = 0x2ec8c3;
  var TEAL_DEEP = 0x148f8c;
  var HIT_RADIUS = 2.55;

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
    { x0: -80, x1: 24, z0: -73.2, z1: -62.0 },
    { x0: -28, x1: 40, z0: -69.0, z1: -56.6 },
    PIT_LANE,
    PIT_GRAB,
    { x0: 96, x1: 155, z0: -69.0, z1: -56.6 },
    { x0: 124, x1: 180, z0: -73.2, z1: -62.0 },
  ];

  var keys = Object.create(null);
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
  renderer.setClearColor(0xff9a54, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  function layoutCamera() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[0] *= -1;
  }

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffb072, 140, 560);

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
    if (net) net.name = n;
    player.name = n;
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

  var RIBBON_SEGS = Math.max(360, Math.round(TRACK_LEN / 2.4));

  function pointOnSeg(seg, u) {
    if (seg.type === "line") {
      return {
        x: seg.ax + (seg.bx - seg.ax) * u,
        z: seg.az + (seg.bz - seg.az) * u,
        h: Math.atan2(seg.bz - seg.az, seg.bx - seg.ax),
        name: seg.name,
      };
    }
    var a = seg.a0 + (seg.a1 - seg.a0) * u;
    return {
      x: seg.cx + Math.cos(a) * seg.r,
      z: seg.cz + Math.sin(a) * seg.r,
      h: seg.a1 >= seg.a0 ? a + Math.PI * 0.5 : a - Math.PI * 0.5,
      name: seg.name,
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
  (function bakeMini() {
    var n = 140;
    var i;
    var x0 = Infinity;
    var z0 = Infinity;
    var x1 = -Infinity;
    var z1 = -Infinity;
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
  })();

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
    var onAsphalt = dist <= ASPHALT || onPitPavement(px, pz);
    return {
      x: best.x,
      z: best.z,
      dist: dist,
      h: best.h,
      s: bestS,
      name: best.name,
      onAsphalt: onAsphalt,
      inPit: inPit,
      grass: !onAsphalt,
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
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide }));
  }

  function makeRibbon(half, y, color, onlyNames) {
    var segs = RIBBON_SEGS;
    var pos = [];
    var idx = [];
    var used = 0;
    for (var i = 0; i <= segs; i++) {
      var p = centerlinePoint((i / segs) * TRACK_LEN);
      if (onlyNames && onlyNames.indexOf(p.name) === -1) continue;
      var nx = -Math.sin(p.h);
      var nz = Math.cos(p.h);
      pos.push(p.x + nx * half, y, p.z + nz * half);
      pos.push(p.x - nx * half, y, p.z - nz * half);
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
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide }));
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
    scene.add(mesh);
    return mesh;
  }

  function addWorld() {
    scene.add(new THREE.HemisphereLight(0xffd4a8, 0x3d6a28, 1.05));
    var sun = new THREE.DirectionalLight(0xffc078, 0.85);
    sun.position.set(90, 26, -50);
    scene.add(sun);

    addBox(-40, -0.2, 80, 1100, 0.4, 900, 0x4e8c32);
    addBox(8, 0.02, 40, 120, 0.06, 90, 0x5a9a3a);
    var apron = makeRibbon(ASPHALT + 11, 0.03, 0x6aaa40, null);
    if (apron) scene.add(apron);
    var runoff = makeRibbon(ASPHALT + 5.4, 0.045, 0xe0b85a, null);
    if (runoff) scene.add(runoff);

    scene.add(makeRibbon(ASPHALT, 0.07, 0x10100e, null));
    scene.add(makeRibbon(0.42, 0.095, 0xffffff, null));
    scene.add(makeEdges(ASPHALT - 0.38, 0.22, 0.096, 0xf4f1e6));
    scene.add(makeEdges(-(ASPHALT - 0.38), 0.22, 0.096, 0xf4f1e6));
    var kerb90 = makeRibbon(ASPHALT + 0.78, 0.085, 0xff2a44, ["the90"]);
    var kerbHair = makeRibbon(ASPHALT + 0.78, 0.085, 0xff2a44, ["hairpin"]);
    var kerbSweep = makeRibbon(ASPHALT + 0.78, 0.085, 0xff2a44, ["sweeper"]);
    var kerbChi = makeRibbon(ASPHALT + 0.78, 0.085, 0xff2a44, ["chicane"]);
    var kerbW90 = makeRibbon(ASPHALT + 0.38, 0.086, 0xffffff, ["the90"]);
    var kerbWHair = makeRibbon(ASPHALT + 0.38, 0.086, 0xffffff, ["hairpin"]);
    var kerbWSweep = makeRibbon(ASPHALT + 0.38, 0.086, 0xffffff, ["sweeper"]);
    var kerbWChi = makeRibbon(ASPHALT + 0.38, 0.086, 0xffffff, ["chicane"]);
    if (kerb90) scene.add(kerb90);
    if (kerbHair) scene.add(kerbHair);
    if (kerbSweep) scene.add(kerbSweep);
    if (kerbChi) scene.add(kerbChi);
    if (kerbW90) scene.add(kerbW90);
    if (kerbWHair) scene.add(kerbWHair);
    if (kerbWSweep) scene.add(kerbWSweep);
    if (kerbWChi) scene.add(kerbWChi);

    for (var p = 0; p < PIT_PAVE.length; p++) {
      paveRect(PIT_PAVE[p], 0.08, 0x3d4a5c);
    }
    paveRect(PIT_GRAB, 0.12, TEAL);
    addBox((PIT_LANE.x0 + PIT_LANE.x1) * 0.5, 0.115, PIT_LANE.z0, PIT_LANE.x1 - PIT_LANE.x0, 0.03, 0.34, 0xffe566);
    addBox((PIT_LANE.x0 + PIT_LANE.x1) * 0.5, 0.115, PIT_LANE.z1, PIT_LANE.x1 - PIT_LANE.x0, 0.03, 0.34, 0x7cffd4);
    // Pit wall between the racing line and the bypass — this is a side lane.
    addBox(62, 0.82, -69.6, 70, 1.55, 0.62, 0x2a2018);
    addBox(62, 1.62, -69.6, 70, 0.12, 0.7, TEAL);
    var pitDecal = labelPlane("PIT", 7.2, 2.8, "#0a2a28", "#2ec8c3");
    pitDecal.rotation.x = -Math.PI * 0.5;
    pitDecal.position.set(72, 0.16, -62.0);
    scene.add(pitDecal);
    var inDecal = labelPlane("IN", 5.4, 2.2, "#102018", "#ffe566");
    inDecal.rotation.x = -Math.PI * 0.5;
    inDecal.position.set(-20, 0.16, -66);
    scene.add(inDecal);
    var outDecal = labelPlane("OUT", 5.8, 2.2, "#102018", "#7cffd4");
    outDecal.rotation.x = -Math.PI * 0.5;
    outDecal.position.set(148, 0.16, -66);
    scene.add(outDecal);
    for (var hsh = 0; hsh < 5; hsh++) {
      addBox(62 + hsh * 3.6, 0.14, -62.0, 1.15, 0.02, 9.2, 0xffffff);
    }

    var stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.14, ASPHALT * 2),
      new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    stripe.position.set(0, 0.1, SF_Z);
    scene.add(stripe);

    var gxs = [-6, -14, -22];
    var gzs = [SF_Z + 2.7, SF_Z - 2.7, SF_Z + 2.7];
    for (var gb = 0; gb < 3; gb++) {
      addBox(gxs[gb], 0.09, gzs[gb], 5.2, 0.03, 2.6, 0xffffff);
      addBox(gxs[gb], 0.1, gzs[gb], 4.6, 0.02, 0.12, 0x111111);
    }

    var gy = SF_Z - ASPHALT - 1.1;
    addBox(0, 6.4, gy, 12, 0.35, 0.35, 0x2a2018);
    addBox(-5.2, 5.1, gy, 0.3, 6.4, 0.3, 0x2a2018);
    addBox(5.2, 5.1, gy, 0.3, 6.4, 0.3, 0x2a2018);
    gantryBlues.push(addBox(-4.4, 6.55, gy, 1.1, 0.7, 0.4, 0x1a3040));
    gantryBlues.push(addBox(4.4, 6.55, gy, 1.1, 0.7, 0.4, 0x1a3040));
    for (var li = 0; li < 5; li++) {
      gantryReds.push(addBox(-2.4 + li * 1.2, 6.55, gy, 0.7, 0.7, 0.4, 0x3a1010));
    }

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
    addBox(8, 0.35, -30, 24, 0.16, 32, 0x6f9a42);
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

    function cornerFlag(x, z, title) {
      addBox(x, 1.4, z, 0.2, 2.8, 0.2, 0x2a2018);
      var pl = labelPlane(title, 7.4, 2.2, "#f4efe6", "#148f8c");
      pl.position.set(x, 3.2, z);
      scene.add(pl);
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
      var p = centerlinePoint(s);
      var nx = -Math.sin(p.h);
      var nz = Math.cos(p.h);
      cornerFlag(p.x + nx * (ASPHALT + 7) * side, p.z + nz * (ASPHALT + 7) * side, title);
    }
    flagOn("the90", "THE 90", -1);
    flagOn("chicane", "CHICANE", 1);
    flagOn("hairpin", "HAIRPIN", -1);
    flagOn("sweeper", "SWEEPER", 1);

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
    g.scale.setScalar(2.35);
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
      sky.from = new THREE.Vector3(x - 20, 34, -190);
      sky.to = new THREE.Vector3(x + 40, 40, 170);
    } else {
      sky.from = new THREE.Vector3(x + 40, 36, 175);
      sky.to = new THREE.Vector3(x - 20, 40, -185);
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
      var a = sky.t * 0.052;
      var bx = -40 + Math.cos(a) * 102;
      var bz = 22 + Math.sin(a) * 86;
      var by = 42 + Math.sin(a * 2.1) * 2.4;
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
          player.x > -40 &&
          Math.cos(player.heading) > 0.4
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
      emissiveIntensity: glow == null ? 0.26 : glow,
      side: THREE.DoubleSide,
    });
  }

  function makeCar(bodyColor, wingColor, num) {
    var g = new THREE.Group();
    var body = carMat(bodyColor, 0.28);
    var wing = carMat(wingColor || TEAL_DEEP, 0.22);
    var halo = carMat(0xf4efe6, 0.18);

    var nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.28, 0.42), body);
    nose.position.set(1.55, 0.38, 0);
    g.add(nose);
    var tub = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 0.72), body);
    tub.position.set(0.15, 0.42, 0);
    g.add(tub);
    var cover = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.38, 0.62), body);
    cover.position.set(-0.85, 0.5, 0);
    g.add(cover);
    var airbox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.32), body);
    airbox.position.set(-0.55, 0.82, 0);
    g.add(airbox);

    var fw = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 1.85), wing);
    fw.position.set(2.35, 0.22, 0);
    g.add(fw);
    addBox(2.35, 0.28, 0.92, 0.32, 0.28, 0.08, TEAL_DEEP, g);
    addBox(2.35, 0.28, -0.92, 0.32, 0.28, 0.08, TEAL_DEEP, g);
    var rw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 1.55), wing);
    rw.position.set(-1.7, 0.95, 0);
    g.add(rw);
    addBox(-1.7, 0.75, 0.78, 0.2, 0.5, 0.08, TEAL_DEEP, g);
    addBox(-1.7, 0.75, -0.78, 0.2, 0.5, 0.08, TEAL_DEEP, g);

    if (num) {
      var tex = numberDecal(num);
      var side = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 0.4),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
      );
      side.position.set(-0.15, 0.62, 0.38);
      g.add(side);
      var side2 = side.clone();
      side2.position.z = -0.38;
      side2.rotation.y = Math.PI;
      g.add(side2);
      var rear = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.32),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
      );
      rear.position.set(-1.72, 0.95, 0);
      rear.rotation.y = Math.PI * 0.5;
      g.add(rear);
    }

    var haloM = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 10, Math.PI), halo);
    haloM.rotation.x = Math.PI * 0.5;
    haloM.rotation.z = Math.PI * 0.5;
    haloM.position.set(0.15, 0.78, 0);
    g.add(haloM);

    var wheels = [];
    var spots = [
      [1.15, 0.28, 0.78, true],
      [1.15, 0.28, -0.78, true],
      [-1.15, 0.3, 0.8, false],
      [-1.15, 0.3, -0.8, false],
    ];
    var rubber = carMat(0x4a4a4a, 0.14);
    var sidewall = new THREE.MeshBasicMaterial({ color: 0xf0e6d2, side: THREE.DoubleSide });
    var rim = new THREE.MeshBasicMaterial({ color: 0xfff8ee, side: THREE.DoubleSide });
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
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    );
    blob.rotation.x = -Math.PI * 0.5;
    blob.position.y = 0.03;
    g.add(blob);
    g.userData.wheels = wheels;
    return g;
  }

  function createRacer(kind, color, name, num) {
    var mesh = makeCar(color, kind === "player" ? TEAL_DEEP : 0x1a1a1a, num);
    scene.add(mesh);
    return {
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
  }

  var player = createRacer("player", 0xf4f1ea, "House 7", 7);
  var cpus = [
    createRacer("cpu", 0xd4a017, "Hall Monitor", 12),
    createRacer("cpu", 0xb4532e, "Sub Teacher", 21),
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
    r.brakeHold = 0;
    r.finished = false;
    r.finishTime = 0;
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
    return (
      inRect(r.x, r.z, PIT_LANE) ||
      (onPitPavement(r.x, r.z) &&
        r.x >= PIT_LANE.x0 &&
        r.z >= PIT_LANE.z0 - 2 &&
        r.z <= PIT_LANE.z1 + 2)
    );
  }

  function inPitGrab(r) {
    var mid = (PIT_LANE.x0 + PIT_LANE.x1) * 0.5;
    return (
      r.x >= mid &&
      onPitPavement(r.x, r.z) &&
      r.z >= PIT_LANE.z0 - 2.5 &&
      r.z <= PIT_LANE.z1 + 2.5
    );
  }

  function updateLaps(r) {
    if (r.finished) return;
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
    var empty = isPlayer && r.fuel <= 0;
    var maxV = empty ? LIMP_SPEED : MAX_SPEED;
    var accel = empty ? LIMP_ACCEL : ACCEL;
    if (isPlayer && launchT > 0) accel *= launchMul;
    else if (isPlayer) launchMul = 1;

    if (isPlayer && state === "racing") {
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
      if (isPlayer && r.speed > 0) r.tires -= 6.2 * dt;
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
        if (isPlayer && over > 0.3) r.tires -= 2.8 * dt * over;
      }
    }
    if (latDemand > maxLat && Math.abs(steer) > 0.05) {
      var slip = (latDemand - maxLat) / Math.max(6, maxLat);
      maxYaw *= 1 / (1 + slip * 2.1);
      r.slide += steer * slip * 12 * dt;
      if (isPlayer) r.tires -= 3.6 * dt * (0.4 + slip);
    } else if (isPlayer && Math.abs(steer) > 0.45 && r.speed > 22) {
      r.tires -= 0.85 * dt * speed01;
    }
    if (r.tires < TIRE_FLOOR) r.tires = TIRE_FLOOR;
    if (tire < 0.45) r.slide += (Math.random() - 0.5) * 4.2 * dt;

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

  function upcomingSlow(s) {
    var look = 0;
    var worst = 0;
    var tight = 0;
    while (look < 80) {
      var p = centerlinePoint(s + look);
      var bend = 0;
      if (p.name === "hairpin") {
        bend = 0.95;
        tight = 1;
      } else if (p.name === "chicane") bend = 0.74;
      else if (p.name === "the90") bend = 0.62;
      else if (p.name === "kink") bend = 0.48;
      else if (p.name === "sweeper") bend = 0.2;
      if (bend > worst) worst = bend;
      look += 7;
    }
    return { worst: worst, tight: tight };
  }

  function updateCpu(r, dt) {
    if (r.finished) {
      applyMotion(r, 0, false, true, false, dt, false);
      return;
    }
    var proj = projectTrack(r.x, r.z);
    r.s = proj.s;
    var look = 12 + r.speed * 0.38;
    var target = centerlinePoint(r.s + look);
    var desiredH = Math.atan2(target.z - r.z, target.x - r.x);
    var err = Math.atan2(Math.sin(desiredH - r.heading), Math.cos(desiredH - r.heading));
    var steer = clamp(err * 1.55, -1, 1);
    var off = proj.dist;
    if (off > 3) {
      var home = Math.atan2(proj.z - r.z, proj.x - r.x);
      var herr = Math.atan2(Math.sin(home - r.heading), Math.cos(home - r.heading));
      steer = clamp(steer * 0.3 + herr * 1.35, -1, 1);
    }
    var curve = upcomingSlow(r.s);
    var want = MAX_SPEED * (r.name === "Hall Monitor" ? 0.8 : 0.74);
    want *= 1 - clamp(curve.worst, 0, 0.64);
    if (curve.tight) want = Math.min(want, 19);
    applyMotion(r, steer, r.speed < want, r.speed > want + 3.5, false, dt, false);
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
    return {
      steer: steer,
      throttle: !!up,
      reverse: !!down,
      brake: !!keys.Space,
    };
  }

  function setScreen(which) {
    hud.title.classList.toggle("hidden", which !== "title");
    if (hud.lobby) hud.lobby.classList.toggle("hidden", which !== "lobby");
    hud.countdown.classList.toggle("hidden", which !== "start");
    hud.finish.classList.toggle("hidden", which !== "finish");
    hud.root.classList.toggle("hidden", which === "title" || which === "lobby");
    hud.revWrap.classList.toggle("hidden", which !== "start");
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
    }
  }

  function applyLaunch() {
    launchMul = 1;
    launchT = 0;
    if (revs >= REV_SWEET_LO && revs <= REV_SWEET_HI) {
      launchMul = 1.2;
      launchT = 1.05;
      launchCall = "LAUNCH";
    } else if (revs > REV_SWEET_HI) {
      launchMul = 0.58;
      launchT = 1.35;
      player.slide += (Math.random() - 0.5) * 10;
      launchCall = "WHEELSPIN";
    } else {
      launchMul = 0.52;
      launchT = 1.45;
      launchCall = "SLUGGISH";
    }
    launchCallT = 1.15;
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
      hud.finishPlace.textContent = names[place - 1] + " · vs Hall Monitor & Sub Teacher";
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
    else if (state === "racing" && player.fuel < 38) warn = "PIT WINDOW — peel LEFT off the straight";
    hud.warn.textContent = warn;
    hud.warn.classList.toggle("hidden", !warn);
    hud.warn.classList.toggle("late", lateJoinT > 0);
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
    ctx.fillStyle = "rgba(18, 12, 8, 0.55)";
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, w * 0.5 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2ec8c3";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    var i;
    for (i = 0; i < miniPts.length; i += 2) {
      var p = miniXY(miniPts[i], miniPts[i + 1], w, h, 10);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    if (!mpMode) {
      paintMiniDot(ctx, cpus[0].x, cpus[0].z, "#d4a017", 3);
      paintMiniDot(ctx, cpus[1].x, cpus[1].z, "#b4532e", 3);
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
        paintMiniDot(ctx, r.x, r.z, "#" + hex, 3);
      });
      Object.keys(hostBots).forEach(function (id) {
        var br = hostBots[id];
        paintMiniDot(ctx, br.x, br.z, "#d4a017", 3);
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
    if (input.throttle) revs = clamp(revs + dt * 0.7, 0, 1);
    else revs = clamp(revs - dt * 0.45, 0, 1);
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
      hostBots[p.id].name = p.name || hostBots[p.id].name;
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
      }
      for (i = 0; i < ids.length; i++) {
        for (j = i + 1; j < ids.length; j++) bashCars(hostBots[ids[i]], hostBots[ids[j]]);
        Object.keys(remotes).forEach(function (rid) {
          bashCars(hostBots[ids[i]], remotes[rid].r);
        });
      }
    }
    sendBotStates();
  }

  function ensureRemote(id, slot, name) {
    if (remotes[id]) {
      if (name) remotes[id].r.name = name;
      return remotes[id];
    }
    var skin = SKINS[slot % SKINS.length];
    var r = createRacer("net", skin.color, name || skin.name, skin.num);
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
      var rem = ensureRemote(c.id, c.slot || 0, c.name);
      rem.ghost = !!c.ghost;
      rem.r.mesh.visible = true;
      rem.r.mesh.traverse(function (ch) {
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
    resetGrid();
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
      }
      chaseCamera(dt);
      if (player.finished) finishRace();
    } else {
      chaseCamera(dt);
      setRevSound(false);
    }

    updateSky(dt);
    updateHud();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
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
    // pitTimer stays on blur. Leave the pit lane to reset a visit.
  });
  window.addEventListener("resize", function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    layoutCamera();
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
      state = "title";
      setScreen("title");
      showBoot("");
    });
  }

  addWorld();
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
