/* Protocol smoke: two clients, create/join, lights, snap, late join, drop, rejoin. */
"use strict";

var { spawn } = require("child_process");
var { WebSocket } = require("ws");

var PORT = 8799;
var URL = "ws://127.0.0.1:" + PORT;
var kid = spawn(process.execPath, ["server/index.js"], {
  env: Object.assign({}, process.env, { PORT: String(PORT) }),
  stdio: ["ignore", "pipe", "pipe"],
});

function waitHealth() {
  return new Promise(function (resolve, reject) {
    var n = 0;
    var t = setInterval(function () {
      n += 1;
      fetch("http://127.0.0.1:" + PORT + "/health")
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          if (j.ok) {
            clearInterval(t);
            resolve();
          }
        })
        .catch(function () {
          if (n > 40) {
            clearInterval(t);
            reject(new Error("server did not start"));
          }
        });
    }, 100);
  });
}

function client(id) {
  return new Promise(function (resolve, reject) {
    var ws = new WebSocket(URL);
    var inbox = [];
    ws.on("open", function () {
      ws.send(JSON.stringify({ t: "hello", id: id, name: id }));
      resolve({
        ws: ws,
        inbox: inbox,
        send: function (o) {
          ws.send(JSON.stringify(o));
        },
        waitFor: waitFor,
        close: function () {
          ws.close();
        },
      });
    });
    ws.on("message", function (buf) {
      inbox.push(JSON.parse(String(buf)));
    });
    ws.on("error", reject);
    function waitFor(pred, ms) {
      var start = Date.now();
      return new Promise(function (res, rej) {
        var t = setInterval(function () {
          var hit = inbox.find(pred);
          if (hit) {
            clearInterval(t);
            res(hit);
          } else if (Date.now() - start > (ms || 4000)) {
            clearInterval(t);
            rej(new Error("timeout waiting " + id));
          }
        }, 20);
      });
    }
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function driveState(extra) {
  return Object.assign(
    {
      t: "state",
      x: 40,
      z: -80,
      h: 0,
      spd: 12,
      slide: 0,
      lap: 2,
      fuel: 10,
      tires: 22,
      pit: 0,
      finished: 0,
    },
    extra || {}
  );
}

waitHealth()
  .then(function () {
    return fetch("http://127.0.0.1:" + PORT + "/").then(function (r) {
      return r.text().then(function (html) {
        assert(r.status === 200, "origin 200");
        assert(/SchoolKart/i.test(html), "origin serves SchoolKart HTML");
        assert(html.indexOf("Point Pages at this host") === -1, "no Pages stub");
        assert(html.indexOf("btn-create") !== -1, "lobby on origin");
        assert(html.indexOf("display-name") !== -1, "name field on origin");
        assert(html.indexOf("Right gas · Left brake · Tilt to steer") !== -1, "mobile hint");
        assert(html.indexOf("body-swatches") !== -1, "garage on origin");
        assert(html.indexOf("btn-track") !== -1, "track editor on origin");
        assert(html.indexOf("Add Bowie knife") !== -1, "Add Bowie knife button");
        assert(html.indexOf('rel="manifest"') !== -1, "web app manifest link");
        assert(html.indexOf("apple-mobile-web-app-capable") !== -1, "iOS home screen capable");
        assert(html.indexOf('apple-mobile-web-app-title" content="SchoolKart"') !== -1, "iOS title");
        assert(html.indexOf('SK_BUILD = "mp57"') !== -1, "cache bump mp57");
        assert(html.indexOf('maxlength="240"') !== -1, "share-string fits a full board");
        assert(html.indexOf('id="title-track"') !== -1, "title label matches Solo load");
        assert(html.indexOf('autocapitalize="off"') !== -1, "share-string does not eat W/T via autocapitalize");
        assert(html.indexOf("tile-map") !== -1, "modular tile map");
        assert(html.indexOf("btn-tile-rot") !== -1, "rotate control");
        assert(html.indexOf("palette-slot") !== -1, "physical piece tray");
        assert(html.indexOf('data-tile="S"') !== -1, "long straight piece");
        assert(html.indexOf('data-tile="w"') !== -1, "sweeper piece");
        assert(html.indexOf('data-tile="F"') !== -1, "start/finish piece");
        assert(html.indexOf("Default · Campus Loop") !== -1, "Campus Loop default control");
        assert(html.indexOf("tile-board") !== -1, "drag tile board");
        assert(html.indexOf("tile-palette") !== -1, "tile palette");
        assert(html.indexOf("tile-trash") !== -1, "tile trash");
        assert(html.indexOf("Past the mark dumps") !== -1, "rev hint is timing not park");
        return fetch("http://127.0.0.1:" + PORT + "/manifest.json")
          .then(function (mr) {
            return mr.json().then(function (man) {
              assert(mr.status === 200, "manifest 200");
              assert(man.name === "SchoolKart" && man.short_name === "SchoolKart", "manifest name");
              assert(man.display === "standalone", "standalone chrome");
              assert(man.orientation === "landscape", "prefer landscape");
              assert(man.background_color === "#1a120e" && man.theme_color === "#1a120e", "dark theme");
              assert(man.start_url === "./", "same-origin start");
            });
          })
          .then(function () {
            return fetch("http://127.0.0.1:" + PORT + "/sw.js");
          })
          .then(function (sr) {
            return sr.text().then(function (sw) {
              assert(sr.status === 200, "sw 200");
              assert(sw.indexOf('BUILD = "mp57"') !== -1, "SW build matches cache");
              assert(/cache:\s*"no-store"/.test(sw), "network-first no-store");
              assert(sw.indexOf("websocket") !== -1, "SW leaves websocket alone");
            });
          })
          .then(function () {
            return Promise.all([
              fetch("http://127.0.0.1:" + PORT + "/js/game.js").then(function (r) {
                return r.text().then(function (js) {
                  assert(r.status === 200, "game.js 200");
                  assert(js.indexOf("tile-rot-handle") !== -1, "on-piece rotate handle");
                  assert(js.indexOf("MAP_SURF") !== -1 && js.indexOf("pieceSegs") !== -1, "driveable surface from pieces");
                  assert(js.indexOf("MAP_CLOSED") !== -1, "closed-loop lap flag");
                  assert(js.indexOf("TRACK_CODE_MAX") !== -1, "full-board share-string");
                  assert(js.indexOf("TYPE_ENC") !== -1 && js.indexOf("_rotLock") !== -1, "share W/T + 90 rotate locks");
                  assert(js.indexOf("lockRacePath") !== -1, "open boards bounce to Campus Loop");
                  assert(js.indexOf('lock("landscape")') !== -1, "race locks landscape when the browser allows");
                  assert(js.indexOf('lock("portrait")') === -1, "never lock or default to portrait");
                  assert(js.indexOf("portraitRaceBlock") !== -1, "portrait race is gated, not a vertical drive");
                  assert(!/function portraitRaceBlock\(\)[\s\S]{0,400}isPhoneLike/.test(js), "portrait gate ignores phone/keyboard/Chromebook");
                  assert(js.indexOf("innerHeight > window.innerWidth") !== -1, "portrait gate is viewport-only");
                  assert(js.indexOf("isChromeOS") !== -1, "Chromebook UA still skips gas/brake overlay");
                  assert(js.indexOf("exitPortAfter") !== -1 && js.indexOf("campusRoot") !== -1, "custom start does not stack piece walls or campus volumes");
                  assert(js.indexOf("MAP_SURF = PATH.slice()") !== -1, "custom physics uses the raced PATH, not leftover pieces");
                  assert(js.indexOf("hitKeepYaw") !== -1 && js.indexOf("hitYawT") !== -1, "wall hits shove without yaw teleport");
                  assert(js.indexOf("wallCutsRibbon") !== -1, "custom corner walls cannot chord the ribbon");
                  assert(js.indexOf("ribbonFitsFootprint") !== -1 && js.indexOf("ribbonsStack") !== -1, "modules fit; chicane S does not stack");
                  assert(js.indexOf("var ACCEL = 16") !== -1 && js.indexOf("var COAST = 5") !== -1, "slow wind-up; coast bleeds");
                  assert(js.indexOf("var BRAKE_DECEL = 20") !== -1, "Space is a planned squeeze for the 180");
                  assert(js.indexOf('info.name === "hairpin" || info.name === "chicane"') !== -1, "hold W through 180 or chicane dumps");
                  assert(js.indexOf("env *= env") !== -1, "chicane S is flat at the ports so ribbons meet on the edge");
                  assert(js.indexOf("var amp = MAP_CELL * 0.1") !== -1, "chicane S is shrunk so the ribbon stays in-cell");
                  assert(js.indexOf("pieceSegs(artPiece)") !== -1, "editor preview uses the same segs as the 3D race");
                  assert(js.indexOf("function steerWheelYaw") !== -1 && js.indexOf("return -steer * 0.42") !== -1, "A points fronts left, D points right");
                  assert(js.indexOf("function attachNameTag") !== -1 && js.indexOf("function layoutNameTags") !== -1, "halo nametags");
                  assert(!/function attachNameTag\([\s\S]{0,500}new THREE\.Sprite/.test(js), "nametags are mesh billboards, not X-flip-killed sprites");
                  assert(js.indexOf('r.kind !== "player"') !== -1, "own nametag can stay off; others still show");
                  assert(js.indexOf("rideHeight() + 1.46") !== -1, "tags sit tiny over the halo, not at chase-cam height");
                  assert(/function playerInput\(\)[\s\S]{0,180}portraitRaceBlock/.test(js), "portrait zeros input before keyboard path");
                  assert(js.indexOf("#ff2038") !== -1 && js.indexOf("#3a3e46") !== -1, "asphalt + kerb piece art");
                });
              }),
              fetch("http://127.0.0.1:" + PORT + "/css/style.css").then(function (r) {
                return r.text().then(function (css) {
                  assert(r.status === 200, "style.css 200");
                  assert(css.indexOf("tile-rot-handle") !== -1, "fat rotate handle style");
                  assert(css.indexOf("palette-slot") !== -1, "piece tray slots");
                  assert(css.indexOf("overflow-y: auto") !== -1, "title menu scrolls on Chromebook/phone");
                  assert(css.indexOf("race-portrait") !== -1, "portrait race hides the vertical driving view");
                  assert(css.indexOf("html.race-portrait #rotate-hint.hidden") !== -1, "display:none cannot hide the sideways gate");
                  assert(css.indexOf("html.race-live #rotate-hint") !== -1, "tall race-live window forces the gate");
                  assert(/\.tile-cell\s*\{[^}]*overflow:\s*hidden/.test(css), "editor cells clip art so pieces cannot paint onto neighbors");
                });
              }),
            ]);
          })
          .then(function () {
            return Promise.all([
              fetch("http://127.0.0.1:" + PORT + "/icons/icon-192.png"),
              fetch("http://127.0.0.1:" + PORT + "/icons/icon-512.png"),
              fetch("http://127.0.0.1:" + PORT + "/apple-touch-icon.png"),
            ]);
          })
          .then(function (imgs) {
            return Promise.all(
              imgs.map(function (r) {
                assert(r.status === 200, "icon 200");
                return r.arrayBuffer().then(function (buf) {
                  var u = new Uint8Array(buf);
                  assert(u[0] === 137 && u[1] === 80 && u[2] === 78 && u[3] === 71, "PNG magic");
                });
              })
            );
          });
      });
    });
  })
  .then(function () {
    return Promise.all([client("hostA"), client("joinB")]);
  })
  .then(function (pair) {
    var a = pair[0];
    var b = pair[1];
    var room;
    a.send({ t: "create", name: "Host" });
    return a
      .waitFor(function (m) {
        return m.t === "room";
      })
      .then(function (roomMsg) {
        room = roomMsg;
        assert(room.code && room.code.length >= 4 && room.code.length <= 6, "code 4-6");
        assert(room.players.length === 1, "host alone");
        b.send({ t: "join", code: room.code, name: "Guest" });
        return b.waitFor(function (m) {
          return m.t === "room" && m.players && m.players.length === 2;
        });
      })
      .then(function () {
        return a.waitFor(function (m) {
          return m.t === "room" && m.players.length === 2;
        });
      })
      .then(function () {
        a.send({ t: "start" });
        return a.waitFor(function (m) {
          return m.t === "lights" && m.phase === "prestart";
        });
      })
      .then(function (lights) {
        assert(lights.holdDelay >= 0.2 && lights.holdDelay <= 3.01, "hold delay");
        return b.waitFor(function (m) {
          return m.t === "lights";
        });
      })
      .then(function () {
        return a.waitFor(function (m) {
          return m.t === "go";
        }, 16000);
      })
      .then(function () {
        a.send(driveState());
        return a.waitFor(function (m) {
          return (
            m.t === "snap" &&
            m.raceTime > 0 &&
            m.cars &&
            m.cars.some(function (c) {
              return c.id === "hostA" && c.fuel === 10 && c.lap === 2;
            })
          );
        }, 4000);
      })
      .then(function () {
        return client("lateC");
      })
      .then(function (c) {
        c.send({ t: "join", code: room.code, name: "Late" });
        return c
          .waitFor(function (m) {
            return m.t === "enter" && m.phase === "racing";
          })
          .then(function (enter) {
            assert(enter.late === true, "late join is marked");
            assert(enter.rejoin === false, "new car is not a rejoin");
            assert(enter.raceTime > 0, "late join gets the live clock");
            assert(enter.you && enter.you.fuel === 100, "late drop-in starts full");
            assert(
              enter.cars.some(function (car) {
                return car.id === "hostA" && car.fuel === 10;
              }),
              "late join sees the host car"
            );
            b.close();
            return a
              .waitFor(function (m) {
                return (
                  m.t === "room" &&
                  m.players.some(function (p) {
                    return p.id === "joinB" && p.ghost;
                  })
                );
              })
              .then(function () {
                a.close();
                return new Promise(function (res) {
                  setTimeout(res, 80);
                });
              })
              .then(function () {
                return client("hostA");
              })
              .then(function (a2) {
                a2.send({ t: "join", code: room.code, name: "Host" });
                return a2
                  .waitFor(function (m) {
                    return m.t === "enter" && m.rejoin === true;
                  })
                  .then(function (re) {
                    assert(re.phase === "racing", "refresh re-enters the live race");
                    assert(re.late === false, "refresh is not a late drop-in");
                    assert(re.you && re.you.fuel === 10, "refresh keeps fuel");
                    assert(re.you.tires === 22, "refresh keeps tires");
                    assert(re.you.lap === 2, "refresh keeps lap");
                    assert(re.you.x === 40, "refresh keeps pose");
                    assert(re.raceTime > 0, "refresh keeps the room clock");
                    assert(
                      re.cars.some(function (car) {
                        return car.id === "lateC";
                      }),
                      "refresh sees the other cars"
                    );
                    var mid = (8 + 118) * 0.5;
                    assert(10 < mid, "entry x does not grab");
                    console.log("OK rooms", room.code, "late+rejoin");
                    c.close();
                    a2.close();
                    return lobbyExtras();
                  });
              });
          });
      });
  })
  .then(function () {
    kid.kill();
    process.exit(0);
  })
  .catch(function (err) {
    console.error("FAIL", err);
    kid.kill();
    process.exit(1);
  });

function lobbyExtras() {
  return Promise.all([client("hostD"), client("joinE")]).then(function (pair) {
    var h = pair[0];
    var g = pair[1];
    var code;
    h.send({ t: "create", name: "Zachary", body: 0xd4a017, wing: 0x1a1a1a, track: "SsLH!!Rs" });
    return h
      .waitFor(function (m) {
        return m.t === "room";
      })
      .then(function (roomMsg) {
        code = roomMsg.code;
        assert(roomMsg.players[0].name === "Zachary", "host display name");
        assert(roomMsg.speed === 1, "default speed 1");
        assert(roomMsg.track === "SsLHRs", "track sanitized");
        assert(roomMsg.players[0].body === 0xd4a017, "host body color");
        assert(roomMsg.players[0].wing === 0x1a1a1a, "host wing color");
        g.send({ t: "join", code: code, name: "Maya" });
        return g.waitFor(function (m) {
          return m.t === "room" && m.players && m.players.length === 2;
        });
      })
      .then(function (joined) {
        var names = joined.players.map(function (p) {
          return p.name;
        });
        assert(names.indexOf("Zachary") !== -1 && names.indexOf("Maya") !== -1, "both names in roster");
        g.send({ t: "kick", id: "hostD" });
        return g.waitFor(function (m) {
          return m.t === "err";
        });
      })
      .then(function (err) {
        assert(/host/i.test(err.msg), "guest cannot kick");
        h.send({ t: "speed", n: 1.25 });
        return h.waitFor(function (m) {
          return m.t === "room" && m.speed === 1.25;
        });
      })
      .then(function () {
        return g.waitFor(function (m) {
          return m.t === "room" && m.speed === 1.25;
        });
      })
      .then(function () {
        g.send({ t: "bot", op: "bowie" });
        return g.waitFor(function (m) {
          return m.t === "err";
        });
      })
      .then(function (guestBowie) {
        assert(/host/i.test(guestBowie.msg), "guest cannot add Bowie");
        h.send({ t: "bot", op: "bowie" });
        h.send({ t: "bot", op: "bowie" });
        return h.waitFor(function (m) {
          return (
            m.t === "room" &&
            m.players.filter(function (p) {
              return p.bot && p.name === "BowieKnife99";
            }).length === 1 &&
            m.players.filter(function (p) {
              return p.bot;
            }).length === 1
          );
        });
      })
      .then(function (withBowie) {
        assert(withBowie.players.length === 3, "host + guest + Bowie");
        h.send({ t: "bot", op: "add" });
        return h.waitFor(function (m) {
          return (
            m.t === "room" &&
            m.players.filter(function (p) {
              return p.bot;
            }).length === 2
          );
        });
      })
      .then(function (withTwo) {
        var bots = withTwo.players.filter(function (p) {
          return p.bot;
        });
        assert(bots.length === 2, "host + guest + Bowie + extra");
        var names = bots.map(function (p) {
          return p.name;
        });
        assert(names.indexOf("BowieKnife99") !== -1, "hunter still in");
        assert(names.indexOf("Hall Monitor") !== -1, "+Bot still adds other personalities");
        var extra = bots.filter(function (p) {
          return p.name !== "BowieKnife99";
        })[0];
        h.send({ t: "kick", id: "joinE" });
        return g
          .waitFor(function (m) {
            return m.t === "kicked";
          })
          .then(function () {
            h.send({ t: "bot", op: "remove", id: extra.id });
            var hunter = bots.filter(function (p) {
              return p.name === "BowieKnife99";
            })[0];
            h.send({ t: "bot", op: "remove", id: hunter.id });
            return h.waitFor(function (m) {
              return (
                m.t === "room" &&
                m.players.length === 1 &&
                m.players[0].id === "hostD"
              );
            });
          });
      })
      .then(function () {
        console.log("OK lobby names/kick/bot/speed/bowie", code);
        h.close();
        g.close();
      });
  });
}
