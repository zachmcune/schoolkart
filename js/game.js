/* SchoolKart — Campus Loop
   Creative lead: Zachary McUne
   Feel spec: Pit Crew Designer (fuel/tires/handling locked)

   Controls: W gas, Space brake, S reverse, A/D steer.
   Pit: peel LEFT, asphalt in / stop / out. Auto-service in the box
   below a walk for 2.5s. Pauses if you creep. Resets if you leave
   or hit W. Space is brake — not pit hold. One service per visit.
   Start: PRE-START blue flash, W revs with NO creep, five reds at 1s,
   hold 0.2–3s with all five ON, lights out = GO. Fuel starts then.
   Jump = rolled early: flash JUMP, dead ~1.5s, still race. */
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
  var BRAKE_DECEL = 54;
  var COAST = 8;
  var REVERSE_ACCEL = 18;
  var REVERSE_MAX = 12;
  var LIMP_SPEED = 13;
  var LIMP_ACCEL = 6;
  var STEER_RATE = 2.35;
  var MAX_LAT = 28;
  var IDLE_FUEL = 0.98;
  var THROTTLE_FUEL = 0.24;
  var PIT_HOLD = 2.5;
  var PIT_WALK = 1.8;
  var JUMP_DEAD = 1.5;
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
  var X0 = -42;
  var X1 = 115;
  var R90 = 22;
  var EAST = 70;
  var RH = 12;
  var RS = 52;

  // Separate F1 pit: peels LEFT off the racing line AFTER the grid, not a box on it.
  var PIT_LANE = { x0: 20, x1: 78, z0: -63.2, z1: -53.6 };
  var PIT_BOX = { x0: 36, x1: 52, z0: -63.8, z1: -53.0 };
  var PIT_PAVE = [
    { x0: 8, x1: 36, z0: -76.6, z1: -61.0 },
    { x0: 14, x1: 40, z0: -70.0, z1: -53.2 },
    PIT_LANE,
    PIT_BOX,
    { x0: 48, x1: 88, z0: -72.0, z1: -53.2 },
    { x0: 62, x1: 98, z0: -76.8, z1: -61.0 },
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
  var lastTs = 0;
  var camYaw = 0.6;
  var revs = 0;
  var launchMul = 1;
  var launchT = 0;
  var jumped = false;
  var jumpT = 0;
  var audio = { ctx: null, osc: null, gain: null };
  var gantryReds = [];
  var gantryBlues = [];

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
  scene.fog = new THREE.Fog(0xffb072, 85, 250);

  var camera = new THREE.PerspectiveCamera(
    58,
    window.innerWidth / window.innerHeight,
    0.4,
    420
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
    if (ang < 0) ang += Math.PI * 2;
    var a = ang;
    if (a < a0 || a > a1) {
      var d0 = Math.abs(Math.atan2(Math.sin(ang - a0), Math.cos(ang - a0)));
      var d1 = Math.abs(Math.atan2(Math.sin(ang - a1), Math.cos(ang - a1)));
      a = d0 < d1 ? a0 : a1;
    }
    var qx = cx + Math.cos(a) * r;
    var qz = cz + Math.sin(a) * r;
    var ex = px - qx;
    var ez = pz - qz;
    var t = (a - a0) / (a1 - a0);
    return { x: qx, z: qz, d2: ex * ex + ez * ez, t: t, h: a + Math.PI * 0.5 };
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

  addLine(X0, SF_Z, X1, SF_Z, "start");
  addArc(X1, SF_Z + R90, R90, Math.PI * 1.5, Math.PI * 2, "the90");
  addLine(X1 + R90, SF_Z + R90, X1 + R90, SF_Z + R90 + EAST, "east");
  addArc(X1 + R90 - RH, SF_Z + R90 + EAST, RH, 0, Math.PI * 0.5, "hairpin");
  addLine(X1 + R90 - RH, SF_Z + R90 + EAST + RH, X0, SF_Z + R90 + EAST + RH, "north");
  addArc(X0, SF_Z + R90 + EAST + RH - RS, RS, Math.PI * 0.5, Math.PI * 1.5, "sweeper");

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
      h: a + Math.PI * 0.5,
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
    var inPit = inRect(px, pz, PIT_BOX);
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
    var segs = 260;
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
    var segs = 260;
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
    scene.add(new THREE.HemisphereLight(0xffd4a8, 0x5a3824, 0.9));
    var sun = new THREE.DirectionalLight(0xffc078, 0.85);
    sun.position.set(90, 26, -50);
    scene.add(sun);

    addBox(0, -0.2, 0, 560, 0.4, 560, 0x2f5a20);
    addBox(40, 0.02, -18, 90, 0.06, 70, 0x3a6a26);
    var runoff = makeRibbon(ASPHALT + 4.4, 0.04, 0xc9a24e, null);
    if (runoff) scene.add(runoff);

    scene.add(makeRibbon(ASPHALT, 0.07, 0x10100e, null));
    scene.add(makeRibbon(0.42, 0.095, 0xffffff, null));
    scene.add(makeEdges(ASPHALT - 0.38, 0.22, 0.096, 0xf4f1e6));
    scene.add(makeEdges(-(ASPHALT - 0.38), 0.22, 0.096, 0xf4f1e6));
    var kerb90 = makeRibbon(ASPHALT + 0.78, 0.085, 0xff2a44, ["the90"]);
    var kerbHair = makeRibbon(ASPHALT + 0.78, 0.085, 0xff2a44, ["hairpin"]);
    var kerbSweep = makeRibbon(ASPHALT + 0.78, 0.085, 0xff2a44, ["sweeper"]);
    var kerbW90 = makeRibbon(ASPHALT + 0.38, 0.086, 0xffffff, ["the90"]);
    var kerbWHair = makeRibbon(ASPHALT + 0.38, 0.086, 0xffffff, ["hairpin"]);
    var kerbWSweep = makeRibbon(ASPHALT + 0.38, 0.086, 0xffffff, ["sweeper"]);
    if (kerb90) scene.add(kerb90);
    if (kerbHair) scene.add(kerbHair);
    if (kerbSweep) scene.add(kerbSweep);
    if (kerbW90) scene.add(kerbW90);
    if (kerbWHair) scene.add(kerbWHair);
    if (kerbWSweep) scene.add(kerbWSweep);

    for (var p = 0; p < PIT_PAVE.length; p++) {
      paveRect(PIT_PAVE[p], 0.08, 0x3d4a5c);
    }
    paveRect(PIT_BOX, 0.12, TEAL);
    addBox((PIT_LANE.x0 + PIT_LANE.x1) * 0.5, 0.115, PIT_LANE.z0, PIT_LANE.x1 - PIT_LANE.x0, 0.03, 0.34, 0xffe566);
    addBox((PIT_LANE.x0 + PIT_LANE.x1) * 0.5, 0.115, PIT_LANE.z1, PIT_LANE.x1 - PIT_LANE.x0, 0.03, 0.34, 0x7cffd4);
    var pitDecal = labelPlane("BOX", 7.2, 2.8, "#0a2a28", "#2ec8c3");
    pitDecal.rotation.x = -Math.PI * 0.5;
    pitDecal.position.set(44, 0.16, -58.2);
    scene.add(pitDecal);
    var inDecal = labelPlane("IN", 5.4, 2.2, "#102018", "#ffe566");
    inDecal.rotation.x = -Math.PI * 0.5;
    inDecal.position.set(18, 0.16, -68);
    scene.add(inDecal);
    var outDecal = labelPlane("OUT", 5.8, 2.2, "#102018", "#7cffd4");
    outDecal.rotation.x = -Math.PI * 0.5;
    outDecal.position.set(82, 0.16, -68);
    scene.add(outDecal);
    for (var hsh = 0; hsh < 4; hsh++) {
      addBox(38 + hsh * 3.6, 0.14, -58.4, 1.15, 0.02, 7.2, 0xffffff);
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

    addBox(-8, 5.4, -8, 16, 10.8, 12, 0xb4532e);
    addBox(-8, 11.2, -8, 18, 1, 14, 0x8a3a22);
    addBox(78, 4.8, -20, 14, 9.6, 16, 0xa34628);
    addBox(78, 10, -20, 16, 0.9, 18, 0x7a301c);
    addBox(52, 3.8, 8, 18, 7.6, 10, 0xc4683a);
    addBox(20, 0.35, -16, 24, 0.16, 32, 0x6f9a42);

    var towerX = 36;
    var towerZ = -22;
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
    cornerFlag(X1 + 6, SF_Z - 12, "THE 90");
    cornerFlag(X1 + R90 + 10, SF_Z + R90 + EAST + 6, "HAIRPIN");
    cornerFlag(X0 - 18, -28, "SWEEPER");

    for (var t = 0; t < 10; t++) {
      var tx = -30 + (t % 5) * 28;
      var tz = t < 5 ? 48 : -118;
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

  function makeCar(bodyColor, wingColor, num) {
    var g = new THREE.Group();
    var body = new THREE.MeshLambertMaterial({ color: bodyColor, side: THREE.DoubleSide });
    var wing = new THREE.MeshLambertMaterial({ color: wingColor || TEAL_DEEP, side: THREE.DoubleSide });
    var black = new THREE.MeshLambertMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide });
    var halo = new THREE.MeshLambertMaterial({ color: 0xe8e4dc, side: THREE.DoubleSide });

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
    for (var i = 0; i < spots.length; i++) {
      var holder = new THREE.Group();
      holder.position.set(spots[i][0], spots[i][1], spots[i][2]);
      var spinner = new THREE.Group();
      holder.add(spinner);
      var mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.3, 10), black);
      mesh.rotation.x = Math.PI * 0.5;
      spinner.add(mesh);
      var spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.5, 0.07),
        new THREE.MeshLambertMaterial({ color: 0xe8e4dc, side: THREE.DoubleSide })
      );
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
    r.finished = false;
    r.finishTime = 0;
    r.mesh.position.set(x, 0, z);
    r.mesh.rotation.set(0, -heading, 0);
  }

  function resetGrid() {
    resetRacer(player, GRID_P2_X, GRID_P2_Z, 0, TRACK_LEN - 14);
    resetRacer(cpus[0], -6, SF_Z + 2.7, 0, TRACK_LEN - 6);
    resetRacer(cpus[1], -22, SF_Z + 2.7, 0, TRACK_LEN - 22);
    raceTime = 0;
    didPit = false;
    pitTimer = 0;
    pitFlash = 0;
    pitUsedVisit = false;
    revs = 0;
    launchMul = 1;
    launchT = 0;
    jumped = false;
    jumpT = 0;
    startPhase = "prestart";
    startT = 2;
    redsOn = 0;
    holdDelay = 0.2 + Math.random() * 2.8;
  }

  function inPitBox(r) {
    return inRect(r.x, r.z, PIT_BOX);
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
    var surface = info.grass ? 0.34 : 1;
    var tire = clamp(r.tires / 100, 0, 1);
    var tireFeel = 0.38 + 0.62 * tire;
    var empty = isPlayer && r.fuel <= 0;
    var maxV = empty ? LIMP_SPEED : MAX_SPEED;
    var accel = empty ? LIMP_ACCEL : ACCEL;
    if (isPlayer && launchT > 0) accel *= launchMul;

    if (isPlayer && state === "racing") {
      r.fuel -= IDLE_FUEL * dt;
      if (throttle && !empty && r.speed >= 0) r.fuel -= THROTTLE_FUEL * dt;
      if (r.fuel < 0) r.fuel = 0;
    }

    if (brake) {
      if (r.speed > 0) r.speed -= BRAKE_DECEL * dt;
      else if (r.speed < 0) r.speed += BRAKE_DECEL * dt;
      if (Math.abs(r.speed) < 0.35) r.speed = 0;
    } else if (throttle) {
      r.speed += accel * dt;
    } else if (reverse) {
      r.speed -= REVERSE_ACCEL * dt;
    } else if (r.speed > 0) {
      r.speed -= COAST * dt;
      if (r.speed < 0) r.speed = 0;
    } else if (r.speed < 0) {
      r.speed += COAST * dt;
      if (r.speed > 0) r.speed = 0;
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
    r.mesh.rotation.y = -r.heading;
    r.mesh.rotation.z = clamp(-steer * 0.1 - r.slide * 0.02, -0.18, 0.18);
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
    while (look < 42) {
      var p = centerlinePoint(s + look);
      var bend = 0;
      if (p.name === "hairpin") {
        bend = 0.95;
        tight = 1;
      } else if (p.name === "the90") bend = 0.62;
      else if (p.name === "sweeper") bend = 0.22;
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
    r.mesh.rotation.y = -r.heading;
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
    hud.countdown.classList.toggle("hidden", which !== "start");
    hud.finish.classList.toggle("hidden", which !== "finish");
    hud.root.classList.toggle("hidden", which === "title");
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

  function applyLaunch() {
    if (jumped) {
      launchMul = 1;
      launchT = 0;
      jumpT = JUMP_DEAD;
      player.speed = 0;
      player.slide = 0;
      return;
    }
    if (revs < 0.48) {
      launchMul = 0.42;
      launchT = 1.5;
    } else if (revs > 0.88) {
      launchMul = 0.5;
      launchT = 1.4;
      player.slide += (Math.random() - 0.5) * 10;
    } else {
      launchMul = 1.18;
      launchT = 1.2;
    }
  }

  function startSequence() {
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
    if (cpus[0].finished && cpus[0].finishTime < player.finishTime) place += 1;
    if (!cpus[0].finished && !player.finished) place += 1;
    if (cpus[1].finished && cpus[1].finishTime < player.finishTime) place += 1;
    var names = ["1st", "2nd", "3rd"];
    hud.finishPlace.textContent = names[place - 1] + " · vs Hall Monitor & Sub Teacher";
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
    hud.revFill.style.width = Math.round(revs * 100) + "%";

    var boxed = state === "racing" && inPitBox(player);
    var pct = Math.min(100, Math.round((pitTimer / PIT_HOLD) * 100));
    hud.pitting.classList.toggle("hidden", !boxed && pitFlash <= 0);
    if (pitFlash > 0) hud.pitting.textContent = "SERVICED";
    else if (boxed && pitUsedVisit) hud.pitting.textContent = "SERVICED — pull out";
    else if (boxed && Math.abs(player.speed) < PIT_WALK) hud.pitting.textContent = "PITTING  " + pct + "%";
    else if (boxed) hud.pitting.textContent = "SLOW TO A WALK";

    var warn = "";
    if (jumpT > 0 || (state === "start" && jumped)) warn = "JUMP";
    else if (state === "racing" && player.fuel <= 0) warn = "EMPTY — LIMP HOME";
    else if (state === "racing" && player.tires < 40) warn = "TIRES LOOSE — don't carry the sweeper";
    else if (state === "racing" && player.fuel < 38) warn = "PIT WINDOW — peel LEFT off the straight";
    hud.warn.textContent = warn;
    hud.warn.classList.toggle("hidden", !warn);
  }

  function chaseCamera(dt) {
    var back = 11.5;
    var up = 4.8;
    var fx = Math.cos(player.heading);
    var fz = Math.sin(player.heading);
    var desired = new THREE.Vector3(player.x - fx * back, up, player.z - fz * back);
    var look = new THREE.Vector3(player.x + fx * 7, 1.2, player.z + fz * 7);
    camera.position.lerp(desired, 1 - Math.pow(0.0015, dt));
    camera.lookAt(look);
  }

  function titleCamera(dt) {
    camYaw += dt * 0.16;
    camera.position.set(36 + Math.cos(camYaw) * 78, 30, -22 + Math.sin(camYaw) * 78);
    camera.lookAt(36, 8, -22);
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
    hud.revFill.style.width = Math.round(revs * 100) + "%";

    // W revs only — no creep. Fuel clock does not run on the grid.
    pinGrid(player, GRID_P2_X, GRID_P2_Z);
    var wheels = player.mesh.userData.wheels;
    if (wheels) {
      var spin = revs * dt * 16;
      for (var w = 0; w < wheels.length; w++) wheels[w].spinner.rotation.z -= spin;
    }

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
    pinGrid(cpus[0], -6, SF_Z + 2.7);
    pinGrid(cpus[1], -22, SF_Z + 2.7);
    chaseCamera(dt);
  }

  function tick(ts) {
    var dt = lastTs ? (ts - lastTs) / 1000 : 0.016;
    lastTs = ts;
    dt = clamp(dt, 0, 0.05);
    if (pitFlash > 0) pitFlash -= dt;
    if (launchT > 0) launchT -= dt;
    if (jumpT > 0) jumpT -= dt;

    if (state === "title") {
      titleCamera(dt);
      setRevSound(false);
    } else if (state === "start") {
      tickStart(dt);
    } else if (state === "racing") {
      raceTime += dt;
      revs = 0;
      var input = playerInput();
      if (jumpT > 0) {
        input = { steer: 0, throttle: false, reverse: false, brake: true };
        player.speed = 0;
        player.slide = 0;
      }
      var boxed = inPitBox(player);
      if (!boxed) {
        pitTimer = 0;
        pitUsedVisit = false;
      } else if (!pitUsedVisit && input.throttle) {
        pitTimer = 0;
      } else if (!pitUsedVisit && Math.abs(player.speed) < PIT_WALK) {
        pitTimer += dt;
        if (pitTimer >= PIT_HOLD) {
          player.fuel = 100;
          player.tires = 100;
          didPit = true;
          pitUsedVisit = true;
          pitTimer = 0;
          pitFlash = 1.2;
        }
      }
      applyMotion(player, input.steer, input.throttle, input.brake, input.reverse, dt, true);
      updateLaps(player);
      updateCpu(cpus[0], dt);
      updateCpu(cpus[1], dt);
      bashCars(player, cpus[0]);
      bashCars(player, cpus[1]);
      bashCars(cpus[0], cpus[1]);
      bashCars(player, cpus[0]);
      bashCars(player, cpus[1]);
      bashCars(cpus[0], cpus[1]);
      chaseCamera(dt);
      if (player.finished) finishRace();
    } else {
      chaseCamera(dt);
      setRevSound(false);
    }

    updateHud();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  function onKey(e, down) {
    keys[e.code] = down;
    if (down) ensureAudio();
    if (down && (e.code === "Space" || e.code === "Enter")) {
      if (state === "title" || state === "finished") startSequence();
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
    // pitTimer stays on blur. Leave the box or hit W to reset.
  });
  window.addEventListener("resize", function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    layoutCamera();
  });

  addWorld();
  resetGrid();
  setScreen("title");
  requestAnimationFrame(tick);
})();
