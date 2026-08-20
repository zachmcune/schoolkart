/* SchoolKart — Campus Loop
   Creative lead: Zachary McUne
   Feel spec: Pit Crew Designer (locked — do not invent a different pit or economy)

   Handling: brake or you run wide. Stab the 90, slow for the hairpin,
   carry the sweeper only if tires are fresh.
   Fuel is the CLOCK: one forced box in 5 laps; coasting still ticks fuel;
   skip the box = limp home.
   Tires are the HANDLING: loose if you push, not shredded.
   Grass is a CRAWL + extra wear — never a highway, never a hard stop.
   Pit: open painted TEAL box — no wall, no clamp. Hold Space 2.5s.
   A stop costs enough you pick WHEN (lap 2 vs 3), not whether.
   Look: white/teal car #7, golden-hour brick campus, one clock tower.
   5 laps in ~2–3 minutes. Holding W the whole way must lose. */
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
  var LIMP_SPEED = 13;
  var LIMP_ACCEL = 6;
  var STEER_RATE = 2.35;
  var MAX_LAT = 28;
  var IDLE_FUEL = 0.98;
  var THROTTLE_FUEL = 0.24;
  var PIT_HOLD = 2.5;
  var ASPHALT = 8.6;
  var GRASS_MAX = 8.5;
  var GRASS_ROLL = 4;
  var GRASS_DUMP = 40;
  var TIRE_FLOOR = 22;
  var TEAL = 0x2ec8c3;
  var TEAL_DEEP = 0x148f8c;

  var SF_Z = -80;
  var X0 = -42;
  var X1 = 115;
  var R90 = 22;
  var EAST = 70;
  var RH = 12;
  var RS = 52;

  // One paved pit lane = entry AND exit. Overlaps the south-straight ribbon
  // so you peel in and rejoin on the same asphalt. No grass hop either way.
  var PIT_LANE = { x0: -28, x1: X1, z0: SF_Z - ASPHALT, z1: SF_Z + 20 };
  var PIT_BOX = { x0: 4, x1: 28, z0: SF_Z + 4, z1: SF_Z + 17 };

  var keys = Object.create(null);
  var state = "title";
  var countLeft = 0;
  var countShown = "";
  var raceTime = 0;
  var didPit = false;
  var pitTimer = 0;
  var pitFlash = 0;
  var lastTs = 0;
  var camYaw = 0.6;

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

  // lookAt + Y-up puts world-left (+Z on the eastbound straight) on screen-right.
  // Flip NDC X so peel LEFT, A/←, and the teal box are the same side.
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
    countNum: document.getElementById("count-num"),
    finish: document.getElementById("finish-screen"),
    finishTime: document.getElementById("finish-time"),
    finishPit: document.getElementById("finish-pit"),
    finishPlace: document.getElementById("finish-place"),
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function inRect(x, z, b) {
    return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  }

  function onPitPavement(x, z) {
    return inRect(x, z, PIT_LANE) || inRect(x, z, PIT_BOX);
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

  function addWorld() {
    scene.add(new THREE.HemisphereLight(0xffd4a8, 0x5a3824, 0.9));
    var sun = new THREE.DirectionalLight(0xffc078, 0.85);
    sun.position.set(90, 26, -50);
    scene.add(sun);

    addBox(0, -0.2, 0, 560, 0.4, 560, 0x6a8f3a);
    addBox(40, 0.03, -18, 90, 0.08, 70, 0x7aa046);

    scene.add(makeRibbon(ASPHALT, 0.06, 0x2c2a28, null));
    scene.add(makeRibbon(0.16, 0.08, 0xf4efe6, null));
    var kerb90 = makeRibbon(ASPHALT + 0.65, 0.075, 0xe24b3a, ["the90"]);
    var kerbHair = makeRibbon(ASPHALT + 0.65, 0.075, 0xe24b3a, ["hairpin"]);
    if (kerb90) scene.add(kerb90);
    if (kerbHair) scene.add(kerbHair);

    var pitLane = new THREE.Mesh(
      new THREE.BoxGeometry(PIT_LANE.x1 - PIT_LANE.x0, 0.1, PIT_LANE.z1 - PIT_LANE.z0),
      new THREE.MeshLambertMaterial({ color: 0x32302c, side: THREE.DoubleSide })
    );
    pitLane.position.set(
      (PIT_LANE.x0 + PIT_LANE.x1) * 0.5,
      0.055,
      (PIT_LANE.z0 + PIT_LANE.z1) * 0.5
    );
    scene.add(pitLane);
    addBox(
      (PIT_LANE.x0 + PIT_LANE.x1) * 0.5,
      0.07,
      PIT_LANE.z1 - 0.18,
      PIT_LANE.x1 - PIT_LANE.x0,
      0.02,
      0.35,
      0xf4efe6
    );

    var pit = new THREE.Mesh(
      new THREE.BoxGeometry(PIT_BOX.x1 - PIT_BOX.x0, 0.12, PIT_BOX.z1 - PIT_BOX.z0),
      new THREE.MeshLambertMaterial({ color: TEAL, side: THREE.DoubleSide })
    );
    pit.position.set(
      (PIT_BOX.x0 + PIT_BOX.x1) * 0.5,
      0.11,
      (PIT_BOX.z0 + PIT_BOX.z1) * 0.5
    );
    scene.add(pit);

    for (var hsh = 0; hsh < 5; hsh++) {
      addBox(
        PIT_BOX.x0 + 3 + hsh * 4.2,
        0.13,
        (PIT_BOX.z0 + PIT_BOX.z1) * 0.5,
        1.1,
        0.02,
        PIT_BOX.z1 - PIT_BOX.z0 - 1.2,
        0xf4efe6
      );
    }

    var pitDecal = labelPlane("PIT", 8, 3.2, "#0a2a28", "#2ec8c3");
    pitDecal.rotation.x = -Math.PI * 0.5;
    pitDecal.position.set(16, 0.16, (PIT_BOX.z0 + PIT_BOX.z1) * 0.5);
    scene.add(pitDecal);

    for (var ch = 0; ch < 3; ch++) {
      addBox(-10 + ch * 4, 0.1, SF_Z + 3.2, 1.6, 0.04, 0.45, 0x2ec8c3);
    }
    for (var ex = 0; ex < 5; ex++) {
      addBox(34 + ex * 10, 0.1, SF_Z + 1.2, 2.2, 0.04, 0.4, 0xf4efe6);
    }

    var stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.14, ASPHALT * 2),
      new THREE.MeshLambertMaterial({ color: 0xf4efe6, side: THREE.DoubleSide })
    );
    stripe.position.set(0, 0.1, SF_Z);
    scene.add(stripe);

    addBox(0, 6.2, SF_Z - ASPHALT - 1.1, 10, 0.3, 0.3, 0x2a2018);
    addBox(-4.5, 5, SF_Z - ASPHALT - 1.1, 0.3, 6.2, 0.3, 0x2a2018);
    addBox(4.5, 5, SF_Z - ASPHALT - 1.1, 0.3, 6.2, 0.3, 0x2a2018);
    addBox(-2.1, 6.2, SF_Z - ASPHALT - 1.1, 0.65, 0.65, 0.35, 0xe24b3a);
    addBox(0, 6.2, SF_Z - ASPHALT - 1.1, 0.65, 0.65, 0.35, 0xffe08a);
    addBox(2.1, 6.2, SF_Z - ASPHALT - 1.1, 0.65, 0.65, 0.35, 0x2ec8c3);

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
      [1.15, 0.28, 0.78],
      [1.15, 0.28, -0.78],
      [-1.15, 0.3, 0.8],
      [-1.15, 0.3, -0.8],
    ];
    for (var i = 0; i < spots.length; i++) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.28, 8), black);
      w.rotation.x = Math.PI * 0.5;
      w.position.set(spots[i][0], spots[i][1], spots[i][2]);
      g.add(w);
      wheels.push(w);
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
    resetRacer(player, -20, SF_Z - 2.2, 0, TRACK_LEN - 20);
    resetRacer(cpus[0], -10, SF_Z + 1.8, 0, TRACK_LEN - 10);
    resetRacer(cpus[1], -30, SF_Z + 1.1, 0, TRACK_LEN - 30);
    raceTime = 0;
    didPit = false;
    pitTimer = 0;
    pitFlash = 0;
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

  function applyMotion(r, steer, throttle, brake, dt, isPlayer) {
    var info = projectTrack(r.x, r.z);
    var surface = info.grass ? 0.34 : 1;
    var tire = clamp(r.tires / 100, 0, 1);
    var tireFeel = 0.38 + 0.62 * tire;
    var empty = isPlayer && r.fuel <= 0;
    var maxV = empty ? LIMP_SPEED : MAX_SPEED;

    if (isPlayer && state === "racing") {
      r.fuel -= IDLE_FUEL * dt;
      if (throttle && !empty) r.fuel -= THROTTLE_FUEL * dt;
      if (r.fuel < 0) r.fuel = 0;
    }

    if (brake) r.speed -= BRAKE_DECEL * dt;
    else if (throttle) r.speed += (empty ? LIMP_ACCEL : ACCEL) * dt;
    else r.speed -= COAST * dt;

    if (info.grass) {
      if (r.speed > GRASS_MAX) {
        r.speed -= GRASS_DUMP * dt;
        if (r.speed < GRASS_MAX) r.speed = GRASS_MAX;
      }
      if (r.speed > GRASS_MAX) r.speed = GRASS_MAX;
      if (r.speed < GRASS_ROLL) r.speed = GRASS_ROLL;
      if (isPlayer) r.tires -= 6.2 * dt;
    } else {
      r.speed = clamp(r.speed, 0, maxV);
    }

    var speed01 = r.speed / MAX_SPEED;
    var steerScale = 1 - 0.58 * speed01;
    var maxYaw = STEER_RATE * steerScale * tireFeel * surface;
    var latDemand = Math.abs(steer) * r.speed * 0.155;
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

    r.heading += steer * maxYaw * dt;
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
      var spin = r.speed * dt * 1.55;
      for (var i = 0; i < wheels.length; i++) wheels[i].rotation.z -= spin;
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
      applyMotion(r, 0, false, true, dt, false);
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
    applyMotion(r, steer, r.speed < want, r.speed > want + 3.5, dt, false);
    updateLaps(r);
  }

  function separateCars(a, b) {
    var dx = b.x - a.x;
    var dz = b.z - a.z;
    var d2 = dx * dx + dz * dz;
    var min = 2.4;
    if (d2 < min * min && d2 > 0.0001) {
      var d = Math.sqrt(d2);
      var push = (min - d) * 0.5;
      dx /= d;
      dz /= d;
      a.x -= dx * push;
      a.z -= dz * push;
      b.x += dx * push;
      b.z += dz * push;
      a.speed *= 0.96;
      b.speed *= 0.96;
    }
  }

  function playerInput() {
    var up = keys.ArrowUp || keys.KeyW;
    var down = keys.ArrowDown || keys.KeyS;
    var left = keys.ArrowLeft || keys.KeyA;
    var right = keys.ArrowRight || keys.KeyD;
    var space = keys.Space;
    var steer = 0;
    if (left) steer += 1;
    if (right) steer -= 1;
    return { steer: steer, throttle: !!up, brake: !!down, space: !!space };
  }

  function setScreen(which) {
    hud.title.classList.toggle("hidden", which !== "title");
    hud.countdown.classList.toggle("hidden", which !== "countdown");
    hud.finish.classList.toggle("hidden", which !== "finish");
    hud.root.classList.toggle("hidden", which === "title");
  }

  function startCountdown() {
    resetGrid();
    state = "countdown";
    countLeft = 3.2;
    countShown = "";
    setScreen("countdown");
  }

  function finishRace() {
    state = "finished";
    setScreen("finish");
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
    hud.speed.textContent = String(Math.round(player.speed * 3.15));
    var fuel = clamp(player.fuel, 0, 100);
    var tires = clamp(player.tires, 0, 100);
    hud.fuelFill.style.transform = "scaleX(" + fuel / 100 + ")";
    hud.tireFill.style.transform = "scaleX(" + tires / 100 + ")";
    hud.fuelNum.textContent = String(Math.round(fuel));
    hud.tireNum.textContent = String(Math.round(tires));
    hud.fuelFill.style.background = fuel < 28 ? "linear-gradient(90deg,#7a1010,#ff4d4d)" : "";
    hud.tireFill.style.background = tires < 40 ? "linear-gradient(90deg,#8a5a10,#ffd36a)" : "";

    var boxed = state === "racing" && inPitBox(player);
    var pct = Math.min(100, Math.round((pitTimer / PIT_HOLD) * 100));
    hud.pitting.classList.toggle("hidden", !boxed && pitFlash <= 0);
    if (pitFlash > 0) hud.pitting.textContent = "SERVICED";
    else if (boxed && keys.Space) hud.pitting.textContent = "PITTING  " + pct + "%";
    else if (boxed && pitTimer > 0) hud.pitting.textContent = "HOLD SPACE  " + pct + "%";
    else if (boxed) hud.pitting.textContent = "HOLD SPACE";

    var warn = "";
    if (state === "racing" && player.fuel <= 0) warn = "EMPTY — LIMP HOME";
    else if (state === "racing" && player.tires < 40) warn = "TIRES LOOSE — don't carry the sweeper";
    else if (state === "racing" && player.fuel < 38) warn = "PIT WINDOW — teal box, hold Space";
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

  function tick(ts) {
    var dt = lastTs ? (ts - lastTs) / 1000 : 0.016;
    lastTs = ts;
    dt = clamp(dt, 0, 0.05);
    if (pitFlash > 0) pitFlash -= dt;

    if (state === "title") {
      titleCamera(dt);
    } else if (state === "countdown") {
      countLeft -= dt;
      var n = countLeft > 2.1 ? "3" : countLeft > 1.1 ? "2" : countLeft > 0.15 ? "1" : "GO";
      if (n !== countShown) {
        countShown = n;
        hud.countNum.textContent = n;
      }
      chaseCamera(dt);
      if (countLeft <= 0) {
        state = "racing";
        setScreen("racing");
      }
    } else if (state === "racing") {
      raceTime += dt;
      var input = playerInput();
      var boxed = inPitBox(player);
      if (!boxed) {
        pitTimer = 0;
      } else if (input.space) {
        pitTimer += dt;
        input.brake = true;
        input.throttle = false;
        if (pitTimer >= PIT_HOLD) {
          player.fuel = 100;
          player.tires = 100;
          didPit = true;
          pitTimer = 0;
          pitFlash = 1.2;
        }
      }
      applyMotion(player, input.steer, input.throttle, input.brake, dt, true);
      updateLaps(player);
      updateCpu(cpus[0], dt);
      updateCpu(cpus[1], dt);
      separateCars(player, cpus[0]);
      separateCars(player, cpus[1]);
      separateCars(cpus[0], cpus[1]);
      chaseCamera(dt);
      if (player.finished) finishRace();
    } else {
      chaseCamera(dt);
    }

    updateHud();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  function onKey(e, down) {
    keys[e.code] = down;
    if (down && (e.code === "Space" || e.code === "Enter")) {
      if (state === "title" || state === "finished") startCountdown();
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
