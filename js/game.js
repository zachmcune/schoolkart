/* SchoolKart — Campus Loop
   Creative lead: Zachary McUne
   Feel spec: Pit Crew Designer (fuel/tires/handling locked)

   Controls: W gas, Space brake, S reverse, A/D steer.
   Phones (landscape): right half = gas, left half = brake, tilt = steer.
   Pit: FORK LEFT onto a second asphalt road. A real track curves IN,
   runs the box, then curves OUT. Halfway in, the car is grabbed
   and serviced ~2.5s, then released to drive out. One service per visit.
   Start: PRE-START blue flash, five reds at 1s, hold 0.2–3s all ON,
   lights out = GO. Fuel starts then. Car is locked to the grid until GO.
   W is a timing game — climb through the green, lift to catch it.
   Past the mark at lights-out is a SLUGGISH getaway on asphalt, not a spin.
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
  var MAX_SPEED = 200;
  // MAX_SPEED is the handling reference (yaw washout, brake bite, hit
  // mass). SPEED_LIMIT is the ceiling the cars actually run into, set so
  // the needle stops at exactly TOP_KPH instead of sailing past 280.
  var KPH_PER_UNIT = 3.15;
  var TOP_KPH = 200;
  var SPEED_LIMIT = TOP_KPH / KPH_PER_UNIT;
  var ACCEL = 5; // ~40s wind-out to max (was 16 / ~3s at 48)
  var BRAKE_DECEL = 6; // squeeze: weaker at wind-out, full bite when slow (hairpin)
  var COAST = 2;
  var REVERSE_ACCEL = 7;
  var REVERSE_MAX = 12;
  var LIMP_SPEED = 13;
  var LIMP_ACCEL = 2;
  var STEER_RATE = 2.35;
  var MAX_LAT = 28;
  var TILT_DEAD = 4;
  var TILT_SPAN = 18;
  var TILT_LEVEL = 2.5;
  var TILT_CAL_MAX = 8;
  // Burn is the clock. Retuned for measured TRACK_LEN (~1979). 5 laps
  // still force ONE box — a second stop should never be required.
  var IDLE_FUEL = 0.46;
  var THROTTLE_FUEL = 0.12;
  var PIT_HOLD = 2.5;
  // Pace to take the pit road at. A bot has to brake for this the way it
  // brakes for a hairpin, which from flat out is most of a straight.
  var PIT_ENTRY_V = 18;
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
  var CAMPUS_KERBS = ["the90", "hairpin", "chicane", "sweeper", "kink"];
  var activeBuiltin = "campus";
  var BUILTIN_KERBS = {
    campus: CAMPUS_KERBS,
    harbor: ["devote", "casino", "hairpin", "chicane", "pool", "rascasse", "harbor"],
    park: ["rettifilo", "roggia", "lesmo", "ascari", "parabola"],
    desert: ["t1", "oasis", "kink", "sweeper"],
    forest: ["source", "eau", "raidillon", "busstop"],
  };
  var FLAG_TITLE = {
    the90: "THE 90",
    hairpin: "HAIRPIN",
    chicane: "CHICANE",
    sweeper: "SWEEPER",
    kink: "KINK",
    devote: "DEVOTE",
    casino: "CASINO",
    rettifilo: "FIRST",
    pool: "POOL",
    rascasse: "RASCASSE",
    harbor: "HARBOR",
    roggia: "ROGGIA",
    lesmo: "LESMO",
    ascari: "ASCARI",
    parabola: "PARABOLA",
    t1: "TURN 1",
    oasis: "OASIS",
    source: "SOURCE",
    eau: "EAU",
    raidillon: "RAIDILLON",
    busstop: "BUS STOP",
  };

  function cornerKind(name) {
    if (name === "hairpin" || name === "source" || name === "t1") return "hairpin";
    if (
      name === "chicane" ||
      name === "pool" ||
      name === "roggia" ||
      name === "rettifilo" ||
      name === "ascari" ||
      name === "busstop" ||
      name === "oasis"
    ) {
      return "chicane";
    }
    if (name === "sweeper" || name === "harbor" || name === "parabola" || name === "raidillon") return "sweeper";
    if (
      name === "the90" ||
      name === "casino" ||
      name === "lesmo" ||
      name === "eau" ||
      name === "devote" ||
      name === "massenet" ||
      name === "rascasse"
    ) {
      return "the90";
    }
    if (name === "kink" || name === "tunnel" || name === "tabac" || name === "forest") return "kink";
    return name || "";
  }

  function builtinSpec(code) {
    var k = String(code || "").toUpperCase();
    if (!k || k === "CAMPUS") return { id: "campus", menu: "CAMPUS LOOP", label: "Campus Loop" };
    if (k === "HARBOR") return { id: "harbor", menu: "HARBOR STREET", label: "Harbor Street" };
    if (k === "PARK") return { id: "park", menu: "ROYAL PARK", label: "Royal Park" };
    if (k === "DESERT") return { id: "desert", menu: "DESERT DUSK", label: "Desert Dusk" };
    if (k === "FOREST") return { id: "forest", menu: "FOREST CLIMB", label: "Forest Climb" };
    return null;
  }

  function isBuiltinCode(code) {
    return !!builtinSpec(code);
  }

  function builtinId() {
    if (isDriveableLoop()) return "";
    return activeBuiltin || "campus";
  }

  function setTrackKerbs(id) {
    var list = BUILTIN_KERBS[id] || CAMPUS_KERBS;
    KERB_NAMES.length = 0;
    var i;
    for (i = 0; i < list.length; i++) KERB_NAMES.push(list[i]);
  }
  var KERB_RAISE = 0.055;
  var KERB_SURFACE_Y = 0.06;
  var GRASS_MAX = 8.5;
  var GRASS_ROLL = 4;
  var GRASS_DUMP = 40;
  var TIRE_FLOOR = 22;
  var TEAL = 0x2ec8c3;
  var TEAL_DEEP = 0x148f8c;
  var MESH_NOSE = 3.55;
  var MESH_TAIL = 2.1;
  var MESH_HALF_W = 1.2;
  var WALLS = [];
  var FX_MAX = 18;

  var SF_Z = -80;
  // Campus grid sits on the OUTSIDE of the south straight (driver's right / -Z).
  // The infield row (+Z) is the OPEN PIT PEEL. Host is slot 0 — do not sit there.
  var GRID_OUT_A = -2.4;
  var GRID_OUT_B = -5.2;
  var GRID_P2_X = -14;
  var GRID_P2_Z = SF_Z + GRID_OUT_B;
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
    if (isDriveableLoop() && TRACK_LEN > 8) {
      var p = slotOnPath(Math.max(0, TRACK_LEN - 6 - i * 8), i % 2 ? 1 : -1);
      return { x: p.x, z: p.z, h: p.h };
    }
    // 2-wide F1. Host slot 0 stays put. Mate (slot 1 / Add Bowie) is
    // the same X, further outside — single-file parked #12 behind the
    // chase-cam lens so the roster showed a ghost.
    return { x: -6 - Math.floor(i / 2) * 8, z: SF_Z + (i % 2 ? GRID_OUT_B : GRID_OUT_A), h: 0 };
  }

  function slotHeading(g) {
    if (g && g.h != null && isFinite(g.h)) return g.h;
    return 0;
  }

  function faceRaceAt(x, z) {
    // Campus S/F is east (+X). Do not re-project: the pit peel steals heading.
    if (!isDriveableLoop()) return 0;
    var pr = projectTrack(x, z);
    return pr && isFinite(pr.h) ? pr.h : 0;
  }

  // FORK, not a slide. Two asphalt roads: racing ribbon + a second lane LEFT.
  // Stay on the ribbon = miss. Peel LEFT onto the second road = grab halfway.
  // Do not cut a hole in the racing line to fake the second road.
  // mp79/80/82/83: flags, strips, then a 90-void. Drive beat paper.
  // Actual track curves IN (S-bend) then OUT (S-bend). Not a diagonal slab.
  var PIT_ENTRY = { x0: 8, x1: 28, z0: -70.0, z1: -61.0 };
  var PIT_EXIT = { x0: 128, x1: 160, z0: -68.0, z1: -58.0 };
  var PIT_LANE = { x0: 28, x1: 136, z0: -61.5, z1: -52.5 };
  var PIT_GRAB = { x0: 64, x1: 98, z0: -61.0, z1: -53.2 };
  var PIT_PAVE = [PIT_ENTRY, PIT_LANE, PIT_GRAB, PIT_EXIT];
  var PIT_PATH = [];
  var PIT_HALF = 4.5;

  var keys = Object.create(null);
  var drive = { up: false, down: false, left: false, right: false, space: false };
  var touchCtl = {
    gas: false,
    brake: false,
    rev: false,
    steer: 0,
    pads: {},
    gyroOn: false,
    gyroNeedCal: true,
    gyroCenter: 0,
    gyroFilt: 0,
    tiltSide: 0,
    tiltAng: null,
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
  var campusRoot = null;
  var harborRoot = null;
  var parkRoot = null;
  var desertRoot = null;
  var forestRoot = null;
  var groundSkirt = null;
  var groundDirt = null;
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
  var pitHudPct = 0;
  var pitFlash = 0;
  var pitUsedVisit = false;
  var pitServicing = false;
  var pitVisit = false;
  var pitAwayT = 0;
  var pitBanner = "";
  var spaceBrakeArmed = true;
  var lastTs = 0;
  var lastDt = 0.016;
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
  var menuOpen = false;
  var mpMode = false;
  var remotes = {};
  var hostBots = {};
  var gameSpeed = 1;
  var lobbyPick = "";
  var SPEED_STEPS = [1, 1.25, 0.75];
  var lastNetSend = 0;
  var playerGridX = GRID_P2_X;
  var playerGridZ = GRID_P2_Z;
  var gridHeading = 0;
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
  renderer.setClearColor(0xe87834, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  function viewBox() {
    // Phones: layout innerWidth/innerHeight is not the painted screen.
    // Safari chrome, the iOS home-screen status bar, and a landscape PWA
    // launch all shift visualViewport — that is the offset letterbox.
    var vv = window.visualViewport;
    if (vv && vv.width > 2 && vv.height > 2) {
      return {
        w: Math.max(1, Math.round(vv.width)),
        h: Math.max(1, Math.round(vv.height)),
        x: vv.offsetLeft || 0,
        y: vv.offsetTop || 0,
      };
    }
    return {
      w: Math.max(1, window.innerWidth || 1),
      h: Math.max(1, window.innerHeight || 1),
      x: 0,
      y: 0,
    };
  }

  function pinGameBox(box) {
    var root = document.getElementById("game");
    if (!root) return;
    root.style.position = "fixed";
    root.style.left = box.x + "px";
    root.style.top = box.y + "px";
    root.style.width = box.w + "px";
    root.style.height = box.h + "px";
  }

  function fitView() {
    var box = viewBox();
    pinGameBox(box);
    renderer.setSize(box.w, box.h, false);
    if (camera) layoutCamera();
  }

  function layoutCamera() {
    var box = viewBox();
    camera.aspect = box.w / box.h;
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[0] *= -1;
  }

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf08a48, 520, 2800);

  var camera = new THREE.PerspectiveCamera(
    62,
    viewBox().w / viewBox().h,
    0.3,
    3600
  );
  fitView();

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
    titleTrack: document.getElementById("title-track"),
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
    tileBoardHost: document.querySelector(".tile-map-host"),
    tileTrash: document.getElementById("tile-trash"),
    tileRot: document.getElementById("btn-tile-rot"),
    circuitPicks: document.getElementById("circuit-picks"),
    circuitPicksEditor: document.getElementById("circuit-picks-editor"),
    circuitPicksLobby: document.getElementById("circuit-picks-lobby"),
    pause: document.getElementById("pause-screen"),
    pauseEyebrow: document.getElementById("pause-eyebrow"),
    pauseTitle: document.getElementById("pause-title"),
    pauseStatus: document.getElementById("pause-status"),
    pauseRoster: document.getElementById("pause-roster"),
    pauseHost: document.getElementById("pause-host"),
    pauseErr: document.getElementById("pause-err"),
    pauseHint: document.getElementById("pause-hint"),
    pauseAllBtn: document.getElementById("btn-pause-all"),
    pauseSpeedBtn: document.getElementById("btn-pause-speed"),
    menuBtn: document.getElementById("btn-menu"),
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
    var label = n === 1.25 ? "1.25x" : n === 0.75 ? "0.75x" : "1x";
    if (hud.speedBtn) hud.speedBtn.textContent = label;
    if (hud.pauseSpeedBtn) hud.pauseSpeedBtn.textContent = label;
  }

  function inRect(x, z, b) {
    return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  }

  function onPitPavement(x, z) {
    var i;
    for (i = 0; i < PIT_PAVE.length; i++) {
      if (inRect(x, z, PIT_PAVE[i])) return true;
    }
    if (!PIT_PATH.length || !onPitPath(x, z)) return false;
    // The curve meets the left edge of the ribbon. The ribbon itself
    // is never pit paint — stay-right / racing-line samples stay clean.
    // Do not call onRaceRibbon here: that re-enters projectTrack.
    if (!isDriveableLoop() && z <= SF_Z + ASPHALT) return false;
    var segs = PATH.length ? PATH : MAP_SURF;
    if (segs && segs.length) {
      var race = projectOn(x, z, segs);
      if (race && race.hit && Math.sqrt(race.hit.d2) <= ASPHALT) return false;
    }
    return true;
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

  function carCorners(r) {
    var c = Math.cos(r.heading);
    var s = Math.sin(r.heading);
    var x0 = -MESH_TAIL;
    var x1 = MESH_NOSE;
    var z0 = -MESH_HALF_W;
    var z1 = MESH_HALF_W;
    return [
      { x: r.x + c * x0 - s * z0, z: r.z + s * x0 + c * z0 },
      { x: r.x + c * x1 - s * z0, z: r.z + s * x1 + c * z0 },
      { x: r.x + c * x1 - s * z1, z: r.z + s * x1 + c * z1 },
      { x: r.x + c * x0 - s * z1, z: r.z + s * x0 + c * z1 },
    ];
  }

  function projectCorners(corners, ax, az) {
    var min = 1e9;
    var max = -1e9;
    var i;
    for (i = 0; i < 4; i++) {
      var p = corners[i].x * ax + corners[i].z * az;
      if (p < min) min = p;
      if (p > max) max = p;
    }
    return { min: min, max: max };
  }

  function meshOverlap(a, b) {
    var ca = carCorners(a);
    var cb = carCorners(b);
    var axes = [
      { x: Math.cos(a.heading), z: Math.sin(a.heading) },
      { x: -Math.sin(a.heading), z: Math.cos(a.heading) },
      { x: Math.cos(b.heading), z: Math.sin(b.heading) },
      { x: -Math.sin(b.heading), z: Math.cos(b.heading) },
    ];
    var best = 1e9;
    var nx = 1;
    var nz = 0;
    var i;
    for (i = 0; i < 4; i++) {
      var len = Math.hypot(axes[i].x, axes[i].z) || 1;
      var ax = axes[i].x / len;
      var az = axes[i].z / len;
      var pa = projectCorners(ca, ax, az);
      var pb = projectCorners(cb, ax, az);
      var over = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
      if (over <= 0) return null;
      if (over < best) {
        best = over;
        var midA = (pa.min + pa.max) * 0.5;
        var midB = (pb.min + pb.max) * 0.5;
        if (midA < midB) {
          nx = ax;
          nz = az;
        } else {
          nx = -ax;
          nz = -az;
        }
      }
    }
    return { nx: nx, nz: nz, depth: best };
  }

  function closestOnArc(px, pz, cx, cz, r, a0, a1) {
    var ang = Math.atan2(pz - cz, px - cx);
    var lo = Math.min(a0, a1);
    var hi = Math.max(a0, a1);
    // Fold into [lo, lo + 2PI) so the sweep test is unambiguous. Folding
    // into [lo - PI, hi + PI] only works while the sweep is under 180:
    // past that the window is wider than a full turn and points in the
    // middle of the arc were answered with an end point, which reads as
    // a 15m hole in the ribbon wherever a turn doubles back.
    var a = ang;
    while (a < lo) a += Math.PI * 2;
    while (a >= lo + Math.PI * 2) a -= Math.PI * 2;
    if (a > hi) a = a - hi <= lo + Math.PI * 2 - a ? hi : lo;
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

  var TRACK_CODE_MAX = 800;

  // Share tokens must survive Chromebook autocapitalize. Unique letters:
  // A straight, L long, R 90, W sweeper, H hairpin, C chicane, F start, P pit, T tree.
  // Legacy s/S/r/w/t still parse. Never strip W or T — that ate 9-piece boards down to 4.
  var TYPE_ENC = { s: "A", S: "L", r: "R", w: "W", H: "H", C: "C", F: "F", P: "P", t: "T" };
  var TYPE_DEC = {
    A: "s",
    a: "s",
    s: "s",
    L: "S",
    S: "S",
    R: "r",
    r: "r",
    W: "w",
    w: "w",
    H: "H",
    h: "H",
    C: "C",
    c: "C",
    F: "F",
    f: "F",
    P: "P",
    p: "P",
    T: "t",
    t: "t",
  };

  function canonType(t) {
    return TYPE_DEC[t] || "";
  }

  function cleanTrack(raw) {
    return String(raw || "").replace(/[^A-Za-z0-9]/g, "").slice(0, TRACK_CODE_MAX);
  }

  function addLine(ax, az, bx, bz, name, y0, y1) {
    var len = Math.hypot(bx - ax, bz - az);
    PATH.push({
      type: "line",
      ax: ax,
      az: az,
      bx: bx,
      bz: bz,
      y0: y0 || 0,
      y1: y1 == null ? y0 || 0 : y1,
      len: len,
      startS: TRACK_LEN,
      name: name,
    });
    TRACK_LEN += len;
  }

  function addArc(cx, cz, r, a0, a1, name, y0, y1) {
    var len = Math.abs(a1 - a0) * r;
    PATH.push({
      type: "arc",
      cx: cx,
      cz: cz,
      r: r,
      a0: a0,
      a1: a1,
      y0: y0 || 0,
      y1: y1 == null ? y0 || 0 : y1,
      len: len,
      startS: TRACK_LEN,
      name: name,
    });
    TRACK_LEN += len;
  }

  var _x = -200;
  var _z = SF_Z;
  var _h = 0;
  var _y = 0;

  function pathLine(dist, name, dy) {
    dy = dy || 0;
    var nx = _x + Math.cos(_h) * dist;
    var nz = _z + Math.sin(_h) * dist;
    addLine(_x, _z, nx, nz, name, _y, _y + dy);
    _x = nx;
    _z = nz;
    _y += dy;
  }

  function pathArc(r, deg, name, dy) {
    dy = dy || 0;
    var rad = (deg * Math.PI) / 180;
    var side = deg > 0 ? 1 : -1;
    var cx = _x + Math.cos(_h + side * Math.PI * 0.5) * r;
    var cz = _z + Math.sin(_h + side * Math.PI * 0.5) * r;
    var a0 = Math.atan2(_z - cz, _x - cx);
    var a1 = a0 + rad;
    addArc(cx, cz, r, a0, a1, name, _y, _y + dy);
    _h += rad;
    _x = cx + Math.cos(a1) * r;
    _z = cz + Math.sin(a1) * r;
    _y += dy;
  }

  function pathSnap(targetDeg, r, name) {
    var cur = (((_h * 180) / Math.PI) % 360 + 360) % 360;
    var d = targetDeg - cur;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    if (Math.abs(d) >= 0.4) pathArc(r, d, name);
  }

  var PIT_META = { ax: 28, az: -57, bx: 136, bz: -57, on: true };

  function pitSegLine(ax, az, bx, bz, name) {
    var startS = 0;
    if (PIT_PATH.length) {
      var prev = PIT_PATH[PIT_PATH.length - 1];
      startS = (prev.startS || 0) + (prev.len || 0);
    }
    PIT_PATH.push({
      type: "line",
      ax: ax,
      az: az,
      bx: bx,
      bz: bz,
      len: Math.hypot(bx - ax, bz - az),
      startS: startS,
      name: name,
    });
  }

  function pitSegArc(cx, cz, r, a0, a1, name) {
    var startS = 0;
    if (PIT_PATH.length) {
      var prev = PIT_PATH[PIT_PATH.length - 1];
      startS = (prev.startS || 0) + (prev.len || 0);
    }
    PIT_PATH.push({
      type: "arc",
      cx: cx,
      cz: cz,
      r: r,
      a0: a0,
      a1: a1,
      len: Math.abs(a1 - a0) * r,
      startS: startS,
      name: name,
    });
  }

  function pitLine(st, dist, name) {
    var nx = st.x + Math.cos(st.h) * dist;
    var nz = st.z + Math.sin(st.h) * dist;
    pitSegLine(st.x, st.z, nx, nz, name);
    st.x = nx;
    st.z = nz;
  }

  function pitArc(st, r, deg, name) {
    var rad = (deg * Math.PI) / 180;
    var side = deg > 0 ? 1 : -1;
    var cx = st.x + Math.cos(st.h + side * Math.PI * 0.5) * r;
    var cz = st.z + Math.sin(st.h + side * Math.PI * 0.5) * r;
    var a0 = Math.atan2(st.z - cz, st.x - cx);
    var a1 = a0 + rad;
    pitSegArc(cx, cz, r, a0, a1, name);
    st.h += rad;
    st.x = cx + Math.cos(a1) * r;
    st.z = cz + Math.sin(a1) * r;
  }

  function pitSBend(st, leftOff, name) {
    // Two equal arcs: shift `leftOff` to the left and restore heading.
    var sign = leftOff >= 0 ? 1 : -1;
    var off = Math.abs(leftOff);
    if (off < 0.4) return;
    var deg = 42;
    var rad = (deg * Math.PI) / 180;
    var r = off / (2 * (1 - Math.cos(rad)));
    if (r < 10) {
      deg = 55;
      rad = (deg * Math.PI) / 180;
      r = off / (2 * (1 - Math.cos(rad)));
    }
    pitArc(st, r, sign * deg, name);
    pitArc(st, r, -sign * deg, name);
  }

  function onPitPath(x, z) {
    if (!PIT_PATH.length) return false;
    var i;
    for (i = 0; i < PIT_PATH.length; i++) {
      var seg = PIT_PATH[i];
      var hit =
        seg.type === "line"
          ? closestOnSeg(x, z, seg.ax, seg.az, seg.bx, seg.bz)
          : closestOnArc(x, z, seg.cx, seg.cz, seg.r, seg.a0, seg.a1);
      if (hit && Math.sqrt(hit.d2) <= PIT_HALF) return true;
    }
    return false;
  }

  function pointOnPitPath(s) {
    if (!PIT_PATH.length) return null;
    var i;
    for (i = 0; i < PIT_PATH.length; i++) {
      var seg = PIT_PATH[i];
      var len = seg.len || 0;
      if (s <= (seg.startS || 0) + len || i === PIT_PATH.length - 1) {
        return pointOnSeg(seg, clamp((s - (seg.startS || 0)) / (len || 1), 0, 1));
      }
    }
    return pointOnSeg(PIT_PATH[0], 0);
  }

  function pitPathAhead(x, z, look) {
    if (!PIT_PATH.length) return null;
    var pr = projectOn(x, z, PIT_PATH);
    if (!pr || !pr.hit) return null;
    var last = PIT_PATH[PIT_PATH.length - 1];
    var endS = (last.startS || 0) + (last.len || 0);
    var s = pr.s + (look || 18);
    if (s >= endS - 2) return null;
    return pointOnPitPath(s);
  }

  function buildCampusPitPath() {
    PIT_PATH.length = 0;
    var laneZ = (PIT_LANE.z0 + PIT_LANE.z1) * 0.5;
    // Meet the LEFT edge of the ribbon, then S-bend out. Starting on
    // the racing line stacked a second road on the asphalt.
    var mouthZ = -67.2;
    var st = { x: 6, z: mouthZ, h: 0 };
    pitSBend(st, laneZ - st.z, "pitin");
    var exitX = 116;
    if (st.x < exitX) pitLine(st, exitX - st.x, "pitlane");
    pitSBend(st, mouthZ - st.z, "pitout");
  }

  function buildCustomPitPath() {
    PIT_PATH.length = 0;
    if (!PIT_META.on) return;
    var dx = PIT_META.bx - PIT_META.ax;
    var dz = PIT_META.bz - PIT_META.az;
    var len = Math.hypot(dx, dz) || 1;
    var fx = dx / len;
    var fz = dz / len;
    var h = Math.atan2(fz, fx);
    var lx = Math.cos(h + Math.PI * 0.5);
    var lz = Math.sin(h + Math.PI * 0.5);
    var inset = 12;
    var rx = PIT_META.ax - lx * inset;
    var rz = PIT_META.az - lz * inset;
    var startOff = 1.8;
    var back = 22;
    var st = {
      x: rx - fx * back + lx * startOff,
      z: rz - fz * back + lz * startOff,
      h: h,
    };
    pitSBend(st, inset - startOff, "pitin");
    var along = (st.x - PIT_META.ax) * fx + (st.z - PIT_META.az) * fz;
    var remain = len - along - 8;
    if (remain > 4) pitLine(st, remain, "pitlane");
    pitSBend(st, startOff - inset, "pitout");
  }

  function rebuildPitPath() {
    PIT_PATH.length = 0;
    if (!PIT_META.on) return;
    if (PIT_LANE.x0 === 28 && PIT_LANE.x1 === 136 && PIT_LANE.z0 === -61.5) {
      buildCampusPitPath();
    } else {
      buildCustomPitPath();
    }
  }

  function resetPathCursor() {
    PATH = [];
    TRACK_LEN = 0;
    _x = -200;
    _z = SF_Z;
    _h = 0;
    _y = 0;
    stampTrees = [];
  }

  function setDefaultPit() {
    PIT_ENTRY.x0 = 8;
    PIT_ENTRY.x1 = 28;
    PIT_ENTRY.z0 = -70.0;
    PIT_ENTRY.z1 = -61.0;
    PIT_EXIT.x0 = 128;
    PIT_EXIT.x1 = 160;
    PIT_EXIT.z0 = -68.0;
    PIT_EXIT.z1 = -58.0;
    PIT_LANE.x0 = 28;
    PIT_LANE.x1 = 136;
    PIT_LANE.z0 = -61.5;
    PIT_LANE.z1 = -52.5;
    PIT_GRAB.x0 = 64;
    PIT_GRAB.x1 = 98;
    PIT_GRAB.z0 = -61.0;
    PIT_GRAB.z1 = -53.2;
    PIT_PAVE.length = 0;
    PIT_PAVE.push(PIT_ENTRY, PIT_LANE, PIT_GRAB, PIT_EXIT);
    PIT_META.ax = PIT_LANE.x0;
    PIT_META.az = (PIT_LANE.z0 + PIT_LANE.z1) * 0.5;
    PIT_META.bx = PIT_LANE.x1;
    PIT_META.bz = PIT_META.az;
    PIT_META.on = true;
    rebuildPitPath();
  }

  function parkPitMouths() {
    PIT_ENTRY.x0 = 9999;
    PIT_ENTRY.x1 = 10000;
    PIT_ENTRY.z0 = 9999;
    PIT_ENTRY.z1 = 10000;
    PIT_EXIT.x0 = 9999;
    PIT_EXIT.x1 = 10000;
    PIT_EXIT.z0 = 9999;
    PIT_EXIT.z1 = 10000;
  }

  function clearPit() {
    parkPitMouths();
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
    PIT_PATH.length = 0;
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
    parkPitMouths();
    PIT_PAVE.length = 0;
    PIT_PAVE.push(PIT_LANE, PIT_GRAB);
    rebuildPitPath();
  }

  function turnWrap(a) {
    while (a < 0) a += Math.PI * 2;
    while (a >= Math.PI * 2) a -= Math.PI * 2;
    return a;
  }

  // Arc, straight, arc back to the start pose. Same-direction turns ride
  // the outer tangent of the two turn circles, opposite-direction turns
  // the inner one, so between them there is always a join.
  function joinPlan(R, d1, d2, branch) {
    var c1x = _x + Math.cos(_h + d1 * Math.PI * 0.5) * R;
    var c1z = _z + Math.sin(_h + d1 * Math.PI * 0.5) * R;
    var c2x = -200 + Math.cos(d2 * Math.PI * 0.5) * R;
    var c2z = SF_Z + Math.sin(d2 * Math.PI * 0.5) * R;
    var D = Math.hypot(c2x - c1x, c2z - c1z);
    var th = Math.atan2(c2z - c1z, c2x - c1x);
    var t;
    var run;
    if (d1 === d2) {
      if (branch || D < 0.5) return null;
      t = th;
      run = D;
    } else {
      if (D < 2 * R + 0.05) return null;
      run = Math.sqrt(D * D - 4 * R * R);
      // The crossing tangent is offset from the centre line by the angle
      // whose OPPOSITE side is 2R, not whose adjacent side is. acos here
      // put every S-shaped join 90 degrees out, and the only plan that
      // then closed the ribbon was a 337-degree loop laid straight over
      // the start straight — which is why four of the five circuits had
      // two bits of road sharing the same tarmac.
      var phi = Math.atan2(2 * R, run);
      t = th + (branch ? phi : -phi);
    }
    var a1 = turnWrap(d1 > 0 ? t - _h : _h - t);
    var a2 = turnWrap(d2 > 0 ? -t : t);
    return { R: R, d1: d1, d2: d2, a1: a1, a2: a2, run: run, cost: R * (a1 + a2) + run };
  }

  function emitJoin(pl, name) {
    if (pl.a1 > 0.004) pathArc(pl.R, (pl.d1 * pl.a1 * 180) / Math.PI, name);
    if (pl.run > 0.5) pathLine(pl.run, name);
    if (pl.a2 > 0.004) pathArc(pl.R, (pl.d2 * pl.a2 * 180) / Math.PI, name);
  }

  // Every metre of ribbon the join adds, against every metre that was
  // already there. The bit of road the join leaves and the bit it rejoins
  // are meant to be close; anything else means two parts of the lap share
  // the same tarmac, and then one leg's barriers stand across the other
  // leg's road and cars collide with rivals half a lap away.
  function joinClearance(pts, len0) {
    var worst = 1e9;
    var s;
    var i;
    for (s = len0 + 5; s < TRACK_LEN - 5; s += 5) {
      var p = centerlinePoint(s);
      for (i = 0; i < pts.length; i++) {
        if (pts[i].s > len0 - 46 || pts[i].s < 46) continue;
        var d = Math.hypot(p.x - pts[i].x, p.z - pts[i].z);
        if (d < worst) worst = d;
      }
    }
    return worst;
  }

  function autoClosePath() {
    var dx = -200 - _x;
    var dz = SF_Z - _z;
    if (Math.hypot(dx, dz) < 8 && Math.abs(Math.atan2(Math.sin(-_h), Math.cos(-_h))) < 0.12) return;
    // Turning moves the cursor, so "aim at home, drive to it, straighten
    // up" always finished tens of metres wide of the start and left a
    // hole in the ribbon across the S/F line. A loop with a hole is
    // unraceable: every car drives off the end of the road once a lap.
    // Every candidate is driven into a scratch path and checked against
    // the start pose, so a sign slip cannot ship a broken ribbon.
    // Tight radii matter: a 57m lateral step with 29m of road left to do
    // it in has no gentle S-turn, and without a tight one the only plan
    // that closes is a near-loop.
    var radii = [12, 16, 22, 30, 44, 64, 90];
    var save = { x: _x, z: _z, h: _h, n: PATH.length, len: TRACK_LEN };
    var pts = [];
    var s;
    for (s = 0; s < TRACK_LEN; s += 5) {
      var sp = centerlinePoint(s);
      pts.push({ x: sp.x, z: sp.z, s: s });
    }
    var clean = null;
    var any = null;
    var i;
    var d1;
    var d2;
    var br;
    for (i = 0; i < radii.length; i++) {
      for (d1 = -1; d1 <= 1; d1 += 2) {
        for (d2 = -1; d2 <= 1; d2 += 2) {
          for (br = 0; br < 2; br++) {
            var plan = joinPlan(radii[i], d1, d2, !!br);
            if (!plan) continue;
            if (clean && plan.cost >= clean.cost) continue;
            emitJoin(plan, "close");
            var gap = Math.hypot(-200 - _x, SF_Z - _z);
            var kink = Math.abs(Math.atan2(Math.sin(-_h), Math.cos(-_h)));
            var clear = joinClearance(pts, save.len);
            PATH.length = save.n;
            TRACK_LEN = save.len;
            _x = save.x;
            _z = save.z;
            _h = save.h;
            if (gap > 0.6 || kink > 0.02) continue;
            if (!any || plan.cost < any.cost) any = plan;
            if (clear > ASPHALT * 2 + 3 && (!clean || plan.cost < clean.cost)) clean = plan;
          }
        }
      }
    }
    var pick = clean || any;
    if (pick) {
      emitJoin(pick, "close");
      return;
    }
    var want = (Math.atan2(dz, dx) * 180) / Math.PI;
    pathSnap(want, 20, "close");
    var left = Math.hypot(-200 - _x, SF_Z - _z);
    if (left > 2) pathLine(left, "close");
    pathSnap(0, 16, "close");
  }

  function buildCampusPath() {
    // Start straight must stay asphalt for a W-only stay-right past 10s.
    // 430 dumped them into the first 90 / void at ~7s once the pit
    // stopped grabbing on the ribbon (mp83).
    pathLine(680, "start");
    pathArc(40, 48, "the90");
    pathArc(13, 42, "the90");
    pathLine(70, "short");
    pathArc(12, 88, "the90");
    pathLine(150, "short");
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

  function flattenCloseToZero(name) {
    var i;
    for (i = 0; i < PATH.length; i++) {
      if (PATH[i].name === "close") PATH[i].name = name || PATH[i].name;
    }
    if (Math.abs(_y) < 0.05) {
      _y = 0;
      return;
    }
    var start = Math.max(0, PATH.length - 4);
    var y = PATH[start].y0 || 0;
    for (i = start; i < PATH.length; i++) {
      PATH[i].y0 = y;
      PATH[i].y1 = i === PATH.length - 1 ? 0 : y + (0 - y) * ((i - start + 1) / (PATH.length - start));
      y = PATH[i].y1;
    }
    _y = 0;
  }

  function goTo(x, z, headingDeg, name) {
    var dx = x - _x;
    var dz = z - _z;
    var dist = Math.hypot(dx, dz);
    if (dist > 2) {
      pathSnap((Math.atan2(dz, dx) * 180) / Math.PI, 26, name);
      pathLine(Math.hypot(x - _x, z - _z), name);
    }
    if (headingDeg != null) pathSnap(headingDeg, 26, name);
  }

  function closeWithSweeper(name) {
    var R = 72;
    goTo(-200 - R, SF_Z + R, -90, name);
    pathArc(R, 90, name);
    if (Math.hypot(-200 - _x, SF_Z - _z) > 6) autoClosePath();
    flattenCloseToZero(name);
  }

  function buildHarborPath() {
    // Monaco read, flat: port SF → Sainte-Devote → Casino → Fairmont
    // hairpin → tunnel → Nouvelle chicane → Tabac → Pool → Rascasse → port.
    pathLine(420, "start");
    pathArc(15, -82, "devote");
    pathLine(70, "climb");
    pathArc(20, 75, "casino");
    pathLine(46, "square");
    pathArc(16, -55, "mirabeau");
    pathLine(36, "drop");
    pathArc(11, 176, "hairpin");
    pathLine(28, "portier");
    pathArc(18, -42, "portier");
    pathLine(96, "tunnel");
    pathArc(12, 78, "chicane");
    pathLine(16, "chicane");
    pathArc(11, -88, "chicane");
    pathLine(36, "tabac");
    pathArc(15, -48, "tabac");
    pathLine(28, "pool");
    pathArc(10, 86, "pool");
    pathLine(14, "pool");
    pathArc(10, -86, "pool");
    pathLine(34, "rascasse");
    pathArc(12, -92, "rascasse");
    pathLine(50, "harbor");
    closeWithSweeper("harbor");
  }

  function buildParkPath() {
    // Monza read, flat: Rettifilo → Roggia → Lesmo 1/2 → Ascari → Parabolica.
    pathLine(460, "start");
    pathArc(12, 80, "rettifilo");
    pathLine(16, "rettifilo");
    pathArc(11, -95, "rettifilo");
    pathLine(90, "biassono");
    pathArc(12, 78, "roggia");
    pathLine(14, "roggia");
    pathArc(11, -88, "roggia");
    pathLine(70, "short");
    pathArc(18, -78, "lesmo");
    pathLine(40, "lesmo");
    pathArc(16, -70, "lesmo");
    pathLine(220, "serraglio");
    pathArc(13, 82, "ascari");
    pathLine(18, "ascari");
    pathArc(12, -90, "ascari");
    pathLine(16, "ascari");
    pathArc(14, 70, "ascari");
    pathLine(80, "parabola");
    closeWithSweeper("parabola");
  }

  function buildDesertPath() {
    // Sakhir read, flat: floodlit pit straight → tight T1 → oasis 90s → kink → sweeper.
    pathLine(520, "start");
    pathArc(14, -95, "t1");
    pathLine(90, "short");
    pathArc(18, -70, "oasis");
    pathLine(70, "oasis");
    pathArc(16, 78, "oasis");
    pathLine(60, "oasis");
    pathArc(15, -72, "oasis");
    pathLine(280, "back");
    pathArc(20, -28, "kink");
    pathLine(120, "kink");
    closeWithSweeper("sweeper");
  }

  function buildForestPath() {
    // Spa read: valley SF → La Source → drop → Eau Rouge / Raidillon climb
    // → forest → downhill → bus-stop → valley return. Only built-in with dy.
    pathLine(560, "start");
    pathArc(13, -168, "source");
    pathLine(80, "drop", -5);
    pathArc(26, 58, "eau", 4);
    pathArc(20, -52, "raidillon", 7);
    pathLine(200, "raidillon", 8);
    pathLine(220, "forest");
    pathArc(18, -78, "lescombes");
    pathLine(120, "forest", -3);
    pathArc(16, -64, "pouhon");
    pathLine(140, "forest", -3);
    pathArc(12, 78, "busstop");
    pathLine(16, "busstop");
    pathArc(11, -86, "busstop");
    pathLine(140, "return", -4);
    closeWithSweeper("return");
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

  var MAP_SURF = [];
  var MAP_CLOSED = false;
  var MAP_W = 16;
  var MAP_H = 12;
  var MAP_CELL = 88;
  var MAP_OX = -200;
  var MAP_OZ = SF_Z;
  var MAP_DXY = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  var MAP_TYPES = {
    s: { kind: "flat", name: "short" },
    S: { kind: "long", name: "short" },
    r: { kind: "corner", name: "the90" },
    w: { kind: "sweep", name: "sweeper" },
    H: { kind: "hairpin", name: "hairpin" },
    C: { kind: "chicane", name: "chicane" },
    F: { kind: "flat", name: "start" },
    P: { kind: "flat", name: "start" },
    t: { kind: "prop", name: "tree" },
  };

  function mapKey(x, y) {
    return x + "," + y;
  }

  function cellNW(x, y) {
    return { x: MAP_OX + x * MAP_CELL, z: MAP_OZ + y * MAP_CELL };
  }

  function cellCenter(x, y) {
    return { x: MAP_OX + (x + 0.5) * MAP_CELL, z: MAP_OZ + (y + 0.5) * MAP_CELL };
  }

  function edgeMid(x, y, dir) {
    var o = cellNW(x, y);
    var h = MAP_CELL * 0.5;
    if (dir === 0) return { x: o.x + MAP_CELL, z: o.z + h };
    if (dir === 1) return { x: o.x + h, z: o.z + MAP_CELL };
    if (dir === 2) return { x: o.x, z: o.z + h };
    return { x: o.x + h, z: o.z };
  }

  function footprint(p) {
    var cells = [{ x: p.x, y: p.y }];
    var kind = MAP_TYPES[p.t] && MAP_TYPES[p.t].kind;
    if (kind === "long" || kind === "hairpin") {
      var d = MAP_DXY[p.r & 3];
      cells.push({ x: p.x + d[0], y: p.y + d[1] });
    } else if (kind === "sweep") {
      cells.push({ x: p.x + 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x + 1, y: p.y + 1 });
    }
    return cells;
  }

  function cellsInBoard(cells) {
    var i;
    for (i = 0; i < cells.length; i++) {
      if (cells[i].x < 0 || cells[i].y < 0 || cells[i].x >= MAP_W || cells[i].y >= MAP_H) return false;
    }
    return cells.length > 0;
  }

  function pieceSpan(t, r) {
    var kind = MAP_TYPES[t] && MAP_TYPES[t].kind;
    if (kind === "sweep") return { cols: 2, rows: 2 };
    if (kind === "long" || kind === "hairpin") return r & 1 ? { cols: 1, rows: 2 } : { cols: 2, rows: 1 };
    return { cols: 1, rows: 1 };
  }

  function portList(p) {
    var k = MAP_TYPES[p.t] && MAP_TYPES[p.t].kind;
    var x = p.x;
    var y = p.y;
    var r = p.r & 3;
    if (k === "prop" || !k) return [];
    if (k === "flat" || k === "chicane") {
      return [
        { dir: (0 + r) & 3, x: x, y: y },
        { dir: (2 + r) & 3, x: x, y: y },
      ];
    }
    if (k === "corner") {
      return [
        { dir: (0 + r) & 3, x: x, y: y },
        { dir: (1 + r) & 3, x: x, y: y },
      ];
    }
    if (k === "long") {
      var d = MAP_DXY[r];
      return [
        { dir: (r + 2) & 3, x: x, y: y },
        { dir: r, x: x + d[0], y: y + d[1] },
      ];
    }
    if (k === "hairpin") {
      var hd = MAP_DXY[r];
      var open = (r + 1) & 3;
      return [
        { dir: open, x: x, y: y },
        { dir: open, x: x + hd[0], y: y + hd[1] },
      ];
    }
    if (k === "sweep") {
      if (r === 0) return [{ dir: 0, x: x + 1, y: y }, { dir: 1, x: x, y: y + 1 }];
      if (r === 1) return [{ dir: 1, x: x + 1, y: y + 1 }, { dir: 2, x: x, y: y }];
      if (r === 2) return [{ dir: 2, x: x, y: y + 1 }, { dir: 3, x: x + 1, y: y }];
      return [{ dir: 3, x: x, y: y }, { dir: 0, x: x + 1, y: y + 1 }];
    }
    return [];
  }

  // Cells 0-9 stay digits so old 8x6 share-strings still paste.
  // 10+ is a-z (Chromebook uppercase still decodes).
  function encCell(n) {
    n = n | 0;
    if (n < 0) n = 0;
    if (n > 35) n = 35;
    return n < 10 ? String(n) : String.fromCharCode(87 + n);
  }

  function decCell(ch) {
    if (!ch) return NaN;
    var c = ch.charCodeAt(0);
    if (c >= 48 && c <= 57) return c - 48;
    if (c >= 97 && c <= 122) return c - 87;
    if (c >= 65 && c <= 90) return c - 55;
    return NaN;
  }

  function parseMap(code) {
    var pieces = [];
    if (!code || code.charAt(0) !== "M") return pieces;
    var i;
    for (i = 1; i + 3 < code.length; i += 4) {
      var t = canonType(code.charAt(i));
      var x = decCell(code.charAt(i + 1));
      var y = decCell(code.charAt(i + 2));
      var r = +code.charAt(i + 3);
      if (!t || !MAP_TYPES[t]) continue;
      if (isNaN(x) || isNaN(y) || isNaN(r) || r < 0 || r > 3) continue;
      var p = { t: t, x: x, y: y, r: r };
      if (!cellsInBoard(footprint(p))) continue;
      pieces.push(p);
    }
    return pieces;
  }

  function encodeMap(pieces) {
    if (!pieces || !pieces.length) return "";
    var s = "M";
    var i;
    for (i = 0; i < pieces.length && s.length + 4 <= TRACK_CODE_MAX; i++) {
      var t = TYPE_ENC[pieces[i].t] || pieces[i].t;
      s += t + encCell(pieces[i].x) + encCell(pieces[i].y) + (pieces[i].r & 3);
    }
    return s;
  }

  function occupyMap(pieces) {
    var by = {};
    var i;
    var j;
    for (i = 0; i < pieces.length; i++) {
      var cells = footprint(pieces[i]);
      for (j = 0; j < cells.length; j++) by[mapKey(cells[j].x, cells[j].y)] = pieces[i];
    }
    return by;
  }

  function footprintsOverlap(a, b) {
    var A = footprint(a);
    var B = footprint(b);
    var i;
    var j;
    for (i = 0; i < A.length; i++) {
      for (j = 0; j < B.length; j++) {
        if (A[i].x === B[j].x && A[i].y === B[j].y) return true;
      }
    }
    return false;
  }

  function lineSeg(ax, az, bx, bz, name) {
    return { type: "line", ax: ax, az: az, bx: bx, bz: bz, name: name };
  }

  function arcSeg(cx, cz, r, a0, a1, name) {
    return { type: "arc", cx: cx, cz: cz, r: r, a0: a0, a1: a1, name: name };
  }

  function reverseSeg(seg) {
    if (seg.type === "line") return lineSeg(seg.bx, seg.bz, seg.ax, seg.az, seg.name);
    return arcSeg(seg.cx, seg.cz, seg.r, seg.a1, seg.a0, seg.name);
  }

  function chicanePts(x, y, r) {
    var w = edgeMid(x, y, (2 + r) & 3);
    var e = edgeMid(x, y, (0 + r) & 3);
    var fx = e.x - w.x;
    var fz = e.z - w.z;
    var fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    var lx = -fz;
    var lz = fx;
    // Small S inside the cell. Flat at both ports so they sit flush on
    // the mid-edges. A fat zig-zag leaked asphalt into the next tile
    // and stacked on the neighbor (that was the overlap / half-spin).
    // Do not grow the cell — keep the amplitude inside half-cell minus ribbon.
    var amp = MAP_CELL * 0.1;
    var pts = [w];
    var n = 16;
    var i;
    for (i = 1; i < n; i++) {
      var t = i / n;
      var px = w.x + (e.x - w.x) * t;
      var pz = w.z + (e.z - w.z) * t;
      var env = Math.sin(t * Math.PI);
      env *= env;
      var s = Math.sin(t * Math.PI * 2) * env * amp;
      pts.push({ x: px + lx * s, z: pz + lz * s });
    }
    pts.push(e);
    return pts;
  }

  function pieceSegs(p) {
    var name = MAP_TYPES[p.t].name;
    var k = MAP_TYPES[p.t].kind;
    var x = p.x;
    var y = p.y;
    var r = p.r & 3;
    var C = MAP_CELL;
    if (k === "prop") return [];
    if (k === "flat") {
      var a = edgeMid(x, y, (0 + r) & 3);
      var b = edgeMid(x, y, (2 + r) & 3);
      return [lineSeg(a.x, a.z, b.x, b.z, name)];
    }
    if (k === "long") {
      var ports = portList(p);
      var pa = edgeMid(ports[0].x, ports[0].y, ports[0].dir);
      var pb = edgeMid(ports[1].x, ports[1].y, ports[1].dir);
      return [lineSeg(pa.x, pa.z, pb.x, pb.z, name)];
    }
    if (k === "corner") {
      var o = cellNW(x, y);
      var cx;
      var cz;
      var a0;
      var a1;
      if (r === 0) {
        cx = o.x + C;
        cz = o.z + C;
        a0 = -Math.PI * 0.5;
        a1 = -Math.PI;
      } else if (r === 1) {
        cx = o.x;
        cz = o.z + C;
        a0 = 0;
        a1 = -Math.PI * 0.5;
      } else if (r === 2) {
        cx = o.x;
        cz = o.z;
        a0 = Math.PI * 0.5;
        a1 = 0;
      } else {
        cx = o.x + C;
        cz = o.z;
        a0 = Math.PI;
        a1 = Math.PI * 0.5;
      }
      return [arcSeg(cx, cz, C * 0.5, a0, a1, name)];
    }
    if (k === "chicane") {
      var pts = chicanePts(x, y, r);
      var segs = [];
      var ci;
      for (ci = 0; ci < pts.length - 1; ci++) {
        segs.push(lineSeg(pts[ci].x, pts[ci].z, pts[ci + 1].x, pts[ci + 1].z, name));
      }
      return segs;
    }
    if (k === "hairpin") {
      var hp = portList(p);
      var ha = edgeMid(hp[0].x, hp[0].y, hp[0].dir);
      var hb = edgeMid(hp[1].x, hp[1].y, hp[1].dir);
      var hcx = (ha.x + hb.x) * 0.5;
      var hcz = (ha.z + hb.z) * 0.5;
      var ang0 = Math.atan2(ha.z - hcz, ha.x - hcx);
      var ang1 = ang0 + Math.PI;
      return [arcSeg(hcx, hcz, C * 0.5, ang0, ang1, name)];
    }
    if (k === "sweep") {
      var o2 = cellNW(x, y);
      var scx;
      var scz;
      var sa0;
      var sa1;
      if (r === 0) {
        scx = o2.x + C * 2;
        scz = o2.z + C * 2;
        sa0 = -Math.PI * 0.5;
        sa1 = -Math.PI;
      } else if (r === 1) {
        scx = o2.x;
        scz = o2.z + C * 2;
        sa0 = 0;
        sa1 = -Math.PI * 0.5;
      } else if (r === 2) {
        scx = o2.x;
        scz = o2.z;
        sa0 = Math.PI * 0.5;
        sa1 = 0;
      } else {
        scx = o2.x + C * 2;
        scz = o2.z;
        sa0 = Math.PI;
        sa1 = Math.PI * 0.5;
      }
      return [arcSeg(scx, scz, C * 1.5, sa0, sa1, name)];
    }
    return [];
  }

  function footprintBox(p) {
    var fp = footprint(p);
    var x0 = Infinity;
    var z0 = Infinity;
    var x1 = -Infinity;
    var z1 = -Infinity;
    var i;
    for (i = 0; i < fp.length; i++) {
      var o = cellNW(fp[i].x, fp[i].y);
      if (o.x < x0) x0 = o.x;
      if (o.z < z0) z0 = o.z;
      if (o.x + MAP_CELL > x1) x1 = o.x + MAP_CELL;
      if (o.z + MAP_CELL > z1) z1 = o.z + MAP_CELL;
    }
    return { x0: x0, z0: z0, x1: x1, z1: z1 };
  }

  function pointInBox(x, z, box, pad) {
    return x >= box.x0 - pad && x <= box.x1 + pad && z >= box.z0 - pad && z <= box.z1 + pad;
  }

  function ribbonFitsFootprint(p) {
    if (!p || !MAP_TYPES[p.t] || MAP_TYPES[p.t].kind === "prop") return true;
    var segs = pieceSegs(p);
    if (!segs.length) return true;
    var box = footprintBox(p);
    var ports = portList(p);
    var kind = MAP_TYPES[p.t].kind;
    var i;
    var u;
    var pi;
    for (i = 0; i < segs.length; i++) {
      for (u = 0; u <= 1.001; u += 0.1) {
        var pt = pointOnSeg(segs[i], u > 1 ? 1 : u);
        var near = false;
        var nearDist = kind === "chicane" ? 4 : 14;
        for (pi = 0; pi < ports.length; pi++) {
          var pm = edgeMid(ports[pi].x, ports[pi].y, ports[pi].dir);
          if (Math.hypot(pt.x - pm.x, pt.z - pm.z) < nearDist) {
            near = true;
            break;
          }
        }
        // Centerline stays in the cell. Ribbon too, except the flush
        // port join (90s sit on an edge). A chicane may not use a fat
        // port pad — that hid S leaking into the next tile.
        var linePad = 0.25;
        var ribPad = near ? (kind === "chicane" ? 0.55 : ASPHALT + 0.5) : 0.35;
        var nx = -Math.sin(pt.h);
        var nz = Math.cos(pt.h);
        if (!pointInBox(pt.x, pt.z, box, linePad)) return false;
        if (!pointInBox(pt.x + nx * ASPHALT, pt.z + nz * ASPHALT, box, ribPad)) return false;
        if (!pointInBox(pt.x - nx * ASPHALT, pt.z - nz * ASPHALT, box, ribPad)) return false;
      }
    }
    return true;
  }

  function sharedPortPt(a, b) {
    var pa = portList(a);
    var pb = portList(b);
    var i;
    var j;
    for (i = 0; i < pa.length; i++) {
      var ma = edgeMid(pa[i].x, pa[i].y, pa[i].dir);
      for (j = 0; j < pb.length; j++) {
        var mb = edgeMid(pb[j].x, pb[j].y, pb[j].dir);
        if (Math.hypot(ma.x - mb.x, ma.z - mb.z) < 1.2) return ma;
      }
    }
    return null;
  }

  function ribbonsStack(a, b) {
    var sa = pieceSegs(a);
    var sb = pieceSegs(b);
    if (!sa.length || !sb.length) return false;
    var port = sharedPortPt(a, b);
    var i;
    var u;
    var j;
    var v;
    for (i = 0; i < sa.length; i++) {
      for (u = 0; u <= 1.001; u += 0.25) {
        var pa = pointOnSeg(sa[i], u > 1 ? 1 : u);
        if (port && Math.hypot(pa.x - port.x, pa.z - port.z) < ASPHALT + 3) continue;
        for (j = 0; j < sb.length; j++) {
          for (v = 0; v <= 1.001; v += 0.25) {
            var pb = pointOnSeg(sb[j], v > 1 ? 1 : v);
            if (port && Math.hypot(pb.x - port.x, pb.z - port.z) < ASPHALT + 3) continue;
            if (Math.hypot(pa.x - pb.x, pa.z - pb.z) < ASPHALT * 1.7) return true;
          }
        }
      }
    }
    return false;
  }

  function emitSeg(seg) {
    if (seg.type === "line") addLine(seg.ax, seg.az, seg.bx, seg.bz, seg.name);
    else addArc(seg.cx, seg.cz, seg.r, seg.a0, seg.a1, seg.name);
  }

  function segStart(seg) {
    if (seg.type === "line") return { x: seg.ax, z: seg.az };
    return { x: seg.cx + Math.cos(seg.a0) * seg.r, z: seg.cz + Math.sin(seg.a0) * seg.r };
  }

  function segEnd(seg) {
    if (seg.type === "line") return { x: seg.bx, z: seg.bz };
    return { x: seg.cx + Math.cos(seg.a1) * seg.r, z: seg.cz + Math.sin(seg.a1) * seg.r };
  }

  function flipSegs(segs) {
    segs.reverse();
    var i;
    for (i = 0; i < segs.length; i++) segs[i] = reverseSeg(segs[i]);
    return segs;
  }

  function segsFromEnter(p, fromDir, fromX, fromY) {
    var segs = pieceSegs(p).slice();
    if (!segs.length) return segs;
    var ports = portList(p);
    if (!ports.length) return segs;
    var enter = 0;
    var i;
    for (i = 0; i < ports.length; i++) {
      if (fromDir != null && ports[i].dir === fromDir && ports[i].x === fromX && ports[i].y === fromY) enter = i;
    }
    var startPt = edgeMid(ports[enter].x, ports[enter].y, ports[enter].dir);
    var a = segStart(segs[0]);
    var b = segEnd(segs[segs.length - 1]);
    if (Math.hypot(a.x - startPt.x, a.z - startPt.z) > Math.hypot(b.x - startPt.x, b.z - startPt.z) + 0.5) {
      flipSegs(segs);
    }
    return segs;
  }

  function exitPortAfter(p, segs) {
    var ports = portList(p);
    if (!ports.length) return null;
    if (!segs || !segs.length) return ports[0];
    var end = segEnd(segs[segs.length - 1]);
    var best = ports[0];
    var bestD = 1e9;
    var i;
    for (i = 0; i < ports.length; i++) {
      var m = edgeMid(ports[i].x, ports[i].y, ports[i].dir);
      var d = Math.hypot(m.x - end.x, m.z - end.z);
      if (d < bestD) {
        bestD = d;
        best = ports[i];
      }
    }
    return best;
  }

  function placePitFromPiece(p, oriented) {
    var segs = oriented && oriented.length ? oriented : pieceSegs(p);
    if (!segs.length || segs[0].type !== "line") return;
    var s = segs[0];
    var heading = Math.atan2(s.bz - s.az, s.bx - s.ax);
    var fx = Math.cos(heading);
    var fz = Math.sin(heading);
    var lx = Math.cos(heading + Math.PI * 0.5);
    var lz = Math.sin(heading + Math.PI * 0.5);
    var len = MAP_CELL;
    var inset = 12;
    var half = 5.4;
    var xs = [s.ax + lx * (inset - half), s.ax + lx * (inset + half), s.ax + fx * len + lx * (inset - half), s.ax + fx * len + lx * (inset + half)];
    var zs = [s.az + lz * (inset - half), s.az + lz * (inset + half), s.az + fz * len + lz * (inset - half), s.az + fz * len + lz * (inset + half)];
    PIT_LANE.x0 = Math.min.apply(null, xs);
    PIT_LANE.x1 = Math.max.apply(null, xs);
    PIT_LANE.z0 = Math.min.apply(null, zs);
    PIT_LANE.z1 = Math.max.apply(null, zs);
    PIT_META.ax = s.ax + lx * inset;
    PIT_META.az = s.az + lz * inset;
    PIT_META.bx = s.ax + fx * len + lx * inset;
    PIT_META.bz = s.az + fz * len + lz * inset;
    PIT_META.on = true;
    var t0 = 0.48;
    var t1 = 0.78;
    var gx = [
      PIT_META.ax + (PIT_META.bx - PIT_META.ax) * t0 + lx * -half,
      PIT_META.ax + (PIT_META.bx - PIT_META.ax) * t0 + lx * half,
      PIT_META.ax + (PIT_META.bx - PIT_META.ax) * t1 + lx * -half,
      PIT_META.ax + (PIT_META.bx - PIT_META.ax) * t1 + lx * half,
    ];
    var gz = [
      PIT_META.az + (PIT_META.bz - PIT_META.az) * t0 + lz * -half,
      PIT_META.az + (PIT_META.bz - PIT_META.az) * t0 + lz * half,
      PIT_META.az + (PIT_META.bz - PIT_META.az) * t1 + lz * -half,
      PIT_META.az + (PIT_META.bz - PIT_META.az) * t1 + lz * half,
    ];
    PIT_GRAB.x0 = Math.min.apply(null, gx);
    PIT_GRAB.x1 = Math.max.apply(null, gx);
    PIT_GRAB.z0 = Math.min.apply(null, gz);
    PIT_GRAB.z1 = Math.max.apply(null, gz);
    parkPitMouths();
    PIT_PAVE.length = 0;
    PIT_PAVE.push(PIT_LANE, PIT_GRAB);
    rebuildPitPath();
  }

  function findEnterPort(p, dir, cx, cy) {
    var ports = portList(p);
    var i;
    for (i = 0; i < ports.length; i++) {
      if (ports[i].dir === dir && ports[i].x === cx && ports[i].y === cy) return ports[i];
    }
    return null;
  }

  function buildMapPath(code) {
    MAP_SURF = [];
    var pieces = parseMap(code);
    var i;
    var j;
    for (i = 0; i < pieces.length; i++) {
      if (pieces[i].t === "t") {
        var tc = cellCenter(pieces[i].x, pieces[i].y);
        stampTrees.push({ x: tc.x, z: tc.z });
      }
    }
    var track = pieces.filter(function (p) {
      return p.t !== "t";
    });
    if (!track.length) {
      MAP_SURF = [];
      setDefaultPit();
      buildCampusPath();
      return;
    }
    var occ = occupyMap(track);
    var start = null;
    for (i = 0; i < track.length; i++) {
      if (track[i].t === "F") {
        start = track[i];
        break;
      }
    }
    if (!start) {
      for (i = 0; i < track.length; i++) {
        if (track[i].t === "P") {
          start = track[i];
          break;
        }
      }
    }
    if (!start) start = track[0];
    var startPorts = portList(start);
    var fromPort = startPorts[0];
    var visited = {};
    var cur = start;
    var hadPit = false;
    var used = {};
    var guard = 0;
    var lastOut = null;
    while (cur && guard++ < 64) {
      var id = mapKey(cur.x, cur.y);
      if (visited[id]) break;
      visited[id] = 1;
      used[id] = 1;
      var segs = segsFromEnter(cur, fromPort.dir, fromPort.x, fromPort.y);
      for (j = 0; j < segs.length; j++) emitSeg(segs[j]);
      if (cur.t === "P") {
        placePitFromPiece(cur, segs);
        hadPit = true;
      }
      var out = exitPortAfter(cur, segs);
      lastOut = out;
      if (!out) break;
      var nx = out.x + MAP_DXY[out.dir][0];
      var ny = out.y + MAP_DXY[out.dir][1];
      var np = occ[mapKey(nx, ny)];
      if (!np || np.t === "t") break;
      var back = (out.dir + 2) & 3;
      var hit = findEnterPort(np, back, nx, ny);
      if (!hit) break;
      fromPort = hit;
      cur = np;
    }
    MAP_CLOSED = false;
    if (lastOut && Object.keys(visited).length >= 4) {
      var cxn = lastOut.x + MAP_DXY[lastOut.dir][0];
      var cyn = lastOut.y + MAP_DXY[lastOut.dir][1];
      var backTo = occ[mapKey(cxn, cyn)];
      if (backTo === start && findEnterPort(start, (lastOut.dir + 2) & 3, cxn, cyn)) MAP_CLOSED = true;
    }
    if (!hadPit) {
      for (i = 0; i < track.length; i++) {
        if (track[i].t === "P") {
          placePitFromPiece(track[i], segsFromEnter(track[i], null, 0, 0));
          hadPit = true;
          break;
        }
      }
    }
    if (!hadPit) clearPit();
    MAP_SURF = PATH.slice();
  }

  function rebuildPath(code) {
    resetPathCursor();
    MAP_SURF = [];
    MAP_CLOSED = false;
    var spec = builtinSpec(code);
    if (code && !spec) {
      if (code.charAt(0) === "M") buildMapPath(code);
      else {
        buildCodePath(code);
        MAP_CLOSED = TRACK_LEN > 80;
      }
      activeBuiltin = MAP_CLOSED ? "" : "campus";
      setTrackKerbs("campus");
    } else {
      setDefaultPit();
      activeBuiltin = spec ? spec.id : "campus";
      if (activeBuiltin === "harbor") buildHarborPath();
      else if (activeBuiltin === "park") buildParkPath();
      else if (activeBuiltin === "desert") buildDesertPath();
      else if (activeBuiltin === "forest") buildForestPath();
      else buildCampusPath();
      setTrackKerbs(activeBuiltin);
    }
    if (!code || spec) RIBBON_SEGS = Math.max(360, Math.round(TRACK_LEN / 2.4));
    else RIBBON_SEGS = Math.max(180, Math.min(720, Math.round(Math.max(TRACK_LEN, 80) / 2.4)));
  }

  function isDriveableLoop() {
    // Closed is closed. A 4-piece rectangle is a race, not junk.
    // Only open / unwalkable boards fail — TRACK_LEN > 80 used to
    // bounce a header that already said CLOSED LOOP back to Campus.
    return !!(MAP_CLOSED && PATH.length && MAP_SURF.length);
  }

  function lockRacePath(code) {
    code = cleanTrack(code || "");
    rebuildPath(code);
    if (builtinSpec(code)) {
      /* reserved built-in — do not bounce */
    } else if (code && !MAP_CLOSED) rebuildPath("");
    return isDriveableLoop();
  }

  function pointOnSeg(seg, u) {
    var y0 = seg.y0 || 0;
    var y1 = seg.y1 == null ? y0 : seg.y1;
    var y = y0 + (y1 - y0) * u;
    var pitch = seg.len > 0.01 ? (y1 - y0) / seg.len : 0;
    if (seg.type === "line") {
      return {
        x: seg.ax + (seg.bx - seg.ax) * u,
        z: seg.az + (seg.bz - seg.az) * u,
        y: y,
        pitch: pitch,
        h: Math.atan2(seg.bz - seg.az, seg.bx - seg.ax),
        name: seg.name,
        r: 999,
        left: 0,
      };
    }
    var a = seg.a0 + (seg.a1 - seg.a0) * u;
    return {
      x: seg.cx + Math.cos(a) * seg.r,
      z: seg.cz + Math.sin(a) * seg.r,
      y: y,
      pitch: pitch,
      h: seg.a1 >= seg.a0 ? a + Math.PI * 0.5 : a - Math.PI * 0.5,
      name: seg.name,
      r: seg.r,
      left: seg.a1 >= seg.a0 ? 1 : -1,
    };
  }

  function centerlinePoint(s) {
    if (!PATH.length || TRACK_LEN <= 0) {
      return { x: 0, z: SF_Z, y: 0, pitch: 0, h: 0, name: "start", r: 999, left: 0 };
    }
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

  function projectOn(px, pz, segs) {
    var best = null;
    var bestS = 0;
    var i;
    for (i = 0; i < segs.length; i++) {
      var seg = segs[i];
      var hit =
        seg.type === "line"
          ? closestOnSeg(px, pz, seg.ax, seg.az, seg.bx, seg.bz)
          : closestOnArc(px, pz, seg.cx, seg.cz, seg.r, seg.a0, seg.a1);
      if (!best || hit.d2 < best.d2) {
        best = hit;
        bestS = (seg.startS || 0) + hit.t * (seg.len != null ? seg.len : 0);
        best.name = seg.name;
      }
    }
    return { hit: best, s: bestS };
  }

  // Same answer as projectTrack, but the caller says roughly where the
  // car was. On a twisty board two bits of ribbon can run within a car's
  // width of each other, and plain nearest-segment flips between them:
  // the car then reads as pointing the wrong way, 700m further round the
  // lap, and braking for a corner that is somewhere else entirely. A car
  // cannot travel 70m in a frame, so the hint settles it.
  function projectTrackNear(px, pz, sHint) {
    var segs = PATH.length ? PATH : MAP_SURF;
    if (sHint == null || !isFinite(sHint) || !segs.length || !(TRACK_LEN > 8)) return projectTrack(px, pz);
    var best = null;
    var bestS = 0;
    var i;
    for (i = 0; i < segs.length; i++) {
      var seg = segs[i];
      var hit =
        seg.type === "line"
          ? closestOnSeg(px, pz, seg.ax, seg.az, seg.bx, seg.bz)
          : closestOnArc(px, pz, seg.cx, seg.cz, seg.r, seg.a0, seg.a1);
      var s = (seg.startS || 0) + hit.t * (seg.len != null ? seg.len : 0);
      if (Math.abs(raceDeltaS(s, sHint)) > 70) continue;
      if (!best || hit.d2 < best.d2) {
        best = hit;
        bestS = s;
        best.name = seg.name;
      }
    }
    // Nothing near the hint, or the car has clearly been moved (reset,
    // rejoin, grid pin): the hint is stale, so answer without it.
    if (!best || best.d2 > (ASPHALT + RUNOFF + 26) * (ASPHALT + RUNOFF + 26)) return projectTrack(px, pz);
    return trackInfoAt(px, pz, best, bestS);
  }

  function projectTrack(px, pz) {
    var segs = PATH.length ? PATH : MAP_SURF;
    var surf = projectOn(px, pz, segs);
    var best = surf.hit;
    var bestS = surf.s;
    if (!best) {
      return {
        x: px,
        z: pz,
        y: 0,
        pitch: 0,
        dist: 999,
        h: 0,
        s: 0,
        name: "short",
        onAsphalt: false,
        inPit: false,
        kerb: false,
        onRunoff: false,
        grass: true,
      };
    }
    return trackInfoAt(px, pz, best, bestS);
  }

  function trackInfoAt(px, pz, best, bestS) {
    var segs = PATH.length ? PATH : MAP_SURF;
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
    var hitY = 0;
    var hitPitch = 0;
    var si;
    for (si = 0; si < segs.length; si++) {
      var sg = segs[si];
      if (bestS >= (sg.startS || 0) - 0.01 && bestS <= (sg.startS || 0) + (sg.len || 0) + 0.01) {
        var pu = sg.len ? (bestS - (sg.startS || 0)) / sg.len : 0;
        if (pu < 0) pu = 0;
        if (pu > 1) pu = 1;
        var y0 = sg.y0 || 0;
        var y1 = sg.y1 == null ? y0 : sg.y1;
        hitY = y0 + (y1 - y0) * pu;
        hitPitch = sg.len > 0.01 ? (y1 - y0) / sg.len : 0;
        break;
      }
    }
    return {
      x: best.x,
      z: best.z,
      y: hitY,
      pitch: hitPitch,
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
      pos.push(p.x + nx * (inset + halfW), (p.y || 0) + y, p.z + nz * (inset + halfW));
      pos.push(p.x + nx * (inset - halfW), (p.y || 0) + y, p.z + nz * (inset - halfW));
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
    var lastP = null;
    var strip = 0;
    for (var i = 0; i <= segs; i++) {
      var p = centerlinePoint((i / segs) * TRACK_LEN);
      if (onlyNames && onlyNames.indexOf(p.name) === -1) {
        lastP = null;
        strip = 0;
        continue;
      }
      var nx = -Math.sin(p.h);
      var nz = Math.cos(p.h);
      if (sided) {
        pos.push(p.x + nx * (off + half), (p.y || 0) + y, p.z + nz * (off + half));
        pos.push(p.x + nx * (off - half), (p.y || 0) + y, p.z + nz * (off - half));
      } else {
        pos.push(p.x + nx * half, (p.y || 0) + y, p.z + nz * half);
        pos.push(p.x - nx * half, (p.y || 0) + y, p.z - nz * half);
      }
      if (uvs) {
        uvs.push(used * uvStep, 1);
        uvs.push(used * uvStep, 0);
      }
      var jump = lastP && Math.hypot(p.x - lastP.x, p.z - lastP.z) > 22;
      if (used > 0 && strip > 0 && !jump) {
        var a = (used - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        strip += 1;
      } else {
        strip = 1;
      }
      lastP = p;
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

  function segLen(seg) {
    if (!seg) return 0;
    if (seg.type === "line") return Math.hypot(seg.bx - seg.ax, seg.bz - seg.az);
    return Math.abs(seg.a1 - seg.a0) * (seg.r || 0);
  }

  function pitPaintClear(x, z, half) {
    half = half || 0;
    if (!isDriveableLoop() && z - half < SF_Z + ASPHALT + 0.45) return false;
    var segs = PATH.length ? PATH : MAP_SURF;
    if (segs && segs.length) {
      var race = projectOn(x, z, segs);
      if (race && race.hit && Math.sqrt(race.hit.d2) <= ASPHALT + 0.3) return false;
    }
    return true;
  }

  function makeSurfRibbon(segs, half, y, color, onlyNames, uvStep, offset, step, clipRace) {
    if (!segs || !segs.length) return null;
    var pos = [];
    var idx = [];
    var uvs = uvStep ? [] : null;
    var used = 0;
    var off = offset || 0;
    var sided = offset != null && offset !== 0;
    var i;
    for (i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (onlyNames && onlyNames.indexOf(seg.name) === -1) continue;
      var len = segLen(seg);
      var n = Math.max(2, Math.round(len / (step || 2.8)));
      var u;
      var strip = 0;
      for (u = 0; u <= n; u++) {
        var p = pointOnSeg(seg, u / n);
        // Clip the path *center* off the racing line, not the half-width.
        // Using PIT_HALF here opened a hole at the fork; the ribbon
        // should kiss the left edge so the peel is one surface.
        if (clipRace && !pitPaintClear(p.x, p.z, 0)) {
          strip = 0;
          continue;
        }
        var nx = -Math.sin(p.h);
        var nz = Math.cos(p.h);
        if (sided) {
          pos.push(p.x + nx * (off + half), (p.y || 0) + y, p.z + nz * (off + half));
          pos.push(p.x + nx * (off - half), (p.y || 0) + y, p.z + nz * (off - half));
        } else {
          pos.push(p.x + nx * half, (p.y || 0) + y, p.z + nz * half);
          pos.push(p.x - nx * half, (p.y || 0) + y, p.z - nz * half);
        }
        if (uvs) {
          uvs.push(used * uvStep, 1);
          uvs.push(used * uvStep, 0);
        }
        if (strip > 0) {
          var a = (used - 1) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        used += 1;
        strip += 1;
      }
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

  function courseBand(half, y, color, onlyNames, uvStep, offset) {
    // One continuous thin ribbon from the race PATH. Per-piece MAP_SURF
    // strips stacked a second collider on every shared edge.
    return makeRibbon(half, y, color, onlyNames, uvStep, offset);
  }

  function makeRaisedKerbBand(half, baseY, raise, color, onlyNames, uvStep, offset) {
    var segs = RIBBON_SEGS;
    var pos = [];
    var idx = [];
    var uvs = uvStep ? [] : null;
    var used = 0;
    var off = offset || 0;
    var lastP = null;
    var strip = 0;
    for (var i = 0; i <= segs; i++) {
      var p = centerlinePoint((i / segs) * TRACK_LEN);
      if (onlyNames && onlyNames.indexOf(p.name) === -1) {
        lastP = null;
        strip = 0;
        continue;
      }
      var nx = -Math.sin(p.h);
      var nz = Math.cos(p.h);
      pos.push(p.x + nx * (off + half), (p.y || 0) + baseY + raise, p.z + nz * (off + half));
      pos.push(p.x + nx * (off - half), (p.y || 0) + baseY, p.z + nz * (off - half));
      if (uvs) {
        uvs.push(used * uvStep, 1);
        uvs.push(used * uvStep, 0);
      }
      var jump = lastP && Math.hypot(p.x - lastP.x, p.z - lastP.z) > 22;
      if (used > 0 && strip > 0 && !jump) {
        var a = (used - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        strip += 1;
      } else {
        strip = 1;
      }
      lastP = p;
      used += 1;
    }
    if (used < 2) return null;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    if (uvs) geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
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

  function addBoxYaw(x, y, z, w, h, d, color, parent, yaw) {
    var m = addBox(x, y, z, w, h, d, color, parent);
    if (yaw) m.rotation.y = yaw;
    return m;
  }

  function namedPoint(name, u) {
    var i;
    for (i = 0; i < PATH.length; i++) {
      if (PATH[i].name === name) {
        var t = u == null ? 0.5 : u;
        return centerlinePoint(PATH[i].startS + PATH[i].len * t);
      }
    }
    return null;
  }

  function sideOf(p, dist) {
    var nx = -Math.sin(p.h);
    var nz = Math.cos(p.h);
    return { x: p.x + nx * dist, z: p.z + nz * dist, y: p.y || 0, h: p.h };
  }

  function clearDress(g) {
    if (!g) return;
    while (g.children.length) {
      var c = g.children[0];
      clearDress(c);
      g.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
  }

  function stampTreesInstanced(spots, root, leafColor) {
    if (!spots || !spots.length || !root) return;
    var n = spots.length;
    var trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.4, 0.5, 3, 5),
      new THREE.MeshLambertMaterial({ color: 0x6a4020, side: THREE.DoubleSide }),
      n
    );
    var leaves = new THREE.InstancedMesh(
      new THREE.ConeGeometry(2.4, 4.6, 6),
      new THREE.MeshLambertMaterial({ color: leafColor || 0x3f7a30, side: THREE.DoubleSide }),
      n
    );
    var dummy = new THREE.Object3D();
    var i;
    for (i = 0; i < n; i++) {
      var s = spots[i];
      var sc = s.s || 1;
      dummy.position.set(s.x, (s.y || 0) + 1.5 * sc, s.z);
      dummy.scale.setScalar(sc);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y = (s.y || 0) + 4.8 * sc;
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    root.add(trunks);
    root.add(leaves);
  }

  var DRESS_KEEP = ASPHALT + RUNOFF + 4;

  function inPitBox(x, z, pad) {
    pad = pad == null ? 4 : pad;
    var boxes = [PIT_ENTRY, PIT_LANE, PIT_GRAB, PIT_EXIT];
    var i;
    for (i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (!b || b.x1 < b.x0) continue;
      if (x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad) return true;
    }
    return false;
  }

  function dressClear(x, z, radius) {
    radius = radius == null ? 2.4 : radius;
    var pr = projectTrack(x, z);
    if (!pr || pr.dist < DRESS_KEEP + radius) return false;
    if (pr.onAsphalt || pr.onRunoff || pr.inPit) return false;
    if (onPitPavement(x, z) || inPitBox(x, z, radius + 3)) return false;
    return true;
  }

  function dressOffset(p, side, dist, radius) {
    var dir = (side || 1) >= 0 ? 1 : -1;
    var d = Math.max(Math.abs(dist) || DRESS_KEEP + 6, DRESS_KEEP + (radius || 2) + 2);
    var i;
    for (i = 0; i < 10; i++) {
      var o = sideOf(p, dir * d);
      if (dressClear(o.x, o.z, radius)) return o;
      d += 6;
    }
    return null;
  }

  function treesAlong(names, side, dist, step, root, leafColor) {
    var allow = {};
    var i;
    if (names) {
      for (i = 0; i < names.length; i++) allow[names[i]] = 1;
    }
    var spots = [];
    for (i = 0; i < PATH.length; i++) {
      if (names && !allow[PATH[i].name]) continue;
      var s;
      for (s = PATH[i].startS; s < PATH[i].startS + PATH[i].len; s += step || 14) {
        var p = centerlinePoint(s);
        var off = dressOffset(p, side, dist || 24, 2.6);
        if (!off) continue;
        spots.push({ x: off.x, z: off.z, y: p.y || 0, s: 0.8 + ((s * 13) % 7) * 0.05 });
      }
    }
    stampTreesInstanced(spots, root, leafColor);
  }

  function walkNamed(names, step, fn) {
    var allow = null;
    var i;
    if (names) {
      allow = {};
      for (i = 0; i < names.length; i++) allow[names[i]] = 1;
    }
    for (i = 0; i < PATH.length; i++) {
      if (allow && !allow[PATH[i].name]) continue;
      var s;
      for (s = PATH[i].startS; s < PATH[i].startS + PATH[i].len; s += step || 16) {
        fn(centerlinePoint(s), s, PATH[i]);
      }
    }
  }

  function buildingsAlong(names, side, dist, step, root, body, roof, w, h, d) {
    w = w || 12;
    h = h || 8;
    d = d || 9;
    var rad = Math.max(w, d) * 0.5 + 1.4;
    walkNamed(names, step || 22, function (p) {
      var o = dressOffset(p, side, dist || 28, rad);
      if (!o) return;
      addBoxYaw(o.x, (p.y || 0) + h * 0.5, o.z, w, h, d, body, root, p.h);
      addBoxYaw(o.x, (p.y || 0) + h + 0.4, o.z, w + 1, 0.7, d + 1, roof, root, p.h);
    });
  }

  function lanternsAlong(names, side, dist, step, root) {
    walkNamed(names, step || 16, function (p) {
      var o = dressOffset(p, side, dist || 18, 1.2);
      if (!o) return;
      addBox(o.x, (p.y || 0) + 2.4, o.z, 0.22, 4.8, 0.22, 0x2a2018, root);
      addBox(o.x, (p.y || 0) + 4.9, o.z, 0.7, 0.35, 0.7, 0xf0d878, root);
    });
  }

  function floodlightsAlong(names, side, dist, step, root) {
    walkNamed(names, step || 28, function (p) {
      var o = dressOffset(p, side, dist || 24, 1.6);
      if (!o) return;
      addFloodlight(o.x, o.z, root, p.y || 0);
    });
  }

  function addRockTunnel(root) {
    var i;
    for (i = 0; i < PATH.length; i++) {
      if (PATH[i].name !== "tunnel") continue;
      var s;
      for (s = PATH[i].startS; s < PATH[i].startS + PATH[i].len; s += 9) {
        var p = centerlinePoint(s);
        var L = dressOffset(p, 1, 22, 6) || sideOf(p, 24);
        var R = dressOffset(p, -1, 22, 6) || sideOf(p, -24);
        addBoxYaw(L.x, 5.4 + (p.y || 0), L.z, 10, 10.2, 10, 0x5a5048, root, p.h);
        addBoxYaw(R.x, 6.2 + (p.y || 0), R.z, 12, 12.4, 12, 0x4a443c, root, p.h);
      }
      var mid = namedPoint("tunnel", 0.5);
      if (mid) {
        addBoxYaw(mid.x, 11.4 + (mid.y || 0), mid.z, Math.min(40, PATH[i].len * 0.8), 3.2, ASPHALT * 2 + 4, 0x3a3630, root, mid.h);
      }
      function portalFrame(pt) {
        if (!pt) return;
        var L = sideOf(pt, ASPHALT + 1.6);
        var R = sideOf(pt, -(ASPHALT + 1.6));
        addBoxYaw(L.x, 4.2 + (pt.y || 0), L.z, 2.2, 8.2, 3.2, 0x1a1612, root, pt.h);
        addBoxYaw(R.x, 4.2 + (pt.y || 0), R.z, 2.2, 8.2, 3.2, 0x1a1612, root, pt.h);
        addBoxYaw(pt.x, 8.4 + (pt.y || 0), pt.z, ASPHALT * 2 + 2.4, 1.6, 3.2, 0x1a1612, root, pt.h);
      }
      portalFrame(namedPoint("tunnel", 0.05));
      portalFrame(namedPoint("tunnel", 0.95));
    }
  }

  function addBankingArc(cx, cz, r, steps, root) {
    var k;
    for (k = 0; k < steps; k++) {
      var u = k / Math.max(1, steps - 1);
      var ang = -0.15 + u * 2.35;
      var x = cx + Math.cos(ang) * r;
      var z = cz + Math.sin(ang) * r;
      if (!dressClear(x, z, 8)) continue;
      addBox(x, 3.2 + Math.sin(u * Math.PI) * 4.2, z, 14, 3.8, 7.2, 0x8a5040, root);
    }
  }

  function addBuilding(x, y, z, w, h, d, body, roof, parent, yaw) {
    addBoxYaw(x, y, z, w, h, d, body, parent, yaw);
    addBoxYaw(x, y + h * 0.5 + 0.45, z, w + 1.1, 0.85, d + 1.1, roof, parent, yaw);
    var rows = Math.max(1, Math.floor(h / 3.2));
    var cols = Math.max(2, Math.floor(w / 4.2));
    var r;
    var c;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        var wx = x - w * 0.35 + (c / Math.max(1, cols - 1)) * w * 0.7;
        var wy = y - h * 0.28 + r * 2.4;
        addBoxYaw(wx, wy, z + d * 0.52, 1.1, 1.15, 0.08, 0xf4efe6, parent, yaw);
      }
    }
    return true;
  }

  function addGrandstand(x, y, z, w, d, yaw, parent, seat, roof) {
    addBoxYaw(x, y + 1.1, z, w, 2.2, d, seat || 0x2a3038, parent, yaw);
    addBoxYaw(x, y + 2.6, z - Math.cos(yaw || 0) * 0.6, w * 0.98, 1.4, d * 0.7, 0x3a2420, parent, yaw);
    addBoxYaw(x, y + 4.2, z, w + 1.2, 0.35, d + 1.4, roof || 0xd8b48a, parent, yaw);
  }

  function addYacht(x, z, yaw, parent, scale) {
    scale = scale || 1;
    addBoxYaw(x, 0.7 * scale, z, 9 * scale, 1.1 * scale, 2.5 * scale, 0xf4efe6, parent, yaw);
    addBoxYaw(x + Math.cos(yaw || 0) * 1.2, 1.5 * scale, z, 4.2 * scale, 0.9 * scale, 2.1 * scale, 0xe8d8c4, parent, yaw);
    var mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08 * scale, 0.1 * scale, 6 * scale, 5),
      new THREE.MeshLambertMaterial({ color: 0x2a2018 })
    );
    mast.position.set(x, 4.2 * scale, z);
    parent.add(mast);
  }

  function addFloodlight(x, z, parent, y0) {
    y0 = y0 || 0;
    addBox(x, y0 + 6.2, z, 0.35, 12.4, 0.35, 0x2a2a2e, parent);
    var disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 0.18, 8),
      new THREE.MeshLambertMaterial({ color: 0xfff2c8, emissive: 0xaa8844 })
    );
    disc.position.set(x, y0 + 12.6, z);
    parent.add(disc);
  }

  function applyTrackPalette() {
    var id = isDriveableLoop() ? "campus" : builtinId() || "campus";
    var pal = {
      campus: { clear: 0xe87834, fog: 0xf08a48, skirt: 0x3f5c32, dirt: 0x6a655c },
      harbor: { clear: 0xee8a4a, fog: 0xe07060, skirt: 0x1f6a6e, dirt: 0x2f7a80 },
      park: { clear: 0x7aa8c8, fog: 0x90b8a8, skirt: 0x245828, dirt: 0x3d6a38 },
      desert: { clear: 0xc24a20, fog: 0x6a2840, skirt: 0xc8a46a, dirt: 0x9a7848 },
      forest: { clear: 0x6a7a6e, fog: 0x5a6a5c, skirt: 0x1e3a22, dirt: 0x2a4028 },
    }[id] || { clear: 0xe87834, fog: 0xf08a48, skirt: 0x3f5c32, dirt: 0x6a655c };
    renderer.setClearColor(pal.clear, 1);
    if (scene.fog) scene.fog.color.setHex(pal.fog);
    if (groundSkirt && groundSkirt.material) groundSkirt.material.color.setHex(pal.skirt);
    if (groundDirt && groundDirt.material) groundDirt.material.color.setHex(pal.dirt);
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

  function stampPitBand(half, y, hgt, mat, endS) {
    var step = 1.15;
    var s;
    for (s = 0; s < endS; s += step) {
      var a = pointOnPitPath(s);
      var b = pointOnPitPath(Math.min(s + step + 0.55, endS));
      if (!a || !b) continue;
      // Box stamps on the S-bends poke corners into the racing line.
      // The ribbon covers in/out; stamps are the parallel only.
      if (a.name === "pitin" || a.name === "pitout" || b.name === "pitin" || b.name === "pitout") continue;
      if (!pitPaintClear(a.x, a.z, half) || !pitPaintClear(b.x, b.z, half)) continue;
      var dx = b.x - a.x;
      var dz = b.z - a.z;
      var len = Math.hypot(dx, dz);
      if (len < 0.25) continue;
      var mx = (a.x + b.x) * 0.5;
      var mz = (a.z + b.z) * 0.5;
      var yaw = -Math.atan2(dz, dx);
      var fx = Math.cos(-yaw);
      var fz = Math.sin(-yaw);
      var lx = -fz;
      var lz = fx;
      var hl = (len + 0.7) * 0.5;
      var corners = [
        [mx + fx * hl + lx * half, mz + fz * hl + lz * half],
        [mx + fx * hl - lx * half, mz + fz * hl - lz * half],
        [mx - fx * hl + lx * half, mz - fz * hl + lz * half],
        [mx - fx * hl - lx * half, mz - fz * hl - lz * half],
      ];
      var ci;
      var blocked = false;
      for (ci = 0; ci < 4; ci++) {
        if (!pitPaintClear(corners[ci][0], corners[ci][1], 0)) blocked = true;
      }
      if (blocked) continue;
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(len + 0.7, hgt, half * 2), mat);
      mesh.position.set(mx, y, mz);
      mesh.rotation.y = yaw;
      trackRoot.add(mesh);
    }
  }

  function fillPitGore() {
    // Pave the whole Y: from the racing ribbon's left edge out to the
    // pit's outer edge. Raised boxes so the fill reads on the dark
    // infield. They kiss the left edge and do not sit on the racing
    // line. Grass median owns the parallel stretch.
    if (isDriveableLoop() || !PIT_PATH.length || !trackRoot) return;
    var trackEdge = SF_Z + ASPHALT;
    var last = PIT_PATH[PIT_PATH.length - 1];
    var endS = (last.startS || 0) + (last.len || 0);
    var asphaltMat = new THREE.MeshLambertMaterial({
      color: 0x3a3e46,
      emissive: 0x101214,
      side: THREE.DoubleSide,
    });
    var s;
    for (s = 0; s < endS; s += 0.85) {
      var p = pointOnPitPath(s);
      if (!p || (p.name !== "pitin" && p.name !== "pitout")) continue;
      if (p.x > 37 && p.x < 111) continue;
      var outerZ = p.z + Math.abs(Math.cos(p.h)) * PIT_HALF;
      if (outerZ <= trackEdge + 0.35) continue;
      var depth = outerZ - trackEdge;
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, depth), asphaltMat);
      mesh.position.set(p.x, 0.1, trackEdge + depth * 0.5);
      trackRoot.add(mesh);
    }
  }

  function paintPitRibbon() {
    if (!PIT_PATH.length || !trackRoot) return;
    // Same asphalt + runoff as the race ribbon, stamped along the
    // S-curve so the fill stays visible (a flat ribbon vanished on
    // the dark infield — only the white edges read).
    var last = PIT_PATH[PIT_PATH.length - 1];
    var endS = (last.startS || 0) + (last.len || 0);
    var runoffMat = new THREE.MeshLambertMaterial({
      color: 0x8d97a6,
      emissive: 0x2a3038,
      side: THREE.DoubleSide,
    });
    var asphaltMat = new THREE.MeshLambertMaterial({
      color: 0x3a3e46,
      emissive: 0x101214,
      side: THREE.DoubleSide,
    });
    stampPitBand(PIT_HALF + 1.55, 0.05, 0.06, runoffMat, endS);
    stampPitBand(PIT_HALF, 0.09, 0.08, asphaltMat, endS);
    fillPitGore();
    var asphalt = makeSurfRibbon(PIT_PATH, PIT_HALF, 0.068, asphaltMat, null, null, 0, null, true);
    if (asphalt) trackRoot.add(asphalt);
    // Lane markings start once it is its own road. An inner white edge
    // on the S-bend drew a second line in the crotch and made the Y
    // read as two roads with a hole.
    var line = makeSurfRibbon(PIT_PATH, 0.28, 0.09, 0xd8d2c6, ["pitlane"], null, 0, null, true);
    if (line) trackRoot.add(line);
    var eL = makeSurfRibbon(PIT_PATH, 0.22, 0.082, 0xf4efe6, null, null, PIT_HALF - 0.38, null, true);
    var eR = makeSurfRibbon(PIT_PATH, 0.22, 0.082, 0xf4efe6, ["pitlane"], null, -(PIT_HALF - 0.38), null, true);
    if (eL) trackRoot.add(eL);
    if (eR) trackRoot.add(eR);
  }

  function paintPitStalls() {
    if (!PIT_PATH.length || !trackRoot || !PIT_META.on) return;
    var gx = (PIT_GRAB.x0 + PIT_GRAB.x1) * 0.5;
    var gz = (PIT_GRAB.z0 + PIT_GRAB.z1) * 0.5;
    var pr = projectOn(gx, gz, PIT_PATH);
    if (!pr) return;
    var i;
    for (i = -2; i <= 2; i++) {
      var p = pointOnPitPath(pr.s + i * 3.6);
      if (!p) continue;
      addBoxYaw(p.x, 0.09, p.z, 0.85, 0.02, PIT_HALF * 1.55, 0xffffff, trackRoot, -p.h);
    }
  }

  function paintCampusPitLane() {
    // FORK. TWO ROADS. The racing ribbon stays whole. Asphalt gore
    // fills the Y so the peel is a clean transition. Grass median
    // (the existing ground) sits between ribbon and pit lane.
    // Cover the start-straight LEFT runoff so the pit reads as a dark
    // lane peeling over grass, not white edges on a grey apron.
    // The second road is the same asphalt as the race ribbon, just
    // smaller — it peels LEFT, runs the box, peels back. Not a slab.
    // A hole in the ribbon is a nack. A slide / one-road pit is a nack.
    addBox(74, 0.04, -66.6, 72, 0.024, 8.2, 0x3f5c32, trackRoot);
    addBox(62, 0.92, -51.2, 70, 1.7, 0.7, 0x2a2018, trackRoot);
    addBox(62, 1.82, -51.2, 70, 0.14, 0.78, TEAL, trackRoot);
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
    var sandNames = [];
    var sn;
    for (sn = 0; sn < KERB_NAMES.length; sn++) {
      var kind = cornerKind(KERB_NAMES[sn]);
      if (kind === "hairpin" || kind === "chicane") sandNames.push(KERB_NAMES[sn]);
    }
    var sandH = courseBand(ASPHALT + RUNOFF + 1.45, 0.018, 0xe0c888, sandNames);
    if (sandH) trackRoot.add(sandH);
    // Painted runoff = lighter/cooler grey. Asphalt = darker. Must read apart.
    var runoffMat = new THREE.MeshLambertMaterial({
      color: 0x8d97a6,
      emissive: 0x2a3038,
      side: THREE.DoubleSide,
    });
    var runoff = courseBand(ASPHALT + RUNOFF, 0.03, runoffMat, null);
    if (runoff) trackRoot.add(runoff);

    var asphaltMat = new THREE.MeshLambertMaterial({
      color: 0x3a3e46,
      emissive: 0x101214,
      side: THREE.DoubleSide,
    });
    var asphalt = courseBand(ASPHALT, 0.055, asphaltMat, null);
    var line = courseBand(0.42, 0.08, 0xd8d2c6, null);
    if (asphalt) trackRoot.add(asphalt);
    if (line) trackRoot.add(line);
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
      var kL = makeRaisedKerbBand(0.9, KERB_SURFACE_Y, KERB_RAISE, kerbMat, names, 0.42, +(ASPHALT + 0.55));
      var kR = makeRaisedKerbBand(0.9, KERB_SURFACE_Y, KERB_RAISE, kerbMat, names, 0.42, -(ASPHALT + 0.55));
      if (kL) trackRoot.add(kL);
      if (kR) trackRoot.add(kR);
    }

    if (PIT_PATH.length) {
      paintPitRibbon();
    } else {
      var p;
      for (p = 0; p < PIT_PAVE.length; p++) {
        trackRoot.add(paveRect(PIT_PAVE[p], 0.09, 0x3a3e46));
      }
    }
    if (!isDriveableLoop()) {
      paintCampusPitLane();
    } else if (PIT_META.on) {
      paintPitStalls();
    }

    var start = centerlinePoint(0);
    var customMap = isDriveableLoop();
    var stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, customMap ? 0.02 : 0.14, ASPHALT * 2),
      new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    stripe.position.set(customMap ? start.x : 0, customMap ? 0.065 : 0.1, customMap ? start.z : SF_Z);
    stripe.rotation.y = customMap ? -start.h : 0;
    trackRoot.add(stripe);

    if (!customMap) {
      var gxs = [-6, -6, -14, -14, -22, -22, -30, -30];
      var gzs = [
        SF_Z + GRID_OUT_A,
        SF_Z + GRID_OUT_B,
        SF_Z + GRID_OUT_A,
        SF_Z + GRID_OUT_B,
        SF_Z + GRID_OUT_A,
        SF_Z + GRID_OUT_B,
        SF_Z + GRID_OUT_A,
        SF_Z + GRID_OUT_B,
      ];
      for (var gb = 0; gb < 8; gb++) {
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
    } else {
      var nx = -Math.sin(start.h);
      var nz = Math.cos(start.h);
      var gx = start.x - nx * (ASPHALT + 1.2);
      var gz = start.z - nz * (ASPHALT + 1.2);
      var fx = Math.cos(start.h);
      var fz = Math.sin(start.h);
      var beam = addBox(gx, 6.4, gz, 12, 0.35, 0.35, 0x2a2018, trackRoot);
      beam.rotation.y = -start.h;
      function gantryLight(along, wy, wz, color) {
        var m = addBox(gx + fx * along, wy, gz + fz * along, wz, 0.7, 0.4, color, trackRoot);
        m.rotation.y = -start.h;
        return m;
      }
      gantryBlues.push(gantryLight(-4.4, 6.55, 1.1, 0x1a3040));
      gantryBlues.push(gantryLight(4.4, 6.55, 1.1, 0x1a3040));
      for (var li = 0; li < 5; li++) {
        gantryReds.push(gantryLight(-2.4 + li * 1.2, 6.55, 0.7, 0x3a1010));
      }
    }

    function cornerFlag(x, z, title, y0) {
      y0 = y0 || 0;
      addBox(x, y0 + 1.4, z, 0.2, 2.8, 0.2, 0x2a2018, trackRoot);
      var pl = labelPlane(title, 7.4, 2.2, "#f4efe6", "#148f8c");
      pl.position.set(x, y0 + 3.2, z);
      trackRoot.add(pl);
    }
    function flagOn(name, title, side) {
      var s = -1;
      var i;
      for (i = 0; i < PATH.length; i++) {
        if (PATH[i].name === name) {
          s = PATH[i].startS + PATH[i].len * 0.55;
          break;
        }
      }
      if (s < 0) return;
      var fp = centerlinePoint(s);
      var nx = -Math.sin(fp.h);
      var nz = Math.cos(fp.h);
      var flagOff = ASPHALT + RUNOFF + 2.3;
      cornerFlag(fp.x + nx * flagOff * side, fp.z + nz * flagOff * side, title, fp.y || 0);
    }
    var fn;
    for (fn = 0; fn < KERB_NAMES.length; fn++) {
      flagOn(KERB_NAMES[fn], FLAG_TITLE[KERB_NAMES[fn]] || KERB_NAMES[fn].toUpperCase(), fn % 2 ? 1 : -1);
    }

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
    syncCampusDressing();
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
    // Campus: only the IN / OUT mouths. Opening the whole south
    // straight made the road slide right — that was not a left lane.
    if (!isDriveableLoop()) {
      return inRect(wx, wz, PIT_ENTRY) || inRect(wx, wz, PIT_EXIT) || onPitPath(wx, wz);
    }
    if (onPitPavement(wx, wz) || inRect(wx, wz, PIT_LANE) || inRect(wx, wz, PIT_GRAB)) return true;
    var ix = p.x + nx * (ASPHALT + 1.6);
    var iz = p.z + nz * (ASPHALT + 1.6);
    return onPitPavement(ix, iz);
  }

  function wallKindFor(p, side) {
    var wk = cornerKind(p.name);
    if (wk !== "hairpin" && wk !== "chicane" && wk !== "sweeper") return "low";
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

  function wallCutsRibbon(w) {
    var n = 4;
    var i;
    for (i = 0; i <= n; i++) {
      var t = i / n;
      var mx = w.ax + (w.bx - w.ax) * t;
      var mz = w.az + (w.bz - w.az) * t;
      if (projectTrack(mx, mz).dist < ASPHALT + 3.0) return true;
    }
    return false;
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
        var jumpL = lastL && Math.hypot(lx - lastL.x, lz - lastL.z) > STEP * 2.4;
        var kinkL = lastL && Math.abs(Math.atan2(Math.sin(p.h - lastL.h), Math.cos(p.h - lastL.h))) > 0.55;
        if (lastL && !jumpL && !kinkL) wallSeg(lastL.x, lastL.z, lx, lz, 0.5, lastL.kind, false);
        lastL = { x: lx, z: lz, kind: kL, h: p.h };
      } else {
        lastL = null;
      }
      var jump = lastR && Math.hypot(rx - lastR.x, rz - lastR.z) > STEP * 2.4;
      var kinkR = lastR && Math.abs(Math.atan2(Math.sin(p.h - lastR.h), Math.cos(p.h - lastR.h))) > 0.55;
      if (lastR && !jump && !kinkR) wallSeg(lastR.x, lastR.z, rx, rz, 0.5, lastR.kind, false);
      lastR = { x: rx, z: rz, kind: kR, h: p.h };
    }
    var keep = [];
    var wi;
    for (wi = 0; wi < WALLS.length; wi++) {
      var w = WALLS[wi];
      if (Math.hypot(w.bx - w.ax, w.bz - w.az) > STEP * 2.4) continue;
      if (wallCutsRibbon(w)) continue;
      keep.push(w);
    }
    WALLS.length = 0;
    keep = mergeColinearWalls(keep);
    for (wi = 0; wi < keep.length; wi++) WALLS.push(keep[wi]);
  }

  function joinColinearWall(a, b) {
    if ((a.kind || "low") !== (b.kind || "low")) return null;
    var adx = a.bx - a.ax;
    var adz = a.bz - a.az;
    var bdx = b.bx - b.ax;
    var bdz = b.bz - b.az;
    var al = Math.hypot(adx, adz) || 1;
    var bl = Math.hypot(bdx, bdz) || 1;
    var dot = (adx * bdx + adz * bdz) / (al * bl);
    if (Math.abs(dot) < 0.9995) return null;
    var ends = [
      [a.ax, a.az],
      [a.bx, a.bz],
      [b.ax, b.az],
      [b.bx, b.bz],
    ];
    function close(i, j) {
      return Math.hypot(ends[i][0] - ends[j][0], ends[i][1] - ends[j][1]) < 0.22;
    }
    if (!(close(0, 2) || close(0, 3) || close(1, 2) || close(1, 3))) return null;
    var bi = 0;
    var bj = 1;
    var best = -1;
    var i;
    var j;
    for (i = 0; i < 4; i++) {
      for (j = i + 1; j < 4; j++) {
        var d = Math.hypot(ends[i][0] - ends[j][0], ends[i][1] - ends[j][1]);
        if (d > best) {
          best = d;
          bi = i;
          bj = j;
        }
      }
    }
    return {
      ax: ends[bi][0],
      az: ends[bi][1],
      bx: ends[bj][0],
      bz: ends[bj][1],
      thick: Math.max(a.thick || 0.55, b.thick || 0.55),
      kind: a.kind || "low",
      silent: !!(a.silent && b.silent),
    };
  }

  function mergeColinearWalls(list) {
    var out = list.slice();
    var changed = true;
    var guard = 0;
    while (changed && guard < 120) {
      changed = false;
      guard += 1;
      var a;
      var b;
      for (a = 0; a < out.length; a++) {
        for (b = a + 1; b < out.length; b++) {
          var joined = joinColinearWall(out[a], out[b]);
          if (!joined || wallCutsRibbon(joined)) continue;
          out[a] = joined;
          out.splice(b, 1);
          changed = true;
          break;
        }
        if (changed) break;
      }
    }
    return out;
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
      var wy = (projectTrack(mx, mz).y || 0);
      var tall = w.kind === "tall";
      var ch = tall ? 1.28 : 0.9;
      var cd = tall ? 0.64 : 0.58;
      stamp(concrete, i, mx, wy + ch * 0.5, mz, len, ch, cd, rotY);
      var r0 = ch + 0.16;
      var r1 = ch + (tall ? 0.5 : 0.38);
      stamp(railLo, i, mx, wy + r0, mz, len * 0.98, 0.08, 0.08, rotY);
      stamp(railHi, i, mx, wy + r1, mz, len * 0.98, 0.08, 0.08, rotY);
      stamp(posts, i, w.ax, wy + (r1 + 0.06) * 0.5, w.az, 0.1, r1 + 0.06, 0.1, rotY);
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

    var mapSpanX = MAP_W * MAP_CELL;
    var mapSpanZ = MAP_H * MAP_CELL;
    var dirtW = Math.max(1800, mapSpanX + 1000);
    var dirtD = Math.max(1400, mapSpanZ + 1000);
    var dirtX = MAP_OX + mapSpanX * 0.5;
    var dirtZ = MAP_OZ + mapSpanZ * 0.5;
    var skirt = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(4200, dirtW + 1800), Math.max(3600, dirtD + 1600)),
      new THREE.MeshBasicMaterial({ color: 0x3f5c32, side: THREE.DoubleSide })
    );
    skirt.name = "groundSkirt";
    skirt.rotation.x = -Math.PI * 0.5;
    skirt.position.set(dirtX, -0.12, dirtZ);
    scene.add(skirt);
    groundSkirt = skirt;

    var dirt = new THREE.Mesh(
      new THREE.PlaneGeometry(dirtW, dirtD),
      new THREE.MeshLambertMaterial({ color: 0x6a655c, side: THREE.DoubleSide })
    );
    dirt.rotation.x = -Math.PI * 0.5;
    dirt.position.set(dirtX, -0.06, dirtZ);
    scene.add(dirt);
    groundDirt = dirt;

    campusRoot = new THREE.Group();
    campusRoot.name = "campusDressing";
    scene.add(campusRoot);
    harborRoot = new THREE.Group();
    harborRoot.name = "harborDressing";
    scene.add(harborRoot);
    parkRoot = new THREE.Group();
    parkRoot.name = "parkDressing";
    scene.add(parkRoot);
    desertRoot = new THREE.Group();
    desertRoot.name = "desertDressing";
    scene.add(desertRoot);
    forestRoot = new THREE.Group();
    forestRoot.name = "forestDressing";
    scene.add(forestRoot);

    addTrackMesh();

    addSkyBits();
    rebuildTrackDressing();
    syncCampusDressing();
  }

  function dressCampus() {
    var root = campusRoot;
    addBuilding(8, 4.2, SF_Z - 34, 38, 8.4, 9, 0x8a4030, 0xd8b48a, root, 0);
    addBuilding(-22, 5.2, -16, 18, 10.4, 14, 0xb4532e, 0x8a3a22, root, 0);
    addBuilding(28, 4.8, -18, 16, 9.6, 16, 0xa34628, 0x7a301c, root, 0);
    addBuilding(-40, 3.8, -12, 20, 7.6, 12, 0xc4683a, 0x8a4030, root, 0);
    addBuilding(52, 4.4, -16, 18, 8.2, 12, 0xa34628, 0xd8b48a, root, 0);
    addBuilding(-8, 4.6, 18, 22, 8.8, 14, 0xb4532e, 0x8a3a22, root, 0);
    addBuilding(90, 4.0, -14, 20, 7.8, 12, 0xc4683a, 0x8a4030, root, 0);
    addBuilding(-70, 3.8, -10, 18, 7.4, 12, 0xa34628, 0xd8b48a, root, 0);
    buildingsAlong(["start"], 1, 44, 36, root, 0xb4532e, 0x8a3a22, 16, 8.2, 12);
    buildingsAlong(["north", "west"], 1, 30, 32, root, 0xa34628, 0x7a301c, 18, 7.6, 12);
    addGrandstand(20, 0, SF_Z - 28, 48, 8, 0, root, 0x3a3030, 0xd8b48a);
    addGrandstand(86, 0, SF_Z - 28, 28, 7, 0, root, 0x3a3030, 0xd8b48a);
    var lot;
    for (lot = 0; lot < 12; lot++) {
      var lx = 176 + (lot % 4) * 6.4;
      var lz = -36 - Math.floor(lot / 4) * 8;
      if (!dressClear(lx, lz, 3)) continue;
      addBox(lx, 0.22, lz, 4.6, 0.12, 2.6, 0x2a2a2e, root);
      addBox(lx, 0.7, lz, 3.4, 0.85, 1.6, [0x2ec8c3, 0xd8b48a, 0xc4683a, 0x3a5470][lot % 4], root);
    }
    var hp = namedPoint("hairpin", 0.5);
    if (hp) {
      var gym = dressOffset(hp, 1, 36, 14);
      if (gym) addBuilding(gym.x, 5.2, gym.z, 28, 10.4, 18, 0x8a4030, 0xd8b48a, root, hp.h);
      var field = dressOffset(hp, -1, 32, 12);
      if (field) addBuilding(field.x, 3.4, field.z, 22, 6.8, 14, 0xa34628, 0x7a301c, root, hp.h);
    }
    var north = namedPoint("north", 0.4);
    if (north) {
      var hall = dressOffset(north, 1, 34, 12);
      if (hall) addBuilding(hall.x, 4.2, hall.z, 24, 8.4, 14, 0xb4532e, 0x8a3a22, root, north.h);
    }
    var towerX = 8;
    var towerZ = -28;
    addBox(towerX, 11, towerZ, 7.2, 22, 7.2, 0x9a3f2a, root);
    addBox(towerX, 22.6, towerZ, 8.4, 1.4, 8.4, 0xd8b48a, root);
    addBox(towerX, 25.2, towerZ, 3.2, 4.2, 3.2, 0x8a3a22, root);
    addBox(towerX, 28.2, towerZ, 0.5, 2.4, 0.5, 0x2a2018, root);
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
    var f;
    for (f = 0; f < 2; f++) {
      var face = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 3.4),
        new THREE.MeshBasicMaterial({ map: clockTex, side: THREE.DoubleSide })
      );
      face.position.set(towerX + (f ? 3.65 : -3.65), 18.4, towerZ);
      face.rotation.y = f ? Math.PI * 0.5 : -Math.PI * 0.5;
      root.add(face);
    }
    var grassMat = new THREE.MeshBasicMaterial({ color: 0x7aee58, side: THREE.DoubleSide });
    function lawn(x, z, w, d) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.48, d), grassMat);
      mesh.position.set(x, 0.44, z);
      root.add(mesh);
    }
    function tryLawn(x, z, w, d) {
      if (!dressClear(x, z, Math.max(w, d) * 0.45)) return;
      lawn(x, z, w, d);
    }
    tryLawn(12, -20, 20, 16);
    tryLawn(-24, -14, 14, 12);
    tryLawn(58, -18, 24, 12);
    tryLawn(-10, 24, 22, 16);
    tryLawn(40, 16, 18, 12);
    tryLawn(-56, -12, 20, 14);
    tryLawn(188, -28, 20, 12);
    treesAlong(["north", "start", "west", "sweeper"], 1, 28, 14, root, 0x3f7a30);
    treesAlong(["north", "start", "west"], -1, 28, 15, root, 0x4a8a38);
  }

  function dressHarbor() {
    var root = harborRoot;
    var waterMat = new THREE.MeshLambertMaterial({ color: 0x2a8a8c, emissive: 0x0a3034, side: THREE.DoubleSide });
    var sf = namedPoint("start", 0.35) || { x: 40, z: SF_Z, h: 0, y: 0 };
    var port = dressOffset(sf, -1, 70, 8) || sideOf(sf, -72);
    var water = new THREE.Mesh(new THREE.PlaneGeometry(420, 70), waterMat);
    water.rotation.x = -Math.PI * 0.5;
    water.position.set(port.x, 0.02, port.z);
    root.add(water);
    var tabac = namedPoint("tabac", 0.5);
    var poolPt = namedPoint("pool", 0.45);
    if (tabac || poolPt) {
      var harbor2 = tabac || poolPt;
      var basinW = dressOffset(harbor2, -1, 48, 8) || sideOf(harbor2, -50);
      var water2 = new THREE.Mesh(new THREE.PlaneGeometry(140, 56), waterMat);
      water2.rotation.x = -Math.PI * 0.5;
      water2.position.set(basinW.x, 0.02, basinW.z);
      root.add(water2);
    }
    var quay = dressOffset(sf, -1, 22, 4);
    if (quay) addBoxYaw(quay.x, 0.7, quay.z, 220, 1.2, 5, 0xc8b8a0, root, sf.h);
    var yi;
    for (yi = 0; yi < 14; yi++) {
      var yp = namedPoint("start", 0.06 + yi * 0.062);
      if (!yp) continue;
      var yo = dressOffset(yp, -1, 32 + (yi % 3) * 7, 5);
      if (!yo) continue;
      addYacht(yo.x, yo.z, yp.h + (yi % 2 ? 0.25 : -0.18), root, 0.82 + (yi % 3) * 0.14);
    }
    buildingsAlong(["start"], 1, 44, 18, root, 0xe8c8a8, 0xc47858, 14, 10, 10);
    buildingsAlong(["start"], 1, 62, 22, root, 0xf0d2b4, 0xd8a078, 12, 14, 9);
    buildingsAlong(["climb", "square", "devote"], 1, 26, 16, root, 0xe8c8a8, 0xc47858, 12, 9, 9);
    buildingsAlong(["climb", "square"], -1, 26, 18, root, 0xf0d2b4, 0xb87850, 11, 8, 8);
    buildingsAlong(["portier", "tabac", "rascasse"], 1, 26, 16, root, 0xe8ddd0, 0xc4b49a, 11, 8, 8);
    lanternsAlong(["start"], -1, 20, 14, root);
    lanternsAlong(["start"], 1, 40, 18, root);
    var cas = namedPoint("casino", 0.45);
    if (cas) {
      var hill = dressOffset(cas, 1, 38, 14);
      if (hill) {
        addBuilding(hill.x, 14, hill.z, 24, 16, 18, 0xe8d2a0, 0xc9a24a, root, cas.h);
        addBoxYaw(hill.x, 24.5, hill.z, 12, 5, 12, 0xf0d878, root, cas.h);
        var dome = new THREE.Mesh(
          new THREE.SphereGeometry(5.4, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
          new THREE.MeshLambertMaterial({ color: 0xf0d878 })
        );
        dome.position.set(hill.x, 28, hill.z);
        root.add(dome);
      }
      var t;
      for (t = 0; t < 4; t++) {
        var step = dressOffset(cas, 1, 30 + t * 3, 5);
        if (step) addBoxYaw(step.x, 1.1 + t * 0.85, step.z, 14 - t, 0.55, 6, 0xd8c4a0, root, cas.h);
      }
    }
    var u;
    for (u = 0; u <= 10; u++) {
      var hp = namedPoint("hairpin", u / 10);
      if (!hp) continue;
      var wrap = dressOffset(hp, -1, 26, 8);
      if (!wrap) continue;
      addBuilding(wrap.x, 6.8 + (u % 3) * 0.6, wrap.z, 13, 9.4 + (u % 2) * 1.4, 8, 0xe8ddd0, 0xc4b49a, root, hp.h);
    }
    addRockTunnel(root);
    var pool = namedPoint("pool", 0.45);
    if (pool) {
      var basin = dressOffset(pool, 1, 26, 8);
      if (basin) {
        addBoxYaw(basin.x, 0.16, basin.z, 16, 0.22, 8, 0x3ec8d8, root, pool.h);
        addBoxYaw(basin.x + Math.cos(pool.h) * 12, 0.16, basin.z + Math.sin(pool.h) * 12, 12, 0.22, 7, 0x2ab0c4, root, pool.h);
      }
      var club = dressOffset(pool, 1, 36, 8);
      if (club) {
        addBoxYaw(club.x, 3.4, club.z, 12, 4.6, 9, 0xe8ddd0, root, pool.h);
        addBoxYaw(club.x, 4.6, club.z, 0.4, 6.2, 1.8, 0xf4efe6, root, pool.h);
      }
    }
    var ras = namedPoint("rascasse", 0.5);
    if (ras) {
      var rasB = dressOffset(ras, 1, 28, 9);
      if (rasB) addBuilding(rasB.x, 5.4, rasB.z, 16, 9.2, 12, 0xe0c4a8, 0xb87850, root, ras.h);
    }
  }

  function dressPark() {
    var root = parkRoot;
    treesAlong(["start", "biassono", "serraglio", "parabola"], 1, 26, 10, root, 0x2f6a30);
    treesAlong(["start", "biassono", "serraglio", "parabola"], -1, 26, 11, root, 0x3a7a34);
    treesAlong(["lesmo", "rettifilo", "roggia"], 1, 24, 9, root, 0x2a5a28);
    treesAlong(["lesmo", "rettifilo", "roggia"], -1, 24, 9, root, 0x2a5a28);
    var sf = namedPoint("start", 0.25) || { x: 0, z: SF_Z, h: 0, y: 0 };
    var stand = dressOffset(sf, -1, 28, 8);
    if (stand) addGrandstand(stand.x, 0, stand.z, 96, 10, sf.h, root, 0x2a3038, 0xc4a070);
    var tower = dressOffset(sf, 1, 46, 5);
    if (tower) {
      addBoxYaw(tower.x, 13, tower.z, 4.4, 26, 4.4, 0xd8d2c6, root, sf.h);
      addBoxYaw(tower.x, 26.4, tower.z, 7.2, 1.1, 7.2, 0x8a3a22, root, sf.h);
      addBoxYaw(tower.x, 8, tower.z, 6.2, 2.2, 6.2, 0xc4b49a, root, sf.h);
    }
    var para = namedPoint("parabola", 0.55);
    if (para) {
      var pStand = dressOffset(para, -1, 28, 7);
      if (pStand) addGrandstand(pStand.x, 0, pStand.z, 52, 9, para.h, root, 0x2a3038, 0xc4a070);
    }
    var les = namedPoint("lesmo", 0.35);
    var ser = namedPoint("serraglio", 0.35);
    if (les && ser) addBankingArc((les.x + ser.x) * 0.5 - 20, (les.z + ser.z) * 0.5 + 8, 62, 14, root);
    else if (les) addBankingArc(les.x - 40, les.z - 20, 56, 12, root);
    var first = namedPoint("rettifilo", 0.35) || namedPoint("roggia", 0.3);
    if (first) {
      var villa = dressOffset(first, 1, 56, 16);
      if (villa) {
        addBuilding(villa.x, 6.2, villa.z, 30, 10.4, 20, 0xe8ddd0, 0xc4b090, root, first.h);
        var wing = dressOffset(first, 1, 78, 10);
        if (wing) addBuilding(wing.x, 5, wing.z, 16, 8, 12, 0xd8c8b0, 0xb0a080, root, first.h);
      }
      var gravel = dressOffset(first, -1, 22, 6);
      if (gravel) addBoxYaw(gravel.x, 0.18, gravel.z, 18, 0.22, 8, 0xc4b080, root, first.h);
    }
    var second = namedPoint("roggia", 0.4);
    if (second) {
      var g2 = dressOffset(second, -1, 22, 6);
      if (g2) addBoxYaw(g2.x, 0.18, g2.z, 16, 0.22, 8, 0xc4b080, root, second.h);
    }
    var lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 48),
      new THREE.MeshLambertMaterial({ color: 0x4a9a40, side: THREE.DoubleSide })
    );
    lawn.rotation.x = -Math.PI * 0.5;
    if (first) {
      var lawnAt = dressOffset(first, 1, 40, 12);
      if (lawnAt) lawn.position.set(lawnAt.x, 0.08, lawnAt.z);
      else lawn.position.set(40, 0.08, 20);
    }
    else lawn.position.set(40, 0.08, 20);
    root.add(lawn);
  }

  function dressDesert() {
    var root = desertRoot;
    var sf = namedPoint("start", 0.3) || { x: 20, z: SF_Z, h: 0, y: 0 };
    var tower = dressOffset(sf, 1, 48, 10) || sideOf(sf, 50);
    addBoxYaw(tower.x, 3.2, tower.z, 16, 6.2, 16, 0xe8d8c0, root, sf.h);
    addBoxYaw(tower.x, 10.4, tower.z, 12, 8.4, 12, 0xd8c8b0, root, sf.h);
    addBoxYaw(tower.x, 16.2, tower.z, 11, 1.6, 11, 0xa8d0e0, root, sf.h);
    addBoxYaw(tower.x, 22, tower.z, 8.2, 10, 8.2, 0xf4efe6, root, sf.h);
    addBoxYaw(tower.x, 28.4, tower.z, 6.4, 4.8, 6.4, 0xd0e0e8, root, sf.h);
    addBoxYaw(tower.x, 32.2, tower.z, 8, 1.2, 8, 0xc4a070, root, sf.h);
    var mainStand = dressOffset(sf, -1, 30, 8);
    if (mainStand) addGrandstand(mainStand.x, 0, mainStand.z, 110, 11, sf.h, root, 0x2a2420, 0xd8c4a0);
    floodlightsAlong(["start", "t1", "oasis", "back"], 1, 28, 26, root);
    floodlightsAlong(["start", "t1", "oasis", "back"], -1, 26, 26, root);
    var t1 = namedPoint("t1", 0.4);
    if (t1) {
      var t1s = dressOffset(t1, 1, 32, 7);
      if (t1s) addGrandstand(t1s.x, 0, t1s.z, 44, 9, t1.h, root, 0x2a2420, 0xd8c4a0);
      var pal = sideOf(t1, -96);
      pal.x += Math.cos(t1.h) * 36;
      pal.z += Math.sin(t1.h) * 36;
      if (dressClear(pal.x, pal.z, 14)) {
        addBuilding(pal.x, 6.2, pal.z, 24, 8.4, 18, 0xd4b080, 0xc49858, root, t1.h);
        addBuilding(pal.x + 18, 4.6, pal.z + 10, 14, 6.8, 12, 0xc4a070, 0xb08848, root, t1.h);
        var dome = new THREE.Mesh(
          new THREE.SphereGeometry(8, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.52),
          new THREE.MeshLambertMaterial({ color: 0xe8c878 })
        );
        dome.position.set(pal.x, 12.2, pal.z);
        root.add(dome);
      }
    }
    var names = ["t1", "oasis", "kink", "sweeper"];
    var i;
    for (i = 0; i < names.length; i++) {
      var c = namedPoint(names[i], 0.5);
      if (!c) continue;
      var bermR = dressOffset(c, -1, 28, 8);
      var bermL = dressOffset(c, 1, 30, 7);
      if (bermR) addBoxYaw(bermR.x, 1.2, bermR.z, 20, 2.4, 8, 0xc4a06a, root, c.h);
      if (bermL) addBoxYaw(bermL.x, 1.6, bermL.z, 14, 3.0, 7, 0x6a5840, root, c.h);
    }
  }

  function dressForest() {
    var root = forestRoot;
    treesAlong(null, 1, 24, 10, root, 0x2a5a28);
    treesAlong(null, -1, 24, 11, root, 0x245224);
    var sf = namedPoint("start", 0.3) || { x: 0, z: SF_Z, h: 0, y: 0 };
    var stand = dressOffset(sf, -1, 28, 7);
    if (stand) addGrandstand(stand.x, sf.y || 0, stand.z, 76, 10, sf.h, root, 0x2a3030, 0x8a7a60);
    var pits = dressOffset(sf, 1, 46, 12);
    if (pits) addBuilding(pits.x, 3.6 + (sf.y || 0), pits.z, 26, 6.6, 12, 0x8a8070, 0x6a6050, root, sf.h);
    var source = namedPoint("source", 0.5);
    if (source) {
      var srcStand = dressOffset(source, -1, 26, 6);
      if (srcStand) addGrandstand(srcStand.x, source.y || 0, srcStand.z, 28, 7, source.h, root, 0x2a3030, 0x8a7a60);
    }
    var crest = namedPoint("raidillon", 0.85);
    if (crest) {
      var hotel = dressOffset(crest, 1, 28, 11);
      if (hotel) addBuilding(hotel.x, 5.4 + (crest.y || 0), hotel.z, 22, 8.8, 13, 0xd8d0c4, 0x8a4030, root, crest.h);
      var paint = dressOffset(crest, -1, 22, 6);
      if (paint) addBoxYaw(paint.x, 0.22 + (crest.y || 0), paint.z, 20, 0.32, 9, 0xe0c888, root, crest.h);
    }
    var mid = namedPoint("raidillon", 0.45) || namedPoint("forest", 0.35);
    var drop = namedPoint("drop", 0.5);
    if (mid) {
      var village = dressOffset(mid, -1, 100, 10) || sideOf(mid, -100);
      var vy = drop && drop.y != null ? drop.y : 0;
      if (!dressClear(village.x, village.z, 10)) return;
      addBuilding(village.x, 3.4 + vy, village.z, 12, 6, 10, 0x8a8a88, 0x6a6058, root, 0.4);
      addBuilding(village.x + 16, 3.0 + vy, village.z + 8, 10, 5.4, 8, 0x7a7a76, 0x5a5048, root, 0.2);
      addBuilding(village.x - 14, 2.6 + vy, village.z + 12, 9, 4.8, 8, 0x7a7068, 0x5a5048, root, 0.1);
      addBox(village.x - 10, 10 + vy, village.z - 6, 2.4, 20, 2.4, 0x8a8a86, root);
      addBox(village.x - 10, 21 + vy, village.z - 6, 0.4, 4, 0.4, 0x2a2018, root);
    }
  }

  function rebuildTrackDressing() {
    clearDress(campusRoot);
    clearDress(harborRoot);
    clearDress(parkRoot);
    clearDress(desertRoot);
    clearDress(forestRoot);
    if (isDriveableLoop()) {
      applyTrackPalette();
      return;
    }
    var id = builtinId();
    if (id === "harbor") dressHarbor();
    else if (id === "park") dressPark();
    else if (id === "desert") dressDesert();
    else if (id === "forest") dressForest();
    else dressCampus();
    applyTrackPalette();
  }

  function syncTrackDressing() {
    var id = isDriveableLoop() ? "" : builtinId();
    if (campusRoot) campusRoot.visible = id === "campus";
    if (harborRoot) harborRoot.visible = id === "harbor";
    if (parkRoot) parkRoot.visible = id === "park";
    if (desertRoot) desertRoot.visible = id === "desert";
    if (forestRoot) forestRoot.visible = id === "forest";
    applyTrackPalette();
  }

  function syncCampusDressing() {
    rebuildTrackDressing();
    syncTrackDressing();
  }

  function isCustomCircuit() {
    return isDriveableLoop();
  }

  function menuTrackName() {
    if (isCustomCircuit()) return "CUSTOM CIRCUIT";
    var spec = builtinSpec(activeBuiltin === "campus" ? "" : String(activeBuiltin || "").toUpperCase());
    if (activeBuiltin === "harbor") return "HARBOR STREET";
    if (activeBuiltin === "park") return "ROYAL PARK";
    if (activeBuiltin === "desert") return "DESERT DUSK";
    if (activeBuiltin === "forest") return "FOREST CLIMB";
    return spec && spec.menu ? spec.menu : "CAMPUS LOOP";
  }

  function menuTrackLabel() {
    if (isCustomCircuit()) return "Custom circuit";
    if (activeBuiltin === "harbor") return "Harbor Street";
    if (activeBuiltin === "park") return "Royal Park";
    if (activeBuiltin === "desert") return "Desert Dusk";
    if (activeBuiltin === "forest") return "Forest Climb";
    return "Campus Loop";
  }

  function refreshMenuTrackLabel() {
    var name = menuTrackName();
    var label = menuTrackLabel();
    if (hud.titleTrack) {
      hud.titleTrack.textContent = label + " · 5 laps · Car #7";
    }
    if (hud.circuit) {
      hud.circuit.textContent = (isCustomCircuit() ? "Custom" : label) + " · #7";
    }
    paintCircuitPicks();
    return name;
  }

  function circuitLabel() {
    refreshMenuTrackLabel();
  }

  function paintCircuitPicks() {
    var want = isCustomCircuit() ? "__custom__" : isBuiltinCode(trackCode) ? String(trackCode || "").toUpperCase() : "";
    function paint(row) {
      if (!row) return;
      var btns = row.querySelectorAll("[data-circuit]");
      var i;
      for (i = 0; i < btns.length; i++) {
        var id = btns[i].getAttribute("data-circuit") || "";
        btns[i].classList.toggle("on", !isCustomCircuit() && id.toUpperCase() === want);
      }
    }
    paint(hud.circuitPicks);
    paint(hud.circuitPicksEditor);
    paint(hud.circuitPicksLobby);
    paint(document.getElementById("pause-circuits"));
  }

  function pickBuiltin(code) {
    var next = cleanTrack(code || "");
    if (mpMode && net && net.active && net.isHost() && (state === "start" || state === "racing")) {
      if (net.setTrack) net.setTrack(next);
      net.track = next;
      paintCircuitPicks();
      paintPauseMenu();
      return;
    }
    applyTrack(next, true, true);
    if (net && net.active && net.isHost() && net.setTrack) {
      net.setTrack(isDriveableLoop() || isBuiltinCode(trackCode) ? trackCode : "");
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
    lockRacePath(trackCode);
    if (net) net.track = isDriveableLoop() || isBuiltinCode(trackCode) ? trackCode : "";
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
    killGhost();
    editorDrag = null;
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
    lockRacePath(trackCode);
    if (net) net.track = isDriveableLoop() || isBuiltinCode(trackCode) ? trackCode : "";
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
    S: "long",
    r: "90",
    w: "sweeper",
    H: "hairpin",
    C: "chicane",
    F: "start",
    P: "pit",
    t: "tree",
  };
  var trackUndo = [];
  var tilePick = "";
  var tileSel = "";
  var editorDrag = null;
  var _tileArt = {};

  function tileIconPts(type, rot, w, h) {
    // Tile-local centerlines that hit the same mid-edge ports the 3D
    // pieces use. Inset cartoons left a dirt gap at every join.
    // Keep this in chip space — world pieceSegs + ctx.arc drew the
    // long way around and clipped 90/sweeper/hairpin to a blank square.
    var r0 = (rot || 0) & 3;
    var cell = Math.min(w, h);
    var pts = [];
    function add(x, y) {
      pts.push({ x: x, y: y });
    }
    function arcPoly(cx, cy, r, a0, a1) {
      var steps = 18;
      var i;
      for (i = 0; i <= steps; i++) {
        var a = a0 + (a1 - a0) * (i / steps);
        add(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
    }
    function spin() {
      if (!r0) return pts;
      var cx = w * 0.5;
      var cy = h * 0.5;
      var a = r0 * Math.PI * 0.5;
      var c = Math.cos(a);
      var s = Math.sin(a);
      var out = [];
      var i;
      for (i = 0; i < pts.length; i++) {
        var x = pts[i].x - cx;
        var y = pts[i].y - cy;
        out.push({ x: cx + x * c - y * s, y: cy + x * s + y * c });
      }
      return out;
    }
    if (type === "r") {
      arcPoly(w, h, cell * 0.5, -Math.PI * 0.5, -Math.PI);
      return spin();
    }
    if (type === "w") {
      arcPoly(w, h, cell * 0.75, -Math.PI * 0.5, -Math.PI);
      return spin();
    }
    if (type === "H") {
      if (r0 === 0) arcPoly(w * 0.5, h, w * 0.25, Math.PI, Math.PI * 2);
      else if (r0 === 1) arcPoly(0, h * 0.5, h * 0.25, -Math.PI * 0.5, Math.PI * 0.5);
      else if (r0 === 2) arcPoly(w * 0.5, 0, w * 0.25, Math.PI, 0);
      else arcPoly(w, h * 0.5, h * 0.25, Math.PI * 0.5, Math.PI * 1.5);
      return pts;
    }
    if (type === "C") {
      var amp = cell * 0.16;
      var n = 32;
      var i;
      for (i = 0; i <= n; i++) {
        var t = i / n;
        var env = Math.sin(t * Math.PI);
        env *= env;
        add(w * t, h * 0.5 - Math.sin(t * Math.PI * 2) * env * amp);
      }
      return spin();
    }
    if (type === "S") {
      if (r0 & 1) {
        add(w * 0.5, 0);
        add(w * 0.5, h);
      } else {
        add(0, h * 0.5);
        add(w, h * 0.5);
      }
      return pts;
    }
    add(0, h * 0.5);
    add(w, h * 0.5);
    return spin();
  }

  function tileIconSvg(type, rot, w, h, onBoard) {
    // Filled road in the tile. A stroked centerline looked like the
    // old inset cartoon. Canvas data-URLs stayed blank on Chromebooks.
    var r0 = (rot || 0) & 3;
    var cols = 1;
    var rows = 1;
    if (type === "w") {
      cols = 2;
      rows = 2;
    } else if (type === "S" || type === "H") {
      if (r0 & 1) rows = 2;
      else cols = 2;
    }
    var cell = Math.min(w / cols, h / rows);
    var hw = cell * 0.18;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
      w +
      " " +
      h +
      '" width="100%" height="100%" preserveAspectRatio="none">';
    if (!onBoard) svg += '<rect width="' + w + '" height="' + h + '" fill="#6a655c"/>';
    if (type === "t") {
      svg +=
        '<circle cx="' +
        w * 0.5 +
        '" cy="' +
        h * 0.72 +
        '" r="' +
        cell * 0.16 +
        '" fill="#5a4030"/>';
      svg +=
        '<rect x="' +
        w * 0.45 +
        '" y="' +
        h * 0.5 +
        '" width="' +
        cell * 0.1 +
        '" height="' +
        cell * 0.24 +
        '" fill="#6a4020"/>';
      svg +=
        '<circle cx="' +
        w * 0.5 +
        '" cy="' +
        h * 0.4 +
        '" r="' +
        cell * 0.2 +
        '" fill="#3f8a32"/>';
      svg +=
        '<circle cx="' +
        w * 0.4 +
        '" cy="' +
        h * 0.36 +
        '" r="' +
        cell * 0.14 +
        '" fill="#4ea03c"/>';
      svg +=
        '<circle cx="' +
        w * 0.6 +
        '" cy="' +
        h * 0.34 +
        '" r="' +
        cell * 0.13 +
        '" fill="#4ea03c"/>';
      svg += "</svg>";
      return svg;
    }
    var pts = tileIconPts(type, rot, w, h);
    var draw = pts.slice();
    if (draw.length > 1) {
      var pad = onBoard ? 3 : 0.5;
      var ax = draw[0].x - draw[1].x;
      var ay = draw[0].y - draw[1].y;
      var al = Math.hypot(ax, ay) || 1;
      draw[0] = { x: draw[0].x + (ax / al) * pad, y: draw[0].y + (ay / al) * pad };
      var n1 = draw.length - 1;
      var bx = draw[n1].x - draw[n1 - 1].x;
      var by = draw[n1].y - draw[n1 - 1].y;
      var bl = Math.hypot(bx, by) || 1;
      draw[n1] = { x: draw[n1].x + (bx / bl) * pad, y: draw[n1].y + (by / bl) * pad };
    }
    function along(t) {
      if (pts.length < 2) return { x: pts[0] ? pts[0].x : 0, y: pts[0] ? pts[0].y : 0, ang: 0 };
      var total = 0;
      var k;
      for (k = 1; k < pts.length; k++) {
        total += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
      }
      var want = total * (t < 0 ? 0 : t > 1 ? 1 : t);
      var acc = 0;
      for (k = 1; k < pts.length; k++) {
        var dx = pts[k].x - pts[k - 1].x;
        var dy = pts[k].y - pts[k - 1].y;
        var seg = Math.hypot(dx, dy);
        if (acc + seg >= want || k === pts.length - 1) {
          var u = seg ? (want - acc) / seg : 0;
          if (u < 0) u = 0;
          if (u > 1) u = 1;
          return { x: pts[k - 1].x + dx * u, y: pts[k - 1].y + dy * u, ang: Math.atan2(dy, dx) };
        }
        acc += seg;
      }
      return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, ang: 0 };
    }
    function sideNorms(line) {
      var nrm = [];
      var i;
      for (i = 0; i < line.length; i++) {
        var dx;
        var dy;
        if (i === 0) {
          dx = line[1].x - line[0].x;
          dy = line[1].y - line[0].y;
        } else if (i === line.length - 1) {
          dx = line[i].x - line[i - 1].x;
          dy = line[i].y - line[i - 1].y;
        } else {
          var axn = line[i].x - line[i - 1].x;
          var ayn = line[i].y - line[i - 1].y;
          var bxn = line[i + 1].x - line[i].x;
          var byn = line[i + 1].y - line[i].y;
          var la = Math.hypot(axn, ayn) || 1;
          var lb = Math.hypot(bxn, byn) || 1;
          dx = axn / la + bxn / lb;
          dy = ayn / la + byn / lb;
        }
        var L = Math.hypot(dx, dy) || 1;
        nrm.push({ x: -dy / L, y: dx / L });
      }
      return nrm;
    }
    function shift(line, amt) {
      var nrm = sideNorms(line);
      var out = [];
      var i;
      for (i = 0; i < line.length; i++) {
        out.push({ x: line[i].x + nrm[i].x * amt, y: line[i].y + nrm[i].y * amt });
      }
      return out;
    }
    function poly(ring, fill) {
      if (!ring.length) return "";
      var d = "M" + ring[0].x.toFixed(2) + "," + ring[0].y.toFixed(2);
      var i;
      for (i = 1; i < ring.length; i++) d += "L" + ring[i].x.toFixed(2) + "," + ring[i].y.toFixed(2);
      return '<path d="' + d + 'Z" fill="' + fill + '" stroke="none"/>';
    }
    function band(a, b) {
      return a.concat(b.slice().reverse());
    }
    function bricks(inner, outer, step) {
      if (inner.length < 2 || outer.length < 2) return "";
      var acc = 0;
      var flip = 0;
      var out = "";
      var i;
      for (i = 1; i < inner.length && i < outer.length; i++) {
        var seg = Math.hypot(inner[i].x - inner[i - 1].x, inner[i].y - inner[i - 1].y);
        acc += seg;
        if (acc < step && i < inner.length - 1) continue;
        out += poly(
          [inner[i - 1], inner[i], outer[i], outer[i - 1]],
          flip ? "#fff6ee" : "#ff2038"
        );
        flip = 1 - flip;
        acc = 0;
      }
      return out;
    }
    if (draw.length > 1) {
      var runI = shift(draw, hw * 1.55);
      var runO = shift(draw, -hw * 1.55);
      var kerbI = shift(draw, hw * 1.18);
      var kerbO = shift(draw, -hw * 1.18);
      var roadI = shift(draw, hw);
      var roadO = shift(draw, -hw);
      svg += poly(band(runI, runO), "#8d97a6");
      svg += poly(band(kerbI, kerbO), "#ff2038");
      svg += bricks(roadI, kerbI, cell * 0.16);
      svg += bricks(kerbO, roadO, cell * 0.16);
      svg += poly(band(roadI, roadO), "#3a3e46");
      var mid = "";
      var mi;
      for (mi = 0; mi < draw.length; mi++) {
        mid += (mi ? "L" : "M") + draw[mi].x.toFixed(2) + "," + draw[mi].y.toFixed(2);
      }
      svg +=
        '<path d="' +
        mid +
        '" fill="none" stroke="#d7dbe2" stroke-width="' +
        (cell * 0.025).toFixed(2) +
        '" stroke-linecap="butt"/>';
    }
    if (pts.length > 1) {
      var mark = along(0.62);
      var aw = cell * 0.08;
      var tip = cell * 0.11;
      var x1 = mark.x + Math.cos(mark.ang) * tip;
      var y1 = mark.y + Math.sin(mark.ang) * tip;
      var lx = Math.cos(mark.ang + 2.45) * aw;
      var ly = Math.sin(mark.ang + 2.45) * aw;
      var rx = Math.cos(mark.ang - 2.45) * aw;
      var ry = Math.sin(mark.ang - 2.45) * aw;
      svg +=
        '<polygon points="' +
        x1.toFixed(1) +
        "," +
        y1.toFixed(1) +
        " " +
        (mark.x + lx).toFixed(1) +
        "," +
        (mark.y + ly).toFixed(1) +
        " " +
        (mark.x + rx).toFixed(1) +
        "," +
        (mark.y + ry).toFixed(1) +
        '" fill="#ffe566"/>';
    }
    if (type === "P" && pts.length > 1) {
      var pit = along(0.5);
      var px = Math.cos(pit.ang);
      var py = Math.sin(pit.ang);
      var nx = -py;
      var ny = px;
      var bay = cell * 0.22;
      var a0 = along(0.18);
      var a1 = along(0.82);
      var pitMid = along(0.5);
      var off = hw + bay;
      var dPit =
        "M" +
        a0.x.toFixed(1) +
        "," +
        a0.y.toFixed(1) +
        " C" +
        (a0.x + nx * bay).toFixed(1) +
        "," +
        (a0.y + ny * bay).toFixed(1) +
        " " +
        (pitMid.x + nx * off).toFixed(1) +
        "," +
        (pitMid.y + ny * off).toFixed(1) +
        " " +
        (pitMid.x + nx * off + px * cell * 0.08).toFixed(1) +
        "," +
        (pitMid.y + ny * off + py * cell * 0.08).toFixed(1) +
        " L" +
        (pitMid.x + nx * off - px * cell * 0.08).toFixed(1) +
        "," +
        (pitMid.y + ny * off - py * cell * 0.08).toFixed(1) +
        " C" +
        (pitMid.x + nx * off).toFixed(1) +
        "," +
        (pitMid.y + ny * off).toFixed(1) +
        " " +
        (a1.x + nx * bay).toFixed(1) +
        "," +
        (a1.y + ny * bay).toFixed(1) +
        " " +
        a1.x.toFixed(1) +
        "," +
        a1.y.toFixed(1);
      svg +=
        '<path d="' +
        dPit +
        '" fill="none" stroke="#2ec8c3" stroke-width="' +
        (hw * 1.4).toFixed(1) +
        '" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    if (type === "F" && pts.length > 1) {
      var fin = along(0.5);
      var fx = Math.cos(fin.ang);
      var fy = Math.sin(fin.ang);
      var gx = -fy;
      var gy = fx;
      var half = hw * 0.92;
      var gap = cell * 0.045;
      function stripe(off) {
        var sx = fin.x + fx * off;
        var sy = fin.y + fy * off;
        return (
          '<line x1="' +
          (sx - gx * half).toFixed(1) +
          '" y1="' +
          (sy - gy * half).toFixed(1) +
          '" x2="' +
          (sx + gx * half).toFixed(1) +
          '" y2="' +
          (sy + gy * half).toFixed(1) +
          '" stroke="#fff6ee" stroke-width="' +
          (cell * 0.055).toFixed(1) +
          '" stroke-linecap="butt"/>'
        );
      }
      svg += stripe(-gap);
      svg += stripe(gap);
    }
    svg += "</svg>";
    return svg;
  }

  function tileArt(type, rot, size) {
    var key = type + rot + ":" + size;
    if (_tileArt[key]) return _tileArt[key];
    var unit = size || 80;
    var span = pieceSpan(type, rot || 0);
    var w = unit * span.cols;
    var h = unit * span.rows;
    _tileArt[key] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(tileIconSvg(type, rot || 0, w, h));
    return _tileArt[key];
  }

  function editorTilePx(vw, vh) {
    var floor = vh < 430 ? 28 : 40;
    var short = vh < 520 ? vh * 0.08 : 72;
    return Math.round(clamp(Math.min(vw * 0.09, short), floor, 72));
  }

  function editorBoardBox(maxW, maxH) {
    var cell = Math.floor(Math.min(maxW / MAP_W, maxH / MAP_H));
    if (!(cell > 3)) return { w: 0, h: 0, cell: 0 };
    return { w: cell * MAP_W, h: cell * MAP_H, cell: cell };
  }

  function layoutTrackEditor() {
    var screen = hud.trackScreen;
    var board = hud.tileBoard;
    var host = hud.tileBoardHost;
    if (!screen || !board || screen.classList.contains("hidden")) return;
    var vw = window.innerWidth || 800;
    var vh = window.innerHeight || 600;
    if (window.visualViewport) {
      vw = window.visualViewport.width || vw;
      vh = window.visualViewport.height || vh;
    }
    screen.style.setProperty("--tile", editorTilePx(vw, vh) + "px");
    var box = host || board.parentNode;
    if (!box || box.clientWidth < 8 || box.clientHeight < 8) return;
    var fit = editorBoardBox(box.clientWidth, box.clientHeight);
    if (!fit.w) return;
    board.style.width = fit.w + "px";
    board.style.height = fit.h + "px";
  }

  function scheduleTrackLayout() {
    layoutTrackEditor();
    requestAnimationFrame(layoutTrackEditor);
  }

  function paintTrackEditor() {
    if (!hud.trackView) return;
    if (!trackCode || isBuiltinCode(trackCode)) {
      hud.trackView.textContent = menuTrackLabel();
    } else if (trackCode.charAt(0) === "M") {
      var n = parseMap(trackCode).length;
      hud.trackView.textContent = isDriveableLoop()
        ? "Custom · CLOSED LOOP · " + n + " pcs"
        : "Custom · OPEN LAYOUT · " + n + " pcs";
    } else {
      hud.trackView.textContent = trackCode + " · open layout";
    }
    refreshMenuTrackLabel();
    if (hud.trackPaste && document.activeElement !== hud.trackPaste) {
      hud.trackPaste.value = trackCode;
    }
    if (hud.tilePalette) {
      var pal = hud.tilePalette.querySelectorAll(".palette-tile[data-tile]");
      var pi;
      for (pi = 0; pi < pal.length; pi++) {
        var pt = pal[pi].getAttribute("data-tile");
        pal[pi].classList.toggle("picked", pt === tilePick);
        pal[pi].style.backgroundImage = "";
        pal[pi].innerHTML = tileIconSvg(
          pt,
          0,
          pt === "H" || pt === "S" || pt === "w" ? 144 : 72,
          pt === "w" ? 144 : 72
        );
        pal[pi].setAttribute("aria-label", TILE_LABEL[pt] || pt);
      }
    }
    if (!hud.tileBoard) return;
    var pieces = parseMap(trackCode);
    var occ = occupyMap(pieces);
    var painted = {};
    var html = "";
    var y;
    var x;
    for (y = 0; y < MAP_H; y++) {
      for (x = 0; x < MAP_W; x++) {
        var k = mapKey(x, y);
        if (painted[k]) continue;
        var p = occ[k];
        if (p && p.x === x && p.y === y) {
          var fp = footprint(p);
          var minx = x;
          var miny = y;
          var maxx = x;
          var maxy = y;
          var fi;
          for (fi = 0; fi < fp.length; fi++) {
            painted[mapKey(fp[fi].x, fp[fi].y)] = 1;
            if (fp[fi].x < minx) minx = fp[fi].x;
            if (fp[fi].y < miny) miny = fp[fi].y;
            if (fp[fi].x > maxx) maxx = fp[fi].x;
            if (fp[fi].y > maxy) maxy = fp[fi].y;
          }
          var sel = tileSel === mapKey(p.x, p.y);
          html +=
            '<div class="tile-cell' +
            (sel ? " picked" : "") +
            '" data-x="' +
            p.x +
            '" data-y="' +
            p.y +
            '" data-tile="' +
            p.t +
            '" data-rot="' +
            p.r +
            '" role="button" tabindex="-1" style="grid-column:' +
            (minx + 1) +
            " / span " +
            (maxx - minx + 1) +
            ";grid-row:" +
            (miny + 1) +
            " / span " +
            (maxy - miny + 1) +
            '">' +
            tileIconSvg(p.t, p.r, 80 * (maxx - minx + 1), 80 * (maxy - miny + 1), true);
          if (sel) {
            html += '<button type="button" class="tile-rot-handle" tabindex="-1" data-rot-handle="1" aria-label="Rotate 90 degrees">↻</button>';
          }
          html += "</div>";
        } else if (!p) {
          html +=
            '<div class="tile-cell empty" data-x="' +
            x +
            '" data-y="' +
            y +
            '" role="button" tabindex="-1" style="grid-column:' +
            (x + 1) +
            ";grid-row:" +
            (y + 1) +
            '"></div>';
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
    scheduleTrackLayout();
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
    if (net && net.active && net.isHost() && net.setTrack) net.setTrack(isDriveableLoop() || isBuiltinCode(trackCode) ? trackCode : "");
  }

  function pieceAt(x, y, pieces) {
    var occ = occupyMap(pieces || parseMap(trackCode));
    return occ[mapKey(x, y)] || null;
  }

  function canSit(p, pieces, skip) {
    if (!cellsInBoard(footprint(p))) return false;
    var i;
    for (i = 0; i < pieces.length; i++) {
      if (skip && pieces[i].x === skip.x && pieces[i].y === skip.y && pieces[i].t === skip.t) continue;
      if (footprintsOverlap(p, pieces[i])) return false;
    }
    return true;
  }

  function placePiece(t, x, y, r) {
    if (!MAP_TYPES[t] || x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
    var next = { t: t, x: x, y: y, r: r || 0 };
    if (!cellsInBoard(footprint(next))) return;
    var pieces = parseMap(trackCode).filter(function (p) {
      return !footprintsOverlap(p, next);
    });
    pieces.push(next);
    tileSel = mapKey(x, y);
    commitTrack(encodeMap(pieces));
  }

  function movePiece(x0, y0, x1, y1) {
    if (x0 === x1 && y0 === y1) return;
    var pieces = parseMap(trackCode);
    var moving = pieceAt(x0, y0, pieces);
    if (!moving) return;
    var dest = { t: moving.t, x: x1, y: y1, r: moving.r };
    if (!cellsInBoard(footprint(dest))) return;
    var occ = pieceAt(x1, y1, pieces);
    if (occ && occ !== moving && occ.t === moving.t) {
      var swapA = { t: moving.t, x: x1, y: y1, r: moving.r };
      var swapB = { t: occ.t, x: moving.x, y: moving.y, r: occ.r };
      if (cellsInBoard(footprint(swapA)) && cellsInBoard(footprint(swapB))) {
        moving.x = x1;
        moving.y = y1;
        occ.x = x0;
        occ.y = y0;
        tileSel = mapKey(x1, y1);
        commitTrack(encodeMap(pieces));
      }
      return;
    }
    var others = pieces.filter(function (p) {
      return p !== moving;
    });
    if (!canSit(dest, others)) return;
    moving.x = x1;
    moving.y = y1;
    tileSel = mapKey(x1, y1);
    commitTrack(encodeMap(pieces));
  }

  function deletePiece(x, y) {
    var hit = pieceAt(x, y);
    if (!hit) return;
    var next = encodeMap(
      parseMap(trackCode).filter(function (p) {
        return !(p.x === hit.x && p.y === hit.y);
      })
    );
    if (tileSel === mapKey(hit.x, hit.y)) tileSel = "";
    commitTrack(next);
  }

  function rotatePiece(x, y) {
    var pieces = parseMap(trackCode);
    var hit = pieceAt(x, y, pieces);
    if (!hit) return;
    var tryR = (hit.r + 1) & 3;
    var others = pieces.filter(function (p) {
      return p !== hit;
    });
    var next = { t: hit.t, x: hit.x, y: hit.y, r: tryR };
    if (!canSit(next, others)) {
      var nudge = [
        [0, 0],
        [-1, 0],
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ];
      var ni;
      var fitted = null;
      for (ni = 0; ni < nudge.length; ni++) {
        var cand = { t: hit.t, x: hit.x + nudge[ni][0], y: hit.y + nudge[ni][1], r: tryR };
        if (canSit(cand, others)) {
          fitted = cand;
          break;
        }
      }
      if (!fitted) return;
      next = fitted;
    }
    hit.t = next.t;
    hit.x = next.x;
    hit.y = next.y;
    hit.r = next.r;
    tileSel = mapKey(hit.x, hit.y);
    commitTrack(encodeMap(pieces));
  }

  var _rotLock = 0;
  function rotateSelected() {
    if (!tileSel) return;
    var now = Date.now();
    if (now - _rotLock < 220) return;
    _rotLock = now;
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
      lastS: 0,
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
    // Mesh plane, not Sprite: the chase cam flips projection X, which
    // kills Sprite quads (behind cam / zero area / invisible).
    var mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    var tag = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    tag.scale.set(2.2, 0.48, 1);
    tag.renderOrder = 12;
    tag.frustumCulled = false;
    tag.userData.nametag = true;
    tag.userData.canvas = c;
    tag.userData.label = "";
    scene.add(tag);
    r.tag = tag;
    paintNameTag(r);
  }

  function dropNameTag(r) {
    if (!r || !r.tag) return;
    scene.remove(r.tag);
    if (r.tag.material) {
      if (r.tag.material.map) r.tag.material.map.dispose();
      r.tag.material.dispose();
    }
    r.tag = null;
  }

  function paintNameTag(r) {
    if (!r || !r.tag) return;
    var t = tagLabel(r).slice(0, 14);
    if (r.tag.userData.label === t) return;
    r.tag.userData.label = t;
    var c = r.tag.userData.canvas;
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 384, 80);
    ctx.save();
    // Pre-mirror like numberDecal so the X-flipped chase cam reads LTR.
    ctx.translate(384, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = r.kind === "player" ? "rgba(20,143,140,0.92)" : "rgba(16,10,8,0.88)";
    ctx.fillRect(16, 18, 352, 46);
    ctx.font = "bold 38px Trebuchet MS, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(8,6,4,0.95)";
    ctx.lineWidth = 6;
    ctx.fillStyle = "#f4efe6";
    ctx.strokeText(t, 192, 42);
    ctx.fillText(t, 192, 42);
    ctx.restore();
    r.tag.material.map.needsUpdate = true;
  }

  function layoutNameTags() {
    var cam = camera.position;
    function one(r) {
      if (!r || !r.tag) return;
      // Own tag stays off (Designer). Every other visible car must show.
      var on = r.kind !== "player" && !!(r.mesh && r.mesh.visible);
      r.tag.visible = on;
      if (!on) {
        r.tag.material.opacity = 0;
        return;
      }
      paintNameTag(r);
      // Halo sits at 0.8. Tiny tag just above it — not a floating HUD plaque,
      // and not up at chase-cam height (that put tags behind the lens).
      var y = rideHeight(r.x, r.z) + 1.46;
      r.tag.position.set(r.x, y, r.z);
      r.tag.quaternion.copy(camera.quaternion);
      var dist = Math.hypot(r.x - cam.x, y - cam.y, r.z - cam.z);
      var w = 2.2;
      var h = 0.48;
      var op = 1;
      if (dist < 7) {
        var close = (7 - dist) / 4;
        if (close > 1) close = 1;
        w *= 1 - 0.22 * close;
        h *= 1 - 0.22 * close;
      }
      if (dist > 28) {
        var far = (dist - 28) / 48;
        if (far > 1) far = 1;
        w *= 1 - 0.36 * far;
        h *= 1 - 0.36 * far;
        op = 1 - 0.72 * far;
      }
      r.tag.material.opacity = op;
      r.tag.scale.set(w, h, 1);
    }
    one(player);
    eachCpu(function (r) {
      one(r);
    });
    Object.keys(remotes).forEach(function (id) {
      one(remotes[id].r);
    });
    Object.keys(hostBots).forEach(function (id) {
      one(hostBots[id]);
    });
  }

  var player = createRacer("player", playerBody, "House 7", 7, playerWing);
  // Player sits GRID_P2 / slot 3. Seven CPUs fill the rest of the 2-wide 8-car grid.
  var SOLO_FIELD = [
    { color: 0xd4a017, name: "BowieKnife99", num: 12, slot: 0, pathS: 6, pathSide: 1 },
    { color: 0x3d8cff, name: "Library Kid", num: 3, slot: 1, pathS: 6, pathSide: -1 },
    { color: 0xb4532e, name: "Hall Monitor", num: 21, slot: 2, pathS: 22, pathSide: 1 },
    { color: 0x9b59b6, name: "Band Kid", num: 9, slot: 4, pathS: 14, pathSide: 1 },
    { color: 0x2ecc71, name: "Lab Partner", num: 18, slot: 5, pathS: 22, pathSide: -1 },
    { color: 0xe67e22, name: "Detention", num: 5, slot: 6, pathS: 30, pathSide: 1 },
    { color: 0x1abc9c, name: "Yearbook", num: 14, slot: 7, pathS: 30, pathSide: -1 },
  ];
  var cpus = [
    createRacer("cpu", 0xd4a017, "BowieKnife99", 12),
    createRacer("cpu", 0x3d8cff, "Library Kid", 3),
    createRacer("cpu", 0xb4532e, "Hall Monitor", 21),
    createRacer("cpu", 0x9b59b6, "Band Kid", 9),
    createRacer("cpu", 0x2ecc71, "Lab Partner", 18),
    createRacer("cpu", 0xe67e22, "Detention", 5),
    createRacer("cpu", 0x1abc9c, "Yearbook", 14),
  ];

  function eachCpu(fn) {
    var i;
    for (i = 0; i < cpus.length; i++) fn(cpus[i], i);
  }

  function soloCpuPose(i, onCustom) {
    var spec = SOLO_FIELD[i];
    if (onCustom) return slotOnPath(TRACK_LEN - spec.pathS, spec.pathSide);
    return gridSlot(spec.slot);
  }

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
    r.pitAwayT = 0;
    r.launchMul = 1;
    r.launchT = 0;
    r.launchArmed = false;
    r.aiT = 0;
    r.aiStuck = 0;
    r.pitExitT = 0;
    r.hitYawT = 0;
    r.kerbBump = 0;
    r.mesh.position.set(x, rideHeight(x, z), z);
    r.mesh.rotation.set(0, -heading, 0);
  }

  function rideHeight(x, z) {
    // Custom ribbon sits at y=0.055. Wheel center is 0.28, radius 0.32, so
    // contact is ride-0.04. 0.12 puts the open wheels ON the ribbon, not in it.
    var base = isDriveableLoop() ? 0.12 : 0;
    if (x == null || z == null || !PATH.length) return base;
    var pr = projectTrack(x, z);
    return base + (pr && pr.y ? pr.y : 0);
  }

  function slotOnPath(s, side) {
    var p = centerlinePoint(s);
    var nx = -Math.sin(p.h);
    var nz = Math.cos(p.h);
    return { x: p.x + nx * 2.7 * side, z: p.z + nz * 2.7 * side, h: p.h, s: s };
  }

  function customGridPose() {
    if (!isDriveableLoop() || TRACK_LEN < 8) return null;
    var p = slotOnPath(TRACK_LEN - 14, -1);
    var line = projectTrack(p.x, p.z);
    if (!line.onAsphalt) {
      var c = centerlinePoint(TRACK_LEN - 14);
      p = { x: c.x, z: c.z, h: c.h, s: TRACK_LEN - 14 };
    }
    return p;
  }

  var cpuGrid = [];

  function applyCustomGrid() {
    var pose = customGridPose();
    if (pose) {
      playerGridX = pose.x;
      playerGridZ = pose.z;
      gridHeading = pose.h;
      return pose;
    }
    playerGridX = GRID_P2_X;
    playerGridZ = GRID_P2_Z;
    gridHeading = 0;
    return null;
  }

  function resetGrid() {
    var pose = null;
    if (mpMode && playerGridX != null && isFinite(playerGridX) && playerGridZ != null && isFinite(playerGridZ)) {
      // Keep the slot heading. Re-projecting snaps the host onto the pit peel.
      if (gridHeading == null || !isFinite(gridHeading)) gridHeading = 0;
    } else {
      pose = applyCustomGrid();
      if (!pose) gridHeading = 0;
    }
    resetRacer(player, playerGridX, playerGridZ, gridHeading, TRACK_LEN - 14);
    eachCpu(function (r, i) {
      var spec = SOLO_FIELD[i];
      var g = soloCpuPose(i, !!pose);
      cpuGrid[i] = g;
      resetRacer(r, g.x, g.z, slotHeading(g), TRACK_LEN - spec.pathS);
    });
    function pinS(r) {
      r.s = projectTrack(r.x, r.z).s;
      r.lastS = r.s;
      r.passedHalf = false;
    }
    pinS(player);
    eachCpu(function (r) {
      pinS(r);
    });
    eachCpu(function (r) {
      r.mesh.visible = !mpMode;
    });
    raceTime = 0;
    didPit = false;
    pitTimer = 0;
    pitHudPct = 0;
    pitFlash = 0;
    pitUsedVisit = false;
    pitServicing = false;
    pitVisit = false;
    pitAwayT = 0;
    pitBanner = "";
    spaceBrakeArmed = true;
    revs = 0;
    launchMul = 1;
    launchT = 0;
    launchCall = "";
    launchCallT = 0;
    _hudHave = false;
    startPhase = "prestart";
    startT = 2;
    redsOn = 0;
    holdDelay = 0.2 + Math.random() * 2.8;
    sky.planeLap = 0;
  }

  function pitRoadDist(x, z) {
    if (!PIT_PATH.length) return Infinity;
    var pr = projectOn(x, z, PIT_PATH);
    return pr && pr.hit ? Math.sqrt(pr.hit.d2) : Infinity;
  }

  function raceRoadDist(x, z) {
    var segs = PATH.length ? PATH : MAP_SURF;
    if (!segs || !segs.length) return Infinity;
    var pr = projectOn(x, z, segs);
    return pr && pr.hit ? Math.sqrt(pr.hit.d2) : Infinity;
  }

  function pitClaims(x, z) {
    // The pit only owns a spot when its own ribbon is the nearer road.
    // Rectangles alone are a trap on the built-in circuits: they all
    // inherit the Campus pit box, and Harbor threads its flat-out
    // harbour straight straight past it, so a car a metre off the kerb
    // there was being read as pit-lane traffic and told to crawl.
    if (!PIT_META.on) return false;
    var pd = pitRoadDist(x, z);
    if (pd > PIT_HALF) return false;
    // Racing asphalt is never the pit, however close the lane runs.
    var rd = raceRoadDist(x, z);
    return rd > ASPHALT && pd < rd;
  }

  function inPitLane(r) {
    return pitClaims(r.x, r.z);
  }

  function inPitGrab(r) {
    if (!pitClaims(r.x, r.z)) return false;
    // The box is the back half of the lane, so a car still peeling in
    // is not grabbed before it has straightened up.
    var dx = PIT_META.bx - PIT_META.ax;
    var dz = PIT_META.bz - PIT_META.az;
    var len2 = dx * dx + dz * dz || 1;
    var t = ((r.x - PIT_META.ax) * dx + (r.z - PIT_META.az) * dz) / len2;
    return t >= 0.42 && t <= 0.98;
  }

  var LAP_ORIGIN = { len: -1, n: -1, s: 0 };

  // Arc length of the scoring line. Custom boards start the ribbon on it,
  // but the built-in circuits paint their S/F at world (0, SF_Z), which
  // can sit hundreds of metres along the path from s=0. Anything reasoning
  // about "how much of this lap is left" has to measure from here.
  function lapOriginS() {
    if (LAP_ORIGIN.len === TRACK_LEN && LAP_ORIGIN.n === PATH.length) return LAP_ORIGIN.s;
    LAP_ORIGIN.len = TRACK_LEN;
    LAP_ORIGIN.n = PATH.length;
    LAP_ORIGIN.s = 0;
    if (!isDriveableLoop()) {
      var stripe = projectTrack(0, SF_Z);
      if (stripe && stripe.onAsphalt) LAP_ORIGIN.s = stripe.s;
    }
    return LAP_ORIGIN.s;
  }

  function updateLaps(r) {
    if (r.finished) return;
    var prog = projectTrackNear(r.x, r.z, r.s);
    r.s = prog.s;
    // Any long ribbon — custom closed boards AND the built-in circuits.
    // Harbor / Park / Desert / Forest never trip the old Campus x=8 / z>8
    // gate, so they stayed on lap 1 until the clock ran out.
    if (PATH.length && TRACK_LEN > 80) {
      var origin = lapOriginS();
      var prevRaw = r.lastS != null ? r.lastS : r.s;
      var prev = prevRaw - origin;
      var cur = r.s - origin;
      if (prev < 0) prev += TRACK_LEN;
      if (cur < 0) cur += TRACK_LEN;
      // A frame can only move a car a few metres. Anything bigger is the
      // projection hopping to a neighbouring bit of ribbon — normal on a
      // twisty board when you run wide — and scoring it hands out free
      // laps. Tight custom loops were finishing in a third of the time.
      var step = cur - prev;
      if (step > TRACK_LEN * 0.5) step -= TRACK_LEN;
      else if (step < -TRACK_LEN * 0.5) step += TRACK_LEN;
      if (Math.abs(step) > 40) {
        r.lastS = r.s;
        r.lastX = r.x;
        return;
      }
      if (prev < TRACK_LEN * 0.5 && cur >= TRACK_LEN * 0.5) r.passedHalf = true;
      // The pit road leaves the ribbon just before the line on most
      // boards, so a car taking a stop crosses the stripe on pit paint
      // or on the grass between the two. Requiring racing asphalt threw
      // that lap away and made every stop cost a whole extra lap.
      var scoreable = prog.onAsphalt || pitRoadDist(r.x, r.z) <= PIT_HALF + 9;
      if (r.passedHalf && prev > TRACK_LEN * 0.72 && cur < TRACK_LEN * 0.28 && scoreable) {
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

  function onLongStraight(s) {
    var i;
    for (i = 0; i < PATH.length; i++) {
      var seg = PATH[i];
      if (!seg || seg.startS == null) continue;
      if (s >= seg.startS - 0.2 && s <= seg.startS + seg.len + 0.2) {
        return seg.type === "line" && seg.len > 40;
      }
    }
    return false;
  }

  function pathSegAt(s) {
    var i;
    for (i = 0; i < PATH.length; i++) {
      var seg = PATH[i];
      if (!seg || seg.startS == null) continue;
      if (s >= seg.startS - 0.2 && s <= seg.startS + seg.len + 0.2) return seg;
    }
    return null;
  }

  function inChicaneS(info) {
    // Geometry only: the S, not the approach slab or the 88 before it.
    // Never a steer lock. Custom C tiles are a polyline S (no tight arcs).
    if (!info || info.grass || cornerKind(info.name) !== "chicane") return false;
    if (onLongStraight(info.s)) return false;
    var seg = pathSegAt(info.s);
    if (seg && seg.type === "line" && seg.len > 40) return false;
    return true;
  }

  function kerbDepthAt(info) {
    if (!info || !info.kerb) return 0;
    return clamp((info.dist - (ASPHALT - 0.2)) / 1.1, 0, 1);
  }

  function sampleWheelKerbs(r) {
    var spots = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    var count = 0;
    var depth = 0;
    var wi;
    for (wi = 0; wi < spots.length; wi++) {
      var w = wheelWorld(r, spots[wi][0], spots[wi][1]);
      var winfo = projectTrack(w.x, w.z);
      if (winfo.kerb) {
        count += 1;
        var d = kerbDepthAt(winfo);
        if (d > depth) depth = d;
      }
    }
    return { count: count, depth: depth };
  }

  function applyMotion(r, steer, throttle, brake, reverse, dt, isPlayer) {
    if (!isFinite(r.speed)) r.speed = 0;
    if (!isFinite(r.slide)) r.slide = 0;
    var info = projectTrackNear(r.x, r.z, r.s);
    var wheelKerb = sampleWheelKerbs(r);
    var onKerb = info.kerb || wheelKerb.count > 0;
    var kerbDepth = wheelKerb.depth;
    if (!kerbDepth && info.kerb) kerbDepth = kerbDepthAt(info);
    var surface = info.grass ? 0.5 : onKerb ? 0.9 : 1;
    var tire = clamp(r.tires / 100, 0, 1);
    // Tires = sloppy handling on asphalt, never a speed cap. Grass keeps
    // enough steer to crawl back to the pit even when the rears are gone.
    var tireFeel = info.grass ? 0.85 : 0.38 + 0.62 * tire;
    var empty = r.fuel <= 0;
    var maxV = empty ? LIMP_SPEED : SPEED_LIMIT;
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
      var burn = RACE.burn > 0 ? RACE.burn : 1;
      r.fuel -= IDLE_FUEL * burn * dt;
      if (throttle && !empty && r.speed >= 0) r.fuel -= THROTTLE_FUEL * burn * dt;
      if (r.fuel < 0) r.fuel = 0;
    }

    // Steer is dead at 0. Throttle is not. A stuck Space after a stop
    // used to win this if/else and weld W/S until reload.
    var parked = Math.abs(r.speed) <= 0.35;
    if (parked && (throttle || reverse)) r.unweld = true;
    if (!throttle && !reverse) r.unweld = false;
    if (Math.abs(r.speed) > 16) r.unweld = false;
    if ((throttle || reverse) && (parked || r.unweld)) {
      r.brakeHold = 0;
      if (throttle) r.speed += accel * dt;
      else r.speed -= REVERSE_ACCEL * dt;
    } else if (brake) {
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
      // Crawl-forward lock must not eat reverse or a brake — that's how
      // bots pin a barrier and never find the ribbon again.
      if (!reverse && !brake && r.speed > 0 && r.speed < GRASS_ROLL) r.speed = GRASS_ROLL;
      if (r.speed > 0) r.tires -= 6.2 * dt;
    } else if (r.speed >= 0) {
      r.speed = clamp(r.speed, 0, maxV);
    } else {
      r.speed = clamp(r.speed, -REVERSE_MAX, 0);
    }

    var speed01 = Math.abs(r.speed) / MAX_SPEED;
    // Rolling to turn. Parked A/D is dead. Bite as you roll, then
    // wash out — max W cannot snap a 90. Reverse uses |speed|.
    var roll = Math.abs(r.speed);
    var bite = roll < 0.35 ? 0 : clamp(roll / 9, 0.5, 1);
    var wash = 1 - 0.7 * speed01;
    var yawFromSpeed = bite * wash;
    var maxYaw = STEER_RATE * yawFromSpeed * tireFeel * surface;
    var latDemand = Math.abs(steer) * Math.abs(r.speed) * 0.155;
    var maxLat = MAX_LAT * tireFeel * surface;
    if (!info.grass && (info.name === "hairpin" || info.name === "source" || info.name === "t1") && r.speed > 17) {
      var hpOver = (r.speed - 17) / 14;
      r.slide += (steer !== 0 ? steer : 1) * hpOver * 22 * dt;
      if (hpOver > 0.3) r.tires -= 2.8 * dt * hpOver;
    }
    // The S never dumps or crushes A/D. Too fast is a mistimed line:
    // yaw rate cannot follow the kinks, so you run wide. Space is still
    // how you make time to turn. inChicaneS is identity, not a lock.
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
    // Dive wiggles, not a ramp. Slide/yaw chatter only — never a world-X
    // pitch hop (Euler XYZ made that tilt the wrong axis by heading).
    var bumpTarget = 0;
    if (onKerb && kerbDepth > 0) {
      var dive = Math.abs(r.speed) / 36;
      var wob = kerbDepth * dive;
      r.slide += Math.sin((raceTime + r.x * 0.05) * 28) * 14 * wob * dt;
      r.heading += Math.sin((raceTime + r.z * 0.04) * 17) * 0.7 * wob * dt;
      var wheelFrac = wheelKerb.count / 4;
      r.tires -= (1.2 + 2.4 * wheelFrac) * dt * speed01 * kerbDepth;
      bumpTarget = KERB_RAISE * kerbDepth * (0.25 + 0.35 * wheelFrac);
    }
    var bumpEase = 1 - Math.pow(0.08, dt);
    r.kerbBump = (r.kerbBump || 0) + (bumpTarget - (r.kerbBump || 0)) * bumpEase;

    r.heading += steer * maxYaw * dt * (r.speed < 0 ? -1 : 1);
    r.x += Math.cos(r.heading) * r.speed * dt;
    r.z += Math.sin(r.heading) * r.speed * dt;
    r.x += -Math.sin(r.heading) * r.slide * dt;
    r.z += Math.cos(r.heading) * r.slide * dt;
    r.slide *= Math.pow(0.07, dt);

    if (info.pitch && Math.abs(info.pitch) > 0.002 && Math.abs(r.speed) > 4) {
      r.speed -= info.pitch * 12 * dt;
    }
    var bump = r.kerbBump || 0;
    r.mesh.position.set(r.x, rideHeight() + (info.y || 0) + bump, r.z);
    r.mesh.rotation.set(0, -r.heading, 0);
    var wheels = r.mesh.userData.wheels;
    if (wheels) {
      var spin = r.speed * dt * 2.4;
      var turn = steerWheelYaw(steer);
      for (var i = 0; i < wheels.length; i++) {
        wheels[i].spinner.rotation.z -= spin;
        wheels[i].holder.rotation.y = wheels[i].front ? turn : 0;
      }
    }
  }

  function steerWheelYaw(steer) {
    // Pit Crew: A (+steer) = fronts POINT LEFT. D (-steer) = POINT RIGHT.
    // Car local +Z is left. Three.js +holder.rotation.y yaws toward -Z (right),
    // so the open fronts use -steer. Rolling spin stays with travel.
    return -steer * 0.42;
  }

  // ------------------------------------------------------------------
  //  Bot brain
  //
  //  Every number a bot uses is derived from ribbon geometry, so Campus,
  //  the five built-in circuits and any editor track get identical
  //  racecraft with no per-map scripts.
  //
  //    bakeRaceBrain   min-curvature line + forward/backward speed
  //                    profile, baked twice (fresh and worn tires)
  //    raceWantAhead   the one speed authority
  //    updateCpu       pursuit steer, committed brake zones, racecraft,
  //                    and a progress watchdog that cannot deadlock
  // ------------------------------------------------------------------

  // Fraction of the yaw limit a flawless bot runs at an apex.
  var AI_GRIP = 0.9;
  // How far off the centerline the racing line may swing. Measured: wider
  // than this and the entry transition becomes the tightest part of the
  // corner, which costs more apex speed than the extra radius buys.
  var RACE_MAX_OFF = 2.8;
  // applyMotion's tireFeel once the rears are down at TIRE_FLOOR.
  var WORN_FEEL = 0.38 + 0.62 * (TIRE_FLOOR / 100);

  // Personalities. No named-corner tables: apex speeds come out of the
  // ribbon geometry, so these are all *how* a driver races, which works
  // the same on Campus, a built-in circuit or an editor track.
  //
  //   pace    fraction of SPEED_LIMIT wound out on a straight
  //   grip    fraction of the yaw limit carried through an apex
  //   brake   brake bravery — above 1 leaves it later than the maths
  //   look    pursuit lookahead multiplier
  //   lineOff extra bias toward the inside kerb
  //   aggro   willingness to be in someone's mirrors
  //   defend  willingness to cover the lane
  //   draft   how much of a tow the driver takes
  //   wobble  mistake amplitude
  var AI_AGGRO = {
    // BowieKnife99. Fastest, bravest on the brakes, wants you gone.
    pace: 1,
    grip: 1,
    brake: 1.06,
    look: 1,
    lineOff: 0.58,
    aggro: 1,
    defend: 1,
    draft: 1,
    pitLap: 4,
    pitFuel: 30,
    pitTires: 25,
    launch: 0.92,
    wobble: 0,
    overshoot: 1,
    craft: 1,
    hunter: 1,
    reel: 1,
  };
  // Everyone else: real racecraft, no divebomb / ram.
  var AI_SMART = {
    // Library Kid — the best of the kids, quietly quick.
    pace: 0.99,
    grip: 0.985,
    brake: 1,
    look: 1.02,
    lineOff: 0.5,
    aggro: 0.5,
    defend: 0.7,
    draft: 0.9,
    pitLap: 4,
    pitFuel: 32,
    pitTires: 26,
    launch: 0.88,
    wobble: 0.02,
    overshoot: 1,
    craft: 1,
  };
  var AI_TIDY = {
    // Hall Monitor — clean, early on the brakes, hard to pass legally.
    pace: 0.985,
    grip: 0.975,
    brake: 0.97,
    look: 1.06,
    lineOff: 0.44,
    aggro: 0.25,
    defend: 0.85,
    draft: 0.7,
    pitLap: 4,
    pitFuel: 34,
    pitTires: 28,
    launch: 0.9,
    wobble: 0.01,
    overshoot: 1,
    craft: 1,
  };
  var AI_MESSY = {
    // Yearbook — quick hands, inconsistent lap to lap.
    pace: 0.975,
    grip: 0.96,
    brake: 0.99,
    look: 0.96,
    lineOff: 0.46,
    aggro: 0.6,
    defend: 0.5,
    draft: 0.7,
    pitLap: 4,
    pitFuel: 30,
    pitTires: 24,
    launch: 0.8,
    wobble: 0.07,
    overshoot: 1,
    craft: 1,
  };
  var AI_SHY = {
    // Sub Teacher — lifts early, leaves the door open.
    pace: 0.968,
    grip: 0.955,
    brake: 0.93,
    look: 1.12,
    lineOff: 0.34,
    aggro: 0.1,
    defend: 0.3,
    draft: 0.5,
    pitLap: 4,
    pitFuel: 36,
    pitTires: 32,
    launch: 0.78,
    wobble: 0.03,
    overshoot: 1,
    craft: 1,
  };
  var AI_BEAT = {
    // Band Kid — brave into the corner, scruffy on the way out.
    pace: 0.98,
    grip: 0.965,
    brake: 1.02,
    look: 0.98,
    lineOff: 0.4,
    aggro: 0.55,
    defend: 0.6,
    draft: 0.8,
    pitLap: 4,
    pitFuel: 31,
    pitTires: 26,
    launch: 0.84,
    wobble: 0.05,
    overshoot: 1,
    craft: 1,
  };
  var AI_LAB = {
    // Lab Partner — surgical line, timid with the throttle.
    pace: 0.982,
    grip: 0.99,
    brake: 0.96,
    look: 1.1,
    lineOff: 0.52,
    aggro: 0.3,
    defend: 0.5,
    draft: 0.6,
    pitLap: 4,
    pitFuel: 33,
    pitTires: 27,
    launch: 0.86,
    wobble: 0,
    overshoot: 1,
    craft: 1,
  };
  var AI_WILD = {
    // Detention — fast and unhinged. Will have it off eventually.
    pace: 0.995,
    grip: 0.962,
    brake: 1.05,
    look: 0.94,
    lineOff: 0.62,
    aggro: 0.9,
    defend: 0.9,
    draft: 1,
    pitLap: 4,
    pitFuel: 28,
    pitTires: 23,
    launch: 0.94,
    wobble: 0.08,
    overshoot: 1,
    craft: 1,
  };
  var AI_WIDE = {
    // Fallback for lobby / remote bot names. Runs a wide, safe line.
    pace: 0.972,
    grip: 0.965,
    brake: 0.95,
    look: 1.08,
    lineOff: 0.38,
    aggro: 0.35,
    defend: 0.55,
    draft: 0.6,
    pitLap: 4,
    pitFuel: 34,
    pitTires: 27,
    launch: 0.82,
    wobble: 0.04,
    overshoot: 1,
    craft: 1,
  };
  var _scan = {
    dHair: 999,
    dChi: 999,
    dTight: 999,
    tightR: 99,
    dBend: 999,
    bendR: 99,
    inside: 1,
  };

  function aiOf(r) {
    var name = (r && r.name) || "";
    if (name === "BowieKnife99") return AI_AGGRO;
    if (name === "Hall Monitor") return AI_TIDY;
    if (name === "Sub Teacher") return AI_SHY;
    if (name === "Library Kid") return AI_SMART;
    if (name === "Band Kid") return AI_BEAT;
    if (name === "Lab Partner") return AI_LAB;
    if (name === "Detention") return AI_WILD;
    if (name === "Yearbook") return AI_MESSY;
    // Lobby / remote bot names still get a driver, deterministically.
    var pool = [AI_SMART, AI_TIDY, AI_LAB, AI_BEAT, AI_WILD, AI_MESSY, AI_SHY, AI_WIDE];
    var h = 7;
    var i;
    for (i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 9973;
    return pool[h % pool.length];
  }

  // What is coming up. Read off the baked samples rather than walking
  // PATH 40 times a frame per bot, and used only for lookahead length,
  // which way the corner goes, and which side a pass belongs on — never
  // as a speed source.
  function scanAhead(s, meters) {
    ensureRaceBrain();
    _scan.dHair = 999;
    _scan.dChi = 999;
    _scan.dTight = 999;
    _scan.tightR = 99;
    _scan.dBend = 999;
    _scan.bendR = 99;
    _scan.inside = 0;
    if (RACE.n < 4 || !(TRACK_LEN > 8)) {
      _scan.inside = 1;
      return _scan;
    }
    var ds = RACE.ds;
    var base = Math.floor((((s % TRACK_LEN) + TRACK_LEN) % TRACK_LEN) / ds);
    var steps = Math.min(RACE.n - 1, Math.ceil(meters / ds));
    var k;
    for (k = 0; k <= steps; k++) {
      var i = (base + k) % RACE.n;
      var d = k * ds;
      var rad = RACE.r[i];
      var ck = cornerKind(RACE.name[i]);
      if (ck === "hairpin" && d < _scan.dHair) _scan.dHair = d;
      else if (ck === "chicane" && d < _scan.dChi) _scan.dChi = d;
      if (rad < 160) {
        if (!_scan.inside) _scan.inside = RACE.kap[i] >= 0 ? 1 : -1;
        if (d < _scan.dBend) {
          _scan.dBend = d;
          _scan.bendR = rad;
        }
      }
      if (rad < 28 && d < _scan.dTight) {
        _scan.dTight = d;
        _scan.tightR = rad;
      }
    }
    if (!_scan.inside) _scan.inside = 1;
    return _scan;
  }

  function tireFeelOf(tire01) {
    // Mirror of applyMotion's tireFeel on asphalt.
    return 0.38 + 0.62 * clamp(tire01, 0, 1);
  }

  function brakeDecelAt(v) {
    // What applyMotion really delivers with the brake pinned. The old
    // brain assumed BRAKE_DECEL * 0.62 and so lifted half a straight
    // early for every corner on every map.
    var v01 = clamp(Math.abs(v) / MAX_SPEED, 0, 1);
    return BRAKE_DECEL * (1.16 - 0.5 * v01);
  }

  function apexFromRadius(radius, tireFeel, margin) {
    // Solve v = radius * yaw(v) against applyMotion's own yaw model,
    //   yaw = STEER_RATE * (1 - 0.7 * v / MAX_SPEED) * tireFeel
    // so a corner speed is a fact about the car and the arc, not a
    // hand-tuned number that only fits one circuit.
    if (!(radius > 0)) return SPEED_LIMIT;
    if (!(tireFeel > 0)) tireFeel = 1;
    if (!(margin > 0)) margin = AI_GRIP;
    var k = STEER_RATE * tireFeel * margin;
    var v = (radius * k) / (1 + (0.7 * radius * k) / MAX_SPEED);
    if (v > SPEED_LIMIT) v = SPEED_LIMIT;
    if (v < 11) v = 11;
    return v;
  }

  function apexLimit(lineR, centerR, name, tireFeel) {
    var v = apexFromRadius(lineR, tireFeel, AI_GRIP);
    // applyMotion injects slide on hairpin-named arcs above 17, so a
    // tight 180 has to be slower than pure yaw allows. Scaled by radius
    // so a fat editor-tile hairpin still gets carried.
    if (cornerKind(name) === "hairpin") {
      var rad = centerR > 0 && centerR < 400 ? centerR : lineR;
      var hp = 17 + Math.max(0, rad - 12) * 0.35;
      if (v > hp) v = hp;
    }
    return v;
  }

  function eachRival(self, fn) {
    function one(o) {
      if (!o || o === self || !o.mesh || !o.mesh.visible || o.finished) return;
      fn(o);
    }
    one(player);
    if (!mpMode) {
      var ci;
      for (ci = 0; ci < cpus.length; ci++) one(cpus[ci]);
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
    // Two jobs: do not steer into the back of a car we are closing on,
    // and leave a car alongside some room. The old version did neither
    // properly — a flat 0.72 shove on anything within 11m, nothing at
    // all for a car level with the door.
    var fx = Math.cos(r.heading);
    var fz = Math.sin(r.heading);
    eachRival(r, function (o) {
      if (o.pitServicing) return;
      var rx = o.x - r.x;
      var rz = o.z - r.z;
      var fwd = rx * fx + rz * fz;
      var lat = -rx * fz + rz * fx;
      var away = lat >= 0 ? -1 : 1;
      if (Math.abs(lat) < 3.4 && fwd > 0.2 && fwd < 12 && (o.speed || 0) <= (r.speed || 0) + 1.5) {
        var urgency = clamp(1 - fwd / 12, 0.2, 1) * clamp(1 - Math.abs(lat) / 3.4, 0.25, 1);
        steer += away * 0.85 * urgency;
      } else if (Math.abs(lat) < 3.2 && fwd > -5 && fwd < 5) {
        // Door to door: hold your own half of the road.
        steer += away * 0.3 * clamp(1 - Math.abs(lat) / 3.2, 0, 1);
      }
    });
    return clamp(steer, -1, 1);
  }

  var _prey = { r: null, d: 999, fwd: 0, lat: 0 };
  var _hunt = {
    on: false,
    tx: 0,
    tz: 0,
    want: 0,
    noLift: false,
    dive: false,
    catchUp: false,
    block: false,
    pass: false,
    cover: 0,
    gap: 0,
    draft: false,
  };

  // Track-agnostic race brain (min-curvature line + forward/backward
  // speed profile + Pure Pursuit). Geometry only, no per-map scripts,
  // so Campus, the built-ins and editor tracks all bake the same way.
  var RACE = {
    n: 0,
    ds: 3,
    stamp: -1,
    pathN: -1,
    s: [],
    x: [],
    z: [],
    h: [],
    nx: [],
    nz: [],
    name: [],
    r: [],
    kap: [],
    off: [],
    geo: [],
    lkap: [],
    v: [],
    vLo: [],
    pitch: [],
    lapT: 0,
    burn: 1,
  };

  function aiWrap(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function raceDeltaS(s, apex) {
    var d = s - apex;
    if (TRACK_LEN > 4) {
      if (d > TRACK_LEN * 0.5) d -= TRACK_LEN;
      if (d < -TRACK_LEN * 0.5) d += TRACK_LEN;
    }
    return d;
  }

  function raceKey() {
    var k = TRACK_LEN + PATH.length * 0.001;
    var i;
    for (i = 0; i < PATH.length; i++) {
      var s = PATH[i];
      if (!s) continue;
      k += (s.r || 0) * (i + 1) * ((s.a1 || 0) >= (s.a0 || 0) ? 1 : -1);
      k += (s.len || 0) * 0.01;
      k += (s.ax || s.cx || 0) * 0.001 + (s.az || s.cz || 0) * 0.003;
    }
    return k;
  }

  function ensureRaceBrain() {
    var key = raceKey();
    if (RACE.stamp === key && RACE.n > 3) return;
    bakeRaceBrain();
  }

  function bakeRaceBrain() {
    RACE.stamp = raceKey();
    RACE.pathN = PATH.length;
    RACE.n = 0;
    if (!PATH.length || !(TRACK_LEN > 16)) return;
    var n = Math.max(32, Math.round(TRACK_LEN / 3));
    if (n > 900) n = 900;
    var ds = TRACK_LEN / n;
    RACE.ds = ds;
    RACE.n = n;
    var i;
    for (i = 0; i < n; i++) {
      var p = centerlinePoint(i * ds);
      RACE.s[i] = i * ds;
      RACE.x[i] = p.x;
      RACE.z[i] = p.z;
      RACE.h[i] = p.h;
      RACE.nx[i] = -Math.sin(p.h);
      RACE.nz[i] = Math.cos(p.h);
      RACE.name[i] = p.name;
      RACE.r[i] = p.r;
      RACE.pitch[i] = p.pitch || 0;
      var dh = aiWrap(centerlinePoint(i * ds + ds).h - centerlinePoint(i * ds - ds).h);
      var kap = dh / (2 * ds);
      if (p.r > 0 && p.r < 400) {
        var signed = (p.left || (kap >= 0 ? 1 : -1)) / p.r;
        kap = kap * 0.25 + signed * 0.75;
      }
      RACE.kap[i] = kap;
      RACE.off[i] = 0;
      RACE.geo[i] = 0;
      RACE.lkap[i] = kap;
      RACE.v[i] = SPEED_LIMIT;
      RACE.vLo[i] = SPEED_LIMIT;
    }

    var corners = [];
    i = 0;
    while (i < n) {
      if (Math.abs(RACE.kap[i]) > 1 / 180) {
        var sign = RACE.kap[i] >= 0 ? 1 : -1;
        var start = i;
        var peak = i;
        var peakK = Math.abs(RACE.kap[i]);
        while (i < n && Math.abs(RACE.kap[i]) > 1 / 180 && (RACE.kap[i] >= 0 ? 1 : -1) === sign) {
          if (Math.abs(RACE.kap[i]) > peakK) {
            peak = i;
            peakK = Math.abs(RACE.kap[i]);
          }
          i += 1;
        }
        corners.push({ i: peak, start: start, end: i - 1, sign: sign, k: peakK, r: 1 / peakK });
      } else {
        i += 1;
      }
    }
    if (corners.length > 1) {
      var first = corners[0];
      var last = corners[corners.length - 1];
      if (first.start === 0 && last.end === n - 1 && first.sign === last.sign) {
        if (last.k > first.k) first.i = last.i;
        first.k = Math.max(first.k, last.k);
        first.r = 1 / first.k;
        first.start = last.start;
        corners.pop();
      }
    }

    var maxOff = RACE_MAX_OFF;
    var wgt = [];
    for (i = 0; i < n; i++) wgt[i] = 0;
    var c;
    for (c = 0; c < corners.length; c++) {
      var cr = corners[c];
      var apexW = 1.0 + 0.04 * cr.r;
      if (apexW < 1.2) apexW = 1.2;
      if (apexW > maxOff) apexW = maxOff;
      var entry = 28 + 0.55 * cr.r;
      if (entry < 32) entry = 32;
      if (entry > 70) entry = 70;
      var exit = 24 + 0.45 * cr.r;
      if (exit < 28) exit = 28;
      if (exit > 62) exit = 62;
      var apexS = cr.i * ds;
      for (i = 0; i < n; i++) {
        var d = raceDeltaS(i * ds, apexS);
        if (d < -entry || d > exit) continue;
        var tgt;
        if (d <= 0) {
          var t = entry > 1 ? 1 + d / entry : 1;
          if (t < 0) t = 0;
          if (t > 1) t = 1;
          var e = t * t;
          tgt = (-apexW * 0.82 + (apexW + apexW * 0.82) * e) * cr.sign;
        } else {
          var u = exit > 1 ? d / exit : 1;
          if (u > 1) u = 1;
          tgt = (apexW + (-apexW * 0.7 - apexW) * u) * cr.sign;
        }
        var ww = cr.k * (d <= 0 ? 1.15 : 1);
        RACE.geo[i] += tgt * ww;
        wgt[i] += ww;
      }
    }
    for (i = 0; i < n; i++) {
      if (wgt[i] > 1e-6) RACE.geo[i] /= wgt[i];
      else RACE.geo[i] = 0;
      if (RACE.geo[i] > maxOff) RACE.geo[i] = maxOff;
      if (RACE.geo[i] < -maxOff) RACE.geo[i] = -maxOff;
      RACE.off[i] = RACE.geo[i];
    }

    var iter;
    var nxt = [];
    for (iter = 0; iter < 10; iter++) {
      for (i = 0; i < n; i++) {
        var im = (i - 1 + n) % n;
        var ip = (i + 1) % n;
        nxt[i] = RACE.off[i] * 0.58 + RACE.off[im] * 0.21 + RACE.off[ip] * 0.21;
      }
      for (i = 0; i < n; i++) RACE.off[i] = nxt[i];
    }
    for (i = 0; i < n; i++) {
      var mix = RACE.off[i] * 0.7 + RACE.geo[i] * 0.3;
      if (mix > maxOff) mix = maxOff;
      if (mix < -maxOff) mix = -maxOff;
      RACE.off[i] = mix;
    }

    for (i = 0; i < n; i++) {
      var ip2 = (i + 1) % n;
      var lx0 = RACE.x[i] + RACE.nx[i] * RACE.off[i];
      var lz0 = RACE.z[i] + RACE.nz[i] * RACE.off[i];
      var lx1 = RACE.x[ip2] + RACE.nx[ip2] * RACE.off[ip2];
      var lz1 = RACE.z[ip2] + RACE.nz[ip2] * RACE.off[ip2];
      RACE.h[i] = Math.atan2(lz1 - lz0, lx1 - lx0);
    }
    for (i = 0; i < n; i++) {
      var im2 = (i - 1 + n) % n;
      var ip3 = (i + 1) % n;
      RACE.lkap[i] = aiWrap(RACE.h[ip3] - RACE.h[im2]) / (2 * ds);
    }

    // Apex seeds from the curvature of the RACING LINE, not the
    // centerline — out-in-out has already widened every corner.
    for (i = 0; i < n; i++) {
      var rAbs = Math.abs(RACE.lkap[i]) > 1e-4 ? 1 / Math.abs(RACE.lkap[i]) : 9999;
      RACE.v[i] = apexLimit(rAbs, RACE.r[i], RACE.name[i], 1);
      RACE.vLo[i] = apexLimit(rAbs, RACE.r[i], RACE.name[i], WORN_FEEL);
    }
    profilePasses(RACE.v, n, ds);
    profilePasses(RACE.vLo, n, ds);

    var lapT = 0;
    for (i = 0; i < n; i++) lapT += ds / Math.max(4, RACE.v[i]);
    RACE.lapT = lapT;

    // A tank is really a time budget: most of the burn is per second, not
    // per throttle. The stock rate is tuned to Campus, where five laps
    // force exactly one box, and every longer board inherited a tank that
    // could not do the job — Harbor and Forest needed two stops, and a
    // custom loop with no pit tile stranded the whole field with laps to
    // run. Size the tank to the race the board actually asks for. Never
    // richen it, so Campus and the short loops keep their strategy.
    RACE.burn = 1;
    if (lapT > 1) {
      var race = lapT * LAPS;
      // With a pit road: a little over half the race, so one stop is
      // mandatory and a driver held up in traffic still only needs one.
      // Without one: the whole race, with room to spare.
      var budget = PIT_META.on ? race * 1.06 * 0.62 : race * 1.3;
      RACE.burn = Math.min(1, 100 / budget / (IDLE_FUEL + THROTTLE_FUEL));
    }
  }

  // What a lap of THIS track costs in fuel. Burn is per second, so it is
  // the profile lap time plus a margin for a driver who is not the
  // profile. Never derive it from the speed right now: read at a hairpin
  // that says the tank cannot reach the flag, and the car boxes every lap.
  function lapFuel() {
    ensureRaceBrain();
    var t = RACE.lapT > 1 ? RACE.lapT : Math.max(8, TRACK_LEN / 30);
    return (IDLE_FUEL + THROTTLE_FUEL) * (RACE.burn > 0 ? RACE.burn : 1) * t * 1.12;
  }

  // How much of this lap is still to come, measured from the scoring
  // line — not from s=0, which on the built-in circuits is most of a lap
  // adrift and had cars budgeting for a lap they were about to finish.
  function lapFrac(r) {
    if (!(TRACK_LEN > 8)) return 1;
    var d = r.s - lapOriginS();
    if (d < 0) d += TRACK_LEN;
    return clamp(1 - d / TRACK_LEN, 0, 1);
  }

  // Measured burn beats predicted burn. lapFuel assumes full throttle
  // for a whole profile lap, which reads ~15% high, and 15% is the
  // difference between one stop and two.
  function trackBurn(r) {
    if (r.burnLapN === r.lap) return;
    if (r.burnMark != null && r.burnLapN === r.lap - 1 && !r.burnRefuel) {
      var used = r.burnMark - r.fuel;
      if (used > 1) r.burnLap = r.burnLap > 1 ? r.burnLap * 0.45 + used * 0.55 : used;
    }
    r.burnLapN = r.lap;
    r.burnMark = r.fuel;
    r.burnRefuel = false;
  }

  function burnPerLap(r) {
    return r.burnLap > 1 ? r.burnLap : lapFuel();
  }

  // Forward/backward feasibility, run to convergence. Two fixed passes
  // at 5m samples could not carry a hairpin brake zone the 300m back up
  // the straight where it actually starts.
  function profilePasses(v, n, ds) {
    var pass;
    var i;
    for (pass = 0; pass < 12; pass++) {
      var moved = false;
      for (i = n - 1; i >= 0; i--) {
        var nxtI = (i + 1) % n;
        var aB = brakeDecelAt(v[i]) + RACE.pitch[i] * 12;
        if (aB < 2.2) aB = 2.2;
        var back = Math.sqrt(v[nxtI] * v[nxtI] + 2 * aB * ds);
        if (v[i] > back + 0.01) {
          v[i] = back;
          moved = true;
        }
      }
      for (i = 0; i < n; i++) {
        var prv = (i - 1 + n) % n;
        var aF = ACCEL - RACE.pitch[i] * 12;
        if (aF < 1.6) aF = 1.6;
        var fwd = Math.sqrt(v[prv] * v[prv] + 2 * aF * ds);
        if (v[i] > fwd + 0.01) {
          v[i] = fwd;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  function raceAt(s) {
    ensureRaceBrain();
    if (RACE.n < 4 || !(TRACK_LEN > 0)) return { off: 0, v: SPEED_LIMIT, kap: 0 };
    s = ((s % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
    var f = s / RACE.ds;
    var i0 = Math.floor(f) % RACE.n;
    if (i0 < 0) i0 += RACE.n;
    var i1 = (i0 + 1) % RACE.n;
    var t = f - Math.floor(f);
    return {
      off: RACE.off[i0] + (RACE.off[i1] - RACE.off[i0]) * t,
      v: RACE.v[i0] + (RACE.v[i1] - RACE.v[i0]) * t,
      kap: RACE.lkap[i0] + (RACE.lkap[i1] - RACE.lkap[i0]) * t,
    };
  }

  // Profile speed blended between the fresh and worn bakes, so a bot on
  // dead rubber slows down instead of asking for grip it hasn't got.
  function raceVAt(s, tire01) {
    ensureRaceBrain();
    if (RACE.n < 4 || !(TRACK_LEN > 0)) return SPEED_LIMIT;
    s = ((s % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
    var i = Math.floor(s / RACE.ds) % RACE.n;
    if (i < 0) i += RACE.n;
    var hi = RACE.v[i];
    if (tire01 == null) return hi;
    var lo = RACE.vLo[i];
    var f = (tireFeelOf(tire01) - WORN_FEEL) / (1 - WORN_FEEL);
    return lo + (hi - lo) * clamp(f, 0, 1);
  }

  // A driver's own ceiling. pace trims the straights, grip trims the
  // corners, and the blend keeps it smooth in between.
  function paceV(v, p) {
    var top = SPEED_LIMIT * ((p && p.pace) || 1);
    var g = (p && p.grip) || 1;
    if (g < 1) {
      var t = clamp(v / SPEED_LIMIT, 0, 1);
      v *= g + (1 - g) * t * t;
    }
    return v < top ? v : top;
  }

  // The one speed authority. At distance d from an apex the fastest a
  // car may legally be doing is sqrt(apex^2 + 2*a*d) — exact, so there
  // is nothing left to stack a second conservative guess on top of.
  function raceWantAhead(s, vNow, p, tire01) {
    ensureRaceBrain();
    var top = SPEED_LIMIT * ((p && p.pace) || 1);
    if (RACE.n < 4) return top;
    var brave = (p && p.brake) || 1;
    var v0 = vNow > 8 ? vNow : top;
    var aB = Math.max(2.2, brakeDecelAt(v0) * brave);
    var look = (v0 * v0) / (2 * aB) + 26;
    if (look < 55) look = 55;
    if (look > 460) look = 460;
    var ds = RACE.ds;
    var stride = Math.max(1, Math.round(7 / ds));
    var stepM = stride * ds;
    var steps = Math.min(64, Math.ceil(look / stepM));
    var want = top;
    var k;
    for (k = 0; k <= steps; k++) {
      var d = k * stepM;
      var apex = paceV(raceVAt(s + d, tire01), p);
      if (apex >= want) continue;
      var cap = k === 0 ? apex : Math.sqrt(apex * apex + 2 * aB * d);
      if (cap < want) want = cap;
    }
    return want;
  }

  function raceProg(r) {
    if (!r) return 0;
    var s = r.s;
    if (s == null || !isFinite(s)) {
      if (r.x != null && r.z != null && PATH.length) s = projectTrack(r.x, r.z).s;
      else return 0;
    }
    var lap = r.lap;
    if (lap == null || !isFinite(lap)) lap = 1;
    return (lap - 1) * TRACK_LEN + s;
  }

  function trackGap(from, to) {
    if (!from || !to || !(TRACK_LEN > 8)) return 0;
    var d = raceProg(to) - raceProg(from);
    if (Math.abs(d) > TRACK_LEN * 2.6) {
      var a = from.s;
      var b = to.s;
      if (a == null || !isFinite(a)) a = projectTrack(from.x, from.z).s;
      if (b == null || !isFinite(b)) b = projectTrack(to.x, to.z).s;
      d = b - a;
      if (d < -TRACK_LEN * 0.5) d += TRACK_LEN;
      if (d > TRACK_LEN * 0.5) d -= TRACK_LEN;
    }
    return d;
  }

  var PIT_MOUTH = { len: -1, pitN: -1, a0: null, s: -1 };

  // Where the pit road leaves the ribbon, in track arc length. With this
  // a bot can decide to box when the mouth is actually coming up, on any
  // track — the old code leaned on the Campus pit happening to sit just
  // past the start line, which no editor track guarantees.
  function pitMouthS() {
    var seg = PIT_PATH.length ? PIT_PATH[0] : null;
    var a0 = seg ? (seg.ax != null ? seg.ax : seg.cx) : null;
    if (PIT_MOUTH.len === TRACK_LEN && PIT_MOUTH.pitN === PIT_PATH.length && PIT_MOUTH.a0 === a0) return PIT_MOUTH.s;
    PIT_MOUTH.len = TRACK_LEN;
    PIT_MOUTH.pitN = PIT_PATH.length;
    PIT_MOUTH.a0 = a0;
    PIT_MOUTH.s = -1;
    if (PIT_META.on && seg) {
      var m = pointOnPitPath(0);
      if (m) {
        var pr = projectTrack(m.x, m.z);
        if (pr) PIT_MOUTH.s = pr.s;
      }
    }
    return PIT_MOUTH.s;
  }

  // Signed metres past the pit mouth: negative on the approach, positive
  // once committed. A single unsigned distance made bots abandon the peel
  // in the gap between the mouth and the pit pavement.
  function pitDelta(r) {
    var ms = pitMouthS();
    if (ms < 0 || !(TRACK_LEN > 8)) return -1e9;
    return raceDeltaS(r.s, ms);
  }

  var PIT_SIDE = { len: -1, n: -1, v: 1 };

  // Which side of the ribbon the pit road leaves on, as a normal-offset
  // sign. Editor boards put it wherever the author dropped the tile, so
  // this cannot be the hard-coded left the Campus pit happens to use.
  function pitSide() {
    if (PIT_SIDE.len === TRACK_LEN && PIT_SIDE.n === PIT_PATH.length) return PIT_SIDE.v;
    PIT_SIDE.len = TRACK_LEN;
    PIT_SIDE.n = PIT_PATH.length;
    PIT_SIDE.v = 1;
    var m0 = PIT_PATH.length ? pointOnPitPath(0) : null;
    var m1 = PIT_PATH.length ? pointOnPitPath(26) || pointOnPitPath(9) : null;
    if (m0 && m1) {
      var pr = projectTrack(m0.x, m0.z);
      if (pr) {
        var cp = centerlinePoint(pr.s);
        var d = (m1.x - cp.x) * -Math.sin(cp.h) + (m1.z - cp.z) * Math.cos(cp.h);
        if (d < 0) PIT_SIDE.v = -1;
      }
    }
    return PIT_SIDE.v;
  }

  function trackLeadGap(self, p) {
    var playerGap = 0;
    var best = 0;
    eachRival(self, function (o) {
      if (o.pitServicing) return;
      var g = trackGap(self, o);
      if (g <= 6 || g > TRACK_LEN * 2.8) return;
      if (o.kind === "player") playerGap = g;
      if (g > best) best = g;
    });
    // A hunter reels the player in by race progress, so a 200m lead
    // still counts and not just the cars he can see.
    if (p && (p.hunter || p.reel) && playerGap > 6) return playerGap;
    return best;
  }

  function catchBonus(p, gap) {
    // Small and capped: this is a driver leaning on it, not a rubber
    // band. Anyone already ahead gets nothing, so a leading Bowie
    // stops pushing and can be reeled back in himself.
    if (!(gap > 0)) return 0;
    var hunter = !!(p && (p.hunter || p.reel));
    var maxB = hunter ? 6.5 : 3.4;
    var perM = hunter ? 0.05 : 0.026;
    var base = hunter ? 1.4 : 0.7;
    var b = base + gap * perM;
    if (b > maxB) b = maxB;
    return b;
  }

  function faceDot(r, tx, tz) {
    var dx = tx - r.x;
    var dz = tz - r.z;
    var d = Math.hypot(dx, dz) || 1;
    return (Math.cos(r.heading) * dx + Math.sin(r.heading) * dz) / d;
  }

  // Coarse bucket grid over WALLS. Rebuilt whenever placeWalls swaps the
  // array out; noseBlocked used to scan 200+ segments per bot per frame.
  var WALL_GRID = { cell: 26, map: null, n: -1, first: null, near: [] };

  function wallGrid() {
    if (WALL_GRID.map && WALL_GRID.n === WALLS.length && WALL_GRID.first === WALLS[0]) return WALL_GRID;
    var cell = WALL_GRID.cell;
    var map = {};
    var i;
    for (i = 0; i < WALLS.length; i++) {
      var w = WALLS[i];
      var gx0 = Math.floor(Math.min(w.ax, w.bx) / cell);
      var gx1 = Math.floor(Math.max(w.ax, w.bx) / cell);
      var gz0 = Math.floor(Math.min(w.az, w.bz) / cell);
      var gz1 = Math.floor(Math.max(w.az, w.bz) / cell);
      var gx;
      var gz;
      for (gx = gx0; gx <= gx1; gx++) {
        for (gz = gz0; gz <= gz1; gz++) {
          var key = gx + "," + gz;
          if (!map[key]) map[key] = [];
          map[key].push(w);
        }
      }
    }
    WALL_GRID.map = map;
    WALL_GRID.n = WALLS.length;
    WALL_GRID.first = WALLS[0] || null;
    return WALL_GRID;
  }

  function wallsNear(x, z) {
    var g = wallGrid();
    var cell = g.cell;
    var out = g.near;
    out.length = 0;
    var gx = Math.floor(x / cell);
    var gz = Math.floor(z / cell);
    var dx;
    var dz;
    for (dx = -1; dx <= 1; dx++) {
      for (dz = -1; dz <= 1; dz++) {
        var bucket = g.map[gx + dx + "," + (gz + dz)];
        if (!bucket) continue;
        var i;
        for (i = 0; i < bucket.length; i++) {
          if (out.indexOf(bucket[i]) === -1) out.push(bucket[i]);
        }
      }
    }
    return out;
  }

  function noseBlocked(r) {
    var now = projectTrack(r.x, r.z);
    var hx = Math.cos(r.heading);
    var hz = Math.sin(r.heading);
    var look = now.dist > ASPHALT - 0.6 || now.grass ? 3.6 : 2.4;
    var ax = r.x + hx * look;
    var az = r.z + hz * look;
    var near = wallsNear(r.x, r.z);
    var i;
    for (i = 0; i < near.length; i++) {
      var w = near[i];
      var here = closestOnSeg(r.x, r.z, w.ax, w.az, w.bx, w.bz);
      var hereD = Math.sqrt(here.d2);
      var rad = 1.35 + (w.thick || 0.55) * 0.5;
      if (hereD > rad + 1.8) continue;
      // Only a wall we are driving INTO blocks us. Running alongside a
      // barrier used to pin bots in a permanent 6 u/s crawl.
      var toWallX = here.x - r.x;
      var toWallZ = here.z - r.z;
      var d = Math.hypot(toWallX, toWallZ) || 1;
      var closing = (toWallX / d) * hx + (toWallZ / d) * hz;
      if (closing > 0.5) return true;
    }
    if (now.dist <= ASPHALT - 0.5 && !now.grass) return false;
    var pr = projectTrack(ax, az);
    if (pr.grass && now.dist > ASPHALT - 0.2) return true;
    if (pr.dist > ASPHALT + RUNOFF + 0.4 && pr.dist > now.dist + 1.2) return true;
    return false;
  }

  function recoverSteer(r, tx, tz, reverse) {
    var desired = Math.atan2(tz - r.z, tx - r.x);
    var travel = reverse ? r.heading + Math.PI : r.heading;
    var err = Math.atan2(Math.sin(desired - travel), Math.cos(desired - travel));
    return clamp(err * 2.15, -1, 1);
  }

  function pickPrey(hunter, huntBias) {
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
      if (d < 0.7) return;
      var isPlayer = o.kind === "player";
      // A hunter never loses the player. Everyone else only races what
      // is in their mirrors.
      if (d > 96 && !(huntBias && isPlayer)) return;
      var fwd = rx * fx + rz * fz;
      var lat = -rx * fz + rz * fx;
      var score = d;
      if (fwd < -8) score += 24;
      if (fwd < 2.2 && fwd > -20 && d < 24) score -= 15;
      if (huntBias && isPlayer) {
        score -= 30;
        // Lead on the player: defend the pass before hunting anyone else.
        if (fwd < 2.2 && fwd > -22 && d < 26) score -= 40;
      }
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

  // Do not drive into the car in front. This is the term the old brain
  // was missing entirely: it steered around traffic but never lifted
  // for it, so a full field turned into a demolition derby.
  function followLimit(r, p, want, passing) {
    var fx = Math.cos(r.heading);
    var fz = Math.sin(r.heading);
    var floor = p && p.hunter ? 0.6 : 2.2;
    var lim = want;
    eachRival(r, function (o) {
      if (o.pitServicing) return;
      var rx = o.x - r.x;
      var rz = o.z - r.z;
      var fwd = rx * fx + rz * fz;
      if (fwd <= 0) return;
      var lat = -rx * fz + rz * fx;
      // Off to one side is a car we are going around, not one in the way.
      if (Math.abs(lat) > 2.6) return;
      var gap = fwd - MESH_NOSE - MESH_TAIL;
      if (gap > 26) return;
      var theirs = Math.max(0, o.speed || 0);
      var close = theirs + Math.max(0, gap - floor) * (passing ? 1.35 : 0.95);
      if (close < lim) lim = close;
    });
    return lim;
  }

  function laneClear(r, side) {
    // Is there room to move that way, or is someone already there?
    var fx = Math.cos(r.heading);
    var fz = Math.sin(r.heading);
    var clear = true;
    eachRival(r, function (o) {
      if (!clear || o.pitServicing) return;
      var rx = o.x - r.x;
      var rz = o.z - r.z;
      var fwd = rx * fx + rz * fz;
      if (fwd < -6 || fwd > 22) return;
      var lat = -rx * fz + rz * fx;
      if (lat * side > 0.8 && Math.abs(lat) < 5.2) clear = false;
    });
    return clear;
  }

  function passSide(r, prey) {
    // Commit to a side and stay there. Re-deciding every frame is how
    // a bot ends up dithering behind a car it is quicker than.
    var held = r.aiPassSide || 0;
    if (held && (r.aiCommit || 0) > 0) return held;
    var inside = _scan.inside || 0;
    var side;
    if (_scan.dTight < 58 && inside) side = prey.lat * inside <= 0.7 ? inside : -inside;
    else if (Math.abs(prey.lat) > 0.35) side = prey.lat >= 0 ? -1 : 1;
    else side = inside || -1;
    r.aiPassSide = side;
    r.aiCommit = 1.2;
    return side;
  }

  function planHunt(r, p, want) {
    _hunt.on = false;
    _hunt.noLift = false;
    _hunt.dive = false;
    _hunt.catchUp = false;
    _hunt.block = false;
    _hunt.pass = false;
    _hunt.draft = false;
    _hunt.cover = 0;
    _hunt.gap = 0;
    _hunt.want = want;
    var prey = pickPrey(r, p.hunter);
    var gap = trackLeadGap(r, p);
    var aggro = p.aggro == null ? 0.5 : p.aggro;
    _hunt.gap = gap;
    if (prey.r && prey.fwd < 2.2 && prey.d < 26) {
      // Ahead of them / door-to-door. Cover the lane once, then get on
      // with racing — aiming at their XY yaws 180 and rams.
      var mayDefend = (p.defend || 0) > 0.2 && (r.aiDefendT || 0) <= 0;
      if (mayDefend) {
        _hunt.block = true;
        var cover = prey.lat * (0.55 + 0.45 * (p.defend || 0));
        if (Math.abs(cover) < 0.4) cover = 0;
        _hunt.cover = clamp(cover, -2.8, 2.8);
      }
      _hunt.want = Math.min(SPEED_LIMIT, Math.max(want, (prey.r.speed || 0) + 2));
      return _hunt;
    }
    // The dive is reserved for the player. Against the rest of the field
    // Bowie is simply the fastest, hardest driver on the grid.
    if (p.hunter && prey.r && prey.r.kind === "player" && prey.d <= 16) {
      var lead = prey.d * 0.14;
      if (lead > 3.2) lead = 3.2;
      if (lead < 0.45) lead = 0.45;
      _hunt.tx = prey.r.x + Math.cos(prey.r.heading) * lead;
      _hunt.tz = prey.r.z + Math.sin(prey.r.heading) * lead;
      var close = Math.min(SPEED_LIMIT, (prey.r.speed || 0) + 10);
      if (close < want) close = want;
      _hunt.want = close;
      _hunt.on = true;
      if (prey.fwd > 2.2 && prey.fwd < 18 && Math.abs(prey.lat) < 4.6) {
        _hunt.tx = prey.r.x;
        _hunt.tz = prey.r.z;
        _hunt.noLift = true;
        _hunt.want = SPEED_LIMIT;
      }
      return _hunt;
    }
    if (prey.r && prey.fwd > 2.2 && prey.d <= 26 && !(_scan.dTight < 20 && _scan.tightR < 18)) {
      // Sit in the tow first, then take the lane. The draft is what
      // turns a train into an actual overtake.
      if (prey.fwd > 6 && Math.abs(prey.lat) < 3.2) {
        _hunt.draft = true;
        _hunt.want = Math.min(SPEED_LIMIT, want + 4.2 * (p.draft == null ? 0.7 : p.draft));
      }
      // Only pull out if the lane is actually free and we are quick
      // enough to use it. Two bots diving for one gap is a crash.
      if (prey.fwd <= 22 && aggro > 0.15) {
        var side = passSide(r, prey);
        if (laneClear(r, side)) {
          _hunt.pass = true;
          _hunt.cover = side * 3.1;
          _hunt.want = Math.min(SPEED_LIMIT, Math.max(_hunt.want, (prey.r.speed || 0) + 6));
        } else {
          r.aiPassSide = 0;
          r.aiCommit = 0;
        }
      }
    }
    if (gap > 12) {
      _hunt.catchUp = true;
      var bonus = catchBonus(p, gap);
      var reelWant = Math.min(SPEED_LIMIT, want + bonus);
      if (reelWant > _hunt.want) _hunt.want = reelWant;
    }
    return _hunt;
  }

  function updateCpu(r, dt) {
    if (r.finished) {
      coolDown(r, dt);
      return;
    }
    var p = aiOf(r);
    if (!r.launchArmed) applyCpuLaunch(r, p);
    var proj = projectTrackNear(r.x, r.z, r.s);
    r.s = proj.s;

    if (r.pitServicing) {
      r.speed = 0;
      r.slide = 0;
      r.pitTimer += dt;
      if (r.pitTimer >= PIT_HOLD) {
        r.fuel = 100;
        r.tires = 100;
        r.burnRefuel = true;
        r.didPit = true;
        r.wantPit = false;
        r.pitServicing = false;
        r.pitUsedVisit = true;
        r.pitTimer = 0;
        r.pitExitT = 1.4;
      }
      poseCar(r);
      return;
    }
    if (inPitLane(r) || inPitGrab(r) || r.pitServicing) {
      r.pitAwayT = 0;
    } else {
      r.pitAwayT = (r.pitAwayT || 0) + dt;
      if (r.pitAwayT >= 0.48) {
        r.pitTimer = 0;
        r.pitUsedVisit = false;
      }
    }
    if (!r.pitServicing && !r.pitUsedVisit && inPitGrab(r)) {
      r.pitServicing = true;
      r.speed = 0;
      r.slide = 0;
      poseCar(r);
      return;
    }
    trackBurn(r);
    if (PIT_META.on) {
      var bookD = pitDelta(r);
      if (!r.wantPit && bookD > -300 && bookD < 20) {
        // The mouth is the only place a stop can be taken, so the whole
        // decision is: can this tank still reach the flag, and if not,
        // is this the last mouth it can still reach? Boxing any earlier
        // throws away range and costs a stop nobody needed.
        var per = burnPerLap(r);
        var lapsLeft = LAPS - r.lap + lapFrac(r);
        // Running the tank dry inside the last lap costs a few seconds of
        // limp; a stop costs ten. So carry a reserve while the flag is
        // still laps away and spend it on the run to the line.
        var canFinish = r.fuel >= per * lapsLeft * (lapsLeft > 1.2 ? 1.06 : 0.99);
        var lastChance = r.fuel < per * 1.15;
        if ((!canFinish && lastChance) || r.tires < p.pitTires) r.wantPit = true;
      }
      // Missed the peel. Give the plan up and take it next time round
      // rather than spending the rest of the race at pit-lane pace with
      // an entry that is already behind the car.
      if (r.wantPit && !r.pitServicing && bookD > 170) r.wantPit = false;
    }

    ensureRaceBrain();
    var tire01 = clamp(r.tires / 100, 0, 1);
    var scan = scanAhead(r.s, 300);
    r.aiT = (r.aiT || 0) + dt;
    r.aiCommit = Math.max(0, (r.aiCommit || 0) - dt);
    r.aiDefendT = Math.max(0, (r.aiDefendT || 0) - dt);
    r.aiHitT = Math.max(0, (r.aiHitT || 0) - dt);

    // One speed authority: the baked profile, read through this
    // driver's pace and grip. No second or third opinion on top.
    var want = raceWantAhead(r.s, r.speed, p, tire01);
    if (r.aiHitT > 0 && !p.hunter) want = Math.min(want, r.speed * 0.94);
    if (r.fuel <= 0) want = Math.min(want, LIMP_SPEED);

    var lineHere = raceAt(r.s);
    var tight = scan.dTight < 60 || scan.dHair < 70 || (scan.dBend < 50 && scan.bendR < 60);
    var hunt = planHunt(r, p, want);
    if (hunt.block && !tight) r.aiDefendT = 2.6;
    if (p.hunter && hunt.on && !tight) {
      // Bowie leaves the brake later than his own maths says when the
      // player is in reach. Sometimes that means he runs deep.
      hunt.dive = true;
      hunt.noLift = true;
      hunt.want = Math.max(hunt.want, Math.min(SPEED_LIMIT, want + 5));
      want = hunt.want;
    }
    if (p.hunter && hunt.on && tight) {
      // Close enough to bash, still make the corner. A 22-into-a-180
      // is a free pass, not a move.
      hunt.noLift = false;
      hunt.want = Math.min(hunt.want, want);
      want = hunt.want;
    }
    if ((hunt.catchUp || hunt.draft) && !tight) want = Math.max(want, hunt.want);
    if ((hunt.block || hunt.pass) && !tight) want = Math.max(want, hunt.want);
    want = Math.min(want, SPEED_LIMIT);
    if (!hunt.noLift) want = followLimit(r, p, want, hunt.pass);

    // Pure Pursuit lookahead: long enough to be smooth on a straight,
    // short enough to actually turn in, and shortened again when the
    // car has been shoved off its line and needs to get back.
    var look = clamp((13 + r.speed * 0.42) * (p.look || 1), 10, 32);
    if (scan.dBend < 90 && scan.bendR < 90) look = Math.min(look, 10 + scan.dBend * 0.26);
    if (scan.dTight < 64) look = Math.min(look, 8 + scan.dTight * 0.2);
    if (scan.dChi < 40) look = Math.min(look, 13);
    var offErr = Math.abs(proj.dist - Math.abs(lineHere.off));
    if (offErr > 2.5) look = Math.min(look, 11 + Math.max(0, 26 - offErr));

    var target = centerlinePoint(r.s + look);
    var nx = -Math.sin(target.h);
    var nz = Math.cos(target.h);
    var inside = scan.inside || 1;
    var line = raceAt(r.s + look);
    var off = line.off + Math.abs(p.lineOff) * inside * 0.2;
    if (hunt.pass) off = hunt.cover;
    else if (hunt.block) {
      off = line.off + Math.abs(p.lineOff) * inside * 0.2;
      if (Math.abs(hunt.cover) > 0.45) off = clamp(off + hunt.cover * 0.62, -2.8, 2.4);
    }
    off = clamp(off, -(ASPHALT - 2.15), ASPHALT - 2.15);
    var tx = target.x + nx * off;
    var tz = target.z + nz * off;
    if (hunt.on) {
      tx = hunt.tx;
      tz = hunt.tz;
      want = hunt.want;
    }
    var peeling = false;
    var midHit = hunt.on && hunt.noLift && _prey.d < 8;
    var mouthD = pitDelta(r);
    if (r.wantPit && PIT_META.on && !midHit) {
      var onPitRoad = inPitLane(r);
      if (onPitRoad || (mouthD > -420 && mouthD < 130)) {
        peeling = true;
        var toMouth = Math.max(0, -mouthD - 6);
        var aBrk = Math.max(2.6, brakeDecelAt(r.speed));
        if (onPitRoad || mouthD > -15) {
          // Committed. Follow the pit road itself.
          var aim = pitPathAhead(r.x, r.z, 20);
          if (aim) {
            tx = aim.x;
            tz = aim.z;
          } else {
            var mouth = pointOnPitPath(0);
            tx = mouth ? mouth.x : (PIT_GRAB.x0 + PIT_GRAB.x1) * 0.5;
            tz = mouth ? mouth.z : (PIT_GRAB.z0 + PIT_GRAB.z1) * 0.5;
          }
          want = Math.min(want, PIT_ENTRY_V);
        } else {
          // Not committed yet, so stay on the ribbon and just slide across
          // to the pit side of it. Aiming at the pit road from 90m back
          // pointed the car at a spot beyond the mouth and it drove the
          // chord — straight over the grass on anything but a straight.
          var w = clamp((112 - toMouth) / 74, 0, 1);
          var edge = pitSide() * (ASPHALT - 2.4);
          var pOff = clamp(off + (edge - off) * w, -(ASPHALT - 2.15), ASPHALT - 2.15);
          var pTgt = centerlinePoint(r.s + Math.min(look, 18));
          tx = pTgt.x - Math.sin(pTgt.h) * pOff;
          tz = pTgt.z + Math.cos(pTgt.h) * pOff;
          // Brake for the mouth like it is a corner. The old window opened
          // 90m out and the mouth needs nearer 280 from flat out, so cars
          // arrived at 40 and speared straight through the pit road.
          want = Math.min(want, Math.sqrt(PIT_ENTRY_V * PIT_ENTRY_V + 2 * aBrk * toMouth));
        }
      }
    }
    if (inPitLane(r) && !r.pitServicing) {
      if (r.wantPit && !midHit) {
        peeling = true;
        tx = isDriveableLoop()
          ? (PIT_GRAB.x0 + PIT_GRAB.x1) * 0.5
          : clamp(r.x + 22, PIT_GRAB.x0 + 2, (PIT_GRAB.x0 + PIT_GRAB.x1) * 0.5);
        tz = (PIT_LANE.z0 + PIT_LANE.z1) * 0.5;
        want = Math.min(want, 16);
      } else if (!midHit) {
        if (isDriveableLoop()) {
          var out = centerlinePoint((r.s + 18) % TRACK_LEN);
          tx = out.x;
          tz = out.z;
        } else {
          var lookOut = pitPathAhead(r.x, r.z, 24);
          if (lookOut) {
            tx = lookOut.x;
            tz = lookOut.z;
          } else {
            tx = Math.min(r.x + 28, PIT_LANE.x1 + 24);
            tz = SF_Z + 2;
          }
        }
        want = Math.min(want, 20);
      }
    }

    // Pursuit error plus a curvature feed-forward, so the wheel is
    // already turned at the apex instead of chasing the error, minus a
    // slide term so a car that starts washing out catches itself.
    var desiredH = Math.atan2(tz - r.z, tx - r.x);
    var err = aiWrap(desiredH - r.heading);
    var yawNow =
      STEER_RATE *
      clamp(Math.abs(r.speed) / 9, 0.5, 1) *
      (1 - 0.7 * clamp(Math.abs(r.speed) / MAX_SPEED, 0, 1)) *
      tireFeelOf(tire01);
    var ff = 0;
    if (yawNow > 0.05 && !hunt.on && !peeling) {
      ff = clamp((r.speed * raceAt(r.s + look * 0.5).kap) / yawNow, -1, 1);
    }
    var steer = clamp(err * 1.75 + ff * 0.5 - (r.slide || 0) * 0.022, -1, 1);
    if (!inPitLane(r) && !inPitGrab(r) && (r.pitExitT || 0) > 0) {
      r.pitExitT -= dt;
      if (r.pitExitT < 0) r.pitExitT = 0;
    }

    // Watchdog. Measured on race progress, so a bot spinning on the
    // ribbon at speed counts as stuck exactly like one nosed into a
    // barrier — the old speed-based check let it circle forever.
    var inPit = peeling || inPitLane(r) || inPitGrab(r) || (r.pitExitT || 0) > 0;
    var blocked = !inPit && noseBlocked(r);
    var wayOff = !inPit && (proj.grass || proj.dist > ASPHALT + RUNOFF - 0.25);
    var wide = !inPit && proj.dist > ASPHALT + 0.45;
    var wrongWay = !inPit && Math.cos(aiWrap(r.heading - proj.h)) < -0.25;
    // Progress along the ribbon, wrapped, so crossing the line is not
    // mistaken for going backwards. raceProg() only steps on a scored
    // lap, which used to make the whole grid reset on lap one.
    var jam = jammedByTraffic(r);
    if (r.aiProgS == null || inPit) {
      r.aiProgS = r.s;
      r.aiStuckT = 0;
    } else if (raceDeltaS(r.s, r.aiProgS) > 3) {
      r.aiProgS = r.s;
      r.aiStuckT = 0;
    } else {
      // Sitting behind a stopped car is traffic, not being stuck. Count
      // it slowly so a real deadlock still escalates but a queue does
      // not send the whole field into reverse.
      r.aiStuckT = (r.aiStuckT || 0) + (jam ? dt * 0.35 : dt);
    }
    var stuckT = r.aiStuckT || 0;
    if (stuckT > 5.5) {
      // Last resort so a race can never be decided by a parked bot.
      resetOnLine(r);
      stuckT = 0;
    }
    var stuck = stuckT > 0.9;
    if (wide && !wayOff && !blocked && !stuck) want = Math.min(want, 22);
    var recover = !inPit && (wayOff || blocked || wrongWay || stuck);
    var keepHit = p.hunter && hunt.on && hunt.noLift && !proj.grass && proj.dist < ASPHALT - 0.5 && !blocked && !wrongWay;
    var reverse = false;
    if (recover && !peeling && !keepHit) {
      hunt.on = false;
      hunt.noLift = false;
      // Aim at the line a car length AHEAD, never at the projection
      // point: a spun bot told to drive at its own shadow turns circles.
      var back = centerlinePoint(r.s + 9);
      var backOff = raceAt(r.s + 9).off;
      tx = back.x - Math.sin(back.h) * backOff;
      tz = back.z + Math.cos(back.h) * backOff;
      want = wayOff ? 10 : 14;
      if (proj.dist > 10) want = 8;
      if (blocked) want = Math.min(want, 6);
      var mustRev = blocked || wrongWay || stuckT > 1.8;
      if (r.speed > 7 && mustRev) {
        // Too fast to select reverse — stop first, still steering back.
        steer = recoverSteer(r, tx, tz, false);
        applyMotion(r, steer, false, true, false, dt, false);
        updateLaps(r);
        return;
      }
      reverse = mustRev && (r.aiRevT || 0) < 1.6;
      if (reverse) r.aiRevT = (r.aiRevT || 0) + dt;
      else if (!mustRev) r.aiRevT = 0;
      steer = recoverSteer(r, tx, tz, reverse);
    } else {
      r.aiRevT = 0;
    }
    if (p.wobble && (r.aiT % 3.6) < 0.28 && !recover) {
      steer = clamp(steer + Math.sin(r.aiT * 9 + (r.s || 0)) * p.wobble, -1, 1);
    }
    if (!recover && !(p.hunter && hunt.on)) steer = avoidRams(r, steer);

    // Committed brake zones. applyMotion ramps brake bite over 0.2s, so
    // chattering the pedal is the slowest possible way to slow down.
    var over = r.speed - want;
    if (over > 0.8) r.aiBrake = 1;
    else if (over < -0.15) r.aiBrake = 0;
    var brake = !reverse && !!r.aiBrake && r.speed > 1;
    var throttle = !reverse && !brake && r.speed < want - 0.12;
    if (hunt.on && hunt.noLift && !recover) {
      throttle = !reverse;
      brake = false;
      r.aiBrake = 0;
    }
    if (reverse) {
      throttle = false;
      brake = false;
    }
    applyMotion(r, steer, throttle, brake, reverse, dt, false);
    updateLaps(r);
  }

  // A car that took the flag used to brake to a stop wherever it happened
  // to be and sit there, solid, for the rest of the race. On a board where
  // the leaders finish a lap up, whoever was still running rammed the same
  // parked car every lap — eight resets and 28s in reverse for one bot.
  // Do a slow-down lap on the far edge of the road, like a real one.
  function coolDown(r, dt) {
    var proj = projectTrackNear(r.x, r.z, r.s);
    r.s = proj.s;
    var tgt = centerlinePoint(r.s + 15);
    var edge = -pitSide() * (ASPHALT - 2.4);
    var tx = tgt.x - Math.sin(tgt.h) * edge;
    var tz = tgt.z + Math.cos(tgt.h) * edge;
    var err = aiWrap(Math.atan2(tz - r.z, tx - r.x) - r.heading);
    var steer = clamp(err * 1.75, -1, 1);
    applyMotion(r, steer, r.speed < 13.4, r.speed > 15.6, false, dt, false);
    poseCar(r);
  }

  function jammedByTraffic(r) {
    var jam = false;
    eachRival(r, function (o) {
      if (jam) return;
      if (Math.hypot(o.x - r.x, o.z - r.z) < 4.5) jam = true;
    });
    return jam;
  }

  function resetOnLine(r) {
    var p = centerlinePoint(r.s + 6);
    var off = raceAt(r.s + 6).off;
    r.x = p.x - Math.sin(p.h) * off;
    r.z = p.z + Math.cos(p.h) * off;
    r.heading = p.h;
    r.speed = 12;
    r.slide = 0;
    r.aiStuckT = 0;
    r.aiRevT = 0;
    r.aiProgS = r.s;
    r.aiResets = (r.aiResets || 0) + 1;
  }

  function hitCarFeel(r, vx, vz, nx, nz, impact) {
    // n points from the other car toward us.
    // Rear quarter yaws that way: tap = wiggle, ram = spin.
    // Front shoves. Wall graze stays a slide (hitKeepYaw).
    var c = Math.cos(r.heading);
    var s = Math.sin(r.heading);
    var fwd = c * nx + s * nz;
    var side = c * nz - s * nx;
    var dir = side >= 0 ? 1 : -1;
    // Bots lift briefly after contact so one shunt does not cascade
    // into a pile-up. The hunter ignores it.
    r.aiHitT = 0.45;
    var nose = clamp(-fwd, 0, 1);
    var tail = clamp(fwd, 0, 1);
    var hip = 1 - Math.abs(fwd);
    r.speed = vx * c + vz * s;
    r.slide = -vx * s + vz * c;
    if (tail > 0.25 && hip > 0.28) {
      if (impact < 8) {
        r.slide += dir * clamp(impact * 0.16, 0.35, 2.2);
        r.heading += dir * clamp(impact * 0.004, 0.006, 0.045);
        r.hitYawT = 0.08;
        return;
      }
      r.speed *= 0.68;
      r.heading += dir * clamp(impact * 0.028 * (0.45 + hip), 0.2, 0.85);
      r.slide += dir * clamp(impact * 0.28, 4, 14);
      r.hitYawT = 0.32;
      return;
    }
    if (nose > 0.5) {
      r.speed *= 0.78;
      r.slide += dir * clamp(impact * 0.08, 0, 2.2);
      r.heading += dir * clamp(impact * 0.002, 0, 0.03);
      r.hitYawT = 0.1;
      return;
    }
    if (impact > 15 && hip > 0.35) {
      r.speed *= 0.62;
      r.heading += dir * clamp(impact * 0.022, 0.18, 0.7);
      r.slide += dir * clamp(impact * 0.28, 4, 12);
      r.hitYawT = 0.32;
      return;
    }
    r.speed *= 0.85;
    r.slide += dir * clamp(impact * 0.1, 0, 2.8);
    r.heading += dir * clamp(impact * 0.005, 0, 0.05);
    r.hitYawT = 0.1;
  }

  function hitKeepYaw(r, vx, vz, nx, nz, impact) {
    var c = Math.cos(r.heading);
    var s = Math.sin(r.heading);
    var into = clamp(-(c * nx + s * nz), 0, 1);
    var side = c * nz - s * nx;
    var dir = side >= 0 ? 1 : -1;
    // A 90 graze used to rewrite heading from the bounce and stack a
    // 0.1 rad spin every frame you kissed the rail. That is a half-spin
    // on every custom corner. Chorded 90 joins look square (into is
    // high) while the car is still running along the rail — that locked
    // A/D. Along-the-wall = graze: slide, keep yaw. True head-on only.
    var along = Math.abs(c * -nz + s * nx);
    var square = into > 0.9 && impact > 14 && along < 0.42 && !(r.hitYawT > 0);
    if (square) {
      vx *= 0.57;
      vz *= 0.57;
      r.speed = vx * c + vz * s;
      r.slide = -vx * s + vz * c;
      r.heading += dir * clamp(impact * 0.016, 0.1, 0.36);
      r.slide += dir * clamp(impact * 0.2, 2.2, 8.5);
      r.hitYawT = 0.28;
    } else if (!(r.hitYawT > 0)) {
      r.speed *= 0.82;
      if (impact > 10) r.speed *= 0.88;
      r.slide += dir * clamp(impact * 0.12, 0, 3.2);
      r.heading += dir * clamp(impact * 0.004 * (1 - into), 0, 0.04);
      if (impact > 3) r.hitYawT = 0.12;
    }
  }

  function bashCars(a, b) {
    if (!a || !b) return;
    var hit = meshOverlap(a, b);
    if (!hit) return;
    var nx = hit.nx;
    var nz = hit.nz;
    var push = hit.depth * 0.5;
    if (push < 0.12) push = 0.12;
    a.x -= nx * push;
    a.z -= nz * push;
    b.x += nx * push;
    b.z += nz * push;

    var avx = Math.cos(a.heading) * a.speed + -Math.sin(a.heading) * a.slide;
    var avz = Math.sin(a.heading) * a.speed + Math.cos(a.heading) * a.slide;
    var bvx = Math.cos(b.heading) * b.speed + -Math.sin(b.heading) * b.slide;
    var bvz = Math.sin(b.heading) * b.speed + Math.cos(b.heading) * b.slide;
    var dx = b.x - a.x;
    var dz = b.z - a.z;
    var dlen = Math.hypot(dx, dz) || 1;
    dx /= dlen;
    dz /= dlen;
    var aSpd = Math.hypot(avx, avz);
    var bSpd = Math.hypot(bvx, bvz);
    var leadA = aSpd >= bSpd;
    var cx = leadA ? avx : bvx;
    var cz = leadA ? avz : bvz;
    var crashL = leadA ? aSpd : bSpd;
    if (crashL > 1.2) {
      cx /= crashL;
      cz /= crashL;
    } else {
      cx = dx;
      cz = dz;
    }
    var cand = [
      [nx, nz],
      [dx, dz],
      [cx, cz],
    ];
    var rel = -1;
    var cnx = nx;
    var cnz = nz;
    var ci;
    for (ci = 0; ci < cand.length; ci++) {
      var rx = cand[ci][0];
      var rz = cand[ci][1];
      var rl = Math.hypot(rx, rz) || 1;
      rx /= rl;
      rz /= rl;
      if (rx * dx + rz * dz < 0) {
        rx = -rx;
        rz = -rz;
      }
      var r = (avx - bvx) * rx + (avz - bvz) * rz;
      if (r > rel) {
        rel = r;
        cnx = rx;
        cnz = rz;
      }
    }
    if (rel > 0) {
      // Speed-weighted inelastic crash. Faster car keeps going; the
      // slower one is launched that way. Equal-mass j = rel*0.72 used
      // to bounce a max-speed ram backwards like a pinball.
      var ma = 0.7 + 0.95 * clamp(aSpd / MAX_SPEED, 0, 1);
      var mb = 0.7 + 0.95 * clamp(bSpd / MAX_SPEED, 0, 1);
      var jimp = (1.16 * rel) / (1 / ma + 1 / mb);
      avx -= (jimp / ma) * cnx;
      avz -= (jimp / ma) * cnz;
      bvx += (jimp / mb) * cnx;
      bvz += (jimp / mb) * cnz;
      if (crashL > 12 && Math.abs(aSpd - bSpd) > 4.5) {
        var alongFast = leadA ? avx * cx + avz * cz : bvx * cx + bvz * cz;
        var alongSlow = leadA ? bvx * cx + bvz * cz : avx * cx + avz * cz;
        var floor = crashL * 0.28;
        if (alongFast < floor) {
          var add = floor - alongFast;
          avx += cx * add;
          avz += cz * add;
          bvx += cx * add;
          bvz += cz * add;
          alongFast = floor;
          alongSlow += add;
        }
        var wantSlow = Math.max(alongFast * 0.7, crashL * 0.42);
        if (alongSlow < wantSlow) {
          var kick = (wantSlow - alongSlow) * 0.85;
          if (leadA) {
            bvx += cx * kick;
            bvz += cz * kick;
          } else {
            avx += cx * kick;
            avz += cz * kick;
          }
        }
      }
    }
    var pace = Math.max(Math.abs(a.speed), Math.abs(b.speed), Math.hypot(avx, avz), Math.hypot(bvx, bvz));
    var impact = Math.max(rel, 0, pace * 0.34, 2.6);
    hitCarFeel(a, avx, avz, -cnx, -cnz, impact);
    hitCarFeel(b, bvx, bvz, cnx, cnz, impact);
    poseCar(a);
    poseCar(b);
    if (impact > 4 && !(a.hitFxT > 0) && !(b.hitFxT > 0)) {
      a.hitFxT = 0.16;
      b.hitFxT = 0.16;
      puffHit((a.x + b.x) * 0.5, (a.z + b.z) * 0.5, nx, nz);
    }
  }

  function bashOtherCars() {
    var id;
    for (id in hostBots) {
      if (Object.prototype.hasOwnProperty.call(hostBots, id)) bashCars(player, hostBots[id]);
    }
    for (id in remotes) {
      if (!Object.prototype.hasOwnProperty.call(remotes, id)) continue;
      if (hostBots[id]) continue;
      bashCars(player, remotes[id].r);
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
    hitKeepYaw(r, vx, vz, nx, nz, impact);
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
    if (r.hitYawT > 0) r.hitYawT -= 0.016;
    // Joins and chorded 90s overlap 2–4 capsules. Hitting every one
    // restacks graze dumps into a freeze. One collider per frame.
    var nearI = -1;
    var nearD = 1e9;
    var i;
    for (i = 0; i < WALLS.length; i++) {
      var w = WALLS[i];
      var rad = 1.35 + (w.thick || 0.55) * 0.5;
      var d = Math.sqrt(closestOnSeg(r.x, r.z, w.ax, w.az, w.bx, w.bz).d2);
      if (d < rad && d < nearD) {
        nearD = d;
        nearI = i;
      }
    }
    if (nearI < 0) return 0;
    return bashWall(r, WALLS[nearI]);
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
    r.mesh.position.set(r.x, rideHeight(r.x, r.z), r.z);
    r.mesh.rotation.set(0, -r.heading, 0);
    r.mesh.rotation.x = 0;
    r.mesh.rotation.z = 0;
  }

  function noteDriveKey(e, down) {
    // Capture-phase. Chromebooks sometimes omit e.code or deliver W only
    // to a focused share box. Steer is dead at 0; W/S must still land.
    var c = e.code || "";
    var k = e.key || "";
    var letter = k.length === 1 ? k.toLowerCase() : "";
    if (c) keys[c] = down;
    if (c === "KeyW" || letter === "w" || c === "ArrowUp") drive.up = down;
    if (c === "KeyS" || letter === "s" || c === "ArrowDown") drive.down = down;
    if (c === "KeyA" || letter === "a" || c === "ArrowLeft") drive.left = down;
    if (c === "KeyD" || letter === "d" || c === "ArrowRight") drive.right = down;
    if (c === "Space" || k === " " || k === "Spacebar") {
      drive.space = down;
      if (!down) spaceBrakeArmed = true;
    }
  }

  function playerInput() {
    if (menuOpen || worldFrozen() || portraitRaceBlock()) {
      return { steer: 0, throttle: false, reverse: false, brake: false };
    }
    var up = !!(drive.up || keys.ArrowUp || keys.KeyW);
    var down = !!(drive.down || keys.ArrowDown || keys.KeyS);
    var left = !!(drive.left || keys.ArrowLeft || keys.KeyA);
    var right = !!(drive.right || keys.ArrowRight || keys.KeyD);
    var steer = 0;
    if (left) steer += 1;
    if (right) steer -= 1;
    var wantBrake = !!(drive.space || keys.Space || touchCtl.brake);
    if (Math.abs(player.speed) <= 0.35) spaceBrakeArmed = false;
    var brake = !!(wantBrake && spaceBrakeArmed && Math.abs(player.speed) > 0.35);
    if (!isPhoneLike()) {
      return {
        steer: steer,
        throttle: !!up,
        reverse: !!down,
        brake: brake,
      };
    }
    var keySteer = !!(left || right);
    return {
      steer: keySteer ? steer : touchCtl.steer || 0,
      throttle: !!(up || touchCtl.gas),
      reverse: !!(down || touchCtl.rev),
      brake: brake,
    };
  }

  function worldFrozen() {
    if (mpMode) return !!(net && net.paused);
    return menuOpen && (state === "start" || state === "racing");
  }

  function canOpenMenu() {
    return state === "start" || state === "racing";
  }

  function closePauseMenu() {
    menuOpen = false;
    if (hud.pause) hud.pause.classList.add("hidden");
  }

  function openPauseMenu() {
    if (!canOpenMenu()) return;
    menuOpen = true;
    keys = Object.create(null);
    drive.up = drive.down = drive.left = drive.right = drive.space = false;
    spaceBrakeArmed = true;
    clearTouchDrive();
    setRevSound(false);
    paintPauseMenu();
    if (hud.pause) hud.pause.classList.remove("hidden");
  }

  function togglePauseMenu() {
    if (!canOpenMenu()) return;
    if (menuOpen) closePauseMenu();
    else openPauseMenu();
  }

  function resumeFromMenu() {
    if (mpMode && net && net.isHost() && net.paused && net.pause) net.pause(false);
    closePauseMenu();
  }

  function leaveRace() {
    closePauseMenu();
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
  }

  function hostPaused() {
    return !!(mpMode && net && net.paused);
  }

  function paintPauseMenu() {
    if (!hud.pause) return;
    var frozen = worldFrozen();
    var host = !!(mpMode && net && net.isHost());
    var spec = menuTrackLabel();
    if (hud.pauseEyebrow) {
      hud.pauseEyebrow.textContent = mpMode ? (net && net.room ? "Room " + net.room : "Room") : "Solo";
    }
    if (hud.pauseTitle) hud.pauseTitle.textContent = frozen ? "PAUSED" : "MENU";
    if (hud.pauseStatus) {
      if (!mpMode) hud.pauseStatus.textContent = spec + " · 5 laps";
      else if (frozen) hud.pauseStatus.textContent = "Host paused the race";
      else if (host) hud.pauseStatus.textContent = spec + " · you are host";
      else hud.pauseStatus.textContent = spec + " · race still going";
      if (mpMode && net && cleanTrack(net.track || "") !== trackCode) {
        hud.pauseStatus.textContent += " · next map queued";
      }
    }
    if (hud.pauseHost) hud.pauseHost.classList.toggle("hidden", !host);
    if (hud.pauseAllBtn) {
      hud.pauseAllBtn.textContent = frozen ? "Resume everyone" : "Pause everyone";
    }
    var resume = document.getElementById("btn-resume");
    if (resume) {
      if (!mpMode) resume.textContent = "Resume";
      else if (host && frozen) resume.textContent = "Resume everyone";
      else resume.textContent = "Back to race";
    }
    if (hud.pauseHint) {
      hud.pauseHint.textContent = mpMode && !host && frozen
        ? "Wait for the host, or Leave"
        : "Esc or P · menu";
    }
    if (hud.pauseErr) hud.pauseErr.textContent = (net && net.err) || "";
    if (hud.pauseRoster) hud.pauseRoster.classList.toggle("hidden", !mpMode);
    var liveRace = state === "start" || state === "racing";
    var addBotBtn = document.getElementById("btn-pause-add-bot");
    var removeBotBtn = document.getElementById("btn-pause-remove-bot");
    if (addBotBtn) addBotBtn.disabled = liveRace;
    if (removeBotBtn) removeBotBtn.disabled = liveRace;
    paintCircuitPicks();
    paintRoster();
  }

  function setScreen(which) {
    if (which !== "start" && which !== "racing") closePauseMenu();
    hud.title.classList.toggle("hidden", which !== "title");
    if (hud.lobby) hud.lobby.classList.toggle("hidden", which !== "lobby");
    if (hud.trackScreen) hud.trackScreen.classList.toggle("hidden", which !== "track");
    hud.countdown.classList.toggle("hidden", which !== "start");
    hud.finish.classList.toggle("hidden", which !== "finish");
    hud.root.classList.toggle("hidden", which === "title" || which === "lobby" || which === "track");
    hud.revWrap.classList.toggle("hidden", which !== "start");
    if (which === "title" || which === "track") refreshMenuTrackLabel();
    if (which === "track") scheduleTrackLayout();
    if (which === "start" || which === "racing") {
      releaseTypeFocus();
      lockLandscape();
    } else unlockOrientation();
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

  function applyLaunch() {
    launchMul = 1;
    launchT = GETAWAY_T;
    launchCall = gradeLaunch(revs);
    // Lights-out never uses the 180 dump-hole spin. Past the mark is
    // a SLUGGISH getaway on asphalt (~1.5s), then full pace.
    if (launchCall === "DUMP") launchCall = "SLUGGISH";
    if (launchCall === "GREAT") launchMul = 1.2;
    else if (launchCall === "GOOD") launchMul = 1.08;
    else launchMul = 0.55;
    launchCallT = 2;
    // Campus GO faces race. Leftover peel yaw + W-only crawls into
    // the pit mouth at ~8s / 16 kph and painted PIT LANE.
    if (!isDriveableLoop()) {
      player.heading = slotHeading({ h: gridHeading });
      player.slide = 0;
    }
    launchPuffs(player);
  }

  function applyCpuLaunch(r, p) {
    r.launchArmed = true;
    r.launchT = GETAWAY_T;
    var roll = Math.random();
    var kind;
    if (p && (p.hunter || p.craft)) {
      if (roll < 0.05) kind = "DUMP";
      else if (roll < 0.1) kind = "SLUGGISH";
      else if (roll < 0.45) kind = "GOOD";
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
    if (kind === "DUMP") kind = "SLUGGISH";
    if (kind === "GREAT") r.launchMul = 1.2;
    else if (kind === "GOOD") r.launchMul = 1.08;
    else r.launchMul = 0.55;
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
    clearRemotes();
    clearHostBots();
    applyGameSpeed(1);
    clearMe();
    if (net) net.leave();
    syncShareField();
    applyTrack(trackCode, true, true);
    touchCtl.gyroNeedCal = true;
    state = "start";
    setScreen("start");
    releaseTypeFocus();
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
      eachCpu(function (r) {
        if (r.finished && r.finishTime < player.finishTime) place += 1;
      });
      var ord = place + (place === 1 ? "st" : place === 2 ? "nd" : place === 3 ? "rd" : "th");
      hud.finishPlace.textContent = ord + " · vs 7 CPUs";
    }
  }

  function speedKph(r) {
    if (!r) return 0;
    var fromSpeed = Math.abs(r.speed) * KPH_PER_UNIT;
    var fromSlide = Math.abs(r.slide || 0) * KPH_PER_UNIT;
    return Math.round(Math.min(TOP_KPH, Math.max(fromSpeed, fromSlide)));
  }

  function motionKph(r, moved, dt) {
    var live = speedKph(r);
    var step = dt > 0.0001 ? dt : 1 / 60;
    var fromMove = (moved / step) * KPH_PER_UNIT;
    var shown = Math.min(TOP_KPH, Math.max(live, fromMove));
    if (shown < 0.5) return 0;
    return Math.round(shown);
  }

  var _hudX = 0;
  var _hudZ = 0;
  var _hudHave = false;
  function updateHud() {
    if (!_hudHave) {
      _hudX = player.x;
      _hudZ = player.z;
      _hudHave = true;
    }
    var moved = Math.hypot(player.x - _hudX, player.z - _hudZ);
    _hudX = player.x;
    _hudZ = player.z;
    if (hud.speed) hud.speed.textContent = String(motionKph(player, moved, lastDt));
    if (hud.lap) hud.lap.textContent = player.lap + "/" + LAPS;
    if (hud.time) hud.time.textContent = formatTime(raceTime);
    var fuel = clamp(player.fuel, 0, 100);
    var tires = clamp(player.tires, 0, 100);
    if (hud.fuelFill) {
      hud.fuelFill.style.transform = "scaleX(" + fuel / 100 + ")";
      hud.fuelFill.style.background = fuel < 28 ? "linear-gradient(90deg,#7a1010,#ff4d4d)" : "";
    }
    if (hud.tireFill) {
      hud.tireFill.style.transform = "scaleX(" + tires / 100 + ")";
      hud.tireFill.style.background = tires < 40 ? "linear-gradient(90deg,#8a5a10,#ffd36a)" : "";
    }
    if (hud.fuelNum) hud.fuelNum.textContent = String(Math.round(fuel));
    if (hud.tireNum) hud.tireNum.textContent = String(Math.round(tires));
    paintRevs();

    // PIT LANE banner is the halfway LEFT box only. The peel mouth
    // (PIT_LANE x=8) is not a grab and must not paint the racing line.
    var inBox = inPitGrab(player);
    var visiting = pitServicing || pitVisit || pitHudPct > 0;
    var pitting = state === "racing" && (visiting || inBox || pitFlash > 0 || pitAwayT < 0.48);
    if (pitServicing) {
      var livePct = Math.min(100, Math.round((pitTimer / PIT_HOLD) * 100));
      if (livePct > pitHudPct) pitHudPct = livePct;
    }
    var nextBanner = "";
    if (pitFlash > 0) nextBanner = "SERVICED";
    else if (pitServicing || (pitVisit && !pitUsedVisit && pitHudPct > 0)) nextBanner = "PITTING  " + pitHudPct + "%";
    else if (pitUsedVisit && (inBox || pitAwayT < 0.48)) nextBanner = "SERVICED — drive out";
    else if (inBox) nextBanner = "PIT LANE";
    if (hud.pitting) {
      hud.pitting.classList.toggle("hidden", !nextBanner);
      if (nextBanner !== pitBanner) {
        hud.pitting.textContent = nextBanner;
        pitBanner = nextBanner;
      }
    }

    var warn = "";
    if (lateJoinT > 0) warn = "RACE ALREADY GOING — you dropped in mid-race";
    else if (hostPaused()) warn = "PAUSED — host stopped the race";
    else if (launchCallT > 0) warn = launchCall;
    else if (state === "racing" && player.fuel <= 0) warn = "EMPTY — LIMP HOME";
    else if (state === "racing" && player.tires < 40) warn = "TIRES LOOSE — don't carry the sweeper";
    else if (state === "racing" && player.fuel < 38) warn = "PIT WINDOW — peel LEFT onto the second road";
    if (hud.warn) {
      hud.warn.textContent = warn;
      hud.warn.classList.toggle("hidden", !warn);
      hud.warn.classList.toggle("late", lateJoinT > 0);
      hud.warn.classList.toggle("launch", launchCallT > 0 && launchCall !== "DUMP");
      hud.warn.classList.toggle("dump", launchCallT > 0 && launchCall === "DUMP");
    }
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
    ctx.strokeStyle = "#2ec8c3";
    ctx.lineWidth = 1.8;
    if (PIT_PATH.length) {
      ctx.beginPath();
      var ps;
      var first = true;
      for (ps = 0; ps < PIT_PATH.length; ps++) {
        var pseg = PIT_PATH[ps];
        var n = Math.max(4, Math.round((pseg.len || 12) / 6));
        var u;
        for (u = 0; u <= n; u++) {
          var ppt = pointOnSeg(pseg, u / n);
          var pxy = miniXY(ppt.x, ppt.z, w, h, 8);
          if (first) {
            ctx.moveTo(pxy.x, pxy.y);
            first = false;
          } else ctx.lineTo(pxy.x, pxy.y);
        }
      }
      ctx.stroke();
    } else {
      var pitA = miniXY(PIT_LANE.x0, (PIT_LANE.z0 + PIT_LANE.z1) * 0.5, w, h, 8);
      var pitB = miniXY(PIT_LANE.x1, (PIT_LANE.z0 + PIT_LANE.z1) * 0.5, w, h, 8);
      ctx.beginPath();
      ctx.moveTo(pitA.x, pitA.y);
      ctx.lineTo(pitB.x, pitB.y);
      ctx.stroke();
    }
    if (!mpMode) {
      eachCpu(function (r, i) {
        var hex = (SOLO_FIELD[i].color | 0).toString(16);
        while (hex.length < 6) hex = "0" + hex;
        paintMiniDot(ctx, r.x, r.z, "#" + hex, 4);
      });
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
    var py = rideHeight(player.x, player.z);
    var desired = new THREE.Vector3(player.x - fx * back, py + up, player.z - fz * back);
    desired.y = py + up;
    var lx = Math.cos(player.heading);
    var lz = Math.sin(player.heading);
    var look = new THREE.Vector3(player.x + lx * 24, py + 1.05, player.z + lz * 24);
    camera.up.set(0, 1, 0);
    if (camera.position.y > py + 10 || camera.position.distanceToSquared(desired) > 220) {
      camera.position.copy(desired);
      camFollowH = player.heading;
    } else {
      camera.position.lerp(desired, 1 - Math.pow(0.00035, dt));
    }
    camera.position.y = py + up;
    camera.lookAt(look);
  }

  function titleCamera(dt) {
    camYaw += dt * 0.16;
    camera.position.set(8 + Math.cos(camYaw) * 120, 40, -20 + Math.sin(camYaw) * 120);
    camera.lookAt(8, 8, -20);
  }

  function pinGrid(r, x, z, h) {
    r.speed = 0;
    r.slide = 0;
    r.x = x;
    r.z = z;
    r.heading = h != null && isFinite(h) ? h : faceRaceAt(x, z);
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
    pinGrid(player, playerGridX, playerGridZ, gridHeading);
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
      eachCpu(function (r, i) {
        var g = cpuGrid[i];
        if (g) pinGrid(r, g.x, g.z, slotHeading(g));
      });
    }
    chaseCamera(dt);
  }

  function lerpAng(a, b, t) {
    var d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + d * t;
  }

  function clearRemotes() {
    Object.keys(remotes).forEach(function (id) {
      dropNameTag(remotes[id].r);
      scene.remove(remotes[id].r.mesh);
    });
    remotes = {};
  }

  function clearHostBots() {
    Object.keys(hostBots).forEach(function (id) {
      dropNameTag(hostBots[id]);
      scene.remove(hostBots[id].mesh);
    });
    hostBots = {};
  }

  function roomBotLook(p) {
    if (p && p.name === "BowieKnife99") return { color: 0xd4a017, num: 12 };
    var skin = SKINS[((p && p.slot) || 0) % SKINS.length];
    return { color: skin.color, num: skin.num };
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
        var look = roomBotLook(p);
        var g = gridSlot(p.slot);
        var r = createRacer("cpu", look.color, p.name || "Bot", look.num);
        resetRacer(r, g.x, g.z, slotHeading(g), TRACK_LEN - 6 - Math.floor(p.slot / 2) * 8);
        hostBots[p.id] = r;
      }
      hostBots[p.id].mesh.visible = true;
      if (p.name && hostBots[p.id].name !== p.name) {
        hostBots[p.id].name = p.name;
        paintNameTag(hostBots[p.id]);
      } else if (p.name) {
        hostBots[p.id].name = p.name;
      }
    });
    Object.keys(hostBots).forEach(function (id) {
      if (!keep[id]) {
        dropNameTag(hostBots[id]);
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
        pinGrid(hostBots[ids[i]], g.x, g.z, slotHeading(g));
      }
    } else if (state === "racing") {
      for (i = 0; i < ids.length; i++) {
        updateCpu(hostBots[ids[i]], dt);
        updateLaps(hostBots[ids[i]]);
        bashCars(player, hostBots[ids[i]]);
        bashCars(player, hostBots[ids[i]]);
        bashCars(player, hostBots[ids[i]]);
        bashAllWalls(hostBots[ids[i]]);
        emitRacerFx(hostBots[ids[i]], null, dt, false);
      }
      bashAllWalls(player);
      for (i = 0; i < ids.length; i++) {
        for (j = i + 1; j < ids.length; j++) {
          bashCars(hostBots[ids[i]], hostBots[ids[j]]);
          bashCars(hostBots[ids[i]], hostBots[ids[j]]);
          bashCars(hostBots[ids[i]], hostBots[ids[j]]);
        }
        Object.keys(remotes).forEach(function (rid) {
          bashCars(hostBots[ids[i]], remotes[rid].r);
          bashCars(hostBots[ids[i]], remotes[rid].r);
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
        if (ch.userData && ch.userData.nametag) return;
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
        dropNameTag(remotes[id].r);
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

  function fillRoster(list) {
    if (!list || !net) return;
    list.innerHTML = "";
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
      list.appendChild(li);
      if (p.id !== net.id && !p.bot && remotes[p.id]) {
        paintCar(remotes[p.id].r.mesh, p.body, p.wing);
      }
    });
  }

  function paintRoster() {
    if (!net) return;
    if (net.speed != null) applyGameSpeed(net.speed);
    if (hud.roomCode) hud.roomCode.textContent = net.room || "-----";
    if (hud.lobbyStatus) {
      if (net.phase === "finish") {
        hud.lobbyStatus.textContent = net.isHost()
          ? "That race is over — host can grid up again"
          : "That race is over — wait for the host";
      } else {
        hud.lobbyStatus.textContent = net.isHost()
          ? "You are host · Enter to grid up"
          : "Waiting for host to grid up";
      }
    }
    if (hud.lobbyErr) hud.lobbyErr.textContent = net.err || "";
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
    fillRoster(hud.roster);
    if (menuOpen) fillRoster(hud.pauseRoster);
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
    closePauseMenu();
    var mine = (net.players || []).filter(function (p) {
      return p.id === net.id;
    })[0];
    var slot = mine ? mine.slot : 0;
    adoptRoomTrack();
    var g = gridSlot(slot);
    playerGridX = g.x;
    playerGridZ = g.z;
    gridHeading = slotHeading(g);
    resetGrid();
    adoptHostBots();
    touchCtl.gyroNeedCal = true;
    state = "start";
    setScreen("start");
    releaseTypeFocus();
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
      releaseTypeFocus();
      setRevSound(false);
    }
  }

  function enterOnlineRace(msg) {
    joining = false;
    mpMode = true;
    var you = (msg && msg.you) || {};
    var localMe = loadMe(net && net.room);
    var slot = you.slot != null ? you.slot : localMe && localMe.slot != null ? localMe.slot : 1;
    adoptRoomTrack();
    var g = gridSlot(slot);
    playerGridX = g.x;
    playerGridZ = g.z;
    gridHeading = slotHeading(g);
    resetGrid();
    adoptHostBots();
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
    if (net && net.paused) openPauseMenu();
    else closePauseMenu();
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
    if (msg.paused != null && net) net.paused = !!msg.paused;
    if (state === "racing" && mpMode && msg.phase === "racing") {
      if (msg.rejoin || beenRacing(msg.you)) applyYou(msg.you);
      if (msg.raceTime != null && isFinite(+msg.raceTime) && +msg.raceTime > 0) {
        raceTime = +msg.raceTime;
      }
      if (msg.late && !msg.rejoin && !beenRacing(msg.you)) lateJoinT = 8;
      ingestSnap(msg.cars || (net && net.snap) || []);
      persistMe();
      if (net && net.paused) openPauseMenu();
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
    lastDt = simDt;
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

    if (portraitRaceBlock()) {
      lastTs = ts;
      lastDt = 0.016;
      touchCtl.steer = 0;
      setRevSound(false);
      lockLandscape();
      syncMobileUi();
      updateSky(dt);
      layoutNameTags();
      updateHud();
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
      return;
    }

    if (state === "title" || state === "lobby") {
      titleCamera(dt);
      setRevSound(false);
    } else if (worldFrozen() && (state === "start" || state === "racing")) {
      setRevSound(false);
      if (mpMode) poseRemotes();
      chaseCamera(dt);
    } else if (state === "start") {
      tickStart(simDt);
      if (mpMode) {
        poseRemotes();
        tickHostBots(simDt);
        sendNetState();
      }
    } else if (state === "racing") {
      releaseTypeFocus();
      raceTime += simDt;
      revs = 0;
      var input = playerInput();
      if (inPitLane(player) || inPitGrab(player) || pitServicing) {
        pitAwayT = 0;
      } else {
        pitAwayT += simDt;
        if (pitAwayT >= 0.48) {
          pitTimer = 0;
          pitHudPct = 0;
          pitUsedVisit = false;
          pitVisit = false;
        }
      }
      if (pitServicing) {
        input = { steer: 0, throttle: false, reverse: false, brake: true };
        player.speed = 0;
        player.slide = 0;
        pitTimer += simDt;
        if (pitTimer > PIT_HOLD) pitTimer = PIT_HOLD;
        var nextPct = Math.min(100, Math.round((pitTimer / PIT_HOLD) * 100));
        if (nextPct > pitHudPct) pitHudPct = nextPct;
        if (pitTimer >= PIT_HOLD) {
          player.fuel = 100;
          player.tires = 100;
          didPit = true;
          pitUsedVisit = true;
          pitServicing = false;
          pitHudPct = 100;
          pitFlash = 1.2;
        }
      }
      applyMotion(player, input.steer, input.throttle, input.brake, input.reverse, simDt, true);
      bashAllWalls(player);
      emitRacerFx(player, input, simDt, true);
      if (!pitServicing && (input.throttle || input.reverse || drive.up || drive.down) && Math.abs(player.speed) <= 0.35) {
        if (input.throttle || drive.up) player.speed += ACCEL * simDt;
        else player.speed -= REVERSE_ACCEL * simDt;
      }
      var ribbon = projectTrack(player.x, player.z);
      var onRace = ribbon && ribbon.dist <= ASPHALT;
      if (!pitServicing && !pitUsedVisit && inPitGrab(player) && !onRace) {
        pitServicing = true;
        pitVisit = true;
        player.speed = 0;
        player.slide = 0;
        poseCar(player);
      }
      updateLaps(player);
      if (mpMode) {
        poseRemotes();
        tickHostBots(simDt);
        bashOtherCars();
        sendNetState();
        if (!pitServicing && (input.throttle || input.reverse || drive.up || drive.down) && Math.abs(player.speed) <= 0.35) {
          if (input.throttle || drive.up) player.speed += ACCEL * simDt;
          else player.speed -= REVERSE_ACCEL * simDt;
        }
      } else {
        eachCpu(function (r) {
          updateCpu(r, simDt);
        });
        var bi;
        var bj;
        var pass;
        for (pass = 0; pass < 3; pass++) {
          eachCpu(function (r) {
            bashCars(player, r);
          });
          for (bi = 0; bi < cpus.length; bi++) {
            for (bj = bi + 1; bj < cpus.length; bj++) {
              bashCars(cpus[bi], cpus[bj]);
            }
          }
        }
        bashAllWalls(player);
        eachCpu(function (r) {
          bashAllWalls(r);
          emitRacerFx(r, null, simDt, false);
        });
        if (!pitServicing && (input.throttle || input.reverse || drive.up || drive.down) && Math.abs(player.speed) <= 0.35) {
          if (input.throttle || drive.up) player.speed += ACCEL * simDt;
          else player.speed -= REVERSE_ACCEL * simDt;
        }
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

  function portraitRaceBlock() {
    // Viewport only. Keyboard, Chromebook UA, and fine pointer do not
    // unlock a tall-window race — they only hide the gas/brake pads.
    return (state === "start" || state === "racing") && window.innerHeight > window.innerWidth;
  }

  function lockLandscape() {
    var so = window.screen && window.screen.orientation;
    if (!so || typeof so.lock !== "function") return;
    try {
      var p = so.lock("landscape");
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (err) {}
  }

  function unlockOrientation() {
    var so = window.screen && window.screen.orientation;
    if (!so || typeof so.unlock !== "function") return;
    try {
      so.unlock();
    } catch (err2) {}
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
    var blocked = portraitRaceBlock();
    if (!phone) clearTouchDrive();
    if (blocked) {
      touchCtl.steer = 0;
      clearTouchDrive();
      touchCtl.gyroNeedCal = true;
    }
    document.documentElement.classList.toggle("race-live", drive);
    document.documentElement.classList.toggle("race-portrait", blocked);
    if (hud.menuBtn) hud.menuBtn.classList.toggle("hidden", !drive);
    if (hud.touchLayer) hud.touchLayer.classList.toggle("hidden", !(phone && drive && !blocked && !menuOpen));
    if (hud.rotateHint) {
      hud.rotateHint.classList.toggle("hidden", !blocked);
    }
    if (hud.tiltBtn) {
      hud.tiltBtn.classList.toggle("hidden", !(phone && drive && needsTiltTap() && !blocked));
    }
    if (hud.revHint && phone) {
      hud.revHint.textContent = "HOLD the right half to climb — lift to catch the green. Past the mark is sluggish.";
    }
    if (drive) lockLandscape();
    else unlockOrientation();
    if (phone && !touchCtl.hintShown && !blocked) showFirstMobileHint();
  }

  function screenAngle() {
    var so = window.screen && window.screen.orientation;
    if (so && typeof so.angle === "number") return so.angle;
    if (typeof window.orientation === "number") return window.orientation;
    return isLandscape() ? 90 : 0;
  }

  function tiltNum(v) {
    v = +v;
    return v === v ? v : 0;
  }

  function tiltRaw(e) {
    var beta = tiltNum(e.beta);
    var gamma = tiltNum(e.gamma);
    var ang = ((screenAngle() % 360) + 360) % 360;
    // Recapture rest only when the screen actually rotates. A gamma sign
    // flip mid-roll used to steal the leaned pose as the new "straight".
    if (touchCtl.tiltAng != null && touchCtl.tiltAng !== ang) {
      touchCtl.gyroNeedCal = true;
    }
    touchCtl.tiltAng = ang;
    var side = tiltSide(gamma, ang);
    touchCtl.tiltSide = side;
    // Landscape roll only. Never swap beta/gamma mid-tilt — a |gamma| > 40
    // switch is what made steer flip while the phone was already sideways.
    if (ang === 90) return beta;
    if (ang === 270) return -beta;
    if (ang === 180) return -gamma;
    if (isLandscape()) return side * beta;
    return gamma;
  }

  function tiltSide(gamma, ang) {
    if (ang === 270 || ang === 180) return -1;
    if (ang === 90) return 1;
    return gamma < 0 ? -1 : 1;
  }

  function applyGyro(raw) {
    if (touchCtl.gyroNeedCal) {
      // A big lean is a turn, not a new rest pose. Only absorb a small hold.
      touchCtl.gyroCenter = Math.abs(raw) <= TILT_CAL_MAX ? raw : 0;
      touchCtl.gyroNeedCal = false;
      touchCtl.gyroFilt = 0;
    } else if (Math.abs(raw) < TILT_LEVEL) {
      // Roll-level is straight. Returning the phone to normal must not keep
      // a leaned center (that was "tilt right does nothing, then left").
      touchCtl.gyroCenter = raw;
      touchCtl.gyroFilt = 0;
      touchCtl.steer = 0;
      return;
    }
    var d = raw - touchCtl.gyroCenter;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    var mag = 0;
    if (Math.abs(d) > TILT_DEAD) {
      mag = clamp((Math.abs(d) - TILT_DEAD) / TILT_SPAN, 0, 1);
      mag = mag * mag * (3 - 2 * mag);
    }
    // Match keyboard: A / left = +steer, D / right = -steer.
    var target = (d > 0 ? -1 : 1) * mag;
    touchCtl.gyroFilt += (target - touchCtl.gyroFilt) * 0.55;
    if (Math.abs(touchCtl.gyroFilt) < 0.02) touchCtl.gyroFilt = 0;
    touchCtl.steer = touchCtl.gyroFilt;
  }

  function onOrient(e) {
    if (!isPhoneLike()) return;
    if (state !== "start" && state !== "racing") return;
    if (portraitRaceBlock()) {
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
            lockLandscape();
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
    lockLandscape();
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
    if (touchCtl.brake && !brake) spaceBrakeArmed = true;
    touchCtl.brake = brake;
  }

  function bindMobile() {
    var layer = hud.touchLayer;
    if (!layer) return;
    layer.addEventListener("pointerdown", function (e) {
      if (!isPhoneLike()) return;
      if (e.target && e.target.id === "rev-btn") return;
      e.preventDefault();
      var rect = layer.getBoundingClientRect();
      var half = e.clientX >= rect.left + rect.width * 0.5 ? "gas" : "brake";
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
    var a = el || document.activeElement;
    if (!a || a === document.body || a === document.documentElement) a = document.activeElement;
    if (!a) return false;
    var tag = (a.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (a.isContentEditable) return true;
    return false;
  }

  function isTyping() {
    // Hidden share/name/join fields must not eat W after Solo.
    if (state === "start" || state === "racing") return false;
    return typingField(document.activeElement);
  }

  function releaseTypeFocus() {
    // Solo from a share string leaves #track-paste focused (hidden, still
    // active). W then never reaches the car while fuel keeps ticking.
    // Blur only when lights/GO start — keep-focus stays in the editor.
    var fields = [hud.trackPaste, hud.nameInput];
    var join = document.getElementById("join-code");
    if (join) fields.push(join);
    var i;
    for (i = 0; i < fields.length; i++) {
      if (fields[i] && fields[i].blur) fields[i].blur();
    }
    var a = document.activeElement;
    if (a && typingField(a) && a.blur) a.blur();
  }

  function syncShareField() {
    if (!hud.trackPaste) return;
    var c = cleanTrack(hud.trackPaste.value || "");
    if (c !== cleanTrack(trackCode || "")) commitTrack(c);
  }

  function trapTextKeys(el, onEnter) {
    if (!el) return;
    el.addEventListener("keydown", function (e) {
      if (state === "start" || state === "racing") {
        noteDriveKey(e, true);
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
          e.preventDefault();
        }
        return;
      }
      e.stopPropagation();
      if (e.code === "Enter" && onEnter) {
        e.preventDefault();
        onEnter();
      }
    });
    el.addEventListener("keyup", function (e) {
      if (state === "start" || state === "racing") return;
      e.stopPropagation();
    });
  }

  function onKey(e, down) {
    if (state !== "start" && state !== "racing" && (isTyping() || typingField(e.target))) {
      if (down && e.code === "Enter") {
        var who = typingField(e.target) ? e.target : document.activeElement;
        if (who && who.id === "join-code") {
          openFriends("join", who.value);
          e.preventDefault();
        } else if (who && who.id === "track-paste") {
          commitTrack(who.value);
          e.preventDefault();
        }
      }
      return;
    }
    noteDriveKey(e, down);
    if (e.code === "Space" || e.key === " " || e.key === "Spacebar") {
      if (!down || !e.repeat) spaceBrakeArmed = true;
    }
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
    if (down && (e.code === "Escape" || e.code === "KeyP")) {
      if (state === "finished") {
        leaveRace();
        e.preventDefault();
        return;
      }
      if (canOpenMenu()) {
        togglePauseMenu();
        e.preventDefault();
        return;
      }
    }
    if (menuOpen) {
      if (down && (e.code === "Enter" || e.code === "Space")) {
        resumeFromMenu();
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
      return;
    }
    if (down && (e.code === "Space" || e.code === "Enter")) {
      if (state === "track") {
        e.preventDefault();
        return;
      }
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

  window.addEventListener(
    "keydown",
    function (e) {
      noteDriveKey(e, true);
    },
    true
  );
  window.addEventListener(
    "keyup",
    function (e) {
      noteDriveKey(e, false);
    },
    true
  );
  window.addEventListener("keydown", function (e) {
    onKey(e, true);
  });
  window.addEventListener("keyup", function (e) {
    onKey(e, false);
  });
  window.addEventListener("blur", function () {
    keys = Object.create(null);
    drive.up = drive.down = drive.left = drive.right = drive.space = false;
    spaceBrakeArmed = true;
    touchCtl.pads = {};
    touchCtl.gas = false;
    touchCtl.brake = false;
    touchCtl.rev = false;
    // pitTimer stays on blur. Leave the pit lane to reset a visit.
  });
  function onViewChange() {
    fitView();
    if (state === "start" || state === "racing") lockLandscape();
    syncMobileUi();
    if (state === "track") scheduleTrackLayout();
  }
  window.addEventListener("resize", onViewChange);
  window.addEventListener("orientationchange", function () {
    onViewChange();
    setTimeout(onViewChange, 80);
    setTimeout(onViewChange, 300);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onViewChange);
    window.visualViewport.addEventListener("scroll", onViewChange);
  }

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
        if (
          state === "title" ||
          state === "lobby" ||
          state === "finished" ||
          state === "start" ||
          state === "racing"
        ) {
          state = "lobby";
          setScreen("lobby");
        }
        if (net.phase === "finish" && hud.lobbyStatus) {
          hud.lobbyStatus.textContent = "That race is over — host can grid up again";
        }
      } else if (net.phase === "start" && (state === "racing" || state === "finished")) {
        beginOnlineStart();
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
      if (menuOpen) paintPauseMenu();
      if (net.paused && canOpenMenu() && !menuOpen) openPauseMenu();
    });
    net.on("lights", function () {
      if (state === "lobby" || state === "title") beginOnlineStart();
    });
    net.on("go", goOnline);
    net.on("pause", function () {
      if (net.paused && canOpenMenu()) openPauseMenu();
      paintPauseMenu();
    });
    net.on("snap", function (msg) {
      if (mpMode && net && net.isHost()) adoptHostBots();
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
  function bindRosterList(list) {
    if (!list) return;
    list.addEventListener("click", function (e) {
      var t = e.target;
      while (t && t !== list && (!t.getAttribute || !t.getAttribute("data-id"))) t = t.parentNode;
      if (!t || t === list) return;
      lobbyPick = t.getAttribute("data-id") || "";
      paintRoster();
      if (menuOpen) paintPauseMenu();
    });
  }
  bindRosterList(hud.roster);
  bindRosterList(hud.pauseRoster);

  function hostKickPick() {
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
  }

  function hostRemoveBotPick() {
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
  }

  function hostCycleSpeed() {
    if (!net || !net.isHost()) return;
    var i = SPEED_STEPS.indexOf(gameSpeed);
    if (i < 0) i = 0;
    net.setSpeed(SPEED_STEPS[(i + 1) % SPEED_STEPS.length]);
  }

  if (btnKick) btnKick.addEventListener("click", hostKickPick);
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
  if (btnRemoveBot) btnRemoveBot.addEventListener("click", hostRemoveBotPick);
  if (hud.speedBtn) hud.speedBtn.addEventListener("click", hostCycleSpeed);
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
      releaseTypeFocus();
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
  if (btnLeave) btnLeave.addEventListener("click", leaveRace);

  if (hud.menuBtn) {
    hud.menuBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      togglePauseMenu();
    });
  }
  var btnResume = document.getElementById("btn-resume");
  var btnQuit = document.getElementById("btn-quit");
  var btnPauseAll = document.getElementById("btn-pause-all");
  var btnEndRace = document.getElementById("btn-end-race");
  var btnNewRace = document.getElementById("btn-new-race");
  var btnPauseKick = document.getElementById("btn-pause-kick");
  var btnPauseAddBot = document.getElementById("btn-pause-add-bot");
  var btnPauseRemoveBot = document.getElementById("btn-pause-remove-bot");
  var btnFinishAgain = document.getElementById("btn-finish-again");
  var btnFinishLeave = document.getElementById("btn-finish-leave");
  if (btnResume) {
    btnResume.addEventListener("click", function (e) {
      e.preventDefault();
      resumeFromMenu();
    });
  }
  if (btnQuit) btnQuit.addEventListener("click", leaveRace);
  if (btnPauseAll) {
    btnPauseAll.addEventListener("click", function () {
      if (!net || !net.isHost() || !net.pause) return;
      net.pause(!net.paused);
    });
  }
  if (btnEndRace) {
    btnEndRace.addEventListener("click", function () {
      if (net && net.isHost() && net.endRace) net.endRace();
    });
  }
  if (btnNewRace) {
    btnNewRace.addEventListener("click", function () {
      if (net && net.isHost()) net.start();
    });
  }
  if (btnPauseKick) btnPauseKick.addEventListener("click", hostKickPick);
  if (btnPauseAddBot) {
    btnPauseAddBot.addEventListener("click", function () {
      if (net && net.isHost()) net.addBot();
    });
  }
  if (btnPauseRemoveBot) btnPauseRemoveBot.addEventListener("click", hostRemoveBotPick);
  if (hud.pauseSpeedBtn) hud.pauseSpeedBtn.addEventListener("click", hostCycleSpeed);
  if (btnFinishAgain) {
    btnFinishAgain.addEventListener("click", function () {
      if (mpMode) {
        state = "lobby";
        setScreen("lobby");
        paintRoster();
        return;
      }
      startSequence();
    });
  }
  if (btnFinishLeave) btnFinishLeave.addEventListener("click", leaveRace);

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
        if (el.id === "btn-tile-rot" || el.hasAttribute("data-rot-handle") || el.classList.contains("tile-rot-handle")) {
          return { kind: "rot", el: el };
        }
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
        if (el.hasAttribute("data-tile") && (el.classList.contains("palette-tile") || el.classList.contains("palette-slot"))) {
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
      if (
        el.classList &&
        (el.classList.contains("lobby-btn") ||
          el.classList.contains("lobby-row") ||
          el.classList.contains("tile-rot") ||
          el.classList.contains("tile-rot-handle"))
      ) {
        return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function startEditorDrag(e, hit) {
    if (!hit || (hit.kind !== "palette" && hit.kind !== "cell")) return;
    if (hit.kind === "cell" && !hit.ch) return;
    var ghost = document.createElement("div");
    ghost.className = "tile-ghost";
    var span = pieceSpan(hit.ch, hit.rot || 0);
    ghost.style.width = 40 * span.cols + "px";
    ghost.style.height = 40 * span.rows + "px";
    ghost.innerHTML = tileIconSvg(hit.ch, hit.rot || 0, 40 * span.cols, 40 * span.rows);
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
      if (over && over.kind === "cell") placePiece(ch, over.x, over.y, rot || 0);
      tilePick = "";
      paintTrackEditor();
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
    document.addEventListener("pointerup", endEditorDrag);
    document.addEventListener("pointercancel", endEditorDrag);
    window.addEventListener("blur", function () {
      killGhost();
      editorDrag = null;
    });
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
        e.stopPropagation();
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
      if (net && net.active && net.isHost() && net.setTrack) net.setTrack(isDriveableLoop() || isBuiltinCode(trackCode) ? trackCode : "");
    });
  }
  if (btnTrackCampus) {
    btnTrackCampus.addEventListener("click", function () {
      restoreCampusLoop();
    });
  }
  function bindCircuitRow(row) {
    if (!row) return;
    row.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-circuit]") : null;
      if (!btn) return;
      pickBuiltin(btn.getAttribute("data-circuit") || "");
    });
  }
  bindCircuitRow(hud.circuitPicks);
  bindCircuitRow(hud.circuitPicksEditor);
  bindCircuitRow(hud.circuitPicksLobby);
  bindCircuitRow(document.getElementById("pause-circuits"));
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
      syncShareField();
      applyTrack(trackCode, true, true);
      if (net && net.active && net.isHost() && net.setTrack) net.setTrack(isDriveableLoop() || isBuiltinCode(trackCode) ? trackCode : "");
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
  trapTextKeys(hud.trackPaste, function () {
    commitTrack(hud.trackPaste.value);
  });
  trapTextKeys(hud.nameInput, null);
  trapTextKeys(joinCode, function () {
    openFriends("join", joinCode && joinCode.value);
  });

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
